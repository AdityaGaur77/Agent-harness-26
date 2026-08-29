import { readFile } from "node:fs/promises";

const root = new URL("..", import.meta.url);
const read = (file) => readFile(new URL(file, root), "utf8");
const readBinary = (file) => readFile(new URL(file, root));
const [html, css, js, pkg, horseFrames] = await Promise.all([
  read("index.html"),
  read("styles.css"),
  read("app.js"),
  read("package.json"),
  Promise.all(Array.from({ length: 11 }, (_, index) => readBinary(`assets/horse/frame-${String(index + 1).padStart(2, "0")}.webp`))),
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
const firstPersonPattern = /\b(?:I(?:['’](?:m|ll|d|ve)|\b)|me|my|mine|we(?:['’](?:re|ve|ll|d)|\b)|us|our|ours)\b/;
const previewFunctionStart = js.indexOf("async function startGuidedPreview");
const liveFunctionStart = js.indexOf("async function startMission");
const guidedPreviewBody = previewFunctionStart >= 0 && liveFunctionStart > previewFunctionStart
  ? js.slice(previewFunctionStart, liveFunctionStart)
  : "";
const deleteHandlerStart = js.indexOf("async function handleDeleteAction");
const deleteHandlerBody = deleteHandlerStart >= 0 ? js.slice(deleteHandlerStart) : "";

const assertions = [
  ["main landmark", /<main[^>]+id="main-content"/.test(html)],
  ["one page heading", (html.match(/<h1\b/g) || []).length === 1],
  ["two-stage product", ['id="landing-view"', 'id="home-view"', 'id="agent-view"', 'data-view="landing"'].every((value) => html.includes(value)) && js.includes("setView") && js.includes("enterAgent")],
  ["first-visit front door", html.includes('id="landing-title"') && html.includes('id="landing-description"') && html.includes('id="enter-agent"') && html.includes("Your personal data")],
  ["first visit is remembered", js.includes('ENTRY_STORAGE_KEY = "blast_radius_has_entered"') && js.includes("hasEnteredAgent") && js.includes("rememberAgentEntry") && js.includes("localStorage.setItem(ENTRY_STORAGE_KEY")],
  ["landing handoff is considered", js.includes("landingView.classList.add(\"is-leaving\")") && js.includes("appShell.classList.add(\"is-entering-workspace\")") && js.includes("VIEW_TRANSITION_MS = 280") && css.includes("landing-exit")],
  ["prompt-first home", html.indexOf('id="home-prompt"') < html.indexOf('id="recent-missions"') && (html.includes("Tell me what to find") || html.includes("What would you like to find") || html.includes("What should be found or removed"))],
  ["only relevant chat patterns", irrelevantChatFeatures.every((value) => !all.includes(value))],
  ["home navigation is privacy specific", ["New request", "Activity", "Connections"].every((value) => html.includes(value)) && (html.includes("Watched") || html.includes("Monitored"))],
  ["editorial agent voice", (html.includes("family=Newsreader") || html.includes("family=Merriweather")) && css.includes("--font-agent")],
  ["readable neutral token system", ["--canvas", "--line", "--ink", "--muted"].every((token) => css.includes(token)) && css.includes("oklch")],
  ["one restrained palette", !/gradient\(/.test(css) && !html.includes("contrast-toggle") && !html.includes("theme-picker")],
  ["no forbidden transition all", !/transition:\s*all\b/.test(css)],
  ["humanized product copy", ["Your review is ready", "Proposed changes", "Nothing changes until you approve it."].every((value) => html.includes(value)) && html.includes("Works within your preferences")],
  ["jargon stays out of primary copy", !/IDENTITY CANDIDATE|QUESTION ·|AUTONOMOUS WITHIN SCOPE|REASONING ABOUT SEARCH SCOPE/.test(html)],
  ["home composer", html.includes('id="home-form"') && html.includes('id="home-prompt"') && js.includes("startMission")],
  ["conversation-first agent", html.includes('id="conversation-thread"') && html.includes('id="agent-composer"') && html.includes('id="agent-prompt"')],
  ["long-running progress controls", html.includes('id="mission-progress"') && html.includes('id="pause-run"') && js.includes("togglePause")],
  ["agent can ask a necessary question", html.includes('id="identity-question"') && html.includes("data-identity-answer") && js.includes("askIdentityQuestion")],
  ["autonomy continues after confirmation", html.includes("Works within your preferences") && js.includes("continueAutonomousRun") && js.includes("standingAuthorization")],
  ["details are progressive", html.includes('id="details-drawer"') && html.includes('id="details-backdrop"') && html.includes('aria-hidden="true"') && js.includes("openDetails")],
  ["evidence and confidence", html.includes('id="evidence-list"') && html.includes('id="source-details"') && js.includes("renderRealEvidence")],
  ["what would change and exact review", html.includes('id="impact-summary"') && html.includes("Proposed changes") && /Ready for review/i.test(all)],
  ["implementation tool names stay private", toolNames.every((name) => !html.includes(name)) && js.includes("mcpTool")],
  ["implementation details stay private", !html.includes('id="technical-details"') && !html.includes("inspect_schema") && !html.includes("rollback") && !html.includes("safe copy")],
  ["connection status stays simple", html.includes('id="connector-dialog"') && html.includes('id="connector-result"') && !html.includes('id="connector-url"') && !html.includes('id="connector-token"') && js.includes("/healthz")],
  ["permissions stay customer-facing", html.includes('id="scope-policy"') && html.includes("Permissions") && !/rollback/i.test(html)],
  ["audit history preserved", html.includes('id="audit-history"') && js.includes("appendAudit")],
  ["monitored identity is usable", html.includes('id="monitored-panel"') && html.includes("Primary profile") && html.includes("Your email address") && html.includes('id="add-identity"')],
  ["customer copy contains no fixture data", !html.includes("Demo only") && !html.includes("Synthetic") && !html.includes("customer 4471") && !html.includes("example.test") && html.includes("Nothing changes without your approval.")],
  ["customer-facing source omits internal references", !/ascii|synthetic|demo|customer 4471|example\.test|nashville|jane q/i.test(`${html}\n${css}`)],
  ["customer-facing source uses no first person", !firstPersonPattern.test(`${html}\n${css}\n${js}`)],
  ["guided preview trigger is normalized", js.includes('GUIDED_PREVIEW_PHRASE = "find information on jane austin"') && js.includes("normalizePrompt") && js.includes("isGuidedPreviewPrompt") && js.includes("if (isGuidedPreviewPrompt(cleanPrompt))") && js.includes("if (isGuidedPreviewPrompt(message))")],
  ["guided preview stays off the live path", guidedPreviewBody.includes("GUIDED_PREVIEW.sources") && !guidedPreviewBody.includes("mcpTool") && !guidedPreviewBody.includes("exaSearch")],
  ["preview approval cannot delete", deleteHandlerBody.includes('if (run.mode === "preview")') && deleteHandlerBody.indexOf('if (run.mode === "preview")') < deleteHandlerBody.indexOf("const liveData = run.liveData") && deleteHandlerBody.includes("No connected records were changed")],
  ["guided preview shows the product story", js.includes("Four example sources reviewed") && js.includes("Approval is required before any change") && js.includes("setPreviewIdentity")],
  ["guided preview narrates findings", ["Information found:", "What would be removed after approval:", "Updates ready for review:", "Review complete."].every((value) => js.includes(value))],
  ["guided preview hides its trigger", !html.includes("Find information on Jane Austin") && guidedPreviewBody.includes("GUIDED_PREVIEW.requestLabel") && !guidedPreviewBody.includes("userMissionCopy.textContent = cleanPrompt") && guidedPreviewBody.includes("homePrompt.value = \"\"")],
  ["preview completion copy is dynamic", html.includes('id="completion-title"') && html.includes('id="completion-copy"') && js.includes("completionTitle") && js.includes("completionCopy")],
  ["preview sources name websites", js.includes("website:") && js.includes('sourceUnit = tablesWithData.some((row) => row.website)') && js.includes("source.website")],
  ["source findings identify where they came from", js.includes("Found at") && js.includes("row.website ?") && js.includes("resultDetail")],
  ["source findings get a larger reading area", css.includes("#source-details[open] .evidence-list article") && css.includes("min-height: 82px") && css.includes("font-size: 13px")],
  ["agent status announced", html.includes('role="status"') && html.includes('aria-live="polite"')],
  ["presence adapts across both views", html.includes('id="home-presence"') && html.includes('id="agent-presence"') && js.includes("class PresenceAgent")],
  ["landing horse uses authored motion frames", html.includes('id="landing-motion"') && js.includes("class HorseMotion") && js.includes("HORSE_FRAME_COUNT = 11") && horseFrames.length === 11 && horseFrames.every((frame) => frame.length > 1000)],
  ["landing horse matches the reference renderer", js.includes("HORSE_FPS = 12") && js.includes("HORSE_EDGE_BOOST = 1.65") && js.includes("HORSE_EDGE_WEIGHT = 0.75") && js.includes("HORSE_RAMP") && js.includes("getImageData")],
  ["landing horse motion is bounded", js.includes("HORSE_REPEL_RADIUS = 110") && js.includes("HORSE_REPEL_STRENGTH = 0.3") && js.includes("prefers-reduced-motion") && js.includes("setActive(active)")],
  ["presence is structural", /homePresence[^\n]+columns:\s*(?:9[6-9]|1\d{2})[^\n]+rows:\s*(?:2[2-9]|[3-9]\d)/.test(js) && /agentPresence[^\n]+columns:\s*(?:6\d|[7-9]\d|1\d{2})/.test(js) && js.includes("sidebarPresence")],
  ["home copy is deliberately sparse", !html.includes('class="presence-label"') && !html.includes('class="starter-prompts"') && !html.includes('class="privacy-promise"')],
  ["primary surfaces are flat", /\.prompt-card\s*\{[^}]*border-radius:\s*0/.test(css) && /\.mission-progress\s*\{[^}]*border-radius:\s*0/.test(css) && /\.agent-composer\s*\{[^}]*border-radius:\s*0/.test(css) && !css.includes("--shadow-card")],
  ["neutral palette has no decorative status colors", !["--pastel-blue", "--pastel-green", "--pastel-yellow"].some((token) => css.includes(token))],
  ["12 FPS interruptible motion", /1000\s*\/\s*12/.test(js) && js.includes("requestAnimationFrame") && js.includes("springStep") && js.includes("velocity")],
  ["complete agent states", ["idle", "reasoning", "question", "searching", "rehearsing", "executing", "monitoring", "complete", "error"].every((state) => all.includes(state))],
  ["responsive navigation and drawer", css.includes("@media (max-width:") && html.includes('id="sidebar-toggle"') && html.includes('id="details-toggle"')],
  ["mobile body cannot overflow", css.includes("overflow: hidden") && css.includes("100dvh")],
  ["focus-visible states", css.includes(":focus-visible")],
  ["no runtime dependencies", !JSON.parse(pkg).dependencies && !JSON.parse(pkg).devDependencies],
  ["web search credential stays server-side", !js.includes("EXA_API_KEY") && js.includes("/api/exa-search")],
  ["MCP errors fail closed", js.includes("if (!res.ok) throw") && js.includes("r?.result?.isError")],
  ["deletion calls the destructive tool", js.includes('"execute_deletion"') && js.includes("run.liveData")],
  ["unresolved identity never gets a default subject", !js.includes('|| "Jane Q Synthetic"') && !js.includes("|| 4471")],
  ["customer activity is not prefilled", !html.includes("data-open-mission") && !js.includes("missionPresets") && html.includes("No recent requests")],
  ["inert reveal runtime removed", !html.includes('class="home-intro reveal"') && !html.includes("IntersectionObserver") && !css.includes(".reveal")],
];

const failures = assertions.filter(([, passed]) => !passed);
for (const [label, passed] of assertions) console.log(`${passed ? "PASS" : "FAIL"} ${label}`);
console.log(`\n${assertions.length - failures.length}/${assertions.length} checks passed.`);
if (failures.length) process.exit(1);
