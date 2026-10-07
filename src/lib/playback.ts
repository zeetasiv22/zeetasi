/** Browser-safe contracts. No provider credentials or server configuration here. */
export type ProviderCapability =
  | "CATALOG_ONLY"
  | "METADATA"
  | "EPISODES"
  | "OFFICIAL_WATCH"
  | "AUTHORIZED_EMBED"
  | "DIRECT_MP4"
  | "HLS"
  | "DASH";
export type PlaybackType = "hls" | "dash" | "mp4" | "embed" | "official";
export interface PlaybackSource {
  type: PlaybackType;
  url: string;
  quality?: string;
  language?: string;
  expiresAt?: string;
}
export interface SubtitleTrack {
  url: string;
  language: string;
  label: string;
}
export interface AudioTrack {
  language: string;
  label: string;
}
export interface PlaybackResult {
  available: boolean;
  sources: PlaybackSource[];
  subtitles?: SubtitleTrack[];
  audioTracks?: AudioTrack[];
  provider: string;
  expiresAt?: string;
  error?: string;
}
export const playbackPriority: Record<PlaybackType, number> = {
  hls: 5,
  dash: 4,
  mp4: 3,
  embed: 2,
  official: 1,
};
export function unexpired(source: { expiresAt?: string }, now = Date.now()) {
  return !source.expiresAt || Date.parse(source.expiresAt) > now + 5000;
}
export function playableSources(result: PlaybackResult, now = Date.now()) {
  return result.available && unexpired(result, now)
    ? result.sources
        .filter((s) => unexpired(s, now))
        .sort((a, b) => playbackPriority[b.type] - playbackPriority[a.type])
    : [];
}
export type MediaCategory =
  | "anime"
  | "donghua"
  | "drama-korea"
  | "drama-china"
  | "drama-jepang"
  | "drama-thailand"
  | "movies"
  | "tv-series"
  | "animation"
  | "documentary";
export interface ProviderTitle {
  id: string;
  provider: string;
  providerId: string;
  title: string;
  originalTitle?: string;
  description: string;
  poster: string;
  year: number | null;
  type: "movie" | "series" | "unknown";
  genres: string[];
  countries: string[];
  categories?: MediaCategory[];
  rating?: number;
  externalIds?: Record<string, string>;
  playback: PlaybackResult;
  alternatives?: { id: string; provider: string }[];
}
export interface ProviderEpisode {
  id: string;
  titleId: string;
  providerId: string;
  title: string;
  season: number | null;
  number: number | null;
}
export type ProviderOperation = "search" | "title" | "episodes" | "playback";
export interface ProviderHealth {
  enabled: boolean;
  provider: string;
  name: string;
  host: string;
  status: "healthy" | "degraded" | "down" | "not_configured";
  latency: number | null;
  capabilities: ProviderCapability[];
  plan: string;
  lastTest: string | null;
  error?: string;
  rateLimitWarnings: number;
  checks: Partial<
    Record<ProviderOperation, { pass: boolean; at: string; message: string }>
  >;
}
