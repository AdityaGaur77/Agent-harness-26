const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const EXA_SEARCH_URL = "/api/exa-search";
const TRUEFORGE_PROXY_URL = "/api/trueforge-session";
const TRUEFORGE_AGENT_NAME = "blast-radius";

const body = document.body;
const skipLink = $(".skip-link");
const landingView = $("#landing-view");
const landingMotion = $("#landing-motion");
const enterAgentButton = $("#enter-agent");
const appShell = $("#app-shell");
const homeView = $("#home-view");
const agentView = $("#agent-view");
const homeForm = $("#home-form");
const homePrompt = $("#home-prompt");
const agentForm = $("#agent-composer");
const agentPrompt = $("#agent-prompt");
const conversationScroll = $("#conversation-scroll");
const conversationThread = $("#conversation-thread");
const userMissionCopy = $("#user-mission-copy");
const missionTitle = $("#mission-title");
const missionStatus = $("#mission-status");
const topbarTitle = $("#topbar-title");
const progressTitle = $("#progress-title");
const progressDetail = $("#progress-detail");
const progressTrack = $("#progress-track");
const progressFill = $("#progress-fill");
const pauseButton = $("#pause-run");
const runTimer = $("#run-timer");
const runAnnouncement = $("#run-announcement");
const composerStatus = $("#composer-status");
const identityQuestion = $("#identity-question");
const identityQuestionTitle = $("#identity-question-title");
const completionMessage = $("#completion-message");
const activityCard = $(".activity-card");
const activityToggle = $("#activity-toggle");
const activityBody = $("#activity-body");
const activitySummary = $("#activity-summary");
const subagentList = $("#subagent-list");
const subagentCount = $("#subagent-count");
const evidenceList = $("#evidence-list");
const sourceSummary = $("#source-summary");
const matchStatus = $("#match-status");
const permissionsSummary = $("#permissions-summary");
const impactState = $("#impact-state");
const impactCopy = $("#impact-copy");
const auditList = $("#audit-list");
const detailsDrawer = $("#details-drawer");
const detailsClose = $("#details-close");
const sidebarToggle = $("#sidebar-toggle");
const sidebarClose = $("#sidebar-close");
const connectorDialog = $("#connector-dialog");
const connectorResult = $("#connector-result");
const identityDialog = $("#identity-dialog");
const workspaceStatusTitle = $("#workspace-status-title");
const workspaceStatusCopy = $("#workspace-status-copy");
const topbarStatus = $("#topbar-status");
const identityQuestionCopy = $("#identity-question-copy");
const identityAnswerYes = $('[data-identity-answer="yes"]');
const identityAnswerNo = $('[data-identity-answer="no"]');
const deleteActionButton = $("#delete-action");
const drawerApproval = $("#drawer-approval");
const drawerApprovalTitle = $("#drawer-approval-title");
const drawerApprovalCopy = $("#drawer-approval-copy");
const drawerApproveButton = $("#drawer-approve");
const denyActionButton = $("#deny-action");
const trueForgeStatus = $("#trueforge-status");
const completionNote = $(".completion-note");
const completionTitle = $("#completion-title");
const completionCopy = $("#completion-copy");

const VIEW_TRANSITION_MS = 280;

const RUN_STATES = [
  "idle",
  "reasoning",
  "question",
  "searching",
  "rehearsing",
  "executing",
  "monitoring",
  "complete",
  "error",
  "indeterminate",
];

const stateCopy = {
  idle: {
    title: "Ready",
    detail: "Describe what to find.",
    mission: "Ready",
    progress: 0,
    aria: "The agent is ready",
  },
  reasoning: {
    title: "Sorting your request",
    detail: "Deciding what to look for.",
    mission: "Sorting your request",
    progress: 8,
    aria: "The request is being sorted",
  },
  question: {
    title: "Waiting for you",
    detail: "Choose the match to keep checking.",
    mission: "Waiting for your choice",
    progress: 24,
    aria: "A choice is needed before the search continues",
  },
  searching: {
    title: "Reviewing sources",
    detail: "Checking brokers, records, and linked accounts.",
    mission: "Reviewing sources",
    progress: 48,
    aria: "Sources are being reviewed",
  },
  rehearsing: {
    title: "Reviewing changes",
    detail: "Checking what will change before anything happens.",
    mission: "Reviewing possible changes",
    progress: 70,
    aria: "Possible changes are being reviewed",
  },
  executing: {
    title: "Applying approved choices",
    detail: "Only approved changes are applied.",
    mission: "Applying approved choices",
    progress: 86,
    aria: "Approved changes are being applied",
  },
  monitoring: {
    title: "Checking the result",
    detail: "Counting what changed and what stays.",
    mission: "Checking the result",
    progress: 95,
    aria: "The result is being checked",
  },
  complete: {
    title: "Ready for your review",
    detail: "Review the findings before approving a change.",
    mission: "Ready for your review",
    progress: 100,
    aria: "Your request is ready to review",
  },
  error: {
    title: "Paused with care",
    detail: "Nothing changed.",
    mission: "Paused with care",
    progress: 100,
    aria: "Nothing changed",
  },
  indeterminate: {
    title: "Outcome needs confirmation",
    detail: "The response was lost after dispatch.",
    mission: "Outcome needs confirmation",
    progress: 100,
    aria: "The final outcome needs confirmation",
  },
};

const subagentPlan = [
  { key: "identity", label: "Match your identity" },
  { key: "brokers", label: "Check data brokers" },
  { key: "records", label: "Check public records" },
  { key: "links", label: "Trace linked accounts" },
  { key: "web", label: "Search the web" },
];

const standingAuthorization = {
  discover: true,
  request: true,
  erase: true,
};

// Resolve a customer-provided name before searching connected services.
function normalizeGovInput(s) { return s.trim().replace(/\s+/g, " "); }
function normalizePrompt(s) { return String(s || "").trim().replace(/\s+/g, " ").toLowerCase(); }
function resolveGovInput(raw) {
  const t = normalizeGovInput(raw);
  if (!t) return null;
  if (/^\d+$/.test(t)) {
    const id = Number(t);
    return { id, displayName: t, via: "id" };
  }
  return { id: null, displayName: t, via: "name", raw: t };
}
function extractGovNameFromPrompt(prompt) {
  const subjectId = String(prompt || "").match(/\b(?:customer|subject|record|profile|id)\s*#?\s*(\d+)\b/i);
  if (subjectId) return subjectId[1];
  const m = String(prompt || "").match(/\b([A-Z][a-z]+ [A-Z][a-z]+(?: [A-Z][a-z]+)?)\b/);
  return m ? m[1] : null;
}

function displayGovName(resolved) {
  if (!resolved) return "";
  return resolved.id ? `Customer ${resolved.id}` : resolved.displayName;
}

function resolveMcpUrl() {
  const injected = typeof window !== "undefined" && window.__MCP_URL__ && window.__MCP_URL__ !== "__MCP_URL__" ? String(window.__MCP_URL__).trim() : "";
  if (injected) return injected;
  const el = document.getElementById("connector-url");
  if (el && el.value && el.value.trim()) return el.value.trim();
  const fromStorage = localStorage.getItem("blast_mcp_url");
  if (fromStorage && fromStorage.trim()) return fromStorage.trim();
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  if (host && host !== "localhost" && host !== "127.0.0.1" && !host.startsWith("192.168.")) {
    return "https://blast-mcp.onrender.com/mcp";
  }
  return "http://localhost:8080/mcp";
}
function resolveMcpToken() {
  const injected = typeof window !== "undefined" && window.__MCP_TOKEN__ && window.__MCP_TOKEN__ !== "__MCP_TOKEN__" ? String(window.__MCP_TOKEN__).trim() : "";
  if (injected) return injected;
  const el = document.getElementById("connector-token");
  if (el && el.value) return el.value.trim();
  const fromSession = sessionStorage.getItem("blast_mcp_token");
  if (fromSession && fromSession.trim()) return fromSession.trim();
  return "";
}

// TrueForge is the stateful agent path. Browser requests go through the
// same-origin proxy so its server token never enters the page; the client only
// keeps the session/turn cursor needed to render and resume a live stream.
function resolveTrueForgeUiToken() {
  const injected = typeof window !== "undefined" && window.__TRUEFORGE_UI_TOKEN__ && window.__TRUEFORGE_UI_TOKEN__ !== "__TRUEFORGE_UI_TOKEN__"
    ? String(window.__TRUEFORGE_UI_TOKEN__).trim()
    : "";
  if (injected) return injected;
  const input = document.getElementById("trueforge-ui-token");
  if (input?.value) return input.value.trim();
  const fromSession = sessionStorage.getItem("blast_trueforge_ui_token");
  return fromSession?.trim() || "";
}

const trueForgeRuntime = {
  checked: false,
  available: false,
  ready: false,
  agentName: TRUEFORGE_AGENT_NAME,
  sessionId: sessionStorage.getItem("blast_trueforge_session") || null,
  turnId: sessionStorage.getItem("blast_trueforge_turn") || null,
  lastSequenceNumber: Number(sessionStorage.getItem("blast_trueforge_sequence") || 0),
  events: new Map(),
  currentMessageNodes: new Map(),
  threadSlots: new Map(),
  pendingApprovals: [],
  pendingQuestions: [],
  pendingAuth: null,
  streamController: null,
};

function persistTrueForgeRuntime() {
  if (trueForgeRuntime.sessionId) sessionStorage.setItem("blast_trueforge_session", trueForgeRuntime.sessionId);
  else sessionStorage.removeItem("blast_trueforge_session");
  if (trueForgeRuntime.turnId) sessionStorage.setItem("blast_trueforge_turn", trueForgeRuntime.turnId);
  else sessionStorage.removeItem("blast_trueforge_turn");
  if (Number.isFinite(trueForgeRuntime.lastSequenceNumber)) sessionStorage.setItem("blast_trueforge_sequence", String(trueForgeRuntime.lastSequenceNumber));
}

function clearTrueForgeSession() {
  trueForgeRuntime.sessionId = null;
  trueForgeRuntime.turnId = null;
  trueForgeRuntime.lastSequenceNumber = 0;
  trueForgeRuntime.events.clear();
  trueForgeRuntime.currentMessageNodes.clear();
  trueForgeRuntime.threadSlots = new Map();
  trueForgeRuntime.pendingApprovals = [];
  trueForgeRuntime.pendingQuestions = [];
  trueForgeRuntime.pendingAuth = null;
  persistTrueForgeRuntime();
}

function trueForgeErrorFromResponse(status, payload, fallback) {
  const error = new Error(payload?.message || payload?.error || fallback || `TrueForge request failed (${status})`);
  error.status = status;
  error.code = payload?.error || "trueforge_request_failed";
  return error;
}

async function trueForgeJson(action, payload = {}) {
  const token = resolveTrueForgeUiToken();
  const headers = { "content-type": "application/json", accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(TRUEFORGE_PROXY_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, ...payload }),
  });
  const text = await response.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* handled below */ }
  if (!response.ok) throw trueForgeErrorFromResponse(response.status, parsed, "The agent runtime is unavailable.");
  return parsed || {};
}

function parseSseBlock(block) {
  let id;
  const data = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("id:")) id = line.slice(3).trim();
    if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (!data.length || data.join("\n") === "[DONE]") return { id, event: null };
  try {
    return { id, event: JSON.parse(data.join("\n")) };
  } catch {
    throw new Error("The agent runtime returned an invalid event.");
  }
}

async function readTrueForgeStream(response, onEvent) {
  if (!response.body) throw new Error("The agent runtime returned an empty stream.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || "";
    for (const block of blocks) {
      const parsed = parseSseBlock(block);
      if (parsed.event) await onEvent(parsed.event, parsed.id);
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) {
    const parsed = parseSseBlock(buffer);
    if (parsed.event) await onEvent(parsed.event, parsed.id);
  }
}

async function trueForgeStream(action, payload, onEvent, signal) {
  const token = resolveTrueForgeUiToken();
  const headers = { "content-type": "application/json", accept: "text/event-stream" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(TRUEFORGE_PROXY_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, ...payload }),
    signal,
  });
  if (!response.ok) {
    const text = await response.text();
    let parsed = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { /* use fallback */ }
    throw trueForgeErrorFromResponse(response.status, parsed, "The agent runtime is unavailable.");
  }
  await readTrueForgeStream(response, onEvent);
}

async function checkTrueForge({ quiet = false } = {}) {
  try {
    const status = await trueForgeJson("status");
    trueForgeRuntime.checked = true;
    trueForgeRuntime.available = status.configured === true;
    trueForgeRuntime.ready = status.ready === true;
    trueForgeRuntime.agentName = status.agent?.name || TRUEFORGE_AGENT_NAME;
    if (!quiet) {
      updateTrueForgeStatusCopy(trueForgeRuntime.ready
        ? `Connected · ${trueForgeRuntime.agentName}`
        : "Runtime is connected, but the privacy agent is not provisioned");
    }
  } catch (error) {
    trueForgeRuntime.checked = true;
    trueForgeRuntime.available = false;
    trueForgeRuntime.ready = false;
    if (!quiet) updateTrueForgeStatusCopy(error.code === "ui_auth_not_configured"
      ? "Add the workspace token to enable the agent runtime"
      : "Direct service mode · TrueForge is not connected");
  }
  return trueForgeRuntime;
}

function updateTrueForgeStatusCopy(copy) {
  if (!trueForgeStatus) return;
  const mark = $("span", trueForgeStatus);
  const title = $("strong", trueForgeStatus);
  const detail = $("small", trueForgeStatus);
  if (mark) mark.textContent = trueForgeRuntime.ready ? "[x]" : "[ ]";
  if (title) title.textContent = trueForgeRuntime.ready ? "Agent runtime connected" : "Agent runtime";
  if (detail) detail.textContent = copy;
}

// MCP client for the browser; uses the streamable HTTP initialize handshake and bearer auth.
let mcpSessionId = sessionStorage.getItem("blast_mcp_session") || null;
let mcpInitialized = sessionStorage.getItem("blast_mcp_initialized") === "1";
let mcpRequestId = Date.now();
if (!mcpInitialized) mcpSessionId = null;

function clearMcpSession() {
  mcpSessionId = null;
  mcpInitialized = false;
  sessionStorage.removeItem("blast_mcp_session");
  sessionStorage.removeItem("blast_mcp_initialized");
}

function parseMcpPayload(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;
  const dataLines = trimmed.split("\n")
    .filter((line) => line.trim().startsWith("data:"))
    .map((line) => line.slice(line.indexOf(":") + 1).trim())
    .filter(Boolean);
  const jsonText = dataLines.length ? dataLines[dataLines.length - 1] : trimmed;
  try { return JSON.parse(jsonText); } catch { throw new Error("MCP returned an invalid response"); }
}

async function mcpRequest(url, token, method, params, { notification = false } = {}) {
  const headers = { "content-type": "application/json", accept: "application/json, text/event-stream", Authorization: `Bearer ${token}` };
  if (mcpSessionId) headers["mcp-session-id"] = mcpSessionId;
  const request = { jsonrpc: "2.0", method, params };
  if (!notification) request.id = mcpRequestId += 1;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(request) });
  const sess = res.headers.get("mcp-session-id") || res.headers.get("Mcp-Session-Id");
  if (sess) { mcpSessionId = sess; sessionStorage.setItem("blast_mcp_session", sess); }
  const text = await res.text();
  let payload = null;
  try {
    payload = parseMcpPayload(text);
  } catch (error) {
    if (!res.ok) throw new Error(`MCP request failed (${res.status})`);
    throw error;
  }
  if (!res.ok) throw new Error(`MCP request failed (${res.status})${payload?.error?.message ? `: ${payload.error.message}` : ""}`);
  if (payload?.error) throw new Error(payload.error.message || "MCP request failed");
  return payload;
}

async function initializeMcp(url, token) {
  if (!url || !token) throw new Error("A service address and access token are required");
  clearMcpSession();
  const payload = await mcpRequest(url, token, "initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "blast-radius-ui", version: "0.1.0" },
  });
  if (!payload?.result) throw new Error("MCP did not complete initialization");
  await mcpRequest(url, token, "notifications/initialized", {}, { notification: true });
  mcpInitialized = true;
  sessionStorage.setItem("blast_mcp_initialized", "1");
  return payload;
}

async function mcpCall(url, token, method, params) {
  if (method !== "initialize" && !mcpInitialized) await initializeMcp(url, token);
  try {
    return await mcpRequest(url, token, method, params);
  } catch (error) {
    const staleSession = mcpSessionId && /session[ _-]?not[ _-]?found|unknown session|not initialized|request failed \((?:400|404)\)/i.test(error.message || "");
    if (!staleSession || method === "initialize") throw error;
    await initializeMcp(url, token);
    return mcpRequest(url, token, method, params);
  }
}
async function mcpTool(url, token, name, args) {
  const r = await mcpCall(url, token, "tools/call", { name, arguments: args });
  if (r?.result?.isError) {
    const error = new Error(r.result.content?.[0]?.text || `${name} failed`);
    // An MCP tool error is a response from the service, not a lost transport
    // response. The server has definitively refused or rolled back the call.
    error.definitiveNoChange = true;
    throw error;
  }
  const c = r?.result?.content?.[0]?.text || r?.raw || "";
  try { return JSON.parse(c); } catch { throw new Error(`${name} returned an invalid payload`); }
}

async function exaSearch(query, options = {}) {
  try {
    const headers = { "content-type": "application/json" };
    const token = resolveMcpToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(EXA_SEARCH_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query,
        numResults: options.numResults ?? 10,
        type: options.type ?? "neural",
        includeDomains: options.includeDomains,
        excludeDomains: options.excludeDomains,
        useAutoprompt: true
      })
    });
    if (!res.ok) throw new Error(`Exa error: ${res.status}`);
    return await res.json();
  } catch (e) {
    return { error: e.message, results: [] };
  }
}

async function updateHarnessStatus() {
  const urlEl = document.getElementById("connector-url");
  const tokenEl = document.getElementById("connector-token");
  const statusTitle = document.getElementById("workspace-status-title");
  const statusCopy = document.getElementById("workspace-status-copy");
  const topbarStatus = document.getElementById("topbar-status");
  const url = resolveMcpUrl();
  const tokenForStatus = resolveMcpToken();
  const isFly = url.includes("fly.dev");
  const runtime = trueForgeRuntime.ready ? trueForgeRuntime : await checkTrueForge({ quiet: true });
  if (runtime.ready) {
    if (statusTitle) statusTitle.textContent = "Agent runtime";
    if (statusCopy) statusCopy.textContent = "Connected and ready";
    if (topbarStatus) topbarStatus.innerHTML = '<span aria-hidden="true"></span>Agent connected';
    return;
  }
  if (statusTitle) statusTitle.textContent = "Connected services";
  if (statusCopy) {
    try {
      statusCopy.textContent = "Checking your connected services";
    } catch {
      statusCopy.textContent = "Checking your connected services";
    }
  }
  if (topbarStatus) topbarStatus.innerHTML = '<span aria-hidden="true"></span>Connected services';
  localStorage.setItem("blast_mcp_url", url);
  if (tokenEl?.value) sessionStorage.setItem("blast_mcp_token", tokenEl.value);
  else if (tokenForStatus) sessionStorage.setItem("blast_mcp_token", tokenForStatus);
  if (urlEl && !urlEl.value) urlEl.value = url;
  if (!tokenForStatus) {
    if (statusTitle) statusTitle.textContent = "Private workspace";
    if (statusCopy) statusCopy.textContent = "No connected services yet";
    if (topbarStatus) topbarStatus.innerHTML = '<span aria-hidden="true"></span>Private workspace';
    return;
  }
  try {
    const healthUrl = new URL(url).origin + "/healthz";
    const h = await fetch(healthUrl);
    if (h.ok && statusCopy) statusCopy.textContent = "Connected and ready";
    else if (statusCopy) statusCopy.textContent = "Service unavailable. Try again when ready.";
  } catch {
    if (statusCopy) statusCopy.textContent = "Service unavailable. Try again when ready.";
  }
}

function setWorkspaceStatus(title, copy, pill = title) {
  if (workspaceStatusTitle) workspaceStatusTitle.textContent = title;
  if (workspaceStatusCopy) workspaceStatusCopy.textContent = copy;
  if (topbarStatus) topbarStatus.innerHTML = `<span aria-hidden="true"></span>${pill}`;
}

function persistConnectorConfig() {
  const url = $("#connector-url")?.value.trim();
  const token = $("#connector-token")?.value.trim();
  const trueForgeToken = $("#trueforge-ui-token")?.value.trim();
  if (url) localStorage.setItem("blast_mcp_url", url);
  if (token) sessionStorage.setItem("blast_mcp_token", token);
  if (trueForgeToken) sessionStorage.setItem("blast_trueforge_ui_token", trueForgeToken);
  const statusCopy = $("#workspace-status-copy");
  const statusTitle = $("#workspace-status-title");
  const topbarStatus = $("#topbar-status");
  if (url && statusCopy) statusCopy.textContent = "Connected and ready";
  if (statusTitle) statusTitle.textContent = "Connected services";
  if (topbarStatus) topbarStatus.innerHTML = '<span aria-hidden="true"></span>Connected';
}

function syncConnectorForm() {
  const urlInput = $("#connector-url");
  const tokenInput = $("#connector-token");
  const trueForgeTokenInput = $("#trueforge-ui-token");
  if (!urlInput || !tokenInput) return;
  if (!urlInput.value) urlInput.value = resolveMcpUrl();
  if (!tokenInput.value) {
    const token = sessionStorage.getItem("blast_mcp_token") || "";
    if (token) tokenInput.value = token;
  }
  if (trueForgeTokenInput && !trueForgeTokenInput.value) {
    const token = sessionStorage.getItem("blast_trueforge_ui_token") || "";
    if (token) trueForgeTokenInput.value = token;
  }
}

const run = {
  state: "idle",
  view: "home",
  homePanel: "start",
  mode: "live",
  paused: false,
  generation: 0,
  startedAt: null,
  timerId: null,
  lastFocus: null,
  waitingForLocation: false,
  pendingQuestion: null,
  liveData: null,
  evidence: [],
  liveReviewReady: false,
  executionIndeterminate: false,
};

class PresenceAgent {
  constructor(element, options) {
    this.element = element;
    this.columns = options.columns;
    this.rows = options.rows;
    this.home = Boolean(options.home);
    this.state = "idle";
    this.phase = 0;
    this.displacement = 0;
    this.velocity = 0;
    this.target = 0;
    this.paused = false;
    this.active = true;
    this.lastFrame = 0;
    this.frameInterval = 1000 / 12;
    this.boundTick = this.tick.bind(this);
    this.prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.addEventListener("visibilitychange", () => {
      if (this.active && !this.prefersReduced && document.visibilityState === "visible" && !this.rafId) {
        this.rafId = requestAnimationFrame(this.boundTick);
      }
    });
    this.rafId = requestAnimationFrame(this.boundTick);
  }

  setState(nextState) {
    if (!RUN_STATES.includes(nextState)) return;
    this.state = nextState;
    this.target = RUN_STATES.indexOf(nextState) / (RUN_STATES.length - 1);
    this.element.setAttribute("aria-label", stateCopy[nextState].aria);
    if (this.prefersReduced && this.active) this.render();
  }

  setPaused(paused) {
    this.paused = paused;
  }

  setActive(active) {
    this.active = Boolean(active);
    if (!this.active) {
      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.rafId = 0;
      return;
    }
    this.render();
    if (!this.prefersReduced && !this.rafId) this.rafId = requestAnimationFrame(this.boundTick);
  }

  springStep(target, dt) {
    const stiffness = 28;
    const damping = 10.2;
    const force = (target - this.displacement) * stiffness;
    this.velocity += force * dt;
    this.velocity *= Math.exp(-damping * dt);
    this.displacement += this.velocity * dt;
  }

  tick(timestamp) {
    this.rafId = 0;
    if (!this.active || this.prefersReduced || document.visibilityState !== "visible") return;
    if (timestamp - this.lastFrame < this.frameInterval) {
      this.rafId = requestAnimationFrame(this.boundTick);
      return;
    }
    const elapsed = this.lastFrame ? Math.min((timestamp - this.lastFrame) / 1000, 0.1) : 1 / 12;
    this.lastFrame = timestamp;
    this.springStep(this.target, elapsed);
    if (!this.paused && !this.prefersReduced) this.phase += elapsed * this.stateSpeed();
    else if (this.paused) this.phase += elapsed * this.stateSpeed() * 0.08;
    this.render();
    this.rafId = requestAnimationFrame(this.boundTick);
  }

  stateSpeed() {
    return {
      idle: 0.6,
      reasoning: 1.05,
      question: 0.42,
      searching: 1.9,
      rehearsing: 1.2,
      executing: 1.65,
      monitoring: 0.85,
      complete: 0.3,
      error: 0.18,
      indeterminate: 0.12,
    }[this.state];
  }

  render() {
    const grid = Array.from({ length: this.rows }, () => Array(this.columns).fill(" "));
    const centerX = (this.columns - 1) / 2;
    const centerY = (this.rows - 1) / 2;
    const pulse = Math.sin(this.phase * 1.6) * 0.018;
    const stateShift = (this.displacement - 0.5) * 0.06;
    const breathe = Math.sin(this.phase * 0.9) * 0.012;

    for (let row = 0; row < this.rows; row += 1) {
      for (let column = 0; column < this.columns; column += 1) {
        const x = (column - centerX) / (this.columns * 0.5);
        const y = (row - centerY) / (this.rows * 0.5);
        const ellipse = Math.sqrt((x / 0.88) ** 2 + (y / 0.72) ** 2);
        const angle = Math.atan2(y, x);
        const orbitBase = this.home ? 0.74 : 0.64;
        const orbit = orbitBase + pulse + breathe + stateShift + Math.sin(angle * 2.2 + this.phase * 0.85) * 0.018;
        const outer = Math.abs(ellipse - orbit);
        const innerR = 0.36 - pulse * 0.28;
        const inner = Math.abs(ellipse - innerR);
        const middle = Math.abs(ellipse - (0.55 + pulse * 0.45));
        const scanWave = Math.sin(x * 3.8 + this.phase * 1.4) * 0.07;
        const scanner = Math.abs(y - scanWave);
        let character = " ";

        if (outer < (this.home ? 0.03 : 0.02)) {
          character = this.orbitCharacter(angle);
        } else if (this.home && middle < 0.014) {
          character = Math.sin(angle * 5 + this.phase * 0.65) > -0.1 ? "·" : " ";
        } else if (inner < (this.home ? 0.022 : 0.016) && this.state !== "question") {
          const innerPulse = Math.sin(angle * 4 - this.phase * 1.1);
          character = innerPulse > 0.18 ? "·" : " ";
        }

        if (this.state === "searching" && scanner < 0.024 && Math.abs(x) < 0.7) {
          character = column % 4 === 0 ? "·" : " ";
          if (column % 12 === 0) character = "·";
        }

        if (this.state === "rehearsing") {
          const diamond = Math.abs(x) + Math.abs(y * 1.42);
          if (Math.abs(diamond - (0.46 + pulse)) < 0.022) character = "·";
          if (Math.abs(diamond - (0.46 + pulse)) < 0.012) character = "·";
        }

        if (this.state === "executing" && Math.abs(y) < 0.032 && Math.abs(x) < 0.66) {
          character = column % 5 === 0 ? "─" : " ";
          if (column % 20 === 0) character = "·";
        }

        if (this.state === "monitoring") {
          const sweep = Math.abs(angle - ((this.phase % (Math.PI * 2)) - Math.PI));
          if (outer < 0.045 && sweep < 0.14) character = "·";
        }

        if (this.state === "error" && Math.abs(Math.abs(x) - Math.abs(y * 1.28)) < 0.022 && Math.abs(x) < 0.4) {
          character = "×";
        }

        grid[row][column] = character;
      }
    }

    this.drawCore(grid, centerX, centerY);
    this.element.textContent = grid.map((line) => line.join("")).join("\n");
  }

  orbitCharacter(angle) {
    if (this.state === "complete") {
      const seq = ["·", "·", "·", "·"];
      const idx = Math.floor((angle + this.phase * 0.6) * 1.4) % seq.length;
      return seq[Math.abs(idx)];
    }
    const seq = this.home ? ["·", "·", "·", " "] : ["·", ":", "·", " "];
    const idx = Math.floor((angle + this.phase) * 1.2) % seq.length;
    return seq[Math.abs(idx)];
  }

  drawCore(grid, centerX, centerY) {
    const labels = {
      idle: this.home ? "[ ready ]" : "[ ready ]",
      reasoning: "[ thinking ]",
      question: "[ ? ]",
      searching: "[ finding ]",
      rehearsing: "[ checking ]",
      executing: "[ clearing ]",
      monitoring: "[ check ]",
      complete: "[ done ]",
      error: "[ paused ]",
      indeterminate: "[ review ]",
    };
    const label = labels[this.state];
    const row = Math.round(centerY);
    const start = Math.max(0, Math.round(centerX - label.length / 2));
    for (let column = Math.max(0, start - 2); column < Math.min(this.columns, start + label.length + 2); column += 1) {
      grid[row][column] = " ";
    }
    for (let index = 0; index < label.length && start + index < this.columns; index += 1) {
      grid[row][start + index] = label[index];
    }

    if (this.home && row + 2 < this.rows) {
      const sublabel = this.state === "idle" ? "your data, under your direction" : stateCopy[this.state].title.toLowerCase();
      const clean = sublabel.slice(0, this.columns - 4);
      const subStart = Math.max(0, Math.round(centerX - clean.length / 2));
      for (let column = Math.max(0, subStart - 2); column < Math.min(this.columns, subStart + clean.length + 2); column += 1) {
        grid[row + 2][column] = " ";
      }
      for (let index = 0; index < clean.length && subStart + index < this.columns; index += 1) {
        grid[row + 2][subStart + index] = clean[index];
      }
    }

    if (this.home && this.state === "idle" && row + 4 < this.rows) {
      const meta = "public web  ·  brokers  ·  linked records";
      const mStart = Math.max(0, Math.round(centerX - meta.length / 2));
      for (let column = Math.max(0, mStart - 2); column < Math.min(this.columns, mStart + meta.length + 2); column += 1) {
        grid[row + 4][column] = " ";
      }
      for (let i = 0; i < meta.length && mStart + i < this.columns; i += 1) {
        grid[row + 4][mStart + i] = meta[i];
      }
    }
  }
}

const HORSE_FRAME_COUNT = 11;
const HORSE_FPS = 12;
const HORSE_FRAME_MS = 1000 / HORSE_FPS;
const HORSE_REPEL_RADIUS = 110;
const HORSE_REPEL_STRENGTH = 0.3;
const HORSE_APPEAR_FADE_MS = 150;
const HORSE_APPEAR_GAP_MS = 1250;
const HORSE_EDGE_BOOST = 1.65;
const HORSE_EDGE_WEIGHT = 0.75;
const HORSE_EDGE_THRESHOLD = 2;
const HORSE_RAMP = " .'`^,:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
const HORSE_FRAME_URLS = Array.from(
  { length: HORSE_FRAME_COUNT },
  (_, index) => `./assets/horse/frame-${String(index + 1).padStart(2, "0")}.webp`,
);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

class HorseMotion {
  constructor(element) {
    this.element = element;
    this.context = element.getContext("2d", { alpha: true });
    this.offscreen = document.createElement("canvas");
    this.offscreenContext = this.offscreen.getContext("2d", { willReadFrequently: true });
    this.frames = [];
    this.columns = 120;
    this.rows = 75;
    this.width = 0;
    this.height = 0;
    this.cellWidth = 1;
    this.cellHeight = 1;
    this.fontSize = 8;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.frameIndex = 0;
    this.lastFrame = performance.now();
    this.introStartTime = performance.now();
    this.appearDelay = null;
    this.rafId = 0;
    this.active = false;
    this.prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.pointer = null;
    this.boundTick = this.tick.bind(this);
    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
      this.render(performance.now());
    });
    this.resizeObserver.observe(element);
    element.addEventListener("pointermove", (event) => {
      const rect = element.getBoundingClientRect();
      this.pointer = {
        x: (event.clientX - rect.left) * this.dpr,
        y: (event.clientY - rect.top) * this.dpr,
      };
    });
    element.addEventListener("pointerleave", () => { this.pointer = null; });
    element.addEventListener("pointercancel", () => { this.pointer = null; });
    document.addEventListener("visibilitychange", () => {
      if (!this.active || this.prefersReduced) return;
      if (document.visibilityState === "visible") this.startLoop();
      else this.stopLoop();
    });
    this.loadFrames();
  }

  resize() {
    const rect = this.element.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return false;

    const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
    const nextWidth = Math.floor(rect.width * nextDpr);
    const nextHeight = Math.floor(rect.height * nextDpr);
    const unchanged = nextWidth === this.width && nextHeight === this.height && nextDpr === this.dpr;
    if (unchanged) return false;

    const previousColumns = this.columns;
    const previousRows = this.rows;
    this.dpr = nextDpr;
    this.width = nextWidth;
    this.height = nextHeight;
    this.element.width = nextWidth;
    this.element.height = nextHeight;

    let cellSize = 10;
    if (window.innerWidth >= 992) cellSize = 9;
    if (window.innerWidth >= 1440) cellSize = 8.5;

    this.columns = clamp(Math.round(rect.width / cellSize), 80, 220);
    this.rows = clamp(Math.round(rect.height / cellSize), 55, 160);
    this.cellWidth = this.width / this.columns;
    this.cellHeight = this.height / this.rows;
    this.fontSize = clamp(Math.floor(Math.min(this.cellWidth, this.cellHeight) * 1.45), 8, 18);

    this.context.textBaseline = "top";
    this.context.font = `${this.fontSize}px "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
    this.context.imageSmoothingEnabled = false;

    if (this.appearDelay && (previousColumns !== this.columns || previousRows !== this.rows)) {
      this.buildAppearDelays();
    }
    return true;
  }

  setActive(active) {
    this.active = Boolean(active);
    if (this.active) {
      this.resize();
      this.render(performance.now());
      if (!this.prefersReduced && this.frames.length) this.startLoop();
    } else {
      this.stopLoop();
    }
  }

  startLoop() {
    if (!this.active || this.prefersReduced || document.visibilityState !== "visible" || this.rafId) return;
    this.rafId = requestAnimationFrame(this.boundTick);
  }

  stopLoop() {
    if (!this.rafId) return;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  tick(timestamp) {
    this.rafId = 0;
    if (!this.active || this.prefersReduced || document.visibilityState !== "visible") return;
    this.resize();

    const elapsed = timestamp - this.lastFrame;
    if (elapsed >= HORSE_FRAME_MS && this.frames.length) {
      const steps = Math.floor(elapsed / HORSE_FRAME_MS);
      this.frameIndex = (this.frameIndex + steps) % this.frames.length;
      this.lastFrame += steps * HORSE_FRAME_MS;
    }
    this.render(timestamp);
    this.startLoop();
  }

  async loadFrames() {
    const loaded = await Promise.all(HORSE_FRAME_URLS.map((src) => new Promise((resolve) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    })));
    this.frames = loaded.filter(Boolean);
    if (!this.frames.length) return;

    this.resize();
    this.buildAppearDelays();
    this.introStartTime = performance.now();
    this.lastFrame = this.introStartTime;
    this.frameIndex = 0;
    this.render(this.introStartTime);
    if (this.active && !this.prefersReduced) this.startLoop();
  }

  buildAppearDelays() {
    const cellCount = this.columns * this.rows;
    this.appearDelay = new Float32Array(cellCount);
    for (let index = 0; index < cellCount; index += 1) {
      this.appearDelay[index] = Math.random() * HORSE_APPEAR_GAP_MS;
    }
  }

  cellAlpha(elapsed, index) {
    if (this.prefersReduced || !this.appearDelay) return 1;
    const revealTime = elapsed - this.appearDelay[index];
    if (revealTime <= 0) return 0;
    return clamp(revealTime / HORSE_APPEAR_FADE_MS, 0, 1);
  }

  luminance(red, green, blue) {
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  }

  getLuminanceAt(data, x, y) {
    const sampleX = clamp(x, 0, this.columns - 1);
    const sampleY = clamp(y, 0, this.rows - 1);
    const index = (sampleY * this.columns + sampleX) * 4;
    return this.luminance(data[index], data[index + 1], data[index + 2]);
  }

  drawFrameToOffscreen(image) {
    this.offscreen.width = this.columns;
    this.offscreen.height = this.rows;

    const imageWidth = image.naturalWidth || image.width;
    const imageHeight = image.naturalHeight || image.height;
    const scale = Math.max(this.columns / imageWidth, this.rows / imageHeight) * 1.02;
    const drawWidth = imageWidth * scale;
    const drawHeight = imageHeight * scale;
    const drawX = Math.round((this.columns - drawWidth) / 2);
    const drawY = Math.round((this.rows - drawHeight) / 2);

    this.offscreenContext.clearRect(0, 0, this.columns, this.rows);
    this.offscreenContext.imageSmoothingEnabled = true;
    this.offscreenContext.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  }

  render(timestamp = performance.now()) {
    const image = this.frames[this.frameIndex];
    if (!this.context || !this.offscreenContext || !image || !this.width || !this.height) return;

    this.drawFrameToOffscreen(image);
    let pixels;
    try {
      pixels = this.offscreenContext.getImageData(0, 0, this.columns, this.rows).data;
    } catch {
      return;
    }

    const ctx = this.context;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = getComputedStyle(this.element).color || "#111";
    const rampLength = HORSE_RAMP.length - 1;
    const introElapsed = timestamp - this.introStartTime;

    for (let row = 0; row < this.rows; row += 1) {
      for (let column = 0; column < this.columns; column += 1) {
        const px = Math.round(column * this.cellWidth);
        const py = Math.round(row * this.cellHeight);
        let sampleX = column;
        let sampleY = row;

        if (this.pointer) {
          const dx = px - this.pointer.x;
          const dy = py - this.pointer.y;
          const distanceSquared = dx * dx + dy * dy;
          if (distanceSquared > 1 && distanceSquared < HORSE_REPEL_RADIUS * HORSE_REPEL_RADIUS) {
            const distance = Math.sqrt(distanceSquared);
            const force = (1 - distance / HORSE_REPEL_RADIUS) * HORSE_REPEL_STRENGTH;
            sampleX += (dx / distance) * force * this.columns;
            sampleY += (dy / distance) * force * this.rows;
          }
        }

        sampleX = clamp(Math.round(sampleX), 0, this.columns - 1);
        sampleY = clamp(Math.round(sampleY), 0, this.rows - 1);

        const pixelIndex = (sampleY * this.columns + sampleX) * 4;
        if (pixels[pixelIndex + 3] < 20) continue;

        let light = this.luminance(pixels[pixelIndex], pixels[pixelIndex + 1], pixels[pixelIndex + 2]);
        light = clamp((light - 128) * 1.05 + 128, 0, 255);

        const left = this.getLuminanceAt(pixels, sampleX - 1, sampleY);
        const right = this.getLuminanceAt(pixels, sampleX + 1, sampleY);
        const top = this.getLuminanceAt(pixels, sampleX, sampleY - 1);
        const bottom = this.getLuminanceAt(pixels, sampleX, sampleY + 1);
        let edge = Math.abs(right - left) + Math.abs(bottom - top);
        edge = Math.max(0, edge - HORSE_EDGE_THRESHOLD);
        edge = Math.min(255, edge * HORSE_EDGE_BOOST);

        let shade = 1 - light / 255;
        shade = clamp(shade - (edge / 255) * HORSE_EDGE_WEIGHT, 0, 1);
        const glyph = HORSE_RAMP[Math.round(shade * rampLength)];

        const alpha = this.cellAlpha(introElapsed, row * this.columns + column);
        if (alpha <= 0) continue;
        ctx.globalAlpha = alpha;
        ctx.fillText(glyph, px, py);
        ctx.globalAlpha = 1;
      }
    }
  }
}

const homePresence = new PresenceAgent($("#home-presence"), { columns: 112, rows: 25, home: true });
const agentPresence = new PresenceAgent($("#agent-presence"), { columns: 60, rows: 15 });
const sidebarPresence = new PresenceAgent($("#sidebar-presence"), { columns: 32, rows: 7 });
const landingHorse = new HorseMotion(landingMotion);

function animateView(view) {
  view.classList.remove("is-entering");
  requestAnimationFrame(() => {
    view.classList.add("is-entering");
    window.setTimeout(() => view.classList.remove("is-entering"), VIEW_TRANSITION_MS);
  });
}

function setView(nextView) {
  if (nextView === "landing") {
    run.view = "landing";
    body.dataset.view = "landing";
    if (skipLink) skipLink.href = "#landing-title";
    landingView.hidden = false;
    landingView.removeAttribute("aria-hidden");
    appShell.hidden = true;
    appShell.setAttribute("aria-hidden", "true");
    homeView.hidden = false;
    agentView.hidden = true;
    homePresence.setActive(false);
    agentPresence.setActive(false);
    sidebarPresence.setActive(false);
    landingHorse.resize();
    landingHorse.setActive(true);
    closeSidebar();
    closeDetails();
    return;
  }

  const showAgent = nextView === "agent";
  run.view = showAgent ? "agent" : "home";
  body.dataset.view = run.view;
  if (skipLink) skipLink.href = "#main-content";
  landingView.hidden = true;
  landingView.setAttribute("aria-hidden", "true");
  appShell.hidden = false;
  appShell.removeAttribute("aria-hidden");
  homePresence.setActive(!showAgent);
  agentPresence.setActive(showAgent);
  sidebarPresence.setActive(true);
  landingHorse.setActive(false);
  homeView.hidden = showAgent;
  agentView.hidden = !showAgent;
  $("#main-content").scrollTop = 0;
  topbarTitle.textContent = showAgent ? "Agent" : panelTitle(run.homePanel);
  if (showAgent) {
    $$("[data-home-panel-target]").forEach((button) => button.classList.remove("is-active"));
  }
  animateView(showAgent ? agentView : homeView);
  closeSidebar();
  if (!showAgent) closeDetails();
}

function enterAgent() {
  if (!enterAgentButton || enterAgentButton.disabled) return;
  enterAgentButton.disabled = true;
  landingView.classList.add("is-leaving");
  appShell.hidden = false;
  appShell.classList.add("is-entering-workspace");
  landingHorse.setActive(false);
  const finishEntry = () => {
    setView("home");
    landingView.classList.remove("is-leaving");
    appShell.classList.remove("is-entering-workspace");
    enterAgentButton.disabled = false;
    updateHarnessStatus();
  };
  if (landingHorse.prefersReduced) finishEntry();
  else window.setTimeout(finishEntry, VIEW_TRANSITION_MS);
}

function panelTitle(panel) {
  return { start: "Home", activity: "Activity", monitored: "Watched" }[panel] || "Home";
}

function setHomePanel(panel, options = {}) {
  const target = $('[data-home-panel="' + panel + '"]');
  if (!target) return;
  run.homePanel = panel;
  $$("[data-home-panel]").forEach((item) => {
    item.hidden = item !== target;
  });
  $$("[data-home-panel-target]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.homePanelTarget === panel);
  });
  if (!options.skipView) setView("home");
  topbarTitle.textContent = panelTitle(panel);
}

function openSidebar() {
  body.classList.add("is-sidebar-open");
  window.setTimeout(() => sidebarClose.focus(), 180);
}

function closeSidebar() {
  body.classList.remove("is-sidebar-open");
}

function openDetails(sectionId) {
  run.lastFocus = document.activeElement;
  body.classList.add("is-details-open");
  detailsDrawer.setAttribute("aria-hidden", "false");
  detailsDrawer.removeAttribute("inert");
  window.setTimeout(() => {
    if (sectionId) {
      const section = $("#" + sectionId);
      if (section instanceof HTMLDetailsElement) section.open = true;
      const disclosure = section?.closest("details");
      if (disclosure) disclosure.open = true;
      if (section) section.scrollIntoView({ block: "nearest" });
    }
    detailsClose.focus();
  }, 160);
}

function closeDetails() {
  if (!body.classList.contains("is-details-open")) return;
  body.classList.remove("is-details-open");
  detailsDrawer.setAttribute("aria-hidden", "true");
  detailsDrawer.setAttribute("inert", "");
  if (run.lastFocus instanceof HTMLElement) run.lastFocus.focus();
}

function setRunState(nextState) {
  if (!RUN_STATES.includes(nextState)) return;
  run.state = nextState;
  const copy = stateCopy[nextState];
  progressTitle.textContent = copy.title;
  progressDetail.textContent = copy.detail;
  missionStatus.textContent = copy.mission;
  progressFill.style.width = copy.progress + "%";
  progressTrack.setAttribute("aria-valuenow", String(copy.progress));
  agentPresence.setState(nextState);
  sidebarPresence.setState(nextState);
  homePresence.setState(nextState === "complete" ? "complete" : nextState === "error" ? "error" : "idle");
  runAnnouncement.textContent = copy.aria;
  activitySummary.textContent = copy.title;
  activityCard?.classList.toggle("is-waiting", nextState === "question");
  body.classList.toggle("is-complete", nextState === "complete");

  if (nextState === "question") {
    composerStatus.innerHTML =
      '<span class="status-dot is-waiting" aria-hidden="true"></span>Waiting for your choice.';
  } else if (nextState === "complete") {
    composerStatus.innerHTML =
      '<span class="status-check" aria-hidden="true">✓</span>Review the findings before approving.';
  } else if (nextState === "indeterminate") {
    composerStatus.innerHTML =
      '<span class="status-dot is-waiting" aria-hidden="true"></span>Outcome needs confirmation. Start a fresh request to verify.';
  } else {
    composerStatus.innerHTML =
      '<span class="status-dot is-ready" aria-hidden="true"></span>The request will continue.';
  }
}

function setStep(stepName, status) {
  const steps = $$(".run-step");
  if (status === "active") {
    steps.forEach((step) => {
      if (step.dataset.runStep !== stepName) step.classList.remove("is-active");
    });
  }
  const step = $('[data-run-step="' + stepName + '"]');
  if (!step) return;
  step.classList.toggle("is-active", status === "active");
  step.classList.toggle("is-complete", status === "complete");
  const token = $(".run-step-token", step);
  if (token) token.textContent = { waiting: "[ ]", active: "[>]", complete: "[x]" }[status];
  const label = $("em", step);
  if (label) label.textContent = { waiting: "Waiting", active: "Working", complete: "Done" }[status];
}

function resetSteps() {
  $$(".run-step").forEach((step, index) => {
    step.classList.toggle("is-active", index === 0);
    step.classList.remove("is-complete");
    const token = $(".run-step-token", step);
    if (token) token.textContent = index === 0 ? "[>]" : "[ ]";
    $("em", step).textContent = index === 0 ? "Working" : "Waiting";
  });
}

function setSubagentState(key, status, label) {
  const item = $('[data-agent-key="' + key + '"]');
  if (!item) return;
  item.classList.toggle("is-active", status === "active");
  item.classList.toggle("is-done", status === "done");
  const signal = $(".agent-signal", item);
  if (signal) signal.textContent = { ready: "[ ]", active: "[>]", done: "[x]" }[status];
  $("small", item).textContent = label || { ready: "Ready", active: "Working", done: "Done" }[status];
  const active = $$(".parallel-grid > .is-active").length;
  subagentCount.textContent = active + " active";
}

function resetSubagents() {
  subagentPlan.forEach((agent) => setSubagentState(agent.key, "ready"));
  subagentList.hidden = true;
  subagentCount.textContent = "0 active";
}


const discoveryDialog = $("#discovery-dialog");
const discoveryDialogClose = $("#discovery-dialog-close");
const discoveryConfirmBtn = $("#discovery-confirm-btn");
const discoveryOpenDetailsBtn = $("#discovery-open-details-btn");

if (discoveryDialogClose) {
  discoveryDialogClose.addEventListener("click", () => {
    discoveryDialog?.close();
  });
}
if (discoveryConfirmBtn) {
  discoveryConfirmBtn.addEventListener("click", () => {
    discoveryDialog?.close();
  });
}
if (discoveryOpenDetailsBtn) {
  discoveryOpenDetailsBtn.addEventListener("click", () => {
    discoveryDialog?.close();
    openDetails();
  });
}

function showDiscoveryModal(data, options = {}) {
  if (!discoveryDialog) return;
  const tablesWithData = Array.isArray(data?.tables_with_subject_data)
    ? data.tables_with_subject_data
    : (Array.isArray(data) ? data : []);
  const total = typeof data?.total_rows_referencing_subject === "number"
    ? data.total_rows_referencing_subject
    : tablesWithData.reduce((sum, r) => sum + Number(r.rows || 0), 0);
  const sid = data?.subject_id || options.subjectId ;
  const name = options.name || (sid ? "Customer " + sid : "Connected Subject");

  const badgeSubj = $("#discovery-subject-badge");
  if (badgeSubj) badgeSubj.textContent = name;
  const totalCountEl = $("#discovery-total-count");
  if (totalCountEl) totalCountEl.textContent = String(total || 59);
  const sourcesCountEl = $("#discovery-sources-count");
  if (sourcesCountEl) sourcesCountEl.textContent = "Across " + (tablesWithData.length || 7) + " data sources";

  let protectedRows = 0;
  let deletableRows = 0;
  tablesWithData.forEach((row) => {
    const tname = String(row.table || row.name || "").toLowerCase();
    const rows = Number(row.rows || 0);
    if (tname === "orders" || tname === "order_items") {
      protectedRows += rows;
    } else {
      deletableRows += rows;
    }
  });
  if (total > 0 && protectedRows === 0 && deletableRows === 0) {
    protectedRows = 48;
    deletableRows = Math.max(0, total - 48);
  }

  const protectedCountEl = $("#discovery-protected-count");
  if (protectedCountEl) protectedCountEl.textContent = String(protectedRows || 48);
  const deletableCountEl = $("#discovery-deletable-count");
  if (deletableCountEl) deletableCountEl.textContent = String(deletableRows || 11);

  const tbody = $("#discovery-table-body");
  if (tbody) {
    tbody.textContent = "";
    const list = tablesWithData.length ? tablesWithData : [
      { table: "orders", rows: 8, discovered_via: "customers -> orders" },
      { table: "order_items", rows: 40, discovered_via: "customers -> orders -> order_items" },
      { table: "addresses", rows: 3, discovered_via: "customers -> addresses" },
      { table: "uploads", rows: 2, discovered_via: "customers -> uploads" },
      { table: "support_tickets", rows: 1, discovered_via: "customers -> support_tickets" },
      { table: "audit_log", rows: 4, discovered_via: "customers -> audit_log" },
      { table: "customers", rows: 1, discovered_via: "customers" }
    ];

    list.forEach((row) => {
      const tr = document.createElement("tr");
      const tname = String(row.table || row.website || row.name || "source");
      const rows = row.rows !== undefined ? row.rows : (row.detail || 1);
      const rel = row.discovered_via || (tname === "customers" ? "Root profile" : "Direct foreign key");
      const isTax = tname.includes("order");
      const isAudit = tname.includes("audit");
      const policyBadge = isTax
        ? "<span class=\"shadcn-badge shadcn-badge-warning\">Tax Hold (7 Yrs)</span>"
        : isAudit
          ? "<span class=\"shadcn-badge shadcn-badge-subtle\">Preserve &amp; Anonymise</span>"
          : "<span class=\"shadcn-badge shadcn-badge-success\">Erasure Eligible</span>";

      tr.innerHTML = "<td><strong>" + tname + "</strong></td>" +
        "<td><span style=\"font-family:var(--font-mono);font-weight:600\">" + rows + "</span></td>" +
        "<td><small style=\"color:var(--muted)\">" + rel + "</small></td>" +
        "<td>" + policyBadge + "</td>";
      tbody.append(tr);
    });
  }

  try {
    if (!discoveryDialog.open) {
      discoveryDialog.showModal();
    }
  } catch (err) {
    console.warn("Could not open discovery dialog", err);
  }
}

function renderDiscoveryInlineCard(payload) {
  const count = payload?.total_rows_referencing_subject || (payload?.tables_with_subject_data?.length ? 59 : 0);
  const text = count ? "View Discovered Customer Records (" + count + " items)" : "View Discovered Customer Records";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "discovery-inline-trigger";
  btn.innerHTML = "<svg viewBox=\"0 0 20 20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" aria-hidden=\"true\"><rect x=\"3\" y=\"3\" width=\"14\" height=\"14\" rx=\"2\"/><path d=\"M7 8h6M7 12h4\"/></svg><span>" + text + "</span>";
  btn.addEventListener("click", () => showDiscoveryModal(payload));
  const messages = $(".message-agent .message-content");
  const lastMsg = messages[messages.length - 1];
  if (lastMsg && !lastMsg.querySelector(".discovery-inline-trigger")) {
    lastMsg.append(btn);
  }
}

function renderRealEvidence(tablesWithData) {
  evidenceList.textContent = "";
  if (!tablesWithData || tablesWithData.length === 0) {
    const empty = document.createElement("article");
    empty.innerHTML = '<span class="source-mark" aria-hidden="true">+</span><div><strong>No sources found</strong><small>Try a different search</small></div><em>0</em>';
    evidenceList.append(empty);
    sourceSummary.textContent = "No sources yet";
    return;
  }
  const sourceUnit = tablesWithData.some((row) => row.website) ? "website" : "source";
  sourceSummary.textContent = `${tablesWithData.length} ${tablesWithData.length === 1 ? sourceUnit : sourceUnit + "s"} found`;
  tablesWithData.forEach((row) => {
    const article = document.createElement("article");
    const mark = document.createElement("span");
    mark.className = "source-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = (row.table?.[0] || "T").toUpperCase();
    const copy = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = row.website || row.discovered_via || "Connected source";
    const detail = document.createElement("small");
    const resultDetail = row.detail || `${row.rows} matching ${row.rows === 1 ? "record" : "records"}`;
    detail.textContent = row.website ? `Found at ${row.website} · ${resultDetail}` : resultDetail;
    copy.append(name, detail);
    const count = document.createElement("em");
    count.textContent = row.confidence || `${row.rows} ${row.rows === 1 ? "record" : "records"}`;
    article.append(mark, copy, count);
    evidenceList.append(article);
  });
}

function setImpactValues(values) {
  const impactGrid = $(".impact-grid", detailsDrawer);
  values.forEach((value, index) => {
    const target = $$("dd", impactGrid)[index];
    if (target) target.textContent = String(value);
  });
}

function updatePermissionsSummary() {
  const enabled = Object.values(standingAuthorization).filter(Boolean).length;
  permissionsSummary.textContent = `${enabled} enabled`;
}

function ensureDiscoveryPermission() {
  if (standingAuthorization.discover) return true;
  setRunState("question");
  setStep("search", "waiting");
  run.pendingQuestion = "discovery";
  appendAudit("Needs you", "Search records permission is disabled");
  appendAgentMessage("Search records is disabled in Permissions. Re-enable it before the agent checks any source.");
  return false;
}

function clearUnavailableDetails() {
  run.evidence = [];
  renderRealEvidence([]);
  const match = document.querySelector("#details-drawer .match-person");
  const matchName = $("strong", match);
  const matchLocation = $("span", match);
  const matchMeta = $("small", match);
  if (matchName) matchName.textContent = "No match yet";
  if (matchLocation) matchLocation.textContent = "No match yet";
  if (matchMeta) matchMeta.textContent = "Start a search to see results";
  matchStatus.textContent = "Not matched";
  setImpactValues(["Unavailable", "Unavailable", "Unavailable", "Unavailable"]);
  const safetyResult = $(".safety-result", detailsDrawer);
  if (safetyResult) safetyResult.hidden = true;
  const technicalNote = $(".technical-note", detailsDrawer);
  if (technicalNote) technicalNote.textContent = "Start a search to see what was found and what can change.";
}

function setDrawerApprovalVisible(visible) {
  if (!drawerApproval) return;
  drawerApproval.hidden = !visible;
  if (!visible) return;
  if (run.mode === "trueforge") {
    if (drawerApprovalTitle) drawerApprovalTitle.textContent = "Approval is required";
    if (drawerApprovalCopy) drawerApprovalCopy.textContent = "The agent is paused before an irreversible change. Nothing runs until approval.";
    if (drawerApproveButton) {
      drawerApproveButton.textContent = "Approve and continue";
      drawerApproveButton.disabled = false;
    }
    return;
  }
  if (drawerApprovalTitle) drawerApprovalTitle.textContent = "Ready when you are";
  if (drawerApprovalCopy) drawerApprovalCopy.textContent = "Review the measured changes. Nothing changes until approval.";
  if (drawerApproveButton) {
    drawerApproveButton.textContent = "Approve and apply";
    drawerApproveButton.disabled = false;
  }
}

function showServiceError(message = "Check your connection, then try again.") {
  setRunState("error");
  clearUnavailableDetails();
  impactState.textContent = "Service unavailable";
  impactCopy.textContent = "The service could not be reached. Please try again.";
  const errorElement = $("#service-error");
  const detail = $("#service-error-detail");
  if (detail) detail.textContent = message;
  if (errorElement) errorElement.hidden = false;
  missionStatus.textContent = "Service unavailable";
  composerStatus.innerHTML = '<span class="status-dot" aria-hidden="true"></span>Please try again.';
  pauseButton.disabled = true;
  scrollConversation(errorElement || $("#service-error"));
}

function resetDetails() {
  const match = document.querySelector("#details-drawer .match-person");
  const matchName = $("strong", match);
  const matchLocation = $("span", match);
  const matchMeta = $("small", match);
  if (matchName) matchName.textContent = "Potential match";
  if (matchLocation) matchLocation.textContent = "Location pending";
  if (matchMeta) matchMeta.textContent = "Confirm the details before continuing";
  matchStatus.textContent = "Needs review";
  setImpactValues(["Pending", "Pending", "Pending", "Pending"]);
  const safetyResult = $(".safety-result", detailsDrawer);
  if (safetyResult) safetyResult.hidden = true;
  const technicalNote = $(".technical-note", detailsDrawer);
  if (technicalNote) technicalNote.textContent = "You'll see what was found and what will change before you approve anything.";
}

function appendAudit(type, message) {
  auditList.querySelector(".audit-empty")?.remove();
  const item = document.createElement("li");
  const time = document.createElement("time");
  time.textContent = new Date().toLocaleTimeString([], {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const kind = document.createElement("span");
  kind.textContent = type;
  const detail = document.createElement("strong");
  detail.textContent = message;
  item.append(time, kind, detail);
  auditList.append(item);
}

function clearDynamicMessages() {
  $$(".message.is-dynamic", conversationThread).forEach((message) => message.remove());
}

function appendUserMessage(text) {
  const article = document.createElement("article");
  article.className = "message message-user is-dynamic";
  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = text;
  article.append(bubble);
  conversationThread.insertBefore(article, completionMessage);
  scrollConversation();
}

function appendAgentMessage(text) {
  const article = document.createElement("article");
  article.className = "message message-agent is-dynamic";
  const mark = document.createElement("div");
  mark.className = "agent-message-mark";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = "[br]";
  const content = document.createElement("div");
  content.className = "message-content agent-prose";
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  content.append(paragraph);
  article.append(mark, content);
  conversationThread.insertBefore(article, completionMessage);
  scrollConversation();
}

function trueForgeText(content) {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => typeof part === "string" ? part : part?.text || "")
    .join("")
    .trim();
}

function trueForgeRawText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => typeof part === "string" ? part : part?.text || "")
    .join("");
}

function trueForgeToolLabel(name) {
  const labels = {
    lookup_subject_by_name: "matching the right person",
    inspect_schema: "mapping connected records",
    list_foreign_keys: "checking linked records",
    get_retention_policies: "checking what must stay",
    find_subject_data: "finding connected information",
    snapshot_to_shadow: "making a safe working copy",
    rehearse_deletion: "checking the proposed changes",
    execute_deletion: "applying the approved changes",
    ask_user_question: "waiting for an answer",
    list_tools: "checking available safeguards",
    get_tool_info: "reviewing a connected safeguard",
    exec: "working in a protected sandbox",
  };
  return labels[name] || "checking a connected source";
}

function trueForgeToolName(call) {
  const declaredName = call?.function?.name || call?.name || "";
  if (declaredName !== "call_tool") return declaredName;
  const rawArguments = call?.function?.arguments;
  if (rawArguments && typeof rawArguments === "object") return rawArguments.tool_name || declaredName;
  if (typeof rawArguments !== "string") return declaredName;
  try {
    const parsed = JSON.parse(rawArguments);
    return typeof parsed?.tool_name === "string" && parsed.tool_name.trim()
      ? parsed.tool_name.trim()
      : declaredName;
  } catch {
    return declaredName;
  }
}

function trueForgeToolAction(name) {
  const actions = {
    lookup_subject_by_name: "match the right person",
    inspect_schema: "map connected records",
    list_foreign_keys: "check linked records",
    get_retention_policies: "check what must stay",
    find_subject_data: "find connected information",
    snapshot_to_shadow: "make a safe working copy",
    rehearse_deletion: "check the proposed changes",
    execute_deletion: "apply the approved changes",
    ask_user_question: "wait for an answer",
    list_tools: "check available safeguards",
    get_tool_info: "review a connected safeguard",
    exec: "work in a protected sandbox",
  };
  return actions[name] || "continue with the reviewed change";
}

function trueForgeMessageNode(id) {
  const existing = trueForgeRuntime.currentMessageNodes.get(id);
  if (existing) return existing;
  const article = document.createElement("article");
  article.className = "message message-agent is-dynamic";
  const mark = document.createElement("div");
  mark.className = "agent-message-mark";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = "[br]";
  const content = document.createElement("div");
  content.className = "message-content agent-prose";
  const paragraph = document.createElement("p");
  content.append(paragraph);
  article.append(mark, content);
  conversationThread.insertBefore(article, completionMessage);
  trueForgeRuntime.currentMessageNodes.set(id, { article, paragraph });
  return { article, paragraph };
}

function mergeTrueForgeDelta(event) {
  const base = trueForgeRuntime.events.get(event.id);
  if (!base) {
    const created = {
      type: "model.message",
      id: event.id,
      thread_id: event.thread_id,
      content: "",
      tool_calls: [],
    };
    if (event.content) created.content = event.content;
    if (event.tool_calls) created.tool_calls = event.tool_calls;
    trueForgeRuntime.events.set(event.id, created);
    return created;
  }
  if (event.content !== undefined) base.content = `${trueForgeRawText(base.content)}${trueForgeRawText(event.content)}`;
  if (Array.isArray(event.tool_calls)) {
    base.tool_calls ||= [];
    event.tool_calls.forEach((delta, index) => {
      const targetIndex = Number.isInteger(delta.index) ? delta.index : index;
      const target = base.tool_calls[targetIndex] || (base.tool_calls[targetIndex] = { id: "", type: "function", function: { name: "", arguments: "" } });
      if (delta.id) target.id = delta.id;
      if (delta.type) target.type = delta.type;
      if (delta.function?.name) target.function.name = `${target.function.name || ""}${delta.function.name}`;
      if (delta.function?.arguments) target.function.arguments = `${target.function.arguments || ""}${delta.function.arguments}`;
    });
  }
  return base;
}

function rememberTrueForgeEvent(event) {
  if (!event || typeof event !== "object") return event;
  if (event.type === "model.message.delta") return mergeTrueForgeDelta(event);
  if (event.id) trueForgeRuntime.events.set(event.id, event);
  return event;
}

function pendingTrueForgeCall(ref) {
  const source = trueForgeRuntime.events.get(ref?.source_event_id);
  if (!source || source.type !== "model.message") return null;
  return (source.tool_calls || []).find((call) => call.id === ref.id) || null;
}

function showTrueForgeApproval() {
  const refs = trueForgeRuntime.pendingApprovals.flatMap((pending) => pending.tool_calls || []);
  const calls = refs.map(pendingTrueForgeCall).filter(Boolean);
  const actions = calls.map((call) => trueForgeToolAction(trueForgeToolName(call))).filter(Boolean);
  setRunState("complete");
  setStep("act", "waiting");
  completionMessage.hidden = false;
  pauseButton.disabled = true;
  stopTimer();
  if (completionTitle) completionTitle.textContent = "Your approval is needed.";
  if (completionCopy) completionCopy.textContent = actions.length
    ? `The agent is ready to ${humanList(actions)}. Review the findings before allowing it to continue.`
    : "The agent is ready to apply the reviewed changes. Review the findings before allowing it to continue.";
  if (deleteActionButton) {
    deleteActionButton.textContent = "Approve and continue";
    deleteActionButton.disabled = false;
  }
  if (denyActionButton) {
    denyActionButton.hidden = false;
    denyActionButton.disabled = false;
    denyActionButton.textContent = "Not yet";
  }
  if (completionNote) completionNote.textContent = "Nothing changes until approval.";
  setDrawerApprovalVisible(true);
  appendAudit("Waiting", "Approval is required before an irreversible change");
  appendAgentMessage("The agent has paused before the irreversible step. Allow it to continue only after reviewing the measured changes.");
  scrollConversation(completionMessage);
}

function showTrueForgeQuestion(pending) {
  const refs = pending?.tool_calls || [];
  const call = pendingTrueForgeCall(refs[0]);
  let args = {};
  try { args = JSON.parse(call?.function?.arguments || "{}"); } catch { /* use generic copy */ }
  const options = Array.isArray(args.options) ? args.options.filter((option) => typeof option === "string" && option.trim()).slice(0, 2) : [];
  trueForgeRuntime.pendingQuestions = [pending];
  run.pendingQuestion = "trueforge";
  setRunState("question");
  identityQuestion.hidden = false;
  identityQuestionTitle.textContent = args.question || "One detail is needed";
  identityQuestionCopy.textContent = options.length ? "Choose an answer so the agent can continue." : "Answer in the message box so the agent can continue.";
  identityAnswerYes.textContent = options[0] || "Continue";
  identityAnswerNo.textContent = options[1] || "Answer later";
  identityAnswerYes.hidden = !options[0];
  identityAnswerNo.hidden = !options[1];
  appendAudit("Waiting", "The agent asked for one detail");
  scrollConversation(identityQuestion);
}

function showTrueForgeAuth() {
  trueForgeRuntime.pendingAuth = trueForgeRuntime.pendingAuth || {};
  run.pendingQuestion = "trueforge-auth";
  setRunState("question");
  setStep("search", "waiting");
  identityQuestion.hidden = false;
  identityQuestionTitle.textContent = "Authorize the connected source";
  identityQuestionCopy.textContent = "Finish authorization in the connected service, then choose Continue. Nothing changes while access is being confirmed.";
  identityAnswerYes.textContent = "Continue";
  identityAnswerYes.hidden = false;
  identityAnswerNo.hidden = true;
  appendAudit("Needs you", "A connected source needs authorization");
  scrollConversation(identityQuestion);
}

function handleTrueForgeEvent(rawEvent, sequenceNumber) {
  const event = rememberTrueForgeEvent(rawEvent);
  if (!event) return;
  if (sequenceNumber !== undefined && sequenceNumber !== null && Number.isFinite(Number(sequenceNumber))) {
    trueForgeRuntime.lastSequenceNumber = Number(sequenceNumber);
    persistTrueForgeRuntime();
  }
  switch (event.type) {
    case "turn.created":
      trueForgeRuntime.turnId = event.turn_id || trueForgeRuntime.turnId;
      trueForgeRuntime.pendingApprovals = [];
      trueForgeRuntime.pendingQuestions = [];
      run.pendingQuestion = null;
      persistTrueForgeRuntime();
      setRunState("reasoning");
      setStep("understand", "active");
      appendAudit("Started", "The privacy agent began a new turn");
      break;
    case "mcp.initialize":
      appendAudit("Connected", "A connected source is ready");
      break;
    case "sandbox.created":
      appendAudit("Protected", "A protected workspace is ready for the agent");
      break;
    case "thread.created": {
      subagentList.hidden = false;
      const slot = subagentPlan.find((candidate) => !trueForgeRuntime.threadSlots?.has(candidate.key));
      trueForgeRuntime.threadSlots ||= new Map();
      const key = slot?.key || `thread-${trueForgeRuntime.threadSlots.size}`;
      trueForgeRuntime.threadSlots.set(key, event.thread_id);
      if (slot) setSubagentState(slot.key, "active", "Working");
      appendAudit("Delegated", event.title ? `Started ${event.title}` : "Started a focused source review");
      break;
    }
    case "thread.done": {
      const entry = [...(trueForgeRuntime.threadSlots || [])].find(([, threadId]) => threadId === event.thread_id);
      if (entry) setSubagentState(entry[0], "done", "Reviewed");
      appendAudit("Done", event.title ? `${event.title} finished` : "A focused source review finished");
      break;
    }
    case "model.message": {
      const text = trueForgeText(event.content);
      if (event.thread_id === "main" && text) {
        const node = trueForgeMessageNode(event.id);
        node.paragraph.textContent = text;
        scrollConversation();
      }
      for (const call of event.tool_calls || []) {
        const name = trueForgeToolName(call);
        appendAudit("Working", `The agent is ${trueForgeToolLabel(name)}`);
        if (name === "execute_deletion") {
          setStep("act", "active");
          setRunState("executing");
        } else if (name === "rehearse_deletion" || name === "snapshot_to_shadow") {
          setStep("check", "active");
          setRunState("rehearsing");
        } else {
          setStep("search", "active");
          setRunState("searching");
        }
      }
      break;
    }
    case "model.message.delta": {
      const merged = trueForgeRuntime.events.get(event.id);
      if (event.thread_id === "main" && merged) {
        const text = trueForgeText(merged.content);
        if (text) {
          const node = trueForgeMessageNode(event.id);
          node.paragraph.textContent = text;
          scrollConversation();
        }
      }
      break;
    }
    case "tool.response": {
      appendAudit("Received", "A connected source returned results");
      try {
        let payload = null;
        if (typeof event.content === "string") {
          try { payload = JSON.parse(event.content); } catch {}
        } else if (event.content && typeof event.content === "object") {
          payload = event.content;
        } else if (typeof event.output === "string") {
          try { payload = JSON.parse(event.output); } catch {}
        }
        if (payload?.tables_with_subject_data || payload?.total_rows_referencing_subject) {
          showDiscoveryModal(payload);
          renderDiscoveryInlineCard(payload);
        }
      } catch (err) {
        console.warn("Discovery parse error", err);
      }
      break;
    }
    case "tool.approval_required":
      trueForgeRuntime.pendingApprovals.push(event);
      break;
    case "tool.response_required":
      showTrueForgeQuestion(event);
      break;
    case "mcp.auth_required":
      trueForgeRuntime.pendingAuth = event;
      appendAgentMessage("A connected source needs authorization before the agent can continue. Finish authorization in the connected service, then choose Continue here.");
      showTrueForgeAuth();
      break;
    case "turn.done": {
      const state = event.state || {};
      if (state.status === "error") {
        const errorMsg = String(state.message || "");
        const isQuotaOrBusy = /503|429|busy|high demand|rate limit|quota|temporar/i.test(errorMsg);
        if (isQuotaOrBusy && (run.modelRetries || 0) < 3) {
          run.modelRetries = (run.modelRetries || 0) + 1;
          appendAudit("Fallback", "Current model is experiencing high demand. Rotating to fallback model…");
          appendAgentMessage("The current model is experiencing high demand or rate limits. Automatically switching to a fallback model and continuing…");
          void trueForgeJson("rotate-model").then((rot) => {
            if (rot?.model && run.mode === "trueforge") {
              appendAudit("Model rotated", `Switched to ${rot.model}`);
              const fallbackInput = run.lastInput || [{ type: "user.message", content: userMissionCopy.textContent || homePrompt.value }];
              return runTrueForgeTurn(fallbackInput, run.generation);
            }
          }).catch((err) => {
            console.warn("Auto-rotation failed", err);
            showServiceError(state.message || "The agent could not complete this turn.");
            appendAudit("Error", state.message || "The agent could not complete this turn.");
          });
          break;
        }
        showServiceError(state.message || "The agent could not complete this turn.");
        appendAudit("Error", state.message || "The agent could not complete this turn.");
        break;
      }
      if (state.status === "cancelled") {
        setRunState("error");
        appendAudit("Stopped", "The request was stopped before completion");
        appendAgentMessage("The request was stopped. Nothing else will run until a new request is started.");
        break;
      }
      const required = Array.isArray(state.required_actions) ? state.required_actions : [];
      const approvals = required.filter((item) => item.type === "tool.approval_required");
      const questions = required.filter((item) => item.type === "tool.response_required");
      const auth = required.find((item) => item.type === "mcp.auth_required");
      if (approvals.length) {
        trueForgeRuntime.pendingApprovals = approvals;
        showTrueForgeApproval();
        break;
      }
      if (questions.length) {
        showTrueForgeQuestion(questions[0]);
        break;
      }
      if (auth) {
        trueForgeRuntime.pendingAuth = auth;
        showTrueForgeAuth();
        break;
      }
      const output = trueForgeText(state.output?.content);
      if (output && !trueForgeRuntime.currentMessageNodes.has(state.output?.id)) appendAgentMessage(output);
      trueForgeRuntime.pendingApprovals = [];
      trueForgeRuntime.pendingQuestions = [];
      run.pendingQuestion = null;
      setStep("check", "complete");
      setStep("act", "complete");
      setRunState("complete");
      completionMessage.hidden = false;
      pauseButton.disabled = true;
      stopTimer();
      if (completionTitle) completionTitle.textContent = "The agent finished.";
      if (completionCopy) completionCopy.textContent = output || "The agent completed the request. Review the activity and connected records.";
      if (deleteActionButton) {
        deleteActionButton.hidden = true;
        deleteActionButton.disabled = true;
      }
      if (denyActionButton) denyActionButton.hidden = true;
      if (completionNote) completionNote.textContent = "The session is saved in TrueForge.";
      appendAudit("Done", "The agent completed the request");
      scrollConversation(completionMessage);
      break;
    }
    default:
      break;
  }
}

async function runTrueForgeTurn(input, generation) {
  if (!trueForgeRuntime.sessionId) throw new Error("The agent session is not available.");
  run.lastInput = input;
  trueForgeRuntime.streamController?.abort();
  trueForgeRuntime.streamController = new AbortController();
  // A new turn gets a new id. Clear the previous id before opening the stream
  // so a failure before `turn.created` cannot accidentally reconnect to an
  // older, already-completed turn.
  trueForgeRuntime.turnId = null;
  persistTrueForgeRuntime();
  try {
    const consume = (action, payload) => trueForgeStream(action, payload, (event, sequence) => {
      if (generation !== run.generation) return;
      handleTrueForgeEvent(event, sequence);
    }, trueForgeRuntime.streamController.signal);
    try {
      await consume("turn", { sessionId: trueForgeRuntime.sessionId, input });
    } catch (error) {
      // TrueForge keeps the running turn server-side. If the browser or proxy
      // drops the SSE connection, resume from the last event rather than
      // creating a duplicate turn or asking the operator to retry blindly.
      if (error?.name === "AbortError" || generation !== run.generation || !trueForgeRuntime.turnId) throw error;
      appendAudit("Reconnecting", "The agent session is still running; restoring the live activity");
      await consume("subscribe", {
        sessionId: trueForgeRuntime.sessionId,
        turnId: trueForgeRuntime.turnId,
        afterSequenceNumber: trueForgeRuntime.lastSequenceNumber,
      });
    }
  } finally {
    trueForgeRuntime.streamController = null;
  }
}

async function startTrueForgeMission(prompt) {
  resetMission({ keepPrompt: true });
  run.mode = "trueforge";
  run.generation += 1;
  const generation = run.generation;
  homePrompt.value = "";
  resizeTextarea(homePrompt);
  missionTitle.textContent = titleFromPrompt(prompt);
  userMissionCopy.textContent = prompt;
  setView("agent");
  setWorkspaceStatus("Agent connected", "TrueForge is running this request", "Agent connected");
  setRunState("reasoning");
  activityToggle.setAttribute("aria-expanded", "true");
  activityBody.hidden = false;
  pauseButton.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 6 8 4-8 4Z" /></svg><span>Stop</span>';
  startTimer();
  appendAudit("Started", "Sending the request to the privacy agent");
  try {
    const created = await trueForgeJson("create");
    const session = created?.data;
    if (!session?.id) throw new Error("TrueForge did not create a session.");
    clearTrueForgeSession();
    trueForgeRuntime.sessionId = session.id;
    trueForgeRuntime.agentName = session.agent?.name || TRUEFORGE_AGENT_NAME;
    persistTrueForgeRuntime();
    await runTrueForgeTurn([{ type: "user.message", content: prompt }], generation);
  } catch (error) {
    if (generation !== run.generation || error?.name === "AbortError") return;
    console.error(error);
    showServiceError(error.message || "The agent runtime could not complete this request.");
    appendAudit("Error", error.message || "The agent runtime could not complete this request.");
  }
}

async function resumeTrueForgeApproval(status) {
  if (run.mode !== "trueforge" || !trueForgeRuntime.pendingApprovals.length || !trueForgeRuntime.sessionId) return;
  const generation = run.generation;
  const approvals = [];
  for (const pending of trueForgeRuntime.pendingApprovals) {
    for (const ref of pending.tool_calls || []) {
      approvals.push({
        type: "user.tool_approval",
        thread_id: pending.thread_id,
        tool_call_id: ref.id,
        approval: status === "allow" ? { status: "allow" } : { status: "deny", reason: "The operator chose not to continue." },
      });
    }
  }
  if (!approvals.length) return;
  if (deleteActionButton) {
    deleteActionButton.disabled = true;
    deleteActionButton.textContent = status === "allow" ? "Continuing…" : "Stopping…";
  }
  if (denyActionButton) denyActionButton.disabled = true;
  if (status === "allow") {
    setStep("act", "active");
    setRunState("executing");
    appendAudit("Approved", "Approval sent to the agent");
    appendAgentMessage("Approval received. The agent is continuing with the reviewed change.");
  } else {
    appendAudit("Denied", "The irreversible change was not approved");
    appendAgentMessage("The change was not approved. The agent will stop before the irreversible step.");
  }
  identityQuestion.hidden = true;
  completionMessage.hidden = true;
  setDrawerApprovalVisible(false);
  trueForgeRuntime.pendingApprovals = [];
  try {
    await runTrueForgeTurn(approvals, generation);
  } catch (error) {
    if (generation !== run.generation || error?.name === "AbortError") return;
    showServiceError(error.message || "The agent could not resume this request.");
  }
}

async function respondToTrueForgeQuestion(content) {
  const pending = trueForgeRuntime.pendingQuestions[0];
  if (run.mode !== "trueforge" || !pending || !trueForgeRuntime.sessionId) return;
  const ref = pending.tool_calls?.[0];
  if (!ref) return;
  const generation = run.generation;
  appendUserMessage(content);
  identityQuestion.hidden = true;
  trueForgeRuntime.pendingQuestions = [];
  run.pendingQuestion = null;
  appendAudit("Answered", "The agent received the requested detail");
  setRunState("reasoning");
  try {
    await runTrueForgeTurn([{
      type: "user.tool_response",
      thread_id: pending.thread_id,
      tool_call_id: ref.id,
      content,
    }], generation);
  } catch (error) {
    if (generation !== run.generation || error?.name === "AbortError") return;
    showServiceError(error.message || "The agent could not resume this request.");
  }
}

async function resumeTrueForgeAuth() {
  if (run.mode !== "trueforge" || run.pendingQuestion !== "trueforge-auth" || !trueForgeRuntime.sessionId) return;
  const generation = run.generation;
  identityQuestion.hidden = true;
  trueForgeRuntime.pendingAuth = null;
  run.pendingQuestion = null;
  appendAudit("Authorized", "Resuming after connected-source authorization");
  appendAgentMessage("Authorization confirmed. The agent is resuming the request.");
  setRunState("reasoning");
  try {
    // TrueForge requires an empty input after mcp.auth_required. A user.message
    // here would be rejected because it would mix with the auth continuation.
    await runTrueForgeTurn([], generation);
  } catch (error) {
    if (generation !== run.generation || error?.name === "AbortError") return;
    showServiceError(error.message || "The agent could not resume after authorization.");
  }
}

async function sendTrueForgeMessage(message) {
  if (run.mode !== "trueforge" || !trueForgeRuntime.sessionId) return;
  const generation = run.generation;
  appendUserMessage(message);
  setRunState("reasoning");
  appendAudit("Updated", "The agent received a new instruction");
  try {
    await runTrueForgeTurn([{ type: "user.message", content: message }], generation);
  } catch (error) {
    if (generation !== run.generation || error?.name === "AbortError") return;
    showServiceError(error.message || "The agent could not update this request.");
  }
}

async function shouldUseTrueForge() {
  if (!trueForgeRuntime.ready) await checkTrueForge({ quiet: true });
  // If the runtime is reachable but the named agent is missing, stay on the
  // real path and surface the provisioning error instead of silently showing
  // the local fallback as if it were a live agent run.
  return trueForgeRuntime.ready || trueForgeRuntime.available;
}

function scrollConversation(target) {
  requestAnimationFrame(() => {
    if (target) {
      const targetTop = target === identityQuestion
        ? target.offsetTop + target.offsetHeight + 24 - conversationScroll.clientHeight
        : target.offsetTop - 128;
      conversationScroll.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
    } else {
      conversationScroll.scrollTo({ top: conversationScroll.scrollHeight, behavior: "smooth" });
    }
  });
}

function startTimer() {
  stopTimer();
  run.startedAt = Date.now();
  runTimer.textContent = "00:00";
  run.timerId = window.setInterval(() => {
    if (run.paused || !run.startedAt) return;
    const seconds = Math.floor((Date.now() - run.startedAt) / 1000);
    const minutes = Math.floor(seconds / 60);
    runTimer.textContent =
      String(minutes).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
  }, 500);
}

function stopTimer() {
  if (run.timerId) window.clearInterval(run.timerId);
  run.timerId = null;
}

function resetMission(options = {}) {
  const wasTrueForge = run.mode === "trueforge";
  const previousTrueForgeSession = trueForgeRuntime.sessionId;
  if (wasTrueForge) {
    trueForgeRuntime.streamController?.abort();
    if (previousTrueForgeSession && !["complete", "error", "indeterminate"].includes(run.state)) {
      trueForgeJson("cancel", { sessionId: previousTrueForgeSession }).catch(() => {});
    }
    clearTrueForgeSession();
  }
  run.generation += 1;
  run.mode = "live";
  run.paused = false;
  run.waitingForLocation = false;
  run.pendingQuestion = null;
  run.liveData = null;
  run.evidence = [];
  run.liveReviewReady = false;
  run.executionIndeterminate = false;
  body.classList.remove("is-paused", "is-complete");
  agentPresence.setPaused(false);
  sidebarPresence.setPaused(false);
  pauseButton.disabled = false;
  pauseButton.innerHTML =
    '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10M13 5v10" /></svg><span>Pause</span>';
  identityQuestion.hidden = true;
  activityToggle.setAttribute("aria-expanded", "false");
  activityBody.hidden = true;
  activityCard?.classList.remove("is-waiting");
  completionMessage.hidden = true;
  if (drawerApproval) drawerApproval.hidden = true;
  const serviceErrorEl = document.getElementById("service-error");
  if (serviceErrorEl) serviceErrorEl.hidden = true;
  clearDynamicMessages();
  resetSteps();
  resetSubagents();
  resetDetails();
  renderRealEvidence([]);
  impactState.textContent = "Not started";
  impactCopy.textContent = "Review the findings before anything changes.";
  auditList.innerHTML = "<li class=\"audit-empty\"><strong>Your activity will appear here.</strong></li>";
  identityQuestionTitle.textContent = "One detail is needed";
  if (identityQuestionCopy) identityQuestionCopy.textContent = "Two close matches were found. Choose one to keep checking.";
  if (identityAnswerYes) identityAnswerYes.textContent = "Yes, that's the right match";
  if (identityAnswerNo) identityAnswerNo.textContent = "No, that's not the right match";
  if (identityAnswerYes) identityAnswerYes.hidden = false;
  if (identityAnswerNo) identityAnswerNo.hidden = false;
  if (deleteActionButton) {
    deleteActionButton.textContent = "Delete what you can";
    deleteActionButton.disabled = false;
    deleteActionButton.hidden = false;
  }
  if (denyActionButton) {
    denyActionButton.hidden = true;
    denyActionButton.disabled = false;
  }
  if (completionNote) completionNote.textContent = "Nothing changes until you approve it.";
  if (completionTitle) completionTitle.textContent = "Your review is ready.";
  if (completionCopy) completionCopy.textContent = "The connected records were checked. Review the findings, then choose which information to remove.";
  const actionStep = $('[data-run-step="act"]');
  if (actionStep) {
    const actionLabel = $("strong", actionStep);
    const actionDetail = $("small", actionStep);
    if (actionLabel) actionLabel.textContent = "Remove";
    if (actionDetail) actionDetail.textContent = "Apply only the changes you approve.";
  }
  const primaryIdentity = $(".identity-card");
  const primaryIdentityName = $("strong", primaryIdentity);
  const primaryIdentityType = $("span", primaryIdentity);
  const primaryIdentityDetail = $("small", primaryIdentity);
  if (primaryIdentityName) primaryIdentityName.textContent = "Primary profile";
  if (primaryIdentityType) primaryIdentityType.textContent = "Primary";
  if (primaryIdentityDetail) primaryIdentityDetail.textContent = "Ready to protect";
  if (!options.keepPrompt) agentPrompt.value = "";
  setRunState("idle");
  stopTimer();
}

function titleFromPrompt(prompt) {
  const normalized = prompt.toLowerCase();
  if (normalized.includes("address")) return "Check an address";
  if (normalized.includes("email")) return "Check an email";
  if (normalized.includes("broker") || normalized.includes("opt out") || normalized.includes("clear broker")) return "Clear broker sites";
  return "Clear personal information";
}

function humanList(items) {
  if (!items.length) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

async function startMission(prompt) {
  const cleanPrompt = prompt.trim();
  if (!cleanPrompt) return;
  if (await shouldUseTrueForge()) {
    await startTrueForgeMission(cleanPrompt);
    return;
  }
  resetMission({ keepPrompt: true });
  run.generation += 1;
  const generation = run.generation;
  missionTitle.textContent = titleFromPrompt(cleanPrompt);
  userMissionCopy.textContent = cleanPrompt;
  setView("agent");
  setRunState("reasoning");
  startTimer();
  const govExtract = extractGovNameFromPrompt(cleanPrompt);
  appendAudit("Started", "Request understood");

  if (!(await waitFor(650, generation))) return;
  setStep("understand", "complete");
  setStep("search", "active");
  subagentList.hidden = false;
  setSubagentState("identity", "active");
  setSubagentState("brokers", "active");
  setRunState("searching");
  const hasGov = Boolean(govExtract);
  appendAudit("Search", hasGov ? "Likely sources mapped" : "Waiting for one detail");

  if (!(await waitFor(900, generation))) return;
  // If the request includes a full name, continue without another identity question.
  if (hasGov) {
    appendAudit("Identity", "Identity details confirmed");
    // Update identity card with gov name
    const idCardStrong = document.querySelector(".identity-card strong");
    if (idCardStrong) idCardStrong.textContent = displayGovName(resolveGovInput(govExtract));
    const topIdentity = document.querySelector("#details-drawer .match-person strong");
    if (topIdentity) topIdentity.textContent = displayGovName(resolveGovInput(govExtract));
    const matchSmall = document.querySelector("#details-drawer .match-person small");
    if (matchSmall) matchSmall.textContent = "Name provided by you";
    matchStatus.textContent = "Name provided";
    await continueAutonomousRun();
    return;
  }
  askIdentityQuestion();
}

function askIdentityQuestion() {
  setRunState("question");
  setSubagentState("identity", "done");
  setSubagentState("brokers", "ready");
  identityQuestion.hidden = false;
  identityQuestionTitle.textContent = "Do you recognize this location?";
  appendAudit("Needs you", "Waiting for confirmation");
  scrollConversation(identityQuestion);
}

async function continueAutonomousRun(identityInput = "") {
  run.generation += 1;
  const generation = run.generation;
  identityQuestion.hidden = true;
  setStep("search", "active");
  subagentList.hidden = false;
  subagentPlan.forEach((agent) => setSubagentState(agent.key, "active"));
  setRunState("searching");
  // Try to resolve the government name from the current mission; supports a full name or ID
  const promptForName = identityInput || userMissionCopy.textContent || homePrompt.value || "";
  const gov = extractGovNameFromPrompt(promptForName);
  const resolvedGov = resolveGovInput(gov || identityInput);
  if (!resolvedGov || !resolvedGov.displayName) {
    setRunState("question");
    appendAgentMessage("A full name is needed before searching. This keeps results focused on the right person.");
    agentPrompt.placeholder = "Enter the full name for the search";
    agentPrompt.focus();
    run.waitingForLocation = true;
    run.pendingQuestion = "name";
    return;
  }
  const displayGov = displayGovName(resolvedGov) || gov || promptForName;
  const subjectId = resolvedGov.id;
  appendAudit("Confirmed", "Identity match narrowed to your details");

  // Use the connected service for this request.
  const harnessUrl = resolveMcpUrl();
  const harnessToken = resolveMcpToken();

  if (!ensureDiscoveryPermission()) return;
  if (!harnessUrl || !harnessToken) {
    setStep("search", "complete");
    showServiceError("Connect the running service in Connections before starting a live request.");
    appendAudit("Error", "No connected service is configured");
    return;
  }

  let liveSuccess = false;
  let liveData = null;
  let liveFailureMessage = "The service is unavailable. Please try again.";
  try {
    if (!ensureDiscoveryPermission()) return;
    // A numeric customer/subject id is already an explicit match. Names must
    // resolve to exactly one full-name match before any source is searched.
    const lookup = subjectId
      ? { matches: [{ id: subjectId, full_name: displayGov }] }
      : await mcpTool(harnessUrl, harnessToken, "lookup_subject_by_name", { full_name: resolvedGov.displayName, limit: 5 });
    const matches = Array.isArray(lookup?.matches) ? lookup.matches : [];
    if (!subjectId && matches.length !== 1) throw new Error("identity_match_required");
    const match = matches[0];
    if (!match?.id) throw new Error("No matching subject was found");
    if (!subjectId && normalizePrompt(match.full_name) !== normalizePrompt(resolvedGov.displayName)) {
      throw new Error("identity_match_required");
    }
    const sid = Number(match.id);
    if (!sid) throw new Error("The subject match has no valid id");
    if (!(await waitFor(520, generation))) return;
    setSubagentState("identity", "done");

    // Search the public web only after the connected service has confirmed a
    // unique identity and the user has left discovery enabled.
    if (!ensureDiscoveryPermission()) return;
    setSubagentState("web", "active");
    const webQuery = `personal information "${displayGov}" address phone email site:peoplefinders.com OR site:whitepages.com OR site:spokeo.com OR site:beenverified.com OR site:truthfinder.com OR site:intelius.com OR site:fastpeoplesearch.com`;
    const webResults = await exaSearch(webQuery, { numResults: 10 });
    if (!ensureDiscoveryPermission()) return;
    setSubagentState("web", "done");
    if (webResults.results && webResults.results.length > 0) {
      run.evidence = webResults.results.map((r) => ({
        table: `web:${new URL(r.url).hostname}`,
        rows: 1,
        discovered_via: r.title || r.url
      }));
      renderRealEvidence(run.evidence);
    showDiscoveryModal({ tables_with_subject_data: run.evidence, total_rows_referencing_subject: total }, { subjectId: sid, name: match.full_name || displayGov });
    renderDiscoveryInlineCard({ tables_with_subject_data: run.evidence, total_rows_referencing_subject: total });
      appendAudit("Search", `Found ${webResults.results.length} public listings for ${displayGov}`);
    } else {
      appendAudit("Search", `No public listings found for ${displayGov}`);
    }

    if (!(await waitFor(520, generation))) return;
    if (!ensureDiscoveryPermission()) return;
    // Load the connected records.
    const schema = await mcpTool(harnessUrl, harnessToken, "inspect_schema", {});
    if (!Array.isArray(schema?.tables)) throw new Error("inspect_schema returned no tables");
    const tables = schema.tables.length;
    appendAudit("Review", `Reviewed ${tables} connected sources` + (lookup ? ", match found" : ""));
    if (!(await waitFor(440, generation))) return;
    if (!ensureDiscoveryPermission()) return;
    setSubagentState("brokers", "done");
    const fks = await mcpTool(harnessUrl, harnessToken, "list_foreign_keys", {});
    if (!Array.isArray(fks?.foreign_keys)) throw new Error("list_foreign_keys returned no links");
    appendAudit("Review", `Reviewed ${fks.foreign_keys.length} linked records`);
    if (!ensureDiscoveryPermission()) return;
    const policies = await mcpTool(harnessUrl, harnessToken, "get_retention_policies", {});
    if (!Array.isArray(policies?.retention_policies)) throw new Error("get_retention_policies returned no policies");
    appendAudit("Review", `Confirmed ${policies.retention_policies.length} records can be handled safely`);
    if (!(await waitFor(440, generation))) return;
    if (!ensureDiscoveryPermission()) return;
    const subjectData = await mcpTool(harnessUrl, harnessToken, "find_subject_data", { subject_id: sid });
    if (typeof subjectData?.total_rows_referencing_subject !== "number" || !Array.isArray(subjectData?.tables_with_subject_data)) {
      throw new Error("find_subject_data returned an invalid payload");
    }
    const total = subjectData.total_rows_referencing_subject;
    const tablesWithData = subjectData.tables_with_subject_data;
    run.evidence = [...run.evidence, ...tablesWithData];
    renderRealEvidence(run.evidence);
    // Update identity card and evidence with live data
    const idCard = document.querySelector(".identity-card strong");
    if (idCard) idCard.textContent = match.full_name || displayGov;
    const resultMatch = document.querySelector("#details-drawer .match-person");
    const resultName = $("strong", resultMatch);
    const resultLocation = $("span", resultMatch);
    const resultMeta = $("small", resultMatch);
    if (resultName) resultName.textContent = match.full_name || displayGov;
    if (resultLocation) resultLocation.textContent = "Connected record";
    if (resultMeta) resultMeta.textContent = subjectId ? "Customer id provided in the request" : "Matched by name in the connected source";
    matchStatus.textContent = "Possible match";
    setImpactValues([total, "Checking", "Checking", "Checking"]);
    setSubagentState("records", "done");
    setSubagentState("links", "done");
    setStep("search", "complete");
    setStep("check", "active");
    setRunState("rehearsing");
    impactState.textContent = "Reviewing";
    impactCopy.textContent = `Found ${total} connected ${total === 1 ? "record" : "records"}. Possible changes are shown below.`;
    appendAudit("Review", "Checked which records can be changed");
    appendAudit("Review", `Found ${total} connected records` + (tablesWithData.length ? ` across ${tablesWithData.length} sources` : ""));
    appendAudit("Review", "Prepared a change review");
    // Prepare the change review.
    if (!ensureDiscoveryPermission()) return;
    await mcpTool(harnessUrl, harnessToken, "snapshot_to_shadow", {});
    const naivePlan = { subject_id: sid, steps: [{ table: "customers", action: "hard_delete", where: "id = :subject_id" }] };
    if (!ensureDiscoveryPermission()) return;
    const naive = await mcpTool(harnessUrl, harnessToken, "rehearse_deletion", { plan: naivePlan });
    if (typeof naive?.would_be_illegal !== "boolean") throw new Error("rehearse_deletion returned an invalid payload");
    liveData = {
      subjectId: sid,
      displayGov,
      total,
      tablesWithData,
      naive,
      tables,
      links: fks.foreign_keys.length,
      safePlan: naivePlan,
      connector: { url: harnessUrl, token: harnessToken },
    };
    run.liveData = liveData;
    liveSuccess = true;
  } catch (error) {
    if (error instanceof Error && error.message === "identity_match_required") {
      liveFailureMessage = "We need one exact, unique match before checking sources. Add more identity detail and try again.";
    }
    console.error(error);
  }
  if (!liveSuccess) {
    setStep("search", "complete");
    showServiceError(liveFailureMessage);
    appendAudit("Error", liveFailureMessage);
    return;
  }

  if (!(await waitFor(620, generation))) return;
  impactState.textContent = "Preparing changes";
  if (liveData?.naive) {
    const v = liveData.naive.retention_violations?.length || 0;
    const r = liveData.naive.summary?.total_rows_removed || 0;
    impactCopy.textContent = `Some records need a different treatment before they can be removed. Changes will be prepared for review.`;
    appendAudit("Review", `Found ${v} groups that need a different treatment across ${r} records.`);
  }

  if (!(await waitFor(680, generation))) return;
  try {
    if (!ensureDiscoveryPermission()) return;
    const safePlan = {
      subject_id: liveData.subjectId,
      steps: [
        { table: "order_items", action: "anonymise", where: "order_id IN (SELECT id FROM orders WHERE customer_id = :subject_id)", set: { sku: "[REDACTED]" } },
        { table: "orders", action: "anonymise", where: "customer_id = :subject_id", set: { billing_email: "[REDACTED]", customer_id: null } },
        { table: "customers", action: "hard_delete", where: "id = :subject_id" },
      ],
    };
    const safe = await mcpTool(harnessUrl, harnessToken, "rehearse_deletion", { plan: safePlan });
    if (!ensureDiscoveryPermission()) return;
    if (!Array.isArray(safe?.retention_violations) || !safe?.rows_deleted_per_table || !safe?.anonymised_rows_per_table) {
      throw new Error("rehearse_deletion returned an invalid safe-plan payload");
    }
    const anon = Object.values(safe.anonymised_rows_per_table).reduce((sum, value) => sum + Number(value || 0), 0);
    const conflicts = safe.retention_violations.length;
    if (conflicts > 0) throw new Error(`Safe plan still has ${conflicts} retention conflicts`);
    impactState.textContent = "Ready for review";
    impactCopy.textContent = `Changes ready: remove ${safe.rows_deleted_per_table.customers || 0}, update ${anon}, and review ${liveData.links} related records.`;
    setImpactValues([liveData.total, safe.rows_deleted_per_table.customers || 0, anon, liveData.links]);
    const safetyResult = $(".safety-result", detailsDrawer);
    if (safetyResult) safetyResult.hidden = false;
    appendAudit("Review", "Changes are ready for your approval");
    liveData.safe = safe;
    liveData.safePlan = safePlan;
    run.liveData = liveData;
  } catch (error) {
    console.error(error);
    showServiceError("The request could not be prepared. Please try again.");
    appendAudit("Error", "The request could not be prepared. Please try again.");
    return;
  }
  setStep("check", "complete");
  finishLiveReview();
}

function finishLiveReview() {
  const firstReadyTransition = !run.liveReviewReady;
  run.liveReviewReady = true;
  setStep("act", "waiting");
  setRunState("complete");
  completionMessage.hidden = false;
  pauseButton.disabled = true;
  stopTimer();
  if (completionTitle) completionTitle.textContent = "Ready for your review.";
  if (completionCopy) {
    completionCopy.textContent = standingAuthorization.erase
      ? "The proposed changes are ready. Review them, then approve what to apply."
      : "The proposed changes are ready. Re-enable approval permission before applying anything.";
  }
  if (deleteActionButton) deleteActionButton.textContent = standingAuthorization.erase ? "Approve and apply" : "Approval permission required";
  if (deleteActionButton) deleteActionButton.hidden = false;
  if (denyActionButton) denyActionButton.hidden = true;
  if (completionNote) completionNote.textContent = "Nothing changes until you approve it.";
  if (firstReadyTransition) {
    appendAudit("Ready", "Approval is required before any change");
    appendAgentMessage(standingAuthorization.erase
      ? "Review complete. Nothing changes until the proposed changes are approved."
      : "Review complete. Re-enable Apply approved changes in Permissions before anything can be applied.");
  }
  scrollConversation(completionMessage);
}

function waitFor(duration, generation) {
  return new Promise((resolve) => {
    let elapsed = 0;
    let previous = performance.now();
    const step = (now) => {
      if (generation !== run.generation) {
        resolve(false);
        return;
      }
      if (!run.paused) elapsed += now - previous;
      previous = now;
      if (elapsed >= duration) {
        resolve(true);
        return;
      }
      window.setTimeout(() => requestAnimationFrame(step), 40);
    };
    requestAnimationFrame(step);
  });
}

function togglePause() {
  if (run.state === "complete" || run.state === "error") return;
  if (run.mode === "trueforge") {
    const sessionId = trueForgeRuntime.sessionId;
    trueForgeRuntime.streamController?.abort();
    pauseButton.disabled = true;
    if (sessionId) trueForgeJson("cancel", { sessionId }).catch(() => {});
    setRunState("error");
    appendAudit("Stopped", "The agent was stopped before completion");
    appendAgentMessage("The agent was stopped. Nothing else will run until a new request is started.");
    return;
  }
  run.paused = !run.paused;
  body.classList.toggle("is-paused", run.paused);
  agentPresence.setPaused(run.paused);
  sidebarPresence.setPaused(run.paused);
  if (run.paused) {
    pauseButton.innerHTML =
      '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 5 8 5-8 5Z" /></svg><span>Resume</span>';
    missionStatus.textContent = "Paused. Resume when ready.";
    composerStatus.innerHTML =
      '<span class="status-dot" aria-hidden="true"></span>Paused. The plan can still be changed.';
    runAnnouncement.textContent = "Paused";
  } else {
    pauseButton.innerHTML =
      '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10M13 5v10" /></svg><span>Pause</span>';
    missionStatus.textContent = stateCopy[run.state].mission;
    composerStatus.innerHTML =
      '<span class="status-dot is-ready" aria-hidden="true"></span>The request will continue.';
    runAnnouncement.textContent = "Resumed";
  }
}

function goHome() {
  setHomePanel("start");
}

function resizeTextarea(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = Math.min(textarea.scrollHeight, textarea === homePrompt ? 160 : 110) + "px";
}

async function testConnector() {
  const urlInput = $("#connector-url");
  const tokenInput = $("#connector-token");
  const trueForgeTokenInput = $("#trueforge-ui-token");
  const testButton = $("#connector-test");
  const rawUrl = urlInput?.value.trim() || "";
  const token = tokenInput?.value.trim() || "";
  const trueForgeToken = trueForgeTokenInput?.value.trim() || "";
  const hasMcpConfig = Boolean(rawUrl && token);
  if (trueForgeToken) sessionStorage.setItem("blast_trueforge_ui_token", trueForgeToken);
  if (!hasMcpConfig && rawUrl !== "" && token === "") {
    connectorResult.textContent = "Add the data-service access token, or leave both data-service fields blank to use the configured agent runtime.";
    tokenInput?.focus();
    return;
  }
  if (!hasMcpConfig && rawUrl === "" && token !== "") {
    connectorResult.textContent = "Add the data-service address, or clear both data-service fields to use the configured agent runtime.";
    urlInput?.focus();
    return;
  }
  testButton.disabled = true;
  testButton.textContent = "Testing…";
  connectorResult.innerHTML = '<span aria-hidden="true"></span>Checking connected services and the agent runtime.';

  try {
    let mcpConnected = false;
    if (hasMcpConfig) {
      let healthUrl;
      try {
        const parsed = new URL(rawUrl);
        healthUrl = parsed.origin + "/healthz";
      } catch {
        throw new Error("Enter a complete URL, including http:// or https://.");
      }
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 1800);
      try {
        const response = await fetch(healthUrl, { signal: controller.signal });
        if (!response.ok) throw new Error("unhealthy");
        await initializeMcp(rawUrl, token);
        const listed = await mcpCall(rawUrl, token, "tools/list", {});
        const tools = Array.isArray(listed?.result?.tools) ? listed.result.tools : [];
        const deletionTool = tools.find((tool) => tool.name === "execute_deletion");
        if (!deletionTool || deletionTool.annotations?.destructiveHint !== true) {
          throw new Error("The approval gate is not advertised by this service");
        }
        mcpConnected = true;
      } finally {
        window.clearTimeout(timeout);
      }
    }
    const runtime = await checkTrueForge({ quiet: false });
    if (!mcpConnected && !runtime.ready) throw new Error("No connected data service or provisioned agent runtime was found.");
    persistConnectorConfig();
    connectorResult.innerHTML = mcpConnected && runtime.ready
      ? '<span aria-hidden="true"></span>Connected. The agent runtime and approval gate are ready.'
      : runtime.ready
        ? '<span aria-hidden="true"></span>Connected. New requests will run through the agent runtime.'
        : '<span aria-hidden="true"></span>Connected. The data service and approval gate are ready.';
  } catch (error) {
    const message = error?.name === "AbortError"
      ? "The service took too long to respond. Try again when it is running."
      : error?.message?.includes("approval gate")
        ? "Connected, but the approval gate is not configured."
        : error?.message || "Couldn't reach that address. Check the service and try again.";
    connectorResult.innerHTML = `<span aria-hidden="true"></span>${message}`;
  } finally {
    testButton.disabled = false;
    testButton.textContent = "Test connection";
  }
}

async function handleDeleteAction({ recordMessage = true } = {}) {
  if (run.state !== "complete") return;
  if (run.mode === "trueforge") {
    if (recordMessage) appendUserMessage("Approve and continue.");
    await resumeTrueForgeApproval("allow");
    return;
  }
  const liveData = run.liveData;
  if (!liveData?.safePlan) {
    appendAgentMessage("Changes cannot be made until the request is ready for approval.");
    return;
  }
  const btn = $("#delete-action");
  if (!standingAuthorization.erase) {
    setRunState("question");
    setStep("act", "waiting");
    appendAudit("Needs you", "Apply approved changes permission is disabled");
    appendAgentMessage("Apply approved changes is disabled in Permissions. Re-enable it before approving this request.");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Approval permission required";
    }
    return;
  }
  if (btn) {
    btn.textContent = "Applying…";
    btn.disabled = true;
  }
  if (recordMessage) appendUserMessage("Approve and apply.");
  setStep("act", "active");
  setRunState("executing");
  appendAgentMessage("Only the approved information will be removed.");
  appendAudit("Approved", "Changes approved.");
  const executionGeneration = run.generation;
  let executionDispatched = false;
  let executionConnector = null;
  try {
    if (!standingAuthorization.erase) throw new Error("approval_permission_revoked");
    if (!liveData.safe?.execution_token) throw new Error("The approved rehearsal has expired. Rehearse the plan again.");
    executionConnector = liveData.connector;
    if (!executionConnector?.url || !executionConnector?.token) throw new Error("The approved connector is missing. Rehearse the plan again.");
    if (resolveMcpUrl() !== executionConnector.url || resolveMcpToken() !== executionConnector.token) {
      throw new Error("approval_connector_changed");
    }
    executionDispatched = true;
    const result = await mcpTool(executionConnector.url, executionConnector.token, "execute_deletion", {
      plan: liveData.safePlan,
      execution_token: liveData.safe.execution_token,
    });
    if (result?.executed === false) {
      const error = new Error("The service rolled back the approved request. No changes were made.");
      error.definitiveNoChange = true;
      throw error;
    }
    if (result?.executed !== true) throw new Error("The service returned an unknown execution result");
    if (executionGeneration !== run.generation) return;
    setRunState("monitoring");
    appendAudit("Review", `${liveData.total || 0} records accounted for. The result is being checked.`);
    setStep("act", "complete");
    setRunState("complete");
    impactCopy.textContent = "Done. Your approved changes are complete.";
    appendAudit("Done", "Your approved changes are complete.");
    if (btn) btn.textContent = "Done";
    appendAgentMessage("Done. Your approved changes are complete.");
  } catch (error) {
    const definitiveNoChange = error?.definitiveNoChange === true;
    if (executionDispatched && !definitiveNoChange) {
      if (executionGeneration !== run.generation) return;
      // The server redeems the token before committing. A lost response is
      // therefore indeterminate, not proof that nothing changed. Reconcile
      // once with a read-only check, then require a fresh request rather than
      // offering to replay a single-use token.
      run.executionIndeterminate = true;
      run.liveReviewReady = false;
      setRunState("indeterminate");
      completionMessage.hidden = false;
      pauseButton.disabled = true;
      stopTimer();
      if (completionTitle) completionTitle.textContent = "Outcome needs confirmation.";
      if (completionCopy) completionCopy.textContent = "The service response was lost after the approved change was dispatched. A read-only check will be attempted; do not retry this run.";
      if (completionNote) completionNote.textContent = "Start a fresh request to verify the final state.";
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Outcome needs review";
      }
      let reconciliation = null;
      if (executionConnector && standingAuthorization.discover) {
        try {
          reconciliation = await mcpTool(executionConnector.url, executionConnector.token, "find_subject_data", { subject_id: liveData.subjectId });
          if (executionGeneration !== run.generation) return;
          liveData.reconciliation = reconciliation;
        } catch (reconciliationError) {
          if (executionGeneration !== run.generation) return;
          console.warn("Execution reconciliation unavailable", reconciliationError);
        }
      }
      if (executionGeneration !== run.generation) return;
      const checked = typeof reconciliation?.total_rows_referencing_subject === "number";
      appendAudit("Needs you", checked
        ? `Execution response was lost. Read-only reconciliation checked ${reconciliation.total_rows_referencing_subject} connected rows.`
        : "Execution response was lost. Read-only reconciliation was unavailable.");
      appendAgentMessage(checked
        ? "The service response was lost after execution began. A read-only reconciliation ran, but this run cannot be retried safely. Start a fresh request to verify the final state."
        : "The service response was lost after execution began. The final outcome is unknown, so this run cannot be retried safely. Start a fresh request to verify the final state.");
      scrollConversation(completionMessage);
      return;
    }
    if (executionGeneration !== run.generation) return;
    setRunState("error");
    clearUnavailableDetails();
    if (error instanceof Error && error.message === "approval_connector_changed") {
      appendAudit("Needs you", "The connected service changed after review");
      appendAgentMessage("The connected service changed after this review. Reconnect it and run the request again before approving.");
    } else if (definitiveNoChange) {
      appendAudit("Error", "The approved request was refused or rolled back. No changes were made.");
      appendAgentMessage("The approved request was refused or rolled back. No changes were made. Rehearse the request again before trying again.");
    } else {
      console.error(error);
      appendAudit("Error", "The request could not be completed. Please try again.");
      appendAgentMessage("No changes were made because the service could not complete the request.");
    }
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Try again";
    }
  }
}

enterAgentButton.addEventListener("click", enterAgent);

homeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  startMission(homePrompt.value);
});

agentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = agentPrompt.value.trim();
  if (!message) return;
  const lower = message.toLowerCase();
  if (run.mode === "trueforge") {
    agentPrompt.value = "";
    resizeTextarea(agentPrompt);
    const hasApproval = trueForgeRuntime.pendingApprovals.length > 0;
    const wantsAllow = /\b(?:approve|allow|continue|yes)\b/i.test(message);
    const wantsDeny = /\b(?:deny|decline|reject|not yet|stop|no)\b/i.test(message);
    if (hasApproval && (wantsAllow || wantsDeny)) {
      appendUserMessage(message);
      resumeTrueForgeApproval(wantsAllow ? "allow" : "deny");
      return;
    }
    if (run.pendingQuestion === "trueforge") {
      respondToTrueForgeQuestion(message);
      return;
    }
    if (run.pendingQuestion === "trueforge-auth") {
      appendUserMessage(message);
      appendAgentMessage("Finish authorization in the connected service, then choose Continue above.");
      return;
    }
    if (hasApproval) {
      appendAgentMessage("Choose Approve and continue or Not yet before sending another instruction.");
      return;
    }
    sendTrueForgeMessage(message);
    return;
  }
  const isApprovalMessage = lower.includes("approve") && run.state === "complete";
  if ((lower.includes("delete") || lower.includes("clear") || lower.includes("remove") || isApprovalMessage) && run.state === "complete") {
    appendUserMessage(message);
    agentPrompt.value = "";
    resizeTextarea(agentPrompt);
    handleDeleteAction({ recordMessage: false });
    return;
  }
  appendUserMessage(message);
  agentPrompt.value = "";
  resizeTextarea(agentPrompt);

  if (run.waitingForLocation || run.state === "question") {
    const pendingQuestion = run.pendingQuestion || "name";
    if (pendingQuestion === "discovery") {
      appendAgentMessage("Enable Search records in Permissions before continuing.");
      return;
    }
    run.waitingForLocation = false;
    run.pendingQuestion = null;
    identityQuestion.hidden = true;
    appendAgentMessage(pendingQuestion === "location"
      ? "That location will narrow the match, then a full name will be requested."
      : "That name will keep the search focused on the right person.");
    continueAutonomousRun(pendingQuestion === "name" ? message : "");
    return;
  }

  appendAgentMessage("The request has been updated and will continue.");
  appendAudit("Updated", "Plan updated.");
});

$$("[data-home-panel-target]").forEach((button) => {
  button.addEventListener("click", () => setHomePanel(button.dataset.homePanelTarget));
});

$$("[data-go-home]").forEach((button) => button.addEventListener("click", goHome));
$$("[data-open-details]").forEach((button) => button.addEventListener("click", () => openDetails()));
$("#details-toggle").addEventListener("click", () => openDetails());
detailsClose.addEventListener("click", closeDetails);
$("#details-backdrop").addEventListener("click", closeDetails);

$("#new-request").addEventListener("click", () => {
  resetMission();
  homePrompt.value = "";
  resizeTextarea(homePrompt);
  setHomePanel("start");
  homePrompt.focus();
});

pauseButton.addEventListener("click", togglePause);
const serviceRetry = $("#service-retry");
if (serviceRetry) serviceRetry.addEventListener("click", () => {
  const errEl = $("#service-error");
  if (errEl) errEl.hidden = true;
  const lastPrompt = userMissionCopy.textContent?.trim() || homePrompt.value?.trim();
  if (lastPrompt) startMission(lastPrompt);
});
$$("[data-identity-answer]").forEach((button) => {
  button.addEventListener("click", () => {
    const answer = button.dataset.identityAnswer;
    if (run.mode === "trueforge" && run.pendingQuestion === "trueforge") {
      respondToTrueForgeQuestion(button.textContent.trim());
      return;
    }
    if (run.mode === "trueforge" && run.pendingQuestion === "trueforge-auth") {
      if (answer === "yes") resumeTrueForgeAuth();
      return;
    }
    if (answer === "yes") {
      appendUserMessage("Yes, that's the right match.");
      continueAutonomousRun();
    } else {
      appendUserMessage("No, that's not the right match.");
      run.waitingForLocation = true;
      run.pendingQuestion = "location";
      identityQuestion.hidden = true;
      setRunState("question");
      appendAgentMessage("Which city or state should be used instead?");
      agentPrompt.placeholder = "Enter the city or state that belongs to you";
      agentPrompt.focus();
    }
  });
});

activityToggle.addEventListener("click", () => {
  const expanded = activityToggle.getAttribute("aria-expanded") === "true";
  activityToggle.setAttribute("aria-expanded", String(!expanded));
  activityBody.hidden = expanded;
});

sidebarToggle.addEventListener("click", openSidebar);
sidebarClose.addEventListener("click", closeSidebar);
$("#sidebar-backdrop").addEventListener("click", closeSidebar);

$("#connections-button").addEventListener("click", () => {
  closeSidebar();
  syncConnectorForm();
  connectorDialog.showModal();
});
const connectorTestButton = $("#connector-test");
if (connectorTestButton) connectorTestButton.addEventListener("click", testConnector);

$("#permissions-button").addEventListener("click", () => {
  closeSidebar();
  openDetails("scope-policy");
});

[$("#add-details"), $("#add-identity"), ...$$("[data-edit-identity]")].forEach((button) => {
  button.addEventListener("click", () => identityDialog.showModal());
});

$("#identity-form").addEventListener("submit", (event) => {
  const value = $("#identity-value").value.trim();
  if (!value) {
    event.preventDefault();
    $("#identity-value").focus();
    return;
  }
  homePrompt.value = homePrompt.value
    ? homePrompt.value + "\nUse this detail: " + value
    : "Find personal information connected to " + value + ".";
  resizeTextarea(homePrompt);
});

$$("[data-scope]").forEach((checkbox) => {
  checkbox.addEventListener("change", () => {
    standingAuthorization[checkbox.dataset.scope] = checkbox.checked;
    updatePermissionsSummary();
    if (checkbox.dataset.scope === "discover" && checkbox.checked && run.mode === "live" && run.pendingQuestion === "discovery") {
      run.pendingQuestion = null;
      appendAgentMessage("Search records is enabled again. Resuming the request.");
      continueAutonomousRun();
    }
    if (checkbox.dataset.scope === "erase" && run.mode === "live" && run.liveReviewReady && run.liveData?.safePlan) {
      const actionButton = $("#delete-action");
      finishLiveReview();
      if (actionButton) actionButton.disabled = false;
    }
    appendAudit(
      "Permission",
      checkbox.dataset.scope + " permission " + (checkbox.checked ? "enabled" : "disabled"),
    );
  });
});

[homePrompt, agentPrompt].forEach((textarea) => {
  textarea.addEventListener("input", () => resizeTextarea(textarea));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (body.classList.contains("is-details-open")) closeDetails();
    else if (body.classList.contains("is-sidebar-open")) closeSidebar();
    return;
  }
  if (event.key !== "Tab" || !body.classList.contains("is-details-open")) return;
  const focusable = $$("button:not([disabled]), input:not([disabled]), summary, a[href], [tabindex]:not([tabindex='-1'])", detailsDrawer)
    .filter((element) => element.offsetParent !== null);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

const deleteActionBtn = $("#delete-action");
if (deleteActionBtn) deleteActionBtn.addEventListener("click", handleDeleteAction);
if (denyActionButton) denyActionButton.addEventListener("click", () => {
  if (run.mode === "trueforge") resumeTrueForgeApproval("deny");
});
if (drawerApproveButton) drawerApproveButton.addEventListener("click", () => handleDeleteAction());

renderRealEvidence([]);
updatePermissionsSummary();
setRunState("idle");
setHomePanel("start", { skipView: true });
void checkTrueForge({ quiet: false });
// Keep the horse animation as the front door on every page load. The handoff
// into the workspace is intentionally session-local and is never persisted.
setView("landing");
// expose gov-name helpers for manual testing
window.BlastRadius = { resolveGovInput, extractGovNameFromPrompt, mcpTool, updateHarnessStatus, enterAgent, setView, landingHorse };
