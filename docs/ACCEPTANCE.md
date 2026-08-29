# Acceptance script

Run this from a clean `git clone` of this repository, on a machine that did
not build the project. Do not reuse a checkout that already has containers,
volumes, or a provisioned agent from earlier work; a stale volume can make a
broken step look like it passed.

Each item below is a single assertion, numbered so a failure can be cited by
number in an issue (for example: "fails assertion 6"). Work through them in
order; several depend on state built by an earlier one.

Prerequisites: Docker, Node 22.14+, a running TrueForge instance (hosted mode,
port 8791) you can reach and sign in to, and a model provider key TrueForge is
configured to use.

## Assertions

**1. Setup completes from the README verbatim.**
Follow the README's Setup section exactly, with no steps added, skipped, or
inferred: copy `.env.example` to `.env`, set `MCP_AUTH_TOKEN`, run
`docker compose up -d --build`, register the connector and skill in
TrueForge Settings, export the environment variables the README lists, and
run the provisioning command. Pass: every command exits zero and produces
the output the README says it will, using only information in the README (or
in `docs/SETUP.md`, which the README's Setup section explicitly defers to).

**2. A real MCP tool is reached and visible in the trace.**
In a TrueForge chat session with the provisioned agent, ask a question that
requires calling `inspect_schema` or `list_foreign_keys` (for example, "what
tables reference a customer?"). Pass: the session trace shows an actual tool
call to the `subject-data` server with a real result, not a model answer
composed without one.

**3. Read-only discovery runs with no approval prompt.**
Ask the agent to find where a specific customer's data exists, without asking
it to delete anything yet. Pass: `inspect_schema`, `list_foreign_keys`,
`get_retention_policies`, and `find_subject_data` all run without the harness
pausing for approval. None of these tools carry the destructive annotation,
so none should gate.

**4. Delegated discovery runs in parallel across domains.**
Ask for an erasure of a specific customer and watch the trace as discovery
starts. Pass: multiple delegated searches appear and run concurrently, not
one after another, each scoped to one data domain (see
`skills/gdpr-erasure/references/discovery-brief.md`), and each returning a
table-and-count summary rather than row contents in the trace.

**5. The sandbox executes the rehearsal and returns measured numbers.**
Continue the same request through to the first rehearsal. Pass: `rehearse_deletion`
runs after `snapshot_to_shadow`, and its result contains concrete counts
(`rows_deleted_per_table`, `cascades_fired`, `rows_orphaned`,
`retention_violations`), not a description of what the plan is expected to
do. Because this first rehearsal is the naive, illegal plan, its
`execution_token` field is `null`.

**6. The rehearsal flags the retention conflict, and it traces to a specific
row in `retention_policies`.**
The naive plan should delete the customer outright. Pass: the first
rehearsal reports `would_be_illegal: true` with a non-empty
`retention_violations` array naming the `orders` and `order_items` tables,
and querying `retention_policies` directly (`psql` or any client against
`blast_main`) shows the row this corresponds to: `table_name = 'orders'`,
`basis = 'tax'`, `retain_years = 7`. The agent's stated reason for the
conflict and this row must agree.

**7. The agent revises to anonymise, without being told how.**
Do not tell the agent to anonymise anything; only let it see the rehearsal
result from assertion 6. Pass: the revised plan the agent proposes next
anonymises the customer's row (so the foreign key from `orders` still
resolves and the cascade never fires) rather than deleting it, and this
revision is not present anywhere in the skill file or the agent's system
instructions. If you need to confirm that, `grep` `skills/gdpr-erasure/` and
`packages/agent/agent.manifest.json` for the word "anonymise" appearing next
to a table name; it should not.

**8. The run pauses on `execute_deletion`.**
Let the agent re-rehearse the revised plan and reach the point of proposing
execution. Pass: the harness stops and presents an Allow / Deny choice before
`execute_deletion` runs, with the plan and the measured blast radius from the
clean rehearsal visible alongside it. That clean rehearsal's result carries a
non-null `execution_token`; this is what makes the call possible at all, not
only the human's approval.

**9. Execution refuses a plan that does not match the token's rehearsal.**
This is the property added after a real failure: on 2026-08-28, running end
to end against a live harness, a compliant plan hit a validation error, the
agent retried with a smaller plan it had never rehearsed, and (before the
fix) `execute_deletion` ran it anyway, destroying rows a clean rehearsal had
just proven were protected. Confirm the fix holds: call `execute_deletion`
with a valid `execution_token` but a `plan` that differs from the one that
token was issued for (add, remove, or reword a step). Pass: the call is
refused, production is untouched, and the refusal is visible in the MCP
server's log as `[execute_deletion] REFUSED`. Also confirm the negative case
from assertion 5: attempting `execute_deletion` with the naive plan's `null`
token is refused before touching production.

**10. Deny causes a revision, not a retry.**
Choose Deny. Pass: the agent does not immediately re-propose the same plan.
It asks what should change, or explains what it will change, and the next
`execute_deletion` attempt is preceded by a fresh rehearsal of whatever plan
comes next, not a replay of the denied one, since that fresh plan needs a
token of its own.

**11. Allow executes.**
Start a fresh run of the same scenario (or continue past a second gate) and
choose Allow. Pass: `execute_deletion` runs against production, returns
`executed: true`, and the transaction commits (verify with a direct query
that the customer's protected columns changed and the previously-flagged
rows in `orders` / `order_items` are still present). The MCP server's log
shows `[execute_deletion] COMMITTING` followed by `COMMITTED` for this call.

**12. The tab can be closed mid-run and reopened with history intact.**
During a run, after at least one rehearsal has completed but before the
approval gate is resolved, close the browser tab (or the TrueForge chat
window) entirely. Reopen TrueForge, navigate to the same session. Pass: the
full message history, every tool call and its result, and the pending
Allow/Deny gate are all still there, and choosing Allow or Deny from the
reopened session behaves the same as if the tab had never closed.

**13. The final database state matches the rehearsal prediction exactly.**
After assertion 11. Pass: `order_items` rows tied to the customer's orders
are still present and unchanged, the `orders` rows are still present, the
customer's PII columns (`email`, `full_name`, `phone`) no longer hold their
original values, and every other table the plan named as a hard delete
(addresses, uploads) has zero remaining rows for that customer. Every number
here should match what the approved rehearsal in assertion 8 predicted and
the token in assertion 9 was bound to, exactly.

## Skill ablation

Evidence that `skills/gdpr-erasure/SKILL.md` is load-bearing, not decorative.

1. Provision a second agent identical to `blast-radius` except with the
   `skills` array removed from `agent.manifest.json` (or `config.sandbox.enabled`
   set to `false`, which prevents any skill from loading).
2. Give it the same erasure request used in the assertions above.
3. Record what breaks. Expected candidates, based on what the skill alone
   supplies: discovery is not delegated in parallel and instead runs as a
   single serial search; the plan is proposed straight from the naive
   rehearsal without a revision, or the agent asks a human what to do about
   the conflict instead of resolving it; nothing verifies the post-execution
   state against the rehearsal prediction; no receipt is produced.
4. Write down which of these actually happened, with the trace, next to this
   section or in the linked issue. Do not soften a result that turns out to
   be undramatic; the ablation is only useful if it is honest about what the
   model does unaided.

Ablation result: `<<ABLATION_RESULT: fill in after running, with a link to
the session trace>>`

## Qodo sweep

Every open and merged PR with hackathon code, and the status of its
High-severity findings. A High finding is either fixed or dismissed in the
Qodo thread with a recorded reason; anything left blank below is not yet
resolved.

| PR | Title | State | Qodo High findings |
|---|---|---|---|
| [#1](https://github.com/AdityaGaur77/Agent-harness-26/pull/1) | MCP server, approval gate, and agent provisioning | Closed (superseded, not merged) | No Qodo review occurred; closed same day it opened, before one could run |
| [#6](https://github.com/AdityaGaur77/Agent-harness-26/pull/6) | Add synthetic demo database baseline | Open | Reviewed after `/agentic_review` (the earlier `/review` had triggered GitHub's Copilot reviewer, not Qodo). 2 High + 1 Medium, unresolved: (1) `orders.customer_id NOT NULL` and no `billing_email` column, incompatible with the resolution pattern hardcoded in the MCP package's own `scripts/fixture.sql`/`smoke.mjs`; (2) same root cause; (3) Compose now points `mcp-server` at `blast_demo` while the documented smoke command asserts against `blast_main` via a separate `DATABASE_URL`. Verified findings 1-2 do NOT affect this repo's skill/docs, which describe a different, working resolution (anonymise the customer, never touch orders/order_items) that this schema supports cleanly; see PR #14's description. They do mean two incompatible resolution strategies coexist in the codebase, which the PR 6 owner should resolve or dismiss with a reason. |
| [#14](https://github.com/AdityaGaur77/Agent-harness-26/pull/14) | Skill, acceptance script, README, submission docs (consolidated from closed #8-13) | Open | 1 High + 2 Medium found, all fixed in commit `1771ae1`, confirmed `✓ Resolved` by Qodo's follow-up pass. No dismissals. |

Update this table as PRs open, merge, or close. Before submission, every row
for a merged PR must show either "no High findings" or a fixed/dismissed
status for each one it had; do not submit with a blank cell on a merged PR.

Two commits landed directly on `Aditya` without going through a PR: `20666ee`
(`docs/SETUP.md`) and `d5be82c` (the execution-token binding fix). Both are
substantive changes under rule 4's definition, not typo fixes. They should
each get a Qodo pass, either retroactively via a PR that carries no diff
against `Aditya` (opens a review thread without re-merging anything) or by
treating the next PR that touches those files as the vehicle for reviewing
them. Do not let a change dodge review by having already landed on the
branch a PR's diff is measured against.
