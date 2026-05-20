<p align="center">
  <img src="https://getqaio.ai/icon.png" width="80" alt="Qaio" />
</p>

<h1 align="center">Qaio</h1>

<p align="center">
  AI agents that actually do the work.<br>
  Not another chatbot. A desktop app where agents use real tools, real integrations, and real files.
</p>

<p align="center">
  <a href="https://getqaio.ai">Website</a> &middot;
  <a href="https://getqaio.ai/learn">Learn</a> &middot;
  <a href="https://github.com/getqaio/qaio/issues">Issues</a>
</p>

---

## Why Qaio exists

Most AI tools give you a chat box and call it a day. Qaio gives each agent a full workspace: kanban boards, file management, integrations with 1000+ services through Composio, and the ability to run code. Every kanban card is a conversation. Every conversation can use tools.

The app ships with 10 pre-built agents (bookkeeping, sales, marketing, legal, support, operations, people, outbound, Fusion Manager, Workfront Intake) so you can start working immediately. Build your own in under 5 minutes with two files.

**Three providers, your choice:** Claude (Anthropic), Codex (OpenAI), or Gemini (Google). Switch per-conversation.

## Get started

```bash
git clone https://github.com/getqaio/qaio.git
cd qaio
pnpm install
cd app && pnpm tauri dev
```

Requires: Node 20+, Rust 1.75+, pnpm 9+. See the [Learn guide](https://getqaio.ai/learn) for platform-specific setup.

## Build an agent

Two files. That's it.

**qaio.json**
```json
{
  "id": "bookkeeper",
  "name": "Bookkeeper",
  "description": "Categorize expenses and reconcile accounts.",
  "icon": "Calculator",
  "category": "business",
  "tabs": [
    { "id": "board", "label": "Tasks", "builtIn": "board", "badge": "activity" },
    { "id": "files", "label": "Files", "builtIn": "files" },
    { "id": "job-description", "label": "Instructions", "builtIn": "job-description" }
  ]
}
```

**CLAUDE.md**
```markdown
# Bookkeeper
You categorize transactions, reconcile accounts, and flag anomalies.
Ask which period the user wants before starting.
```

Push to GitHub. In Qaio, click **New Agent > GitHub**, paste the URL. Done.

### Workspace templates

Bundle multiple agents into one repo for team setups:

```
my-workspace/
  workspace.json
  agents/
    bookkeeper/  { qaio.json, CLAUDE.md }
    tax-reviewer/  { qaio.json, CLAUDE.md }
```

Import the whole workspace in one click.

---

## Architecture

Qaio is three layers that work together or independently.

```
                 ┌─────────────────────────────┐
                 │        Qaio App              │
                 │   Tauri 2 + React frontend   │
                 │   macOS / Windows            │
                 └──────────┬──────────────────┘
                            │ HTTP + WebSocket
                 ┌──────────▼──────────────────┐
                 │       Qaio Engine            │
                 │   Rust binary, 16 crates     │
                 │   Sessions, agents, files,   │
                 │   skills, AI providers       │
                 └──────────┬──────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                  ▼
     Claude API       Codex CLI         Gemini CLI
     (Anthropic)      (OpenAI)          (Google)
```

**Engine** is a standalone Rust binary (`qaio-engine`). It handles sessions, agents, file watching, skill execution, integrations, and AI provider calls over HTTP + WebSocket. Any frontend can drive it.

**UI** is 11 React packages (`@qaio-ai/chat`, `@qaio-ai/board`, `@qaio-ai/layout`, etc.) connected via `@qaio-ai/engine-client`. Props-only, no store imports, no framework lock-in.

**App** is the Tauri 2 shell that spawns the engine as a sidecar and wires up the UI.

### Monorepo layout

```
qaio/
  app/               Desktop app (Tauri 2 + React)
  engine/            Rust runtime (16 crates, frontend-agnostic)
  ui/                @qaio-ai/* React packages (11 packages)
  store/             Pre-built agent catalog
  examples/
    smartbooks/      Custom frontend built on qaio-engine
```

### Build your own product on the engine

You don't need the Qaio app. The engine is frontend-agnostic. See **[SmartBooks](examples/smartbooks/)** for a working example: a bookkeeping product with its own brand, its own UX, zero `@qaio-ai/*` UI dependencies. ~400 lines of TSX.

```bash
cd examples/smartbooks && pnpm install && pnpm dev
```

---

## Pre-built agents

| Agent | What it does |
|-------|-------------|
| **Bookkeeping** | Categorize transactions, reconcile accounts, close the books |
| **Sales** | Find leads, research accounts, prep calls, draft outreach |
| **Marketing** | Build positioning, plan campaigns, write content |
| **Legal** | Review contracts, audit compliance, prep filings |
| **Support** | Triage tickets, draft replies, write help-center articles |
| **Operations** | Triage inbox, prep meetings, track goals |
| **People** | Source candidates, coordinate interviews |
| **Outbound** | Turn a LinkedIn post into a cold email campaign |
| **Fusion Manager** | Document, diagnose, and manage Adobe Workfront Fusion scenarios with flow diagrams and blueprint analysis |
| **Workfront Intake** | Convert team messages into Workfront tickets via Fusion, auto-detecting request type and fields |

All agents are open source. Fork them, customize them, or use them as starting points.

---

## Agent definition tiers

| Tier | You write | You get |
|------|-----------|---------|
| **JSON-only** | `qaio.json` + `CLAUDE.md` | Full agent with built-in tabs |
| **Custom React** | Add a `bundle.js` | Your own React components as tabs |
| **Workspace** | `workspace.json` + agents/ | Multiple agents, one import |

Built-in tabs: `board`, `files`, `job-description`, `knowledge-base`, `integrations`, `routines`, `configure`, `events`

---

## Contributing

Issues and PRs welcome. Architecture docs live in [`knowledge-base/`](knowledge-base/).

## License

MIT
