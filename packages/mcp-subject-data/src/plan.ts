import { type Client, ident, qualify } from './db.js';
import { type Linkage, primaryKeyColumns, subjectPredicate } from './graph.js';
import type { DeletionPlan, PlanStep } from './types.js';

/**
 * Applying a deletion plan.
 *
 * The same code path runs the rehearsal (against the shadow schema, inside a
 * transaction that is always rolled back) and the approved execution
 * (against live data, inside a transaction that commits). That is deliberate:
 * if the two diverged, the measured blast radius would stop being evidence
 * about what execution will do.
 */

/** The table a subject is rooted at. Everything else is reached from here. */
export const ROOT_TABLE = 'customers';

export interface ApplyCounts {
  rows_deleted_per_table: Record<string, number>;
  rows_anonymised_per_table: Record<string, number>;
}

/**
 * The obvious plan a human writes first: delete the customer row and let the
 * database's declared foreign-key actions sort out the rest.
 *
 * This is the plan that turns out to be illegal. We build it rather than
 * describing it, so the rehearsal measures the real thing.
 */
export function buildNaivePlan(subjectId: number): DeletionPlan {
  return {
    subject_id: subjectId,
    mode: 'naive',
    steps: [{ table: ROOT_TABLE, action: 'delete' }],
  };
}

export function validatePlan(plan: DeletionPlan): void {
  if (!Number.isInteger(plan.subject_id)) {
    throw new Error('plan.subject_id must be an integer');
  }
  if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
    throw new Error('plan.steps must be a non-empty array');
  }
  const seen = new Set<string>();
  for (const step of plan.steps) {
    if (seen.has(step.table)) {
      throw new Error(`plan has two steps for table "${step.table}"`);
    }
    seen.add(step.table);

    if (step.action !== 'delete' && step.action !== 'anonymise') {
      throw new Error(
        `step for "${step.table}" has unknown action "${step.action}"`,
      );
    }
    if (step.action === 'anonymise' && (step.columns ?? []).length === 0) {
      throw new Error(
        `anonymise step for "${step.table}" must list the columns to overwrite`,
      );
    }
  }
}

/** Column types for a table, so redaction can pick a value that fits. */
async function columnTypes(
  client: Client,
  schema: string,
  table: string,
): Promise<Map<string, { type: string; nullable: boolean }>> {
  const { rows } = await client.query<{
    column_name: string;
    data_type: string;
    is_nullable: string;
  }>(
    `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2`,
    [schema, table],
  );
  return new Map(
    rows.map((r) => [
      r.column_name,
      { type: r.data_type, nullable: r.is_nullable === 'YES' },
    ]),
  );
}

const TEXT_TYPES = new Set([
  'text',
  'character varying',
  'character',
  'citext',
]);

/**
 * The value an anonymised column is overwritten with.
 *
 * Text columns get a marker derived from the row's primary key. Deriving it
 * from the key keeps unique constraints satisfiable (two anonymised rows do
 * not collide) and keeps the result obviously synthetic on inspection.
 * Anything else is nulled where the column allows it.
 */
function redactionExpression(
  columnName: string,
  info: { type: string; nullable: boolean } | undefined,
  pkColumns: string[],
): string {
  if (!info) {
    throw new Error(`cannot anonymise unknown column "${columnName}"`);
  }
  if (TEXT_TYPES.has(info.type)) {
    const keyExpr =
      pkColumns.length > 0
        ? pkColumns.map((c) => `${ident(c)}::text`).join(` || '-' || `)
        : `'row'`;
    return `'[redacted-' || ${keyExpr} || ']'`;
  }
  if (info.nullable) return 'NULL';
  throw new Error(
    `column "${columnName}" is NOT NULL and not text; ` +
      `it cannot be anonymised in place — delete the row or widen the policy`,
  );
}

/**
 * Execute every step of `plan` against `schema` on the given client.
 *
 * The caller owns the transaction, and therefore owns whether this is a
 * rehearsal or a commitment. This function does not know which it is.
 */
export async function applyPlan(
  client: Client,
  schema: string,
  plan: DeletionPlan,
  linkage: Map<string, Linkage>,
): Promise<ApplyCounts> {
  validatePlan(plan);

  const rootPk = await primaryKeyColumns(client, schema, ROOT_TABLE);
  if (rootPk.length !== 1) {
    throw new Error(
      `${ROOT_TABLE} must have a single-column primary key, found ${rootPk.length}`,
    );
  }
  const rootKey = rootPk[0]!;

  const deleted: Record<string, number> = {};
  const anonymised: Record<string, number> = {};

  // Anonymise before deleting. A row that is both kept and de-identified must
  // be rewritten while it still exists; doing it the other way round would
  // silently no-op after a cascade had already removed the row.
  const ordered = [...plan.steps].sort((a, b) =>
    a.action === b.action ? 0 : a.action === 'anonymise' ? -1 : 1,
  );

  for (const step of ordered) {
    const link = linkage.get(step.table);
    if (!link) {
      throw new Error(
        `table "${step.table}" has no foreign-key path to ${ROOT_TABLE}; ` +
          `refusing to guess which rows belong to the subject`,
      );
    }
    const where = subjectPredicate(schema, link, rootKey);

    if (step.action === 'delete') {
      const res = await client.query(
        `DELETE FROM ${qualify(schema, step.table)} WHERE ${where}`,
        [plan.subject_id],
      );
      deleted[step.table] = res.rowCount ?? 0;
    } else {
      anonymised[step.table] = await anonymiseStep(
        client,
        schema,
        step,
        where,
        plan.subject_id,
      );
    }
  }

  return { rows_deleted_per_table: deleted, rows_anonymised_per_table: anonymised };
}

async function anonymiseStep(
  client: Client,
  schema: string,
  step: PlanStep,
  where: string,
  subjectId: number,
): Promise<number> {
  const types = await columnTypes(client, schema, step.table);
  const pk = await primaryKeyColumns(client, schema, step.table);

  const assignments = (step.columns ?? []).map((col) => {
    const expr = redactionExpression(col, types.get(col), pk);
    return `${ident(col)} = ${expr}`;
  });

  const res = await client.query(
    `UPDATE ${qualify(schema, step.table)} SET ${assignments.join(', ')} WHERE ${where}`,
    [subjectId],
  );
  return res.rowCount ?? 0;
}
