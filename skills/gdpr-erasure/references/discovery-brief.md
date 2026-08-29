# Discovery briefs

Referenced from step 2 of `SKILL.md`.

Discovery is delegated to one search per data domain, run in parallel, rather
than done as a single serial search, for two reasons. First, each domain has a
different search shape: identity data is found by looking up the subject's
own row and what hangs directly off it, uploads by an owner reference on a
storage table, billing by walking from orders down into order items, audit by
looking for the subject as either the record's owner or a referenced actor on
a row that is not deleted when the subject is. A single generic search over
every table treats all four the same way and misses the ones that do not fit
that shape. Second, a full-content search across every table that might
mention the subject would return row contents (names, addresses, file
references, order line items, log bodies) into the root agent's context. That
is the exact data an erasure workflow should not be copying around, and it
would flood context that the plan does not need. Each domain search below
runs in isolation and reports back a summary only.

Give each delegated search its own brief. All four run at the same time.

## Core identity

**Search:** the subject's own account/profile row, and any table that stores
a direct, owned attribute of that row (for example, physical addresses on
file for the subject). Look up by the subject's identifier and follow foreign
keys that point at it with an owning relationship.

**Return:** for each table with a match, the table name, the row count, and
the foreign-key path from the subject's identifier to that table.

**Never return:** any field value from a matched row. Not the name, not the
email, not the phone number, not the address text. This domain holds the
subject's most directly identifying data; a summary of where it lives is
useful, its content in the root context is not.

## Uploads

**Search:** any table that records files, attachments, or objects owned by
the subject. Match on the owner reference, not on filename or content.

**Return:** the table name, the row count, and the foreign-key path from the
subject's identifier to that table.

**Never return:** filenames, storage object keys, download URLs, or file
contents. A storage reference is still a pointer to personal data even
when the file itself is not fetched.

## Billing

**Search:** orders placed by the subject, and anything reachable only through
those orders (line items, or similar child records that have no owner
reference of their own back to the subject and are reached solely by walking
down from the order). State explicitly in the summary that the child table is
reached by cascade through the parent, not by a direct reference to the
subject, since that distinction is exactly what a plan needs to get right.

**Return:** the table name and row count for orders, and the table name and
row count for anything reached through them, each with its foreign-key path.

**Never return:** order totals, product or SKU details, or any other line-item
content. Billing rows are also the ones most likely to be under a separate
retention obligation; this brief only locates them, it does not decide their
fate.

## Audit

**Search:** any table where the subject appears as a referenced actor or
subject on a record that is not itself owned by them, including a table where
the foreign key is set to null rather than cascaded when the subject's row is
removed. This domain is where "reachable but not owned" relationships live,
and it is easy to miss precisely because those rows do not disappear on their
own.

**Return:** the table name, the row count, and the foreign-key path, noting
explicitly whether the relationship is a cascading one or a nullifying one.
That distinction changes what a plan has to do to that table.

**Never return:** log message bodies, ticket subjects or bodies, or any other
free-text content, and never the identifiers of other subjects who might
appear on a shared record.

## What every brief returns, without exception

A table-and-count summary for each table with a match, and the foreign-key
path by which the subject's data is reachable there. Never row contents.
