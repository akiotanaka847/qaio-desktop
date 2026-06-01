//! Parser for Antigravity CLI (`agy --print`) plain-text output.
//!
//! Unlike Gemini CLI's NDJSON streaming, Antigravity emits plain text
//! to stdout. Each line is accumulated as assistant text. Conversation
//! IDs are extracted from the log file, not stdout.

use super::types::FeedItem;
use regex::Regex;
use std::sync::LazyLock;

/// Regex to extract conversation UUID from agy log lines.
/// Matches: `Created conversation <uuid>` or `conversation=<uuid>`.
static CONVERSATION_ID_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"(?:Created conversation |conversation=)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})",
    )
    .expect("valid regex")
});

/// Accumulates streaming text from Antigravity stdout.
///
/// `agy --print --conversation <id>` replays ALL prior assistant
/// responses before appending the new one. `skip_lines` tells the
/// accumulator how many lines belong to previous turns so they are
/// silently consumed without being emitted to the UI.
#[derive(Debug)]
pub struct AntigravityAccumulator {
    lines: Vec<String>,
    skip_lines: usize,
}

impl AntigravityAccumulator {
    pub fn new(skip_lines: usize) -> Self {
        Self {
            lines: Vec::new(),
            skip_lines,
        }
    }

    /// Push a stdout line and return a streaming feed item.
    ///
    /// Lines within the `skip_lines` window return an empty streaming
    /// event (keeps the typing indicator alive without showing stale text).
    pub fn push_line(&mut self, line: &str) -> FeedItem {
        self.lines.push(line.to_string());
        if self.lines.len() <= self.skip_lines {
            return FeedItem::AssistantTextStreaming(String::new());
        }
        let new_text = self.lines[self.skip_lines..].join("\n");
        FeedItem::AssistantTextStreaming(new_text)
    }

    /// Finalize: emit the final `AssistantText` (only new content)
    /// and `FinalResult`.
    ///
    /// `AssistantText` is always emitted here because the per-line
    /// `push_line` calls only sent `AssistantTextStreaming` (ephemeral
    /// display updates). The session runner needs the non-streaming
    /// variant to persist the response.
    pub fn finalize(&mut self) -> Vec<FeedItem> {
        let all_lines = std::mem::take(&mut self.lines);
        if all_lines.len() <= self.skip_lines {
            return vec![FeedItem::FinalResult {
                result: "Session completed".into(),
                cost_usd: None,
                duration_ms: None,
            }];
        }
        let new_text = all_lines[self.skip_lines..].join("\n");
        vec![
            FeedItem::AssistantText(new_text),
            FeedItem::FinalResult {
                result: "Session completed".into(),
                cost_usd: None,
                duration_ms: None,
            },
        ]
    }
}

/// Extract a conversation ID from an agy log line.
pub fn extract_conversation_id(log_line: &str) -> Option<String> {
    CONVERSATION_ID_RE
        .captures(log_line)
        .map(|caps| caps[1].to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn push_line_streams_accumulated_text() {
        let mut acc = AntigravityAccumulator::new(0);
        let item = acc.push_line("Hello");
        assert!(matches!(item, FeedItem::AssistantTextStreaming(t) if t == "Hello"));

        let item = acc.push_line("World");
        assert!(
            matches!(item, FeedItem::AssistantTextStreaming(t) if t == "Hello\nWorld")
        );
    }

    #[test]
    fn finalize_flushes_text() {
        let mut acc = AntigravityAccumulator::new(0);
        acc.push_line("Line 1");
        acc.push_line("Line 2");
        let items = acc.finalize();
        assert_eq!(items.len(), 2);
        assert!(
            matches!(&items[0], FeedItem::AssistantText(t) if t == "Line 1\nLine 2")
        );
        assert!(matches!(&items[1], FeedItem::FinalResult { .. }));
    }

    #[test]
    fn finalize_empty_returns_only_result() {
        let mut acc = AntigravityAccumulator::new(0);
        let items = acc.finalize();
        assert_eq!(items.len(), 1);
        assert!(matches!(&items[0], FeedItem::FinalResult { .. }));
    }

    #[test]
    fn skip_lines_suppresses_replayed_history() {
        // Simulates: agy --print --conversation replays "r1" then adds "r2"
        let mut acc = AntigravityAccumulator::new(1); // skip 1 prior line
        let item = acc.push_line("r1");
        assert!(matches!(item, FeedItem::AssistantTextStreaming(t) if t.is_empty()));

        let item = acc.push_line("r2");
        assert!(matches!(item, FeedItem::AssistantTextStreaming(t) if t == "r2"));
    }

    #[test]
    fn skip_lines_finalize_only_emits_new_content() {
        let mut acc = AntigravityAccumulator::new(2); // skip 2 prior lines
        acc.push_line("old1");
        acc.push_line("old2");
        acc.push_line("new1");
        acc.push_line("new2");
        let items = acc.finalize();
        assert_eq!(items.len(), 2);
        assert!(
            matches!(&items[0], FeedItem::AssistantText(t) if t == "new1\nnew2")
        );
    }

    #[test]
    fn skip_lines_finalize_all_skipped_returns_only_result() {
        let mut acc = AntigravityAccumulator::new(3);
        acc.push_line("old1");
        acc.push_line("old2");
        // Only 2 lines arrived but skip=3, nothing new
        let items = acc.finalize();
        assert_eq!(items.len(), 1);
        assert!(matches!(&items[0], FeedItem::FinalResult { .. }));
    }

    #[test]
    fn extract_conversation_id_from_created_log() {
        let line = "I0528 19:08:01.421261 16511 server.go:755] Created conversation 833ba2e1-efee-4af7-9f20-6836a26ee7fe";
        assert_eq!(
            extract_conversation_id(line),
            Some("833ba2e1-efee-4af7-9f20-6836a26ee7fe".into())
        );
    }

    #[test]
    fn extract_conversation_id_from_equals_log() {
        let line = "I0528 19:08:01.422604 16511 printmode.go:130] Print mode: conversation=833ba2e1-efee-4af7-9f20-6836a26ee7fe, sending message";
        assert_eq!(
            extract_conversation_id(line),
            Some("833ba2e1-efee-4af7-9f20-6836a26ee7fe".into())
        );
    }

    #[test]
    fn extract_conversation_id_returns_none_for_unrelated() {
        assert_eq!(extract_conversation_id("some random log line"), None);
    }
}
