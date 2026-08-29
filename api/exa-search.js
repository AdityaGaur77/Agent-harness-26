export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    response.status(503).json({ error: "search_not_configured", results: [] });
    return;
  }

  const { query, numResults = 10, type = "neural", includeDomains, excludeDomains } = request.body || {};
  if (typeof query !== "string" || !query.trim()) {
    response.status(400).json({ error: "query_required", results: [] });
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
