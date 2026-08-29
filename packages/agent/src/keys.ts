/**
 * Rotating API key helper.
 * Reads comma-separated env vars and returns first valid key.
 * Call `getRotatingKey` or `withRotation` to try keys sequentially
 * when a provider returns 401/429/quota errors.
 */

export type Provider = "gemini" | "openrouter" | "zen_mux" | "unorouter";

const ENV_MAP: Record<Provider, string> = {
  gemini: "GEMINI_API_KEYS",
  openrouter: "OPENROUTER_API_KEYS",
  zen_mux: "ZEN_MUX_API_KEYS",
  unorouter: "UNOROUTER_API_KEYS",
};

/** Allowed free-model patterns - only :free suffix allowed per user requirement */
export const FREE_MODEL_PATTERN = /:free$/;

/** Validate that a model is free-tier only */
export function isFreeModel(model: string): boolean {
  // model format: provider/model-id ; check suffix after slash
  const id = model.includes("/") ? model.split("/").slice(1).join("/") : model;
  return FREE_MODEL_PATTERN.test(id);
}

export function parseKeys(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getKeys(provider: Provider): string[] {
  return parseKeys(process.env[ENV_MAP[provider]]);
}

/** Return first non-empty key, or undefined if none set. */
export function getCurrentKey(provider: Provider): string | undefined {
  return getKeys(provider)[0];
}

/** Return true if provider has at least one key configured. */
export function hasKey(provider: Provider): boolean {
  return getKeys(provider).length > 0;
}

/**
 * Try `fn` with each key in order until it succeeds.
 * `isRetryable` decides if error warrants trying next key
 * (default: 401/403/429 or quota/billing messages).
 */
export async function withRotation<T>(
  provider: Provider,
  fn: (apiKey: string, attempt: number) => Promise<T>,
  isRetryable?: (err: unknown) => boolean,
): Promise<T> {
  const keys = getKeys(provider);
  if (keys.length === 0) {
    throw new Error(
      `No API keys configured for ${provider}. Set ${ENV_MAP[provider]} in .env (comma-separated).`,
    );
  }

  const shouldRetry =
    isRetryable ??
    ((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      const status = (err as { statusCode?: number })?.statusCode ??
        (err as { status?: number })?.status;
      if (status === 401 || status === 403 || status === 429) return true;
      return /quota|rate.?limit|billing|exceeded|unauthorized|invalid.api.key/i.test(msg);
    });

  let lastErr: unknown;
  for (let i = 0; i < keys.length; i++) {
    try {
      return await fn(keys[i]!, i);
    } catch (err) {
      lastErr = err;
      const isLast = i === keys.length - 1;
      if (isLast || !shouldRetry(err)) throw err;
      console.warn(
        `[keys] ${provider} key ${i + 1}/${keys.length} failed (${err instanceof Error ? err.message : err}), rotating to next...`,
      );
    }
  }
  throw lastErr;
}

/** Mask key for logging (keep prefix/suffix). */
export function maskKey(key: string): string {
  if (key.length <= 8) return "***";
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}
