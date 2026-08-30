import { readFileSync } from "node:fs";
import { TrueForge, TrueForgeError } from "@truefoundry/trueforge-sdk";
import type { TrueForgeApi } from "@truefoundry/trueforge-sdk";

function parseKeyList(raw?: string): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  // fallback: try rotating model/key lists before throwing
  if (name === "MODEL_NAME") {
    const fallbacks = parseKeyList(process.env.MODEL_NAMES);
    if (fallbacks[0]) return fallbacks[0];
  }
  throw new Error(
    `Missing required environment variable: ${name}. ` +
      `Copy .env.example to .env and fill it in before provisioning.`,
  );
}

interface ManifestFile extends Omit<TrueForgeApi.AgentSpec, "model"> {
  name: string;
  model: TrueForgeApi.Model;
}

function isFreeModel(model: string): boolean {
  const id = model.includes("/") ? model.split("/").slice(1).join("/") : model;
  return /:free$/.test(id);
}

function isAllowedModel(model: string): boolean {
  // Native Gemini models are quota-controlled by Google and do not use the
  // OpenRouter-style `:free` suffix. Keep the free-only guard for every other
  // provider while allowing the provider configured in TrueForge's catalog.
  return model.startsWith("google-gemini/") || isFreeModel(model);
}

async function main(): Promise<void> {
  const baseUrl = process.env.TRUEFORGE_BASE_URL?.trim() || "http://localhost:8791";
  const token = requiredEnv("TRUEFORGE_TOKEN");
  let modelName = requiredEnv("MODEL_NAME");
  if (!isAllowedModel(modelName)) {
    throw new Error(`Only native google-gemini models or free models (:free suffix) allowed. Got MODEL_NAME=${modelName}`);
  }
  // validate fallbacks too
  for (const m of parseKeyList(process.env.MODEL_NAMES)) {
    if (!isAllowedModel(m)) throw new Error(`Only native google-gemini models or free models allowed in MODEL_NAMES, got ${m}`);
  }
  const mcpServerUrl = process.env.MCP_SERVER_URL?.trim() || "http://mcp-server:8080/mcp";
  const mcpAuthToken = requiredEnv("MCP_AUTH_TOKEN");

  const manifestPath = new URL("./agent.manifest.json", import.meta.url);
  const file = JSON.parse(readFileSync(manifestPath, "utf8")) as ManifestFile;

  file.model.name = modelName;
  const serverRef = file.mcpServers?.[0];
  if (!serverRef) throw new Error("agent.manifest.json has no mcpServers[0] entry");

  const client = new TrueForge({ baseUrl, token });

  const registered = await client.settings.mcpServers.createOrUpdate({
    manifest: {
      name: serverRef.name,
      description:
        "Subject-data store for erasure workflows: read-only discovery and shadow-copy rehearsal, plus one gated destructive tool (execute_deletion).",
      type: "remote",
      url: mcpServerUrl,
      auth: {
        type: "header",
        headers: { Authorization: `Bearer ${mcpAuthToken}` },
      },
    },
  });
  console.log(`registered mcp server "${serverRef.name}" -> ${mcpServerUrl}`);
  console.log(JSON.stringify(registered, null, 2));

  const manifest: TrueForgeApi.AgentSpec = {
    model: file.model,
    instructions: file.instructions,
    mcpServers: file.mcpServers,
    skills: file.skills,
    config: file.config,
  };

  try {
    const created = await client.agents.create({ name: file.name, manifest });
    console.log(`created agent "${file.name}"`);
    console.log(JSON.stringify(created, null, 2));
  } catch (err) {
    const status = err instanceof TrueForgeError ? err.statusCode : undefined;
    if (status === 409 || status === 400) {
      console.log(`agent "${file.name}" already exists - updating its manifest instead`);
      const listed = await client.agents.list();
      const existing = listed.data.find((a) => a.name === file.name);
      if (!existing?.id) throw err;
      const updated = await client.agents.update(existing.id, { manifest });
      console.log(`updated agent "${file.name}" (${existing.id})`);
      console.log(JSON.stringify(updated, null, 2));
    } else {
      throw err;
    }
  }

  console.log(
    [
      "",
      "blast-radius is provisioned.",
      "Next steps:",
      "  1. open the TrueForge UI and confirm the subject-data connector lists its tools",
      "  2. register the gdpr-erasure skill in settings if it is not there yet",
      "  3. start a session with: delete everything we hold for customer 4471",
      "  4. execute_deletion must pause at the approval gate - verify that first",
      "",
    ].join("\n"),
  );
}

main().catch((err) => {
  console.error("provisioning failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
