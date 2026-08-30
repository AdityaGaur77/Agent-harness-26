import { Client, Pool, type QueryResult, type QueryResultRow } from "pg";

export interface Queryable {
  query<R extends QueryResultRow = any>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<R>>;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

export const SHADOW_DB_NAME = process.env.SHADOW_DB_NAME?.trim() || "blast_shadow";

/**
 * The Render database credential points at the service's maintenance database.
 * Subject data can live in a separate database on that same Postgres instance;
 * keeping the override here means every query, snapshot and rehearsal uses the
 * same isolated target instead of accidentally inspecting TrueForge metadata.
 */
export function configuredDatabaseUrl(): string {
  return requiredEnv("DATABASE_URL");
}

export function subjectDatabaseName(): string {
  const configured = process.env.SUBJECT_DATABASE_NAME?.trim();
  if (configured) return configured;
  const pathname = new URL(configuredDatabaseUrl()).pathname.replace(/^\//, "");
  return decodeURIComponent(pathname) || "postgres";
}

export function subjectDatabaseUrl(): string {
  const url = new URL(configuredDatabaseUrl());
  url.pathname = `/${subjectDatabaseName()}`;
  return url.toString();
}

export function maintenanceDatabaseUrl(): string {
  const url = new URL(configuredDatabaseUrl());
  url.pathname = "/postgres";
  return url.toString();
}

function databaseUrl(): string {
  return subjectDatabaseUrl();
}

export function shadowDatabaseUrl(): string {
  const override = process.env.SHADOW_DATABASE_URL?.trim();
  if (override) return override;
  const url = new URL(databaseUrl());
  url.pathname = `/${SHADOW_DB_NAME}`;
  return url.toString();
}

export function mainDatabaseName(): string {
  return subjectDatabaseName();
}

const pools = new Map<"main" | "shadow", Pool>();

export type PoolTarget = "main" | "shadow";

export function getPool(target: PoolTarget): Pool {
  let pool = pools.get(target);
  if (!pool) {
    pool = new Pool({
      connectionString: target === "main" ? databaseUrl() : shadowDatabaseUrl(),
      max: Number(process.env.PG_POOL_MAX ?? 8),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    pools.set(target, pool);
  }
  return pool;
}

export async function endPool(target: PoolTarget): Promise<void> {
  const pool = pools.get(target);
  pools.delete(target);
  if (pool) await pool.end();
}

export async function endAllPools(): Promise<void> {
  await Promise.allSettled([endPool("main"), endPool("shadow")]);
}

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function quoteIdent(name: string): string {
  if (!IDENT_RE.test(name)) {
    throw new Error(`Unsafe SQL identifier: "${name}"`);
  }
  return `"${name}"`;
}

export interface ForeignKeyEdge {
  constraint_name: string;
  child_table: string;
  child_column: string;
  parent_table: string;
  parent_column: string;
  on_delete: string;
}

export interface RetentionPolicy {
  table_name: string;
  basis: string;
  retain_years: number;
  pii_columns: string[] | null;
  anonymise_columns: string[] | null;
}

export async function listTables(db: Queryable): Promise<string[]> {
  const { rows } = await db.query<{ table_name: string }>(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name`,
  );
  return rows.map((r) => r.table_name);
}

export async function listForeignKeys(db: Queryable): Promise<ForeignKeyEdge[]> {
  const { rows } = await db.query<ForeignKeyEdge>(
    `SELECT
       rc.constraint_name,
       tc.table_name   AS child_table,
       kcu.column_name AS child_column,
       ccu.table_name  AS parent_table,
       ccu.column_name AS parent_column,
       COALESCE(rc.delete_rule, 'NO ACTION') AS on_delete
     FROM information_schema.referential_constraints rc
     JOIN information_schema.table_constraints tc
       ON tc.constraint_name = rc.constraint_name
      AND tc.constraint_schema = rc.constraint_schema
      AND tc.constraint_type = 'FOREIGN KEY'
     JOIN information_schema.key_column_usage kcu
       ON kcu.constraint_name = tc.constraint_name
      AND kcu.constraint_schema = tc.constraint_schema
      AND kcu.ordinal_position = 1
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = rc.unique_constraint_name
      AND ccu.constraint_schema = rc.constraint_schema
     WHERE rc.constraint_schema = 'public'
     ORDER BY tc.table_name, rc.constraint_name`,
  );
  return rows;
}

export async function primaryKeysByTable(db: Queryable): Promise<Map<string, string>> {
  const { rows } = await db.query<{ table_name: string; column_name: string }>(
    `SELECT tc.table_name, kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name
        AND kcu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'`,
  );
  const map = new Map<string, string>();
  for (const row of rows) map.set(row.table_name, row.column_name);
  return map;
}

export async function columnsByTable(db: Queryable): Promise<Map<string, Set<string>>> {
  const { rows } = await db.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'`,
  );
  const map = new Map<string, Set<string>>();
  for (const row of rows) {
    let cols = map.get(row.table_name);
    if (!cols) {
      cols = new Set<string>();
      map.set(row.table_name, cols);
    }
    cols.add(row.column_name);
  }
  return map;
}

export async function countRowsPerTable(db: Queryable, tables: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const table of tables) {
    const { rows } = await db.query<{ n: string }>(
      `SELECT COUNT(*)::bigint AS n FROM ${quoteIdent(table)}`,
    );
    counts.set(table, Number(rows[0]?.n ?? 0));
  }
  return counts;
}

export async function getRetentionPolicies(db: Queryable): Promise<RetentionPolicy[]> {
  const { rows } = await db.query<RetentionPolicy>(
    `SELECT table_name, basis, retain_years, pii_columns, anonymise_columns
       FROM retention_policies
      ORDER BY table_name`,
  );
  return rows;
}

async function getMaintenanceClient(): Promise<Client> {
  const client = new Client({ connectionString: maintenanceDatabaseUrl() });
  await client.connect();
  return client;
}

export interface SnapshotResult {
  shadow_database: string;
  cloned_from: string;
  duration_ms: number;
}

export async function snapshotToShadow(): Promise<SnapshotResult> {
  const startedAt = Date.now();
  const sourceName = mainDatabaseName();

  const admin = await getMaintenanceClient();
  try {
    await endPool("shadow");
    await endPool("main");
    await admin.query(
      `SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
        WHERE datname = ANY($1::text[]) AND pid <> pg_backend_pid()`,
      [[sourceName, SHADOW_DB_NAME]],
    );
    await admin.query(`DROP DATABASE IF EXISTS ${quoteIdent(SHADOW_DB_NAME)} WITH (FORCE)`);
    await admin.query(
      `CREATE DATABASE ${quoteIdent(SHADOW_DB_NAME)} TEMPLATE ${quoteIdent(sourceName)}`,
    );
  } finally {
    await admin.end().catch(() => undefined);
  }

  return {
    shadow_database: SHADOW_DB_NAME,
    cloned_from: sourceName,
    duration_ms: Date.now() - startedAt,
  };
}
