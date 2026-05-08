# Contributing to Qaio

Thanks for your interest in contributing to Qaio!

## Getting Started

```bash
git clone https://github.com/getqaio/qaio.git
cd qaio
pnpm install
cargo check --workspace
```

## Development

```bash
# Run the Qaio app
cd app && pnpm tauri dev

# Run the showcase
cd showcase && pnpm dev

# TypeScript check
pnpm typecheck

# Rust check
cargo check --workspace

# Rust tests
cargo test --workspace
```

## Structure

- `ui/` — React packages (@qaio-ai/*)
- `engine/` — Rust crates (qaio-*) — frontend-agnostic backend
- `app/` — Qaio App (Tauri desktop)
- `mobile/` — Qaio Mobile companion
- `desktop-mobile-bridge/` — Cloudflare Worker pairing App + Mobile
- `store/` — Qaio Store (agent registry)
- `website/` — getqaio.ai landing
- `always-on/` · `teams/` · `cloud/` — future hosted products (placeholders)

## Pull Requests

1. Create a feature branch from `main`
2. Make your changes
3. Run `pnpm typecheck` and `cargo check --workspace`
4. Open a PR to `main`

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation
- `chore:` — Maintenance
- `refactor:` — Code restructuring

## Code Style

- 200 line file limit (excluding tests)
- No hover-only affordances
- Props over stores in library packages
- No `@/` path aliases in packages
