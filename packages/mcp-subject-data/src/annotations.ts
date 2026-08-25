/**
 * THE SECURITY BOUNDARY.
 *
 * TrueForge auto-gates MCP tools on these annotations: a tool carrying
 * `@destructive` pauses the agent loop for human approval before it runs.
 * Everything else runs autonomously.
 *
 * Exactly one tool in this server is DESTRUCTIVE: `execute_deletion`.
 * That single annotation is what produces the Allow/Deny pause in the demo.
 * It is not decoration — moving a tool between these two constants changes
 * whether a human is asked before irreversible data loss.
 *
 * Rule of thumb for adding a tool: if it can change a row in a schema that
 * is not the throwaway shadow copy, it is DESTRUCTIVE. If in doubt, it is
 * DESTRUCTIVE.
 */

/** Runs autonomously. Must not mutate any non-shadow schema. */
export const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

/**
 * Mutates the shadow copy only. Not read-only (it writes), but not gated:
 * the shadow schema is a throwaway clone and losing it costs nothing.
 */
export const SHADOW_WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

/** Irreversible write against live data. Gated on human approval. */
export const DESTRUCTIVE = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
} as const;
