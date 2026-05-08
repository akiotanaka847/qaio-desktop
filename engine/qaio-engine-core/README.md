# qaio-engine-core

Transport-neutral runtime container and domain logic for the Qaio
Engine. Owns `EngineState` (paths, event sinks) and hosts the feature
modules that REST routes, CLI tools, tests, and the Tauri adapter all
consume.

Think of this crate as "what the server does" minus the HTTP wrapper.

## Modules

| Module | Purpose |
|---|---|
| `state` | `EngineState`, `SharedEngineState` (`Arc`) |
| `paths` | `EnginePaths` — docs + home dir resolution |
| `error` | `CoreError` with HTTP-ready `ErrorCode` mapping |
| `workspaces` | Workspace CRUD (first slice migrated from the Tauri adapter) |

Further slices (agents, conversations, sessions, skills, provider/prefs,
store, routines, composio, sync) migrate here during Phase 2 of the
engine rollout. Each slice lands as a pure function module plus tests.
The `qaio-engine-server` crate wraps them in REST handlers; the Tauri
adapter can call them directly during the transition.

## Dependencies

- `qaio-db` — persistent state.
- `qaio-ui-events` — `EventSink` trait + event enum.
- `qaio-agent-files` — `.qaio/` filesystem helpers.
- `qaio-engine-protocol` — shared error codes.
