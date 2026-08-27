import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { config } from './config.js';
import { closePool } from './db.js';
import { registerDiscoveryTools } from './tools/discover.js';
import { registerRehearsalTools } from './tools/rehearse.js';
import { registerExecutionTools } from './tools/execute.js';

/**
 * Streamable-HTTP entrypoint.
 *
 * TrueForge connects to MCP servers over remote HTTP with header auth, not
 * stdio, so this is a real HTTP service rather than a subprocess.
 */

const MCP_PATH = '/mcp';

export function buildServer(): McpServer {
  const server = new McpServer({ name: 'subject-data', version: '0.1.0' });
  registerDiscoveryTools(server);
  registerRehearsalTools(server);
  registerExecutionTools(server);
  return server;
}

/** JSON-RPC-shaped error body, so an MCP client can parse our HTTP failures. */
function rpcError(code: number, message: string) {
  return { jsonrpc: '2.0' as const, error: { code, message }, id: null };
}

const EXPECTED_TOKEN = Buffer.from(config.authToken, 'utf8');

/**
 * Bearer auth for the MCP endpoint.
 *
 * The comparison is constant-time over Buffers. `timingSafeEqual` THROWS on
 * unequal lengths, so the length check has to come first — it leaks only the
 * token's length, which is not the secret.
 */
function requireBearerToken(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('authorization') ?? '';
  const presented = /^Bearer\s+(.+)$/.exec(header)?.[1] ?? '';

  const presentedBytes = Buffer.from(presented, 'utf8');
  const ok =
    presentedBytes.length === EXPECTED_TOKEN.length &&
    crypto.timingSafeEqual(presentedBytes, EXPECTED_TOKEN);

  if (!ok) {
    // Never log the presented token, not even truncated.
    // originalUrl, not path: inside a mounted middleware req.path is relative
    // to the mount point and logs as "/", which is useless in an incident.
    console.error(`[mcp] rejected unauthenticated request to ${req.method} ${req.originalUrl}`);
    res.status(401).json(rpcError(-32001, 'Unauthorized: expected Authorization: Bearer <token>'));
    return;
  }

  next();
}

// Explicitly typed: the package emits declarations, and an inferred Express
// type is not nameable from the emitted .d.ts.
export const app: Express = express();

app.use(express.json({ limit: '4mb' }));

// Outside the auth middleware on purpose: the compose healthcheck has no token.
app.get('/healthz', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.use(MCP_PATH, requireBearerToken);

/**
 * Stateless: a fresh McpServer and transport per POST, torn down when the
 * response closes.
 *
 * This server holds no per-client state — every tool reads what it needs from
 * the database on each call — so there is nothing a session would carry. The
 * payoff is that the harness reconnecting, or a container restart between two
 * calls, costs nothing: there is no session to lose.
 */
app.post(MCP_PATH, async (req: Request, res: Response) => {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  res.on('close', () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('[mcp] request handling failed:', err instanceof Error ? err.message : err);
    if (!res.headersSent) {
      res.status(500).json(rpcError(-32603, 'Internal server error'));
    }
  }
});

// Stateless mode supports neither the standalone SSE stream (GET) nor session
// termination (DELETE), so both are refused rather than half-answered.
function methodNotAllowed(_req: Request, res: Response): void {
  res
    .status(405)
    .set('Allow', 'POST')
    .json(
      rpcError(
        -32000,
        'Method not allowed: this server is stateless — no SSE stream (GET) and no session termination (DELETE). Use POST /mcp.',
      ),
    );
}

app.get(MCP_PATH, methodNotAllowed);
app.delete(MCP_PATH, methodNotAllowed);

function start(): void {
  const httpServer = app.listen(config.port, () => {
    console.error(`[mcp] subject-data listening on port ${config.port}, endpoint POST ${MCP_PATH}`);
  });

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.error(`[mcp] ${signal} received — closing listener and draining pool`);

    // Stop accepting connections first, then release the pool: an in-flight
    // gated write must be allowed to finish its transaction.
    httpServer.close(() => {
      void closePool()
        .catch((err: unknown) => {
          console.error('[mcp] pool shutdown error:', err instanceof Error ? err.message : err);
        })
        .then(() => process.exit(0));
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Only listen when run as the entrypoint, so a test can import `app` and
// `buildServer` without binding a port.
const entrypoint = process.argv[1];
if (entrypoint !== undefined && path.resolve(entrypoint) === fileURLToPath(import.meta.url)) {
  start();
}
