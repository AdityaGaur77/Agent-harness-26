/**
 * Integration tests for the blast-radius core, run against a real Postgres.
 *
 * These deliberately do NOT mock the database. The entire claim of this
 * project is that the blast radius is measured rather than predicted, and a
 * mocked foreign key cascades exactly how the mock author expected it to —
 * which would test nothing.
 *
 * Requires DATABASE_URL pointing at a database loaded with
 * test/fixtures/schema.sql. `make fixture` does that.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { pool, withRollback, withClient, countRows, closePool } from '../dist/db.js';
import { loadForeignKeys, resolveLinkage, subjectPredicate } from '../dist/graph.js';
import { applyPlan, buildNaivePlan, validatePlan, ROOT_TABLE } from '../dist/plan.js';

const SCHEMA = process.env.LIVE_SCHEMA ?? 'public';
const SUBJECT = 4471;

test.after(async () => {
  await closePool();
});

test('foreign key graph reports the declared ON DELETE actions', async () => {
  const fks = await withClient((c) => loadForeignKeys(c, SCHEMA));
  const byChild = Object.fromEntries(fks.map((f) => [f.child_table, f]));

  assert.equal(byChild.orders.on_delete, 'CASCADE');
  assert.equal(byChild.order_items.on_delete, 'CASCADE');
  assert.equal(byChild.addresses.on_delete, 'CASCADE');
  assert.equal(byChild.support_tickets.on_delete, 'SET NULL');
  assert.equal(byChild.audit_log.on_delete, 'SET NULL');

  // Regression: attname is Postgres type `name`, so an uncast array_agg comes
  // back as the raw string "{customer_id}" rather than an array. Every caller
  // maps over these, so the failure is total and only shows up at runtime.
  for (const fk of fks) {
    assert.ok(Array.isArray(fk.child_columns), `${fk.child_table}.child_columns must be an array`);
    assert.ok(Array.isArray(fk.parent_columns), `${fk.child_table}.parent_columns must be an array`);
  }
  assert.deepEqual(byChild.orders.child_columns, ['customer_id']);
  assert.deepEqual(byChild.orders.parent_columns, ['id']);
});

test('linkage resolves order_items transitively through orders', async () => {
  const fks = await withClient((c) => loadForeignKeys(c, SCHEMA));
  const linkage = resolveLinkage(fks, ROOT_TABLE);

  const orders = linkage.get('orders');
  assert.equal(orders.kind, 'direct');
  assert.deepEqual(orders.via, ['customers', 'orders']);

  const items = linkage.get('order_items');
  assert.equal(items.kind, 'transitive');
  assert.deepEqual(items.via, ['customers', 'orders', 'order_items']);

  // Both hops are CASCADE, so deleting the customer reaches order_items.
  // This is the property that makes the naive plan illegal.
  assert.equal(items.cascades_from_root, true);

  // SET NULL breaks the cascade chain even though the table is reachable.
  assert.equal(linkage.get('support_tickets').cascades_from_root, false);
});

test('subject predicate selects exactly the subject rows', async () => {
  const fks = await withClient((c) => loadForeignKeys(c, SCHEMA));
  const linkage = resolveLinkage(fks, ROOT_TABLE);

  await withClient(async (c) => {
    const where = subjectPredicate(SCHEMA, linkage.get('order_items'), 'id');
    const { rows } = await c.query(
      `SELECT COUNT(*)::int8 AS n FROM "${SCHEMA}".order_items WHERE ${where}`,
      [SUBJECT],
    );
    assert.equal(rows[0].n, 7);
  });
});

test('the naive plan destroys rows a retention policy protects', async () => {
  const fks = await withClient((c) => loadForeignKeys(c, SCHEMA));
  const linkage = resolveLinkage(fks, ROOT_TABLE);
  const plan = buildNaivePlan(SUBJECT);

  const measured = await withRollback(async (c) => {
    const before = {
      orders: await countRows(c, SCHEMA, 'orders'),
      order_items: await countRows(c, SCHEMA, 'order_items'),
      addresses: await countRows(c, SCHEMA, 'addresses'),
    };
    await applyPlan(c, SCHEMA, plan, linkage);
    return {
      orders: before.orders - (await countRows(c, SCHEMA, 'orders')),
      order_items: before.order_items - (await countRows(c, SCHEMA, 'order_items')),
      addresses: before.addresses - (await countRows(c, SCHEMA, 'addresses')),
    };
  });

  // The plan names only `customers`; everything here died by cascade.
  assert.equal(measured.orders, 3);
  assert.equal(measured.order_items, 7);
  assert.equal(measured.addresses, 3);
});

test('rehearsal leaves no trace: the rollback really rolls back', async () => {
  const before = await withClient((c) => countRows(c, SCHEMA, 'orders'));

  await withRollback(async (c) => {
    const fks = await loadForeignKeys(c, SCHEMA);
    const linkage = resolveLinkage(fks, ROOT_TABLE);
    await applyPlan(c, SCHEMA, buildNaivePlan(SUBJECT), linkage);
    assert.notEqual(await countRows(c, SCHEMA, 'orders'), before);
  });

  assert.equal(await withClient((c) => countRows(c, SCHEMA, 'orders')), before);
});

test('the revised plan erases PII while preserving the retained rows', async () => {
  const fks = await withClient((c) => loadForeignKeys(c, SCHEMA));
  const linkage = resolveLinkage(fks, ROOT_TABLE);

  // Anonymising `customers` rather than deleting it is what keeps the CASCADE
  // from ever reaching orders. The columns come from the policy table, not
  // from this test's opinion about which columns are personal.
  const policy = await withClient(async (c) => {
    const { rows } = await c.query(
      `SELECT anonymise_columns FROM "${SCHEMA}".retention_policies WHERE table_name = 'customers'`,
    );
    return rows[0].anonymise_columns;
  });

  const plan = {
    subject_id: SUBJECT,
    mode: 'revised',
    steps: [
      { table: 'customers', action: 'anonymise', columns: policy },
      { table: 'addresses', action: 'delete' },
      { table: 'uploads', action: 'delete' },
    ],
  };
  validatePlan(plan);

  const measured = await withRollback(async (c) => {
    const beforeOrders = await countRows(c, SCHEMA, 'orders');
    const beforeItems = await countRows(c, SCHEMA, 'order_items');

    const counts = await applyPlan(c, SCHEMA, plan, linkage);

    const { rows } = await c.query(
      `SELECT email, full_name, phone FROM "${SCHEMA}".customers WHERE id = $1`,
      [SUBJECT],
    );

    return {
      counts,
      ordersLost: beforeOrders - (await countRows(c, SCHEMA, 'orders')),
      itemsLost: beforeItems - (await countRows(c, SCHEMA, 'order_items')),
      customer: rows[0],
    };
  });

  // The legally required records survive.
  assert.equal(measured.ordersLost, 0);
  assert.equal(measured.itemsLost, 0);

  // The personal data does not.
  assert.equal(measured.counts.rows_deleted_per_table.addresses, 3);
  assert.equal(measured.counts.rows_deleted_per_table.uploads, 2);
  assert.equal(measured.counts.rows_anonymised_per_table.customers, 1);

  // The customer row is still there, and is no longer identifying.
  assert.ok(measured.customer, 'customer row must be preserved to hold the FK');
  for (const col of ['email', 'full_name', 'phone']) {
    assert.match(measured.customer[col], /^\[redacted-/, `${col} must be redacted`);
  }
});

test('transaction timeouts are actually applied inside the transaction', async () => {
  // Regression: SET LOCAL issued before BEGIN only warns and leaves the
  // timeout unlimited, so the ceilings protecting the gated write were inert.
  const seen = await withRollback(async (c) => {
    const { rows } = await c.query('SHOW statement_timeout');
    const lock = await c.query('SHOW lock_timeout');
    return { statement: rows[0].statement_timeout, lock: lock.rows[0].lock_timeout };
  });

  assert.notEqual(seen.statement, '0', 'statement_timeout must not be unlimited');
  assert.notEqual(seen.lock, '0', 'lock_timeout must not be unlimited');
});

test('validatePlan rejects an anonymise step with no columns', () => {
  assert.throws(
    () =>
      validatePlan({
        subject_id: 1,
        mode: 'revised',
        steps: [{ table: 'customers', action: 'anonymise' }],
      }),
    /must list the columns/,
  );
});

test('validatePlan rejects two steps for the same table', () => {
  assert.throws(
    () =>
      validatePlan({
        subject_id: 1,
        mode: 'revised',
        steps: [
          { table: 'customers', action: 'delete' },
          { table: 'customers', action: 'anonymise', columns: ['email'] },
        ],
      }),
    /two steps for table/,
  );
});

test('applyPlan refuses a table with no path to the subject', async () => {
  const fks = await withClient((c) => loadForeignKeys(c, SCHEMA));
  const linkage = resolveLinkage(fks, ROOT_TABLE);

  await assert.rejects(
    () =>
      withRollback((c) =>
        applyPlan(
          c,
          SCHEMA,
          {
            subject_id: SUBJECT,
            mode: 'revised',
            steps: [{ table: 'retention_policies', action: 'delete' }],
          },
          linkage,
        ),
      ),
    /no foreign-key path/,
  );
});
