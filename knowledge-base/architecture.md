# Architecture

Qaio = open platform. Organized as **6 products + 3 code libraries**.

## The 6 products (end-user)

| Product | Dir | What |
|---------|-----|------|
| Qaio App | `app/` | Desktop app (Tauri 2). Non-technical users create agents, run parallel terminal sessions. |
| Qaio Mobile | `mobile/` | React PWA served from `tunnel.getqaio.ai`. No native app — pure web, same origin as the relay. |
| Qaio Store | `store/` | Release-bundled registry of pre-built Qaio agents. One-click install. |
| Qaio Website | `website/` | getqaio.ai landing. |
| Qaio Always On | `always-on/` | One-click deploy Engine to VPS/microVM. Agents 24/7. **TBD.** |
| Qaio Teams | `teams/` | Hosted multi-tenant agent pool w/ perms. **TBD.** |

## The 3 code libraries

| Library | Dir | What | Consumers |
|---------|-----|------|-----------|
| Qaio UI | `ui/` | `@qaio-ai/*` React components | App, Mobile, future hosted products' frontends |
| Qaio Engine | `engine/` | Rust crates. **Frontend-agnostic backend.** Open source. Anyone self-hosts or uses as desktop-app backend. | App (via `app/qaio-tauri` adapter), Always On, Teams, Cloud customers |
| Qaio Cloud | `cloud/` | Managed Engine deployments. **TBD.** | Third-party devs building on Engine |

## Key distinction: Engine is standalone

**Qaio Engine is the reusable backend.** Devs run it themselves (open source) or rent it via Cloud. Devs put ANY frontend on top — Qaio App is just ONE consumer.

- Engine stays pure Rust, no Tauri, no React, no webview assumption
- `app/qaio-tauri/` is the **adapter** that applies Engine to the Tauri desktop frontend. Lives under `app/`, not `engine/`.
- Future Always On + Teams consume Engine over network (HTTP/WS — **not yet built**)

## Infra dirs (not products)

| Dir | What |
|-----|------|
| `qaio-relay/` | Cloudflare Worker + Durable Object at `tunnel.getqaio.ai`. Reverse-tunnel proxy (desktop engine dials outbound; mobile traffic multiplexes over that link) AND static host for the mobile PWA. One origin for both so Safari sees first-party traffic. Deploys separately. |
| `examples/` | Reference consumers of `qaio-engine` for third-party devs. First entry: `examples/smartbooks/` — a custom React frontend, own brand, zero `@qaio-ai/*` UI deps. Lives in the monorepo (not a separate repo) so it stays in sync with protocol changes. |
| `knowledge-base/` | These caveman docs. Loaded on demand. |
| `scripts/` | Version bump, release, CLI binary fetch. |

## Engine crates (`engine/`)

15 crates. All pure libraries. No frontend assumptions. Full list in
the workspace root `Cargo.toml`.

- `qaio-db` — libSQL. `chat_feed`, `preferences`, `engine_tokens` tables.
- `qaio-terminal-manager` — Claude/Codex subprocess manager, parser, streaming
- `qaio-events` — hook/webhook/lifecycle queue
- `qaio-scheduler` — cron + heartbeat
- `qaio-agent-files` — `.qaio/` file I/O, schemas, migration
- `qaio-agents-conversations` — chat feed persistence
- `qaio-ui-events` — typed event bus + `EventSink` trait (Tauri/broadcast impls, frontend-neutral)
- `qaio-file-watcher` — `notify` on `.qaio/`, emits events
- `qaio-composio` — Composio CLI lifecycle (bundle-aware: skips install when shipped inside the .app)
- `qaio-cli-bundle` — resolve bundled CLI binaries (codex universal, composio per-arch) inside the `.app`/MSI; reads pinned `cli-deps.json` manifest
- `qaio-claude-installer` — runtime download of Claude Code CLI (proprietary license, can't bundle); pinned URL + sha256 verification, atomic install, progress events
- `qaio-tunnel` — outbound reverse tunnel client; desktop engine dials the relay so mobile can reach it through NAT. Heartbeat + watchdog; tunnel identity stays stable across normal network failures and only re-allocates on relay auth rejection.
- `qaio-skills` — skill discovery + management
- `qaio-engine-core` — runtime container (`EngineState`, paths, `workspaces::*`, `agents::{activity,routines,routine_runs,config,conversations,files,prompt,self_improvement}`, `sessions::{history,provider,summarize}`, `routines::{runner,runs,scheduler,engine_dispatcher}`, `store`, `sync`, `worktree`, `provider`, `attachments`, `preferences`, `conversations`, `skills`, `agent_configs`). Domain logic relocated from the Tauri adapter.
- `qaio-engine-protocol` — wire types (REST DTOs, WS envelope, error codes, `PROTOCOL_VERSION`). Matches `ui/engine-client/src/types.ts`.
- `qaio-engine-server` — axum HTTP+WS binary `qaio-engine`. The process every client talks to. Full REST surface live — 17 route modules covering workspaces, agents CRUD, sessions, agent data + files, routines + scheduler, skills, store, composio, claude (runtime install), tunnel + pairing, worktrees, shell, attachments, preferences, providers, agent-configs, conversations, watcher. See `knowledge-base/engine-protocol.md` for the complete table.

**Bundled provider CLIs:** Qaio ships the codex CLI (Apache-2.0) and
composio CLI (MIT) inside the signed/notarized `.app` so non-technical
users get them preinstalled. The proprietary Claude Code CLI is
downloaded on first launch with sha256 verification. Resolution + install
flow detailed in `knowledge-base/cli-bundling.md`.

**Standalone engine, shipped:** the desktop app spawns `qaio-engine`
as a subprocess on startup (sidecar via Tauri `externalBin`), parses
the stdout `QAIO_ENGINE_LISTENING` banner for `{port, token}`, and
talks to it over HTTP+WS — the same way a remote client on a VPS
would. The supervisor (`app/src-tauri/src/engine_supervisor.rs`) pipes
stdin so engine sees EOF on parent death and exits cleanly (no orphan
engines holding ports). All domain Tauri commands are deleted — only
OS-native glue remains in `app/src-tauri/src/commands/`.

## App-side Rust (`app/`)

- `app/qaio-tauri/` — Tauri adapter. Binds engine crates (db, event
  queue, schedulers, watcher) to Tauri state and emits Tauri events.
  The engine supervisor uses the same crates but speaks HTTP/WS
  externally. **Not part of Engine.**
- `app/src-tauri/` — Tauri binary. Depends on `qaio-tauri` + engine
  crates. Spawns the engine subprocess in `setup()`, waits for
  `/v1/health`, injects `window.__QAIO_ENGINE__` handshake before
  the React tree mounts (see `EngineGate` in `app/src/main.tsx`).

## UI packages (`ui/`)

11 packages under `@qaio-ai/`: `core, chat, board, layout, events,
routines, skills, review, agent, agent-schemas, engine-client`.

Mostly internal. `@qaio-ai/engine-client` is the one package we
expect third-party devs to install — it's the TypeScript front door to
the engine HTTP+WS protocol. `@qaio-ai/agent-schemas` ships the
JSON schemas that Rust embeds via `include_str!` — source of truth for
the typed `.qaio/<type>/<type>.json` layout.

## Current gap to vision

| Goal | Status |
|------|--------|
| Clear product dirs | ✅ done |
| App ↔ Engine clear boundary | ✅ `app/qaio-tauri` split |
| UI standalone | ✅ |
| Engine reusable by non-Tauri frontends | ✅ binary ships as Tauri sidecar + standalone; desktop app consumes it over HTTP/WS, no in-process coupling |
| Reference custom-frontend integration | ✅ `examples/smartbooks/` — Vite + React, own brand, ~400 LOC TSX, proven end-to-end |
| Always On | ✅ Dockerfile + compose + systemd unit + README all shipped |
| Teams / Cloud | 🟡 Identity foundation shipped (Supabase Google SSO + Keychain sessions — see `knowledge-base/auth.md`); Cloud API surface TBD |
| Store populated | 🟡 release-bundled MVP: `store/catalog.json` + `store/agents/*`; community sharing TBD |
| Binary file read route (xlsx, pdf download through HTTP) | ❌ workaround: use `/v1/shell` with `open`/`xdg-open` to hand binary files to host OS |
| Windows support (Rust engine layer) | ✅ `cargo check --target x86_64-pc-windows-gnu` clean across the workspace; platform-specific branches (taskkill vs kill, PATH separator, symlink_dir) covered. See `knowledge-base/platform-matrix.md`. |

## Direction of work
- **library-first** — new reusable capability → ui/ or engine/, then consumed by app/
- **app-first** — feature needed in app/, extract to library when reuse appears
- **single-layer** — only one area touched

Not sure? Start in app/. Extract later.
