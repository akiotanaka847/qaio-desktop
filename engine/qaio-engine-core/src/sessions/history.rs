//! Chat history read — relocated from `app/src-tauri/src/commands/chat.rs`.
//!
//! Given an agent path + session key, resolves every known provider resume ID
//! for that key and loads the associated chat-feed rows from the engine DB.
//! Transport-neutral: REST handlers and tests call it the same way.

use crate::error::{CoreError, CoreResult};
use qaio_agents_conversations::session_id_tracker::session_ids_for_history;
use qaio_db::Database;
use serde::Serialize;
use std::path::Path;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "snake_case")]
pub struct ChatHistoryEntry {
    /// Row identity, so a client can name a point in the conversation
    /// (to edit from it, for instance) without counting positions that
    /// shift as the feed grows.
    pub id: i64,
    pub feed_type: String,
    pub data: serde_json::Value,
}

pub async fn load(
    db: &Database,
    working_dir: &Path,
    session_key: &str,
) -> CoreResult<Vec<ChatHistoryEntry>> {
    let session_ids = session_ids_for_history(working_dir, session_key);
    if session_ids.is_empty() {
        return Ok(Vec::new());
    }

    let mut rows = Vec::new();
    for session_id in session_ids {
        rows.extend(
            db.list_chat_feed_by_session(&session_id)
                .await
                .map_err(|e| CoreError::Internal(e.to_string()))?,
        );
    }

    // Ordered by rowid, not timestamp. Both are written at insert, but
    // the rowid is a counter: it cannot tie between two rows saved in the
    // same instant, and it cannot go backwards if the wall clock does.
    // Truncation addresses rows by the same key, so what a client sees as
    // "after this message" and what the delete removes cannot disagree.
    rows.sort_by_key(|row| row.id);

    Ok(rows
        .into_iter()
        .map(|row| {
            let data = serde_json::from_str::<serde_json::Value>(&row.data_json)
                .unwrap_or(serde_json::Value::String(row.data_json));
            ChatHistoryEntry {
                id: row.id,
                feed_type: row.feed_type,
                data,
            }
        })
        .collect())
}
