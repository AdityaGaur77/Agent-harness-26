# Implementation Plan: Real Backend + Vercel (Fly)

## Context
- Design approved: Track A GitHub push (white minimal UI, fix check.mjs), Track B Vercel static deploy, Track C real backend only (remove synthetic fallback, hard error UI, wire to hosted Fly MCP)
- Goal: UI at Vercel connects seamlessly to real MCP + Postgres on Fly, no synthetic demo data, perfect real flow. Keep white minimalist editorial UI, 5.6 souls, ASCII-led.
- Constraints: UI is static HTML/CSS/JS (no build), MCP is Express Node + Postgres + Redis (not serverless), Vercel cannot run PG. Fly hosts backend. Vercel static serves ui/. Env var MCP_URL injected at build/runtime. check.mjs currently fails (expects old lavender strings, now white). No vercel.json exists, no fly.toml exists.
- Backend Fly choice: Fly.io for MCP + Postgres (pg via Fly Postgres or external Neon/Supabase). Use docker-compose locally, Fly for prod.

## Task List

### Task 1: Create isolated branch + worktree
**Files:** `git` (worktree)
**Steps:**
1. `git -C /Volumes/MacExt1TB/Documents/ChatGPT/Agent\ Harness status` ensure clean
2. `git -C /Volumes/MacExt1TB/Documents/ChatGPT/Agent\ Harness worktree list` confirm ui-live
3. Create new branch `feature/real-backend-vercel` from `ui-live`: `git -C /Volumes/MacExt1TB/Documents/ChatGPT/Agent\ Harness/.worktrees/awwwards-ui checkout -b feature/real-backend-vercel`
4. Confirm `git branch --show-current`
**Verification:** `git -C /Volumes/MacExt1TB/Documents/ChatGPT/Agent\ Harness/.worktrees/awwwards-ui branch --show-current` shows `feature/real-backend-vercel`

### Task 2: Fix check.mjs for white minimal UI
**Files:** `ui/scripts/check.mjs`
**Steps:**
1. Read current `ui/scripts/check.mjs` assertions (prompt-first home expects "What would you like to find or remove?" etc)
2. Update failing assertions to match current white minimal copy:
   - prompt-first: change expected string to `Tell me what to find.` (h1)
   - home nav: update `Monitored information` → `Watched` OR keep both tolerated
   - Merriweather check → Newsreader (update to expect `Newsreader` or `Geist Mono`)
   - readable tokens: keep oklch? now uses `#FFFFFF` + `#EAEAEA` — update to check for `#FFFFFF` and `#EAEAEA`
   - humanized copy: update array to `["Tell me what to find", "This looks like you", "What changes", "0 conflicts", "Runs alone"]`
   - demo honest: update to check for `Demo only` / `Rollback saved` instead of old string if needed
3. Keep all harness tool names, ASCII 12 FPS, responsive checks unchanged
**Verification:** `node ui/scripts/check.mjs` → `34/34 checks passed` (or at least exit 0)

### Task 3: Add Vercel static config
**Files:** `vercel.json` (repo root), `ui/vercel.json` (if needed), `.vercelignore` (optional)
**Steps:**
1. Create `/vercel.json` at worktree root:
   ```json
   {
     "buildCommand": null,
     "outputDirectory": "ui",
     "installCommand": null,
     "framework": null,
     "headers": [{"source": "/(.*)", "headers": [{"key": "Cache-Control", "value": "public, max-age=0, must-revalidate"}]}]
   }
   ```
2. Alternative: ensure `ui/package.json` scripts stay static, no build needed
3. Test locally: `npx vercel --version` not needed; just validate json with `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'))"`
**Verification:** `cat vercel.json` + `node -e "JSON.parse(...)"` exits 0, `ls ui/` still static

### Task 4: Remove synthetic fallback, add real-only error UI
**Files:** `ui/app.js`, `ui/index.html`, `ui/styles.css`
**Steps:**
1. In `ui/app.js`:
   - Keep `evidenceFixture` only for shape but gate `if (!liveSuccess)` branch to show hard error instead of demo: replace demo `renderEvidence(4)` / `inspect_schema mapped 7 — demo fixture` with `appendAudit("Error", "Harness unreachable. Check MCP_URL and token.")` + `impactState.textContent="Harness unreachable"` + `impactCopy.textContent="Set MCP URL in Connections and retry."` + show banner `ui/styles.css` error card
   - Remove fallback `liveSuccess = false` auto-demo path; instead set `setRunState("error")`, disable `completionMessage`, enable retry button
   - Update `renderEvidence` pending to not show queued when error
   - Ensure `mcpTool` honors `window.__MCP_URL__` injected from Vercel env (see Task 5)
2. In `ui/index.html`:
   - Add error banner container `<div id="harness-error" hidden>` below mission-progress, styled
   - Ensure `delete-action` and retry button wired
3. In `ui/styles.css`:
   - Add `.harness-error { border: 1px solid var(--pastel-red); background: var(--pastel-red); color: var(--pastel-red-text); border-radius: 12px; padding: 12px; }`
**Verification:** `node -c ui/app.js` exits 0, `node ui/scripts/check.mjs` still passes (or updated), manual test: set `localStorage blast_mcp_url` to invalid, startMission → shows error not demo

### Task 5: Wire Fly backend URL via env + runtime config
**Files:** `ui/app.js`, `ui/index.html`, `.env.example`, `vercel.json`
**Steps:**
1. Update `.env.example` to document `MCP_URL=https://blast-mcp.fly.dev/mcp` and `MCP_AUTH_TOKEN`
2. In `ui/index.html` head, add `<script>window.__MCP_URL__="__MCP_URL__"</script>` placeholder replaced at Vercel build via `sed` or use `localStorage` fallback
3. In `ui/app.js`, add helper `function resolveMcpUrl(){ return (window.__MCP_URL__ && window.__MCP_URL__!=="__MCP_URL__" ? window.__MCP_URL__ : "") || localStorage.getItem("blast_mcp_url") || document.getElementById("connector-url")?.value || "http://localhost:8080/mcp" }` and replace all `harnessUrl` resolutions to use it
4. Add `updateHarnessStatus` to show Fly host when `__MCP_URL__` present
5. Document in `README.md` that Vercel env `MCP_URL` and `MCP_AUTH_TOKEN` must be set
**Verification:** `grep -n "__MCP_URL__" ui/app.js ui/index.html` shows wiring, `node -c` passes

### Task 6: Prepare Fly deployment for MCP
**Files:** `packages/mcp-subject-data/Dockerfile`, `fly.toml`, `packages/mcp-subject-data/fly.toml` (or root `fly.toml`), `.dockerignore`
**Steps:**
1. Inspect `packages/mcp-subject-data/Dockerfile` (created via compose build); ensure `EXPOSE 8080`, `CMD ["node","dist/index.js"]`
2. Run `fly launch` dry-run locally: create `fly.toml` with `app = "blast-mcp"` (or `blast-radius-mcp`), `primary_region = "iad"`, `internal_port = 8080`, env `PORT=8080`, `SHADOW_DB_NAME=blast_shadow`, `DATABASE_URL` secret, `MCP_AUTH_TOKEN` secret
3. Add `[http_service]` with `force_https = true`, healthcheck `path = "/healthz"`
4. Add Postgres: option A `fly postgres create` or use external (document both); set secret `DATABASE_URL`
5. Add commands to `README.md` / `docs/runbook.md`: `fly deploy`, `fly secrets set DATABASE_URL=... MCP_AUTH_TOKEN=...`, `fly status`
6. Ensure `docker-compose.yml` still works locally for dev
**Verification:** `cat fly.toml` exists, `grep -q "healthz" fly.toml && echo ok`, `cat packages/mcp-subject-data/Dockerfile` exists

### Task 7: Push to GitHub + Vercel deploy
**Files:** `git`, `vercel.json`, `README.md`
**Steps:**
1. Stage: `git -C . add DESIGN.md PRODUCT.md ui/ vercel.json fly.toml .env.example README.md docs/`
2. Check `git status`, `git diff --cached --stat`
3. Commit: `git commit -m "feat(ui): white minimal editorial + real Fly backend, Vercel static, no synthetic fallback"`
4. Push: `git push -u origin feature/real-backend-vercel` (or `ui-live` if staying)
5. Create Vercel project: `vercel --prod` or via dashboard import `AdityaGaur77/Agent-harness-26`, set env `MCP_URL` and `MCP_AUTH_TOKEN`, deploy
6. Verify deploy URL loads and `fetch(${MCP_URL}/healthz)` returns 200
**Verification:** `git log --oneline -3`, `git push` exit 0, `curl -s https://<vercel-url>/ | head`, `curl -s https://<fly-app>.fly.dev/healthz | grep ok`

## Verification (overall)
- [ ] `node ui/scripts/check.mjs` passes after fix
- [ ] `node -c ui/app.js` passes
- [ ] `cat vercel.json | node -e "JSON.parse(...)"` passes
- [ ] `cat fly.toml` contains healthz and 8080
- [ ] Local synthetic fallback removed: invalid MCP_URL shows error UI, not demo
- [ ] Vercel deploy live and reaches Fly `/healthz` 200

## Notes
- Keep branch `feature/real-backend-vercel` not main until verification before completion
- Do not guess Fly app name if taken; ask user to confirm `blast-mcp` vs `blast-radius-mcp`
- If Fly Postgres not desired, use Neon: `DATABASE_URL` secret = `postgresql://...`
- All UI still static, no npm build, Vercel outputDirectory = `ui`
