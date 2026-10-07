import "server-only";
import { reserveRequest } from "./store";
export class ProviderError extends Error {
  constructor(
    public code: string,
    public status = 502,
  ) {
    super(code);
  }
}
const budgets = new Map<
  string,
  { start: number; count: number; blockedUntil: number; warnings: number }
>();
export const quotaWarnings = (host: string) => budgets.get(host)?.warnings || 0;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export async function rapidapiRequest(
  host: string,
  path: string,
  params: Record<string, string> = {},
  options: {
    fetcher?: typeof fetch;
    wait?: typeof sleep;
    now?: () => number;
  } = {},
): Promise<unknown> {
  if (
    !/^[a-z0-9-]+\.p\.rapidapi\.com$/.test(host) ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\")
  )
    throw new ProviderError("INVALID_PROVIDER_CONFIG");
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new ProviderError("NOT_CONFIGURED", 503);
  const fetcher = options.fetcher || fetch,
    wait = options.wait || sleep,
    now = options.now || Date.now;
  const url = new URL(path, `https://${host}`);
  if (url.host !== host) throw new ProviderError("INVALID_PROVIDER_CONFIG");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const state = budgets.get(host) || {
    start: now(),
    count: 0,
    blockedUntil: 0,
    warnings: 0,
  };
  budgets.set(host, state);
  if (state.blockedUntil > now()) throw new ProviderError("RATE_LIMITED", 429);
  for (let attempt = 0; attempt <= 2; attempt++) {
    if (now() - state.start >= 60000) {
      state.start = now();
      state.count = 0;
    }
    if (++state.count > 30) {
      state.warnings++;
      throw new ProviderError("RATE_LIMITED", 429);
    }
    try {
      if (!(await reserveRequest(host))) {
        state.warnings++;
        throw new ProviderError("RATE_LIMITED", 429);
      }
    } catch (e) {
      if (e instanceof ProviderError) throw e;
      throw new ProviderError("SHARED_STORE_UNAVAILABLE", 503);
    }
    let response: Response;
    try {
      response = await fetcher(url, {
        headers: {
          "X-RapidAPI-Key": key,
          "X-RapidAPI-Host": host,
          Accept: "application/json",
        },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      if (attempt < 2) {
        await wait(250 * 2 ** attempt);
        continue;
      }
      throw new ProviderError("PROVIDER_TIMEOUT");
    }
    if (response.status === 429 || response.status >= 500) {
      await response.body?.cancel();
      const retry = response.headers.get("retry-after");
      const retryMs = retry
        ? /^\d+$/.test(retry)
          ? Number(retry) * 1000
          : Date.parse(retry) - now()
        : 500 * 2 ** attempt;
      const delay = Math.max(
        500 * 2 ** attempt,
        Number.isFinite(retryMs) ? retryMs : 0,
      );
      if (response.status === 429) {
        state.warnings++;
        state.blockedUntil = now() + Math.min(delay, 3600000);
      }
      if (attempt === 2 || delay > 2000)
        throw new ProviderError(
          response.status === 429 ? "RATE_LIMITED" : "PROVIDER_DOWN",
          response.status === 429 ? 429 : 502,
        );
      await wait(delay);
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new ProviderError(
        [401, 403, 404].includes(response.status)
          ? "PROVIDER_DEGRADED"
          : "PROVIDER_ERROR",
      );
    }
    if (!response.headers.get("content-type")?.includes("json")) {
      await response.body?.cancel();
      throw new ProviderError("PROVIDER_SCHEMA_CHANGED");
    }
    const reader = response.body?.getReader();
    if (!reader) throw new ProviderError("PROVIDER_SCHEMA_CHANGED");
    let size = 0,
      body = "";
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 2_000_000) {
          await reader.cancel();
          throw new ProviderError("PROVIDER_RESPONSE_TOO_LARGE");
        }
        body += decoder.decode(value, { stream: true });
      }
      body += decoder.decode();
      if (body.includes(key) || body.includes(encodeURIComponent(key)))
        throw new ProviderError("PROVIDER_RESPONSE_REJECTED");
      return JSON.parse(body);
    } catch (e) {
      if (e instanceof ProviderError) throw e;
      throw new ProviderError("PROVIDER_SCHEMA_CHANGED");
    }
  }
  throw new ProviderError("PROVIDER_DOWN");
}
