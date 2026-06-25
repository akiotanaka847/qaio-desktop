# Qaio Engine on Azure Container Apps

Run the Qaio engine headless on Azure so agents and routines keep working
with no laptop open. Your desktop and mobile apps connect to it remotely
over the same HTTP + WebSocket protocol — only the `baseUrl` changes.

> The Tauri **desktop app** is a native binary and does not run on Azure.
> What deploys here is the **engine** (`qaio-engine`), the standalone Rust
> server the app normally spawns locally.

## What's in this folder

| File | Purpose |
|---|---|
| `Dockerfile` | Engine build + the provider CLIs (claude, codex, kimi, agy). |
| `entrypoint.sh` | Materializes the kimi config from `KIMI_API_KEY` at start, then execs the engine. |
| `main.bicep` | Container Apps env, Azure Files storage, secrets, HTTPS+WS ingress. |
| `deploy.sh` | One-shot: ACR build + push, then deploy the Bicep. |

## Provider support on the server

| Provider | Headless on Azure? | What it needs |
|---|---|---|
| **Kimi** (Moonshot) | ✅ Yes | `KIMI_API_KEY` |
| **Claude** (Anthropic) | ✅ Yes | `ANTHROPIC_API_KEY` (paid API key from console.anthropic.com, **not** a Claude Pro subscription) |
| **Codex** (OpenAI) | ✅ Yes | `OPENAI_API_KEY` (platform key, **not** a ChatGPT subscription) |
| **Gemini** (agy) | ❌ No | Google OAuth via system keyring — cannot authenticate in a container. The binary is installed but the provider is effectively unavailable on the server. |

## Deploy

```bash
az login
az extension add --name containerapp

export QAIO_ENGINE_TOKEN="$(openssl rand -hex 32)"   # required
export ANTHROPIC_API_KEY="sk-ant-..."                # optional
export OPENAI_API_KEY="sk-..."                       # optional
export KIMI_API_KEY="sk-..."                         # optional

always-on/azure/deploy.sh
```

The script prints the engine's public HTTPS URL. Verify:

```bash
curl -H "Authorization: Bearer $QAIO_ENGINE_TOKEN" https://<fqdn>/v1/health
# {"status":"ok","version":"...","protocol":1}
```

## Connect the app

In Qaio → **Settings → Connect to remote engine**:

- **URL**: the `https://<fqdn>` from the deploy output
- **Token**: your `QAIO_ENGINE_TOKEN`

OS-native features (reveal in Finder, file pickers) stay disabled while
connected to a remote engine — they have no meaning server-side.

## Operational notes

- **Single replica, no scale-to-zero.** The engine holds session and
  WebSocket state in memory, so `main.bicep` pins `minReplicas: maxReplicas: 1`.
  Horizontal scaling would split session state; scale-to-zero would stop
  routines. Treat it as a stateful daemon, not a stateless web API.
- **Storage.** `/data` is an Azure Files share holding the SQLite DB and
  workspaces. SQLite over SMB can be slower than local disk and is sensitive
  to file locking; the single-replica constraint avoids concurrent writers,
  which keeps it safe. If you hit lock contention under heavy use, move to a
  VM with a local managed disk (see `../README.md`).
- **Secrets.** API keys and the bearer token are Container App secrets,
  injected as env vars at runtime. They are never baked into the image or
  committed. Rotate by re-running `deploy.sh` with new values.
- **Updating.** Re-run `deploy.sh`; it rebuilds the image and rolls the app.
  The engine refuses clients on a higher protocol major, so keep app and
  engine versions aligned.

## Cost (rough, East US)

Container Apps 1 vCPU / 2 GiB always-on ≈ a few USD/day, plus a few cents
for the Storage share and Log Analytics. The dominant cost is the AI
provider usage billed to your own API keys.

## Security

The engine is internet-exposed via the Container Apps ingress, gated only by
the bearer token, so treat `QAIO_ENGINE_TOKEN` like a root password:
generate it with `openssl rand -hex 32`, store it in a password manager, and
rotate it if it ever leaks. See the engine's auth model in
`../../knowledge-base/engine-server.md`.
