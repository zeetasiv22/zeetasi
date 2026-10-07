import {
  playbackPriority,
  playableSources,
  type ProviderTitle,
} from "@/lib/playback";
const clean = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
export function rankTitles(
  items: ProviderTitle[],
  query: string,
  reliability: Record<string, number> = {},
) {
  const score = (t: ProviderTitle) => {
    const q = clean(query),
      name = clean(t.title),
      words = q.split(" ");
    return (
      (name === q
        ? 1000
        : (words.filter((w) => name.includes(w)).length /
            Math.max(1, words.length)) *
          100) +
      Math.max(
        0,
        ...playableSources(t.playback).map((s) => playbackPriority[s.type]),
      ) *
        100 +
      (reliability[t.provider] || 0) * 10 +
      (t.year || 0) / 10000
    );
  };
  const result: ProviderTitle[] = [];
  for (const title of [...items].sort((a, b) => score(b) - score(a))) {
    // Stable IDs only. Equal-looking names do not establish the same show/edition.
    const duplicate = result.find(
      (t) =>
        t.id === title.id ||
        (t.type === title.type &&
          Object.entries(title.externalIds || {}).some(
            ([namespace, value]) =>
              value && t.externalIds?.[namespace] === value,
          )),
    );
    if (duplicate) {
      if (duplicate.id !== title.id)
        (duplicate.alternatives ||= []).push({
          id: title.id,
          provider: title.provider,
        });
    } else
      result.push({ ...title, alternatives: [...(title.alternatives || [])] });
  }
  return result;
}

export function fromCatalogTitle(
  t: import("@/lib/domain").CatalogTitle,
): ProviderTitle {
  return {
    id: t.id,
    provider: t.provider,
    providerId: t.providerId,
    title: t.title,
    originalTitle: t.originalTitle,
    description: t.description,
    poster: t.poster,
    year: t.year,
    type: t.id.startsWith("tmdb-movie-")
      ? "movie"
      : t.id.startsWith("tmdb-tv-")
        ? "series"
        : "unknown",
    genres: t.genres,
    countries: t.country ? [t.country] : [],
    rating: t.score !== null ? t.score * 10 : undefined,
    ...(t.provider === "tmdb"
      ? {
          externalIds: {
            tmdb: t.id.startsWith("tmdb-movie-")
              ? `movie/${t.providerId}`
              : `tv/${t.providerId}`,
          },
        }
      : {}),
    playback: { available: false, sources: [], provider: t.provider },
  };
}
