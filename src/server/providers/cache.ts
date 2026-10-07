import "server-only";
import { createHash } from "node:crypto";
import { providerStore } from "./store";
/** Bounded worker cache with in-flight coalescing. Playback TTL never exceeds the earliest expiry. */
export class ProviderCache {
  private values = new Map<string, { value: unknown; until: number }>();
  private pending = new Map<string, Promise<unknown>>();
  async get<T>(
    key: string,
    ttl: number,
    loader: () => Promise<T>,
    expires?: (value: T) => number,
  ): Promise<T> {
    const entry = this.values.get(key);
    if (entry && entry.until > Date.now())
      return structuredClone(entry.value) as T;
    this.values.delete(key);
    const inflight = this.pending.get(key);
    if (inflight) return structuredClone(await inflight) as T;
    const sharedKey = createHash("sha256").update(key).digest("hex");
    const request = (async () => {
      const db = providerStore();
      if (db) {
        const { data } = await db
          .from("provider_cache")
          .select("payload,expires_at")
          .eq("key", sharedKey)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();
        if (data) {
          if (this.values.size >= 500)
            this.values.delete(this.values.keys().next().value!);
          this.values.set(key, {
            value: data.payload,
            until: Date.parse(data.expires_at),
          });
          return data.payload as T;
        }
      }
      const value = await loader();
      const until = Math.min(Date.now() + ttl, expires?.(value) ?? Infinity);
      if (until > Date.now()) {
        if (this.values.size >= 500)
          this.values.delete(this.values.keys().next().value!);
        this.values.set(key, { value: structuredClone(value), until });
      }
      if (db && until > Date.now()) {
        const { error } = await db.from("provider_cache").upsert({
          key: sharedKey,
          payload: value,
          expires_at: new Date(until).toISOString(),
        });
        if (error) console.warn("[provider-store] CACHE_WRITE_FAILED");
      }
      return value;
    })().finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    return structuredClone(await request);
  }
}
export const providerCache = new ProviderCache();
