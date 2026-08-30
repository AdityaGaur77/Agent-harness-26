# Blast Radius

Blast Radius is an erasure agent for a PostgreSQL customer database. Given
"delete everything we hold for customer 4471," it has to reconcile two valid
legal obligations at once: GDPR's right to erasure, and tax law's requirement
to keep seven years of invoice records for the same customer.

## What the connected agent does

- The agent is asked to erase one named customer. It fans discovery out
  across four data domains in parallel (core identity, uploads, billing,
  audit), each search returning a table-and-count summary, never row
  contents.
- It reads the foreign-key graph and the retention policy table, then drafts
  a deletion plan.
- It snapshots the database to a disposable shadow copy and rehearses the
  plan there.
- The naive plan **succeeds** in rehearsal, and that is the problem: it
  cascades into the customer's orders and order line items, both of which a
  retention policy protects. A plan that runs with no error is not
  automatically a plan that is legal.
- The agent revises on its own: hard-delete the personal-data-only records,
  anonymise the customer row so the foreign key still resolves and the
  protected financial records survive. It rehearses again and gets a clean
  result.
- `execute_deletion` carries a destructive annotation, so the harness pauses
  and shows the plan and the measured blast radius. A human chooses Allow or
  Deny.
- On Allow, the agent executes, verifies the outcome against what the
  rehearsal predicted, and reports a receipt: what was deleted, what was
  anonymised, and under which policy.

## Setup

The tested, step-by-step walkthrough from a clean clone, including running
TrueForge itself, is `docs/SETUP.md`. It was written against a Windows +
Docker Desktop run and calls out where macOS/Linux differ; follow it, not the
summary below, if this is your first time standing up the stack.

Short version, once you know the shape of it:

```bash
cp .env.example .env          # set MCP_AUTH_TOKEN, and see docs/SETUP.md re: port defaults
docker compose up -d --build --wait  # primary MCP :8080; synthetic demo MCP :8081
```

Register the MCP connector in TrueForge (Settings → Connectors → Add MCP
Server) with the bearer token from `.env`. The URL depends on whether
TrueForge shares a Docker network with this stack: if it does, use
`http://mcp-server:<PORT>/mcp`; if TrueForge runs as its own separate stack
(the common case, see `docs/SETUP.md` Part 2), use
`http://host.docker.internal:<MCP_HOST_PORT>/mcp` from the host's point of
view instead, since `localhost` inside TrueForge's own container means
TrueForge, not this one.

The hackathon agent uses the dedicated synthetic-demo MCP service: use
`http://127.0.0.1:8081/mcp` for standalone TrueForge, or
`http://host.docker.internal:8081/mcp` when TrueForge runs in its own Docker
stack. Port `8080` remains the isolated `blast_main` development and smoke-test
endpoint.

Register the skill (Settings → Skills → Add Skill) with a repository URL,
path `skills/gdpr-erasure`, and a **ref pinned to a commit SHA**, not a
branch name, so what loads at runtime cannot drift out from under you. Get
the current SHA with:

```bash
git log -1 --format=%H -- skills/gdpr-erasure/SKILL.md
```

Provision the agent. `.env` configures the Docker Compose stack only;
`packages/agent/provision.ts` reads `process.env` directly and will not load
it, so export the same values (plus the TrueForge-side ones) in the shell
you run this from:

```bash
cd packages/agent && npm install
export TRUEFORGE_BASE_URL=http://localhost:8791
export TRUEFORGE_TOKEN=<your value>
export MODEL_NAME=<provider>/<model>
export MCP_AUTH_TOKEN=<same value as .env>
export MCP_SERVER_URL=<see docs/SETUP.md Part 4 for host.docker.internal vs. same-network>
npm run provision
```

`packages/agent/agent.manifest.json`'s `config.sandbox.enabled` must be
`true` (it is, by default) and a sandbox provider (Daytona) must be
configured in TrueForge first: an agent spec with a sandbox or a skill is
rejected at session creation without one. The provisioning script does not
print which tools ended up gated, so verify it directly: check
`requireApprovalForTools` in `agent.manifest.json` (should list only
`execute_deletion`), and confirm the same in the TrueForge UI under the
agent's settings after `npm run provision` completes.

To verify the stack without a live TrueForge session, run the smoke suite
described in `docs/runbook.md`. To verify the full harness behaviour,
including the approval gate actually firing, follow `docs/ACCEPTANCE.md`.

## Architecture

```mermaid
flowchart LR
    User[Judge / operator] -->|"delete customer 4471"| Harness[TrueForge harness]
    Harness -->|dynamicSubAgents, parallel| D1[core identity]
    Harness --> D2[uploads]
    Harness --> D3[billing]
    Harness --> D4[audit]
    D1 --> Harness
    D2 --> Harness
    D3 --> Harness
    D4 --> Harness
    Harness -->|MCP over streamable HTTP, bearer auth| MCP[subject-data MCP server]
    MCP -->|read-only tools| Main[(blast_main)]
    MCP -->|snapshot_to_shadow, rehearse_deletion| Shadow[(blast_shadow, disposable)]
    Harness -->|execute_deletion: destructiveHint annotation| Gate{{Approval gate: Allow / Deny}}
    Gate -->|Allow, plus the token from the approved rehearsal| MCP
    Harness -.session state survives a closed tab.-> Harness
```
- **AI model integration (Aarav Vivek).** Aarav connected DeepSeek V4 Flash
  as a supported reasoning model for the agent. The model interprets the
  user’s request and decides which workflow steps and tools to use, while
  TrueForge controls tool access, sandboxing, and human approval. The model
  can be changed through the `MODEL_NAME` environment variable.

- **MCP tool routing with approval annotations.** All seven tools
  (`inspect_schema`, `list_foreign_keys`, `get_retention_policies`,
  `find_subject_data`, `snapshot_to_shadow`, `rehearse_deletion`,
  `execute_deletion`) live behind one streamable-HTTP MCP server. Six carry a
  read-only or shadow-write annotation and never gate. `execute_deletion`
  alone carries the destructive annotation and is also listed in the agent
  manifest's `requireApprovalForTools`; either one gating it independently is
  deliberate redundancy, described in `docs/runbook.md`.
- **The approval is bound to the plan, not just requested before it.** A
  clean `rehearse_deletion` mints a single-use token fingerprinted to the
  exact plan it measured; `execute_deletion` requires that token and refuses
  a plan that does not match it, even a superficially similar one offered
  after an error. This exists because of a real failure, not a hypothetical
  one: on a live run, a rejected plan led the agent to retry with a smaller,
  unrehearsed one, and the tool executed it, destroying rows the rehearsal
  had just proven were protected. The gate stopping to ask is necessary but
  was not, on its own, sufficient. See assertion 9 in `docs/ACCEPTANCE.md`.
- **Parallel subagents.** Discovery is delegated across the four data
  domains at once (`dynamicSubAgents` in the agent config), each domain
  searched differently and each returning a summary rather than row
  contents. See `skills/gdpr-erasure/references/discovery-brief.md`.
- **Session persistence.** The harness keeps session state (Redis-backed)
  independent of any open browser tab, so a run's history and a pending
  approval gate survive a closed and reopened tab. See assertion 12 in
  `docs/ACCEPTANCE.md`.
- **Generative UI.** Enabled in the agent config for rendering the plan and
  measured blast radius at the approval gate, rather than requiring it to be
  read out of a plain-text tool result.
- **Skills, not Code Mode.** The procedure lives in
  `skills/gdpr-erasure/SKILL.md`, loaded into the sandboxed session at
  `/opt/tfy/skills/gdpr-erasure`. The sandbox itself is real and provisioned
  for every session (`config.sandbox.enabled: true` in the agent config,
  required for any skill to load at all), but that is not the same claim as
  the Double-O track's own description of what it rewards, which names
  "generated code running in a sandbox" specifically. Blast Radius does not
  have that. Every action the agent takes is one of the seven MCP tool calls
  above, not agent-authored code the harness executes. We are naming that
gap here rather than letting a demo recording imply otherwise.

The rehearsal itself is not sandboxed code execution either. It is the
`rehearse_deletion` MCP tool, which really runs the plan inside the
disposable shadow database and rolls the transaction back. Its numbers are
measured, not predicted, but nothing about producing them runs as generated
code. Routing the rehearsal through Code Mode instead of a direct tool call
is the highest-value change left for this track if there is time before
submission; see [#16](https://github.com/AdityaGaur77/Agent-harness-26/issues/16).

## Qodo Code Review Evidence

Representative merged PR with meaningful hackathon code:
[#14](https://github.com/AdityaGaur77/Agent-harness-26/pull/14), merged as
[571a222](https://github.com/AdityaGaur77/Agent-harness-26/commit/571a222aba85bd78f35ba02a5fab3f2c41a6e19f).

What Qodo surfaced and what we changed: one High finding, the README's short
setup ran `npm run provision` right after editing the Compose `.env`, but
the provisioning script reads environment variables directly from the shell
and never loads that file, so a clean-clone run following the README
verbatim would fail before creating the agent. Two Medium findings: a claim
that provisioning prints a list of gated tools (it doesn't; fixed to point
at `requireApprovalForTools` in the manifest instead), and an internal
inconsistency in the blog post's blast-radius counts (it named two different
numbers for the same fixture; fixed to the number the fixture actually
seeds). All three were fixed, not dismissed.

PR history showing the completed review, our decisions, and a follow-up
review against the final code: all on
[#14](https://github.com/AdityaGaur77/Agent-harness-26/pull/14) itself.
Qodo's initial review posted the three findings above as inline PR review
comments; each was replied to in its own thread explaining the fix and
citing the commit; the fix landed in one follow-up commit; Qodo's own
persistent review comment then auto-updated to mark all three
`✓ Resolved` against that commit, with no new findings raised.

See `docs/ACCEPTANCE.md`'s Qodo sweep table for the status of every PR's
High-severity findings; every merged PR must show each one fixed or
dismissed with a recorded reason before submission.

The UI integration is carried on [PR #18](https://github.com/AdityaGaur77/Agent-harness-26/pull/18),
which was opened from `codex/aarav-ui-live-harness` into `Aditya` and reviewed
by Qodo with `/agentic_review`. The latest pass found one Medium documentation
finding because the acceptance sweep omitted this PR; the row is included in
the follow-up commit. The earlier implementation pass reported zero bugs,
rule violations, and skill insights. It remains open until the live TrueForge
and Daytona session is demonstrated and the maintainer merges it.

### How the web UI connects to TrueForge

The browser has two data paths. When the Vercel TrueForge proxy is configured,
the request composer creates a named `blast-radius` session and streams the
agent's real turn events into the conversation: reasoning messages, dynamic
sub-agent threads, MCP calls and results, questions, and the approval gate.
Approving or denying a destructive call sends a `user.tool_approval` resume
turn back to the same session. Questions raised by the agent use the matching
`user.tool_response` resume. TrueForge keeps the session and pending gate in
its own store, so the work is not tied to an open browser tab.

`api/trueforge-session.js` is the server-side boundary for that path. Set
`TRUEFORGE_BASE_URL`, `TRUEFORGE_TOKEN`, and `TRUEFORGE_AGENT_NAME` in the
deployment environment, plus a separate `TRUEFORGE_UI_TOKEN` for browser
access. Enter that same workspace token once under Connections when the proxy
requires it. The TrueForge credential remains on the server; the UI only
receives the streamed events. To exercise the proxy locally, run `vercel dev
--listen 4173` from the repository root; `python3 -m http.server` only serves
the static fallback and cannot execute `api/*` functions.

For Vercel, `TRUEFORGE_BASE_URL` must point to a reachable hosted TrueForge
instance; a localhost URL works only when the proxy and TrueForge run on the
same machine. The proxy fails closed when the runtime is not configured, so a
public page never presents a fabricated agent run.

## AI assistance

Per hackathon rule 12, this project used AI coding assistants throughout.
Roughly, by area:

- **Aditya Gaur** (MCP server, provisioning, runbook): mainly Claude Code,
  with some use of Codex.
- **Aarav Vivek** (UI): Codex.
- **Nishad Mulay** (demo database and Faker seed): Codex.
- **Amelia Patel** (skill, acceptance script, README, submission and
  presentation docs): Claude Code.
- Team-wide: Claude and Gemini for early ideas and brainstorming, and for
  help setting up the TrueForge, Daytona, and Ubuntu environment.

Every merged change went through a Qodo-reviewed pull request (see Qodo Code
Review Evidence above), and each owner reviewed and can explain the area
they own, per rules 12 through 14.

## Data

All data in the demo database is synthetic, generated with Faker. No real
customer data, and no credentials, are committed to this repository; secrets
are supplied at runtime through `.env` (see `.env.example`).
