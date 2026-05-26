//! Composio CLI lifecycle — bundle-aware install + upgrade.
//!
//! Called once during engine startup as a background task:
//!
//! - **Bundled build**: detect the bundled CLI, emit `ComposioCliReady`,
//!   record the Qaio version marker, return. No install, no upgrade
//!   — the bundled binary is the version we shipped, and overwriting it
//!   with `composio upgrade` would either fail (read-only `.app`) or
//!   silently write to `~/.composio/` and confuse the resolver next
//!   boot.
//!
//! - **Standalone build**: install the CLI if missing (one-time
//!   `curl | bash`), then run `composio upgrade` whenever Qaio's
//!   version changes since the last successful check (so security fixes
//!   in the upstream CLI roll out alongside Qaio releases without
//!   requiring user action).
//!
//! Emits `QaioEvent::ComposioCliReady` on success so the frontend
//! invalidates the connections query and the integrations tab refreshes.

use crate::{cli, install};
use qaio_db::db::Database;
use qaio_ui_events::{DynEventSink, QaioEvent};

/// Preferences key storing the Qaio version that last successfully
/// ensured the standalone CLI. Skipped entirely for bundled builds.
const PREF_CLI_VERSION: &str = "composio_cli_qaio_version";

/// Preferences key for the one-time forced logout migration. Clears
/// stale Composio state left by older Qaio versions with the buggy
/// CLI JSON-parsing.
const PREF_FORCED_LOGOUT_V2: &str = "composio_forced_logout_v2";

/// Current Qaio version (read from Cargo.toml at compile time).
const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

/// One-time migration: force-logout to clear stale Composio state.
/// Runs once per install, gated by a preference marker.
pub async fn forced_logout(db: &Database) {
    let already_done = db
        .get_preference(PREF_FORCED_LOGOUT_V2)
        .await
        .ok()
        .flatten()
        .unwrap_or_default();

    if already_done == "1" {
        return;
    }

    tracing::info!("[composio:lifecycle] running one-time forced logout (v2 migration)");
    if let Err(e) = cli::logout().await {
        tracing::warn!("[composio:lifecycle] forced logout failed (non-fatal): {e}");
    }

    if let Err(e) = db.set_preference(PREF_FORCED_LOGOUT_V2, "1").await {
        tracing::warn!("[composio:lifecycle] failed to persist forced-logout marker: {e}");
    }
}

/// Run the full lifecycle check: install if missing, upgrade if Qaio
/// version changed. Emits events so the frontend reacts.
pub async fn ensure_and_upgrade(sink: DynEventSink, db: Database) {
    // Run forced logout migration before anything else.
    forced_logout(&db).await;

    if install::is_bundled() {
        tracing::info!(
            "[composio:lifecycle] bundled CLI detected at {} — skipping install/upgrade",
            install::cli_path().display()
        );
        sink.emit(QaioEvent::ComposioCliReady);
        return;
    }

    if !install::is_installed() {
        tracing::info!("[composio:lifecycle] CLI not found — auto-installing");
        match install::install().await {
            Ok(path) => {
                tracing::info!(
                    "[composio:lifecycle] auto-install succeeded: {}",
                    path.display()
                );
            }
            Err(e) => {
                tracing::error!("[composio:lifecycle] auto-install failed: {e}");
                sink.emit(QaioEvent::ComposioCliFailed { message: e });
                return;
            }
        }
    }

    // Upgrade if Qaio's version changed since last check. Bundled
    // builds never reach this branch — they returned early above.
    let last_version = db
        .get_preference(PREF_CLI_VERSION)
        .await
        .ok()
        .flatten()
        .unwrap_or_default();

    if last_version != APP_VERSION && install::is_installed() {
        tracing::info!(
            "[composio:lifecycle] Qaio version changed ({} → {}) — upgrading CLI",
            if last_version.is_empty() {
                "none"
            } else {
                &last_version
            },
            APP_VERSION
        );
        match run_upgrade().await {
            Ok(()) => {
                tracing::info!("[composio:lifecycle] CLI upgrade succeeded");
            }
            Err(e) => {
                // Upgrade failure is non-fatal — the existing CLI still
                // works. We log + record the version anyway so we don't
                // retry every launch; the next Qaio update tries
                // again.
                tracing::warn!("[composio:lifecycle] CLI upgrade failed (non-fatal): {e}");
            }
        }
        if let Err(e) = db.set_preference(PREF_CLI_VERSION, APP_VERSION).await {
            tracing::warn!("[composio:lifecycle] failed to persist version marker: {e}");
        }
    }

    sink.emit(QaioEvent::ComposioCliReady);
}

/// Run `composio upgrade` via the same sync-Command + spawn_blocking
/// pattern used by the install function. Standalone-only — never called
/// when the bundled CLI is present (would try to overwrite a read-only
/// signed binary inside the `.app`).
async fn run_upgrade() -> Result<(), String> {
    let bin = install::cli_path();
    let home = install::home_dir().to_string_lossy().to_string();
    let path = std::env::var("PATH").unwrap_or_default();

    let result = tokio::time::timeout(
        std::time::Duration::from_secs(180),
        tokio::task::spawn_blocking(move || {
            let mut cmd = std::process::Command::new(&bin);
            cmd.arg("upgrade")
                .env("CI", "1")
                .env("TERM", "dumb")
                .env("NO_COLOR", "1")
                .env("PATH", &path)
                .stdin(std::process::Stdio::null())
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::piped());
            install::set_home_env(&mut cmd, &home);
            let status = cmd
                .status()
                .map_err(|e| format!("Failed to spawn composio upgrade: {e}"))?;

            if !status.success() {
                return Err(format!("composio upgrade exited with {status}"));
            }
            Ok(())
        }),
    )
    .await
    .map_err(|_| "composio upgrade timed out after 3 minutes".to_string())?
    .map_err(|e| format!("upgrade thread failed: {e}"))?;

    result
}
