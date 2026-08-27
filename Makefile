# Blast Radius — task entrypoints.
# Every target here must work from a clean clone; that is the Thursday bar.

SHELL := /bin/bash
COMPOSE ?= docker compose
PSQL_URL ?= postgres://blastradius:blastradius@localhost:5432/subject_data

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show available targets
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
	  | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

.PHONY: install
install: ## Install workspace dependencies
	pnpm install

.PHONY: up
up: ## Boot postgres + the MCP server
	$(COMPOSE) up --build -d
	@echo "MCP server: http://localhost:8080/mcp   health: http://localhost:8080/healthz"

.PHONY: down
down: ## Stop the stack, keep the data volume
	$(COMPOSE) down

.PHONY: clean
clean: ## Stop the stack and destroy the data volume
	$(COMPOSE) down -v

.PHONY: logs
logs: ## Tail the MCP server logs
	$(COMPOSE) logs -f mcp-server

.PHONY: fixture
fixture: ## Load the server's local test fixture into postgres
	psql "$(PSQL_URL)" -v ON_ERROR_STOP=1 \
	  -f packages/mcp-subject-data/test/fixtures/schema.sql

.PHONY: provision
provision: ## Register the MCP connector and create/update the agent in TrueForge
	pnpm --filter @blast-radius/agent provision

.PHONY: typecheck
typecheck: ## Typecheck every package
	pnpm -r typecheck

.PHONY: build
build: ## Build every package
	pnpm -r build

.PHONY: test
test: ## Run the test suites
	pnpm -r test

.PHONY: check
check: typecheck test ## What to run before pushing

.PHONY: health
health: ## Verify the MCP server is answering
	@curl -fsS http://localhost:8080/healthz && echo
