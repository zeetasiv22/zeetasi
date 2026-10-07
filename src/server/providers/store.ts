import "server-only";
import { adminDb } from "@/lib/supabase/server";
import type {
  PlaybackResult,
  ProviderEpisode,
  ProviderHealth,
  ProviderTitle,
} from "@/lib/playback";
export function providerStore() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
    ? adminDb()
    : null;
}
export async function reserveRequest(host: string) {
  const db = providerStore();
  // Production must enforce quotas across instances. Development/unit tests can use the worker budget.
  if (!db) {
    if (process.env.NODE_ENV === "production")
      throw new Error("SHARED_STORE_REQUIRED");
    return true;
  }
  const budget = Number(process.env.RAPIDAPI_MONTHLY_BUDGET || 1000);
  if (!Number.isInteger(budget) || budget < 1 || budget > 1000000)
    throw new Error("INVALID_QUOTA");
  const { data, error } = await db.rpc("reserve_provider_request", {
    p_host: host,
    p_monthly_limit: budget,
  });
  if (error) throw new Error("SHARED_STORE_UNAVAILABLE");
  return data === true;
}
export async function persistHealth(health: ProviderHealth) {
  const db = providerStore();
  if (!db) return;
  const { error } = await db.rpc("record_provider_health", {
    p_provider: health.provider,
    p_health: health,
  });
  if (error) console.warn("[provider-store] HEALTH_WRITE_FAILED");
}
export async function storedHealth(): Promise<ProviderHealth[]> {
  const db = providerStore();
  if (!db) return [];
  const { data, error } = await db.from("external_providers").select("health");
  return error ? [] : (data || []).map((row) => row.health as ProviderHealth);
}
export async function persistTitles(titles: ProviderTitle[]) {
  const db = providerStore();
  if (!db || !titles.length) return;
  const rows = titles.map((t) => ({
    id: t.id,
    provider: t.provider,
    provider_id: t.providerId,
    title: t.title,
    genres: t.genres,
    countries: t.countries,
    metadata: { ...t, playback: undefined },
    updated_at: new Date().toISOString(),
  }));
  const { error } = await db.from("external_titles").upsert(rows);
  if (error) console.warn("[provider-store] TITLES_WRITE_FAILED");
}
export async function persistEpisodes(
  provider: string,
  episodes: ProviderEpisode[],
) {
  const db = providerStore();
  if (!db || !episodes.length) return;
  const { error } = await db.from("external_episodes").upsert(
    episodes.map((e) => ({
      id: e.id,
      provider,
      provider_id: e.providerId,
      title_id: e.titleId,
      metadata: e,
      updated_at: new Date().toISOString(),
    })),
  );
  if (error) console.warn("[provider-store] EPISODES_WRITE_FAILED");
}
export function playbackExpires(result: PlaybackResult) {
  return Math.min(
    Date.now() + 30000,
    ...[result.expiresAt, ...result.sources.map((s) => s.expiresAt)]
      .filter((x): x is string => !!x)
      .map((x) => Date.parse(x) - 5000),
  );
}
export async function persistPlayback(id: string, result: PlaybackResult) {
  const db = providerStore();
  if (!db) return;
  if (!result.available) {
    await db.from("external_playback_sources").delete().eq("episode_ref", id);
    return;
  }
  const { error } = await db.from("external_playback_sources").upsert({
    episode_ref: id,
    provider: result.provider,
    payload: result,
    expires_at: new Date(playbackExpires(result)).toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) console.warn("[provider-store] PLAYBACK_WRITE_FAILED");
}
