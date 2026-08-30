---
name: gdpr-erasure
description: Procedure for handling a data subject erasure request against a subject-data store, including "right to be forgotten" requests, GDPR/DSAR (data subject access request) deletion requests, and any instruction to delete, erase, remove, purge, or "forget" everything held for a named customer or subject. Use this whenever a request asks to delete all data for a specific person or account, not for deleting a single record or an unrelated bulk operation.
---

# Handling an erasure request

You are deciding what to destroy in someone else's database. Deletion does not
ask twice, and nothing here can be undone once it passes the gate. Work through
every phase in order and do not skip one because the request looks simple.

## 1. Map the graph before you plan anything

Read the schema and the foreign-key graph first. For every foreign key that
touches the subject's rows, note its `ON DELETE` behavior specifically. A table
you never name in a plan can still lose rows, or have rows orphaned, because a
cascade or a null-out reaches it from a table you did name. You cannot plan
around a cascade you have not read.

## 2. Delegate discovery, and ask for summaries only

Do not search the whole store yourself in one pass. Fan discovery out across
the data domains in parallel, one delegated search per domain, because each
domain has a different shape of "where might this subject appear" and a single
serial search misses that. Each delegated search reports back a summary: which
tables held rows for the subject, how many, and the foreign-key path that
reached them. It never reports back row contents. Row contents are exactly what
an erasure workflow should not be copying into a wider context.

Call the retention-policy tool and read the rows. Do this every time. Do not
rely on what a previous request concluded, on what the policies were the last
time you looked, or on any expectation of what they ought to say. They are
data, they change, and the database is the only authority on them.
See `references/discovery-brief.md` for the brief to give each delegated
search: what to look for, what to return, and what never to return.

## 3. Read the retention policy for every table your plan touches

Call the retention-policy tool and read its rows. Do this every time; do not
reuse what a previous request concluded or what you expect the policy to say,
because the database is the only authority on it and policies change.

Check the policy for every table your plan reaches, including a table you only
reach by cascade or by a foreign key set to null. A table's rows can be
destroyed by your plan without your plan ever naming that table directly, and
the retention policy still applies to it.

## 4. Snapshot and rehearse before proposing anything

Snapshot the store to a shadow copy and rehearse the plan there before you
present it to anyone. A plan you have not rehearsed is a guess wearing the
shape of a plan.

## 5. Read what the rehearsal measured, not what it returned

The rehearsal runs for real inside the shadow copy and fires the database's
own cascades, so its output is a measurement, not a prediction. A rehearsal
that completes without a database error is not the same thing as a rehearsal
that is correct. Read the measured result: which tables lost rows, which of
those you did not name, what was orphaned, and whether anything you read in
step 3 was violated. Success completing is not success being correct.

## 6. Resolve a retention conflict, do not report it and stop

If the measured result shows the plan destroying rows a retention policy
protects, you are holding two valid obligations at once: the subject's right
to erasure, and the duty to retain that record. Stopping and reporting the
conflict back to a human is not resolving it, and neither is picking one
obligation and ignoring the other.

Revise the plan yourself: delete the subject's personal data outright wherever
nothing protects it, and wherever a row is protected, keep the row and
overwrite the columns the retention policy names for it instead of deleting
it. Remember that deleting a parent row can take a protected child down with
it through a cascade, so protecting the child can mean keeping and
de-identifying the parent rather than removing it.

## 7. Re-rehearse until the measured result is clean

Snapshot and rehearse the revised plan again. Do not reason about whether the
revision should work; measure it. Repeat step 6 and this step until a
rehearsal reports no retention violations at all. A revision you have not
re-measured is still a guess.

## 8. Present the plan and the measured blast radius, then stop

Bring the human the final plan together with the measured numbers from the
clean rehearsal that produced it, and wait at the gate. That pause is the
point of this procedure, not friction on top of it. If the human denies the
plan, ask what should change, revise, rehearse again, and return; do not
re-present the same plan or attempt the execution tool again without a fresh
clean rehearsal behind it.

A clean rehearsal is what makes the execution tool callable at all: use the
plan and the token that exact rehearsal returned, unchanged. If you alter the
plan after rehearsing it, even to simplify it after an error, that token no
longer applies and the tool will refuse it. Rehearse the plan you actually
intend to run, not a fallback you have not measured.

## 9. Verify the outcome against what you measured

After execution, check the resulting state against the rehearsal that was
approved: the tables that should have lost rows did, the tables that should
have kept protected rows still have them, and nothing moved that the approved
rehearsal did not predict. If the outcome does not match the rehearsal,
say so before doing anything else; do not treat execution completing as
execution matching the plan.

## 10. Close with a receipt

Report what was deleted outright, what was preserved and de-identified
instead and under which policy, and confirm that the verified outcome matched
the approved rehearsal. Name the specific retention rows and the specific
measured numbers behind each claim, so the report can be checked against the
database rather than taken on trust.

## Rules

- Never call the execution tool until a rehearsal of that exact plan has come
  back with no retention violations, and always call it with the token that
  same rehearsal returned. A different plan, even a simpler one offered after
  an error, needs its own clean rehearsal before it can run.
- Never delete a row a retention policy protects. Anonymise it instead, per
  step 6.
- If a table your plan touches has no retention policy entry at all, that is
  not permission to proceed. An absent policy is not an empty one. Stop and
  ask a human before touching that table.
- Report only numbers you measured in a rehearsal or a verified outcome.
  Never state an estimate or a prediction as if it were a measurement.
