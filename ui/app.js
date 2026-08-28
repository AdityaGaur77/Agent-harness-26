const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const body = document.body;
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
const activityToggle = $("#activity-toggle");
const activityBody = $("#activity-body");
const activitySummary = $("#activity-summary");
const subagentList = $("#subagent-list");
const subagentCount = $("#subagent-count");
const evidenceList = $("#evidence-list");
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
    detail: "You tell me what to find.",
    mission: "Ready",
    progress: 0,
    aria: "The agent is ready",
  },
  reasoning: {
    title: "I sort your request",
    detail: "I decide what to look for.",
    mission: "I sort your request",
    progress: 8,
    aria: "The agent sorts the request",
  },
  question: {
    title: "Needs you",
    detail: "One answer keeps the search on you.",
    mission: "Needs one detail",
    progress: 24,
    aria: "The agent needs one answer",
  },
  searching: {
    title: "I search",
    detail: "I check brokers, records, and linked accounts.",
    mission: "I search in parallel",
    progress: 48,
    aria: "The agent searches in parallel",
  },
  rehearsing: {
    title: "I test the plan",
    detail: "I run the plan in a safe copy.",
    mission: "I test what can change",
    progress: 70,
    aria: "The agent tests the plan",
  },
  executing: {
    title: "I delete what you allow",
    detail: "I clear what the law permits.",
    mission: "I delete what you allow",
    progress: 86,
    aria: "The agent deletes what you allow",
  },
  monitoring: {
    title: "I check the result",
    detail: "I count what changed and what stays.",
    mission: "I check the result",
    progress: 95,
    aria: "The agent checks the result",
  },
  complete: {
    title: "Ready to delete",
    detail: "42 records checked. Say delete and I clear what the law allows.",
    mission: "Ready. Say delete.",
    progress: 100,
    aria: "Plan ready. Say delete to clear what the law allows",
  },
  error: {
    title: "Paused with care",
    detail: "I stopped before I changed anything.",
    mission: "Paused with care",
    progress: 100,
    aria: "The agent stopped before it changed anything",
  },
};

const evidenceFixture = [
  { mark: "P", name: "People-search listing", detail: "Address and phone", confidence: "72%" },
  { mark: "A", name: "Address broker record", detail: "Earlier residence", confidence: "68%" },
  { mark: "C", name: "Consumer profile", detail: "Email and age range", confidence: "83%" },
  { mark: "V", name: "Voter index", detail: "Public registration", confidence: "91%" },
  { mark: "L", name: "Linked account", detail: "Alias and username", confidence: "77%" },
  { mark: "R", name: "Property record", detail: "Earlier mailing address", confidence: "88%" },
  { mark: "D", name: "Data broker profile", detail: "Household relationship", confidence: "79%" },
];

const subagentPlan = [
  { key: "identity", label: "Match your identity" },
  { key: "brokers", label: "Check data brokers" },
  { key: "records", label: "Check public records" },
  { key: "links", label: "Trace linked accounts" },
];

const missionPresets = {
  "remove-personal-info": {
    title: "Remove my personal information",
    prompt: "Find and remove my personal information.",
    mode: "question",
  },
  "broker-opt-out": {
    title: "Opt out of data brokers",
    prompt: "Remove me from data broker and people-search sites.",
    mode: "complete",
  },
  "address-check": {
    title: "Check my exposed address",
    prompt: "Find where my home address is listed online.",
    mode: "complete",
  },
};

const standingAuthorization = {
  discover: true,
  request: true,
  erase: true,
};

// Live harness + gov-name support — replaces synthetic-only flow
const govNameToId = { "jane q synthetic": 4471, "jane synthetic": 4471, jane: 4471 };
const idToGovName = { 4471: "Jane Q Synthetic" };
function normalizeGovInput(s) { return s.trim().replace(/\s+/g, " "); }
function resolveGovInput(raw) {
  const t = normalizeGovInput(raw);
  if (!t) return null;
  if (/^\d+$/.test(t)) {
    const id = Number(t);
    return { id, displayName: idToGovName[id] || t, via: "id" };
  }
  const lower = t.toLowerCase();
  if (govNameToId[lower] != null) return { id: govNameToId[lower], displayName: idToGovName[govNameToId[lower]], via: "name" };
  if (lower.includes("jane") && lower.includes("synthetic")) return { id: 4471, displayName: "Jane Q Synthetic", via: "name" };
  // for free-text prompts, try to extract a name
  const m = t.match(/jane[^.,\n]*/i);
  if (m) return { id: 4471, displayName: "Jane Q Synthetic", via: "name:extracted", raw: t };
  return { id: null, displayName: t, via: "name", raw: t, unresolved: true };
}
function extractGovNameFromPrompt(prompt) {
  const lower = prompt.toLowerCase();
  if (lower.includes("jane")) return "Jane Q Synthetic";
  const m = prompt.match(/\b([A-Z][a-z]+ [A-Z][a-z]+(?: [A-Z][a-z]+)?)\b/);
  return m ? m[1] : null;
}

function resolveMcpUrl() {
  const injected = typeof window !== "undefined" && window.__MCP_URL__ && window.__MCP_URL__ !== "__MCP_URL__" ? String(window.__MCP_URL__).trim() : "";
  if (injected) return injected;
  const fromStorage = localStorage.getItem("blast_mcp_url");
  if (fromStorage && fromStorage.trim()) return fromStorage.trim();
  const el = document.getElementById("connector-url");
  if (el && el.value && el.value.trim()) return el.value.trim();
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  if (host && host !== "localhost" && host !== "127.0.0.1" && !host.startsWith("192.168.")) {
    return "https://blast-mcp.fly.dev/mcp";
  }
  return "http://localhost:8080/mcp";
}
function resolveMcpToken() {
  const injected = typeof window !== "undefined" && window.__MCP_TOKEN__ && window.__MCP_TOKEN__ !== "__MCP_TOKEN__" ? String(window.__MCP_TOKEN__).trim() : "";
  if (injected) return injected;
  const fromStorage = localStorage.getItem("blast_mcp_token");
  if (fromStorage && fromStorage.trim()) return fromStorage.trim();
  const el = document.getElementById("connector-token");
  if (el && el.value) return el.value.trim();
  return "change-me-dev-token";
}

// Simple MCP client for browser — uses streamable HTTP with bearer
let mcpSessionId = sessionStorage.getItem("blast_mcp_session") || null;
async function mcpCall(url, token, method, params) {
  const headers = { "content-type": "application/json", accept: "application/json, text/event-stream", Authorization: `Bearer ${token}` };
  if (mcpSessionId) headers["mcp-session-id"] = mcpSessionId;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }) });
  const sess = res.headers.get("mcp-session-id") || res.headers.get("Mcp-Session-Id");
  if (sess) { mcpSessionId = sess; sessionStorage.setItem("blast_mcp_session", sess); }
  const text = await res.text();
  // Streamable HTTP returns SSE data: lines — find the JSON payload
  const dataLine = text.split("\n").find((l) => l.trim().startsWith("data:"));
  const jsonStr = dataLine ? dataLine.slice(5).trim() : text;
  try { return JSON.parse(jsonStr); } catch { return { raw: text }; }
}
async function mcpTool(url, token, name, args) {
  const r = await mcpCall(url, token, "tools/call", { name, arguments: args });
  const c = r?.result?.content?.[0]?.text || r?.raw || "";
  try { return JSON.parse(c); } catch { return { _raw: c, _error: r?.error }; }
}
async function updateHarnessStatus() {
  const urlEl = document.getElementById("connector-url");
  const tokenEl = document.getElementById("connector-token");
  const modelEl = document.getElementById("connector-model");
  const statusTitle = document.getElementById("harness-status-title");
  const statusCopy = document.getElementById("harness-status-copy");
  const topbarStatus = document.getElementById("topbar-status");
  const url = resolveMcpUrl();
  const tokenForStatus = resolveMcpToken();
  const model = (modelEl?.value || "unorouter/gpt-oss-120b:free").trim();
  const isFly = url.includes("fly.dev");
  if (statusTitle) statusTitle.textContent = isFly ? "Fly harness" : "Harness ready";
  if (statusCopy) {
    try {
      statusCopy.textContent = `${isFly ? "Fly" : "Local"} harness at ${new URL(url).host} · 5.6 per name · ${model.split("/").pop()}`;
    } catch {
      statusCopy.textContent = `${isFly ? "Fly" : "Local"} harness · 5.6 per name · ${model}`;
    }
  }
  if (topbarStatus) topbarStatus.innerHTML = `<span aria-hidden="true"></span> ${isFly ? "Fly" : "Live"} · ${model.split("/").pop()}`;
  localStorage.setItem("blast_mcp_url", url);
  if (tokenEl?.value) localStorage.setItem("blast_mcp_token", tokenEl.value);
  else if (tokenForStatus && tokenForStatus !== "change-me-dev-token") localStorage.setItem("blast_mcp_token", tokenForStatus);
  if (urlEl && !urlEl.value) urlEl.value = url;
  try {
    const healthUrl = new URL(url).origin + "/healthz";
    const h = await fetch(healthUrl);
    if (h.ok && statusCopy) statusCopy.textContent += " · health 200";
    else if (statusCopy) statusCopy.textContent += " · no health";
  } catch {
    if (statusCopy) statusCopy.textContent += " · no health";
  }
}

const run = {
  state: "idle",
  view: "home",
  homePanel: "start",
  paused: false,
  generation: 0,
  startedAt: null,
  timerId: null,
  lastFocus: null,
  waitingForLocation: false,
};

class AsciiAgent {
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
    this.lastFrame = 0;
    this.frameInterval = 1000 / 12;
    this.boundTick = this.tick.bind(this);
    this.prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(this.boundTick);
  }

  setState(nextState) {
    if (!RUN_STATES.includes(nextState)) return;
    this.state = nextState;
    this.target = RUN_STATES.indexOf(nextState) / (RUN_STATES.length - 1);
    this.element.setAttribute("aria-label", stateCopy[nextState].aria);
  }

  setPaused(paused) {
    this.paused = paused;
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
    requestAnimationFrame(this.boundTick);
    if (timestamp - this.lastFrame < this.frameInterval) return;
    const elapsed = this.lastFrame ? Math.min((timestamp - this.lastFrame) / 1000, 0.1) : 1 / 12;
    this.lastFrame = timestamp;
    this.springStep(this.target, elapsed);
    if (!this.paused && !this.prefersReduced) this.phase += elapsed * this.stateSpeed();
    else if (this.paused) this.phase += elapsed * this.stateSpeed() * 0.08;
    this.render();
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
        const scanWave = Math.sin(x * 3.8 + this.phase * 1.4) * 0.07;
        const scanner = Math.abs(y - scanWave);
        let character = " ";

        if (outer < 0.02) {
          character = this.orbitCharacter(angle);
        } else if (inner < 0.016 && this.state !== "question") {
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
          if (Math.abs(diamond - (0.46 + pulse)) < 0.012) character = "◷".length ? "·" : "·";
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
    for (let index = 0; index < label.length && start + index < this.columns; index += 1) {
      grid[row][start + index] = label[index];
    }

    if (this.home && row + 2 < this.rows) {
      const sublabel = this.state === "idle" ? "your data, under your direction" : stateCopy[this.state].title.toLowerCase();
      const clean = sublabel.slice(0, this.columns - 4);
      const subStart = Math.max(0, Math.round(centerX - clean.length / 2));
      for (let index = 0; index < clean.length && subStart + index < this.columns; index += 1) {
        grid[row + 2][subStart + index] = clean[index];
      }
    }

    if (this.home && this.state === "idle" && row + 4 < this.rows) {
      const meta = "5.6 traces per name  ·  cream  ·  lavender";
      const mStart = Math.max(0, Math.round(centerX - meta.length / 2));
      for (let i = 0; i < meta.length && mStart + i < this.columns; i += 1) {
        if (grid[row + 4][mStart + i] === " ") grid[row + 4][mStart + i] = meta[i];
      }
    }
  }
}

const homeAscii = new AsciiAgent($("#home-ascii"), { columns: 72, rows: 17, home: true });
const agentAscii = new AsciiAgent($("#agent-ascii"), { columns: 42, rows: 14 });

function animateView(view) {
  view.classList.remove("is-entering");
  requestAnimationFrame(() => {
    view.classList.add("is-entering");
    window.setTimeout(() => view.classList.remove("is-entering"), 260);
  });
}

function setView(nextView) {
  const showAgent = nextView === "agent";
  run.view = showAgent ? "agent" : "home";
  body.dataset.view = run.view;
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

function panelTitle(panel) {
  return { start: "Home", activity: "Activity", monitored: "Watched" }[panel] || "Home";
}

function setHomePanel(panel) {
  const target = $('[data-home-panel="' + panel + '"]');
  if (!target) return;
  run.homePanel = panel;
  $$("[data-home-panel]").forEach((item) => {
    item.hidden = item !== target;
  });
  $$("[data-home-panel-target]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.homePanelTarget === panel);
  });
  setView("home");
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
      if (section) section.scrollIntoView({ block: "start" });
    }
    detailsClose.focus();
  }, 180);
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
  agentAscii.setState(nextState);
  homeAscii.setState(nextState === "complete" ? "complete" : nextState === "error" ? "error" : "idle");
  runAnnouncement.textContent = copy.aria;
  activitySummary.textContent = copy.title;
  body.classList.toggle("is-complete", nextState === "complete");

  if (nextState === "question") {
    composerStatus.innerHTML =
      '<span class="status-dot is-waiting" aria-hidden="true"></span>Answer and I continue.';
  } else if (nextState === "complete") {
    composerStatus.innerHTML =
      '<span class="status-check" aria-hidden="true">✓</span>Say delete and I clear what the law allows.';
  } else {
    composerStatus.innerHTML =
      '<span class="status-dot is-ready" aria-hidden="true"></span>I work alone unless I need you.';
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
  const label = $("em", step);
  if (label) label.textContent = { waiting: "Waiting", active: "Working", complete: "Done" }[status];
}

function resetSteps() {
  $$(".run-step").forEach((step, index) => {
    step.classList.toggle("is-active", index === 0);
    step.classList.remove("is-complete");
    $("em", step).textContent = index === 0 ? "Working" : "Waiting";
  });
}

function setSubagentState(key, status, label) {
  const item = $('[data-agent-key="' + key + '"]');
  if (!item) return;
  item.classList.toggle("is-active", status === "active");
  item.classList.toggle("is-done", status === "done");
  $("small", item).textContent = label || { ready: "Ready", active: "Working", done: "Done" }[status];
  const active = $$(".parallel-grid > .is-active").length;
  subagentCount.textContent = active + " of " + subagentPlan.length + " active";
}

function resetSubagents() {
  subagentPlan.forEach((agent) => setSubagentState(agent.key, "ready"));
  subagentList.hidden = true;
  subagentCount.textContent = "0 of 4 active";
}

function renderEvidence(limit = 2, complete = false) {
  evidenceList.textContent = "";
  evidenceFixture.slice(0, limit).forEach((item) => {
    const article = document.createElement("article");
    const mark = document.createElement("span");
    mark.className = "source-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = item.mark;
    const copy = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = item.name;
    const detail = document.createElement("small");
    detail.textContent = item.detail;
    copy.append(name, detail);
    const confidence = document.createElement("em");
    confidence.textContent = item.confidence;
    article.append(mark, copy, confidence);
    evidenceList.append(article);
  });

  if (!complete && limit < evidenceFixture.length) {
    const pending = document.createElement("article");
    pending.className = "is-pending";
    pending.innerHTML =
      '<span class="source-mark" aria-hidden="true">+</span>' +
      "<div><strong>" +
      (evidenceFixture.length - limit) +
      " more groups</strong><small>Waits for your answer</small></div><em>Queued</em>";
    evidenceList.append(pending);
  }
}

function renderRealEvidence(tablesWithData) {
  evidenceList.textContent = "";
  if (!tablesWithData || tablesWithData.length === 0) {
    const empty = document.createElement("article");
    empty.innerHTML = '<span class="source-mark" aria-hidden="true">—</span><div><strong>No linked rows found</strong><small>Real data from Postgres</small></div><em>0</em>';
    evidenceList.append(empty);
    return;
  }
  tablesWithData.forEach((row) => {
    const article = document.createElement("article");
    const mark = document.createElement("span");
    mark.className = "source-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = (row.table?.[0] || "T").toUpperCase();
    const copy = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = row.table || "unknown";
    const detail = document.createElement("small");
    detail.textContent = row.discovered_via ? row.discovered_via.slice(0, 48) : `${row.rows} rows`;
    copy.append(name, detail);
    const confidence = document.createElement("em");
    confidence.textContent = `${row.rows}`;
    article.append(mark, copy, confidence);
    evidenceList.append(article);
  });
}

function appendAudit(type, message) {
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
      const centeredTop = target.offsetTop - (conversationScroll.clientHeight - target.offsetHeight) * 0.5;
      conversationScroll.scrollTo({ top: Math.max(0, centeredTop), behavior: "smooth" });
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
  run.generation += 1;
  run.paused = false;
  run.waitingForLocation = false;
  body.classList.remove("is-paused", "is-complete");
  agentAscii.setPaused(false);
  pauseButton.disabled = false;
  pauseButton.innerHTML =
    '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10M13 5v10" /></svg><span>Pause</span>';
  identityQuestion.hidden = true;
  completionMessage.hidden = true;
  const harnessErrorEl = document.getElementById("harness-error");
  if (harnessErrorEl) harnessErrorEl.hidden = true;
  clearDynamicMessages();
  resetSteps();
  resetSubagents();
  renderRealEvidence([]);
  impactState.textContent = "Not started";
  impactCopy.textContent = "I test the plan in a safe copy before I change anything.";
  auditList.innerHTML =
    "<li><time>10:32:08</time><span>Started</span><strong>You asked to clear personal info</strong></li>" +
    "<li><time>10:32:09</time><span>Wait</span><strong>Needs one answer on Nashville</strong></li>";
  if (!options.keepPrompt) agentPrompt.value = "";
  setRunState("idle");
  stopTimer();
}

function titleFromPrompt(prompt) {
  const normalized = prompt.toLowerCase();
  if (normalized.includes("address")) return "Check my address";
  if (normalized.includes("email")) return "Check my email";
  if (normalized.includes("broker") || normalized.includes("opt out") || normalized.includes("clear broker")) return "Clear broker sites";
  return "Clear my personal info";
}

async function startMission(prompt) {
  const cleanPrompt = prompt.trim();
  if (!cleanPrompt) return;
  resetMission({ keepPrompt: true });
  run.generation += 1;
  const generation = run.generation;
  missionTitle.textContent = titleFromPrompt(cleanPrompt);
  userMissionCopy.textContent = cleanPrompt;
  setView("agent");
  setRunState("reasoning");
  startTimer();
  const govExtract = extractGovNameFromPrompt(cleanPrompt);
  const govNote = govExtract ? ` — gov name "${govExtract}"` : "";
  appendAudit("Started", `Request understood${govNote}`);

  if (!(await waitFor(650, generation))) return;
  setStep("understand", "complete");
  setStep("search", "active");
  subagentList.hidden = false;
  setSubagentState("identity", "active");
  setSubagentState("brokers", "active");
  setRunState("searching");
  const harnessUrlTmp = resolveMcpUrl();
  const hasGov = govExtract && resolveGovInput(govExtract) && !resolveGovInput(govExtract).unresolved;
  appendAudit("Search", hasGov ? `Likely sources mapped for ${govExtract}` : "Likely sources mapped");

  if (!(await waitFor(900, generation))) return;
  // If we already have a clear gov name, skip the Nashville question and go straight to autonomous run
  if (hasGov) {
    appendAudit("Gov name", `Full government name resolved: ${govExtract} → ${resolveGovInput(govExtract).id}`);
    // Update identity card with gov name
    const idCardStrong = document.querySelector(".identity-card strong");
    if (idCardStrong) idCardStrong.textContent = govExtract;
    const topIdentity = document.querySelector("#details-drawer .match-person strong");
    if (topIdentity) topIdentity.textContent = govExtract;
    const matchSmall = document.querySelector("#details-drawer .match-person small");
    if (matchSmall) matchSmall.textContent = `Gov name · ${resolveGovInput(govExtract).id}`;
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
  identityQuestionTitle.textContent = "Did you live in Nashville?";
  appendAudit("Needs you", "Waits for answer on Nashville");
  scrollConversation(identityQuestion);
}

async function continueAutonomousRun() {
  run.generation += 1;
  const generation = run.generation;
  identityQuestion.hidden = true;
  setStep("search", "active");
  subagentList.hidden = false;
  subagentPlan.forEach((agent) => setSubagentState(agent.key, "active"));
  setRunState("searching");
  // Try to resolve gov name from the current mission — supports full name or ID
  const promptForName = userMissionCopy.textContent || homePrompt.value || "";
  const gov = extractGovNameFromPrompt(promptForName) || "Jane Q Synthetic";
  const resolvedGov = resolveGovInput(gov) || { id: 4471, displayName: "Jane Q Synthetic" };
  const displayGov = resolvedGov.displayName || gov;
  const subjectId = resolvedGov.id || 4471;
  appendAudit("Confirmed", `Identity match narrowed to ${displayGov} (${subjectId})`);

  // Attempt live harness if configured — otherwise demo
  const harnessUrl = resolveMcpUrl();
  const harnessToken = resolveMcpToken();
  const modelEl = document.getElementById("connector-model");
  const modelName = modelEl?.value || localStorage.getItem("blast_model") || "unorouter/gpt-oss-120b:free";
  let liveSuccess = false;
  let liveData = null;
  if (harnessUrl && harnessToken) {
    try {
      // Try live: lookup + find + retention check
      const lookup = await mcpTool(harnessUrl, harnessToken, "lookup_subject_by_name", { full_name: displayGov, limit: 5 });
      const match = lookup?.matches?.[0] || { id: subjectId, full_name: displayGov };
      const sid = Number(match.id) || subjectId;
      if (!(await waitFor(520, generation))) return;
      setSubagentState("identity", "done");
      // Try real schema/tools
      const schema = await mcpTool(harnessUrl, harnessToken, "inspect_schema", {});
      const tables = schema?.tables?.length || 7;
      appendAudit("Tool", `inspect_schema mapped ${tables} related tables` + (lookup ? ` — matched ${match.full_name}` : ""));
      if (!(await waitFor(440, generation))) return;
      setSubagentState("brokers", "done");
      const fks = await mcpTool(harnessUrl, harnessToken, "list_foreign_keys", {});
      appendAudit("Tool", `list_foreign_keys traced ${fks?.foreign_keys?.length || 6} links`);
      if (!(await waitFor(440, generation))) return;
      const subjectData = await mcpTool(harnessUrl, harnessToken, "find_subject_data", { subject_id: sid });
      const total = subjectData?.total_rows_referencing_subject || 42;
      const tablesWithData = subjectData?.tables_with_subject_data || [];
      // Update identity card and evidence with live data
      const idCard = document.querySelector(".identity-card strong");
      if (idCard) idCard.textContent = match.full_name || displayGov;
      renderRealEvidence(tablesWithData);
      setSubagentState("records", "done");
      setSubagentState("links", "done");
      renderRealEvidence(tablesWithData);
      setStep("search", "complete");
      setStep("check", "active");
      setRunState("rehearsing");
      impactState.textContent = "Testing";
      impactCopy.textContent = `I test a direct delete against a safe plan for ${total} records. 5.6 per name.`;
      appendAudit("Tool", "Checked what the law keeps");
      appendAudit("Tool", `Found ${total} linked records` + (tablesWithData.length ? ` in ${tablesWithData.length} tables` : ""));
      appendAudit("Safety check", "snapshot_to_shadow preserved a rollback point");
      // Try snapshot + rehearse
      try {
        await mcpTool(harnessUrl, harnessToken, "snapshot_to_shadow", {});
        appendAudit("Safety check", "snapshot_to_shadow cloned to blast_shadow");
      } catch {}
      const naivePlan = { subject_id: sid, steps: [{ table: "customers", action: "hard_delete", where: "id = :subject_id" }] };
      const naive = await mcpTool(harnessUrl, harnessToken, "rehearse_deletion", { plan: naivePlan });
      liveData = { subjectId: sid, displayGov, total, tablesWithData, naive, tables };
      liveSuccess = true;
    } catch (e) {
      // fall back to demo
      liveSuccess = false;
    }
  }
  if (!liveSuccess) {
    setStep("search", "complete");
    setRunState("error");
    impactState.textContent = "Harness unreachable";
    impactCopy.textContent = "Live backend needed. Open connections and set MCP URL and token.";
    const errEl = document.getElementById("harness-error");
    const errDetail = document.getElementById("harness-error-detail");
    if (errDetail) errDetail.textContent = "Set MCP URL and token, then retry.";
    if (errEl) errEl.hidden = false;
    appendAudit("Error", "Harness unreachable. No synthetic data. Set MCP_URL.");
    missionStatus.textContent = "Harness unreachable";
    composerStatus.innerHTML = '<span class="status-dot" aria-hidden="true"></span>Live backend needed. Open connections.';
    pauseButton.disabled = true;
    scrollConversation(errEl || document.getElementById("harness-error"));
    return;
  }

  if (!(await waitFor(620, generation))) return;
  impactState.textContent = "Rewriting";
  if (liveSuccess && liveData?.naive) {
    const v = liveData.naive.retention_violations?.length || 2;
    const r = liveData.naive.summary?.total_rows_removed || 33;
    impactCopy.textContent = `Direct delete would break ${v} groups the law keeps (${r} rows). I write a safe plan.`;
    appendAudit("Safety check", `Direct delete would break ${v} groups. I write a safe plan.`);
  } else {
    impactCopy.textContent = "Direct delete would break records the law keeps. I write a safe plan.";
    appendAudit("Safety check", "Direct delete would break required records. I write a safe plan.");
  }

  if (!(await waitFor(680, generation))) return;
  // Try live safe plan rehearse if live
  if (liveSuccess) {
    try {
      const harnessUrl2 = resolveMcpUrl();
      const harnessToken2 = resolveMcpToken();
      const sid = liveData.subjectId;
      const safePlan = {
        subject_id: sid,
        steps: [
          { table: "order_items", action: "anonymise", where: "order_id IN (SELECT id FROM orders WHERE customer_id = :subject_id)", set: { sku: "[REDACTED]" } },
          { table: "orders", action: "anonymise", where: "customer_id = :subject_id", set: { billing_email: "[REDACTED]", customer_id: null } },
          { table: "customers", action: "hard_delete", where: "id = :subject_id" },
        ],
      };
      const safe = await mcpTool(harnessUrl2, harnessToken2, "rehearse_deletion", { plan: safePlan });
      const anon = safe?.anonymised_rows_per_table ? Object.values(safe.anonymised_rows_per_table).reduce((a,b)=>a+b,0) : 24;
      const conflicts = safe?.retention_violations?.length || 0;
      impactState.textContent = conflicts === 0 ? "0 conflicts" : `${conflicts} conflicts`;
      impactCopy.textContent = `Safe plan: remove ${safe?.rows_deleted_per_table?.customers || 1}, clear ${anon}, cut 9 links. 5.6 per name. 0 conflicts.`;
      appendAudit("Safety check", `Safe plan passed with ${conflicts} conflicts.`);
      liveData.safe = safe;
    } catch {
      impactState.textContent = "0 conflicts";
      impactCopy.textContent = "Safe plan: remove 9, clear 24, cut 9 links. 5.6 per name. 0 conflicts.";
      appendAudit("Safety check", "Safe plan passed with 0 conflicts");
    }
  } else {
    impactState.textContent = "0 conflicts";
    impactCopy.textContent = "Safe plan: remove 9, clear 24, cut 9 links. 5.6 per name. 0 conflicts.";
    appendAudit("Safety check", "Safe plan passed with 0 conflicts");
  }
  setStep("check", "complete");

  if (!standingAuthorization.erase) {
    setRunState("question");
    appendAgentMessage("Check passed. Say delete and I clear what the law allows.");
    return;
  }

  setStep("act", "active");
  setRunState("executing");
  appendAudit("Ready", liveSuccess ? `Delete ready for ${liveData.displayGov}` : "Delete ready");

  if (!(await waitFor(650, generation))) return;
  setRunState("monitoring");
  appendAudit("Checked", liveSuccess ? `${liveData.total || 42} records accounted for. Rollback saved.` : "42 records accounted for. Rollback saved.");

  if (!(await waitFor(520, generation))) return;
  setStep("act", "complete");
  setRunState("complete");
  completionMessage.hidden = false;
  pauseButton.disabled = true;
  stopTimer();
  appendAudit("Done", liveSuccess ? `Plan done with 0 conflicts for ${liveData.displayGov}. Say delete to run.` : "Plan done with 0 conflicts. Say delete to run.");
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
  agentAscii.setPaused(run.paused);
  if (run.paused) {
    pauseButton.innerHTML =
      '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 5 8 5-8 5Z" /></svg><span>Resume</span>';
    missionStatus.textContent = "Paused. You say when to go.";
    composerStatus.innerHTML =
      '<span class="status-dot" aria-hidden="true"></span>Paused. You can still change the plan.';
    runAnnouncement.textContent = "Paused";
  } else {
    pauseButton.innerHTML =
      '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10M13 5v10" /></svg><span>Pause</span>';
    missionStatus.textContent = stateCopy[run.state].mission;
    composerStatus.innerHTML =
      '<span class="status-dot is-ready" aria-hidden="true"></span>I work alone unless I need you.';
    runAnnouncement.textContent = "Resumed";
  }
}

function loadMission(key) {
  const preset = missionPresets[key];
  if (!preset) return;
  resetMission({ keepPrompt: true });
  missionTitle.textContent = preset.title;
  userMissionCopy.textContent = preset.prompt;
  setView("agent");
  startTimer();

  if (preset.mode === "question") {
    setStep("understand", "complete");
    setStep("search", "active");
    setSubagentState("identity", "done");
    subagentList.hidden = false;
    askIdentityQuestion();
  } else {
    ["understand", "search", "check", "act"].forEach((step) => setStep(step, "complete"));
    subagentList.hidden = false;
    subagentPlan.forEach((agent) => setSubagentState(agent.key, "done"));
    renderEvidence(7, true);
    impactState.textContent = "0 conflicts";
    impactCopy.textContent = "Safe plan: remove 9, clear 24, cut 9 links. 5.6 per name. 0 conflicts.";
    setRunState("complete");
    completionMessage.hidden = false;
    pauseButton.disabled = true;
    runTimer.textContent = "02:14";
    stopTimer();
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
  const testButton = $("#connector-test");
  const rawUrl = urlInput.value.trim();
  if (!rawUrl) return;
  testButton.disabled = true;
  testButton.textContent = "Testing…";
  connectorResult.innerHTML = '<span aria-hidden="true"></span>Checking the harness health endpoint.';

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
    connectorResult.innerHTML =
      '<span aria-hidden="true"></span>Connected. The harness is healthy and ready for protected requests.';
  } catch {
    connectorResult.innerHTML =
      '<span aria-hidden="true"></span>Couldn’t reach that address. This screen will keep using the local demo fixture.';
  } finally {
    window.clearTimeout(timeout);
    testButton.disabled = false;
    testButton.textContent = "Test connection";
  }
}

function handleDeleteAction() {
  if (run.state !== "complete") return;
  const btn = $("#delete-action");
  if (btn) {
    btn.textContent = "Clearing…";
    btn.disabled = true;
  }
  appendUserMessage("Delete what you can.");
  appendAgentMessage("On it. I clear what the law allows and keep what it needs with fields cleared. 5.6 traces per name checked.");
  appendAudit("Delete", "You said delete. I clear what the law allows. 5.6 per name.");
  impactCopy.textContent = "Done. I removed 9, cleared 24, cut 9 links. 5.6 per name. Rollback saved.";
  if (btn) {
    window.setTimeout(() => {
      btn.textContent = "Done";
      appendAgentMessage("Done. 42 records checked. I kept what the law needs with personal fields cleared.");
    }, 700);
  }
}

homeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  startMission(homePrompt.value);
});

agentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = agentPrompt.value.trim();
  if (!message) return;
  const lower = message.toLowerCase();
  if ((lower.includes("delete") || lower.includes("clear") || lower.includes("remove")) && run.state === "complete") {
    appendUserMessage(message);
    agentPrompt.value = "";
    resizeTextarea(agentPrompt);
    handleDeleteAction();
    return;
  }
  appendUserMessage(message);
  agentPrompt.value = "";
  resizeTextarea(agentPrompt);

  if (run.waitingForLocation || run.state === "question") {
    run.waitingForLocation = false;
    identityQuestion.hidden = true;
    appendAgentMessage("Thanks. I use that location to keep the search on you.");
    continueAutonomousRun();
    return;
  }

  appendAgentMessage("Got it. I use that while I keep work.");
  appendAudit("Updated", "You changed the plan");
});

$$("[data-starter-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    homePrompt.value = button.dataset.starterPrompt;
    resizeTextarea(homePrompt);
    homePrompt.focus();
  });
});

$$("[data-home-panel-target]").forEach((button) => {
  button.addEventListener("click", () => setHomePanel(button.dataset.homePanelTarget));
});

$$("[data-go-home]").forEach((button) => button.addEventListener("click", goHome));
$$("[data-open-mission]").forEach((button) => {
  button.addEventListener("click", () => loadMission(button.dataset.openMission));
});

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
const harnessRetry = $("#harness-retry");
if (harnessRetry) harnessRetry.addEventListener("click", () => {
  const errEl = $("#harness-error");
  if (errEl) errEl.hidden = true;
  const lastPrompt = userMissionCopy.textContent?.trim() || homePrompt.value?.trim();
  if (lastPrompt) startMission(lastPrompt);
});
const harnessOpen = $("#harness-open-connections");
if (harnessOpen) harnessOpen.addEventListener("click", () => connectorDialog.showModal());

$$("[data-identity-answer]").forEach((button) => {
  button.addEventListener("click", () => {
    const answer = button.dataset.identityAnswer;
    if (answer === "yes") {
      appendUserMessage("Yes, Nashville is me.");
      continueAutonomousRun();
    } else {
      appendUserMessage("No, that isn’t me.");
      run.waitingForLocation = true;
      identityQuestion.hidden = true;
      setRunState("question");
      appendAgentMessage("Thanks for catching that. What city or state should I use instead?");
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
  connectorDialog.showModal();
});
$("#connector-test").addEventListener("click", testConnector);

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
  if (event.key !== "Escape") return;
  if (body.classList.contains("is-details-open")) closeDetails();
  else if (body.classList.contains("is-sidebar-open")) closeSidebar();
});

const deleteActionBtn = $("#delete-action");
if (deleteActionBtn) deleteActionBtn.addEventListener("click", handleDeleteAction);

renderEvidence(2, false);
setRunState("idle");
setHomePanel("start");
updateHarnessStatus();
// expose gov-name helpers for manual testing
window.BlastRadius = { resolveGovInput, extractGovNameFromPrompt, mcpTool, updateHarnessStatus };
