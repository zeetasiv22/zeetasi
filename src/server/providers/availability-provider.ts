import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { providerId } from "./ids";
import { rapidapiRequest, ProviderError } from "./rapidapi-client";
import {
  normalizePlayback,
  publicHttps,
} from "./normalizers/playback-normalizer";
import type { ProviderAdapter } from "./types";
import type { ProviderEpisode, ProviderTitle } from "@/lib/playback";

// Verified against Movie of the Night's official v4 SDK and RapidAPI listing.
// videoLink is a service deep link, NOT a video file or an iframe permission.
const option = z.object({
  link: z.string(),
  quality: z.string().optional(),
  expiresOn: z.number().optional(),
});
const options = z.record(z.string(), z.array(option));
const episodeSchema = z.object({
  title: z.string(),
  airYear: z.number().optional(),
  streamingOptions: options,
});
const showSchema = z.object({
  id: z.string(),
  title: z.string(),
  originalTitle: z.string().optional(),
  overview: z.string(),
  showType: z.enum(["movie", "series"]),
  releaseYear: z.number().optional(),
  firstAirYear: z.number().optional(),
  rating: z.number().optional(),
  imdbId: z.string().optional(),
  tmdbId: z.string().optional(),
  genres: z.array(z.object({ name: z.string() })),
  imageSet: z
    .object({ verticalPoster: z.record(z.string(), z.string()).optional() })
    .optional(),
  streamingOptions: options,
  seasons: z
    .array(
      z.object({
        title: z.string(),
        episodes: z.array(episodeSchema).optional(),
      }),
    )
    .optional(),
});
type Show = z.infer<typeof showSchema>;
const id = "availability",
  host = "streaming-availability.p.rapidapi.com";
function country() {
  const c = process.env.RAPIDAPI_COUNTRY || "id";
  if (!/^[a-z]{2}$/.test(c)) throw new ProviderError("INVALID_COUNTRY");
  return c;
}
export function availabilityPlayback(
  streamingOptions: z.infer<typeof options>,
  region: string,
) {
  return normalizePlayback(
    id,
    {
      sources: (streamingOptions[region] || []).map((o) => ({
        type: "official",
        url: o.link,
        quality: o.quality,
        ...(o.expiresOn
          ? { expiresAt: new Date(o.expiresOn * 1000).toISOString() }
          : {}),
      })),
    },
    ["OFFICIAL_WATCH"],
  );
}
export function availabilityTitle(s: Show, region: string): ProviderTitle {
  return {
    id: providerId(id, s.id),
    provider: id,
    providerId: s.id,
    title: s.title,
    originalTitle: s.originalTitle,
    description: s.overview,
    poster:
      Object.values(s.imageSet?.verticalPoster || {}).find(publicHttps) ||
      "/placeholder.svg",
    year: s.releaseYear || s.firstAirYear || null,
    type: s.showType,
    genres: s.genres.map((g) => g.name),
    countries: [],
    categories: [
      s.showType === "movie" ? "movies" : "tv-series",
      ...s.genres.flatMap((g) =>
        g.name.toLowerCase() === "animation"
          ? ["animation" as const]
          : g.name.toLowerCase() === "documentary"
            ? ["documentary" as const]
            : [],
      ),
    ],
    rating: s.rating,
    externalIds: {
      ...(s.imdbId ? { imdb: s.imdbId } : {}),
      ...(s.tmdbId ? { tmdb: s.tmdbId } : {}),
    },
    playback: availabilityPlayback(s.streamingOptions, region),
  };
}
async function show(value: string) {
  if (!/^[A-Za-z0-9_/-]{1,100}$/.test(value))
    throw new ProviderError("INVALID_ID", 400);
  const parsed = showSchema.safeParse(
    await rapidapiRequest(host, `/shows/${encodeURIComponent(value)}`, {
      country: country(),
      series_granularity: "episode",
    }),
  );
  if (!parsed.success) throw new ProviderError("PROVIDER_SCHEMA_CHANGED");
  return parsed.data;
}
// Internal episode references use returned array positions. They are never converted to a provider video URL.
function episodeKey(
  showId: string,
  season: number,
  number: number,
  title: string,
) {
  return JSON.stringify([showId, season, number, title]);
}
function readEpisodeKey(value: string): [string, number, number, string] {
  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    throw new ProviderError("INVALID_ID", 400);
  }
  const p = z
    .tuple([
      z.string().max(100),
      z.number().int().min(0),
      z.number().int().min(0),
      z.string().max(600),
    ])
    .safeParse(raw);
  if (!p.success) throw new ProviderError("INVALID_ID", 400);
  return p.data;
}
function episodes(s: Show): ProviderEpisode[] {
  const make = (
    title: string,
    season: number,
    number: number,
    identity = title,
  ): ProviderEpisode => {
    const key = episodeKey(
      s.id,
      season,
      number,
      createHash("sha256").update(identity).digest("hex"),
    );
    return {
      id: providerId(id, key),
      providerId: key,
      titleId: providerId(id, s.id),
      title,
      season: null,
      number: null,
    };
  };
  if (s.showType === "movie") return [make(s.title, 0, 0)];
  return (s.seasons || []).flatMap((season, si) =>
    (season.episodes || []).map((ep, ei) =>
      make(
        ep.title,
        si + 1,
        ei + 1,
        JSON.stringify([
          season.title,
          ep.title,
          ep.airYear,
          ep.streamingOptions,
        ]),
      ),
    ),
  );
}
export const availabilityProvider: ProviderAdapter = {
  id,
  name: "Streaming Availability",
  host,
  capabilities: ["METADATA", "EPISODES", "OFFICIAL_WATCH"],
  categories: [
    "anime",
    "donghua",
    "drama-korea",
    "drama-china",
    "drama-jepang",
    "drama-thailand",
    "movies",
    "tv-series",
    "animation",
    "documentary",
  ],
  documentation: "https://docs.movieofthenight.com/",
  plan: "BASIC: 1,000 requests/month (listing checked 2026-10-07)",
  reliability: 0.8,
  async search(query) {
    const parsed = z
      .array(showSchema)
      .max(100)
      .safeParse(
        await rapidapiRequest(host, "/shows/search/title", {
          title: query,
          country: country(),
          series_granularity: "show",
        }),
      );
    if (!parsed.success) throw new ProviderError("PROVIDER_SCHEMA_CHANGED");
    return parsed.data.map((s) => availabilityTitle(s, country()));
  },
  async title(value) {
    return availabilityTitle(await show(value), country());
  },
  async episodes(value) {
    return episodes(await show(value));
  },
  async episode(value) {
    const [sid] = readEpisodeKey(value);
    return (
      episodes(await show(sid)).find((e) => e.providerId === value) || null
    );
  },
  async playback(value) {
    const [sid, season, number] = readEpisodeKey(value);
    const s = await show(sid);
    if (!episodes(s).some((e) => e.providerId === value))
      return {
        available: false,
        sources: [],
        provider: id,
        error: "EPISODE_IDENTITY_CHANGED",
      };
    if (season === 0 && number === 0 && s.showType === "movie")
      return availabilityPlayback(s.streamingOptions, country());
    const ep = s.seasons?.[season - 1]?.episodes?.[number - 1];
    return ep
      ? availabilityPlayback(ep.streamingOptions, country())
      : {
          available: false,
          sources: [],
          provider: id,
          error: "EPISODE_NOT_FOUND",
        };
  },
};
