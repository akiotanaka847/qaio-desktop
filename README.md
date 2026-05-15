<p align="center">
  <a href="https://getqaio.ai">
    <strong>Qaio</strong>
  </a>
</p>

<p align="center">
  <strong>The open source platform for AI-native products.</strong><br>
  One desktop app. Pre-built AI agents that work from day one.<br>
  Real tools. 1000+ integrations. Free.
</p>


<p align="center">
  <a href="https://github.com/getqaio/qaio/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-0d0d0d" alt="MIT License"></a>
  <a href="https://github.com/getqaio/qaio/stargazers"><img src="https://img.shields.io/github/stars/getqaio/qaio?color=0d0d0d" alt="Stars"></a>
</p>

---

## What Qaio is

**For everyone** — a free desktop app with AI agents that do real work. Bookkeeping, outreach, research, scheduling. Install agents from the store and start working. No terminal. No prompt engineering.

**For founders** — the platform where you build AI-native products for your customers. Define your agents, Qaio handles the workspace, the chat, the board, the integrations. You bring the domain expertise. [Read more](https://getqaio.ai/startups/).

> **Read the vision:** [Ship the impossible](https://getqaio.ai/vision/)

---

## Quick start

### Run the Qaio app

```bash
git clone https://github.com/getqaio/qaio.git
cd qaio
pnpm install
cd app && pnpm tauri dev
```

### Build your first agent

Create two files:

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

Push to GitHub. In Qaio, click **New Agent > GitHub**, paste your repo URL. Done.

The [Learn guide](https://getqaio.ai/learn/) covers the full details in five short chapters.

### Share a workspace template

Bundle multiple agents into one repo:

```
my-workspace/
├── workspace.json
└── agents/
    ├── bookkeeper/
    │   ├── qaio.json
    │   └── CLAUDE.md
    └── tax-reviewer/
        ├── qaio.json
        └── CLAUDE.md
```

**workspace.json**
```json
{
  "name": "Tax Practice",
  "description": "A complete workspace for tax professionals.",
  "agents": ["bookkeeper", "tax-reviewer"]
}
```

In Qaio, click **New Workspace > Import from GitHub**, paste the repo URL. Qaio creates the workspace with all agents ready to use.

---

## How the app works

Qaio organizes work into **Workspaces** and **Agents**:

- **Workspace** — a group of agents (like a team or project).
- **Agent** — an AI agent instance. Chat, kanban board, skills, files, integrations.
- **Agent Definition** — a `qaio.json` that defines what an agent looks like and does.

```
Workspace ("Tax Practice")
  ├── Agent ("Bookkeeper")         ← board, files, instructions
  ├── Agent ("Document Reviewer")  ← board, files, integrations
  └── Agent ("Client Comms")       ← board, files, integrations
```

Each kanban card is a Claude conversation. Click a card to see the full chat. Connect Slack and the same conversation becomes a thread.

---

## Agent definitions

Three tiers:

| Tier | What you write | What you get |
|------|---------------|-------------|
| **JSON-only** | `qaio.json` + `CLAUDE.md` | Tabs, prompt, icon. Uses built-in components. |
| **Custom React** | Add `bundle.js` | Custom React components as tabs. |
| **Workspace template** | `workspace.json` + agents folder | Multiple agents, one import. |

**Built-in tab types:** `board`, `files`, `job-description`, `integrations`, `routines`, `configure`, `events`

---

## Monorepo layout

Organized as **6 end-user products + 3 code libraries**.

```
qaio/
├── app/                     Qaio App — desktop (Tauri 2)
│   ├── src/                 React frontend
│   ├── src-tauri/           Tauri binary
│   └── qaio-tauri/       Tauri adapter (applies Engine to desktop)
├── mobile/                  Qaio Mobile companion
├── desktop-mobile-bridge/   Cloudflare Worker — pairs Desktop ↔ Mobile
├── store/                   Qaio Store — agent registry
├── website/                 Qaio Website — getqaio.ai
├── always-on/               Qaio Always On — VPS deploy (Dockerfile + compose + systemd)
├── teams/                   Qaio Teams (TBD — hosted multi-tenant)
│
├── ui/                      Qaio UI — @qaio-ai/* React packages
├── engine/                  Qaio Engine — Rust crates (frontend-agnostic)
├── cloud/                   Qaio Cloud (TBD — managed Engine hosting)
│
└── examples/                Reference consumers of qaio-engine
    └── smartbooks/            Bookkeeping app built on a custom React frontend
```

See `knowledge-base/architecture.md` for crate-level detail + current gaps.

---

## Build on Qaio Engine (custom frontends)

The engine is frontend-agnostic. You don't have to ship inside the
Qaio App — any web or native runtime can drive it over HTTP +
WebSocket using [`@qaio-ai/engine-client`](ui/engine-client/).

**Working example: [SmartBooks](examples/smartbooks/)** — a
bookkeeping product with its own brand, its own UX, and zero
`@qaio-ai/*` UI deps. ~400 lines of TSX, one npm package, renders
a live transactions table + a multi-sheet Excel workpaper. Soft
workflow: the user asks for a new column, Claude edits the Python
script, every future upload picks up the change. Clone it, rename
things, ship your own AI-native product.

```bash
cd examples/smartbooks
pnpm install
pnpm dev
```

Full walkthrough + architecture diagram + custom-frontend gotchas in
[examples/smartbooks/README.md](examples/smartbooks/README.md).

---


## Contributing

Qaio is open source under MIT. Issues and PRs welcome.

---

## License

MIT
