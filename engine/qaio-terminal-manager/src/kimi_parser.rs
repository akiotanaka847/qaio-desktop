//! Parser for Kimi CLI `--output-format stream-json` NDJSON output.
//!
//! Kimi emits one JSON object per line with `role` as the discriminator:
//! - `{"role":"assistant","content":"..."}` — text response
//! - `{"role":"assistant","tool_calls":[...]}` — tool use
//! - `{"role":"tool","tool_call_id":"...","content":"..."}` — tool result
//! - `{"role":"meta","type":"session.resume_hint","session_id":"..."}` — session ID

use super::types::FeedItem;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct KimiEvent {
    role: String,
    content: Option<String>,
    tool_calls: Option<Vec<KimiToolCall>>,
    #[serde(rename = "type")]
    meta_type: Option<String>,
    session_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct KimiToolCall {
    function: Option<KimiFunction>,
}

#[derive(Debug, Deserialize)]
struct KimiFunction {
    name: Option<String>,
    arguments: Option<String>,
}

/// Extract the session ID from a `session.resume_hint` meta event.
pub fn extract_session_id(line: &str) -> Option<String> {
    let event: KimiEvent = serde_json::from_str(line.trim()).ok()?;
    if event.role == "meta" && event.meta_type.as_deref() == Some("session.resume_hint") {
        event.session_id
    } else {
        None
    }
}

/// Parse a single NDJSON line from Kimi's stream-json output into FeedItems.
pub fn parse_kimi_event(line: &str) -> Vec<FeedItem> {
    let line = line.trim();
    if line.is_empty() {
        return vec![];
    }

    let event: KimiEvent = match serde_json::from_str(line) {
        Ok(e) => e,
        Err(e) => {
            tracing::error!("[kimi] failed to parse event: {e}\nLine: {line}");
            return vec![];
        }
    };

    match event.role.as_str() {
        "assistant" => parse_assistant(&event),
        "tool" => parse_tool_result(&event),
        "meta" => vec![], // session ID extracted separately
        _ => {
            tracing::debug!("[kimi] unhandled role: {}", event.role);
            vec![]
        }
    }
}

fn parse_assistant(event: &KimiEvent) -> Vec<FeedItem> {
    let mut items = vec![];

    // Tool calls
    if let Some(calls) = &event.tool_calls {
        for call in calls {
            if let Some(func) = &call.function {
                let name = func.name.as_deref().unwrap_or("unknown").to_string();
                let input = func
                    .arguments
                    .as_deref()
                    .and_then(|a| serde_json::from_str(a).ok())
                    .unwrap_or(serde_json::Value::Null);
                items.push(FeedItem::ToolCall { name, input });
            }
        }
    }

    // Text content
    if let Some(text) = &event.content {
        if !text.is_empty() {
            items.push(FeedItem::AssistantText(text.clone()));
        }
    }

    items
}

fn parse_tool_result(event: &KimiEvent) -> Vec<FeedItem> {
    let content = event.content.as_deref().unwrap_or("").to_string();
    let is_error = content.starts_with("Error:") || content.starts_with("error:");
    vec![FeedItem::ToolResult { content, is_error }]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_assistant_text() {
        let line = r#"{"role":"assistant","content":"Hello! How can I assist you today?"}"#;
        let items = parse_kimi_event(line);
        assert_eq!(items.len(), 1);
        assert!(matches!(&items[0], FeedItem::AssistantText(t) if t.contains("Hello")));
    }

    #[test]
    fn parse_assistant_tool_call() {
        let line = r#"{"role":"assistant","tool_calls":[{"type":"function","id":"Write:0","function":{"name":"Write","arguments":"{\"path\":\"/tmp/test.txt\",\"content\":\"hello\"}"}}]}"#;
        let items = parse_kimi_event(line);
        assert_eq!(items.len(), 1);
        match &items[0] {
            FeedItem::ToolCall { name, input } => {
                assert_eq!(name, "Write");
                assert_eq!(input["path"], "/tmp/test.txt");
            }
            other => panic!("expected ToolCall, got {other:?}"),
        }
    }

    #[test]
    fn parse_tool_result() {
        let line = r#"{"role":"tool","tool_call_id":"Write:0","content":"Wrote 5 bytes to /tmp/test.txt"}"#;
        let items = parse_kimi_event(line);
        assert_eq!(items.len(), 1);
        match &items[0] {
            FeedItem::ToolResult { content, is_error } => {
                assert!(content.contains("Wrote 5 bytes"));
                assert!(!is_error);
            }
            other => panic!("expected ToolResult, got {other:?}"),
        }
    }

    #[test]
    fn extract_session_id_from_resume_hint() {
        let line = r#"{"role":"meta","type":"session.resume_hint","session_id":"session_abc-123","command":"kimi -r session_abc-123","content":"To resume: kimi -r session_abc-123"}"#;
        assert_eq!(
            extract_session_id(line),
            Some("session_abc-123".into())
        );
    }

    #[test]
    fn extract_session_id_returns_none_for_non_meta() {
        let line = r#"{"role":"assistant","content":"hello"}"#;
        assert_eq!(extract_session_id(line), None);
    }

    #[test]
    fn parse_empty_and_invalid() {
        assert!(parse_kimi_event("").is_empty());
        assert!(parse_kimi_event("  ").is_empty());
        assert!(parse_kimi_event("not json").is_empty());
    }

    #[test]
    fn parse_assistant_with_tool_calls_and_text() {
        // Kimi can send both tool_calls and content in one event
        let line = r#"{"role":"assistant","content":"I created the file.","tool_calls":[{"type":"function","id":"W:0","function":{"name":"Write","arguments":"{}"}}]}"#;
        let items = parse_kimi_event(line);
        assert_eq!(items.len(), 2);
        assert!(matches!(&items[0], FeedItem::ToolCall { .. }));
        assert!(matches!(&items[1], FeedItem::AssistantText(_)));
    }
}
