# Blast Radius

An erasure agent that checks its work before it changes anything. Ask it to delete everything held for a customer and it will:

1. fan out read-only discovery across the foreign-key graph,
2. order a deletion plan,
3. **rehearse it on a throwaway shadow copy** and measure what would actually be destroyed,
4. discover that the naive delete cascades into rows the law says must survive,
5. rewrite the plan: hard-delete personal data and anonymise what must be retained,
6. rehearse again, come back clean,
7. stop at a human gate before anything irreversible happens.

Built for [The Agent Harness Hackathon](https://wemakedevs.org) on [TrueForge](https://github.com/truefoundry/trueforge). All data is synthetic and Faker-generated. No real personal data is used.

## Quick start

```bash
cp .env.example .env          # set MCP_AUTH_TOKEN
docker compose up -d --build  # postgres + redis + MCP server on :8080
```

Register the connector in TrueForge: Settings → Connectors → Add MCP Server → URL `http://mcp-server:8080/mcp`, bearer token from `.env`.

Provision the agent:

```bash
cd packages/agent && npm install && npm run provision
```

### Verify the harness behaviour

The MCP package includes an end-to-end smoke suite that replays the erasure
story against a throwaway Postgres instance. It measures the naive cascade into
tax records, checks the retention conflict, verifies the revised plan, and
confirms that execution deletes PII while keeping retained rows.

```bash
docker run -d --name blast-pg-verify -e POSTGRES_USER=blast -e POSTGRES_PASSWORD=blast \
  -e POSTGRES_DB=blast_main -p 55432:5432 postgres:16-alpine
set DATABASE_URL=postgresql://blast:blast@127.0.0.1:55432/blast_main
set MCP_AUTH_TOKEN=dev-token && npm run dev    # second shell, in packages/mcp-subject-data
npm run smoke                                  # third shell, same env vars
```

## Layout

| Path | Owner | What |
|---|---|---|
| `packages/mcp-subject-data/` | Aditya | MCP server over streamable HTTP; annotations are the security boundary |
| `packages/agent/` | Aditya | agent manifest + SDK provisioning |
| `demo/seed/`, `demo/shadow/` | Nishad | schema trap, Faker seed, shadow restore |
| `skills/gdpr-erasure/SKILL.md` | Amelia | procedure-only skill, zero answers |
| `ui/` | Aarav | blast radius table, subagent trail, approval panel |

## Status

- [x] MCP server answering over streamable HTTP with bearer auth (`:8080`)
- [x] Read-only tools: `inspect_schema`, `list_foreign_keys`, `get_retention_policies`, `find_subject_data`, `snapshot_to_shadow`, `rehearse_deletion`
- [x] Gated destructive tool: `execute_deletion` (`destructiveHint` annotation)
- [x] Agent manifest + SDK provisioning script
- [x] Compose stack builds and passes the 28-check smoke suite end to end
- [x] Runbook (`docs/runbook.md`)
- [ ] Seed data + rehearsal runner (Nishad)
- [ ] Skill + scenarios (Amelia)
- [x] UI (Aarav)
- [ ] Live TrueForge integration test (connector registration, gate firing in a real session)

## Deploy

### UI: Vercel (static)
`ui/` is static HTML/CSS/JS. `vercel.json` sets `outputDirectory: ui`, no build.

```bash
vercel --prod  # or import AdityaGaur77/Agent-harness-26 in Vercel dashboard
```
The static UI auto-detects the Fly URL outside localhost. Enter the MCP URL and token in Connections before starting a live run; the token is kept for the current browser session. Set Vercel env `EXA_API_KEY` only if you want the optional server-side public-web lookup.

### Backend: Fly.io (MCP + Postgres)
MCP server is in `packages/mcp-subject-data/`. `fly.toml` deploys it with healthcheck at `/healthz`.

```bash
fly launch --no-deploy  # first time, app blast-mcp, region iad
fly postgres create --name blast-pg --region iad
fly postgres attach blast-pg --app blast-mcp  # sets DATABASE_URL
fly secrets set MCP_AUTH_TOKEN=$(grep MCP_AUTH_TOKEN .env | cut -d= -f2) SHADOW_DB_NAME=blast_shadow
fly deploy --config packages/mcp-subject-data/fly.toml
fly status
curl -s https://blast-mcp.fly.dev/healthz | grep ok
```

Local dev still works: `docker compose up -d --build` then `MCP_URL=http://localhost:8080/mcp` in UI.

The UI does not fall back to synthetic results. If the harness is unreachable,
it shows `Harness unreachable` with Retry and Open connections. Live runs use
the connected Postgres instance.

## AI-use disclosure

This project was built with AI coding assistants as permitted by hackathon rule 12. Each owner reviewed and understands their area before merge.
