const MAX_BODY_BYTES = 32 * 1024;
const MAX_INPUT_ITEMS = 32;
const MAX_INPUT_TEXT = 20_000;
const DEFAULT_AGENT_NAME = "blast-radius";

function header(request, name) {
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] || "";
  return typeof value === "string" ? value : "";
}

function configuredOrigins() {
  return (process.env.TRUEFORGE_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function parseBody(request) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body !== "string" || !request.body.trim()) return {};
  try {
    return JSON.parse(request.body);
  } catch {
    return null;
  }
}

function errorResponse(response, status, error, message) {
  response.status(status).json({ error, ...(message ? { message } : {}) });
}

function runtimeConfig() {
  const configuredBaseUrl = (process.env.TRUEFORGE_BASE_URL || "").trim();
  // Standalone `npx @truefoundry/trueforge` uses 8790. Hosted Docker mode
  // uses 8791, so production still requires an explicit reachable URL.
  const baseUrl = (configuredBaseUrl || (isProductionRuntime() ? "" : "http://localhost:8790")).replace(/\/$/, "");
  const agentName = (process.env.TRUEFORGE_AGENT_NAME || DEFAULT_AGENT_NAME).trim();
  const token = (process.env.TRUEFORGE_TOKEN || "").trim();
  const uiToken = (process.env.TRUEFORGE_UI_TOKEN || "").trim();
  return { baseUrl, configuredBaseUrl, agentName, token, uiToken };
}

function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
}

function authorize(request, response, uiToken) {
  // A production deployment must have an operator-facing token. Local TrueForge
  // runs can omit it because the server is normally bound to localhost.
  if (!uiToken && isProductionRuntime()) {
    errorResponse(response, 503, "ui_auth_not_configured", "Set TRUEFORGE_UI_TOKEN before enabling the agent runtime.");
    return false;
  }
  if (uiToken && header(request, "authorization") !== `Bearer ${uiToken}`) {
    errorResponse(response, 401, "unauthorized");
    return false;
  }
  return true;
}

function validId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 160 && /^[A-Za-z0-9._:-]+$/.test(value);
}

function validInput(input) {
  if (input === undefined) return true;
  if (!Array.isArray(input) || input.length > MAX_INPUT_ITEMS) return false;
  return input.every((item) => {
    if (!item || typeof item !== "object" || typeof item.type !== "string") return false;
    if (item.type === "user.message") {
      if (typeof item.content === "string") return item.content.length <= MAX_INPUT_TEXT;
      if (!Array.isArray(item.content) || item.content.length > 8) return false;
      return item.content.every((part) => part && typeof part === "object" && typeof part.type === "string" &&
        (part.type !== "text" || (typeof part.text === "string" && part.text.length <= MAX_INPUT_TEXT)));
    }
    if (item.type === "user.tool_approval") {
      return validId(item.thread_id) && validId(item.tool_call_id) &&
        item.approval && (item.approval.status === "allow" || item.approval.status === "deny");
    }
    if (item.type === "user.tool_response") {
      return validId(item.thread_id) && validId(item.tool_call_id) &&
        typeof item.content === "string" && item.content.length <= MAX_INPUT_TEXT;
    }
    return false;
  });
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function upstreamMessage(payload, fallback) {
  return payload?.error?.message || payload?.message || fallback;
}

async function pipeStream(upstream, response) {
  response.statusCode = upstream.status;
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("Content-Type", upstream.headers.get("content-type") || "text/event-stream");
  response.setHeader("Connection", "keep-alive");
  response.setHeader("X-Accel-Buffering", "no");
  if (!upstream.body) {
    response.end();
    return;
  }
  const reader = upstream.body.getReader();
  const close = () => reader.cancel().catch(() => {});
  response.on?.("close", close);
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      response.write(Buffer.from(chunk.value));
    }
  } finally {
    response.off?.("close", close);
    response.end();
  }
}

async function callTrueForge(config, action, body) {
  let method = "GET";
  let path = "";
  let payload;

  if (action === "status") {
    path = "/api/v1/agents";
  } else if (action === "create") {
    method = "POST";
    path = "/api/v1/sessions";
    payload = { agent: { name: config.agentName } };
  } else if (action === "turn") {
    method = "POST";
    path = `/api/v1/sessions/${encodeURIComponent(body.sessionId)}/turns`;
    payload = {
      ...(body.input === undefined ? {} : { input: body.input }),
      ...(body.previousTurnId === undefined ? {} : { previous_turn_id: body.previousTurnId }),
      stream: true,
    };
  } else if (action === "subscribe") {
    path = `/api/v1/sessions/${encodeURIComponent(body.sessionId)}/turns/${encodeURIComponent(body.turnId)}/subscribe`;
    const after = Number.isSafeInteger(body.afterSequenceNumber) && body.afterSequenceNumber >= 0
      ? `?after_sequence_number=${body.afterSequenceNumber}`
      : "";
    path += after;
  } else if (action === "events") {
    path = `/api/v1/sessions/${encodeURIComponent(body.sessionId)}/events`;
  } else if (action === "session") {
    path = `/api/v1/sessions/${encodeURIComponent(body.sessionId)}`;
  } else if (action === "cancel") {
    method = "POST";
    path = `/api/v1/sessions/${encodeURIComponent(body.sessionId)}/cancel`;
    payload = {};
  } else {
    throw new Error("unsupported_action");
  }

  const headers = { accept: action === "turn" || action === "subscribe" ? "text/event-stream" : "application/json" };
  if (config.token) headers.Authorization = `Bearer ${config.token}`;
  if (payload !== undefined) headers["content-type"] = "application/json";
  const upstream = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers,
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
  return upstream;
}

const FALLBACK_MODELS = [
  "google-gemini/gemini-3-6-flash",
  "unorouter/step-3-7-flash-free",
  "unorouter/glm-5-3-flash-free",
  "unorouter/nemotron-lightning-free",
  "unorouter/glm-4-flash-free",
  "unorouter/gemma-4-31b-free",
  "unorouter/glm-4-7-flash-free",
  "google-gemini/gemini-3-5-flash-lite",
];

async function rotateAgentModel(config, requestedModel) {
  try {
    const getRes = await fetch(`${config.baseUrl}/api/v1/agents`, {
      headers: config.token ? { Authorization: `Bearer ${config.token}` } : {},
    });
    if (!getRes.ok) return { success: false, error: "failed_to_list_agents" };
    const agentsData = await getRes.json();
    const agent = (agentsData?.data || []).find((a) => a.name === config.agentName);
    if (!agent?.id) return { success: false, error: "agent_not_found" };

    const currentModel = agent.manifest?.model?.name || "";
    let nextModel = requestedModel;
    if (!nextModel) {
      const currentIndex = FALLBACK_MODELS.indexOf(currentModel);
      nextModel = FALLBACK_MODELS[(currentIndex + 1) % FALLBACK_MODELS.length];
    }

    const updatedManifest = {
      ...agent.manifest,
      model: { name: nextModel },
    };
    const putRes = await fetch(`${config.baseUrl}/api/v1/agents/${encodeURIComponent(agent.id)}`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
      },
      body: JSON.stringify({ manifest: updatedManifest }),
    });
    if (!putRes.ok) return { success: false, error: "failed_to_update_agent" };
    return { success: true, model: nextModel, previousModel: currentModel };
  } catch (err) {
    return { success: false, error: err?.message || "rotation_error" };
  }
}

export const config = { maxDuration: 300 };

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  const origin = header(request, "origin");
  const origins = configuredOrigins();
  if (origins.length > 0 && (!origin || !origins.includes(origin))) {
    errorResponse(response, 403, "origin_not_allowed");
    return;
  }
  if (origin && origins.includes(origin)) response.setHeader("Access-Control-Allow-Origin", origin);
  if (request.method === "OPTIONS") {
    response.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
    response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.status(204).end();
    return;
  }
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST, OPTIONS");
    errorResponse(response, 405, "method_not_allowed");
    return;
  }

  const body = parseBody(request);
  if (!body || typeof body !== "object") {
    errorResponse(response, 400, "invalid_json");
    return;
  }
  if (Buffer.byteLength(JSON.stringify(body)) > MAX_BODY_BYTES) {
    errorResponse(response, 413, "request_too_large");
    return;
  }

  const action = typeof body.action === "string" ? body.action : "";
  const supportedActions = new Set(["status", "create", "turn", "subscribe", "events", "session", "cancel", "rotate-model"]);
  if (!supportedActions.has(action)) {
    errorResponse(response, 400, "unsupported_action");
    return;
  }
  const configValues = runtimeConfig();
  if (!authorize(request, response, configValues.uiToken)) return;
  if (action === "rotate-model") {
    const result = await rotateAgentModel(configValues, body.model);
    response.status(result.success ? 200 : 500).json(result);
    return;
  }

  if ((!configValues.configuredBaseUrl && isProductionRuntime()) || !configValues.baseUrl || !configValues.agentName) {
    errorResponse(response, 503, "trueforge_not_configured");
    return;
  }

  if (["create", "status"].includes(action) === false && !validId(body.sessionId)) {
    errorResponse(response, 400, "session_id_required");
    return;
  }
  if (action === "subscribe" && !validId(body.turnId)) {
    errorResponse(response, 400, "turn_id_required");
    return;
  }
  if (action === "turn" && !validInput(body.input)) {
    errorResponse(response, 400, "invalid_turn_input");
    return;
  }
  if (action === "turn" && body.previousTurnId !== undefined && body.previousTurnId !== "auto" && body.previousTurnId !== "none" && !validId(body.previousTurnId)) {
    errorResponse(response, 400, "invalid_previous_turn");
    return;
  }

  try {
    const upstream = await callTrueForge(configValues, action, body);
    const contentType = upstream.headers.get("content-type") || "";
    if ((action === "turn" || action === "subscribe") && contentType.includes("text/event-stream")) {
      await pipeStream(upstream, response);
      return;
    }
    const payload = await readJson(upstream);
    if (!upstream.ok) {
      errorResponse(response, upstream.status, "trueforge_upstream", upstreamMessage(payload, `TrueForge returned ${upstream.status}`));
      return;
    }
    if (action === "status") {
      const agents = Array.isArray(payload?.data) ? payload.data : [];
      const agent = agents.find((item) => item?.name === configValues.agentName);
      response.status(200).json({
        configured: true,
        ready: Boolean(agent),
        agent: agent ? { id: agent.id, name: agent.name } : null,
      });
      return;
    }
    response.status(upstream.status).json(payload ?? {});
  } catch (error) {
    console.error("TrueForge proxy error", error);
    errorResponse(response, 502, "trueforge_unavailable", "The agent runtime could not be reached.");
  }
}
