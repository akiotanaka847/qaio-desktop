//! qaio-composio — Composio integration for Qaio.
//!
//! Wraps the `composio` CLI (`~/.composio/composio`) with install/upgrade
//! lifecycle, OAuth flow, and app catalog. Transport-neutral — Tauri
//! decorators live in the adapter crate (`qaio-tauri`).

pub mod apps;
pub mod auth;
pub mod cli;
pub mod commands;
pub mod connection_watcher;
pub mod install;
pub mod lifecycle;
pub mod mcp;
pub mod toolkits;
