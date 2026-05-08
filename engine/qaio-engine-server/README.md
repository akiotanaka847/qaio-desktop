# qaio-engine-server

`axum` HTTP + WebSocket server that speaks the Qaio wire protocol
(`engine/qaio-engine-protocol`). Ships the `qaio-engine` binary.

Every client — the Qaio desktop app, Qaio Mobile, third-party
integrations — talks to this binary. Locally it's a subprocess on
`127.0.0.1`. Remotely it's deployed to a VPS via `always-on/` (Docker or
systemd).

## Run locally

```bash
cargo run -p qaio-engine-server --bin qaio-engine
# QAIO_ENGINE_LISTENING port=53871 token=<long-random>
```

Then:

```bash
curl -H "Authorization: Bearer <token>" http://127.0.0.1:53871/v1/health
```

## Environment

See [`knowledge-base/engine-server.md`](../../knowledge-base/engine-server.md)
for the full operator guide (env vars, startup handshake, supervision,
deployment).

## Structure

| File | Purpose |
|---|---|
| `src/main.rs` | Binary entry — init tracing, parse config, bind listener, emit banner, `axum::serve`. |
| `src/lib.rs` | `build_router(state)` composes middleware + versioned routes. |
| `src/config.rs` | `ServerConfig` — env parsing + token generation. |
| `src/state.rs` | `ServerState` — config, `BroadcastEventSink`, `EngineState`. |
| `src/auth.rs` | Bearer middleware (header, query, subprotocol). |
| `src/routes/` | REST handlers. `error.rs` maps `CoreError` → `ErrorBody`. |
| `src/ws.rs` | `/v1/ws` — forwards broadcast events, heartbeats, handles lag. |
| `tests/` | In-process integration tests (HTTP + WS). |
