import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { SHADOW_WRITE } from '../annotations.js';
import { config } from '../config.js';
import {
  type Client,
  countRows,
  ident,
  listTables,
  qualify,
  withRollback,
  withTransaction,
} from '../db.js';
import {
  type Linkage,
  loadForeignKeys,
  primaryKeyColumns,
  resolveLinkage,
  subjectPredicate,
} from '../graph.js';
import { type ApplyCounts, ROOT_TABLE, applyPlan, buildNaivePlan, validatePlan } from '../plan.js';
import type {
  DeletionPlan,
  ForeignKey,
  RehearsalResult,
  RetentionViolation,
} from '../types.js';

/**
 * The rehearsal: build a throwaway copy of the database, destroy the subject's
 * data on it, and measure what went down with it.
 *
 * Neither tool here touches live data, so neither is gated. What they produce
 * is evidence rather than opinion — every number is a count taken either side
 * of a statement that really ran.
 */

/**
 * The five ON DELETE clauses Postgres can report. `loadForeignKeys` maps
 * `pg_constraint.confdeltype` through a lookup that falls back to the raw
 * catalogue code, so this allowlist — not that lookup — is what keeps an
 * unexpected value out of a SQL string that cannot be parameterised.
 */
const ON_DELETE_CLAUSES = new Set([
  'NO ACTION',
  'RESTRICT',
  'CASCADE',
  'SET NULL',
  'SET DEFAULT',
]);

/**
 * Where the retention rules live. This names the table, not its contents:
 * which tables are protected, on what legal basis, and for how many years is
 * read out of these rows at rehearsal time and never written down in code.
 */
const POLICY_TABLE = 'retention_policies';

/**
 * Integrity-constraint SQLSTATEs (class 23) that mean "the database refused
 * the plan", not "the server broke". A RESTRICT foreign key raises 23503 or
 * 23001; a SET NULL aimed at a NOT NULL column raises 23502. Both are exactly
 * the finding a rehearsal exists to surface, so they are reported as a result
 * rather than thrown as a failure.
 */
const CONSTRAINT_VIOLATION_CODES = new Set([
  '23000',
  '23001',
  '23502',
  '23503',
  '23505',
  '23514',
  '23P01',
]);

export function registerRehearsalTools(server: McpServer): void {
  registerSnapshotTool(server);
  registerRehearseTool(server);
}

// --------------------------------------------------------------------------
// snapshot_to_shadow
// --------------------------------------------------------------------------

function registerSnapshotTool(server: McpServer): void {
  server.registerTool(
    'snapshot_to_shadow',
    {
      title: 'Snapshot live data into the shadow schema',
      description:
        'Drop and rebuild the shadow schema as a structural and data clone of the live schema, ' +
        'foreign keys included, so a rehearsal has something real to destroy. ' +
        'Writes only to the shadow schema; the live schema is read but never modified. ' +
        'Run this before rehearse_deletion, and again whenever live data has moved on.',
      inputSchema: {},
      annotations: SHADOW_WRITE,
    },
    async () => {
      try {
        return jsonResult(await snapshotToShadow());
      } catch (err) {
        return errorResult(`snapshot_to_shadow failed: ${describe(err)}`);
      }
    },
  );
}

interface SnapshotSummary {
  shadow_schema: string;
  tables_copied: string[];
  rows_copied_per_table: Record<string, number>;
  foreign_keys_recreated: number;
  created_at: string;
}

async function snapshotToShadow(): Promise<SnapshotSummary> {
  const live = config.liveSchema;
  const shadow = config.shadowSchema;

  // The first statement below drops the shadow schema outright. If the two
  // names ever resolve to the same schema, that drop lands on production.
  if (live === shadow) {
    throw new Error(
      `LIVE_SCHEMA and SHADOW_SCHEMA are both "${live}"; refusing to drop the live schema`,
    );
  }

  // One transaction: a half-built shadow schema is worse than none, because a
  // rehearsal would still run against it and report confident, wrong numbers.
  return withTransaction(async (client) => {
    await client.query(`DROP SCHEMA IF EXISTS ${ident(shadow)} CASCADE`);
    await client.query(`CREATE SCHEMA ${ident(shadow)}`);

    const tables = await listTables(client, live);
    const rowsCopied: Record<string, number> = {};

    for (const table of tables) {
      // INCLUDING ALL brings across column types, defaults, NOT NULL, check
      // constraints, indexes and unique constraints — everything a delete or
      // an in-place anonymisation can trip over, except the one thing handled
      // below. Copied defaults may still name a sequence in the live schema,
      // which is harmless here: a rehearsal only deletes and updates, so no
      // live sequence is ever advanced.
      await client.query(
        `CREATE TABLE ${qualify(shadow, table)} (LIKE ${qualify(live, table)} INCLUDING ALL)`,
      );
      const inserted = await client.query(
        `INSERT INTO ${qualify(shadow, table)} SELECT * FROM ${qualify(live, table)}`,
      );
      rowsCopied[table] = inserted.rowCount ?? 0;
    }

    // LIKE ... INCLUDING ALL does NOT copy foreign keys, and without them NO
    // CASCADE WILL FIRE. A rehearsal on an FK-less clone would delete the one
    // customer row, find nothing else changed, and report a clean, tiny blast
    // radius — silently measuring nothing while looking like a good result.
    // Recreating these constraints is the single most important detail in
    // this file.
    const fks = await loadForeignKeys(client, live);
    const copied = new Set(tables);

    for (const fk of fks) {
      if (!ON_DELETE_CLAUSES.has(fk.on_delete)) {
        throw new Error(
          `foreign key ${fk.constraint_name} reports ON DELETE "${fk.on_delete}", ` +
            `which is not a recognised clause; refusing to build SQL from it`,
        );
      }
      if (!copied.has(fk.child_table) || !copied.has(fk.parent_table)) {
        throw new Error(
          `foreign key ${fk.constraint_name} spans a table outside "${live}"; ` +
            `the shadow copy would be missing a cascade path`,
        );
      }

      await client.query(
        `ALTER TABLE ${qualify(shadow, fk.child_table)} ` +
          `ADD CONSTRAINT ${ident(fk.constraint_name)} ` +
          `FOREIGN KEY (${fk.child_columns.map(ident).join(', ')}) ` +
          `REFERENCES ${qualify(shadow, fk.parent_table)} ` +
          `(${fk.parent_columns.map(ident).join(', ')}) ` +
          `ON DELETE ${fk.on_delete}`,
      );
    }

    return {
      shadow_schema: shadow,
      tables_copied: tables,
      rows_copied_per_table: rowsCopied,
      // Any failure above aborts the transaction, so reaching here means all
      // of them were recreated.
      foreign_keys_recreated: fks.length,
      created_at: new Date().toISOString(),
    };
  });
}

// --------------------------------------------------------------------------
// rehearse_deletion
// --------------------------------------------------------------------------

const planStepSchema = z.object({
  table: z.string(),
  action: z.enum(['delete', 'anonymise']),
  columns: z.array(z.string()).optional(),
});

const planSchema = z.object({
  subject_id: z.number().int(),
  mode: z.enum(['naive', 'revised']),
  steps: z.array(planStepSchema),
});

const rehearseInput = {
  subject_id: z.number().int(),
  mode: z.enum(['naive', 'revised']).optional(),
  plan: planSchema.optional(),
};

function registerRehearseTool(server: McpServer): void {
  server.registerTool(
    'rehearse_deletion',
    {
      title: 'Rehearse a deletion and measure its blast radius',
      description:
        'Run a deletion plan against the shadow schema inside a transaction that is always rolled ' +
        'back, and report what it destroyed: rows deleted per table (including tables no step named, ' +
        'reached by cascade), rows anonymised, rows orphaned by ON DELETE SET NULL, constraints that ' +
        'refused the plan, and any conflict with the retention policies recorded in the database. ' +
        'With no plan and no mode, rehearses the naive plan (delete the customer, let the database ' +
        'sort out the rest). A revised plan must be supplied explicitly — this tool measures plans, ' +
        'it does not write them. Nothing survives the call.',
      inputSchema: rehearseInput,
      annotations: SHADOW_WRITE,
    },
    async ({ subject_id, mode, plan }) => {
      try {
        const chosen = choosePlan(subject_id, mode, plan);
        if ('error' in chosen) return errorResult(chosen.error);

        // Validate before opening a transaction, so a malformed plan comes
        // back as a plain complaint rather than a half-run measurement.
        validatePlan(chosen.plan);

        return jsonResult(await rehearse(chosen.plan));
      } catch (err) {
        return errorResult(`rehearse_deletion failed: ${describe(err)}`);
      }
    },
  );
}

type PlanChoice = { plan: DeletionPlan } | { error: string };

function choosePlan(
  subjectId: number,
  mode: 'naive' | 'revised' | undefined,
  supplied: DeletionPlan | undefined,
): PlanChoice {
  if (supplied) {
    if (supplied.subject_id !== subjectId) {
      return {
        error:
          `plan.subject_id is ${supplied.subject_id} but subject_id is ${subjectId}; ` +
          `refusing to measure a different subject than the one asked about`,
      };
    }
    return { plan: supplied };
  }

  if (mode === 'revised') {
    // The revision is the judgement call — which obligations outrank the
    // erasure request, which rows get kept and de-identified instead of
    // deleted. Inventing one here would hide that decision inside the server
    // and leave nothing for the agent to be held to.
    return {
      error:
        'mode "revised" requires an explicit plan; this server will not invent the fix. ' +
        'Rehearse the naive plan first, read its retention_violations, then send back a ' +
        'plan whose steps you can defend.',
    };
  }

  return { plan: buildNaivePlan(subjectId) };
}

async function rehearse(plan: DeletionPlan): Promise<RehearsalResult> {
  const live = config.liveSchema;
  const shadow = config.shadowSchema;

  // Everything below runs inside a transaction that is always rolled back.
  // The statements genuinely execute against the shadow copy and its real
  // foreign keys, so real cascades genuinely fire and every number here is
  // measured rather than predicted — and only then is the whole thing thrown
  // away.
  return withRollback(async (client) => {
    // listTables returns every base table, so the policy table is filtered out
    // here: it is reference data about the deletion, not part of its target.
    const tables = (await listTables(client, shadow)).filter((t) => t !== POLICY_TABLE);
    if (tables.length === 0) {
      throw new Error(
        `shadow schema "${shadow}" has no tables; run snapshot_to_shadow first`,
      );
    }

    // Linkage is read from the shadow schema, not the live one: it has to
    // describe the copy that is about to be mutated, or the measurement would
    // be of a database that is not the one being changed.
    const fks = await loadForeignKeys(client, shadow);
    if (fks.length === 0 && (await loadForeignKeys(client, live)).length > 0) {
      throw new Error(
        `shadow schema "${shadow}" has no foreign keys while "${live}" does; ` +
          `re-run snapshot_to_shadow — without them no cascade fires and this ` +
          `rehearsal would measure nothing`,
      );
    }

    const linkage = resolveLinkage(fks, ROOT_TABLE);

    const rootPk = await primaryKeyColumns(client, shadow, ROOT_TABLE);
    const rootKey = rootPk[0];
    if (rootPk.length !== 1 || !rootKey) {
      throw new Error(
        `${ROOT_TABLE} must have a single-column primary key in "${shadow}", ` +
          `found ${rootPk.length}`,
      );
    }

    const before = await countAll(client, shadow, tables);
    const orphanProbes = await captureOrphanCandidates(
      client,
      shadow,
      fks,
      linkage,
      rootKey,
      plan.subject_id,
    );

    const constraintsBlocked: string[] = [];
    let counts: ApplyCounts = {
      rows_deleted_per_table: {},
      rows_anonymised_per_table: {},
    };

    // A refused statement aborts the entire transaction: every query after it
    // fails with 25P02 and the rehearsal could report nothing at all. The
    // savepoint keeps the connection usable, so a blocked plan still comes
    // back as a measurement — with the counts unwound to their before state,
    // which is the honest answer since nothing was destroyed.
    await client.query('SAVEPOINT before_plan');
    try {
      counts = await applyPlan(client, shadow, plan, linkage);
    } catch (err) {
      await client.query('ROLLBACK TO SAVEPOINT before_plan').catch(() => {});
      const constraint = constraintViolationName(err);
      if (constraint === null) throw err;
      constraintsBlocked.push(constraint);
    }

    const after = await countAll(client, shadow, tables);

    // Rows that vanished, counted per table whether or not a step named the
    // table. This is what catches the cascade victims no plan mentions —
    // exactly the finding the whole exercise turns on.
    const rowsDeleted: Record<string, number> = {};
    for (const table of tables) {
      const lost = (before[table] ?? 0) - (after[table] ?? 0);
      if (lost > 0) rowsDeleted[table] = lost;
    }

    const namedByPlan = new Set(
      plan.steps.filter((s) => s.action === 'delete').map((s) => s.table),
    );
    const cascadesFired = Object.keys(rowsDeleted).filter((t) => !namedByPlan.has(t));

    let rowsOrphaned = 0;
    for (const probe of orphanProbes) {
      rowsOrphaned += await countOrphaned(client, shadow, probe);
    }

    const retentionViolations = await findRetentionViolations(
      client,
      live,
      rowsDeleted,
      new Set(cascadesFired),
    );

    return {
      subject_id: plan.subject_id,
      mode: plan.mode,
      shadow_schema: shadow,
      measured_at: new Date().toISOString(),
      rows_deleted_per_table: rowsDeleted,
      rows_anonymised_per_table: counts.rows_anonymised_per_table,
      cascades_fired: cascadesFired,
      rows_orphaned: rowsOrphaned,
      constraints_blocked: constraintsBlocked,
      retention_violations: retentionViolations,
      // `ok` means SAFE TO EXECUTE, not merely "the statements ran".
      // A naive plan that destroys legally-retained rows completes without a
      // single database error, so keying this on constraints alone would
      // report the illegal plan as fine — the exact mistake this server
      // exists to catch.
      ok: constraintsBlocked.length === 0 && retentionViolations.length === 0,
    };
  });
}

async function countAll(
  client: Client,
  schema: string,
  tables: string[],
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of tables) {
    counts[table] = await countRows(client, schema, table);
  }
  return counts;
}

// --------------------------------------------------------------------------
// Orphans
// --------------------------------------------------------------------------

interface OrphanProbe {
  table: string;
  /** Primary key of the child table, used to find the same rows again after. */
  key_columns: string[];
  /** Temp table holding those keys for the length of the transaction. */
  key_table: string;
  fk_columns: string[];
  candidates: number;
}

/**
 * ON DELETE SET NULL is the quiet one. No row disappears, so no before/after
 * count moves, and yet a row that belonged to someone now belongs to nobody —
 * still there, still carrying whatever it carries, with the link to its owner
 * erased.
 *
 * Measuring it needs the identities of the at-risk rows captured up front:
 * once the parent is gone the FK is NULL and nothing points back. For every
 * SET NULL foreign key whose parent table is reachable from the subject, the
 * primary keys of the child rows currently pointing at that subject are
 * stashed in a temp table; after the plan runs the same keys are looked up
 * again and the ones now holding NULL are counted.
 *
 * A row the plan deleted outright is gone from that join, so it counts as
 * deleted and not as orphaned. A row with two nulled foreign keys counts once
 * per key, since it is one link per key that was severed.
 */
async function captureOrphanCandidates(
  client: Client,
  schema: string,
  fks: ForeignKey[],
  linkage: Map<string, Linkage>,
  rootKey: string,
  subjectId: number,
): Promise<OrphanProbe[]> {
  const probes: OrphanProbe[] = [];

  for (const [index, fk] of fks.entries()) {
    if (fk.on_delete !== 'SET NULL') continue;

    // Nothing this key points at belongs to the subject, so this plan cannot
    // orphan anything through it.
    const parentLink = linkage.get(fk.parent_table);
    if (!parentLink) continue;

    // Without a primary key there is no way to recognise the same row later.
    const keyColumns = await primaryKeyColumns(client, schema, fk.child_table);
    if (keyColumns.length === 0) continue;

    const keyTable = `blast_radius_orphan_keys_${index}`;
    const keyList = keyColumns.map(ident).join(', ');

    // Built empty first, then filled by a separate INSERT: the subject id is a
    // bound value, and a plain INSERT ... SELECT is the statement form where
    // that is beyond doubt.
    await client.query(
      `CREATE TEMP TABLE ${ident(keyTable)} ON COMMIT DROP AS ` +
        `SELECT ${keyList} FROM ${qualify(schema, fk.child_table)} WHERE false`,
    );
    const captured = await client.query(
      `INSERT INTO ${ident(keyTable)} ` +
        `SELECT ${keyList} FROM ${qualify(schema, fk.child_table)} ` +
        `WHERE ${pointsAtSubject(schema, fk, parentLink, rootKey)}`,
      [subjectId],
    );

    probes.push({
      table: fk.child_table,
      key_columns: keyColumns,
      key_table: keyTable,
      fk_columns: fk.child_columns,
      candidates: captured.rowCount ?? 0,
    });
  }

  return probes;
}

/** Child rows whose foreign key is set and resolves to a row of the subject's. */
function pointsAtSubject(
  schema: string,
  fk: ForeignKey,
  parentLink: Linkage,
  rootKey: string,
): string {
  const childCols = fk.child_columns.map(ident).join(', ');
  const lhs = fk.child_columns.length === 1 ? childCols : `(${childCols})`;
  const parentCols = fk.parent_columns.map(ident).join(', ');
  const isSet = fk.child_columns.map((c) => `${ident(c)} IS NOT NULL`).join(' AND ');

  return (
    `${isSet} AND ${lhs} IN (SELECT ${parentCols} ` +
    `FROM ${qualify(schema, fk.parent_table)} ` +
    `WHERE ${subjectPredicate(schema, parentLink, rootKey)})`
  );
}

async function countOrphaned(
  client: Client,
  schema: string,
  probe: OrphanProbe,
): Promise<number> {
  if (probe.candidates === 0) return 0;

  const joinOn = probe.key_columns.map(ident).join(', ');
  // A nullable column cannot be part of a primary key, so no FK column here is
  // ever one of the join columns.
  const nulled = probe.fk_columns.map((c) => `child.${ident(c)} IS NULL`).join(' OR ');

  const { rows } = await client.query<{ n: number }>(
    `SELECT COUNT(*)::int8 AS n
       FROM ${qualify(schema, probe.table)} AS child
       JOIN ${ident(probe.key_table)} AS candidates USING (${joinOn})
      WHERE ${nulled}`,
  );
  return rows[0]?.n ?? 0;
}

// --------------------------------------------------------------------------
// Retention
// --------------------------------------------------------------------------

/**
 * The conflict is discovered, never assumed. Nothing in this file names a
 * table, a legal basis or a number of years: the obligations are read out of
 * the policy table in the live schema on every call and cross-referenced
 * against the tables this rehearsal actually emptied. Edit a policy row and
 * the findings change with it; edit the schema and they change again.
 */
async function findRetentionViolations(
  client: Client,
  liveSchema: string,
  rowsDeleted: Record<string, number>,
  cascaded: Set<string>,
): Promise<RetentionViolation[]> {
  const emptied = Object.keys(rowsDeleted);
  if (emptied.length === 0) return [];

  // Read from the live schema: the obligation is a fact about production, and
  // the shadow copy is midway through being destroyed.
  const { rows } = await client.query<{
    table_name: string;
    basis: string;
    retain_years: number | string;
    anonymise_columns: unknown;
  }>(
    `SELECT table_name, basis, retain_years, anonymise_columns
       FROM ${qualify(liveSchema, POLICY_TABLE)}
      WHERE table_name = ANY($1::text[])
      ORDER BY table_name`,
    [emptied],
  );

  const violations: RetentionViolation[] = [];
  for (const row of rows) {
    const retainYears = Number(row.retain_years);
    // No policy row, or a zero-year one, means nothing to weigh against the
    // erasure request — deleting those rows is simply the job.
    if (!Number.isFinite(retainYears) || retainYears <= 0) continue;

    violations.push({
      table_name: row.table_name,
      rows_destroyed: rowsDeleted[row.table_name] ?? 0,
      basis: row.basis,
      retain_years: retainYears,
      anonymise_columns: toStringArray(row.anonymise_columns),
      via_cascade: cascaded.has(row.table_name),
    });
  }

  return violations;
}

/** Policy column lists may arrive as a Postgres array or as JSON text. */
function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // Not JSON; treated as no columns rather than guessing a delimiter.
    }
  }
  return [];
}

// --------------------------------------------------------------------------
// Result shaping
// --------------------------------------------------------------------------

interface PgError {
  code?: string;
  constraint?: string;
  table?: string;
  column?: string;
}

/** The constraint that refused the plan, or null if this was a real failure. */
function constraintViolationName(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null;

  const pg = err as PgError;
  if (typeof pg.code !== 'string' || !CONSTRAINT_VIOLATION_CODES.has(pg.code)) {
    return null;
  }
  if (pg.constraint) return pg.constraint;
  // not_null_violation names the column it landed on rather than a constraint.
  if (pg.table && pg.column) return `${pg.table}.${pg.column} NOT NULL`;
  return pg.code;
}

function jsonResult(value: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

function errorResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }], isError: true };
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
