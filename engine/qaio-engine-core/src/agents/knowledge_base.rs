//! CRUD operations for `.qaio/knowledge_base/knowledge_base.json`.

use super::store::{read_json, write_json};
use super::types::{KnowledgeEntry, KnowledgeEntryUpdate, NewKnowledgeEntry};
use crate::error::{CoreError, CoreResult};
use chrono::Utc;
use std::path::Path;
use uuid::Uuid;

const FILE: &str = "knowledge_base";

pub fn list(root: &Path) -> CoreResult<Vec<KnowledgeEntry>> {
    read_json::<Vec<KnowledgeEntry>>(root, FILE)
}

pub fn search(root: &Path, query: &str) -> CoreResult<Vec<KnowledgeEntry>> {
    let all = list(root)?;
    if query.is_empty() {
        return Ok(all);
    }
    let q = query.to_ascii_lowercase();
    Ok(all
        .into_iter()
        .filter(|e| {
            e.title.to_ascii_lowercase().contains(&q)
                || e.content.to_ascii_lowercase().contains(&q)
                || e.tags.iter().any(|t| t.to_ascii_lowercase().contains(&q))
                || e.client.as_deref().unwrap_or("").to_ascii_lowercase().contains(&q)
                || e.project.as_deref().unwrap_or("").to_ascii_lowercase().contains(&q)
        })
        .collect())
}

pub fn create(root: &Path, input: NewKnowledgeEntry) -> CoreResult<KnowledgeEntry> {
    let mut items = list(root)?;
    let now = Utc::now().to_rfc3339();
    let entry = KnowledgeEntry {
        id: Uuid::new_v4().to_string(),
        title: input.title,
        content: input.content,
        source: input.source,
        tags: input.tags,
        client: input.client,
        project: input.project,
        author: input.author,
        created_at: now.clone(),
        updated_at: now,
    };
    items.push(entry.clone());
    write_json(root, FILE, &items)?;
    Ok(entry)
}

pub fn update(root: &Path, id: &str, updates: KnowledgeEntryUpdate) -> CoreResult<KnowledgeEntry> {
    let mut items = list(root)?;
    let entry = items
        .iter_mut()
        .find(|e| e.id == id)
        .ok_or_else(|| CoreError::NotFound(format!("knowledge entry {id}")))?;

    if let Some(title) = updates.title {
        entry.title = title;
    }
    if let Some(content) = updates.content {
        entry.content = content;
    }
    if let Some(source) = updates.source {
        entry.source = source;
    }
    if let Some(tags) = updates.tags {
        entry.tags = tags;
    }
    if let Some(client) = updates.client {
        entry.client = client;
    }
    if let Some(project) = updates.project {
        entry.project = project;
    }
    if let Some(author) = updates.author {
        entry.author = author;
    }
    entry.updated_at = Utc::now().to_rfc3339();
    let result = entry.clone();
    write_json(root, FILE, &items)?;
    Ok(result)
}

pub fn delete(root: &Path, id: &str) -> CoreResult<()> {
    let mut items = list(root)?;
    let len = items.len();
    items.retain(|e| e.id != id);
    if items.len() == len {
        return Err(CoreError::NotFound(format!("knowledge entry {id}")));
    }
    write_json(root, FILE, &items)
}
