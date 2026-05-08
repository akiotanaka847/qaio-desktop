//! qaio-tauri — Tauri adapter for the Qaio desktop app.
//!
//! Post-Phase-4 this crate is intentionally thin: domain logic lives in
//! `qaio-engine-core` and is exposed over HTTP+WS by
//! `qaio-engine-server`. The adapter only keeps what the desktop
//! specifically needs: OS-native glue (tray, event sink, path helpers,
//! shared state).

pub mod event_sink;
pub mod paths;
pub mod state;
pub mod tray;

pub use event_sink::{tauri_sink, TauriEventSink};

// Re-export sub-crates for convenience.
pub use qaio_agent_files;
pub use qaio_agents_conversations;
pub use qaio_db;
pub use qaio_events;
pub use qaio_scheduler;
pub use qaio_terminal_manager;
pub use qaio_ui_events;
