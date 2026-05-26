//! Provider + model resolution for a session.
//!
//! Priority: agent-level `.qaio/config/config.json` → workspace entry in
//! `workspaces.json` → default Anthropic. Callers typically pass chat-level
//! overrides in front of this resolution chain.

use crate::paths::EnginePaths;
use crate::workspaces;
use qaio_terminal_manager::Provider;
use serde::Deserialize;
use std::path::Path;

#[derive(Debug, Clone)]
pub struct ResolvedProvider {
    pub provider: Provider,
    pub model: Option<String>,
}

impl Default for ResolvedProvider {
    fn default() -> Self {
        Self {
            provider: Provider::Anthropic,
            model: None,
        }
    }
}

#[derive(Deserialize)]
struct AgentConfig {
    #[serde(default)]
    provider: Option<String>,
    #[serde(default, alias = "claude_model")]
    model: Option<String>,
    #[serde(default, alias = "claude_effort")]
    effort: Option<String>,
}

/// Resolve the provider + model for an agent.
///
/// Order:
/// 1. `agent_dir/.qaio/config/config.json` — per-agent override.
/// 2. Workspace entry (workspace dir = parent of agent dir, workspaces root =
///    parent of workspace dir OR `paths.docs()`).
/// 3. `Provider::Anthropic`, no model (factory default).
pub fn resolve_provider(paths: &EnginePaths, agent_dir: &Path) -> ResolvedProvider {
    if let Some(from_agent) = read_agent_config(agent_dir) {
        // Agent-level config exists — but model can come from workspace if
        // the agent only overrides one field. Match the old Tauri behavior.
        if let Some(ref p_str) = from_agent.provider {
            if let Ok(provider) = p_str.parse::<Provider>() {
                return ResolvedProvider {
                    provider,
                    model: from_agent.model.clone(),
                };
            }
        }
        if from_agent.model.is_some() {
            let ws = resolve_workspace(paths, agent_dir);
            return ResolvedProvider {
                provider: ws.provider,
                model: from_agent.model,
            };
        }
    }
    resolve_workspace(paths, agent_dir)
}

fn read_agent_config(agent_dir: &Path) -> Option<AgentConfig> {
    let path = agent_dir.join(".qaio/config/config.json");
    let raw = std::fs::read_to_string(&path).ok()?;
    if raw.trim().is_empty() {
        return None;
    }
    serde_json::from_str(&raw).ok()
}

/// Resolve the reasoning-effort level for an agent.
///
/// Reads the agent config's `effort` (or `claude_effort`) field, validates it
/// against the provider's accepted levels, and falls back to the provider's
/// default effort. Returns `None` for providers that don't support effort
/// (e.g. Gemini).
pub fn resolve_effort(agent_dir: &Path, provider: Provider) -> Option<String> {
    let default = provider.default_effort().map(String::from);
    let config = match read_agent_config(agent_dir) {
        Some(c) => c,
        None => return default,
    };
    let raw = match config.effort {
        Some(e) if !e.is_empty() => e,
        _ => return default,
    };
    if provider.is_valid_effort(&raw) {
        Some(raw)
    } else {
        tracing::warn!(
            "[sessions] agent effort \"{raw}\" is not valid for {provider}; falling back to default"
        );
        default
    }
}

fn resolve_workspace(paths: &EnginePaths, agent_dir: &Path) -> ResolvedProvider {
    let Some(workspace_dir) = agent_dir.parent() else {
        return ResolvedProvider::default();
    };
    let ws_name = match workspace_dir.file_name().and_then(|n| n.to_str()) {
        Some(n) => n,
        None => return ResolvedProvider::default(),
    };
    // Workspaces root is `paths.docs()` or the workspace's parent (matches
    // adapter behavior when the agent lives under a non-standard location).
    let roots = [workspace_dir.parent(), Some(paths.docs())];
    for root in roots.iter().flatten() {
        let all = match workspaces::read_all(root) {
            Ok(v) => v,
            Err(_) => continue,
        };
        if let Some(ws) = all.iter().find(|w| w.name == ws_name) {
            let provider = ws
                .provider
                .as_deref()
                .and_then(|p| p.parse::<Provider>().ok())
                .unwrap_or(Provider::Anthropic);
            return ResolvedProvider {
                provider,
                model: ws.model.clone(),
            };
        }
    }
    ResolvedProvider::default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn write_json(path: &Path, body: &str) {
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, body).unwrap();
    }

    #[test]
    fn default_when_no_config() {
        let d = TempDir::new().unwrap();
        let agent = d.path().join("ws").join("agent");
        std::fs::create_dir_all(&agent).unwrap();
        let paths = EnginePaths::new(d.path().to_path_buf(), d.path().to_path_buf());
        let r = resolve_provider(&paths, &agent);
        assert_eq!(r.provider, Provider::Anthropic);
        assert!(r.model.is_none());
    }

    #[test]
    fn agent_config_wins() {
        let d = TempDir::new().unwrap();
        let agent = d.path().join("ws").join("agent");
        write_json(
            &agent.join(".qaio/config/config.json"),
            r#"{"provider":"openai","model":"gpt-5.4"}"#,
        );
        let paths = EnginePaths::new(d.path().to_path_buf(), d.path().to_path_buf());
        let r = resolve_provider(&paths, &agent);
        assert_eq!(r.provider, Provider::OpenAI);
        assert_eq!(r.model.as_deref(), Some("gpt-5.4"));
    }

    #[test]
    fn workspace_fallback() {
        let d = TempDir::new().unwrap();
        let workspaces_json = d.path().join("workspaces.json");
        write_json(
            &workspaces_json,
            r#"[{"id":"x","name":"ws","isDefault":true,"createdAt":"t","provider":"openai","model":"gpt-5"}]"#,
        );
        let agent = d.path().join("ws").join("agent");
        std::fs::create_dir_all(&agent).unwrap();
        let paths = EnginePaths::new(d.path().to_path_buf(), d.path().to_path_buf());
        let r = resolve_provider(&paths, &agent);
        assert_eq!(r.provider, Provider::OpenAI);
        assert_eq!(r.model.as_deref(), Some("gpt-5"));
    }

    #[test]
    fn resolve_effort_from_agent_config() {
        let d = TempDir::new().unwrap();
        let agent = d.path().join("ws").join("agent");
        write_json(
            &agent.join(".qaio/config/config.json"),
            r#"{"effort":"high"}"#,
        );
        assert_eq!(
            resolve_effort(&agent, Provider::Anthropic),
            Some("high".to_string())
        );
    }

    #[test]
    fn resolve_effort_invalid_falls_back_to_default() {
        let d = TempDir::new().unwrap();
        let agent = d.path().join("ws").join("agent");
        // "xhigh" is valid for OpenAI but not for Anthropic
        write_json(
            &agent.join(".qaio/config/config.json"),
            r#"{"effort":"xhigh"}"#,
        );
        assert_eq!(
            resolve_effort(&agent, Provider::Anthropic),
            Some("medium".to_string())
        );
    }

    #[test]
    fn resolve_effort_codex_xhigh_accepted() {
        let d = TempDir::new().unwrap();
        let agent = d.path().join("ws").join("agent");
        write_json(
            &agent.join(".qaio/config/config.json"),
            r#"{"effort":"xhigh"}"#,
        );
        assert_eq!(
            resolve_effort(&agent, Provider::OpenAI),
            Some("xhigh".to_string())
        );
    }

    #[test]
    fn resolve_effort_gemini_returns_none() {
        let d = TempDir::new().unwrap();
        let agent = d.path().join("ws").join("agent");
        write_json(
            &agent.join(".qaio/config/config.json"),
            r#"{"effort":"high"}"#,
        );
        assert_eq!(resolve_effort(&agent, Provider::Gemini), None);
    }

    #[test]
    fn resolve_effort_no_config_returns_default() {
        let d = TempDir::new().unwrap();
        let agent = d.path().join("ws").join("agent");
        std::fs::create_dir_all(&agent).unwrap();
        assert_eq!(
            resolve_effort(&agent, Provider::Anthropic),
            Some("medium".to_string())
        );
    }

    #[test]
    fn resolve_effort_claude_effort_alias() {
        let d = TempDir::new().unwrap();
        let agent = d.path().join("ws").join("agent");
        write_json(
            &agent.join(".qaio/config/config.json"),
            r#"{"claude_effort":"max"}"#,
        );
        assert_eq!(
            resolve_effort(&agent, Provider::Anthropic),
            Some("max".to_string())
        );
    }

    #[test]
    fn resolve_effort_max_invalid_for_codex() {
        let d = TempDir::new().unwrap();
        let agent = d.path().join("ws").join("agent");
        write_json(
            &agent.join(".qaio/config/config.json"),
            r#"{"effort":"max"}"#,
        );
        // "max" is not valid for OpenAI, falls back to default
        assert_eq!(
            resolve_effort(&agent, Provider::OpenAI),
            Some("medium".to_string())
        );
    }

    #[test]
    fn agent_model_only_uses_workspace_provider() {
        let d = TempDir::new().unwrap();
        write_json(
            &d.path().join("workspaces.json"),
            r#"[{"id":"x","name":"ws","isDefault":true,"createdAt":"t","provider":"openai"}]"#,
        );
        let agent = d.path().join("ws").join("agent");
        write_json(
            &agent.join(".qaio/config/config.json"),
            r#"{"model":"sonnet"}"#,
        );
        let paths = EnginePaths::new(d.path().to_path_buf(), d.path().to_path_buf());
        let r = resolve_provider(&paths, &agent);
        assert_eq!(r.provider, Provider::OpenAI);
        assert_eq!(r.model.as_deref(), Some("sonnet"));
    }
}
