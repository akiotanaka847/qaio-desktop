use serde::{Deserialize, Serialize};

use super::format::{format_issue_description, format_issue_title};
use super::BugReportPayload;

pub(super) async fn create_github_issue(
    api_url: &str,
    token: &str,
    repo: &str,
    payload: &BugReportPayload,
) -> Result<(), String> {
    let url = format!("{api_url}/repos/{repo}/issues");
    let body = GitHubIssueRequest {
        title: format_issue_title(payload),
        body: format_issue_description(payload),
        labels: vec!["bug".to_string(), "user-report".to_string()],
    };

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {token}"))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "Qaio-Desktop")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("GitHub API request failed: {e}"))?;

    let status = response.status();
    if !status.is_success() {
        let text = response
            .text()
            .await
            .unwrap_or_else(|e| format!("could not read GitHub response: {e}"));
        let message = format!(
            "GitHub API failed: {status} {}",
            super::format::truncate_chars(text.trim(), 160)
        );
        tracing::warn!(%message, "GitHub issue creation failed");
        return Err(message);
    }

    let issue = response
        .json::<GitHubIssueResponse>()
        .await
        .map_err(|e| format!("GitHub API response was not valid JSON: {e}"))?;

    tracing::info!(
        issue_number = issue.number,
        issue_url = %issue.html_url,
        "GitHub bug report created"
    );

    Ok(())
}

#[derive(Serialize)]
struct GitHubIssueRequest {
    title: String,
    body: String,
    labels: Vec<String>,
}

#[derive(Deserialize)]
struct GitHubIssueResponse {
    number: u64,
    html_url: String,
}
