/**
 * Idempotent provisioning for the Blast Radius agent.
 *
 * Run it as many times as you like: it registers (or refreshes) the
 * `subject-data` connector, then creates or updates the agent from
 * `agent.manifest.json`. `make provision` on a clean clone is the only
 * supported way to change the agent — see docs/runbook.md.
 *
 * The last thing it prints is the approval gate. That is deliberate. A wrong
 * gate does not throw; it quietly lets the irreversible write run unattended,
 * so provisioning refuses to be quiet about it.
 */

import { readFileSync } from 'node:fs';

import {
  TrueForge,
  TrueForgeError,
  type TrueForgeApi,
} from '@truefoundry/trueforge-sdk';

/** The connector name. Must match `mcpServers[].name` in the manifest. */
const CONNECTOR_NAME = 'subject-data';

/** Replaced with $MODEL_NAME at provision time so the manifest stays env-free. */
const MODEL_PLACEHOLDER = '__MODEL_NAME__';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

/** A misconfiguration, not a bug: reported as one line, without a stack. */
class ConfigError extends Error {}

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new ConfigError(
      `Missing required environment variable ${name}. ` +
        'Copy .env.example to .env and fill it in.',
    );
  }
  return value.trim();
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : fallback;
}

interface Env {
  baseUrl: string;
  apiKey: string;
  modelName: string;
  mcpServerUrl: string;
  mcpAuthToken: string;
  agentName: string;
}

function readEnv(): Env {
  return {
    baseUrl: required('TRUEFORGE_BASE_URL'),
    apiKey: process.env.TRUEFORGE_API_KEY?.trim() ?? '',
    modelName: required('MODEL_NAME'),
    /**
     * The URL the *harness* uses to reach the MCP server, which is not
     * necessarily the one you use. Inside compose it is the service name.
     */
    mcpServerUrl: optional('MCP_SERVER_URL', 'http://mcp-server:8080/mcp'),
    mcpAuthToken: required('MCP_AUTH_TOKEN'),
    agentName: optional('AGENT_NAME', 'blast-radius'),
  };
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

/**
 * Read the manifest off disk rather than `import`ing it: the file lives at the
 * package root, outside `rootDir`, so a JSON import would not compile. Both
 * `src/provision.ts` and the built `dist/provision.js` sit one directory below
 * it, so this URL is correct either way.
 */
function loadManifest(modelName: string): TrueForgeApi.AgentSpec {
  const path = new URL('../agent.manifest.json', import.meta.url);
  const raw = readFileSync(path, 'utf8');

  if (!raw.includes(MODEL_PLACEHOLDER)) {
    console.warn(
      `warning: ${MODEL_PLACEHOLDER} not found in agent.manifest.json — ` +
        'MODEL_NAME will not be applied.',
    );
  }

  const spec = JSON.parse(
    raw.replaceAll(MODEL_PLACEHOLDER, modelName),
  ) as TrueForgeApi.AgentSpec;

  if (!spec.model?.name) {
    throw new ConfigError('agent.manifest.json is missing model.name');
  }
  return spec;
}

/** Tools the manifest says must pause for a human, for the closing report. */
function gatedTools(spec: TrueForgeApi.AgentSpec): string[] {
  const attachment = spec.mcpServers?.find((s) => s.name === CONNECTOR_NAME);
  return [...(attachment?.requireApprovalForTools ?? [])];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** The deepest cause message that says something `message` did not already. */
function rootCause(cause: unknown, message: string): string | undefined {
  let found: string | undefined;
  let current = cause;
  for (let depth = 0; current instanceof Error && depth < 8; depth += 1) {
    if (current.message && current.message !== message) found = current.message;
    current = current.cause;
  }
  return found;
}

/** Fern errors carry the useful part in `statusCode` / `body`, not `message`. */
function describe(err: unknown): string {
  if (err instanceof TrueForgeError) {
    const status = err.statusCode ? ` (HTTP ${err.statusCode})` : '';
    const body =
      err.body === undefined ? '' : `\n  body: ${JSON.stringify(err.body)}`;
    const requestId = err.requestId ? `\n  requestId: ${err.requestId}` : '';
    // A transport failure arrives as `fetch failed` with the real reason
    // (DNS, refused connection, TLS) buried further down the cause chain.
    const root = rootCause(err.cause, err.message);
    const cause = root ? `\n  cause: ${root}` : '';
    return `${err.message}${status}${body}${cause}${requestId}`;
  }
  if (err instanceof ConfigError) return err.message;
  return err instanceof Error ? (err.stack ?? err.message) : String(err);
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

function buildConnectorManifest(env: Env): TrueForgeApi.McpServerManifest {
  return {
    name: CONNECTOR_NAME,
    description:
      'Subject-data tools for GDPR erasure: read the live schema and its ' +
      'foreign-key graph, locate a subject, rehearse a deletion against a ' +
      'throwaway shadow copy, and execute the approved plan against live data.',
    type: 'remote',
    url: env.mcpServerUrl,
    auth: {
      type: 'header',
      headers: { Authorization: `Bearer ${env.mcpAuthToken}` },
    },
  };
}

async function registerConnector(
  client: TrueForge,
  env: Env,
): Promise<void> {
  const manifest = buildConnectorManifest(env);
  try {
    await client.settings.mcpServers.createOrUpdate({ manifest });
    console.log(
      `Connector  ${CONNECTOR_NAME} -> ${env.mcpServerUrl} (createOrUpdate)`,
    );
  } catch (err) {
    console.warn(`  createOrUpdate rejected: ${describe(err)}`);
    console.warn('  falling back to create...');
    await client.settings.mcpServers.create({ manifest });
    console.log(`Connector  ${CONNECTOR_NAME} -> ${env.mcpServerUrl} (create)`);
  }
}

async function upsertAgent(
  client: TrueForge,
  env: Env,
  manifest: TrueForgeApi.AgentSpec,
): Promise<string> {
  const { data: agents } = await client.agents.list();
  const existing = agents.find((agent) => agent.name === env.agentName);

  if (existing) {
    const { data } = await client.agents.update(existing.id, { manifest });
    console.log(`Agent      ${env.agentName} updated`);
    return data.id;
  }

  const { data } = await client.agents.create({
    name: env.agentName,
    manifest,
  });
  console.log(`Agent      ${env.agentName} created`);
  return data.id;
}

/** MCP `tools/list` entries come back verbatim, so their shape is unvalidated. */
interface ToolEntry {
  name?: unknown;
  annotations?: { destructiveHint?: unknown };
}

/**
 * Read the connector back. This is the only place the annotation is observed
 * after it has crossed the wire — an annotation that does not survive the
 * round-trip is a gate that will not fire.
 */
async function reportConnectorTools(
  client: TrueForge,
  env: Env,
): Promise<void> {
  console.log('');
  console.log('--- connector tools ---');
  try {
    const { data: tools } = await client.mcpServers.listTools(CONNECTOR_NAME);
    if (tools.length === 0) {
      console.log('  (none — the connector answered but exposed no tools)');
    }
    for (const tool of tools as ToolEntry[]) {
      const name = typeof tool.name === 'string' ? tool.name : '<unnamed>';
      const destructive = tool.annotations?.destructiveHint === true;
      console.log(`  ${destructive ? 'DESTRUCTIVE' : 'safe       '}  ${name}`);
    }
  } catch (err) {
    console.log(`  unavailable: ${describe(err)}`);
    console.log(
      '  The connector is registered either way. This call needs the harness ' +
        `to reach ${env.mcpServerUrl} right now; see docs/runbook.md.`,
    );
  }
}

/**
 * The failure mode that silently loses the demo: a manifest that gates nothing.
 * Print it last, loudly, so nobody has to go looking for it.
 */
function reportApprovalGate(manifest: TrueForgeApi.AgentSpec): void {
  const gated = gatedTools(manifest);

  console.log('');
  console.log('=== APPROVAL GATE ===');
  if (gated.length === 0) {
    console.log(
      '  NOTHING IS GATED. The irreversible write will run unattended.',
    );
    console.log(
      `  Set requireApprovalForTools on the "${CONNECTOR_NAME}" entry in ` +
        'agent.manifest.json and re-run provisioning.',
    );
  } else {
    for (const tool of gated) {
      console.log(`  pauses for human approval: ${tool}`);
    }
    console.log('  Every other tool runs autonomously.');
  }
  console.log('=====================');
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const env = readEnv();

  const client = new TrueForge({
    baseUrl: env.baseUrl,
    ...(env.apiKey ? { auth: { token: env.apiKey } } : {}),
  });

  console.log(`TrueForge: ${env.baseUrl}`);
  console.log(
    `Auth:      ${
      env.apiKey
        ? 'bearer token from TRUEFORGE_API_KEY'
        : 'none (TRUEFORGE_API_KEY unset)'
    }`,
  );
  console.log('');

  // Load the manifest before touching the network: a typo in it should fail
  // in a second, not after a round trip.
  const manifest = loadManifest(env.modelName);

  await registerConnector(client, env);
  const agentId = await upsertAgent(client, env, manifest);

  console.log(`Agent id   ${agentId}`);
  console.log(`Model      ${manifest.model.name}`);

  await reportConnectorTools(client, env);
  reportApprovalGate(manifest);
}

try {
  await main();
} catch (err) {
  console.error('');
  console.error(`Provisioning failed: ${describe(err)}`);
  process.exitCode = 1;
}
