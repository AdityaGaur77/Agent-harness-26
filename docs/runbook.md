# Blast Radius — runbook

How to change this system without asking whoever built it.

## Architecture

- Postgres holds two schemas. `public` (`LIVE_SCHEMA`) is the real data; `shadow` (`SHADOW_SCHEMA`) is a disposable clone, **including its foreign keys**, which is the whole point of it.
- `packages/mcp-subject-data` is a remote MCP server over HTTP (`/mcp`), auth'd by a bearer token. It exposes the erasure toolkit: read the schema and its FK graph, locate a subject's rows, rehearse a plan, execute an approved one.
- The rehearsal applies a plan to `shadow` inside a transaction that always rolls back, and counts what it touched. Same code path as execution, so the counts are evidence rather than a guess.
- `packages/agent` is not a runtime. It is `agent.manifest.json` (the agent as reviewable data) plus `src/provision.ts`, which pushes that manifest into TrueForge.
- The approval gate has two halves and **needs both**: the MCP server annotates `execute_deletion` as `destructiveHint: true`, and the agent manifest lists it in `requireApprovalForTools`. TrueForge pauses the loop and asks a human before it runs.
- Everything legal — which tables must be retained, on what basis, for how long — lives in the database, in `retention_policies`. Not in the prompt, not in a tool description. Change the rows and the agent's answer changes.

```
make up          # postgres + MCP server
make provision   # register the connector, create/update the agent
make health      # is the MCP server answering
```

## How to add a tool

Tools live in `packages/mcp-subject-data/src/tools/*.ts`, each file exporting one `registerXTools(server)` that `src/index.ts` calls.

```ts
import { READ_ONLY } from '../annotations.js';

server.registerTool(
  'my_tool',
  {
    title: 'My tool',
    description: 'What it does, and what the model must read before calling it.',
    inputSchema: { subject_id: z.number().int() },
    annotations: READ_ONLY,   // <- this line decides whether a human is asked
  },
  async ({ subject_id }) => { /* ... */ },
);
```

**The annotation is the security boundary, not documentation.** Pick from `src/annotations.ts`:

| Constant | Use for | Gated? |
| --- | --- | --- |
| `READ_ONLY` | Reads nothing but reads. Mutates no schema. | no |
| `SHADOW_WRITE` | Writes, but only to `SHADOW_SCHEMA`. Losing that data costs nothing. | no |
| `DESTRUCTIVE` | Any write to live data. | yes |

If a tool can change a row in a schema that is not the throwaway shadow copy, it is `DESTRUCTIVE`. If you are unsure, it is `DESTRUCTIVE` — an over-gated tool costs one click, an under-gated one costs the demo and, in a real deployment, the data.

Adding a `DESTRUCTIVE` tool is not finished when the tool works. Add its name to `requireApprovalForTools` in `packages/agent/agent.manifest.json` and re-run `make provision`; the annotation alone is the server's opinion, the manifest is what TrueForge enforces.

## How to change the approval policy

One place: `mcpServers[0].requireApprovalForTools` in `packages/agent/agent.manifest.json`.

```json
"mcpServers": [
  {
    "name": "subject-data",
    "enableTools": ["@all"],
    "preload": false,
    "requireApprovalForTools": ["execute_deletion"]
  }
]
```

Accepted values: literal tool names, or the selectors `@all`, `@write`, `@destructive`. (The SDK default, if you omit the field entirely, is `["@write", "@destructive"]`. We name the tool explicitly instead, so the gate does not depend on an annotation surviving a round trip.)

Edit the file, then `make provision`. It is idempotent — it updates the existing agent in place rather than making a second one.

**This is API-only.** `requireApprovalForTools` is part of the agent manifest, which is written through the TrueForge API; it is deliberately not exposed in the chat UI. There is no box to tick in the web console. If someone says they changed the policy "in the UI", they changed something else.

Related knobs in the same file: `enableTools` (what the agent can see at all) and `disableTools` (subtractions from that set). Narrowing `enableTools` is a blunter, stronger control than gating — use it when a tool should not exist for this agent rather than merely pause.

## The gate stopped firing

Work down this list in order. Stop at the first thing that is wrong.

1. **Is `execute_deletion` still `DESTRUCTIVE`?** `packages/mcp-subject-data/src/annotations.ts` defines the constants; check the tool's `annotations:` field is `DESTRUCTIVE` and not `SHADOW_WRITE`. A one-word edit here silently disarms everything downstream.
2. **Does the manifest still list it?** `requireApprovalForTools` in `packages/agent/agent.manifest.json` must contain `execute_deletion`. An empty array gates nothing.
3. **Was `make provision` re-run after the manifest changed?** Editing the JSON changes nothing until it is pushed. Provisioning prints an `=== APPROVAL GATE ===` block at the end naming exactly which tools pause; if that block does not say `execute_deletion`, the running agent does not gate it.
4. **Did the annotation survive the connector round trip?** Provisioning calls `client.mcpServers.listTools('subject-data')` and prints each tool as `DESTRUCTIVE` or `safe`. If `execute_deletion` prints as `safe`, TrueForge is not seeing the annotation the server thinks it is sending — rebuild and restart the MCP server (`make up`), because a stale container is serving the old tool list.
5. **Is the agent actually on this connector?** The manifest's `mcpServers[].name` and the registered connector name must both be `subject-data`. A typo produces an agent with no tools rather than an error; if the agent is answering from memory instead of calling tools, this is why.

Fastest confirmation that the whole chain is live: `make provision` and read its last ten lines. Everything above is visible there.

## Environment variables

Copy `.env.example` to `.env`. Compose and the provisioning script both read it from the repo root.

| Name | Required | What it does |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection for the MCP server. `@postgres` inside compose, `@localhost` from your host. |
| `MCP_AUTH_TOKEN` | yes | Bearer token the MCP server demands on every request, and the value written into the connector's `Authorization` header at provision time. |
| `MCP_PORT` | no (8080) | Port the MCP server listens on. |
| `LIVE_SCHEMA` | no (`public`) | Schema holding real data. Only the approved deletion writes here. |
| `SHADOW_SCHEMA` | no (`shadow`) | Throwaway clone the rehearsal runs against. |
| `STATEMENT_TIMEOUT_MS` | no (30000) | Per-statement ceiling, so a bad plan cannot run forever. |
| `LOCK_TIMEOUT_MS` | no (5000) | Lock-wait ceiling, so the gated write fails instead of hanging. |
| `TRUEFORGE_BASE_URL` | yes | TrueForge API the provisioning script talks to. |
| `TRUEFORGE_API_KEY` | no | Bearer token for that API. Omit if your harness needs no auth. |
| `MODEL_NAME` | yes | Fully-qualified `provider/model`, e.g. `openai/gpt-5.2`. Substituted into `agent.manifest.json` in place of `__MODEL_NAME__`. |
| `MCP_SERVER_URL` | no (`http://mcp-server:8080/mcp`) | Where **the harness** reaches the MCP server. Not necessarily where you reach it. |
| `AGENT_NAME` | no (`blast-radius`) | Name the agent is created or updated under. Renaming it creates a second agent. |

`agent.manifest.json` holds no secrets and no environment-specific values by design — it is meant to be read in a diff. `__MODEL_NAME__` is the single placeholder, and `src/provision.ts` substitutes it. If you add another, substitute it there too.

## Common failures

**Connector unreachable from the harness.** `make provision` registers the connector fine (registration does not dial the server) and then the tool listing prints `unavailable: fetch failed`, or the agent starts a session with no tools. Almost always `MCP_SERVER_URL` pointing at the wrong side of a network boundary: TrueForge running in the compose network needs `http://mcp-server:8080/mcp`; TrueForge running on your host needs `http://localhost:8080/mcp`. `curl` proves nothing here — it tests your reachability, not the harness's. Check from where the harness actually runs.

**401 from the MCP server.** Every tool call fails, the server logs an auth rejection. `MCP_AUTH_TOKEN` disagrees between the two readers: compose passes it to the server as an env var, and provisioning bakes it into the connector's stored `Authorization` header. Rotating `.env` without re-running `make provision` leaves the connector holding the old value. Fix: set the token once in `.env`, `make up`, then `make provision`. Note that the API redacts stored header values on read, so you cannot diff them — re-provision rather than inspect.

**Cascades not firing in the rehearsal.** The rehearsal reports a blast radius far smaller than the live schema would produce — usually only the root table. The shadow schema was built by copying tables without recreating their foreign keys, so there are no `ON DELETE CASCADE` edges left to fire and the rehearsal measures a database that does not exist. This is the worst failure in the system, because it fails quietly and in the reassuring direction. The shadow schema must be built with its constraints intact; verify with `list_foreign_keys` against both schemas and compare the counts before trusting a rehearsal.

**The agent answers about retention without calling a tool.** It is reasoning from training data instead of reading `retention_policies`. Check the tool is enabled and the connector is attached (gate checklist step 5); the instructions deliberately contain no legal rules, so an agent that cannot reach the database has nothing correct to say.
