# Runbook

Operational guide for the Blast Radius MCP server and agent provisioning.
Owner: Aditya until 27 Aug, then Nishad.

## Architecture in one paragraph

The primary MCP server talks to `blast_main` and remains the isolated smoke-test
target. The `demo-mcp-server` talks to the synthetic `blast_demo` database and
is the connector used by the hackathon agent. Both use streamable HTTP and the
same bearer token; each clones its own database into a separate shadow database.
Every tool except `execute_deletion` is annotated read-only; `execute_deletion`
is annotated destructive AND listed in `requireApprovalForTools`, so the harness
pauses for a human before it runs. The two layers are intentional:
the annotation auto-gates on `@destructive` even if the manifest list changes.

## Common operations

### Start / stop everything

```bash
MCP_AUTH_TOKEN=dev-token docker compose up -d --build --wait   # start and wait for health
docker compose down                                      # stop (keeps pgdata volume)
```

Host ports are configurable for machines where 8080/5432 are taken:

```bash
MCP_HOST_PORT=18082 DEMO_MCP_HOST_PORT=18083 POSTGRES_HOST_PORT=15432 docker compose up -d
# smoke endpoint: http://127.0.0.1:18082/mcp
# synthetic demo endpoint: http://127.0.0.1:18083/mcp
```

### Verify nothing broke (run before every demo)

```bash
cd packages/mcp-subject-data
DATABASE_URL=postgresql://blast:blast@127.0.0.1:15432/blast_main \
MCP_URL=http://127.0.0.1:18082 MCP_AUTH_TOKEN=dev-token npm run smoke
```

Expect `36 passed, 0 failed`. The suite replays the full story: naive plan ->
cascade measured -> retention conflict -> revised plan -> clean rehearsal ->
gated execution -> production state asserted. It resets `blast_main` only; the
Compose MCP server at `MCP_URL` must therefore remain pointed at `blast_main`.

### Provision / re-provision the agent

```bash
cd packages/agent && npm install
TRUEFORGE_BASE_URL=http://localhost:8791 TRUEFORGE_TOKEN=... \
MODEL_NAME=openai/gpt-4o-mini MCP_AUTH_TOKEN=dev-token npm run provision
```

Safe to re-run: connector registration uses `createOrUpdate`; if the agent name
already exists the script updates its manifest instead of failing.

## How to add a tool

1. Write the handler in `src/tools/discover.ts` (read-only) or a new file.
2. Annotate it: import `READ_ONLY` or `DESTRUCTIVE` from `src/annotations.ts`.
   Never inline annotation objects - this file is the security boundary and it
   must stay greppable.
3. Register it inside `buildServer()` in `src/index.ts`.
4. If it writes anything outside a shadow copy, it MUST carry `DESTRUCTIVE`
   and be added to `requireApprovalForTools` in `packages/agent/agent.manifest.json`,
   then re-run provision.
5. Extend `scripts/smoke.mjs` with at least one assertion about the new tool.

## How to change the approval policy

Two layers exist on purpose:

| Layer | Where | Controls |
|---|---|---|
| Harness approval | `packages/agent/agent.manifest.json` -> `requireApprovalForTools` | which tool names pause the agent loop |
| Annotation gate | `src/annotations.ts` | harness auto-gates `@destructive` tools even without the list |

To gate another tool: set its annotation to `DESTRUCTIVE` and add its name to
`requireApprovalForTools`. To un-gate something, do both halves consciously and
say why in the PR - silently removing either half is exactly what this project
exists to prevent.

## When the gate stops firing

Check in this order:

1. `tools/list` annotations - connect with the SDK client (see smoke.mjs) and
   confirm `execute_deletion.annotations.destructiveHint === true`. If not, the
   container is running stale code: `docker compose up -d --build`.
2. Manifest actually applied - `client.agents.list()` and inspect
   `requireApprovalForTools`. Provisioning is idempotent; just re-run it.
3. Connector auth - a 401 in the harness logs means the bearer token changed;
   re-run provision so `settings.mcpServers.createOrUpdate` refreshes headers.
4. Tool name mismatch - selectors match exact names; a rename in the server must
   be mirrored in the manifest.

## Shadow-copy gotcha

`snapshot_to_shadow` terminates all other connections to `blast_main` briefly
(Postgres requires no active sessions on a template database during clone).
Single-user demo: fine. Concurrent agents: serialise snapshots. After any
`execute_deletion`, take a fresh snapshot before rehearsing again.

## Known quirks

- `@truefoundry/trueforge-sdk@0.1.3`: named type exports (`AgentSpec`) are only
  reachable via the `TrueForgeApi` namespace in ESM builds; value exports like
  `TrueForgeError` come from the root. See `provision.ts`.
- Port 8080 is occupied by unrelated apps on some dev machines - use
  `MCP_HOST_PORT` rather than editing compose.
- Node 22.14+ required by TrueForge; local dev uses `node --import tsx`.
