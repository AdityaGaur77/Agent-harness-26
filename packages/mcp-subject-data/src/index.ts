import express from "express";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { endAllPools } from "./db.js";
import { registerDiscoverTools } from "./tools/discover.js";
import { registerExecuteTool } from "./tools/execute.js";
import { registerRehearseTool } from "./tools/rehearse.js";

const PORT = Number(process.env.PORT ?? 8080);
const UI_ORIGIN = process.env.UI_ORIGIN?.trim();

function resolveAuthToken(): string {
  const fromEnv = process.env.MCP_AUTH_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  const generated = randomBytes(24).toString("hex");
  console.warn("[auth] MCP_AUTH_TOKEN is not set - generated a temporary token for this boot:");
  console.warn(`[auth]   Authorization: Bearer ${generated}`);
  return generated;
}

const AUTH_TOKEN = resolveAuthToken();

function bearerIsAuthorized(header: string | undefined): boolean {
  if (!header) return false;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return false;
  const provided = createHash("sha256").update(match[1]).digest();
  const expected = createHash("sha256").update(AUTH_TOKEN).digest();
  return timingSafeEqual(provided, expected);
}

function buildServer(): McpServer {
  const server = new McpServer(
    { name: "subject-data", version: "0.1.0" },
    {
      instructions:
        "Tools for GDPR-style erasure workflows over a PostgreSQL subject-data store. " +
        "Discover the schema and foreign-key graph, read retention_policies, locate every row referencing a subject, " +
        "snapshot production into a disposable shadow copy, rehearse deletion plans on that copy to measure blast radius, " +
        "and only then propose execute_deletion - the single destructive tool, which requires human approval via the harness.",
    },
  );
  registerDiscoverTools(server);
  registerRehearseTool(server);
  registerExecuteTool(server);
  return server;
}

const app = express();
app.disable("x-powered-by");

// CORS for browser-based UI (localhost:4173 -> localhost:8080)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (origin.includes("localhost") || origin.includes("127.0.0.1"))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, mcp-session-id, Accept");
    res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");
  }
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok", service: "mcp-subject-data", time: new Date().toISOString() });
});

app.use("/mcp", (req, res, next) => {
  const origin = req.headers.origin;
  const allowed = Boolean(origin && UI_ORIGIN && origin === UI_ORIGIN);
  if (allowed) {
    res.setHeader("Access-Control-Allow-Origin", origin!);
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, MCP-Session-Id");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS");
    res.setHeader("Vary", "Origin");
  }
  if (req.method === "OPTIONS") {
    res.sendStatus(allowed ? 204 : 403);
    return;
  }
  next();
});

app.use("/mcp", express.json({ limit: "4mb" }));

app.use("/mcp", (req, res, next) => {
  if (!bearerIsAuthorized(req.headers.authorization)) {
    res.status(401).json({
      error: "unauthorized",
      hint: "send header Authorization: Bearer <MCP_AUTH_TOKEN>",
    });
    return;
  }
  next();
});

const transports = new Map<string, StreamableHTTPServerTransport>();

function lookupTransport(req: express.Request): StreamableHTTPServerTransport | undefined {
  const sessionId = req.headers["mcp-session-id"];
  if (typeof sessionId !== "string") return undefined;
  return transports.get(sessionId);
}

app.post("/mcp", async (req, res) => {
  let transport = lookupTransport(req);
  if (!transport) {
    const server = buildServer();
    const newTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        transports.set(sessionId, newTransport);
      },
    });
    transport = newTransport;
    newTransport.onclose = () => {
      const sessionId = newTransport.sessionId;
      if (sessionId) transports.delete(sessionId);
      void server.close();
    };
    try {
      await server.connect(newTransport);
    } catch (err) {
      console.error("[mcp] failed to start session:", err);
      if (!res.headersSent) res.status(500).json({ error: "session_init_failed" });
      return;
    }
  }

  try {
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("[mcp] request failed:", err);
    if (!res.headersSent) res.status(500).json({ error: "internal_error" });
  }
});

app.get("/mcp", async (req, res) => {
  const transport = lookupTransport(req);
  if (!transport) {
    res.status(400).json({ error: "session_not_found", hint: "POST an initialize request first" });
    return;
  }
  try {
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("[mcp] sse stream failed:", err);
    if (!res.headersSent) res.status(500).json({ error: "internal_error" });
  }
});

app.delete("/mcp", async (req, res) => {
  const transport = lookupTransport(req);
  if (!transport) {
    res.status(400).json({ error: "session_not_found" });
    return;
  }
  try {
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("[mcp] session close failed:", err);
    if (!res.headersSent) res.status(500).json({ error: "internal_error" });
  }
});

const httpServer = app.listen(PORT, () => {
  console.log(`[mcp-subject-data] listening on :${PORT} (streamable HTTP at /mcp)`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`[mcp-subject-data] ${signal} received, shutting down`);
  for (const transport of transports.values()) {
    await transport.close().catch(() => undefined);
  }
  transports.clear();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  await endAllPools().catch(() => undefined);
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
