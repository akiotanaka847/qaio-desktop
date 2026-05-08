//! Shared helpers for typed JSON I/O under `.qaio/<type>/<type>.json`.
//!
//! Delegates atomic writes + path-traversal safety to `qaio-agent-files`.

use crate::error::{CoreError, CoreResult};
use qaio_agent_files as files;
use serde::de::DeserializeOwned;
use serde::Serialize;
use std::path::{Path, PathBuf};

/// Returns the `.qaio/` directory inside an agent root.
pub fn qaio_dir(root: &Path) -> PathBuf {
    root.join(".qaio")
}

/// Creates `.qaio/` if it doesn't exist.
pub fn ensure_qaio_dir(root: &Path) -> CoreResult<()> {
    let dir = qaio_dir(root);
    std::fs::create_dir_all(&dir).map_err(|e| {
        CoreError::Internal(format!("failed to create .qaio directory: {e}"))
    })?;
    Ok(())
}

/// Build the relative path for a given type: `.qaio/<name>/<name>.json`.
fn rel_path(name: &str) -> String {
    format!(".qaio/{name}/{name}.json")
}

/// Read and deserialize `.qaio/<name>/<name>.json`.
/// Returns `T::default()` if the file does not exist or is empty.
pub fn read_json<T: DeserializeOwned + Default>(root: &Path, name: &str) -> CoreResult<T> {
    let rel = rel_path(name);
    let contents = files::read_file(root, &rel)
        .map_err(|e| CoreError::Internal(format!("failed to read {rel}: {e}")))?;
    if contents.is_empty() {
        return Ok(T::default());
    }
    serde_json::from_str(&contents).map_err(Into::into)
}

/// Atomically write a typed value as `.qaio/<name>/<name>.json`.
pub fn write_json<T: Serialize>(root: &Path, name: &str, data: &T) -> CoreResult<()> {
    let rel = rel_path(name);
    let body = serde_json::to_string_pretty(data)?;
    files::write_file_atomic(root, &rel, &body)
        .map_err(|e| CoreError::Internal(format!("failed to write {rel}: {e}")))
}
