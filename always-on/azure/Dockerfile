# Qaio Engine — Azure Container Apps image.
#
# Extends the base `always-on/Dockerfile` engine build with the provider
# CLIs the engine spawns at runtime (claude, codex, kimi, agy). Provider
# credentials are NOT baked in — they arrive as env vars / secrets at
# container start (see entrypoint.sh and main.bicep).
#
# Build from the REPO ROOT so the Rust build context sees Cargo.toml:
#   docker build -t qaio/engine-azure -f always-on/azure/Dockerfile .

# ---------- Build stage: compile the engine ----------
FROM rust:1-slim-bookworm AS build
WORKDIR /src
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY Cargo.toml Cargo.lock ./
COPY engine/ engine/
RUN cargo build --release -p qaio-engine-server --bin qaio-engine

# ---------- Runtime stage: engine + provider CLIs ----------
FROM debian:bookworm-slim

# Base tooling: curl/bash for the kimi+agy installers, git for skill repos,
# ca-certificates for TLS, plus Node.js (claude-code and codex ship as npm
# packages).
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl bash git \
 && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/*

# Claude Code + Codex — installed globally so they land on /usr/local/bin
# (which the engine's PATH resolver already searches). They authenticate
# headlessly from ANTHROPIC_API_KEY / OPENAI_API_KEY env vars.
RUN npm install -g @anthropic-ai/claude-code @openai/codex

# Non-root runtime user. HOME lives in the IMAGE (/home/qaio) so the
# per-user CLIs installed below survive — the Azure Files volume mounts at
# /data (engine DB + workspaces) and would otherwise shadow anything we put
# there at build time.
RUN useradd --system --create-home --home-dir /home/qaio qaio
USER qaio
WORKDIR /home/qaio
ENV HOME=/home/qaio

# Kimi (Moonshot) — pure API-key auth, works headless. Installs to
# ~/.kimi-code/bin/kimi; its config.toml (with the key) is written by the
# entrypoint at start, not baked into the image.
RUN curl -fsSL https://code.kimi.com/kimi-code/install.sh | bash || \
    echo "WARN: kimi install failed; KIMI_API_KEY provider will be unavailable"

# Antigravity (Google) — installed best-effort. NOTE: agy uses Google OAuth
# via the system keyring and CANNOT authenticate headlessly, so it is
# effectively unavailable in a container. Present only so the binary exists
# if Google ever ships an API-key path.
RUN curl -fsSL https://antigravity.google/install.sh | bash || \
    echo "WARN: agy install failed or unsupported; Gemini provider unavailable headless"

COPY --from=build /src/target/release/qaio-engine /usr/local/bin/qaio-engine
COPY --chown=qaio:qaio always-on/azure/entrypoint.sh /usr/local/bin/entrypoint.sh

# Engine binds all interfaces inside the container; Container Apps ingress
# terminates TLS in front of it.
# Data dirs point at the mounted volume (/data); CLI paths point at HOME
# (/home/qaio) inside the image.
ENV QAIO_HOME=/data/.qaio \
    QAIO_DOCS=/data/Qaio \
    QAIO_BIND=0.0.0.0:7777 \
    QAIO_BIND_ALL=1 \
    PATH=/home/qaio/.kimi-code/bin:/home/qaio/.local/bin:/usr/local/bin:/usr/bin:/bin

EXPOSE 7777
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
