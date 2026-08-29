# Blast Radius demo data

All records created by this demo are synthetic. Names, contact details, addresses,
uploads, tickets, audit events, orders, and order items are generated for the
hackathon scenario and do not contain real personal data.

The Compose stack initializes the schema in `seed/001-schema.sql`, then runs the
Node/Faker seed container. The seed is deterministic and resets only the demo
tables before loading 5,000 synthetic customers. Customer `4471` is intentionally
given a richer history so the measured cascade is easy to see during the demo.

The demo schema deliberately keeps `orders.customer_id` non-nullable and does
not add a `billing_email` column. Its clean resolution preserves the retained
orders and order items by preserving the customer row and anonymising the
customer columns named by `retention_policies`. The package smoke fixture uses
a different, isolated strategy (detach and anonymise orders); it is not the
canonical schema for this synthetic database. In both cases, `ON DELETE CASCADE`
on orders and order items remains the naive-plan trap that rehearsal must expose.

The primary MCP endpoint on port `8080` keeps the repository's original
`blast_main` development workflow. The synthetic database is exposed separately
through `demo-mcp-server` on port `8081` by default.

Run the seed again with:

```bash
docker compose run --rm demo-seed
```
