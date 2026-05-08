//! Tauri implementation of the transport-neutral `EventSink` contract.
//!
//! Bridges `qaio-ui-events::EventSink` (used by every engine crate) to
//! Tauri's `app_handle.emit(...)`. Lives in `qaio-tauri` (the adapter)
//! so the engine crates remain free of `tauri` dependencies.

use qaio_ui_events::{DynEventSink, EventSink, QaioEvent};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

/// `EventSink` impl backed by Tauri's event bus. Emits every event under
/// the `"qaio-event"` channel for the webview to listen on.
#[derive(Clone)]
pub struct TauriEventSink {
    handle: AppHandle,
}

impl TauriEventSink {
    pub fn new(handle: AppHandle) -> Self {
        Self { handle }
    }
}

impl EventSink for TauriEventSink {
    fn emit(&self, event: QaioEvent) {
        if let Err(err) = self.handle.emit("qaio-event", event) {
            tracing::warn!("[tauri-event-sink] emit failed: {err}");
        }
    }
}

/// Convenience constructor — returns an `Arc<dyn EventSink>` ready to pass
/// into engine crates.
pub fn tauri_sink(handle: &AppHandle) -> DynEventSink {
    Arc::new(TauriEventSink::new(handle.clone()))
}
