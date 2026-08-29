---
name: gdpr-erasure
description: Procedure for handling a data-erasure request against a subject-data store. Use whenever asked to delete, erase, remove or "forget" everything held for a data subject.
---

# Handling an erasure request

You are deciding what to destroy in someone else's database. Deletion does not
ask twice and nothing here can be undone after the gate. Work in phases and do
not skip one, even when the request looks trivial.

## 1. Discover before you plan

Read the schema, the foreign-key graph, and every table that holds rows for the
subject. Use the read-only tools; they never need approval, so there is no
reason to economise on looking.

Pay attention to the `ON DELETE` behaviour of each foreign key. A row you never
name in a plan can still be destroyed by a cascade from a row you did name.
That is the usual way an erasure does more than its author intended.

## 2. Read the retention policies out of the database

Call the retention-policy tool and read the rows. Do this every time. Do not
rely on what a previous request concluded, on what the policies were the last
time you looked, or on any expectation of what they ought to say. They are
data, they change, and the database is the only authority on them.

For every table your plan touches, check that table's entry before you decide
its fate. A table with no policy row is not automatically unconstrained; if you
cannot find an entry, say so rather than assuming permission.

## 3. Rehearse, then read what you measured

Snapshot to the shadow copy and rehearse the plan there. The rehearsal really
executes and really fires the database's own cascades, so its numbers are
measurements, not predictions.

Read them. Which tables lost rows, which lost rows you never named, how many
rows were left orphaned, and whether anything was blocked. Never present a
number you did not measure, and never describe a plan as safe because it looks
obviously safe.

## 4. Resolve the conflict, do not pick a side

If the rehearsal shows the plan destroying rows that a retention obligation
protects, you have two valid legal duties in collision: the subject's right to
erasure and the obligation to keep the record. Satisfying one by ignoring the
other is not a resolution.

Rewrite the plan so it does both: erase the personal data outright where you
may, and where a row must be kept, preserve the row and overwrite the columns
the policy names for de-identification instead of deleting it. Note that
deleting a parent row can destroy protected children through a cascade, so
preserving those children may mean keeping the parent and de-identifying it
rather than removing it.

Then rehearse again. A revision you have not re-measured is a guess.

## 5. Stop at the gate

Present the final plan together with the measured blast radius from the clean
rehearsal, and wait. Executing is gated on a human decision; that pause is the
point of this procedure, not an obstacle to it.

If the human denies the plan, ask what they want changed, revise, rehearse
again, and come back. Do not attempt the execution tool until a rehearsal of
that exact plan has come back clean.

## Reporting

Say what you measured and where you read it. When you report a conflict, name
the policy row you read and the cascade you measured, so a reader can check
your reasoning against the database rather than taking your word for it.
