import { z } from "zod";
import {
  playbackPriority,
  type PlaybackResult,
  type ProviderCapability,
} from "@/lib/playback";
/** A URL field alone is never evidence of video. Adapters must supply a documented type. */
export function publicHttps(value: string) {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      u.hostname.includes(".") &&
      !/^(\d+\.){3}\d+$/.test(u.hostname) &&
      !u.hostname.includes(":") &&
      !/(^|\.)(localhost|local|internal|test|invalid)$/.test(u.hostname)
    );
  } catch {
    return false;
  }
}
const sourceSchema = z.object({
  type: z.enum(["hls", "dash", "mp4", "embed", "official"]),
  url: z.string().max(8192).refine(publicHttps),
  quality: z.string().max(80).optional(),
  language: z.string().max(40).optional(),
  expiresAt: z.iso.datetime({ offset: true }).optional(),
});
const subtitleSchema = z.object({
  url: z.string().max(8192).refine(publicHttps),
  language: z.string().min(1).max(40),
  label: z.string().min(1).max(80),
});
const capabilities = {
  hls: "HLS",
  dash: "DASH",
  mp4: "DIRECT_MP4",
  embed: "AUTHORIZED_EMBED",
  official: "OFFICIAL_WATCH",
} as const;
export function normalizePlayback(
  provider: string,
  input: unknown,
  allowed: ProviderCapability[],
  embedHosts: string[] = [],
  now = Date.now(),
): PlaybackResult {
  const raw = z
    .object({
      sources: z.array(z.unknown()).max(30),
      subtitles: z.array(z.unknown()).max(50).optional(),
      audioTracks: z
        .array(
          z.object({
            language: z.string().min(1).max(40),
            label: z.string().min(1).max(80),
          }),
        )
        .max(50)
        .optional(),
      expiresAt: z.iso.datetime({ offset: true }).optional(),
    })
    .safeParse(input);
  if (!raw.success)
    return {
      available: false,
      sources: [],
      provider,
      error: "PROVIDER_SCHEMA_CHANGED",
    };
  const expiry = raw.data.expiresAt;
  if (expiry && Date.parse(expiry) <= now + 5000)
    return { available: false, sources: [], provider, error: "SOURCE_EXPIRED" };
  const seen = new Set<string>();
  const sources = raw.data.sources
    .flatMap((value) => {
      const parsed = sourceSchema.safeParse(value);
      if (!parsed.success) return [];
      const s = parsed.data;
      if (
        !allowed.includes(capabilities[s.type]) ||
        (s.expiresAt && Date.parse(s.expiresAt) <= now + 5000)
      )
        return [];
      if (s.type === "embed" && !embedHosts.includes(new URL(s.url).hostname))
        return [];
      if (seen.has(s.url)) return [];
      seen.add(s.url);
      return [s];
    })
    .sort((a, b) => playbackPriority[b.type] - playbackPriority[a.type]);
  const subtitles = (raw.data.subtitles || []).flatMap((s) => {
    const p = subtitleSchema.safeParse(s);
    return p.success ? [p.data] : [];
  });
  return {
    available: sources.length > 0,
    sources,
    subtitles,
    ...(raw.data.audioTracks ? { audioTracks: raw.data.audioTracks } : {}),
    provider,
    ...(expiry ? { expiresAt: expiry } : {}),
    ...(!sources.length ? { error: "PLAYBACK_UNAVAILABLE" } : {}),
  };
}
