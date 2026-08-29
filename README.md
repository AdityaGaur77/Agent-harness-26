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
docker compose up -d --build  # primary MCP :8080; synthetic demo MCP :8081
```

Register the Blast Radius connector in TrueForge with the bearer token from
`.env`. Standalone TrueForge uses `http://127.0.0.1:8081/mcp`; containerized
TrueForge uses `http://host.docker.internal:8081/mcp`. Port `8080` remains the
original `blast_main` development and smoke-test endpoint.

Provision the agent:

```bash
cd packages/agent && npm install && npm run provision
```

### Verify the harness behaviour

The MCP package ships an end-to-end smoke suite that replays the whole erasure
story against a throwaway Postgres: naive plan cascades into tax records,
retention conflict is measured, revised plan comes back clean, execution
deletes PII while keeping retained rows. The smoke suite and the primary MCP
server both target `blast_main`; they never mutate the synthetic demo database.

```bash
docker compose up -d --build
cd packages/mcp-subject-data
set DATABASE_URL=postgresql://blast:blast@127.0.0.1:5432/blast_main
set MCP_URL=http://127.0.0.1:8080
set MCP_AUTH_TOKEN=dev-token
npm run smoke
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
- [x] Compose stack builds and passes the 36-check smoke suite end to end
- [x] Runbook (`docs/runbook.md`)
- [x] Synthetic demo schema + deterministic Faker seed (Nishad)
- [ ] Skill + scenarios (Amelia)
- [ ] UI (Aarav)
- [ ] Live TrueForge integration test (connector registration, gate firing in a real session)

## AI-use disclosure

This project was built with AI coding assistants as permitted by hackathon rule 12. Each owner reviewed and understands their area before merge.
