//! `/v1/providers/:name/{status,login,logout}` REST routes.
//!
//! The `default_provider` preference is exposed through the generic
//! `/v1/preferences/:key` endpoint, not here.

use crate::routes::error::ApiError;
use crate::state::ServerState;
use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use qaio_engine_core::provider::{self, ProviderStatus};
use std::sync::Arc;

pub fn router() -> Router<Arc<ServerState>> {
    Router::new()
        .route("/providers/:name/status", get(status))
        .route("/providers/:name/login", post(login))
        .route("/providers/:name/login/cancel", post(login_cancel))
        .route("/providers/:name/logout", post(logout))
}

async fn status(
    State(_st): State<Arc<ServerState>>,
    Path(name): Path<String>,
) -> Result<Json<ProviderStatus>, ApiError> {
    let p = provider::parse(&name)?;
    Ok(Json(provider::check_status(p).await?))
}

async fn login(
    State(st): State<Arc<ServerState>>,
    Path(name): Path<String>,
) -> Result<(), ApiError> {
    let p = provider::parse(&name)?;
    let events = std::sync::Arc::new(st.events.clone()) as qaio_ui_events::DynEventSink;
    provider::launch_login(p, events).await?;
    Ok(())
}

async fn login_cancel(
    State(_st): State<Arc<ServerState>>,
    Path(name): Path<String>,
) -> Result<(), ApiError> {
    let p = provider::parse(&name)?;
    provider::cancel_login(p).await?;
    Ok(())
}

async fn logout(
    State(_st): State<Arc<ServerState>>,
    Path(name): Path<String>,
) -> Result<(), ApiError> {
    let p = provider::parse(&name)?;
    provider::launch_logout(p).await?;
    Ok(())
}
