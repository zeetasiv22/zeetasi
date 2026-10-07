import { NextRequest } from "next/server";
import { searchAllProviders } from "@/server/providers/engine";
import { animeCatalog, movieCatalog } from "@/lib/catalog";
import { categories } from "@/lib/domain";
import type { ProviderTitle, MediaCategory } from "@/lib/playback";
import {
  rankTitles,
  fromCatalogTitle,
} from "@/server/providers/normalizers/title-normalizer";
import { json } from "@/server/providers/http";
export const maxDuration = 30;
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  const category = req.nextUrl.searchParams.get("category") || "";
  if (
    q.length > 100 ||
    (category &&
      ![...categories.map((c) => c[0]), "animation", "documentary"].includes(
        category,
      ))
  )
    return json({ error: "INVALID_QUERY" }, 400);
  const watchable = req.nextUrl.searchParams.get("watchable") === "true";
  const result = await searchAllProviders(
    q,
    (category as MediaCategory) || undefined,
    watchable,
  );
  // Existing catalog remains available, explicitly metadata-only. No fuzzy playback pairing.
  const metadata: ProviderTitle[] = [];
  if (!watchable) {
    const searches = [];
    if (!category || ["anime", "donghua", "animation"].includes(category))
      searches.push(
        animeCatalog({ q, country: category === "donghua" ? "CN" : undefined }),
      );
    if (!category || !["anime", "donghua", "animation"].includes(category))
      searches.push(movieCatalog({ q, category: category || "movies" }));
    if (!category) searches.push(movieCatalog({ q, category: "tv-series" }));
    const fallback = await Promise.allSettled(searches);
    for (const r of fallback)
      if (r.status === "fulfilled")
        for (const t of r.value.items) metadata.push(fromCatalogTitle(t));
    result.failures.push(
      ...fallback.flatMap((r, i) =>
        r.status === "rejected"
          ? [{ provider: `catalog-${i + 1}`, error: "CATALOG_UNAVAILABLE" }]
          : [],
      ),
    );
  }
  return json({
    ...result,
    items: rankTitles(
      [
        ...result.items,
        ...metadata.filter((t) => {
          const origins: Record<string, string> = {
            "drama-korea": "KR",
            "drama-china": "CN",
            "drama-jepang": "JP",
            "drama-thailand": "TH",
          };
          if (origins[category]) return t.countries.includes(origins[category]);
          if (category === "documentary")
            return t.genres.some((g) => g.toLowerCase() === "documentary");
          return true;
        }),
      ],
      q,
    ),
  });
}
