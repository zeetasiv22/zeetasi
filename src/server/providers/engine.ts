import "server-only";
import {
  persistHealth,
  storedHealth,
  persistTitles,
  persistEpisodes,
  persistPlayback,
  playbackExpires,
} from "./store";
import {
  enabledProviders,
  providerRegistry,
  providerCandidates,
} from "./provider-registry";
import { ProviderError, quotaWarnings } from "./rapidapi-client";
import { providerCache } from "./cache";
import { parseProviderId } from "./ids";
import { rankTitles } from "./normalizers/title-normalizer";
import {
  playableSources,
  type MediaCategory,
  type PlaybackResult,
  type ProviderHealth,
  type ProviderOperation,
} from "@/lib/playback";
import type { ProviderAdapter } from "./types";
const observations = new Map<string, ProviderHealth>();
function baseline(p: ProviderAdapter): ProviderHealth {
  return {
    enabled: false,
    provider: p.id,
    name: p.name,
    host: p.host,
    status: "degraded",
    latency: null,
    capabilities: p.capabilities,
    plan: p.plan,
    lastTest: null,
    error: "NOT_TESTED",
    rateLimitWarnings: 0,
    checks: {},
  };
}
async function observed<T>(
  p: ProviderAdapter,
  operation: ProviderOperation,
  load: () => Promise<T>,
): Promise<T> {
  const health = observations.get(p.id) || baseline(p),
    start = Date.now();
  try {
    const result = await load();
    const pass =
      operation === "playback"
        ? playableSources(result as PlaybackResult).length > 0
        : result !== null && (!Array.isArray(result) || result.length > 0);
    health.checks[operation] = {
      pass,
      at: new Date().toISOString(),
      message: pass
        ? "PASS"
        : operation === "playback"
          ? "NO_VALID_SOURCE"
          : "NO_RESULTS",
    };
    health.status =
      pass && Object.values(health.checks).every((c) => c.pass)
        ? "healthy"
        : "degraded";
    health.error = pass ? undefined : "NO_RESULTS";
    return result;
  } catch (error) {
    const code =
      error instanceof ProviderError ? error.code : "PROVIDER_SCHEMA_CHANGED";
    health.status =
      code === "PROVIDER_DOWN" || code === "PROVIDER_TIMEOUT"
        ? "down"
        : "degraded";
    health.error = code;
    health.checks[operation] = {
      pass: false,
      at: new Date().toISOString(),
      message: code,
    };
    console.warn("[provider]", p.id, operation, code); // Never log key, body or signed media URL.
    throw new ProviderError(
      code,
      error instanceof ProviderError ? error.status : 502,
    );
  } finally {
    health.latency = Date.now() - start;
    health.lastTest = new Date().toISOString();
    health.rateLimitWarnings = quotaWarnings(p.host);
    observations.set(p.id, health);
    await persistHealth({
      ...health,
      checks: { [operation]: health.checks[operation] },
    });
  }
}
function resolve(value: string) {
  const ref = parseProviderId(value),
    adapter = enabledProviders().find((p) => p.id === ref.provider);
  if (!adapter) throw new ProviderError("NOT_CONFIGURED", 503);
  return { adapter, id: ref.id };
}
export async function searchAllProviders(
  query: string,
  category?: MediaCategory,
  watchable = false,
) {
  if (!query.trim())
    return {
      items: [],
      providers: enabledProviders().length,
      failures: [] as { provider: string; error: string }[],
    };
  const selected = enabledProviders().filter(
    (p) => !category || p.categories.includes(category),
  );
  const results = await Promise.allSettled(
    selected.map((p) =>
      providerCache.get(
        `search:${p.id}:${process.env.RAPIDAPI_COUNTRY || "id"}:${query}`,
        300000,
        () => observed(p, "search", () => p.search(query)),
        (titles) =>
          Math.min(
            Date.now() + 300000,
            ...titles
              .filter((t) => t.playback.available)
              .map((t) => playbackExpires(t.playback)),
          ),
      ),
    ),
  );
  const items = rankTitles(
    results
      .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
      .filter((t) => !category || t.categories?.includes(category))
      .map((t) => {
        const sources = playableSources(t.playback);
        return {
          ...t,
          playback: { ...t.playback, available: sources.length > 0, sources },
        };
      }),
    query,
    Object.fromEntries(selected.map((p) => [p.id, p.reliability])),
  );
  await persistTitles(items);
  return {
    items: watchable
      ? items.filter((t) => playableSources(t.playback).length > 0)
      : items,
    providers: selected.length,
    failures: results.flatMap((r, i) =>
      r.status === "rejected"
        ? [
            {
              provider: selected[i].id,
              error:
                r.reason instanceof ProviderError
                  ? r.reason.code
                  : "PROVIDER_ERROR",
            },
          ]
        : [],
    ),
  };
}
export async function getProviderTitle(value: string) {
  const { adapter: p, id } = resolve(value);
  const title = await providerCache.get(
    `title:${value}:${process.env.RAPIDAPI_COUNTRY}`,
    600000,
    () => observed(p, "title", () => p.title(id)),
    (t) => playbackExpires(t.playback),
  );
  await persistTitles([title]);
  const sources = playableSources(title.playback);
  return {
    ...title,
    playback: { ...title.playback, available: sources.length > 0, sources },
  };
}
export async function getProviderEpisodes(value: string) {
  const { adapter: p, id } = resolve(value);
  const episodes = await providerCache.get(
    `episodes:${value}:${process.env.RAPIDAPI_COUNTRY}`,
    300000,
    () => observed(p, "episodes", () => p.episodes(id)),
  );
  await persistEpisodes(p.id, episodes);
  return episodes;
}
export function getProviderEpisode(value: string) {
  const { adapter: p, id } = resolve(value);
  return providerCache.get(
    `episode:${value}:${process.env.RAPIDAPI_COUNTRY}`,
    300000,
    () => observed(p, "episodes", () => p.episode(id)),
  );
}
export async function getPlayback(value: string): Promise<PlaybackResult> {
  try {
    const { adapter: p, id } = resolve(value);
    const result = await providerCache.get(
      `playback:${value}:${process.env.RAPIDAPI_COUNTRY}`,
      30000,
      () => observed(p, "playback", () => p.playback(id)),
      playbackExpires,
    );
    await persistPlayback(value, result);
    const sources = playableSources(result);
    return { ...result, available: sources.length > 0, sources };
  } catch (e) {
    return {
      available: false,
      sources: [],
      provider: "unavailable",
      error: e instanceof ProviderError ? e.code : "INVALID_ID",
    };
  }
}
export async function providerHealth(): Promise<ProviderHealth[]> {
  for (const h of await storedHealth()) {
    const local = observations.get(h.provider);
    if (
      !local ||
      Date.parse(h.lastTest || "") >= Date.parse(local.lastTest || "")
    )
      observations.set(h.provider, h);
  }
  const enabled = new Set(enabledProviders().map((p) => p.id));
  return [
    ...providerRegistry.map((p) => {
      const h = observations.get(p.id) || baseline(p);
      return {
        ...h,
        enabled: enabled.has(p.id),
        ...(h.status === "healthy" &&
        Object.values(h.checks).some((c) => !c.pass)
          ? { status: "degraded" as const }
          : {}),
        ...(!enabled.has(p.id)
          ? {
              status: "not_configured" as const,
              error: process.env.RAPIDAPI_KEY
                ? "AWAITING_VERIFICATION"
                : "MISSING_KEY",
            }
          : {}),
        ...(enabled.has(p.id) &&
        h.lastTest &&
        Date.now() - Date.parse(h.lastTest) > 300000
          ? { status: "degraded" as const, error: "STALE_HEALTH" }
          : {}),
        rateLimitWarnings: quotaWarnings(p.host),
      };
    }),
    ...providerCandidates.map((p) => ({
      enabled: false,
      provider: p.id,
      name: p.name,
      host: p.host,
      status: "not_configured" as const,
      latency: null,
      capabilities: p.capabilities,
      plan: p.plan,
      lastTest: null,
      error: p.reason,
      rateLimitWarnings: 0,
      checks: {},
    })),
  ];
}
/** Admin diagnostics can test a documented adapter before it is enabled for end users. */
export async function testProvider(
  provider: string,
  operation: ProviderOperation,
  input: string,
) {
  const p = providerRegistry.find((p) => p.id === provider);
  if (!p) throw new ProviderError("ADAPTER_AWAITING_VERIFIED_SCHEMA", 409);
  const value = await observed(
    p,
    operation,
    () => p[operation](input) as Promise<unknown>,
  );
  return {
    health: (await providerHealth()).find((h) => h.provider === p.id),
    result: value,
  };
}
