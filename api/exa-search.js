const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT = 20;
const MAX_BODY_BYTES = 16 * 1024;
const MAX_QUERY_LENGTH = 500;
const rateBuckets = new Map();
const RATE_LIMIT_SCRIPT = "local count = redis.call('INCR', KEYS[1]); if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; return count;";

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

function localRateLimit(request) {
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

function durableRateLimitConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim().replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  return url && token ? { url, token } : null;
}

async function consumeRateLimit(request) {
  const config = durableRateLimitConfig();
  if (config) {
    const key = `blast-radius:exa:${clientKey(request)}`;
    try {
      const result = await fetch(`${config.url}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify([["EVAL", RATE_LIMIT_SCRIPT, 1, key, Math.ceil(RATE_WINDOW_MS / 1000)]]),
      });
      if (!result.ok) throw new Error(`Upstash rate limit failed (${result.status})`);
      const payload = await result.json();
      const count = Number(payload?.[0]?.result);
      if (!Number.isFinite(count)) throw new Error("Upstash returned an invalid counter");
      return { allowed: count <= RATE_LIMIT, durable: true };
    } catch (error) {
      console.error(error);
      return { allowed: false, unavailable: true };
    }
  }

  // Vercel instances do not share memory. Do not silently run an unbounded
  // paid-key proxy in production when the shared counter is not configured.
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    return { allowed: false, unavailable: true };
  }
  return { allowed: localRateLimit(request), durable: false };
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

  const expectedTokens = [process.env.EXA_PROXY_TOKEN, process.env.MCP_AUTH_TOKEN]
    .map((value) => value?.trim())
    .filter(Boolean);
  const authorization = header(request, "authorization");
  if (!expectedTokens.length || !expectedTokens.some((token) => authorization === `Bearer ${token}`)) {
    response.status(401).json({ error: "unauthorized" });
    return;
  }
  const rate = await consumeRateLimit(request);
  if (rate.unavailable) {
    response.status(503).json({ error: "rate_limit_not_configured", results: [] });
    return;
  }
  if (!rate.allowed) {
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
