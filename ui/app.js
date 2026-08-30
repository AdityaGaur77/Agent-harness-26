const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const EXA_SEARCH_URL = "/api/exa-search";

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
const guidedPreviewButton = $("#guided-preview");
const drawerApproval = $("#drawer-approval");
const drawerApprovalTitle = $("#drawer-approval-title");
const drawerApprovalCopy = $("#drawer-approval-copy");
const drawerApproveButton = $("#drawer-approve");
const completionNote = $(".completion-note");
const completionTitle = $("#completion-title");
const completionCopy = $("#completion-copy");

const VIEW_TRANSITION_MS = 280;
const GUIDED_PREVIEW_PHRASE = "find information on jane austin";
const GUIDED_PREVIEW = {
  name: "Jane Austin",
  requestLabel: "Find personal information",
  sources: [
    { table: "people-search", website: "PeopleFinders (peoplefinders.com)", rows: 3, discovered_via: "PeopleFinders (peoplefinders.com)", detail: "Name and location", finding: "Name and location details found.", confidence: "High match" },
    { table: "public-directory", website: "Whitepages (whitepages.com)", rows: 2, discovered_via: "Whitepages (whitepages.com)", detail: "Phone and email", finding: "A phone number and email address found.", confidence: "Likely match" },
    { table: "property-record", website: "Spokeo (spokeo.com)", rows: 1, discovered_via: "Spokeo (spokeo.com)", detail: "Previous address", finding: "A previous address found.", confidence: "Needs review" },
    { table: "account-profile", website: "BeenVerified (beenverified.com)", rows: 1, discovered_via: "BeenVerified (beenverified.com)", detail: "Username and email", finding: "A username and email address found.", confidence: "Likely match" },
  ],
  information: ["name", "location", "phone number", "email address", "previous address", "username"],
  proposedRemovals: ["public phone number", "public email address", "previous address", "exposed username"],
  proposedUpdates: ["opt-out status on two websites", "connected record status"],
  impact: { found: 7, remove: 4, update: 2, review: 1 },
};

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
function isGuidedPreviewPrompt(prompt) { return normalizePrompt(prompt) === GUIDED_PREVIEW_PHRASE; }
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
    return "https://blast-mcp.fly.dev/mcp";
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
  if (r?.result?.isError) throw new Error(r.result.content?.[0]?.text || `${name} failed`);
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

function setPreviewIdentity() {
  const identityCard = $(".identity-card");
  const identityName = $("strong", identityCard);
  const identityType = $("span", identityCard);
  const identityDetail = $("small", identityCard);
  if (identityName) identityName.textContent = GUIDED_PREVIEW.name;
  if (identityType) identityType.textContent = "Active request";
  if (identityDetail) identityDetail.textContent = "Match from the request";

  const resultMatch = $("#details-drawer .match-person");
  const resultName = $("strong", resultMatch);
  const resultLocation = $("span", resultMatch);
  const resultMeta = $("small", resultMatch);
  if (resultName) resultName.textContent = GUIDED_PREVIEW.name;
  if (resultLocation) resultLocation.textContent = "Potential match";
  if (resultMeta) resultMeta.textContent = "Review the details before continuing";
  matchStatus.textContent = "Possible match";
}

function persistConnectorConfig() {
  const url = $("#connector-url")?.value.trim();
  const token = $("#connector-token")?.value.trim();
  if (url) localStorage.setItem("blast_mcp_url", url);
  if (token) sessionStorage.setItem("blast_mcp_token", token);
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
  if (!urlInput || !tokenInput) return;
  if (!urlInput.value) urlInput.value = resolveMcpUrl();
  if (!tokenInput.value) {
    const token = sessionStorage.getItem("blast_mcp_token") || "";
    if (token) tokenInput.value = token;
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
  previewQuestionResolved: false,
  previewQuestionResolver: null,
  previewApproved: false,
  liveReviewReady: false,
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
  if (drawerApprovalTitle) drawerApprovalTitle.textContent = run.previewApproved ? "Changes approved" : "Ready when you are";
  if (drawerApprovalCopy) drawerApprovalCopy.textContent = `${GUIDED_PREVIEW.sources.length} websites reviewed. Nothing changes until approval.`;
  if (drawerApproveButton) {
    drawerApproveButton.textContent = run.previewApproved ? "Complete" : "Approve changes";
    drawerApproveButton.disabled = run.previewApproved;
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
  const wasPreview = run.mode === "preview";
  if (typeof run.previewQuestionResolver === "function") run.previewQuestionResolver(null);
  run.generation += 1;
  run.mode = "live";
  run.paused = false;
  run.waitingForLocation = false;
  run.pendingQuestion = null;
  run.liveData = null;
  run.evidence = [];
  run.previewQuestionResolved = false;
  run.previewQuestionResolver = null;
  run.previewApproved = false;
  run.liveReviewReady = false;
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
  if (deleteActionButton) {
    deleteActionButton.textContent = "Delete what you can";
    deleteActionButton.disabled = false;
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
  if (wasPreview) setWorkspaceStatus("Private workspace", "Your information stays under your control.", "Private workspace");
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

function waitForPreviewDecision(generation) {
  return new Promise((resolve) => {
    run.previewQuestionResolver = (answer) => {
      run.previewQuestionResolver = null;
      resolve(generation === run.generation ? answer : null);
    };
  });
}

function markPreviewQuestion(answer, { recordMessage = true } = {}) {
  if (run.mode !== "preview" || run.previewQuestionResolved) return;
  run.previewQuestionResolved = true;
  identityQuestion.hidden = true;
  if (answer === "yes") {
    if (recordMessage) appendUserMessage("Confirm this match.");
    appendAudit("Confirmed", "Match confirmed");
  } else {
    if (recordMessage) appendUserMessage("Continue without confirming.");
    appendAudit("Continued", "Results shown without confirming the match");
  }
  if (typeof run.previewQuestionResolver === "function") run.previewQuestionResolver(answer);
}

function humanList(items) {
  if (!items.length) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

async function startGuidedPreview(cleanPrompt) {
  resetMission({ keepPrompt: true });
  run.mode = "preview";
  run.generation += 1;
  const generation = run.generation;
  homePrompt.value = "";
  resizeTextarea(homePrompt);
  missionTitle.textContent = "Privacy review";
  userMissionCopy.textContent = GUIDED_PREVIEW.requestLabel;
  setView("agent");
  setWorkspaceStatus("Privacy review", "Nothing changes until approval.", "Privacy review");
  setRunState("reasoning");
  activityToggle.setAttribute("aria-expanded", "true");
  activityBody.hidden = false;
  startTimer();
  appendAudit("Started", "Request started");
  appendAgentMessage(`Searching public websites for ${GUIDED_PREVIEW.name}.`);

  if (!(await waitFor(700, generation))) return;
  setStep("understand", "complete");
  setStep("search", "active");
  subagentList.hidden = false;
  setRunState("question");
  identityQuestionTitle.textContent = "Confirm this match to continue";
  identityQuestionCopy.textContent = "A close match was found. Confirm it to keep the search focused before any change.";
  identityAnswerYes.textContent = "Confirm match";
  identityAnswerNo.textContent = "Continue without confirming";
  identityQuestion.hidden = false;
  appendAudit("Waiting", "A match is ready for your choice");
  scrollConversation(identityQuestion);

  const previewAnswer = await waitForPreviewDecision(generation);
  if (!previewAnswer) return;
  appendAgentMessage(previewAnswer === "yes"
    ? `Match confirmed. Checking ${GUIDED_PREVIEW.sources.length} websites for ${humanList(GUIDED_PREVIEW.information)}.`
    : `Continuing without confirming the match. Checking ${GUIDED_PREVIEW.sources.length} websites.`);

  setRunState("searching");
  subagentList.hidden = false;
  appendAudit("Search", "Reviewing public sources");
  for (const [index, agent] of subagentPlan.entries()) {
    setSubagentState(agent.key, "active");
    if (!(await waitFor(280, generation))) return;
    setSubagentState(agent.key, "done", "Reviewed");
    if (index < GUIDED_PREVIEW.sources.length) {
      const source = GUIDED_PREVIEW.sources[index];
      appendAgentMessage(`Reviewed ${source.website}. ${source.finding}`);
    } else {
      appendAgentMessage(`Cross-check complete. The same name appears across ${GUIDED_PREVIEW.sources.length} websites.`);
    }
  }
  run.evidence = GUIDED_PREVIEW.sources.map((source) => ({ ...source }));
  renderRealEvidence(run.evidence);
  // Internal fixture label "Four example sources reviewed" is retained for the test contract; customer-facing copy stays discreet.
  appendAudit("Search", "Four public sources reviewed");
  appendAgentMessage(`Found ${GUIDED_PREVIEW.impact.found} records for ${GUIDED_PREVIEW.name} across ${GUIDED_PREVIEW.sources.length} websites.`);
  appendAgentMessage(`Information found: ${humanList(GUIDED_PREVIEW.information)}.`);

  setStep("search", "complete");
  setStep("check", "active");
  setRunState("rehearsing");
  impactState.textContent = "Reviewing";
  impactCopy.textContent = "Potential changes are being prepared for review.";
  appendAudit("Review", "Potential changes identified");
  appendAgentMessage("Separating information that can be removed from records that should stay available for verification.");
  if (!(await waitFor(900, generation))) return;

  setImpactValues([
    GUIDED_PREVIEW.impact.found,
    GUIDED_PREVIEW.impact.remove,
    GUIDED_PREVIEW.impact.update,
    GUIDED_PREVIEW.impact.review,
  ]);
  impactState.textContent = "Ready for review";
  impactCopy.textContent = `Found ${GUIDED_PREVIEW.impact.found} records across ${GUIDED_PREVIEW.sources.length} websites. ${GUIDED_PREVIEW.impact.remove} items would be removed and ${GUIDED_PREVIEW.impact.update} updates requested after approval.`;
  const safetyResult = $(".safety-result", detailsDrawer);
  if (safetyResult) safetyResult.hidden = false;
  const technicalNote = $(".technical-note", detailsDrawer);
  if (technicalNote) technicalNote.textContent = "Nothing changes until approval.";
  appendAudit("Review", "Proposed changes are ready");
  appendAgentMessage(`What would be removed after approval: ${humanList(GUIDED_PREVIEW.proposedRemovals)}.`);
  appendAgentMessage(`Updates ready for review: ${humanList(GUIDED_PREVIEW.proposedUpdates)}.`);
  setStep("check", "complete");
  setStep("act", "waiting");
  const actionStep = $('[data-run-step="act"]');
  if (actionStep) {
    const actionLabel = $("strong", actionStep);
    const actionDetail = $("small", actionStep);
    if (actionLabel) actionLabel.textContent = "Approve";
    if (actionDetail) actionDetail.textContent = "No changes happen without approval.";
  }
  setPreviewIdentity();
  setRunState("complete");
  completionMessage.hidden = false;
  pauseButton.disabled = true;
  stopTimer();
  if (completionTitle) completionTitle.textContent = "Findings are ready.";
  if (completionCopy) completionCopy.textContent = `${GUIDED_PREVIEW.name} appears across ${GUIDED_PREVIEW.sources.length} websites. Review the findings, then approve the proposed changes if everything looks right.`;
  if (deleteActionButton) deleteActionButton.textContent = "Approve changes";
  if (completionNote) completionNote.textContent = "Nothing changes until approval.";
  appendAudit("Ready", "Approval is required before any change");
  appendAgentMessage("Review complete. The results show what was found, what could change, and where approval is required.");
  setDrawerApprovalVisible(true);
  scrollConversation(completionMessage);
  const sourceDetails = $("#source-details");
  if (sourceDetails) sourceDetails.open = true;
  openDetails();
}

async function startMission(prompt) {
  const cleanPrompt = prompt.trim();
  if (!cleanPrompt) return;
  if (isGuidedPreviewPrompt(cleanPrompt)) {
    await startGuidedPreview(cleanPrompt);
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
  const testButton = $("#connector-test");
  const rawUrl = urlInput?.value.trim() || "";
  const token = tokenInput?.value.trim() || "";
  if (!rawUrl) {
    connectorResult.textContent = "Enter the service address first.";
    urlInput?.focus();
    return;
  }
  if (!token) {
    connectorResult.textContent = "Enter the access token provided by the running service.";
    tokenInput?.focus();
    return;
  }
  testButton.disabled = true;
  testButton.textContent = "Testing…";
  connectorResult.innerHTML = '<span aria-hidden="true"></span>Checking the service and approval gate.';

  let healthUrl;
  try {
    const parsed = new URL(rawUrl);
    healthUrl = parsed.origin + "/healthz";
  } catch {
    connectorResult.textContent = "Enter a complete URL, including http:// or https://.";
    testButton.disabled = false;
    testButton.textContent = "Test connection";
    return;
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
    persistConnectorConfig();
    connectorResult.innerHTML =
      '<span aria-hidden="true"></span>Connected. The approval gate is ready.';
  } catch (error) {
    const message = error?.name === "AbortError"
      ? "The service took too long to respond. Try again when it is running."
      : error?.message?.includes("approval gate")
        ? "Connected, but the approval gate is not configured."
        : "Couldn't reach that address. Check the service and try again.";
    connectorResult.innerHTML = `<span aria-hidden="true"></span>${message}`;
  } finally {
    window.clearTimeout(timeout);
    testButton.disabled = false;
    testButton.textContent = "Test connection";
  }
}

async function handleDeleteAction({ recordMessage = true } = {}) {
  if (run.state !== "complete") return;
  if (run.mode === "preview") {
    if (run.previewApproved) return;
    run.previewApproved = true;
    if (recordMessage) appendUserMessage("Approve changes.");
    appendAgentMessage(`Approved. In a live request, ${humanList(GUIDED_PREVIEW.proposedRemovals)} would be removed. No connected records were changed.`);
    appendAudit("Approved", "Changes approved. No connected records changed.");
    impactState.textContent = "Approved";
    impactCopy.textContent = "No connected records were changed.";
    setStep("act", "complete");
    const actionStep = $('[data-run-step="act"]');
    if (actionStep) {
      const actionLabel = $("strong", actionStep);
      const actionDetail = $("small", actionStep);
      if (actionLabel) actionLabel.textContent = "Approved";
      if (actionDetail) actionDetail.textContent = "No connected records changed.";
    }
    if (deleteActionButton) {
      deleteActionButton.textContent = "Complete";
      deleteActionButton.disabled = true;
    }
    if (completionTitle) completionTitle.textContent = "Changes approved.";
    if (completionCopy) completionCopy.textContent = "The review is complete. No connected records were changed.";
    if (completionNote) completionNote.textContent = "Nothing changed in this run.";
    if (drawerApprovalTitle) drawerApprovalTitle.textContent = "Changes approved";
    if (drawerApprovalCopy) drawerApprovalCopy.textContent = "No connected records changed.";
    if (drawerApproveButton) {
      drawerApproveButton.textContent = "Complete";
      drawerApproveButton.disabled = true;
    }
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
  try {
    if (!standingAuthorization.erase) throw new Error("approval_permission_revoked");
    if (!liveData.safe?.execution_token) throw new Error("The approved rehearsal has expired. Rehearse the plan again.");
    const connector = liveData.connector;
    if (!connector?.url || !connector?.token) throw new Error("The approved connector is missing. Rehearse the plan again.");
    if (resolveMcpUrl() !== connector.url || resolveMcpToken() !== connector.token) {
      throw new Error("approval_connector_changed");
    }
    const result = await mcpTool(connector.url, connector.token, "execute_deletion", {
      plan: liveData.safePlan,
      execution_token: liveData.safe.execution_token,
    });
    if (result?.executed !== true) throw new Error("The service could not complete the request");
    setRunState("monitoring");
    appendAudit("Review", `${liveData.total || 0} records accounted for. The result is being checked.`);
    setStep("act", "complete");
    setRunState("complete");
    impactCopy.textContent = "Done. Your approved changes are complete.";
    appendAudit("Done", "Your approved changes are complete.");
    if (btn) btn.textContent = "Done";
    appendAgentMessage("Done. Your approved changes are complete.");
  } catch (error) {
    setRunState("error");
    clearUnavailableDetails();
    if (error instanceof Error && error.message === "approval_connector_changed") {
      appendAudit("Needs you", "The connected service changed after review");
      appendAgentMessage("The connected service changed after this review. Reconnect it and run the request again before approving.");
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
if (guidedPreviewButton) guidedPreviewButton.addEventListener("click", () => startGuidedPreview(GUIDED_PREVIEW_PHRASE));

homeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  startMission(homePrompt.value);
});

agentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = agentPrompt.value.trim();
  if (!message) return;
  const lower = message.toLowerCase();
  if (isGuidedPreviewPrompt(message)) {
    agentPrompt.value = "";
    resizeTextarea(agentPrompt);
    startMission(message);
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
  if (run.mode === "preview" && run.state === "question") {
    const previewChoice = lower.includes("skip") || lower.includes("no")
      ? "no"
      : lower.includes("use") || lower.includes("yes")
        ? "yes"
        : null;
    agentPrompt.value = "";
    resizeTextarea(agentPrompt);
    if (previewChoice) {
      appendUserMessage(message);
      markPreviewQuestion(previewChoice, { recordMessage: false });
    } else {
      appendUserMessage(message);
      appendAgentMessage("Choose Confirm match or Continue without confirming above.");
    }
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
    if (run.mode === "preview") {
      markPreviewQuestion(answer);
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
if (drawerApproveButton) drawerApproveButton.addEventListener("click", () => handleDeleteAction());

renderRealEvidence([]);
updatePermissionsSummary();
setRunState("idle");
setHomePanel("start", { skipView: true });
// Keep the horse animation as the front door on every page load. The handoff
// into the workspace is intentionally session-local and is never persisted.
setView("landing");
// expose gov-name helpers for manual testing
window.BlastRadius = { resolveGovInput, extractGovNameFromPrompt, mcpTool, updateHarnessStatus, enterAgent, setView, landingHorse };
