import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DESTRUCTIVE } from "../annotations.js";
import { getPool } from "../db.js";
import { redeemExecutionToken } from "../rehearsal-registry.js";
import { fail, ok } from "./shared.js";
import {
  deletionPlanSchema,
  PlanAbortedError,
  runDeletionPlan,
} from "./rehearse.js";

/**
 * The one gated tool.
 *
 * `execute_deletion` is the only tool here carrying DESTRUCTIVE, which is what
 * makes the harness stop and ask a human before it runs. That pause is
 * necessary but it is not sufficient: the human approves a plan they were
 * shown, and something still has to guarantee that the plan they approved is
 * the plan that runs.
 *
 * It did not, once. The compliant plan hit a validation error, the agent
 * retried, then fell back to a smaller plan that had never been rehearsed, and
 * this tool executed it — destroying rows the rehearsal had just proven were
 * legally protected. The approval was real; the binding was missing.
 *
 * So execution now requires the token a clean rehearsal issues, and the plan
 * must fingerprint-match the one that rehearsal measured.
 */
export function registerExecuteTool(server: McpServer): void {
  server.registerTool(
    "execute_deletion",
    {
      title: "Execute deletion",
      description:
        "Execute a deletion plan against PRODUCTION inside a single transaction (lock_timeout 5s, statement_timeout 60s). IRREVERSIBLE once committed. A human must approve this call before it runs. " +
        "It requires `execution_token` from a rehearse_deletion run that reported would_be_illegal=false with nothing blocked, and the `plan` you pass must be byte-for-byte the plan that rehearsal measured. " +
        "There is no way to execute a plan that has not been rehearsed clean, and no way to substitute a different plan for the one the human approved. If the token is missing or the plan has changed, rehearse the plan you actually intend to run and use the token that rehearsal returns — do not retry with a simpler plan.",
      inputSchema: {
        plan: deletionPlanSchema.describe(
          "The exact plan that was rehearsed on the shadow copy and approved by the human gate.",
        ),
        execution_token: z
          .string()
          .min(1)
          .describe(
            "The execution_token returned by the clean rehearse_deletion run for this exact plan.",
          ),
      },
      annotations: DESTRUCTIVE,
    },
    async ({ plan, execution_token }) => {
      const check = redeemExecutionToken(execution_token, plan);
      if (!check.ok) {
        console.error(
          `[execute_deletion] REFUSED subject_id=${plan.subject_id}: ${check.reason}`,
        );
        return fail(
          new Error(`Refusing to execute against production: ${check.reason}`),
        );
      }

      console.error(
        `[execute_deletion] COMMITTING subject_id=${plan.subject_id} steps=${plan.steps.length}`,
      );

      const pool = getPool("main");
      const client = await pool.connect();
      try {
        const report = await runDeletionPlan(client, plan, {
          mode: "production",
          commit: true,
          abortOnConstraints: true,
        });
        console.error(
          `[execute_deletion] COMMITTED subject_id=${plan.subject_id} ` +
            `deleted=${JSON.stringify(report.rows_deleted_per_table)} ` +
            `anonymised=${JSON.stringify(report.anonymised_rows_per_table)}`,
        );
        return ok({ executed: true, ...report });
      } catch (err) {
        if (err instanceof PlanAbortedError) {
          console.error(
            `[execute_deletion] ROLLED BACK subject_id=${plan.subject_id}: constraints blocked`,
          );
          return ok({ executed: false, ...err.report });
        }
        console.error(
          `[execute_deletion] ROLLED BACK subject_id=${plan.subject_id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        return fail(err);
      } finally {
        client.release();
      }
    },
  );
}
