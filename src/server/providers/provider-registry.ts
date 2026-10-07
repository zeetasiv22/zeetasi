import "server-only";
import { availabilityProvider } from "./availability-provider";
import type { ProviderAdapter } from "./types";
import type { ProviderCapability } from "@/lib/playback";
/** Only adapters backed by an inspected schema belong here. No guessed endpoints. */
export const providerRegistry: ProviderAdapter[] = [availabilityProvider];
export function enabledProviders() {
  const verified = (process.env.RAPIDAPI_VERIFIED_PROVIDERS || "")
    .split(",")
    .map((s) => s.trim());
  return process.env.RAPIDAPI_KEY
    ? providerRegistry.filter((p) => verified.includes(p.id))
    : [];
}
export const providerCandidates: {
  id: string;
  name: string;
  host: string;
  capabilities: ProviderCapability[];
  reason: string;
  listing: string;
  plan: string;
}[] = [
  {
    id: "anime-streaming",
    name: "Anime Streaming",
    host: "anime-streaming.p.rapidapi.com",
    capabilities: [],
    reason:
      "Endpoint /watch/{episodeId} documents HLS. Example response absent; real response, playback and permission verification required before adapter implementation.",
    listing:
      "https://rapidapi.com/adarsh.chouhan11/api/anime-streaming/playground",
    plan: "BASIC: 10,000/month; PRO $10/month (2026-10-07)",
  },
  {
    id: "multilang",
    name: "MultiLang Movie & Drama Database",
    host: "multilang-movie-drama-database-api.p.rapidapi.com",
    capabilities: [],
    reason:
      "Documents vid_url and signCookie. Request/response schema, cross-origin CDN authentication, playback rights and browser playback remain unverified.",
    listing:
      "https://rapidapi.com/cyberdeveloper17/api/multilang-movie-drama-database-api/playground",
    plan: "BASIC listed free, 500,000/month; verify current plan and per-second limits",
  },
  {
    id: "gogoanime",
    name: "Gogoanime",
    host: "gogoanime2.p.rapidapi.com",
    capabilities: [],
    reason:
      "Documented stream endpoint; linked source repository unavailable, sample schema and playback rights unverified.",
    listing: "https://rapidapi.com/riimuru/api/gogoanime2/playground",
    plan: "BASIC free; PRO $3/month; quota semantics unverified",
  },
  {
    id: "anime-api",
    name: "Anime API",
    host: "anime-api13.p.rapidapi.com",
    capabilities: [],
    reason:
      "Streaming links claim is not evidence of playable media; response and rights unverified.",
    listing:
      "https://rapidapi.com/abdullahaladnan95/api/anime-api13/playground",
    plan: "BASIC listed free, 500,000/month; verify current limits",
  },
  {
    id: "animeslayer",
    name: "AnimeSlayer API",
    host: "animeslayer-api.p.rapidapi.com",
    capabilities: [],
    reason:
      "Excluded: documented encrypted resolver chain does not establish authorized access or redistribution permission.",
    listing: "https://rapidapi.com/np4abdou1/api/animeslayer-api/playground",
    plan: "BASIC: 5,000/month; PRO $4.99/month (2026-10-07)",
  },
];
