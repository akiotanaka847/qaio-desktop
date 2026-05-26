//! Tracks in-flight provider login subprocesses so they can be cancelled.
//!
//! Each provider can have at most one active login. Starting a new login
//! for the same provider cancels the previous one. The watcher task emits
//! `ProviderLoginComplete` when the subprocess exits (naturally or via
//! cancel), so the frontend can stop its spinner without polling.

use qaio_terminal_manager::Provider;
use qaio_ui_events::{DynEventSink, QaioEvent};
use std::sync::{Arc, LazyLock};
use tokio::process::Child;
use tokio::sync::{Mutex, Notify};

struct LoginSession {
    provider: Provider,
    cancel: Arc<Notify>,
}

/// Active login sessions. At most 3 entries (one per provider).
/// Linear scan is fine for such a small list — avoids `Hash` bound.
static LOGIN_SESSIONS: LazyLock<Mutex<Vec<LoginSession>>> =
    LazyLock::new(|| Mutex::new(Vec::new()));

/// Register a spawned login child and start a watcher that emits
/// `ProviderLoginComplete` when it exits.
pub async fn register(provider: Provider, mut child: Child, events: DynEventSink) {
    let cancel = Arc::new(Notify::new());
    let session = LoginSession {
        provider,
        cancel: cancel.clone(),
    };

    // Cancel any previous login for this provider.
    cancel_inner(provider).await;

    LOGIN_SESSIONS.lock().await.push(session);

    let provider_str = provider.to_string();
    tokio::spawn(async move {
        let cancelled = tokio::select! {
            status = child.wait() => {
                match status {
                    Ok(s) => tracing::info!("[qaio:provider] {provider_str} login exited: {s}"),
                    Err(e) => tracing::warn!("[qaio:provider] {provider_str} login wait error: {e}"),
                }
                false
            }
            _ = cancel.notified() => {
                let _ = child.kill().await;
                tracing::info!("[qaio:provider] {provider_str} login cancelled");
                true
            }
        };

        // Clean up entry (might already be gone if cancel removed it).
        if let Ok(p) = provider_str.parse::<Provider>() {
            LOGIN_SESSIONS.lock().await.retain(|s| s.provider != p);
        }

        events.emit(QaioEvent::ProviderLoginComplete {
            provider: provider_str,
            cancelled,
        });
    });
}

/// Cancel the active login for a provider, if any. Returns `true` if a
/// session was actually cancelled.
pub async fn cancel(provider: Provider) -> bool {
    cancel_inner(provider).await
}

async fn cancel_inner(provider: Provider) -> bool {
    let mut sessions = LOGIN_SESSIONS.lock().await;
    let idx = sessions.iter().position(|s| s.provider == provider);
    if let Some(i) = idx {
        let session = sessions.swap_remove(i);
        session.cancel.notify_one();
        true
    } else {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use qaio_ui_events::BroadcastEventSink;

    fn test_sink() -> (DynEventSink, tokio::sync::broadcast::Receiver<QaioEvent>) {
        let sink = Arc::new(BroadcastEventSink::new(16));
        let rx = sink.subscribe();
        (sink as DynEventSink, rx)
    }

    // Each test uses a different provider to avoid global-state
    // collisions when cargo runs them in parallel.

    #[tokio::test]
    async fn cancel_with_no_session_returns_false() {
        // Gemini is unlikely to be used by other tests.
        assert!(!cancel(Provider::Gemini).await);
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn register_and_cancel_emits_event() {
        let (sink, mut rx) = test_sink();

        let child = tokio::process::Command::new("sleep")
            .arg("60")
            .kill_on_drop(true)
            .spawn()
            .expect("spawn sleep");

        register(Provider::Anthropic, child, sink).await;
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;

        assert!(cancel(Provider::Anthropic).await);

        let event = tokio::time::timeout(std::time::Duration::from_secs(2), rx.recv())
            .await
            .expect("event within timeout")
            .expect("recv ok");

        match event {
            QaioEvent::ProviderLoginComplete {
                provider,
                cancelled,
            } => {
                assert_eq!(provider, "anthropic");
                assert!(cancelled);
            }
            other => panic!("unexpected event: {other:?}"),
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn natural_exit_emits_non_cancelled_event() {
        let (sink, mut rx) = test_sink();

        // Use OpenAI to avoid collision with the cancel test.
        let child = tokio::process::Command::new("true")
            .kill_on_drop(true)
            .spawn()
            .expect("spawn true");

        register(Provider::OpenAI, child, sink).await;

        let event = tokio::time::timeout(std::time::Duration::from_secs(2), rx.recv())
            .await
            .expect("event within timeout")
            .expect("recv ok");

        match event {
            QaioEvent::ProviderLoginComplete {
                provider,
                cancelled,
            } => {
                assert_eq!(provider, "openai");
                assert!(!cancelled);
            }
            other => panic!("unexpected event: {other:?}"),
        }
    }

    #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
    async fn second_register_cancels_first() {
        let (sink, mut rx) = test_sink();

        let child1 = tokio::process::Command::new("sleep")
            .arg("60")
            .kill_on_drop(true)
            .spawn()
            .expect("spawn sleep");

        register(Provider::Gemini, child1, sink.clone()).await;
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;

        let child2 = tokio::process::Command::new("true")
            .kill_on_drop(true)
            .spawn()
            .expect("spawn true");

        register(Provider::Gemini, child2, sink).await;

        let mut got_cancelled = false;
        let mut got_natural = false;
        for _ in 0..2 {
            let event = tokio::time::timeout(std::time::Duration::from_secs(2), rx.recv())
                .await
                .expect("event within timeout")
                .expect("recv ok");
            match event {
                QaioEvent::ProviderLoginComplete { cancelled, .. } => {
                    if cancelled {
                        got_cancelled = true;
                    } else {
                        got_natural = true;
                    }
                }
                _ => {}
            }
        }
        assert!(got_cancelled, "first session should have been cancelled");
        assert!(got_natural, "second session should have exited naturally");
    }
}
