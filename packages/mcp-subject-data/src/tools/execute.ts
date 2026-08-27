import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { DESTRUCTIVE } from '../annotations.js';
import { config } from '../config.js';
import { withTransaction } from '../db.js';
import { loadForeignKeys, resolveLinkage } from '../graph.js';
import { ROOT_TABLE, applyPlan, validatePlan } from '../plan.js';
import type { DeletionPlan, ExecutionResult } from '../types.js';

/**
 * The one gated tool.
 *
 * `execute_deletion` is the ONLY tool in this server carrying the
 * `DESTRUCTIVE` annotation, and that annotation is the whole security
 * boundary: TrueForge reads it and pauses the agent loop for a human
 * Allow/Deny before the call runs. Every other tool in this server is
 * read-only or writes to the throwaway shadow schema, so the agent runs
 * autonomously right up to this line and no further.
 *
 * Removing or downgrading the annotation below removes the human from the
 * loop entirely. Nothing else in the codebase re-adds them.
 */

const planSchema = z.object({
  subject_id: z.number().int(),
  mode: z.enum(['naive', 'revised']),
  steps: z
    .array(
      z.object({
        table: z.string(),
        action: z.enum(['delete', 'anonymise']),
        columns: z.array(z.string()).optional(),
      }),
    )
    .min(1),
});

const executeInput = {
  plan: planSchema,
  /**
   * Restated subject id. A plan travels through several turns and can be
   * edited between them; requiring the caller to name the subject a second
   * time turns "wrong person" from a silent outcome into a refusal.
   */
  confirm_subject_id: z.number().int(),
  /** The caller asserts this exact plan was rehearsed and came back clean. */
  rehearsed: z.boolean(),
};

const DESCRIPTION = [
  'Execute an approved erasure plan against live data and COMMIT it.',
  '',
  'This is irreversible. There is no undo, no rollback, and no second',
  'chance: rows removed here are gone and rows overwritten here cannot be',
  'restored from this system.',
  '',
  'A human must approve this call before it runs — the approval prompt is',
  'raised automatically, so do not try to route around it.',
  '',
  'Only call this after rehearse_deletion has run THIS plan and reported a',
  'clean result: no blocked constraints and no retention violations. The',
  'rehearsal measures the real blast radius against a shadow copy; anything',
  'it flags must be resolved by revising the plan and rehearsing again, not',
  'by arguing with the numbers. Which rows may be erased outright and which',
  'must be kept but de-identified is a property of the database, discovered',
  'by the discovery and rehearsal tools — never assumed.',
].join('\n');

function refuse(message: string): CallToolResult {
  return { isError: true, content: [{ type: 'text', text: message }] };
}

export function registerExecutionTools(server: McpServer): void {
  server.registerTool(
    'execute_deletion',
    {
      title: 'Execute deletion (irreversible)',
      description: DESCRIPTION,
      inputSchema: executeInput,
      // THE GATE. See annotations.ts — this is what makes TrueForge stop and
      // ask a human before the only irreversible write in the server.
      annotations: DESTRUCTIVE,
    },
    async ({ plan, confirm_subject_id, rehearsed }): Promise<CallToolResult> => {
      if (confirm_subject_id !== plan.subject_id) {
        return refuse(
          `Refusing to execute: confirm_subject_id (${confirm_subject_id}) does not ` +
            `match plan.subject_id (${plan.subject_id}). A plan edited between ` +
            `rehearsal and execution can end up pointed at the wrong person; ` +
            `re-read the plan, confirm whose data this is, and call again.`,
        );
      }

      if (rehearsed !== true) {
        return refuse(
          'Refusing to execute an unrehearsed plan. Run rehearse_deletion on ' +
            'this exact plan first and read the measured blast radius: which ' +
            'tables lose rows, which cascades fire, and which rows the database ' +
            'says must be kept. Executing a plan whose consequences have not ' +
            'been measured is precisely the failure this server exists to ' +
            'prevent. Once the rehearsal comes back clean, call again with ' +
            'rehearsed: true.',
        );
      }

      const deletionPlan: DeletionPlan = plan;

      try {
        validatePlan(deletionPlan);
      } catch (err) {
        return refuse(
          `Refusing to execute an invalid plan: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      // Operator-visible record of the irreversible act, on both sides of the
      // commit: the first line survives even if the transaction dies mid-way.
      console.error(
        `[execute_deletion] COMMITTING subject_id=${deletionPlan.subject_id} ` +
          `mode=${deletionPlan.mode} schema=${config.liveSchema} ` +
          `steps=${deletionPlan.steps.length}`,
      );

      try {
        // withTransaction commits on return and already applies the statement
        // and lock timeouts, so a pathological plan cannot wedge the database.
        const counts = await withTransaction(async (client) => {
          const fks = await loadForeignKeys(client, config.liveSchema);
          const linkage = resolveLinkage(fks, ROOT_TABLE);
          return applyPlan(client, config.liveSchema, deletionPlan, linkage);
        });

        const result: ExecutionResult = {
          subject_id: deletionPlan.subject_id,
          mode: deletionPlan.mode,
          executed_at: new Date().toISOString(),
          rows_deleted_per_table: counts.rows_deleted_per_table,
          rows_anonymised_per_table: counts.rows_anonymised_per_table,
          plan: deletionPlan,
          committed: true,
        };

        console.error(
          `[execute_deletion] COMMITTED subject_id=${result.subject_id} ` +
            `mode=${result.mode} at=${result.executed_at} ` +
            `deleted=${JSON.stringify(result.rows_deleted_per_table)} ` +
            `anonymised=${JSON.stringify(result.rows_anonymised_per_table)}`,
        );

        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          `[execute_deletion] ROLLED BACK subject_id=${deletionPlan.subject_id} ` +
            `mode=${deletionPlan.mode}: ${message}`,
        );
        return refuse(
          `Execution failed and the transaction was rolled back; live data is ` +
            `unchanged: ${message}`,
        );
      }
    },
  );
}
