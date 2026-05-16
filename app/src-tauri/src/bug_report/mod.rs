mod format;
mod github;
#[cfg(test)]
mod github_tests;

use serde::Deserialize;

const GITHUB_API_URL: &str = "https://api.github.com";
const DEFAULT_REPO: &str = "akiotanaka847/qaio-desktop";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BugReportPayload {
    pub(super) command: String,
    pub(super) error: String,
    pub(super) space_name: Option<String>,
    pub(super) workspace_name: Option<String>,
    pub(super) user_email: Option<String>,
    pub(super) timestamp: String,
    pub(super) app_version: String,
    pub(super) logs: BugReportLogs,
}

#[derive(Debug, Deserialize)]
pub(super) struct BugReportLogs {
    pub(super) backend: String,
    pub(super) frontend: String,
}

struct GitHubBugReportConfig {
    token: String,
    repo: String,
}

#[tauri::command(rename_all = "snake_case")]
pub async fn report_bug(payload: BugReportPayload) -> Result<(), String> {
    let config = bug_report_config()?;

    github::create_github_issue(GITHUB_API_URL, &config.token, &config.repo, &payload).await
}

fn bug_report_config() -> Result<GitHubBugReportConfig, String> {
    let token = configured_value(
        std::env::var("QAIO_BUG_REPORT_TOKEN").ok(),
        option_env!("QAIO_BUG_REPORT_TOKEN"),
    );

    let repo = configured_value(
        std::env::var("QAIO_BUG_REPORT_REPO").ok(),
        option_env!("QAIO_BUG_REPORT_REPO"),
    )
    .unwrap_or_else(|| DEFAULT_REPO.to_string());

    match token {
        Some(token) => Ok(GitHubBugReportConfig { token, repo }),
        None => Err(
            "Bug reporting not configured (missing QAIO_BUG_REPORT_TOKEN)".to_string(),
        ),
    }
}

fn configured_value(runtime: Option<String>, compiled: Option<&'static str>) -> Option<String> {
    runtime
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .or_else(|| {
            compiled
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
        })
}

#[cfg(test)]
pub(super) fn sample_payload() -> BugReportPayload {
    BugReportPayload {
        command: "list_workspaces".to_string(),
        error: "Error: no workspace found\nsecond line".to_string(),
        space_name: Some("Mission Control".to_string()),
        workspace_name: Some("Qaio".to_string()),
        user_email: Some("user@example.com".to_string()),
        timestamp: "2026-04-30T12:00:00.000Z".to_string(),
        app_version: "0.4.4".to_string(),
        logs: BugReportLogs {
            backend: "backend log line".to_string(),
            frontend: "frontend log line".to_string(),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn configured_value_prefers_runtime_value() {
        let value = configured_value(Some(" runtime ".to_string()), Some("compiled"));
        assert_eq!(value.as_deref(), Some("runtime"));
    }

    #[test]
    fn configured_value_uses_compiled_fallback() {
        let value = configured_value(Some(" ".to_string()), Some(" compiled "));
        assert_eq!(value.as_deref(), Some("compiled"));
    }
}
