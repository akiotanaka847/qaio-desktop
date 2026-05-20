//! Parser for Gemini CLI `--output-format stream-json` NDJSON output.
//!
//! Maps Gemini events to the same `FeedItem` variants used by Claude/Codex
//! parsers, so the rest of the stack (session_runner, frontend) is
//! provider-agnostic.

use super::types::FeedItem;
use serde::Deserialize;

/// Top-level Gemini NDJSON event envelope.
///
/// All fields are optional because different event types populate different
/// subsets. The `content` field is `serde_json::Value` because `message`
/// events carry `[{type, text}]` arrays while `tool_result` events carry
/// a plain string.
#[derive(Debug, Clone, Deserialize)]
pub struct GeminiEvent {
    #[serde(rename = "type")]
    pub event_type: String,
    pub session_id: Option<String>,
    pub role: Option<String>,
    pub content: Option<serde_json::Value>,
    pub partial: Option<bool>,
    pub name: Option<String>,
    pub input: Option<serde_json::Value>,
    pub id: Option<String>,
    pub tool_use_id: Option<String>,
    pub is_error: Option<bool>,
    pub message: Option<String>,
    pub cost: Option<GeminiCost>,
    pub duration_ms: Option<u64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct GeminiContentBlock {
    #[serde(rename = "type")]
    pub block_type: String,
    pub text: Option<String>,
    pub thinking: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct GeminiCost {
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
}

/// Accumulates streaming state for Gemini events.
#[derive(Debug, Default)]
pub struct GeminiAccumulator {
    text_buffer: String,
    thinking_buffer: String,
}

impl GeminiAccumulator {
    pub fn new() -> Self {
        Self::default()
    }
}

/// Extract session ID from a Gemini `init` event.
pub fn extract_session_id(line: &str) -> Option<String> {
    let event: GeminiEvent = serde_json::from_str(line.trim()).ok()?;
    if event.event_type == "init" {
        event.session_id
    } else {
        None
    }
}

/// Parse a single NDJSON line from Gemini's stream-json output into FeedItems.
pub fn parse_gemini_event(line: &str, acc: &mut GeminiAccumulator) -> Vec<FeedItem> {
    let line = line.trim();
    if line.is_empty() {
        return vec![];
    }

    let event: GeminiEvent = match serde_json::from_str(line) {
        Ok(e) => e,
        Err(e) => {
            tracing::error!("Failed to parse Gemini event: {e}\nLine: {line}");
            return vec![];
        }
    };

    match event.event_type.as_str() {
        "init" => vec![],
        "message" => parse_message(&event, acc),
        "tool_use" => parse_tool_use(&event),
        "tool_result" => parse_tool_result(&event),
        "error" => {
            let msg = event.message.unwrap_or_else(|| "Unknown error".into());
            vec![FeedItem::SystemMessage(format!("Error: {msg}"))]
        }
        "result" => parse_result(&event, acc),
        _ => {
            tracing::debug!("[gemini] unhandled event type: {}", event.event_type);
            vec![]
        }
    }
}

fn parse_message(event: &GeminiEvent, acc: &mut GeminiAccumulator) -> Vec<FeedItem> {
    let is_partial = event.partial.unwrap_or(false);
    let content = match &event.content {
        Some(v) => v,
        None => return vec![],
    };

    let blocks: Vec<GeminiContentBlock> =
        serde_json::from_value(content.clone()).unwrap_or_default();

    let mut items = vec![];
    for block in &blocks {
        match block.block_type.as_str() {
            "text" => {
                if let Some(text) = &block.text {
                    if !text.is_empty() {
                        if is_partial {
                            acc.text_buffer = text.clone();
                            items.push(FeedItem::AssistantTextStreaming(text.clone()));
                        } else {
                            acc.text_buffer.clear();
                            items.push(FeedItem::AssistantText(text.clone()));
                        }
                    }
                }
            }
            "thinking" => {
                if let Some(thinking) = &block.thinking {
                    if !thinking.is_empty() {
                        if is_partial {
                            acc.thinking_buffer = thinking.clone();
                            items.push(FeedItem::ThinkingStreaming(thinking.clone()));
                        } else {
                            acc.thinking_buffer.clear();
                            items.push(FeedItem::Thinking(thinking.clone()));
                        }
                    }
                }
            }
            _ => {}
        }
    }
    items
}

fn parse_tool_use(event: &GeminiEvent) -> Vec<FeedItem> {
    let name = event.name.clone().unwrap_or_else(|| "unknown".into());
    let input = event.input.clone().unwrap_or(serde_json::Value::Null);
    vec![FeedItem::ToolCall { name, input }]
}

fn parse_tool_result(event: &GeminiEvent) -> Vec<FeedItem> {
    let content = extract_tool_result_content(event);
    let is_error = event.is_error.unwrap_or(false);
    vec![FeedItem::ToolResult { content, is_error }]
}

/// Content field can be a plain string or an array of content blocks.
fn extract_tool_result_content(event: &GeminiEvent) -> String {
    if let Some(content) = &event.content {
        if let Some(s) = content.as_str() {
            return s.to_string();
        }
        if let Ok(blocks) = serde_json::from_value::<Vec<GeminiContentBlock>>(content.clone()) {
            let joined: String = blocks
                .iter()
                .filter_map(|b| b.text.as_deref())
                .collect::<Vec<_>>()
                .join("\n");
            if !joined.is_empty() {
                return joined;
            }
        }
    }
    event.message.clone().unwrap_or_default()
}

fn parse_result(event: &GeminiEvent, acc: &mut GeminiAccumulator) -> Vec<FeedItem> {
    let mut items = vec![];
    if !acc.text_buffer.is_empty() {
        items.push(FeedItem::AssistantText(std::mem::take(
            &mut acc.text_buffer,
        )));
    }
    if !acc.thinking_buffer.is_empty() {
        items.push(FeedItem::Thinking(std::mem::take(
            &mut acc.thinking_buffer,
        )));
    }
    let result = if let Some(cost) = &event.cost {
        let total = cost.input_tokens.unwrap_or(0) + cost.output_tokens.unwrap_or(0);
        format!("{total} tokens used")
    } else {
        "Session completed".into()
    };
    items.push(FeedItem::FinalResult {
        result,
        cost_usd: None,
        duration_ms: event.duration_ms,
    });
    items
}

#[cfg(test)]
mod tests {
    use super::*;

    fn acc() -> GeminiAccumulator {
        GeminiAccumulator::new()
    }

    #[test]
    fn parse_init_event() {
        let line = r#"{"type":"init","session_id":"gem-123","model":"gemini-2.5-flash"}"#;
        let items = parse_gemini_event(line, &mut acc());
        assert!(items.is_empty());
        assert_eq!(extract_session_id(line), Some("gem-123".into()));
    }

    #[test]
    fn parse_message_streaming() {
        let line = r#"{"type":"message","role":"model","content":[{"type":"text","text":"Hello"}],"partial":true}"#;
        let items = parse_gemini_event(line, &mut acc());
        assert_eq!(items.len(), 1);
        assert!(matches!(&items[0], FeedItem::AssistantTextStreaming(t) if t == "Hello"));
    }

    #[test]
    fn parse_message_final() {
        let line = r#"{"type":"message","role":"model","content":[{"type":"text","text":"Hello world"}],"partial":false}"#;
        let items = parse_gemini_event(line, &mut acc());
        assert_eq!(items.len(), 1);
        assert!(matches!(&items[0], FeedItem::AssistantText(t) if t == "Hello world"));
    }

    #[test]
    fn parse_thinking_streaming_and_final() {
        let mut a = acc();
        let partial = r#"{"type":"message","role":"model","content":[{"type":"thinking","thinking":"Let me consider..."}],"partial":true}"#;
        let items = parse_gemini_event(partial, &mut a);
        assert_eq!(items.len(), 1);
        assert!(
            matches!(&items[0], FeedItem::ThinkingStreaming(t) if t == "Let me consider...")
        );

        let final_msg = r#"{"type":"message","role":"model","content":[{"type":"thinking","thinking":"Full thought"}],"partial":false}"#;
        let items = parse_gemini_event(final_msg, &mut a);
        assert_eq!(items.len(), 1);
        assert!(matches!(&items[0], FeedItem::Thinking(t) if t == "Full thought"));
    }

    #[test]
    fn parse_tool_use_event() {
        let line =
            r#"{"type":"tool_use","name":"shell","input":{"command":"ls"},"id":"tool_1"}"#;
        let items = parse_gemini_event(line, &mut acc());
        assert_eq!(items.len(), 1);
        match &items[0] {
            FeedItem::ToolCall { name, input } => {
                assert_eq!(name, "shell");
                assert_eq!(input["command"], "ls");
            }
            other => panic!("expected ToolCall, got {other:?}"),
        }
    }

    #[test]
    fn parse_tool_result_string_content() {
        let line = r#"{"type":"tool_result","tool_use_id":"tool_1","content":"file1.txt\nfile2.txt","is_error":false}"#;
        let items = parse_gemini_event(line, &mut acc());
        assert_eq!(items.len(), 1);
        match &items[0] {
            FeedItem::ToolResult { content, is_error } => {
                assert!(content.contains("file1.txt"));
                assert!(!is_error);
            }
            other => panic!("expected ToolResult, got {other:?}"),
        }
    }

    #[test]
    fn parse_tool_result_error() {
        let line = r#"{"type":"tool_result","tool_use_id":"tool_1","content":"permission denied","is_error":true}"#;
        let items = parse_gemini_event(line, &mut acc());
        assert_eq!(items.len(), 1);
        match &items[0] {
            FeedItem::ToolResult { is_error, .. } => assert!(is_error),
            other => panic!("expected ToolResult, got {other:?}"),
        }
    }

    #[test]
    fn parse_error_event() {
        let line = r#"{"type":"error","message":"Rate limit exceeded"}"#;
        let items = parse_gemini_event(line, &mut acc());
        assert_eq!(items.len(), 1);
        assert!(matches!(&items[0], FeedItem::SystemMessage(m) if m.contains("Rate limit")));
    }

    #[test]
    fn parse_result_with_cost() {
        let line = r#"{"type":"result","session_id":"gem-123","cost":{"input_tokens":1000,"output_tokens":500},"duration_ms":5000}"#;
        let items = parse_gemini_event(line, &mut acc());
        assert_eq!(items.len(), 1);
        match &items[0] {
            FeedItem::FinalResult {
                result,
                duration_ms,
                ..
            } => {
                assert!(result.contains("1500"));
                assert_eq!(*duration_ms, Some(5000));
            }
            other => panic!("expected FinalResult, got {other:?}"),
        }
    }

    #[test]
    fn text_buffer_flushed_on_result() {
        let mut a = acc();
        let streaming = r#"{"type":"message","role":"model","content":[{"type":"text","text":"partial"}],"partial":true}"#;
        parse_gemini_event(streaming, &mut a);

        let result =
            r#"{"type":"result","session_id":"gem-123","cost":{"input_tokens":100,"output_tokens":50}}"#;
        let items = parse_gemini_event(result, &mut a);
        assert_eq!(items.len(), 2);
        assert!(matches!(&items[0], FeedItem::AssistantText(t) if t == "partial"));
        assert!(matches!(&items[1], FeedItem::FinalResult { .. }));
    }

    #[test]
    fn parse_empty_and_invalid() {
        assert!(parse_gemini_event("", &mut acc()).is_empty());
        assert!(parse_gemini_event("  ", &mut acc()).is_empty());
        assert!(parse_gemini_event("not json", &mut acc()).is_empty());
    }

    #[test]
    fn extract_session_id_returns_none_for_non_init() {
        let line = r#"{"type":"message","role":"model","content":[]}"#;
        assert_eq!(extract_session_id(line), None);
    }

    #[test]
    fn parse_result_without_cost() {
        let line = r#"{"type":"result","session_id":"gem-456"}"#;
        let items = parse_gemini_event(line, &mut acc());
        assert_eq!(items.len(), 1);
        match &items[0] {
            FeedItem::FinalResult { result, .. } => {
                assert_eq!(result, "Session completed");
            }
            other => panic!("expected FinalResult, got {other:?}"),
        }
    }
}
