import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const BASE_URL = process.env.MCP_URL || "http://127.0.0.1:8080";
const TOKEN = process.env.MCP_AUTH_TOKEN || "dev-token";
// Follow the same host port compose publishes, so the two defaults cannot
// drift apart: docker-compose.yml maps ${POSTGRES_HOST_PORT:-5432}:5432.
const PG_HOST_PORT = process.env.POSTGRES_HOST_PORT || "5432";
const DATABASE_URL =
  process.env.DATABASE_URL ||
  `postgresql://blast:blast@127.0.0.1:${PG_HOST_PORT}/blast_main`;

let passed = 0;
let failed = 0;

function check(name, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failed++;
    console.error(`FAIL  ${name}${detail ? ` :: ${detail}` : ""}`);
  }
}

function payload(result) {
  const text = result?.content?.[0]?.text ?? "";
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

/**
 * snapshot_to_shadow rebuilds the shadow database with
 * CREATE DATABASE ... TEMPLATE, and Postgres allows that only when nothing
 * else is connected to the template. The template here is production, so the
 * snapshot terminates every other backend on it — this client included.
 * Any admin query issued after a snapshot has to reconnect first.
 */
async function reconnectAdminIfDropped(admin) {
  try {
    await admin.query("SELECT 1");
    return admin;
  } catch {
    const fresh = new pg.Client({ connectionString: DATABASE_URL });
    fresh.on("error", () => undefined);
    await fresh.connect();
    return fresh;
  }
}

async function main() {
  let admin = new pg.Client({ connectionString: DATABASE_URL });
  admin.on("error", () => undefined);
  await admin.connect();
  const fixturePath = fileURLToPath(new URL("./fixture.sql", import.meta.url));
  await admin.query(readFileSync(fixturePath, "utf8"));
  console.log("fixture applied");

  const health = await fetch(`${BASE_URL}/healthz`);
  check("healthz responds 200 without auth", health.status === 200);

  const noAuth = await fetch(`${BASE_URL}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
  });
  check("POST /mcp without token rejected 401", noAuth.status === 401);

  const badAuth = await fetch(`${BASE_URL}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: "Bearer wrong-token",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
  });
  check("POST /mcp with wrong token rejected 401", badAuth.status === 401);

  const transport = new StreamableHTTPClientTransport(new URL(`${BASE_URL}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${TOKEN}` } },
  });
  const client = new Client({ name: "blast-radius-smoke", version: "0.1.0" });
  await client.connect(transport);
  check("MCP initialize + auth handshake over streamable HTTP", true);

  const tools = await client.listTools();
  const byName = Object.fromEntries(tools.tools.map((t) => [t.name, t]));

  const readOnlyNames = [
    "inspect_schema",
    "list_foreign_keys",
    "get_retention_policies",
    "find_subject_data",
    "snapshot_to_shadow",
    "rehearse_deletion",
  ];
  for (const name of readOnlyNames) {
    const ann = byName[name]?.annotations ?? {};
    check(
      `${name} is annotated READ_ONLY`,
      ann.readOnlyHint === true && ann.destructiveHint === false,
      JSON.stringify(ann),
    );
  }
  const exAnn = byName.execute_deletion?.annotations ?? {};
  check(
    "execute_deletion is the only DESTRUCTIVE tool",
    exAnn.destructiveHint === true && exAnn.readOnlyHint === false,
    JSON.stringify(exAnn),
  );
  check("exactly one destructive tool registered", tools.tools.length >= 7 && tools.tools.filter((t) => t.annotations?.destructiveHint).length === 1, `count=${tools.tools.length}`);

  if (byName.lookup_subject_by_name) {
    const ann = byName.lookup_subject_by_name.annotations ?? {};
    check("lookup_subject_by_name is annotated READ_ONLY", ann.readOnlyHint === true && ann.destructiveHint === false, JSON.stringify(ann));
    const lookup = payload(await client.callTool({ name: "lookup_subject_by_name", arguments: { full_name: "Jane Q Synthetic" } }));
    check("lookup by gov name finds 4471", (lookup.matches ?? []).some((m) => Number(m.id) === 4471), JSON.stringify(lookup.matches));
  }

  const schema = payload(await client.callTool({ name: "inspect_schema", arguments: {} }));
  check(
    "inspect_schema lists the trap tables",
    ["customers", "orders", "order_items", "retention_policies"].every((t) =>
      (schema.tables ?? []).some((x) => x.name === t),
    ),
  );

  const fks = payload(await client.callTool({ name: "list_foreign_keys", arguments: {} }));
  const orderFk = (fks.foreign_keys ?? []).find((e) => e.child_table === "orders");
  check(
    "list_foreign_keys shows orders -> customers ON DELETE CASCADE",
    orderFk?.parent_table === "customers" && orderFk?.on_delete === "CASCADE",
    JSON.stringify(orderFk),
  );

  const pols = payload(await client.callTool({ name: "get_retention_policies", arguments: {} }));
  const ordersPolicy = (pols.retention_policies ?? []).find((p) => p.table_name === "orders");
  check(
    "retention policy for orders reads tax/7 from the database",
    ordersPolicy?.basis === "tax" && Number(ordersPolicy?.retain_years) === 7,
    JSON.stringify(ordersPolicy),
  );

  const subject = payload(
    await client.callTool({ name: "find_subject_data", arguments: { subject_id: 4471 } }),
  );
  const rowsFor = (t) => (subject.tables_with_subject_data ?? []).find((x) => x.table === t)?.rows ?? 0;
  check(
    "find_subject_data walks the graph to order_items",
    rowsFor("orders") === 12 && rowsFor("order_items") === 12,
    JSON.stringify(subject.tables_with_subject_data),
  );

  const snap = payload(await client.callTool({ name: "snapshot_to_shadow", arguments: {} }));
  check("snapshot_to_shadow clones production", typeof snap.duration_ms === "number", JSON.stringify(snap));

  admin = await reconnectAdminIfDropped(admin);

  const naivePlan = {
    subject_id: 4471,
    steps: [{ table: "customers", action: "hard_delete", where: "id = :subject_id" }],
  };
  const naive = payload(
    await client.callTool({ name: "rehearse_deletion", arguments: { plan: naivePlan } }),
  );
  check(
    "NAIVE rehearsal: cascade fires into orders and order_items",
    (naive.cascades_fired ?? []).some((c) => c.table === "orders") &&
      (naive.cascades_fired ?? []).some((c) => c.table === "order_items"),
    JSON.stringify(naive.cascades_fired),
  );
  check(
    "NAIVE rehearsal: retention violations detected (tax basis)",
    (naive.retention_violations ?? []).some((v) => v.table === "orders" && v.retain_years === 7) &&
      (naive.retention_violations ?? []).some((v) => v.table === "order_items"),
    JSON.stringify(naive.retention_violations),
  );
  check(
    "NAIVE rehearsal: would_be_illegal=true",
    naive.summary?.would_be_illegal === true,
    JSON.stringify(naive.summary),
  );
  check(
    "NAIVE rehearsal: set-null rows measured as orphaned",
    (naive.rows_orphaned ?? []).reduce((s, o) => s + o.rows_orphaned, 0) === 9,
    JSON.stringify(naive.rows_orphaned),
  );

  // A `where` fragment is written by the model, and the only checks on it are
  // that it has no semicolons and mentions :subject_id. Mentioning is not
  // bounding: "customer_id = :subject_id OR true" satisfies both and matches
  // the whole table. The subject scope is therefore derived from the
  // foreign-key graph and ANDed onto every step, so a fragment can narrow a
  // step's reach but never widen it. Same code path runs in production.
  await client.callTool({ name: "snapshot_to_shadow", arguments: {} });
  const scopedOrders = payload(
    await client.callTool({
      name: "rehearse_deletion",
      arguments: {
        plan: {
          subject_id: 4471,
          steps: [{ table: "orders", action: "hard_delete", where: "customer_id = :subject_id" }],
        },
      },
    }),
  );
  const scopedCount = scopedOrders.steps_executed?.[0]?.rows_affected;

  for (const escape of [
    "customer_id = :subject_id OR true",
    "customer_id = :subject_id OR 1=1",
    "id > 0 AND :subject_id > 0",
  ]) {
    await client.callTool({ name: "snapshot_to_shadow", arguments: {} });
    const attempt = await client.callTool({
      name: "rehearse_deletion",
      arguments: {
        plan: { subject_id: 4471, steps: [{ table: "orders", action: "hard_delete", where: escape }] },
      },
    });
    const reached = attempt.isError ? 0 : payload(attempt).steps_executed?.[0]?.rows_affected;
    check(
      `scope clamp: "${escape}" cannot widen past the subject`,
      reached === scopedCount,
      `reached ${reached} rows, subject owns ${scopedCount}`,
    );
  }

  await client.callTool({ name: "snapshot_to_shadow", arguments: {} });
  admin = await reconnectAdminIfDropped(admin);

  const revisedPlan = {
    subject_id: 4471,
    steps: [
      {
        table: "order_items",
        action: "anonymise",
        where: "order_id IN (SELECT id FROM orders WHERE customer_id = :subject_id)",
        set: { sku: "[REDACTED]" },
      },
      {
        table: "orders",
        action: "anonymise",
        where: "customer_id = :subject_id",
        set: { billing_email: "[REDACTED]", customer_id: null },
      },
      { table: "customers", action: "hard_delete", where: "id = :subject_id" },
    ],
  };
  const revised = payload(
    await client.callTool({ name: "rehearse_deletion", arguments: { plan: revisedPlan } }),
  );
  check(
    "REVISED rehearsal: zero retention violations",
    (revised.retention_violations ?? []).length === 0 && revised.summary?.would_be_illegal === false,
    JSON.stringify(revised.retention_violations),
  );
  check(
    "REVISED rehearsal: retained rows anonymised, not destroyed",
    (revised.anonymised_rows_per_table?.orders ?? 0) === 12 &&
      (revised.anonymised_rows_per_table?.order_items ?? 0) === 12,
    JSON.stringify(revised.anonymised_rows_per_table),
  );
  check(
    "REVISED rehearsal: production untouched by rehearsal",
    revised.production_touched === false,
  );

  // The gate stops for a human, but the human approves a plan they were SHOWN.
  // In a real run the compliant plan hit a validation error, the agent fell
  // back to a smaller unrehearsed plan, and execute_deletion ran it —
  // destroying the tax rows the rehearsal had just protected. These check that
  // an unrehearsed or substituted plan can no longer reach production.
  const naiveSubstitute = {
    subject_id: 4471,
    steps: [{ table: "customers", action: "hard_delete", where: "id = :subject_id" }],
  };

  const noToken = await client.callTool({
    name: "execute_deletion",
    arguments: { plan: naiveSubstitute, execution_token: "rehearsed_made-up" },
  });
  check(
    "execute_deletion refuses a plan with no clean rehearsal on record",
    noToken.isError === true,
    JSON.stringify(noToken).slice(0, 200),
  );

  await client.callTool({ name: "snapshot_to_shadow", arguments: {} });
  admin = await reconnectAdminIfDropped(admin);
  const cleanRun = payload(
    await client.callTool({
      name: "rehearse_deletion",
      arguments: { plan: revisedPlan },
    }),
  );
  check(
    "a clean rehearsal issues an execution token",
    typeof cleanRun.execution_token === "string" && cleanRun.execution_token.length > 0,
    JSON.stringify(cleanRun.execution_token),
  );

  const swapped = await client.callTool({
    name: "execute_deletion",
    arguments: { plan: naiveSubstitute, execution_token: cleanRun.execution_token },
  });
  check(
    "a valid token cannot be redeemed against a DIFFERENT plan",
    swapped.isError === true,
    JSON.stringify(swapped).slice(0, 200),
  );

  const stillThere = await admin.query(
    "SELECT COUNT(*)::int AS n FROM orders WHERE customer_id = 4471",
  );
  check(
    "production untouched by the refused executions",
    stillThere.rows[0].n === 12,
    `orders=${stillThere.rows[0].n}`,
  );

  // An illegal plan must not even be offered a token.
  await client.callTool({ name: "snapshot_to_shadow", arguments: {} });
  admin = await reconnectAdminIfDropped(admin);
  const illegal = payload(
    await client.callTool({
      name: "rehearse_deletion",
      arguments: { plan: naivePlan },
    }),
  );
  check(
    "an illegal rehearsal issues NO execution token",
    illegal.summary.would_be_illegal === true && !illegal.execution_token,
    `would_be_illegal=${illegal.summary.would_be_illegal} token=${illegal.execution_token}`,
  );

  await client.callTool({ name: "snapshot_to_shadow", arguments: {} });
  admin = await reconnectAdminIfDropped(admin);
  const approved = payload(
    await client.callTool({
      name: "rehearse_deletion",
      arguments: { plan: revisedPlan },
    }),
  );

  const executed = payload(
    await client.callTool({
      name: "execute_deletion",
      arguments: { plan: revisedPlan, execution_token: approved.execution_token },
    }),
  );
  check("execute_deletion commits approved plan in production", executed.executed === true, JSON.stringify(executed));

  const cust = await admin.query("SELECT COUNT(*)::int AS n FROM customers WHERE id = 4471");
  check("production: customer PII hard-deleted", cust.rows[0].n === 0);
  const keptOrders = await admin.query(
    "SELECT COUNT(*)::int AS n FROM orders WHERE billing_email = '[REDACTED]' AND customer_id IS NULL",
  );
  check("production: tax-relevant orders retained with anonymised PII", keptOrders.rows[0].n === 12, `kept=${keptOrders.rows[0].n}`);
  const items = await admin.query(
    "SELECT COUNT(*)::int AS n FROM order_items WHERE sku = '[REDACTED]'",
  );
  check("production: order_items rows intact with anonymised sku", items.rows[0].n === 12, `items=${items.rows[0].n}`);

  await client.close();
  await admin.end().catch(() => undefined);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("smoke run crashed:", err);
  process.exit(1);
});
