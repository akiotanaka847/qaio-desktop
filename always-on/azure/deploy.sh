#!/usr/bin/env bash
# Deploy the Qaio engine to Azure Container Apps.
#
# Builds the image in Azure Container Registry (no local Docker needed),
# then deploys main.bicep. Secrets are read from your environment and passed
# as secure params — nothing sensitive is written to disk or committed.
#
# Prerequisites:
#   - az CLI logged in (az login) with a subscription selected
#   - az extension add --name containerapp
#   - These env vars exported before running:
#       QAIO_ENGINE_TOKEN   (required)  openssl rand -hex 32
#       ANTHROPIC_API_KEY   (optional)  enables Claude
#       OPENAI_API_KEY      (optional)  enables Codex
#       KIMI_API_KEY        (optional)  enables Kimi
#       GEMINI_API_KEY      (optional)  enables Gemini/agy (headless auth
#                                       via this key is UNCONFIRMED)
#
# Usage:  always-on/azure/deploy.sh
set -euo pipefail

# ---- Tunables (override via env) -------------------------------------------
RG="${QAIO_RG:-qaio-rg}"
LOCATION="${QAIO_LOCATION:-eastus}"
ACR="${QAIO_ACR:-qaioacr$RANDOM}"   # must be globally unique; override to reuse
APP_NAME="${QAIO_APP_NAME:-qaio-engine}"
IMAGE_TAG="${QAIO_IMAGE_TAG:-latest}"
IMAGE_REPO="qaio/engine"

# ---- Preconditions ----------------------------------------------------------
: "${QAIO_ENGINE_TOKEN:?export QAIO_ENGINE_TOKEN (openssl rand -hex 32)}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo "==> Resource group $RG ($LOCATION)"
az group create -n "$RG" -l "$LOCATION" -o none

echo "==> Container registry $ACR"
az acr create -n "$ACR" -g "$RG" --sku Basic --admin-enabled true -o none
REGISTRY_SERVER="$(az acr show -n "$ACR" -g "$RG" --query loginServer -o tsv)"
REGISTRY_USER="$(az acr credential show -n "$ACR" -g "$RG" --query username -o tsv)"
REGISTRY_PASS="$(az acr credential show -n "$ACR" -g "$RG" --query 'passwords[0].value' -o tsv)"
IMAGE="$REGISTRY_SERVER/$IMAGE_REPO:$IMAGE_TAG"

echo "==> Building image in ACR (uses always-on/azure/Dockerfile, repo root context)"
az acr build -r "$ACR" -t "$IMAGE_REPO:$IMAGE_TAG" \
  -f always-on/azure/Dockerfile . -o none

echo "==> Deploying Container App $APP_NAME"
ENGINE_URL="$(az deployment group create \
  -g "$RG" \
  --template-file always-on/azure/main.bicep \
  --parameters \
    appName="$APP_NAME" \
    image="$IMAGE" \
    registryServer="$REGISTRY_SERVER" \
    registryUsername="$REGISTRY_USER" \
    registryPassword="$REGISTRY_PASS" \
    engineToken="$QAIO_ENGINE_TOKEN" \
    anthropicApiKey="${ANTHROPIC_API_KEY:-}" \
    openaiApiKey="${OPENAI_API_KEY:-}" \
    kimiApiKey="${KIMI_API_KEY:-}" \
    geminiApiKey="${GEMINI_API_KEY:-}" \
  --query 'properties.outputs.engineUrl.value' -o tsv)"

echo
echo "==> Deployed."
echo "    Engine URL : $ENGINE_URL"
echo "    Health     : curl -H \"Authorization: Bearer \$QAIO_ENGINE_TOKEN\" $ENGINE_URL/v1/health"
echo "    In the app : Settings -> Connect to remote engine"
echo "                 URL = $ENGINE_URL   Token = (your QAIO_ENGINE_TOKEN)"
