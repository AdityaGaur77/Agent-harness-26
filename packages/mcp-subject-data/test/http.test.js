/**
 * End-to-end tests over real HTTP.
 *
 * The point of this file is the annotation check. TrueForge decides whether to
 * stop and ask a human by reading `destructiveHint` off the wire — not off our
 * source. A refactor that drops the annotation, or a transport change that
 * strips it, removes the human from the loop and breaks nothing else: every
 * other test in this repo would still pass. So this asserts on the bytes the
 * harness actually receives.
 *
 * Requires DATABASE_URL pointing at a database loaded with
 * test/fixtures/schema.sql.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.MCP_AUTH_TOKEN ??= 'test-token-not-a-secret';

const { app } = await import('../dist/index.js');
const { closePool } = await import('../dist/db.js');

const TOKEN = process.env.MCP_AUTH_TOKEN;

const server = await new Promise((resolve) => {
  const s = app.listen(0, () => resolve(s));
});
const BASE = `http://127.0.0.1:${server.address().port}`;

test.after(async () => {
  await new Promise((r) => server.close(r));
  await closePool();
});

/** One JSON-RPC call. The transport answers as SSE, so unwrap the data frame. */
async function rpc(method, params = {}, { token = TOKEN } = {}) {
  const res = await fetch(`${BASE}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) return { status: res.status, body: null };

  const text = await res.text();
  const frame = text
    .split('\n')
    .filter((l) => l.startsWith('data: '))
    .map((l) => l.slice(6))
    .join('');
  return { status: res.status, body: JSON.parse(frame) };
}

/** Tool calls return their payload as a JSON string inside content[0]. */
async function callTool(name, args = {}) {
  const { body } = await rpc('tools/call', { name, arguments: args });
  const result = body.result;
  if (result.isError) throw new Error(result.content[0].text);
  return JSON.parse(result.content[0].text);
}

test('health check needs no credentials', async () => {
  const res = await fetch(`${BASE}/healthz`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
});

test('the MCP endpoint rejects a missing or wrong bearer token', async () => {
  assert.equal((await rpc('tools/list', {}, { token: null })).status, 401);
  assert.equal((await rpc('tools/list', {}, { token: 'wrong' })).status, 401);
  // Same length as the real token, to exercise the constant-time comparison
  // rather than the length short-circuit.
  assert.equal(
    (await rpc('tools/list', {}, { token: 'x'.repeat(TOKEN.length) })).status,
    401,
  );
});

test('GET and DELETE are refused: the server is stateless', async () => {
  for (const method of ['GET', 'DELETE']) {
    const res = await fetch(`${BASE}/mcp`, {
      method,
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    assert.equal(res.status, 405, `${method} must be 405`);
    assert.equal(res.headers.get('allow'), 'POST');
  }
});

test('EXACTLY ONE tool is destructive, and it is execute_deletion', async () => {
  const { body } = await rpc('tools/list');
  const tools = body.result.tools;

  const destructive = tools
    .filter((t) => t.annotations?.destructiveHint === true)
    .map((t) => t.name);

  // If this ever fails, the human is no longer in the loop. Do not "fix" it by
  // updating the expectation — find out which tool changed and why.
  assert.deepEqual(destructive, ['execute_deletion']);

  // Everything the agent runs unattended must be genuinely safe to run
  // unattended: read-only, or scoped to the throwaway shadow schema.
  const shadowWriters = new Set(['snapshot_to_shadow', 'rehearse_deletion']);
  for (const tool of tools) {
    if (tool.name === 'execute_deletion') continue;
    const a = tool.annotations ?? {};
    assert.equal(a.destructiveHint, false, `${tool.name} must not be destructive`);
    if (!shadowWriters.has(tool.name)) {
      assert.equal(a.readOnlyHint, true, `${tool.name} must be read-only`);
    }
  }
});

test('execute_deletion refuses an unrehearsed plan', async () => {
  const { body } = await rpc('tools/call', {
    name: 'execute_deletion',
    arguments: {
      plan: { subject_id: 4471, mode: 'naive', steps: [{ table: 'customers', action: 'delete' }] },
      confirm_subject_id: 4471,
      rehearsed: false,
    },
  });
  assert.equal(body.result.isError, true);
  assert.match(body.result.content[0].text, /unrehearsed/i);
});

test('execute_deletion refuses a mismatched subject id', async () => {
  const { body } = await rpc('tools/call', {
    name: 'execute_deletion',
    arguments: {
      plan: { subject_id: 4471, mode: 'naive', steps: [{ table: 'customers', action: 'delete' }] },
      confirm_subject_id: 9999,
      rehearsed: true,
    },
  });
  assert.equal(body.result.isError, true);
  assert.match(body.result.content[0].text, /does not match/i);
});

test('the naive plan rehearses as NOT ok, with the conflict discovered from data', async () => {
  await callTool('snapshot_to_shadow');
  const r = await callTool('rehearse_deletion', { subject_id: 4471, mode: 'naive' });

  // Completed without a database error...
  assert.deepEqual(r.constraints_blocked, []);
  // ...and is still illegal. That distinction is the whole project.
  assert.equal(r.ok, false);

  assert.ok(r.cascades_fired.includes('orders'));
  assert.ok(r.cascades_fired.includes('order_items'));

  const violated = r.retention_violations.map((v) => v.table_name).sort();
  assert.deepEqual(violated, ['order_items', 'orders']);
  for (const v of r.retention_violations) {
    assert.ok(v.retain_years > 0);
    assert.equal(v.via_cascade, true);
  }
});

test('the revised plan rehearses clean', async () => {
  await callTool('snapshot_to_shadow');

  // The columns come from the policy table, not from this test's opinion.
  const policies = await callTool('get_retention_policies');
  const customerPolicy = policies.find((p) => p.table_name === 'customers');

  const r = await callTool('rehearse_deletion', {
    subject_id: 4471,
    mode: 'revised',
    plan: {
      subject_id: 4471,
      mode: 'revised',
      steps: [
        { table: 'customers', action: 'anonymise', columns: customerPolicy.anonymise_columns },
        { table: 'addresses', action: 'delete' },
        { table: 'uploads', action: 'delete' },
      ],
    },
  });

  assert.equal(r.ok, true);
  assert.deepEqual(r.retention_violations, []);
  assert.deepEqual(r.cascades_fired, []);
  assert.equal(r.rows_anonymised_per_table.customers, 1);
  assert.equal(r.rows_deleted_per_table.addresses, 3);
});

test('rehearse_deletion will not invent the revision itself', async () => {
  const { body } = await rpc('tools/call', {
    name: 'rehearse_deletion',
    arguments: { subject_id: 4471, mode: 'revised' },
  });
  assert.equal(body.result.isError, true);
});

test('find_subject_data locates the subject across the FK graph', async () => {
  const found = await callTool('find_subject_data', { subject_id: 4471 });
  const byTable = Object.fromEntries(found.map((f) => [f.table_name, f]));

  assert.equal(byTable.orders.row_count, 3);
  assert.equal(byTable.order_items.row_count, 7);
  assert.equal(byTable.order_items.link_kind, 'transitive');
  assert.deepEqual(byTable.order_items.via, ['customers', 'orders', 'order_items']);
  assert.ok(!('retention_policies' in byTable));
});
