use super::types::{Provider, SessionStatus};
use crate::cli_process::run_cli_process;
use crate::gemini_command;
use crate::session_update::SessionUpdate;
use tokio::process::Command;
use tokio::sync::mpsc;

/// Spawn a Gemini CLI session (`gemini -p <prompt> --output-format stream-json --yolo`).
///
/// Gemini CLI has no `--system-prompt` flag. When a system prompt is provided,
/// it is prepended to the user prompt wrapped in `<system>` tags. This mirrors
/// how Gemini's own GEMINI.md files inject persistent context.
pub(crate) async fn spawn_gemini(
    tx: &mpsc::UnboundedSender<SessionUpdate>,
    prompt: String,
    resume_session_id: Option<String>,
    working_dir: Option<std::path::PathBuf>,
    model: Option<String>,
    system_prompt: Option<String>,
) {
    tracing::info!(
        "[qaio:session] spawning gemini -p (resume={:?})",
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

    // Gemini CLI has no --system-prompt flag. Prepend system instructions.
    let full_prompt = match system_prompt {
        Some(sp) if !sp.is_empty() => format!("<system>\n{sp}\n</system>\n\n{prompt}"),
        _ => prompt,
    };

    let mut cmd = Command::new("gemini");
    cmd.env("PATH", super::claude_path::shell_path());
    cmd.args(gemini_command::build_args(
        &full_prompt,
        resume_session_id.as_deref(),
        model.as_deref(),
    ));
    if let Some(dir) = &working_dir {
        cmd.current_dir(dir);
    }

    // Prompt is passed via -p arg; stdin write in run_cli_process is a no-op.
    run_cli_process(tx, &mut cmd, "", Provider::Gemini).await;
}
