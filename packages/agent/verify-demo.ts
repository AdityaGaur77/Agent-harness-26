import { loadEnvFile } from "node:process";
import { TrueForge } from "@truefoundry/trueforge-sdk";

const DEMO_PROMPT = "Find information on Customer 4471";

interface RecordedCall {
  args: Record<string, any>;
  input?: Record<string, any>;
  systemName: string;
  toolName?: string;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function loadRootEnv(): void {
  try {
    loadEnvFile(new URL("../../.env", import.meta.url));
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
}

function parseJson(value: string): Record<string, any> {
  return JSON.parse(value) as Record<string, any>;
}

function parseMcpResponse(value: string): Record<string, any> {
  const outer = parseJson(value);
  const text = outer.content?.[0]?.text;
  return typeof text === "string" ? parseJson(text) : outer;
}

async function main(): Promise<void> {
  loadRootEnv();

  const baseUrl = process.env.TRUEFORGE_BASE_URL?.trim() || "http://127.0.0.1:8791";
  const token = process.env.TRUEFORGE_TOKEN?.trim() || "local-dev";
  const client = new TrueForge({ baseUrl, token });

  const created = await client.sessions.create({ agent: { name: "blast-radius" } });
  const sessionId = created.data.id;
  console.log(`TrueForge session: ${sessionId}`);
  console.log(`Prompt: ${DEMO_PROMPT}`);

  const stream = await client.sessions.createTurnStream(sessionId, {
    input: [{ type: "user.message", content: DEMO_PROMPT }],
    previousTurnId: "none",
  });
  for await (const event of stream) {
    if (event.type === "mcp.auth_required") {
      throw new Error("The subject-data connector needs authentication.");
    }
    if (event.type === "tool.response_required") {
      throw new Error("The agent stopped for an unexpected user response.");
    }
  }

  // The streamed terminal event can arrive just before every persisted event
  // is visible through listEvents.
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  const page = await client.sessions.listEvents(sessionId, { limit: 100 });
  const events = page.data.map((item) => item.event).reverse();
  const calls = new Map<string, RecordedCall>();

  for (const event of events) {
    if (event.type !== "model.message") continue;
    for (const call of event.toolCalls ?? []) {
      const args = parseJson(call.function.arguments);
      calls.set(call.id, {
        args,
        systemName: call.function.name,
        toolName: typeof args.tool_name === "string" ? args.tool_name : undefined,
        input: args.input as Record<string, any> | undefined,
      });
    }
  }

  const invokedTools = [...calls.values()]
    .filter((call) => call.systemName === "call_tool")
    .map((call) => call.toolName);
  const sandboxCommands = [...calls.values()]
    .filter((call) => call.systemName === "exec")
    .map((call) => JSON.stringify(call.args))
    .join("\n");
  for (const required of [
    "inspect_schema",
    "list_foreign_keys",
    "get_retention_policies",
    "find_subject_data",
    "snapshot_to_shadow",
    "rehearse_deletion",
  ]) {
    assert(
      invokedTools.includes(required) || sandboxCommands.includes(required),
      `Missing required tool execution: ${required}`,
    );
  }

  let discovery: Record<string, any> | undefined;
  let retention: Record<string, any> | undefined;
  const rehearsals: Record<string, any>[] = [];
  let sandboxOutput = "";
  for (const event of events) {
    if (event.type !== "tool.response") continue;
    const call = calls.get(event.toolCallId);
    if (call?.systemName === "exec") {
      sandboxOutput += `\n${event.content}`;
    }
    if (!call?.toolName || call.systemName !== "call_tool") continue;
    const body = parseMcpResponse(event.content);
    if (call.toolName === "find_subject_data") discovery = body;
    if (call.toolName === "get_retention_policies") retention = body;
    if (call.toolName === "rehearse_deletion") rehearsals.push(body);
  }

  if (discovery && retention && rehearsals.length === 2) {
    assert(discovery.total_rows_referencing_subject === 59, "Discovery did not find 59 rows.");
    const discoveredCounts = Object.fromEntries(
      (discovery.tables_with_subject_data as Record<string, any>[]).map((row) => [
        row.table,
        row.rows,
      ]),
    );
    assert(
      JSON.stringify(discoveredCounts) ===
        JSON.stringify({
          order_items: 40,
          orders: 8,
          audit_log: 4,
          addresses: 3,
          uploads: 2,
          customers: 1,
          support_tickets: 1,
        }),
      "Customer 4471's per-table counts do not match the demo fixture.",
    );

    const policies = retention.retention_policies as Record<string, any>[] | undefined;
    assert(policies?.length === 4, "The demo must expose exactly four retention policies.");

    const [naive, clean] = rehearsals;
    assert(naive.production_touched === false, "The naive rehearsal touched production.");
    assert(naive.summary?.total_rows_removed === 59, "The naive rehearsal did not remove 59 shadow rows.");
    assert(naive.summary?.would_be_illegal === true, "The naive rehearsal did not expose the conflict.");
    assert(naive.execution_token === null, "The illegal plan incorrectly received a token.");
    assert(
      naive.retention_violations?.reduce(
        (total: number, violation: Record<string, any>) => total + violation.rows_destroyed,
        0,
      ) === 48,
      "The naive rehearsal did not report 48 protected rows.",
    );

    assert(clean.production_touched === false, "The clean rehearsal touched production.");
    assert(clean.summary?.total_rows_removed === 10, "The clean rehearsal did not remove 10 shadow rows.");
    assert(clean.summary?.total_anonymised === 1, "The clean rehearsal did not anonymise one shadow row.");
    assert(clean.summary?.would_be_illegal === false, "The revised plan was not clean.");
    assert(clean.retention_violations?.length === 0, "The revised plan still has retention violations.");
    assert(typeof clean.execution_token === "string", "The clean rehearsal did not issue a token.");
  } else {
    // With Daytona enabled, capable models may run the MCP client from the
    // sandbox and keep the full JSON in files instead of returning it through
    // call_tool events. Validate the persisted summaries and both workflows.
    for (const expected of [
      "Total referencing subject: 59",
      "order_items: rows=40",
      "orders: rows=8",
      "audit_log: rows=4",
      "addresses: rows=3",
      "uploads: rows=2",
      "customers: rows=1",
      "support_tickets: rows=1",
      "orders: basis=tax; retain_years=7",
      "order_items: basis=tax; retain_years=7",
    ]) {
      assert(sandboxOutput.includes(expected), `Daytona output is missing: ${expected}`);
    }
    const rehearsalExecutions = sandboxCommands.match(/rehearse_deletion/g)?.length ?? 0;
    assert(rehearsalExecutions >= 2, "Daytona did not run both rehearsals.");
    assert(sandboxOutput.includes("production_touched"), "Rehearsal output did not confirm production safety.");
    assert(sandboxOutput.includes("execution_token"), "The clean rehearsal did not produce token evidence.");
  }

  const approval = events.find((event) => event.type === "tool.approval_required");
  assert(approval?.type === "tool.approval_required", "TrueForge did not pause at the approval gate.");
  const gatedCall = calls.get(approval.toolCalls[0].id);
  assert(gatedCall?.toolName === "execute_deletion", "The gated tool was not execute_deletion.");
  const gatedSteps = gatedCall.input?.plan?.steps as Record<string, any>[] | undefined;
  assert(
    JSON.stringify(gatedSteps?.map(({ table, action }) => ({ table, action }))) ===
      JSON.stringify([
        { table: "addresses", action: "hard_delete" },
        { table: "uploads", action: "hard_delete" },
        { table: "support_tickets", action: "hard_delete" },
        { table: "audit_log", action: "hard_delete" },
        { table: "customers", action: "anonymise" },
      ]),
    "The approval gate does not contain the expected five-action clean plan.",
  );

  console.log("PASS: 59 rows discovered (40 items, 8 orders, 4 audit, 3 addresses, 2 uploads, 1 customer, 1 ticket).");
  if (rehearsals.length === 2) {
    console.log("PASS: naive rehearsal removed 59 shadow rows and caught 48 protected rows.");
    console.log("PASS: revised rehearsal removed 10 shadow rows, anonymised 1, and issued a token.");
  } else {
    console.log("PASS: Daytona recorded discovery plus naive and revised shadow rehearsals.");
  }
  console.log("PASS: execute_deletion is waiting for explicit human approval.");
  console.log("Safety stop: this verifier never approves or executes the pending action.");
}

main().catch((error) => {
  console.error("Demo verification failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
