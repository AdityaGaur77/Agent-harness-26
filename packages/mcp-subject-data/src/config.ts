/** Process configuration, read once at boot so a missing value fails loudly. */

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(
      `Missing required environment variable ${name}. See .env.example.`,
    );
  }
  return v;
}

function optionalInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error(`${name} must be an integer, got "${v}"`);
  return n;
}

export const config = {
  port: optionalInt('MCP_PORT', 8080),

  databaseUrl: required('DATABASE_URL'),

  /**
   * Bearer token TrueForge sends on every MCP request. The harness stores it
   * as header auth on the connector; we compare it in constant time.
   */
  authToken: required('MCP_AUTH_TOKEN'),

  /** Schema holding live data. */
  liveSchema: process.env.LIVE_SCHEMA ?? 'public',

  /** Throwaway schema the rehearsal runs against. Never holds the only copy. */
  shadowSchema: process.env.SHADOW_SCHEMA ?? 'shadow',

  /** Ceilings on the gated write so a bad plan cannot wedge the database. */
  statementTimeoutMs: optionalInt('STATEMENT_TIMEOUT_MS', 30_000),
  lockTimeoutMs: optionalInt('LOCK_TIMEOUT_MS', 5_000),
} as const;

export type Config = typeof config;
