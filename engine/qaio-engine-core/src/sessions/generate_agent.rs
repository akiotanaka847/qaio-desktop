//! One-shot agent config generator — takes a user description and returns
//! a suggested name + instructions (claudeMd) via the provider CLI.
//!
//! Mirrors the [`summarize`](super::summarize) pattern: shell out, parse JSON,
//! fall back to a deterministic result on failure.

use crate::error::CoreResult;
use qaio_terminal_manager::{claude_path, Provider};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::io::AsyncWriteExt;
use tokio::time::timeout;

const GENERATE_TIMEOUT: Duration = Duration::from_secs(30);
const CLAUDE_MODEL: &str = "haiku";
const CODEX_MODEL: &str = "gpt-5.4-mini";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateAgentResult {
    pub name: String,
    #[serde(rename = "claudeMd")]
    pub claude_md: String,
}

pub async fn generate_agent_config(
    description: &str,
    provider: Provider,
    model: Option<&str>,
) -> CoreResult<GenerateAgentResult> {
    match run_generation(description, provider, model).await {
        Ok(raw) => match parse_result(&raw) {
            Ok(result) => Ok(result),
            Err(e) => {
                tracing::warn!(
                    provider = %provider,
                    error = %e,
                    "agent generation parse failed"
                );
                Err(crate::CoreError::Internal(format!(
                    "failed to parse generated agent config: {e}"
                )))
            }
        },
        Err(e) => {
            tracing::warn!(
                provider = %provider,
                error = %e,
                "agent generation failed"
            );
            Err(crate::CoreError::Internal(format!(
                "agent generation failed: {e}"
            )))
        }
    }
}

fn generation_prompt(description: &str) -> String {
    format!(
        "You are an agent configuration generator. Given a description of what a user wants \
         their AI agent to do, generate a JSON object with two fields:\n\
         - \"name\": A concise, memorable name for the agent (2-4 words max)\n\
         - \"claudeMd\": Detailed instructions for the agent in Markdown format. Include:\n\
           1. A clear role description\n\
           2. Key responsibilities and capabilities\n\
           3. Communication style guidelines\n\
           4. A Learnings section at the end\n\n\
         The instructions should be professional, specific, and actionable.\n\
         Return ONLY valid JSON, no markdown fences, no extra text.\n\n\
         User description: {description}"
    )
}

async fn run_generation(
    description: &str,
    provider: Provider,
    model: Option<&str>,
) -> Result<String, String> {
    let prompt = generation_prompt(description);
    match provider {
        Provider::Anthropic => run_claude(&prompt, model).await,
        Provider::OpenAI => run_codex(&prompt, model).await,
    }
}

async fn run_claude(prompt: &str, model: Option<&str>) -> Result<String, String> {
    let mut cmd = tokio::process::Command::new("claude");
    cmd.env("PATH", claude_path::shell_path());
    cmd.env_remove("CLAUDE_CODE_ENTRYPOINT");
    cmd.env_remove("CLAUDECODE");
    cmd.arg("-p")
        .arg("--model")
        .arg(model.unwrap_or(CLAUDE_MODEL))
        .arg("--output-format")
        .arg("text")
        .arg("--allowedTools")
        .arg("");
    run_command(cmd, prompt).await
}

async fn run_codex(prompt: &str, model: Option<&str>) -> Result<String, String> {
    let mut cmd = tokio::process::Command::new("codex");
    cmd.env("PATH", claude_path::shell_path());
    cmd.arg("exec")
        .arg("--json")
        .arg("--dangerously-bypass-approvals-and-sandbox")
        .arg("--skip-git-repo-check")
        .arg("--model")
        .arg(model.unwrap_or(CODEX_MODEL))
        .arg("-");
    let stdout = run_command(cmd, prompt).await?;
    extract_codex_text(&stdout)
}

async fn run_command(
    mut cmd: tokio::process::Command,
    prompt: &str,
) -> Result<String, String> {
    cmd.kill_on_drop(true);
    cmd.stdin(std::process::Stdio::piped());
    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("spawn failed: {e}"))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(prompt.as_bytes())
            .await
            .map_err(|e| format!("stdin write failed: {e}"))?;
        drop(stdin);
    }

    let output = match timeout(GENERATE_TIMEOUT, child.wait_with_output()).await {
        Ok(Ok(output)) => output,
        Ok(Err(e)) => return Err(format!("process failed: {e}")),
        Err(_) => return Err("generation timed out".to_string()),
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("process exited {}: {}", output.status, stderr));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn extract_codex_text(stdout: &str) -> Result<String, String> {
    let mut latest = String::new();
    for line in stdout.lines() {
        let Ok(event) = serde_json::from_str::<serde_json::Value>(line.trim()) else {
            continue;
        };
        let Some(item) = event.get("item") else {
            continue;
        };
        if item.get("type").and_then(serde_json::Value::as_str) == Some("agent_message") {
            if let Some(text) = item.get("text").and_then(serde_json::Value::as_str) {
                latest = text.to_string();
            }
        }
    }
    if latest.trim().is_empty() {
        Err("codex output had no agent_message text".to_string())
    } else {
        Ok(latest)
    }
}

fn parse_result(raw: &str) -> Result<GenerateAgentResult, String> {
    // The model may wrap the JSON in markdown fences; strip them.
    let trimmed = raw.trim();
    let json_str = if trimmed.starts_with("```") {
        trimmed
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim()
    } else {
        trimmed
    };

    serde_json::from_str::<GenerateAgentResult>(json_str)
        .map_err(|e| format!("JSON parse error: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_clean_json() {
        let raw = r#"{"name":"Project Planner","claudeMd":"You plan projects.\n\nLearnings:\n"}"#;
        let result = parse_result(raw).unwrap();
        assert_eq!(result.name, "Project Planner");
        assert!(result.claude_md.contains("plan projects"));
    }

    #[test]
    fn parse_fenced_json() {
        let raw = "```json\n{\"name\":\"Email Helper\",\"claudeMd\":\"Instructions here.\"}\n```";
        let result = parse_result(raw).unwrap();
        assert_eq!(result.name, "Email Helper");
    }

    #[test]
    fn parse_invalid_json_returns_error() {
        let raw = "not json at all";
        assert!(parse_result(raw).is_err());
    }

    #[test]
    fn prompt_contains_description() {
        let prompt = generation_prompt("I need an agent that manages my calendar");
        assert!(prompt.contains("manages my calendar"));
    }
}
