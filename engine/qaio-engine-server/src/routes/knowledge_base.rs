//! `/v1/agents/knowledge-base/*` REST routes.

use super::agents::{emit, resolve_root, AgentQuery};
use crate::routes::error::ApiError;
use crate::state::ServerState;
use axum::{
    extract::{Path as AxPath, Query, State},
    routing::get,
    Json, Router,
};
use qaio_engine_core::agents::{
    knowledge_base, KnowledgeEntry, KnowledgeEntryUpdate, NewKnowledgeEntry,
};
use qaio_ui_events::QaioEvent;
use serde::Deserialize;
use std::sync::Arc;

#[derive(Deserialize)]
struct SearchQuery {
    agent_path: String,
    #[serde(default)]
    q: Option<String>,
}

pub fn router() -> Router<Arc<ServerState>> {
    Router::new()
        .route(
            "/agents/knowledge-base",
            get(list_entries).post(create_entry),
        )
        .route(
            "/agents/knowledge-base/:id",
            axum::routing::patch(update_entry).delete(delete_entry),
        )
}

async fn list_entries(
    State(_st): State<Arc<ServerState>>,
    Query(q): Query<SearchQuery>,
) -> Result<Json<Vec<KnowledgeEntry>>, ApiError> {
    let root = resolve_root(&q.agent_path)?;
    let entries = match q.q {
        Some(ref term) if !term.is_empty() => knowledge_base::search(&root, term)?,
        _ => knowledge_base::list(&root)?,
    };
    Ok(Json(entries))
}

async fn create_entry(
    State(st): State<Arc<ServerState>>,
    Query(q): Query<AgentQuery>,
    Json(input): Json<NewKnowledgeEntry>,
) -> Result<Json<KnowledgeEntry>, ApiError> {
    let root = resolve_root(&q.agent_path)?;
    qaio_engine_core::agents::store::ensure_qaio_dir(&root)?;
    let result = knowledge_base::create(&root, input)?;
    emit(
        &st,
        QaioEvent::KnowledgeBaseChanged {
            agent_path: q.agent_path.clone(),
        },
    );
    Ok(Json(result))
}

async fn update_entry(
    State(st): State<Arc<ServerState>>,
    AxPath(id): AxPath<String>,
    Query(q): Query<AgentQuery>,
    Json(updates): Json<KnowledgeEntryUpdate>,
) -> Result<Json<KnowledgeEntry>, ApiError> {
    let root = resolve_root(&q.agent_path)?;
    let result = knowledge_base::update(&root, &id, updates)?;
    emit(
        &st,
        QaioEvent::KnowledgeBaseChanged {
            agent_path: q.agent_path.clone(),
        },
    );
    Ok(Json(result))
}

async fn delete_entry(
    State(st): State<Arc<ServerState>>,
    AxPath(id): AxPath<String>,
    Query(q): Query<AgentQuery>,
) -> Result<(), ApiError> {
    let root = resolve_root(&q.agent_path)?;
    knowledge_base::delete(&root, &id)?;
    emit(
        &st,
        QaioEvent::KnowledgeBaseChanged {
            agent_path: q.agent_path.clone(),
        },
    );
    Ok(())
}
