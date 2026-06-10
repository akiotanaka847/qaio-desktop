use super::antigravity_parser;
use super::codex_parser;
use super::kimi_parser;
use super::parser;
use super::stderr_filter::{stderr_feed_item, StderrState};
use super::types::{FeedItem, Provider};
use crate::provider_error::is_malformed_provider_json_error;
use crate::session_update::SessionUpdate;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::sync::mpsc;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct StdoutReadReport {
    pub malformed_provider_json: bool,
}

/// Read all stderr lines, emitting only user-actionable feed items.
/// Returns the collected lines so the caller can include them in error reports.
pub async fn read_stderr_lines(
    stderr: tokio::process::ChildStderr,
    tx: mpsc::UnboundedSender<SessionUpdate>,
) -> Vec<String> {
    let mut lines = Vec::new();
    let mut state = StderrState::default();
    let reader = BufReader::new(stderr);
    let mut reader_lines = reader.lines();
    while let Ok(Some(line)) = reader_lines.next_line().await {
        tracing::debug!("cli stderr: {line}");
        if let Some(item) = stderr_feed_item(&line, &mut state) {
            if tx.send(SessionUpdate::Feed(item)).is_err() {
                break;
            }
        }
        lines.push(line);
    }
    lines
}

/// Read all stdout lines, parsing each as NDJSON and sending parsed feed items
/// (and session IDs) to the channel. Routes to the correct parser based on provider.
pub async fn read_stdout_events(
    stdout: tokio::process::ChildStdout,
    tx: mpsc::UnboundedSender<SessionUpdate>,
    provider: Provider,
    prior_response_lines: usize,
) -> StdoutReadReport {
    match provider {
        Provider::Anthropic => read_claude_stdout(stdout, tx).await,
        Provider::OpenAI => {
            read_codex_stdout(stdout, tx).await;
            StdoutReadReport::default()
        }
        Provider::Gemini => {
            read_antigravity_stdout(stdout, tx, prior_response_lines).await;
            StdoutReadReport::default()
        }
        Provider::Kimi => {
            read_kimi_stdout(stdout, tx).await;
            StdoutReadReport::default()
        }
    }
}

async fn read_claude_stdout(
    stdout: tokio::process::ChildStdout,
    tx: mpsc::UnboundedSender<SessionUpdate>,
) -> StdoutReadReport {
    let reader = BufReader::new(stdout);
    let mut lines = reader.lines();
    let mut acc = parser::StreamAccumulator::new();
    let mut line_count = 0u64;
    let mut item_count = 0u64;
    let mut report = StdoutReadReport::default();
    while let Ok(Some(line)) = lines.next_line().await {
        line_count += 1;
        let line_type = line.trim().chars().take(80).collect::<String>();
        tracing::debug!("[qaio:stdout:claude] line {line_count}: {line_type}");

        if let Some(sid) = parser::extract_session_id(&line) {
            let _ = tx.send(SessionUpdate::SessionId(sid));
        }
        if is_malformed_provider_json_error(&line) {
            report.malformed_provider_json = true;
            tracing::warn!("[qaio:stdout:claude] suppressed malformed provider JSON error");
            continue;
        }
        let items = parser::parse_event(&line, &mut acc);
        item_count += log_and_send(&tx, items);
    }
    tracing::debug!(
        "[qaio:stdout:claude] stream ended. {line_count} lines, {item_count} feed items"
    );
    report
}

async fn read_codex_stdout(
    stdout: tokio::process::ChildStdout,
    tx: mpsc::UnboundedSender<SessionUpdate>,
) {
    let reader = BufReader::new(stdout);
    let mut lines = reader.lines();
    let mut acc = codex_parser::CodexAccumulator::new();
    let mut line_count = 0u64;
    let mut item_count = 0u64;
    while let Ok(Some(line)) = lines.next_line().await {
        line_count += 1;
        let line_type = line.trim().chars().take(80).collect::<String>();
        tracing::debug!("[qaio:stdout:codex] line {line_count}: {line_type}");

        if let Some(tid) = codex_parser::extract_thread_id(&line) {
            let _ = tx.send(SessionUpdate::SessionId(tid));
        }
        let items = codex_parser::parse_codex_event(&line, &mut acc);
        item_count += log_and_send(&tx, items);
    }
    tracing::debug!(
        "[qaio:stdout:codex] stream ended. {line_count} lines, {item_count} feed items"
    );
}

async fn read_antigravity_stdout(
    stdout: tokio::process::ChildStdout,
    tx: mpsc::UnboundedSender<SessionUpdate>,
    prior_response_lines: usize,
) {
    // agy --print buffers all output and writes it at once on exit, so
    // there is no native token streaming. We accumulate the lines, then
    // replay the final text progressively (see stream_text_synthetically)
    // to match the typing effect of Claude/Codex. While agy is still
    // processing, the last feed item stays the user_message, keeping the
    // pulsing "thinking" indicator visible.
    if prior_response_lines > 0 {
        tracing::info!(
            "[qaio:stdout:agy] resume mode: skipping first {prior_response_lines} replayed lines"
        );
    }

    let reader = BufReader::new(stdout);
    let mut lines = reader.lines();
    let mut acc = antigravity_parser::AntigravityAccumulator::new(prior_response_lines);
    let mut line_count = 0u64;
    while let Ok(Some(line)) = lines.next_line().await {
        line_count += 1;
        tracing::debug!("[qaio:stdout:agy] line {line_count}: {line}");
        // Accumulate only; per-line streaming items are discarded because
        // every line arrives at once (no real-time streaming from agy).
        acc.push_line(&line);
    }
    // Finalize: replay the final text synthetically, then forward the rest.
    let mut item_count = 0u64;
    for item in acc.finalize() {
        match item {
            FeedItem::AssistantText(text) => {
                stream_text_synthetically(&tx, &text).await;
                item_count += 1;
            }
            other => {
                let _ = tx.send(SessionUpdate::Feed(other));
                item_count += 1;
            }
        }
    }
    tracing::debug!(
        "[qaio:stdout:agy] stream ended. {line_count} lines, {item_count} feed items"
    );
}

async fn read_kimi_stdout(
    stdout: tokio::process::ChildStdout,
    tx: mpsc::UnboundedSender<SessionUpdate>,
) {
    // kimi's stream-json frames complete messages (it does not stream
    // tokens), so the whole assistant message arrives in one line. We
    // replay assistant text progressively (see stream_text_synthetically)
    // to match the typing effect of Claude/Codex. Tool calls/results are
    // forwarded immediately. While kimi is still processing, the last feed
    // item stays the user_message, keeping the pulsing indicator visible.
    let reader = BufReader::new(stdout);
    let mut lines = reader.lines();
    let mut line_count = 0u64;
    let mut item_count = 0u64;
    while let Ok(Some(line)) = lines.next_line().await {
        line_count += 1;
        let line_preview = line.trim().chars().take(80).collect::<String>();
        tracing::debug!("[qaio:stdout:kimi] line {line_count}: {line_preview}");

        if let Some(sid) = kimi_parser::extract_session_id(&line) {
            let _ = tx.send(SessionUpdate::SessionId(sid));
        }
        for item in kimi_parser::parse_kimi_event(&line) {
            match item {
                FeedItem::AssistantText(text) => {
                    stream_text_synthetically(&tx, &text).await;
                    item_count += 1;
                }
                other => {
                    let _ = tx.send(SessionUpdate::Feed(other));
                    item_count += 1;
                }
            }
        }
    }
    // Kimi has no explicit completion event; emit FinalResult ourselves.
    let _ = tx.send(SessionUpdate::Feed(FeedItem::FinalResult {
        result: "Session completed".into(),
        cost_usd: None,
        duration_ms: None,
    }));
    item_count += 1;
    tracing::debug!(
        "[qaio:stdout:kimi] stream ended. {line_count} lines, {item_count} feed items"
    );
}

/// Replay `full_text` as progressive `AssistantTextStreaming` updates
/// followed by the final `AssistantText`, simulating the token-by-token
/// typing effect of streaming providers (Claude/Codex) for providers
/// whose CLIs emit the full response at once (agy, kimi).
///
/// Adaptive pacing: total budget ~1.2s, capped at 80 updates so long
/// responses stay snappy. The final `AssistantText` is what the session
/// runner persists.
async fn stream_text_synthetically(
    tx: &mpsc::UnboundedSender<SessionUpdate>,
    full_text: &str,
) {
    let words: Vec<&str> = full_text.split_inclusive(char::is_whitespace).collect();
    if words.len() > 1 {
        const MAX_UPDATES: usize = 80;
        let chunk_size = words.len().div_ceil(MAX_UPDATES).max(1);
        let total_updates = words.len().div_ceil(chunk_size).max(1);
        let delay_ms = (1200u64 / total_updates as u64).clamp(8, 40);
        let mut acc = String::new();
        for (i, word) in words.iter().enumerate() {
            acc.push_str(word);
            let is_last = i + 1 == words.len();
            if !is_last && (i + 1) % chunk_size == 0 {
                let _ = tx.send(SessionUpdate::Feed(FeedItem::AssistantTextStreaming(
                    acc.clone(),
                )));
                tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
            }
        }
    }
    // Final, persisted text. Replaces the last streaming placeholder.
    let _ = tx.send(SessionUpdate::Feed(FeedItem::AssistantText(
        full_text.to_string(),
    )));
}

fn log_and_send(tx: &mpsc::UnboundedSender<SessionUpdate>, items: Vec<FeedItem>) -> u64 {
    let mut count = 0u64;
    for item in &items {
        count += 1;
        match item {
            FeedItem::AssistantTextStreaming(t) => {
                tracing::debug!(
                    "[qaio:stdout] -> FeedItem::AssistantTextStreaming ({} chars)",
                    t.len()
                );
            }
            FeedItem::AssistantText(t) => {
                tracing::debug!(
                    "[qaio:stdout] -> FeedItem::AssistantText ({} chars)",
                    t.len()
                );
            }
            other => {
                tracing::debug!(
                    "[qaio:stdout] -> FeedItem::{:?}",
                    std::mem::discriminant(other)
                );
            }
        }
    }
    for item in items {
        let _ = tx.send(SessionUpdate::Feed(item));
    }
    count
}
