# Submission write-up (150-word field)

Blast Radius is a GDPR erasure agent. Told to delete everything held for a
customer, it must reconcile two legal obligations at once: erase the
customer, and retain that customer's invoices under tax law.

It runs on TrueForge throughout. Discovery is delegated to parallel
subagents, one per data domain, each returning a table-and-count summary,
never row contents, keeping raw personal data out of its context. A
custom MCP server exposes the database as seven tools; the one
destructive tool is annotated as such, so the harness pauses for a human
Allow or Deny by annotation, not prompt discipline. A rehearsal token then
binds execution to exactly the approved plan, so a retried, unrehearsed
fallback cannot run in its place. Before the gate, the agent snapshots the
database and rehearses the plan against a disposable copy, measuring the
real blast radius instead of predicting it. When rehearsal shows the naive plan
destroying protected records, the agent revises to anonymise instead,
unaided, from a rule that lives only in the database, read at runtime.

<!-- Word count checked with `wc -w`; keep under 160 if edited further. -->
