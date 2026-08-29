import { readFile } from "node:fs/promises";

const root = new URL("..", import.meta.url);
const read = (file) => readFile(new URL(file, root), "utf8");
const [html, css, js, pkg] = await Promise.all([
  read("index.html"),
  read("styles.css"),
  read("app.js"),
  read("package.json"),
]);

const all = `${html}\n${css}\n${js}`;
const toolNames = [
  "inspect_schema",
  "list_foreign_keys",
  "get_retention_policies",
  "find_subject_data",
  "snapshot_to_shadow",
  "rehearse_deletion",
  "execute_deletion",
];

const irrelevantChatFeatures = [
  "model-picker",
  "voice-mode",
  "image-generator",
  "plugin-browser",
  "project-switcher",
  "gpt-store",
];

const assertions = [
  ["main landmark", /<main[^>]+id="main-content"/.test(html)],
  ["one page heading", (html.match(/<h1\b/g) || []).length === 1],
  ["two-stage product", ['id="home-view"', 'id="agent-view"', 'data-view="home"'].every((value) => html.includes(value)) && js.includes("setView")],
  ["prompt-first home", html.indexOf('id="home-prompt"') < html.indexOf('id="recent-missions"') && (html.includes("Tell me what to find") || html.includes("What would you like me to find") || html.includes("What should I find or remove"))],
  ["only relevant chat patterns", irrelevantChatFeatures.every((value) => !all.includes(value))],
  ["home navigation is privacy specific", ["New request", "Activity", "Connections"].every((value) => html.includes(value)) && (html.includes("Watched") || html.includes("Monitored"))],
  ["editorial agent voice", (html.includes("family=Newsreader") || html.includes("family=Merriweather")) && css.includes("--font-agent")],
  ["readable neutral token system", ["--canvas", "--line", "--ink", "--muted"].every((token) => css.includes(token)) && css.includes("oklch")],
  ["one restrained palette", !/gradient\(/.test(css) && !html.includes("contrast-toggle") && !html.includes("theme-picker")],
  ["no forbidden transition all", !/transition:\s*all\b/.test(css)],
  ["humanized product copy", ["This looks like you", "What changes", "0 conflicts"].every((value) => html.includes(value)) && (html.includes("Runs alone") || html.includes("Runs on its own"))],
  ["jargon stays out of primary copy", !/IDENTITY CANDIDATE|QUESTION ·|AUTONOMOUS WITHIN SCOPE|REASONING ABOUT SEARCH SCOPE/.test(html)],
  ["home composer", html.includes('id="home-form"') && html.includes('id="home-prompt"') && js.includes("startMission")],
  ["conversation-first agent", html.includes('id="conversation-thread"') && html.includes('id="agent-composer"') && html.includes('id="agent-prompt"')],
  ["long-running progress controls", html.includes('id="mission-progress"') && html.includes('id="pause-run"') && js.includes("togglePause")],
  ["agent can ask a necessary question", html.includes('id="identity-question"') && html.includes("data-identity-answer") && js.includes("askIdentityQuestion")],
  ["autonomy continues after confirmation", (html.includes("Runs alone") || html.includes("Runs on its own")) && js.includes("continueAutonomousRun") && js.includes("standingAuthorization")],
  ["details are progressive", html.includes('id="details-drawer"') && html.includes('id="details-backdrop"') && html.includes('aria-hidden="true"') && js.includes("openDetails")],
  ["evidence and confidence", html.includes('id="evidence-list"') && html.includes("Confidence") && js.includes("evidenceFixture")],
  ["what would change and exact rehearsal", html.includes('id="impact-summary"') && all.includes("42") && all.includes("9") && /0 conflicts/i.test(all)],
  ["all seven harness tools represented", toolNames.every((name) => all.includes(name))],
  ["technical details are optional", html.includes('id="technical-details"') && (html.includes("Technical details") || html.includes("How I checked")) && (/compacted/i.test(all) || /packed into/i.test(all))],
  ["connector controls preserved", html.includes('id="connector-dialog"') && html.includes('id="connector-url"') && html.includes('id="connector-token"') && html.includes('id="connector-test"') && js.includes("/healthz")],
  ["scope and rollback preserved", html.includes('id="scope-policy"') && /rollback/i.test(all)],
  ["audit history preserved", html.includes('id="audit-history"') && js.includes("appendAudit")],
  ["monitored identity is usable", html.includes('id="monitored-panel"') && all.includes("Jane Q Synthetic") && all.includes("customer 4471") && html.includes('id="add-identity"')],
  ["demo is honest and human", (html.includes("Demo only") || html.includes("This demo uses")) && /rollback/i.test(all)],
  ["agent status announced", html.includes('role="status"') && html.includes('aria-live="polite"')],
  ["ASCII adapts across both views", html.includes('id="home-ascii"') && html.includes('id="agent-ascii"') && js.includes("class AsciiAgent")],
  ["ASCII is a structural presence", /homeAscii[^\n]+columns:\s*(?:9[6-9]|1\d{2})[^\n]+rows:\s*(?:2[2-9]|[3-9]\d)/.test(js) && /agentAscii[^\n]+columns:\s*(?:6\d|[7-9]\d|1\d{2})/.test(js) && js.includes("sidebarAscii")],
  ["home copy is deliberately sparse", !html.includes('class="presence-label"') && !html.includes('class="starter-prompts"') && !html.includes('class="privacy-promise"')],
  ["primary surfaces are flat", /\.prompt-card\s*\{[^}]*border-radius:\s*0/.test(css) && /\.mission-progress\s*\{[^}]*border-radius:\s*0/.test(css) && /\.agent-composer\s*\{[^}]*border-radius:\s*0/.test(css) && !css.includes("--shadow-card")],
  ["neutral palette has no decorative status colors", !["--pastel-blue", "--pastel-green", "--pastel-yellow"].some((token) => css.includes(token))],
  ["12 FPS interruptible ASCII", /1000\s*\/\s*12/.test(js) && js.includes("requestAnimationFrame") && js.includes("springStep") && js.includes("velocity")],
  ["complete agent states", ["idle", "reasoning", "question", "searching", "rehearsing", "executing", "monitoring", "complete", "error"].every((state) => all.includes(state))],
  ["responsive navigation and drawer", css.includes("@media (max-width:") && html.includes('id="sidebar-toggle"') && html.includes('id="details-toggle"')],
  ["mobile body cannot overflow", css.includes("overflow: hidden") && css.includes("100dvh")],
  ["focus-visible states", css.includes(":focus-visible")],
  ["no runtime dependencies", !JSON.parse(pkg).dependencies && !JSON.parse(pkg).devDependencies],
];

const failures = assertions.filter(([, passed]) => !passed);
for (const [label, passed] of assertions) console.log(`${passed ? "PASS" : "FAIL"} ${label}`);
console.log(`\n${assertions.length - failures.length}/${assertions.length} checks passed.`);
if (failures.length) process.exit(1);
