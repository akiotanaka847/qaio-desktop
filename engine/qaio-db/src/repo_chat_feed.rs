use crate::db::Database;
use anyhow::Result;

/// A persisted chat feed item row.
pub struct ChatFeedRow {
    /// Autoincrement rowid. Doubles as the conversation's true order:
    /// it is assigned at insert, so it cannot tie and cannot go
    /// backwards when the wall clock does.
    pub id: i64,
    pub feed_type: String,
    pub data_json: String,
    pub source: String,
    pub timestamp: String,
}

impl Database {
    /// Add a feed item keyed by claude_session_id.
    pub async fn add_chat_feed_item_by_session(
        &self,
        claude_session_id: &str,
        feed_type: &str,
        data_json: &str,
        source: &str,
    ) -> Result<()> {
        let now = chrono::Utc::now().to_rfc3339();
        self.conn()
            .execute(
                "INSERT INTO chat_feed (claude_session_id, feed_type, data_json, source, timestamp)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                libsql::params![
                    claude_session_id.to_string(),
                    feed_type.to_string(),
                    data_json.to_string(),
                    source.to_string(),
                    now,
                ],
            )
            .await?;
        Ok(())
    }

    /// Load all feed items for a claude session, ordered chronologically.
    pub async fn list_chat_feed_by_session(
        &self,
        claude_session_id: &str,
    ) -> Result<Vec<ChatFeedRow>> {
        let mut rows = self
            .conn()
            .query(
                "SELECT id, feed_type, data_json, source, timestamp FROM chat_feed
                 WHERE claude_session_id = ?1
                 ORDER BY id ASC",
                libsql::params![claude_session_id.to_string()],
            )
            .await?;

        let mut items = Vec::new();
        while let Some(row) = rows.next().await? {
            items.push(ChatFeedRow {
                id: row.get(0)?,
                feed_type: row.get(1)?,
                data_json: row.get(2)?,
                source: row.get(3)?,
                timestamp: row.get(4)?,
            });
        }
        Ok(items)
    }

    /// Drop every feed item after `after_id` across the given provider
    /// sessions, keeping `after_id` itself.
    ///
    /// One conversation can span several provider sessions (a rejected
    /// resume forks a new one), so a caller passes every session id the
    /// conversation owns and the global rowid decides what "after"
    /// means. Returns how many rows went, so a caller can tell a real
    /// truncation from a no-op.
    ///
    /// The `chat_feed_fts_delete` trigger keeps the search index in
    /// step; nothing here has to touch it.
    pub async fn truncate_chat_feed_after(
        &self,
        claude_session_ids: &[String],
        after_id: i64,
    ) -> Result<u64> {
        if claude_session_ids.is_empty() {
            return Ok(0);
        }

        // libsql has no array binding, so the id list is expanded into
        // placeholders rather than interpolated.
        let placeholders = (0..claude_session_ids.len())
            .map(|i| format!("?{}", i + 2))
            .collect::<Vec<_>>()
            .join(", ");
        let sql = format!(
            "DELETE FROM chat_feed WHERE id > ?1 AND claude_session_id IN ({placeholders})"
        );

        let mut params: Vec<libsql::Value> = vec![after_id.into()];
        for id in claude_session_ids {
            params.push(id.clone().into());
        }

        let affected = self.conn().execute(&sql, params).await?;
        Ok(affected)
    }

    /// Clear all chat feed items for a claude session.
    pub async fn clear_chat_feed_by_session(
        &self,
        claude_session_id: &str,
    ) -> Result<()> {
        self.conn()
            .execute(
                "DELETE FROM chat_feed WHERE claude_session_id = ?1",
                libsql::params![claude_session_id.to_string()],
            )
            .await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn seed(db: &Database, session: &str, texts: &[&str]) -> Vec<i64> {
        for text in texts {
            db.add_chat_feed_item_by_session(session, "assistant_text", text, "desktop")
                .await
                .unwrap();
        }
        db.list_chat_feed_by_session(session)
            .await
            .unwrap()
            .into_iter()
            .map(|r| r.id)
            .collect()
    }

    #[tokio::test]
    async fn clearing_a_session_does_not_error() {
        // Regression: this failed for every row, because the fts delete
        // trigger used the external-content `('delete', ...)` form on a
        // table that stores its own content. The function had no callers,
        // so the breakage sat unnoticed until truncation needed deletes
        // to work.
        let db = Database::connect_in_memory().await.unwrap();
        db.add_chat_feed_item_by_session("s1", "assistant_text", "hello", "desktop")
            .await
            .unwrap();

        db.clear_chat_feed_by_session("s1").await.unwrap();

        assert!(db.list_chat_feed_by_session("s1").await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn truncate_keeps_the_anchor_and_drops_what_follows() {
        let db = Database::connect_in_memory().await.unwrap();
        let ids = seed(&db, "s1", &["one", "two", "three", "four"]).await;

        let removed = db.truncate_chat_feed_after(&["s1".into()], ids[1]).await.unwrap();

        assert_eq!(removed, 2);
        let left = db.list_chat_feed_by_session("s1").await.unwrap();
        let texts: Vec<_> = left.iter().map(|r| r.data_json.as_str()).collect();
        assert_eq!(texts, vec!["one", "two"], "the anchor itself survives");
    }

    #[tokio::test]
    async fn truncate_spans_every_session_of_one_conversation() {
        // A rejected resume forks a second provider session, so a
        // conversation's rows are split across ids. Truncation has to
        // cut the conversation, not one leg of it.
        let db = Database::connect_in_memory().await.unwrap();
        let first = seed(&db, "s1", &["one", "two"]).await;
        seed(&db, "s2", &["three", "four"]).await;

        let removed = db
            .truncate_chat_feed_after(&["s1".into(), "s2".into()], first[1])
            .await
            .unwrap();

        assert_eq!(removed, 2, "both rows of the forked session go");
        assert_eq!(db.list_chat_feed_by_session("s1").await.unwrap().len(), 2);
        assert!(db.list_chat_feed_by_session("s2").await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn truncate_leaves_other_conversations_alone() {
        let db = Database::connect_in_memory().await.unwrap();
        let mine = seed(&db, "mine", &["a", "b"]).await;
        seed(&db, "theirs", &["x", "y"]).await;

        db.truncate_chat_feed_after(&["mine".into()], mine[0]).await.unwrap();

        assert_eq!(db.list_chat_feed_by_session("mine").await.unwrap().len(), 1);
        assert_eq!(
            db.list_chat_feed_by_session("theirs").await.unwrap().len(),
            2,
            "a conversation not named must not lose rows",
        );
    }

    #[tokio::test]
    async fn truncate_at_the_last_row_is_a_no_op() {
        let db = Database::connect_in_memory().await.unwrap();
        let ids = seed(&db, "s1", &["one", "two"]).await;

        let removed = db
            .truncate_chat_feed_after(&["s1".into()], *ids.last().unwrap())
            .await
            .unwrap();

        assert_eq!(removed, 0);
        assert_eq!(db.list_chat_feed_by_session("s1").await.unwrap().len(), 2);
    }

    #[tokio::test]
    async fn truncate_without_sessions_touches_nothing() {
        let db = Database::connect_in_memory().await.unwrap();
        seed(&db, "s1", &["one"]).await;

        assert_eq!(db.truncate_chat_feed_after(&[], 0).await.unwrap(), 0);
        assert_eq!(db.list_chat_feed_by_session("s1").await.unwrap().len(), 1);
    }

    #[tokio::test]
    async fn truncated_rows_leave_the_search_index() {
        // The chat_feed_fts_delete trigger is what keeps search honest
        // after a truncation; assert it actually fires.
        let db = Database::connect_in_memory().await.unwrap();
        let ids = seed(&db, "s1", &["keepme", "dropme"]).await;

        db.truncate_chat_feed_after(&["s1".into()], ids[0]).await.unwrap();

        let mut rows = db
            .conn()
            .query(
                "SELECT count(*) FROM chat_feed_fts WHERE chat_feed_fts MATCH ?1",
                libsql::params!["dropme"],
            )
            .await
            .unwrap();
        let row = rows.next().await.unwrap().unwrap();
        let hits: i64 = row.get(0).unwrap();
        assert_eq!(hits, 0, "a truncated message must not stay searchable");
    }
}
