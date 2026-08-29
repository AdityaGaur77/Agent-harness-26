import type { PoolClient } from "pg";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { READ_ONLY } from "../annotations.js";
import {
  columnsByTable,
  countRowsPerTable,
  getPool,
  getRetentionPolicies,
  listForeignKeys,
  listTables,
  quoteIdent,
  type ForeignKeyEdge,
  type Queryable,
} from "../db.js";
import { fail, ok } from "./shared.js";
import {
  buildSubjectScope,
  subjectScopePredicate,
  type SubjectScope,
} from "../subject-scope.js";

export const deletionStepSchema = z.object({
  table: z.string().min(1),
  action: z.enum(["hard_delete", "anonymise"]),
  where: z.string().min(1).optional(),
  set: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional(),
});

export const deletionPlanSchema = z.object({
  subject_id: z.number().int().positive(),
  steps: z.array(deletionStepSchema).min(1),
});

export type DeletionStep = z.infer<typeof deletionStepSchema>;
export type DeletionPlan = z.infer<typeof deletionPlanSchema>;

export interface StepOutcome {
  index: number;
  action: DeletionStep["action"];
  table: string;
  rows_affected: number;
  blocked_by_constraint?: string;
}

export interface RehearsalReport {
  mode: "shadow" | "production";
  committed: boolean;
  aborted?: boolean;
  steps_executed: StepOutcome[];
  rows_deleted_per_table: Record<string, number>;
  anonymised_rows_per_table: Record<string, number>;
  cascades_fired: Array<{ table: string; rows_removed: number; triggered_by: string }>;
  rows_orphaned: Array<{
    child_table: string;
    child_column: string;
    parent_table: string;
    rows_orphaned: number;
    rule: "SET NULL";
  }>;
  constraints_blocked: Array<{ table: string; step_index: number; constraint?: string; detail?: string }>;
  retention_violations: Array<{
    table: string;
    basis: string;
    retain_years: number;
    pii_columns: string[];
    anonymise_columns: string[];
    rows_destroyed: number;
  }>;
  summary: {
    tables_affected: number;
    total_rows_removed: number;
    total_anonymised: number;
    would_be_illegal: boolean;
  };
}

export class PlanAbortedError extends Error {
  readonly report: RehearsalReport;

  constructor(message: string, report: RehearsalReport) {
    super(message);
    this.name = "PlanAbortedError";
    this.report = report;
  }
}

function buildWhereSql(
  prefix: string,
  where: string,
  subjectId: number,
  table: string,
  scope: SubjectScope,
): { text: string; params: unknown[] } {
  const cleaned = where.trim().replace(/;+\s*$/, "");
  if (cleaned.includes(";")) {
    throw new Error(`"where" must be a single condition fragment (no statement separators)`);
  }
  if (!/:\s*subject_id\b/.test(cleaned)) {
    throw new Error(`"where" must reference :subject_id so every step stays scoped to the requested subject`);
  }

  // Mentioning :subject_id is not the same as being bounded by it —
  // `customer_id = :subject_id OR true` passes the check above and matches the
  // whole table. So the fragment is treated as a narrowing filter only, and
  // the actual scoping comes from the foreign-key graph, which the model
  // cannot influence. A step can narrow its reach; it can never widen it.
  const clamp = subjectScopePredicate(table, scope);
  if (clamp === null) {
    throw new Error(
      `table "${table}" has no foreign-key path to the subject root ` +
        `("${scope.rootTable}"), so its rows cannot be attributed to a subject; ` +
        `refusing to run this step rather than guessing its scope`,
    );
  }

  const text = `${prefix} WHERE (${cleaned.replace(/:\s*subject_id/g, "$1")}) AND (${clamp})`;
  return { text, params: [subjectId] };
}

function edgeKey(edge: ForeignKeyEdge): string {
  return `${edge.child_table}.${edge.child_column}->${edge.parent_table}`;
}

async function nullCountPerEdge(
  db: Queryable,
  edges: ForeignKeyEdge[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const edge of edges) {
    const { rows } = await db.query<{ n: string }>(
      `SELECT COUNT(*)::bigint AS n FROM ${quoteIdent(edge.child_table)} ` +
        `WHERE ${quoteIdent(edge.child_column)} IS NULL`,
    );
    counts.set(edgeKey(edge), Number(rows[0]?.n ?? 0));
  }
  return counts;
}

export async function runDeletionPlan(
  client: PoolClient,
  plan: DeletionPlan,
  opts: { mode: "shadow" | "production"; commit: boolean; abortOnConstraints: boolean },
): Promise<RehearsalReport> {
  const tables = await listTables(client);
  const known = new Set(tables);
  const columnsMap = await columnsByTable(client);

  let policies: Awaited<ReturnType<typeof getRetentionPolicies>> = [];
  try {
    policies = await getRetentionPolicies(client);
  } catch {
    policies = [];
  }

  const deleteTargets = new Set<string>();
  for (const [i, step] of plan.steps.entries()) {
    if (!known.has(step.table)) {
      throw new Error(`step ${i}: unknown table "${step.table}". Known tables: ${tables.join(", ")}`);
    }
    if (step.action === "hard_delete") {
      if (!step.where) throw new Error(`step ${i} (${step.table}): hard_delete requires a "where" clause`);
      deleteTargets.add(step.table);
    } else {
      if (!step.where) throw new Error(`step ${i} (${step.table}): anonymise requires a "where" clause`);
      if (!step.set || Object.keys(step.set).length === 0) {
        throw new Error(`step ${i} (${step.table}): anonymise requires a non-empty "set" of columns`);
      }
      const cols = columnsMap.get(step.table) ?? new Set<string>();
      for (const col of Object.keys(step.set)) {
        if (!cols.has(col)) {
          throw new Error(`step ${i}: unknown column "${col}" on table "${step.table}"`);
        }
      }
    }
  }

  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '60s'");

    const edges = await listForeignKeys(client);
    const subjectScope = buildSubjectScope(edges);
    const setNullEdges = edges.filter((e) => e.on_delete === "SET NULL" && known.has(e.child_table));

    const beforeCounts = await countRowsPerTable(client, tables);
    const beforeNull = await nullCountPerEdge(client, setNullEdges);

    const stepsExecuted: StepOutcome[] = [];
    const constraintsBlocked: RehearsalReport["constraints_blocked"] = [];

    for (const [i, step] of plan.steps.entries()) {
      const savepoint = `step_${i}`;
      await client.query(`SAVEPOINT ${savepoint}`);
      let outcome: StepOutcome;
      try {
        let affected: number;
        if (step.action === "hard_delete") {
          const built = buildWhereSql(`DELETE FROM ${quoteIdent(step.table)}`, step.where!, plan.subject_id, step.table, subjectScope);
          const res = await client.query(built.text, built.params);
          affected = res.rowCount ?? 0;
        } else {
          const setCols = Object.keys(step.set!);
          const assignments = setCols.map((col, j) => `${quoteIdent(col)} = $${j + 2}`);
          const base = `UPDATE ${quoteIdent(step.table)} SET ${assignments.join(", ")}`;
          const built = buildWhereSql(base, step.where!, plan.subject_id, step.table, subjectScope);
          const params = [plan.subject_id, ...setCols.map((col) => step.set![col])];
          const res = await client.query(built.text, params);
          affected = res.rowCount ?? 0;
        }
        await client.query(`RELEASE SAVEPOINT ${savepoint}`);
        outcome = { index: i, action: step.action, table: step.table, rows_affected: affected };
      } catch (err) {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        await client.query(`RELEASE SAVEPOINT ${savepoint}`);
        const pgErr = err as { code?: string; constraint?: string; detail?: string };
        if (pgErr?.code === "23503") {
          constraintsBlocked.push({
            table: step.table,
            step_index: i,
            constraint: pgErr.constraint,
            detail: pgErr.detail,
          });
          outcome = {
            index: i,
            action: step.action,
            table: step.table,
            rows_affected: 0,
            blocked_by_constraint: pgErr.constraint,
          };
        } else {
          throw err;
        }
      }
      stepsExecuted.push(outcome);
    }

    const afterCounts = await countRowsPerTable(client, tables);
    const afterNull = await nullCountPerEdge(client, setNullEdges);

    const rowsDeletedPerTable: Record<string, number> = {};
    const cascadesFired: RehearsalReport["cascades_fired"] = [];
    for (const table of tables) {
      const delta = beforeCounts.get(table)! - afterCounts.get(table)!;
      if (delta <= 0) continue;
      rowsDeletedPerTable[table] = delta;
      if (deleteTargets.has(table)) continue;
      const triggers = [
        ...new Set(
          edges
            .filter((e) => e.child_table === table && deleteTargets.has(e.parent_table))
            .map((e) => e.parent_table),
        ),
      ];
      cascadesFired.push({
        table,
        rows_removed: delta,
        triggered_by: triggers.length > 0 ? triggers.join(", ") : "upstream cascade",
      });
    }

    const rowsOrphaned: RehearsalReport["rows_orphaned"] = [];
    for (const edge of setNullEdges) {
      const key = edgeKey(edge);
      const newlyNull = afterNull.get(key)! - beforeNull.get(key)!;
      if (newlyNull > 0) {
        rowsOrphaned.push({
          child_table: edge.child_table,
          child_column: edge.child_column,
          parent_table: edge.parent_table,
          rows_orphaned: newlyNull,
          rule: "SET NULL",
        });
      }
    }

    const affectedTables = Object.keys(rowsDeletedPerTable);
    const retentionViolations: RehearsalReport["retention_violations"] = [];
    for (const table of affectedTables) {
      const policy = policies.find((p) => p.table_name === table);
      if (policy && Number(policy.retain_years) > 0) {
        retentionViolations.push({
          table,
          basis: policy.basis,
          retain_years: policy.retain_years,
          pii_columns: policy.pii_columns ?? [],
          anonymise_columns: policy.anonymise_columns ?? [],
          rows_destroyed: rowsDeletedPerTable[table],
        });
      }
    }

    const totalRemoved = Object.values(rowsDeletedPerTable).reduce((sum, n) => sum + n, 0);
    const report: RehearsalReport = {
      mode: opts.mode,
      committed: false,
      steps_executed: stepsExecuted,
      rows_deleted_per_table: rowsDeletedPerTable,
      anonymised_rows_per_table: {},
      cascades_fired: cascadesFired,
      rows_orphaned: rowsOrphaned,
      constraints_blocked: constraintsBlocked,
      retention_violations: retentionViolations,
      summary: {
        tables_affected: affectedTables.length,
        total_rows_removed: totalRemoved,
        total_anonymised: 0,
        would_be_illegal: retentionViolations.length > 0,
      },
    };
    for (const step of stepsExecuted) {
      if (step.action !== "anonymise") continue;
      report.anonymised_rows_per_table[step.table] =
        (report.anonymised_rows_per_table[step.table] ?? 0) + step.rows_affected;
    }
    report.summary.total_anonymised = Object.values(report.anonymised_rows_per_table).reduce(
      (sum, n) => sum + n,
      0,
    );

    if (opts.commit && opts.abortOnConstraints && constraintsBlocked.length > 0) {
      await client.query("ROLLBACK");
      report.aborted = true;
      throw new PlanAbortedError(
        `execution rolled back: ${constraintsBlocked.length} step(s) blocked by foreign-key constraints`,
        report,
      );
    }

    if (opts.commit) {
      await client.query("COMMIT");
    } else {
      await client.query("ROLLBACK");
    }
    report.committed = opts.commit;
    return report;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  }
}

export function registerRehearseTool(server: McpServer): void {
  server.registerTool(
    "rehearse_deletion",
    {
      title: "Rehearse deletion",
      description:
        "Execute a deletion plan against the SHADOW copy only, inside a transaction that is always rolled back afterwards. Measures what the same plan would do in production: rows_deleted_per_table, cascades_fired, rows_orphaned (ON DELETE SET NULL), constraints_blocked and retention_violations (rows that retention_policies legally protects and the plan would destroy). Call snapshot_to_shadow first. A plan is execution-ready only after a rehearsal reports would_be_illegal=false.",
      inputSchema: {
        plan: deletionPlanSchema.describe(
          "Ordered steps. hard_delete removes rows matching `where` (must reference :subject_id); anonymise overwrites the columns in `set` for matching rows instead of deleting them.",
        ),
      },
      annotations: READ_ONLY,
    },
    async ({ plan }) => {
      try {
        const pool = getPool("shadow");
        const client = await pool.connect();
        try {
          const report = await runDeletionPlan(client, plan, {
            mode: "shadow",
            commit: false,
            abortOnConstraints: false,
          });
          return ok({
            rehearsal: true,
            production_touched: false,
            ...report,
          });
        } finally {
          client.release();
        }
      } catch (err) {
        return fail(err);
      }
    },
  );
}
