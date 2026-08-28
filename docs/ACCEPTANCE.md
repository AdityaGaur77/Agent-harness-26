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
Follow the README's Quick start section exactly, with no steps added,
skipped, or inferred: copy `.env.example` to `.env`, set `MCP_AUTH_TOKEN`,
run `docker compose up -d --build`, register the connector in TrueForge
Settings, run the provisioning command. Pass: every command in that section
exits zero and produces the output the README says it will, using only
information in the README.

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
do.

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
clean rehearsal visible alongside it.

**9. Deny causes a revision, not a retry.**
Choose Deny. Pass: the agent does not immediately re-propose the same plan.
It asks what should change, or explains what it will change, and the next
`execute_deletion` attempt is preceded by a fresh rehearsal of whatever plan
comes next, not a replay of the denied one.

**10. Allow executes.**
Start a fresh run of the same scenario (or continue past a second gate) and
choose Allow. Pass: `execute_deletion` runs against production, returns
`executed: true`, and the transaction commits (verify with a direct query
that the customer's protected columns changed and the previously-flagged
rows in `orders` / `order_items` are still present).

**11. The tab can be closed mid-run and reopened with history intact.**
During a run, after at least one rehearsal has completed but before the
approval gate is resolved, close the browser tab (or the TrueForge chat
window) entirely. Reopen TrueForge, navigate to the same session. Pass: the
full message history, every tool call and its result, and the pending
Allow/Deny gate are all still there, and choosing Allow or Deny from the
reopened session behaves the same as if the tab had never closed.

**12. The final database state matches the rehearsal prediction exactly.**
After assertion 10. Pass: `order_items` rows tied to the customer's orders
are still present and unchanged, the `orders` rows are still present, the
customer's PII columns (`email`, `full_name`, `phone`) no longer hold their
original values, and every other table the plan named as a hard delete
(addresses, uploads) has zero remaining rows for that customer. Every number
here should match what the approved rehearsal in assertion 8 predicted,
exactly.

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
| [#1](https://github.com/AdityaGaur77/Agent-harness-26/pull/1) | MCP server, approval gate, and agent provisioning | Closed (superseded, not merged) | `<<QODO_PR1_STATUS>>` |
| [#6](https://github.com/AdityaGaur77/Agent-harness-26/pull/6) | Add synthetic demo database baseline | Open | `<<QODO_PR6_STATUS>>` |
| [#8](https://github.com/AdityaGaur77/Agent-harness-26/pull/8) | Complete gdpr-erasure skill | Open | `<<QODO_PR8_STATUS>>` |

Update this table as PRs open, merge, or close. Before submission, every row
for a merged PR must show either "no High findings" or a fixed/dismissed
status for each one it had; do not submit with a blank cell on a merged PR.
