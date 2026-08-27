# Blast Radius demo data

All records created by this demo are synthetic. Names, contact details, addresses,
uploads, tickets, audit events, orders, and order items are generated for the
hackathon scenario and do not contain real personal data.

The Compose stack initializes the schema in `seed/001-schema.sql`, then runs the
Node/Faker seed container. The seed is deterministic and resets only the demo
tables before loading 5,000 synthetic customers. Customer `4471` is intentionally
given a richer history so the measured cascade is easy to see during the demo.

Run the seed again with:

```bash
docker compose run --rm demo-seed
```
