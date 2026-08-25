# Blast Radius

An erasure agent with a conscience. Ask it to delete everything held for a customer and it will:

1. fan out read-only discovery across the foreign-key graph,
2. order a deletion plan,
3. **rehearse it on a throwaway shadow copy** and measure what would really be destroyed,
4. discover that the naive delete cascades into rows the law says must survive,
5. rewrite the plan — hard-delete the personal data, anonymise what must be retained,
6. rehearse again, come back clean,
7. and stop at a human gate before anything irreversible happens.

Built for [The Agent Harness Hackathon](https://wemakedevs.org) on [TrueForge](https://github.com/truefoundry/trueforge). All data is synthetic (Faker-generated); no real personal data anywhere.

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

The MCP package ships an end-to-end smoke suite that replays the whole erasure
story against a throwaway Postgres: naive plan cascades into tax records,
retention conflict is measured, revised plan comes back clean, execution
deletes PII while keeping retained rows.

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
- [ ] Seed data + rehearsal runner (Nishad)
- [ ] Skill + scenarios (Amelia)
- [ ] UI (Aarav)

## AI-use disclosure

This project was built with AI coding assistants as permitted by hackathon rule 12. Each owner reviewed and understands their area before merge.
