import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DESTRUCTIVE } from "../annotations.js";
import { getPool } from "../db.js";
import { fail, ok } from "./shared.js";
import {
  deletionPlanSchema,
  PlanAbortedError,
  runDeletionPlan,
} from "./rehearse.js";

export function registerExecuteTool(server: McpServer): void {
  server.registerTool(
    "execute_deletion",
    {
      title: "Execute deletion",
      description:
        "Execute a deletion plan against PRODUCTION inside a single transaction (lock_timeout 5s, statement_timeout 60s). IRREVERSIBLE once committed. The harness pauses for human approval before this tool runs. Only call it with a plan whose shadow rehearsal reported would_be_illegal=false; if constraints block any step, the whole transaction is rolled back and nothing is lost.",
      inputSchema: {
        plan: deletionPlanSchema.describe(
          "The exact plan that was rehearsed on the shadow copy and approved by the human gate.",
        ),
      },
      annotations: DESTRUCTIVE,
    },
    async ({ plan }) => {
      const pool = getPool("main");
      const client = await pool.connect();
      try {
        const report = await runDeletionPlan(client, plan, {
          mode: "production",
          commit: true,
          abortOnConstraints: true,
        });
        return ok({ executed: true, ...report });
      } catch (err) {
        if (err instanceof PlanAbortedError) {
          return ok({
            executed: false,
            ...err.report,
          });
        }
        return fail(err);
      } finally {
        client.release();
      }
    },
  );
}
