import pg from 'pg';
import { config } from './config.js';

/**
 * Postgres access for the subject-data server.
 *
 * Two rules hold everywhere in this file:
 *   1. Values are always bound as parameters, never interpolated.
 *   2. Identifiers (table/column/schema names) come from the catalogue, and
 *      are quoted through `ident()` before they reach a query string.
 */

// Postgres returns bigint (int8) as a string to avoid precision loss. Every
// int8 we read is a COUNT, which is safely inside Number range.
pg.types.setTypeParser(pg.types.builtins.INT8, (v: string) => Number.parseInt(v, 10));

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err: Error) => {
  console.error('[db] idle client error:', err.message);
});

/**
 * Quote a SQL identifier. Rejects anything that is not a plain identifier
 * rather than trying to escape it — every identifier we use is read out of
 * information_schema, so a surprising one means something is wrong.
 */
export function ident(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(name)) {
    throw new Error(`Refusing to build SQL with unsafe identifier: ${name}`);
  }
  return `"${name}"`;
}

/** `schema`.`table`, both quoted. */
export function qualify(schema: string, table: string): string {
  return `${ident(schema)}.${ident(table)}`;
}

export type Client = pg.PoolClient;

/** Run `fn` with a pooled client, always releasing it. */
export async function withClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

/**
 * Run `fn` inside a transaction with statement and lock timeouts applied.
 * Commits on return, rolls back on throw.
 */
export async function withTransaction<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  return withClient(async (client) => {
    await client.query(`SET LOCAL statement_timeout = ${config.statementTimeoutMs}`);
    await client.query(`SET LOCAL lock_timeout = ${config.lockTimeoutMs}`);
    await client.query('BEGIN');
    try {
      const out = await fn(client);
      await client.query('COMMIT');
      return out;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    }
  });
}

/**
 * Run `fn` in a transaction that is ALWAYS rolled back.
 *
 * This is how the rehearsal measures a deletion without keeping it: the
 * statements really execute, real cascades really fire, real counts come
 * back — and then the whole thing is discarded. Used against the shadow
 * schema, so even the rollback failing costs nothing.
 */
export async function withRollback<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  return withClient(async (client) => {
    await client.query(`SET LOCAL statement_timeout = ${config.statementTimeoutMs}`);
    await client.query(`SET LOCAL lock_timeout = ${config.lockTimeoutMs}`);
    await client.query('BEGIN');
    try {
      return await fn(client);
    } finally {
      await client.query('ROLLBACK').catch(() => {});
    }
  });
}

/** Row count for one table in one schema. */
export async function countRows(
  client: Client,
  schema: string,
  table: string,
): Promise<number> {
  const { rows } = await client.query<{ n: number }>(
    `SELECT COUNT(*)::int8 AS n FROM ${qualify(schema, table)}`,
  );
  return rows[0]?.n ?? 0;
}

/** Base tables in a schema, excluding the retention policy table itself. */
export async function listTables(client: Client, schema: string): Promise<string[]> {
  const { rows } = await client.query<{ table_name: string }>(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = $1
        AND table_type = 'BASE TABLE'
      ORDER BY table_name`,
    [schema],
  );
  return rows.map((r) => r.table_name);
}

export async function closePool(): Promise<void> {
  await pool.end();
}
