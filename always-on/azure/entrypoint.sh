#!/usr/bin/env bash
# Container entrypoint for the Qaio engine on Azure.
#
# Translates runtime secrets (injected as env vars by Container Apps) into
# the on-disk formats each provider CLI expects, then execs the engine.
# Secrets are never echoed.
set -euo pipefail

# Kimi (Moonshot) reads ~/.kimi-code/config.toml. claude and codex read
# ANTHROPIC_API_KEY / OPENAI_API_KEY straight from the environment, so they
# need no file here.
if [[ -n "${KIMI_API_KEY:-}" ]]; then
  mkdir -p "$HOME/.kimi-code"
  # Only write if absent or the key changed, so a mounted volume that
  # already holds a hand-tuned config is left alone.
  cat > "$HOME/.kimi-code/config.toml" <<EOF
default_model = "moonshot-v1-auto"
default_thinking = false
telemetry = false

[providers.moonshot]
type = "openai"
api_key = "${KIMI_API_KEY}"
base_url = "${KIMI_BASE_URL:-https://api.moonshot.ai/v1}"

[models.moonshot-v1-auto]
provider = "moonshot"
model = "moonshot-v1-auto"
max_context_size = 128000
EOF
  chmod 600 "$HOME/.kimi-code/config.toml"
  echo "[entrypoint] kimi config written"
fi

if [[ -z "${QAIO_ENGINE_TOKEN:-}" ]]; then
  echo "[entrypoint] FATAL: QAIO_ENGINE_TOKEN is required" >&2
  exit 1
fi

# The Azure Files volume mounts empty at /data; create the engine's data
# dirs before it starts. CLIs live in $HOME (image), not here.
mkdir -p "${QAIO_HOME:-/data/.qaio}" "${QAIO_DOCS:-/data/Qaio}"

echo "[entrypoint] starting qaio-engine on ${QAIO_BIND:-0.0.0.0:7777}"
exec /usr/local/bin/qaio-engine
