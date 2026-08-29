# Blast Radius — setup from a clean clone

Everything needed to get the demo running on a machine that has never seen this
project. Written against a Windows + Docker Desktop run; the commands are
`cmd.exe`, and the notes call out where macOS/Linux differ.

Two stacks run side by side:

| Stack | What it is | Ports |
|---|---|---|
| **Blast Radius** (this repo) | Postgres holding the subject data, plus the subject-data MCP server | pg `55432`, mcp `8081` |
| **TrueForge** (separate repo) | The agent harness — runs the agent, owns the approval gate | ui `8791`, pg `5433`, redis `6380` |

They are deliberately on different ports; see *Ports* below for why.

## Prerequisites

- Docker Desktop, running
- Node 22.14+
- Git
- An API key for a model provider (see *Model providers*)
- A Daytona account for the sandbox (free tier) — https://app.daytona.io

## Part 1 — the Blast Radius stack

```
git clone https://github.com/AdityaGaur77/Agent-harness-26
cd Agent-harness-26
git checkout Aditya
```

Create `.env` in the repo root:

```
MCP_AUTH_TOKEN=dev-token
POSTGRES_HOST_PORT=55432
MCP_HOST_PORT=8081
```

`MCP_AUTH_TOKEN` is a shared secret with two readers: the MCP server checks it
on every request, and the TrueForge connector sends it as a bearer header.
Change it in one place only and every tool call returns 401.

Boot it:

```
docker compose up -d --build
docker compose ps
```

All three services must be `Up`, with `postgres` `(healthy)`.

Verify — this is the gate on everything downstream:

```
cd packages\mcp-subject-data
npm install
set MCP_AUTH_TOKEN=dev-token
set POSTGRES_HOST_PORT=55432
set MCP_URL=http://127.0.0.1:8081
node scripts\smoke.mjs
```

Expect **31 passed, 0 failed**.

> `.env` is read by Docker Compose **only**. Node does not read it, so the
> `set` lines are required. Without them the suite falls back to port 5432 and
> may connect to a *different* Postgres on your machine, which surfaces as
> `password authentication failed` rather than anything about ports.

## Part 2 — TrueForge

TrueForge is self-hosted; there is no website to log into. You run it, and it
serves a UI on localhost.

**Standalone mode (`npx @truefoundry/trueforge`) does not work on Windows** —
a fatal ESM path bug, and its local sandbox provider is macOS/Linux only, so
skills cannot load. Use Docker.

```
cd ..
git clone https://github.com/AdityaGaur77/adityas---trueforge
cd adityas---trueforge
copy packages\trueforge\.env.example packages\trueforge\.env
```

Edit `packages\trueforge\.env` and **uncomment** this line:

```
HOST=0.0.0.0
```

Without it the server binds to `localhost` *inside* its container, Docker
cannot forward the published port, and the healthcheck fails. Everything else
in that file can stay at its defaults.

```
docker compose up -d --build
docker compose ps
```

First build takes several minutes. Wait for `server` to read `(healthy)`, then
open **http://localhost:8791**.

## Part 3 — configure providers in the UI

Order matters; each step gates the next.

**1. Model provider.** See *Model providers* below.

**2. Sandbox provider.** Configure Daytona. This is not optional: an agent spec
with `sandbox.enabled` or any skill is *rejected at session creation* without
a configured sandbox provider, and this agent has both.

**3. Skill.** Register a skill named exactly `gdpr-erasure`, with the contents
of `skills/gdpr-erasure/SKILL.md` from this repo.

## Part 4 — provision the agent

```
cd ..\Agent-harness-26\packages\agent
npm install

set TRUEFORGE_BASE_URL=http://localhost:8791
set TRUEFORGE_TOKEN=local-dev
set MODEL_NAME=<provider>/<model>
set MCP_AUTH_TOKEN=dev-token
set MCP_SERVER_URL=http://host.docker.internal:8081/mcp

npm run provision
```

Two that are easy to get wrong:

- **`MCP_SERVER_URL` uses `host.docker.internal`**, not `localhost`. TrueForge
  runs in a container, where `localhost` means itself. `host.docker.internal`
  reaches your machine, which forwards 8081 to the MCP server.
- **`TRUEFORGE_BASE_URL` uses `localhost`**, because the provisioning script
  runs on your machine, not in a container.

`TRUEFORGE_TOKEN` can be any placeholder when OIDC is unconfigured — the server
logs `Auth is disabled; browser login is off` — but the script requires the
variable to exist.

The script prints the approval gate last. **Confirm `execute_deletion` is
listed as gated and nothing else is.** A wrong gate does not throw; it quietly
lets the irreversible write run unattended.

## Part 5 — run the demo

Re-seed first. The smoke suite genuinely executes a deletion, so customer 4471
is already erased after Part 1:

```
cd ..\..
docker compose exec -T postgres psql -U blast -d blast_main < packages\mcp-subject-data\scripts\fixture.sql
docker compose exec -T postgres psql -U blast -d blast_main -c "SELECT COUNT(*) FROM orders WHERE customer_id=4471;"
```

Expect **12**.

In the UI, start a session with the `blast-radius` agent:

```
delete everything we hold for customer 4471
```

Expected sequence: discover → `snapshot_to_shadow` → `rehearse_deletion`
(naive) → reports the cascade into retained rows and `would_be_illegal: true`
→ rewrites the plan → rehearses clean → **stops for Allow/Deny**.

Click **Deny** first — it should revise rather than give up. Then **Allow**.

## Model providers

TrueForge supports these natively:

```
openai · anthropic · google-gemini · fireworks · zai · moonshot · alibaba · together
```

`MODEL_NAME` is always `provider/model`, fully qualified. A bare model name is
rejected with a 422.

### OpenAI-compatible endpoints (OpenRouter and similar)

Add a **custom** provider:

| Field | Value |
|---|---|
| Provider name | `openrouter` |
| Base URL | `https://openrouter.ai/api/v1` |
| API key | your key |

Then add models under it:

| Field | Notes |
|---|---|
| Model name | Your label. **Keep it slash-free** — `MODEL_NAME` parses as `provider/model`. |
| Model ID | The upstream id, e.g. `z-ai/glm-5.2:free`. Slashes are fine here. |
| Context length | From the provider's model page |
| **Max output tokens** | **Required.** See below. |

Base URL and API key live on the *provider*; models nest inside it.

> **Always set max output tokens on a custom model.** TrueForge knows the
> limits of its built-in providers but nothing about a custom one, so leaving
> it blank produces a request for a ~10,000,000-token completion that every
> upstream rejects — and the error reads as though your prompt were enormous
> when the input was ~4K. `32000` is a safe value.

### Choosing a model

This agent is demanding: 7 tools, a 5-phase procedure it must not shortcut, a
conflict it has to notice and resolve, and (by default) dynamic subagents.
Small or fast-tier models tend to skip phases.

Free tiers meter requests per minute *and* per day, and one session makes
dozens of calls. Expect `429`s. To reduce calls while testing, set in
`packages/agent/agent.manifest.json`:

```json
"dynamicSubAgents": { "enabled": false },
"iterationLimit": 20
```

Re-provision after editing. Revert both before recording — the parallel
fan-out is a headline feature.

## Ports

Defaults are deliberately unusual, because the obvious ones collide:

| Port | Why not the default |
|---|---|
| pg `55432` | `5432` is taken by any local Postgres install |
| mcp `8081` | `8080` is taken by **Docker Desktop itself** (`com.docker.backend.exe`) |

Both are parameterised in `.env`. If `8081` or `55432` are also busy, change
them there — `scripts/smoke.mjs` follows `POSTGRES_HOST_PORT` automatically.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `port is already allocated` | Change `POSTGRES_HOST_PORT` / `MCP_HOST_PORT` in `.env`, then `docker compose up -d --force-recreate` |
| `password authentication failed for user "blast"` | You reached a different Postgres. Set `POSTGRES_HOST_PORT` in the shell, not just `.env` |
| MCP container `Up` but PORTS shows bare `8080/tcp` | Container kept a stale config. `docker compose up -d --force-recreate mcp-server` |
| TrueForge `server` `(unhealthy)` | `HOST=0.0.0.0` not uncommented in `packages/trueforge/.env` |
| `Model name must be a fully qualified "provider/model"` | Missing provider prefix on `MODEL_NAME` |
| `maximum context length ... 10000000 in the output` | `maxOutputTokens` unset on a custom model |
| `429` | Provider rate limit. Switch model or add credit |
| Agent session rejected at creation | No sandbox provider configured |
| Connector lists no tools | TrueForge cannot reach the MCP server — check `host.docker.internal` and the token |
| Gate does not fire | See `docs/runbook.md` → "The gate stopped firing" |

## What to verify before trusting it

1. `node scripts\smoke.mjs` → 31 passed
2. Provisioning output lists `execute_deletion` as gated, and nothing else
3. The connector shows all 7 tools in the UI
4. A real session pauses for Allow/Deny before `execute_deletion`

Item 4 is the one that matters. Everything else can pass while the gate is
misconfigured, and a wrong gate fails silently.
