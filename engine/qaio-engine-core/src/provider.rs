//! Provider management — relocated from `app/src-tauri/src/commands/provider.rs`.
//!
//! CLI-installation + auth-status probes and the OAuth login launcher.
//! Default-provider persistence reuses `crate::preferences` (generic
//! key/value store), so `DEFAULT_PROVIDER_KEY` is exposed for callers
//! that want to `get`/`set` the preference directly.

use crate::error::{CoreError, CoreResult};
use qaio_terminal_manager::provider_auth::{
    probe_claude_auth_status, probe_codex_auth_status, probe_antigravity_auth_status,
    ProviderAuthState,
};
use qaio_terminal_manager::{claude_path, Provider};
use qaio_ui_events::DynEventSink;
use serde::{Deserialize, Serialize};
use std::ffi::OsString;
use std::path::PathBuf;
use std::time::Duration;

mod login_session;
mod resolve;
use resolve::{resolve_claude, resolve_codex, resolve_antigravity};

pub const DEFAULT_PROVIDER_KEY: &str = "default_provider";

/// Where the resolved CLI binary came from. Surfaced to the UI so users
/// understand which version of `claude` / `codex` is in play (matches
/// the "bundled by Qaio vs. your existing install" UX clarification
/// users have asked for).
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum InstallSource {
    /// Shipped inside the Qaio `.app` (`Contents/Resources/bin/`).
    /// Codex falls in this bucket on production builds; composio too;
    /// claude-code never (proprietary license).
    Bundled,
    /// Downloaded by Qaio at runtime to a Qaio-managed location
    /// (`~/.local/bin/claude` etc.). Claude-code falls in this bucket
    /// after the first-launch installer completes.
    Managed,
    /// Found on the user's PATH outside Qaio's control (homebrew,
    /// npm, manual install, …). Qaio uses it as-is.
    Path,
    /// Not installed anywhere Qaio knows about.
    Missing,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProviderStatus {
    pub provider: String,
    pub cli_installed: bool,
    pub auth_state: ProviderAuthState,
    pub cli_name: String,
    /// Where Qaio found the CLI binary. Used for UI labelling.
    pub install_source: InstallSource,
    /// Absolute path to the binary that will be spawned. `None` when
    /// `install_source == Missing`.
    pub cli_path: Option<String>,
}

/// Parse a provider name string, mapping errors onto `CoreError::BadRequest`.
pub fn parse(s: &str) -> CoreResult<Provider> {
    s.parse::<Provider>()
        .map_err(|e| CoreError::BadRequest(format!("invalid provider: {e}")))
}

pub async fn check_status(provider: Provider) -> CoreResult<ProviderStatus> {
    Ok(match provider {
        Provider::Anthropic => check_claude_status().await,
        Provider::OpenAI => check_codex_status().await,
        Provider::Gemini => check_antigravity_status().await,
    })
}

/// Launch the provider's login flow in the background (opens the user's
/// browser for OAuth). Returns immediately. The spawned watcher emits
/// `ProviderLoginComplete` when the subprocess exits (naturally or via
/// cancel), so the frontend no longer needs to poll for completion.
///
/// Starting a new login for the same provider auto-cancels the previous.
pub async fn launch_login(provider: Provider, events: DynEventSink) -> CoreResult<()> {
    let ProviderCliCommand {
        cli_name,
        path,
        args,
        shell_path,
    } = login_command(provider)?;

    let child = tokio::process::Command::new(&path)
        .args(&args)
        .env("PATH", shell_path)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| {
            CoreError::Internal(format!("{cli_name} login failed to start: {e}"))
        })?;

    tracing::info!("[qaio:provider] {cli_name} login spawned (pid {:?})", child.id());
    login_session::register(provider, child, events).await;
    Ok(())
}

/// Cancel a pending login for the given provider. No-op if no login is
/// active. The watcher emits `ProviderLoginComplete { cancelled: true }`.
pub async fn cancel_login(provider: Provider) -> CoreResult<()> {
    if !login_session::cancel(provider).await {
        tracing::debug!("[qaio:provider] cancel_login: no active session for {provider}");
    }
    Ok(())
}

/// Run the provider's logout flow synchronously. Unlike login (which
/// spawns a browser and may take minutes), logout is non-interactive and
/// completes in seconds: it revokes the refresh token server-side
/// (Codex) or clears the OS Keychain entry (Claude Code on macOS) and
/// then deletes the local credential file. We await it so the UI can
/// flip the card to disconnected as soon as it's actually done.
pub async fn launch_logout(provider: Provider) -> CoreResult<()> {
    let ProviderCliCommand {
        cli_name,
        path,
        args,
        shell_path,
    } = logout_command(provider)?;

    let result = tokio::time::timeout(
        Duration::from_secs(10),
        tokio::process::Command::new(&path)
            .args(&args)
            .env("PATH", shell_path)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .kill_on_drop(true)
            .output(),
    )
    .await;

    match result {
        Ok(Ok(output)) if output.status.success() => {
            tracing::info!("[qaio:provider] {cli_name} logout succeeded");
            Ok(())
        }
        Ok(Ok(output)) => {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            tracing::warn!(
                "[qaio:provider] {cli_name} logout exited with {}: {stderr}",
                output.status
            );
            Err(CoreError::Internal(format!(
                "{cli_name} logout failed: {}",
                if stderr.is_empty() { "no stderr".into() } else { stderr }
            )))
        }
        Ok(Err(e)) => {
            tracing::warn!(
                "[qaio:provider] {cli_name} logout failed at {}: {e}",
                path.display()
            );
            Err(CoreError::Internal(format!("{cli_name} logout failed: {e}")))
        }
        Err(_) => {
            tracing::warn!("[qaio:provider] {cli_name} logout timed out after 10s");
            Err(CoreError::Internal(format!(
                "{cli_name} logout timed out after 10s"
            )))
        }
    }
}

#[derive(Debug)]
struct ProviderCliCommand {
    cli_name: &'static str,
    path: PathBuf,
    args: Vec<&'static str>,
    shell_path: OsString,
}

fn login_command(provider: Provider) -> CoreResult<ProviderCliCommand> {
    let resolved_path = match provider {
        Provider::Anthropic => resolve_claude().1,
        Provider::OpenAI => resolve_codex().1,
        Provider::Gemini => resolve_antigravity().1,
    };
    build_login_command(provider, resolved_path, claude_path::shell_path())
}

fn logout_command(provider: Provider) -> CoreResult<ProviderCliCommand> {
    let resolved_path = match provider {
        Provider::Anthropic => resolve_claude().1,
        Provider::OpenAI => resolve_codex().1,
        Provider::Gemini => resolve_antigravity().1,
    };
    build_logout_command(provider, resolved_path, claude_path::shell_path())
}

fn build_login_command(
    provider: Provider,
    resolved_path: Option<PathBuf>,
    shell_path: OsString,
) -> CoreResult<ProviderCliCommand> {
    let (cli_name, args): (&'static str, Vec<&'static str>) = match provider {
        Provider::Anthropic => ("claude", vec!["auth", "login", "--claudeai"]),
        Provider::OpenAI => ("codex", vec!["login"]),
        Provider::Gemini => {
            // Antigravity CLI uses Google OAuth via the system keyring.
            // There is no headless `auth login` subcommand.
            return Err(CoreError::BadRequest(
                "Antigravity uses Google account authentication. \
                 Run 'agy' in a terminal to complete sign-in, \
                 or set the GEMINI_API_KEY environment variable."
                    .into(),
            ));
        }
    };

    let path = resolved_path
        .ok_or_else(|| CoreError::BadRequest(format!("{cli_name} CLI is not installed")))?;

    Ok(ProviderCliCommand {
        cli_name,
        path,
        args,
        shell_path,
    })
}

fn build_logout_command(
    provider: Provider,
    resolved_path: Option<PathBuf>,
    shell_path: OsString,
) -> CoreResult<ProviderCliCommand> {
    // `claude auth logout` clears the macOS Keychain entry (service
    // `claude-code`) on Mac and `~/.claude/.credentials.json` on Linux.
    // `codex logout` revokes the ChatGPT refresh token server-side then
    // deletes `~/.codex/auth.json`. Both are documented top-level
    // commands — see knowledge-base/auth.md.
    let (cli_name, args): (&'static str, Vec<&'static str>) = match provider {
        Provider::Anthropic => ("claude", vec!["auth", "logout"]),
        Provider::OpenAI => ("codex", vec!["logout"]),
        Provider::Gemini => {
            return Err(CoreError::BadRequest(
                "Antigravity logout is not supported. \
                 Run '/logout' inside the Antigravity CLI, \
                 or delete ~/.gemini/ to revoke credentials."
                    .into(),
            ));
        }
    };

    let path = resolved_path
        .ok_or_else(|| CoreError::BadRequest(format!("{cli_name} CLI is not installed")))?;

    Ok(ProviderCliCommand {
        cli_name,
        path,
        args,
        shell_path,
    })
}

async fn check_claude_status() -> ProviderStatus {
    let (install_source, cli_path) = resolve_claude();
    let cli_installed = !matches!(install_source, InstallSource::Missing);
    let auth_state = if let Some(path) = cli_path.as_deref() {
        probe_claude_auth_status(path).await
    } else {
        ProviderAuthState::Unauthenticated
    };
    ProviderStatus {
        provider: "anthropic".into(),
        cli_installed,
        auth_state,
        cli_name: "claude".into(),
        install_source,
        cli_path: cli_path.map(|p| p.to_string_lossy().into_owned()),
    }
}

async fn check_codex_status() -> ProviderStatus {
    let (install_source, cli_path) = resolve_codex();
    let cli_installed = !matches!(install_source, InstallSource::Missing);
    let auth_state = if let Some(path) = cli_path.as_deref() {
        let home = std::env::var("HOME").unwrap_or_default();
        probe_codex_auth_status(path, &home).await
    } else {
        ProviderAuthState::Unauthenticated
    };

    ProviderStatus {
        provider: "openai".into(),
        cli_installed,
        auth_state,
        cli_name: "codex".into(),
        install_source,
        cli_path: cli_path.map(|p| p.to_string_lossy().into_owned()),
    }
}

async fn check_antigravity_status() -> ProviderStatus {
    let (install_source, cli_path) = resolve_antigravity();
    let cli_installed = !matches!(install_source, InstallSource::Missing);
    let auth_state = if cli_installed {
        probe_antigravity_auth_status().await
    } else {
        ProviderAuthState::Unauthenticated
    };
    ProviderStatus {
        provider: "gemini".into(),
        cli_installed,
        auth_state,
        cli_name: "agy".into(),
        install_source,
        cli_path: cli_path.map(|p| p.to_string_lossy().into_owned()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_rejects_unknown() {
        assert!(parse("foobar").is_err());
        assert!(parse("anthropic").is_ok());
        assert!(parse("openai").is_ok());
        assert!(parse("gemini").is_ok());
        assert!(parse("google").is_ok());
    }

    #[test]
    fn install_source_serializes_lowercase() {
        let s = serde_json::to_string(&InstallSource::Bundled).unwrap();
        assert_eq!(s, "\"bundled\"");
        let s = serde_json::to_string(&InstallSource::Managed).unwrap();
        assert_eq!(s, "\"managed\"");
        let s = serde_json::to_string(&InstallSource::Path).unwrap();
        assert_eq!(s, "\"path\"");
        let s = serde_json::to_string(&InstallSource::Missing).unwrap();
        assert_eq!(s, "\"missing\"");
    }

    #[test]
    fn login_command_uses_resolved_cli_path() {
        let path = PathBuf::from("/tmp/qaio-test-claude");
        let command = build_login_command(
            Provider::Anthropic,
            Some(path.clone()),
            OsString::from("/not/on/path"),
        )
        .unwrap();
        assert_eq!(command.cli_name, "claude");
        assert_eq!(command.path, path);
        assert_eq!(command.args, vec!["auth", "login", "--claudeai"]);
    }

    #[test]
    fn logout_command_claude_uses_auth_logout() {
        let path = PathBuf::from("/tmp/qaio-test-claude");
        let command = build_logout_command(
            Provider::Anthropic,
            Some(path.clone()),
            OsString::from("/not/on/path"),
        )
        .unwrap();
        assert_eq!(command.cli_name, "claude");
        assert_eq!(command.path, path);
        assert_eq!(command.args, vec!["auth", "logout"]);
    }

    #[test]
    fn logout_command_codex_uses_top_level_logout() {
        let path = PathBuf::from("/tmp/qaio-test-codex");
        let command = build_logout_command(
            Provider::OpenAI,
            Some(path.clone()),
            OsString::from("/not/on/path"),
        )
        .unwrap();
        assert_eq!(command.cli_name, "codex");
        assert_eq!(command.path, path);
        assert_eq!(command.args, vec!["logout"]);
    }

    #[test]
    fn logout_command_errors_when_cli_missing() {
        let err = build_logout_command(
            Provider::OpenAI,
            None,
            OsString::from("/not/on/path"),
        )
        .unwrap_err();
        assert!(matches!(err, CoreError::BadRequest(_)));
    }
}
