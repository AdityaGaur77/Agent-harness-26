# The delete succeeded. That was the problem.

<<SCREENSHOT: rehearsal result panel showing would_be_illegal: true, with
the orders and order_items counts visible>>

The first time our agent ran a full erasure against the rehearsal copy, it
worked. No constraint errors, no rolled-back transaction, no red text
anywhere in the trace. `DELETE FROM customers WHERE id = 4471` and everything
that referenced it went with it, cleanly, cascading through eight orders and
forty line items on the way down. The database did not object once.

That was the moment we understood we had built the wrong test. We had been
watching for the plan to fail. It didn't. It succeeded at deleting exactly
what it was told to delete, including seven years of invoice records that a
retention policy, sitting quietly in a table nobody had asked the agent to
read yet, said had to survive. A plan that runs without error and a plan
that is correct turned out to be two different claims, and every naive
implementation of "delete this customer" we could think of conflated them.

## What the right to be forgotten actually costs

GDPR's Article 17 gives a person the right to have their data erased. Most
companies also have to keep financial records, invoices among them, for
years after the transaction, because tax authorities require it. Those two
duties are both real and both binding on the same row of data, and a lot of
production erasure code resolves the conflict by accident: whichever system
runs its delete first wins, and the other duty finds out it lost after the
fact, if it finds out at all. We wanted to build something that treated this
as a conflict to resolve, not a race to referee.

We picked a synthetic customer, gave them a non-trivial history (orders,
line items, uploads, a support ticket, an address, audit events), and built
an agent whose job was to erase that customer without silently breaking the
retention duty on the rows a cascade would otherwise take down with them.

## The build, briefly

The agent runs on TrueForge against a custom MCP server that exposes the
database as seven annotated tools: read the schema, read the foreign-key
graph, read the retention policy table, find every row that references the
subject, snapshot to a shadow copy, rehearse a plan there, and, gated behind
a human, execute it against production. Discovery is delegated to parallel
subagents, one per data domain, so the search shape matches the data (an
identity lookup is not a billing lookup) and raw row contents never make it
into the root agent's context, only table-and-count summaries. The procedure
itself lives in a skill file, not in the agent's system prompt, and it
contains no table name, no retention period, and no threshold. Those live in
the retention policy table and get read at request time, on purpose: we
wanted "did it work this out, or did we tell it" to be answerable by opening
the table, not by trusting our own description of the demo.

## What broke

Two things, and both are more interesting than anything that worked on the
first try.

The first is that the approval gate, the entire premise of the demo, is
configured through the agent manifest's API, not through anything visible in
the chat UI. `requireApprovalForTools` is a list of tool names in a JSON
file. There is no toggle in the interface that shows you whether a given
session's gate is actually armed. That is a real property of the harness,
not a bug in it, but it means a wrong or dropped entry in that list does not
throw, does not warn, and does not show up anywhere a person casually looking
at the running agent would see it. It fails by letting the destructive tool
run unattended, and the way you find that out is during the recording, with
the gate you were relying on simply not being there. We are treating "confirm
the gate actually fires in a live session" as a release-blocking check for
exactly that reason, not an optional nice-to-have.

<<SCREENSHOT: agent.manifest.json showing requireApprovalForTools next to
the chat UI, with no equivalent control visible in the UI>>

The second is where the actual security boundary in this whole system turns
out to live. We had assumed, going in, that the interesting code to review
carefully would be the tool bodies: the SQL, the transaction handling, the
cascade logic. It isn't. The tool bodies can be as careful or as sloppy as
you like; what determines whether a human gets a say before an irreversible
write happens is one annotation, `destructiveHint: true`, set on exactly one
tool, in an eleven-line file. Change that one value, or forget to set it on
a new tool that writes to production, and the harness stops pausing. It will
not tell you it stopped pausing. Once we noticed that, the review priority
inverted: the annotations file is now the thing we read line by line before
every merge, and the tool implementations get the normal amount of
attention. A four-line object is doing more safety work in this codebase
than any function in it.

<<SCREENSHOT: annotations.ts in full, with the DESTRUCTIVE export
highlighted>>

Neither of these showed up in a design review. Both showed up from actually
running the thing against a real database and asking, specifically, "what
happens if this one value is wrong."

## The general principle

A linter can tell you a query is syntactically valid, that a migration
won't throw, that a delete statement will execute. None of that is the same
claim as "this is the correct thing to do with this data," and conflating
them is exactly how an erasure agent destroys the wrong seven years of
records while reporting success. Detecting that a plan runs is mechanical.
Deciding what a plan should do when two valid obligations collide over the
same row, and rewriting the plan so it satisfies both instead of picking one
and hoping nobody asks about the other, is not something you can get from a
constraint check. That is what we mean by synthesis, and it is the actual
difference between a tool that flags a problem and an agent you can hand the
problem to.

<<SCREENSHOT: final receipt output, listing what was deleted outright and
what was anonymised and retained, next to the retention_policies row it cites>>
