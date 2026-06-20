//! `/v1/agents/files/*` REST routes — generic file I/O for an agent directory.
//!
//! Two flavours:
//!  * Agent-data files (`/v1/agents/files`): read/write/seed/migrate the typed
//!    `.qaio/<type>/<type>.json` layout. Writes auto-emit the matching
//!    `QaioEvent`.
//!  * User-facing project files (`/v1/agents/files/list`, `/import`, …):
//!    powers the file browser. Mutations emit `FilesChanged`.

use crate::routes::error::ApiError;
use crate::state::ServerState;
use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use base64::Engine as _;
use qaio_engine_core::agents::files;
use qaio_engine_core::paths::{expand_tilde, EnginePaths};
use qaio_engine_core::CoreError;
use qaio_ui_events::QaioEvent;
use serde::{Deserialize, Serialize};
use std::path::{Component, PathBuf};
use std::sync::Arc;

pub fn router() -> Router<Arc<ServerState>> {
    Router::new()
        .route("/agents/files", get(list_project_files).delete(delete_file))
        .route("/agents/files/read", post(read))
        .route("/agents/files/write", post(write))
        .route("/agents/files/seed-schemas", post(seed_schemas))
        .route("/agents/files/migrate", post(migrate))
        .route("/agents/files/read-project", post(read_project))
        .route("/agents/files/rename", post(rename))
        .route("/agents/files/folder", post(create_folder))
        .route("/agents/files/import", post(import))
        .route("/agents/files/import-bytes", post(import_bytes))
}

// ---------------------------------------------------------------------------
// Common request shapes
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct AgentPathBody {
    pub agent_path: String,
}

#[derive(Deserialize)]
pub struct AgentRelBody {
    pub agent_path: String,
    pub rel_path: String,
}

#[derive(Deserialize)]
pub struct WriteBody {
    pub agent_path: String,
    pub rel_path: String,
    pub content: String,
}

#[derive(Deserialize)]
pub struct RenameBody {
    pub agent_path: String,
    pub rel_path: String,
    pub new_name: String,
}

#[derive(Deserialize)]
pub struct CreateFolderBody {
    pub agent_path: String,
    pub folder_name: String,
}

#[derive(Deserialize)]
pub struct ImportBody {
    pub agent_path: String,
    pub file_paths: Vec<String>,
    #[serde(default)]
    pub target_folder: Option<String>,
}

#[derive(Deserialize)]
pub struct ImportBytesBody {
    pub agent_path: String,
    pub file_name: String,
    pub data_base64: String,
}

#[derive(Deserialize)]
pub struct DeleteFileQuery {
    pub agent_path: String,
    pub rel_path: String,
}

#[derive(Serialize)]
pub struct FileContent {
    pub content: String,
}

#[derive(Serialize)]
pub struct CreatedFolder {
    pub created: String,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Resolve and **sandbox** a caller-supplied `agent_path`.
///
/// The file API accepts the agent directory as a parameter, so without
/// this check any bearer-token holder (notably a paired mobile device
/// reaching the engine over the relay tunnel) could set `agent_path` to
/// an arbitrary location like `~/.ssh` and read or write files outside
/// Qaio's data. We require the resolved path to live under a known Qaio
/// root (`~/.qaio` or the legacy `~/Documents/Qaio`) and reject any `..`
/// traversal. Legitimate agent paths always satisfy both.
fn resolve_root(paths: &EnginePaths, agent_path: &str) -> Result<PathBuf, CoreError> {
    if agent_path.trim().is_empty() {
        return Err(CoreError::BadRequest("agent_path is required".into()));
    }
    let expanded = expand_tilde(std::path::Path::new(agent_path));
    if expanded.components().any(|c| matches!(c, Component::ParentDir)) {
        return Err(CoreError::BadRequest(
            "agent_path must not contain '..'".into(),
        ));
    }
    if !expanded.starts_with(paths.home()) && !expanded.starts_with(paths.docs()) {
        return Err(CoreError::BadRequest(
            "agent_path must be within the Qaio data directory".into(),
        ));
    }
    Ok(expanded)
}

fn emit(state: &ServerState, event: QaioEvent) {
    state.engine.events.emit(event);
}

// ---------------------------------------------------------------------------
// Agent-data files
// ---------------------------------------------------------------------------

async fn read(
    State(st): State<Arc<ServerState>>,
    Json(body): Json<AgentRelBody>,
) -> Result<Json<FileContent>, ApiError> {
    let root = resolve_root(&st.engine.paths, &body.agent_path)?;
    let content = files::read_agent_file(&root, &body.rel_path)?;
    Ok(Json(FileContent { content }))
}

async fn write(
    State(st): State<Arc<ServerState>>,
    Json(body): Json<WriteBody>,
) -> Result<(), ApiError> {
    let root = resolve_root(&st.engine.paths, &body.agent_path)?;
    if let Some(event) =
        files::write_agent_file(&root, &body.agent_path, &body.rel_path, &body.content)?
    {
        emit(&st, event);
    }
    Ok(())
}

async fn seed_schemas(
    State(st): State<Arc<ServerState>>,
    Json(body): Json<AgentPathBody>,
) -> Result<(), ApiError> {
    let root = resolve_root(&st.engine.paths, &body.agent_path)?;
    files::seed_agent_schemas(&root)?;
    Ok(())
}

async fn migrate(
    State(st): State<Arc<ServerState>>,
    Json(body): Json<AgentPathBody>,
) -> Result<(), ApiError> {
    let root = resolve_root(&st.engine.paths, &body.agent_path)?;
    files::migrate_agent_files(&root)?;
    Ok(())
}

// ---------------------------------------------------------------------------
// User-facing project files
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct AgentPathQuery {
    pub agent_path: String,
}

async fn list_project_files(
    State(st): State<Arc<ServerState>>,
    Query(q): Query<AgentPathQuery>,
) -> Result<Json<Vec<files::ProjectFile>>, ApiError> {
    let root = resolve_root(&st.engine.paths, &q.agent_path)?;
    Ok(Json(files::list_project_files(&root)?))
}

async fn read_project(
    State(st): State<Arc<ServerState>>,
    Json(body): Json<AgentRelBody>,
) -> Result<Json<FileContent>, ApiError> {
    let root = resolve_root(&st.engine.paths, &body.agent_path)?;
    let content = files::read_project_file(&root, &body.rel_path)?;
    Ok(Json(FileContent { content }))
}

async fn rename(
    State(st): State<Arc<ServerState>>,
    Json(body): Json<RenameBody>,
) -> Result<(), ApiError> {
    let root = resolve_root(&st.engine.paths, &body.agent_path)?;
    files::rename_file(&root, &body.rel_path, &body.new_name)?;
    emit(
        &st,
        QaioEvent::FilesChanged {
            agent_path: body.agent_path,
        },
    );
    Ok(())
}

async fn delete_file(
    State(st): State<Arc<ServerState>>,
    Query(q): Query<DeleteFileQuery>,
) -> Result<(), ApiError> {
    let root = resolve_root(&st.engine.paths, &q.agent_path)?;
    files::delete_file(&root, &q.rel_path)?;
    emit(
        &st,
        QaioEvent::FilesChanged {
            agent_path: q.agent_path,
        },
    );
    Ok(())
}

async fn create_folder(
    State(st): State<Arc<ServerState>>,
    Json(body): Json<CreateFolderBody>,
) -> Result<Json<CreatedFolder>, ApiError> {
    let root = resolve_root(&st.engine.paths, &body.agent_path)?;
    let created = files::create_folder(&root, &body.folder_name)?;
    emit(
        &st,
        QaioEvent::FilesChanged {
            agent_path: body.agent_path,
        },
    );
    Ok(Json(CreatedFolder { created }))
}

async fn import(
    State(st): State<Arc<ServerState>>,
    Json(body): Json<ImportBody>,
) -> Result<Json<Vec<files::ProjectFile>>, ApiError> {
    let root = resolve_root(&st.engine.paths, &body.agent_path)?;
    let imported =
        files::import_files(&root, &body.file_paths, body.target_folder.as_deref())?;
    if !imported.is_empty() {
        emit(
            &st,
            QaioEvent::FilesChanged {
                agent_path: body.agent_path,
            },
        );
    }
    Ok(Json(imported))
}

async fn import_bytes(
    State(st): State<Arc<ServerState>>,
    Json(body): Json<ImportBytesBody>,
) -> Result<Json<files::ProjectFile>, ApiError> {
    let root = resolve_root(&st.engine.paths, &body.agent_path)?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&body.data_base64)
        .map_err(|e| CoreError::BadRequest(format!("invalid base64: {e}")))?;
    let pf = files::write_file_bytes(&root, &body.file_name, &bytes)?;
    emit(
        &st,
        QaioEvent::FilesChanged {
            agent_path: body.agent_path,
        },
    );
    Ok(Json(pf))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    fn paths() -> EnginePaths {
        EnginePaths::new(
            PathBuf::from("/home/u/Documents/Qaio"),
            PathBuf::from("/home/u/.qaio"),
        )
    }

    #[test]
    fn accepts_path_under_qaio_home() {
        let root = resolve_root(&paths(), "/home/u/.qaio/workspaces/Personal/linkedin").unwrap();
        assert_eq!(root, Path::new("/home/u/.qaio/workspaces/Personal/linkedin"));
    }

    #[test]
    fn accepts_legacy_docs_path() {
        assert!(resolve_root(&paths(), "/home/u/Documents/Qaio/agent").is_ok());
    }

    #[test]
    fn rejects_path_outside_qaio_roots() {
        let err = resolve_root(&paths(), "/home/u/.ssh").unwrap_err();
        assert!(matches!(err, CoreError::BadRequest(_)));
    }

    #[test]
    fn rejects_parent_dir_traversal() {
        let err =
            resolve_root(&paths(), "/home/u/.qaio/workspaces/../../.ssh").unwrap_err();
        assert!(matches!(err, CoreError::BadRequest(_)));
    }

    #[test]
    fn rejects_empty_path() {
        assert!(resolve_root(&paths(), "   ").is_err());
    }
}
