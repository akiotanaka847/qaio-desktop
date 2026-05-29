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
#[derive(Debug, Default)]
pub struct AntigravityAccumulator {
    lines: Vec<String>,
}

impl AntigravityAccumulator {
    pub fn new() -> Self {
        Self::default()
    }

    /// Push a stdout line and return a streaming feed item.
    pub fn push_line(&mut self, line: &str) -> FeedItem {
        self.lines.push(line.to_string());
        let full_text = self.lines.join("\n");
        FeedItem::AssistantTextStreaming(full_text)
    }

    /// Finalize — flush accumulated text as a complete response.
    pub fn finalize(&mut self) -> Vec<FeedItem> {
        if self.lines.is_empty() {
            return vec![FeedItem::FinalResult {
                result: "Session completed".into(),
                cost_usd: None,
                duration_ms: None,
            }];
        }
        let full_text = std::mem::take(&mut self.lines).join("\n");
        vec![
            FeedItem::AssistantText(full_text),
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
        let mut acc = AntigravityAccumulator::new();
        let item = acc.push_line("Hello");
        assert!(matches!(item, FeedItem::AssistantTextStreaming(t) if t == "Hello"));

        let item = acc.push_line("World");
        assert!(
            matches!(item, FeedItem::AssistantTextStreaming(t) if t == "Hello\nWorld")
        );
    }

    #[test]
    fn finalize_flushes_text() {
        let mut acc = AntigravityAccumulator::new();
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
        let mut acc = AntigravityAccumulator::new();
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
