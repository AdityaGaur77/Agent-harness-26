.PHONY: up down seed provision demo smoke typecheck build

up:
	docker compose up -d --build

down:
	docker compose down

seed:
	psql "$(DATABASE_URL)" -f demo/seed/seed.sql

provision:
	cd packages/agent && npm run provision

demo:
	echo "Aarav: demo entrypoint lands here"

smoke:
	cd packages/mcp-subject-data && node scripts/smoke.mjs

typecheck:
	cd packages/mcp-subject-data && npm run typecheck
	cd packages/agent && npm run typecheck

build:
	cd packages/mcp-subject-data && npm run build
