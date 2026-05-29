use super::types::SessionStatus;
use crate::antigravity_command;
use crate::antigravity_parser;
use crate::session_update::SessionUpdate;
use std::path::PathBuf;
use tokio::io::AsyncBufReadExt;
use tokio::process::Command;
use tokio::sync::mpsc;

/// Spawn an Antigravity CLI session (`agy --print <prompt>`).
///
/// Antigravity emits plain text to stdout (no NDJSON). We read lines
/// as streaming text and extract the conversation ID from the log file
/// for session resume support.
///
/// System prompt: `agy` has no `--system-prompt` flag. When provided,
/// the system prompt is prepended to the user prompt in `<system>` tags
/// (same approach as the former Gemini runner).
pub(crate) async fn spawn_antigravity(
    tx: &mpsc::UnboundedSender<SessionUpdate>,
    prompt: String,
    resume_session_id: Option<String>,
    working_dir: Option<PathBuf>,
    system_prompt: Option<String>,
) {
    tracing::info!(
        "[qaio:session] spawning agy --print (resume={:?})",
        resume_session_id
    );

    if let Some(ref dir) = working_dir {
        if !dir.is_dir() {
            let _ = tx.send(SessionUpdate::Status(SessionStatus::Error(format!(
                "Working directory not found: {}. Was it deleted?",
                dir.display()
            ))));
            return;
        }
    }

    let full_prompt = match system_prompt {
        Some(sp) if !sp.is_empty() => {
            format!("<system>\n{sp}\n</system>\n\n{prompt}")
        }
        _ => prompt,
    };

    // Temp log file for extracting conversation ID.
    let log_file = std::env::temp_dir().join(format!(
        "qaio-agy-{}.log",
        std::process::id()
    ));

    let mut cmd = Command::new("agy");
    cmd.env("PATH", super::claude_path::shell_path());
    if let Some(shell) = crate::windows_shell::detect() {
        cmd.env("SHELL", &shell);
    }
    cmd.args(antigravity_command::build_args(
        &full_prompt,
        resume_session_id.as_deref(),
        Some(&log_file),
    ));
    if let Some(dir) = &working_dir {
        cmd.current_dir(dir);
    }

    // agy --print takes the prompt as a CLI arg; stdin write is a no-op.
    crate::cli_process::run_cli_process(
        tx, &mut cmd, "", super::types::Provider::Gemini,
    )
    .await;

    // After process exits, extract conversation ID from the log.
    extract_and_send_conversation_id(tx, &log_file).await;

    // Cleanup temp log.
    let _ = tokio::fs::remove_file(&log_file).await;
}

async fn extract_and_send_conversation_id(
    tx: &mpsc::UnboundedSender<SessionUpdate>,
    log_file: &std::path::Path,
) {
    let file = match tokio::fs::File::open(log_file).await {
        Ok(f) => f,
        Err(e) => {
            tracing::debug!(
                "[qaio:session] could not open agy log for conversation ID: {e}"
            );
            return;
        }
    };
    let reader = tokio::io::BufReader::new(file);
    let mut lines = reader.lines();
    while let Ok(Some(line)) = lines.next_line().await {
        if let Some(id) = antigravity_parser::extract_conversation_id(&line) {
            tracing::info!(
                "[qaio:session] extracted agy conversation ID: {id}"
            );
            let _ = tx.send(SessionUpdate::SessionId(id));
            return;
        }
    }
    tracing::debug!("[qaio:session] no conversation ID found in agy log");
}
