const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT = 20;
const MAX_BODY_BYTES = 16 * 1024;
const MAX_QUERY_LENGTH = 500;
const rateBuckets = new Map();

function header(request, name) {
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] || "";
  return typeof value === "string" ? value : "";
}

function configuredOrigins() {
  return (process.env.EXA_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function clientKey(request) {
  return (header(request, "x-forwarded-for").split(",")[0] || header(request, "x-real-ip") || "unknown").trim();
}

function consumeRateLimit(request) {
  const now = Date.now();
  const key = clientKey(request);
  const previous = rateBuckets.get(key);
  const bucket = previous && now - previous.startedAt < RATE_WINDOW_MS
    ? previous
    : { startedAt: now, count: 0 };
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  for (const [storedKey, stored] of rateBuckets) {
    if (now - stored.startedAt >= RATE_WINDOW_MS) rateBuckets.delete(storedKey);
  }
  return bucket.count <= RATE_LIMIT;
}

function validDomainList(value) {
  return value === undefined || (
    Array.isArray(value) &&
    value.length <= 20 &&
    value.every((domain) => typeof domain === "string" && domain.length <= 120 && !/[\u0000-\u001f]/.test(domain))
  );
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const origin = header(request, "origin");
  const origins = configuredOrigins();
  if (origins.length > 0 && (!origin || !origins.includes(origin))) {
    response.status(403).json({ error: "origin_not_allowed" });
    return;
  }
  if (origin && origins.includes(origin)) response.setHeader("Access-Control-Allow-Origin", origin);

  const expectedToken = process.env.EXA_PROXY_TOKEN?.trim() || process.env.MCP_AUTH_TOKEN?.trim();
  const authorization = header(request, "authorization");
  if (!expectedToken || authorization !== `Bearer ${expectedToken}`) {
    response.status(401).json({ error: "unauthorized" });
    return;
  }
  if (!consumeRateLimit(request)) {
    response.setHeader("Retry-After", "300");
    response.status(429).json({ error: "rate_limited", results: [] });
    return;
  }

  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    response.status(503).json({ error: "search_not_configured", results: [] });
    return;
  }

  const body = request.body || {};
  const bodySize = Buffer.byteLength(JSON.stringify(body));
  if (bodySize > MAX_BODY_BYTES) {
    response.status(413).json({ error: "request_too_large", results: [] });
    return;
  }
  const { query, numResults = 10, type = "neural", includeDomains, excludeDomains } = body;
  if (typeof query !== "string" || !query.trim() || query.length > MAX_QUERY_LENGTH) {
    response.status(400).json({ error: "query_required", results: [] });
    return;
  }
  if (!Number.isFinite(Number(numResults)) || Number(numResults) < 1 || Number(numResults) > 20 || !validDomainList(includeDomains) || !validDomainList(excludeDomains)) {
    response.status(400).json({ error: "invalid_search_options", results: [] });
    return;
  }
  if (type !== "neural" && type !== "keyword" && type !== "auto") {
    response.status(400).json({ error: "invalid_search_type", results: [] });
    return;
  }

  try {
    const upstream = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        query: query.trim(),
        numResults: Math.min(Math.max(Number(numResults) || 10, 1), 20),
        type,
        includeDomains,
        excludeDomains,
        useAutoprompt: true,
      }),
    });
    const payload = await upstream.json();
    response.status(upstream.status).json(payload);
  } catch {
    response.status(502).json({ error: "search_upstream_unavailable", results: [] });
  }
}
