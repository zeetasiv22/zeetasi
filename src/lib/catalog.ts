import "server-only";
import { z } from "zod";
import { streamingLinks, type CatalogTitle } from "./domain";
const aniMedia = z.object({
  id: z.number(),
  title: z.object({
    romaji: z.string().nullable(),
    english: z.string().nullable(),
  }),
  description: z.string().nullable(),
  coverImage: z.object({ extraLarge: z.string() }),
  bannerImage: z.string().nullable(),
  averageScore: z.number().nullable(),
  genres: z.array(z.string()),
  startDate: z.object({ year: z.number().nullable() }),
  countryOfOrigin: z.string(),
  status: z.string().nullable(),
  episodes: z.number().nullable(),
  siteUrl: z.string(),
  externalLinks: z
    .array(
      z.object({
        site: z.string(),
        url: z.string(),
        type: z.string(),
        isDisabled: z.boolean().nullable(),
      }),
    )
    .optional(),
});
const fields =
  "id title{romaji english} description(asHtml:false) coverImage{extraLarge} bannerImage averageScore genres startDate{year} countryOfOrigin status episodes siteUrl";
function normalize(a: z.infer<typeof aniMedia>): CatalogTitle {
  return {
    id: `anilist-${a.id}`,
    provider: "anilist",
    providerId: String(a.id),
    title: a.title.english || a.title.romaji || "Tanpa judul",
    originalTitle: a.title.romaji || undefined,
    description: (a.description || "Sinopsis belum tersedia.").replace(
      /<[^>]*>/g,
      "",
    ),
    poster: a.coverImage.extraLarge,
    banner: a.bannerImage || a.coverImage.extraLarge,
    year: a.startDate.year,
    score: a.averageScore ? a.averageScore / 10 : null,
    genres: a.genres,
    country: a.countryOfOrigin,
    status: a.status || "UNKNOWN",
    episodes: a.episodes,
    url: a.siteUrl,
    playable: false,
    streamingLinks: streamingLinks(a.externalLinks || []),
  };
}
async function fetchProvider(url: string, init: RequestInit = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 300 },
      });
    } catch {
      if (attempt === 2)
        throw new Error(
          "Penyedia tidak dapat dihubungi. Periksa koneksi atau coba lagi.",
        );
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      continue;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      const retry = Number(res.headers.get("retry-after"));
      const delay =
        Number.isFinite(retry) && retry > 0
          ? Math.min(retry * 1000, 2000)
          : 500 * (attempt + 1);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }
    if (!res.ok)
      throw new Error(
        `Penyedia merespons HTTP ${res.status}. Coba kembali nanti.`,
      );
    return res.json();
  }
  throw new Error("Penyedia tidak tersedia.");
}
export async function animeCatalog({
  q = "",
  page = 1,
  sort = "TRENDING_DESC",
  country,
  genre,
  year,
}: {
  q?: string;
  page?: number;
  sort?: string;
  country?: string;
  genre?: string;
  year?: number;
} = {}) {
  const data = await fetchProvider(
    process.env.ANILIST_API_URL || "https://graphql.anilist.co",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query($search:String,$page:Int,$sort:[MediaSort],$country:CountryCode,$genre:String,$year:Int){Page(page:$page,perPage:12){pageInfo{hasNextPage total} media(type:ANIME,isAdult:false,search:$search,sort:$sort,countryOfOrigin:$country,genre:$genre,seasonYear:$year){${fields}}}}`,
        variables: {
          search: q || undefined,
          page,
          sort: [sort],
          country,
          genre: genre || undefined,
          year,
        },
      }),
    },
  );
  const parsed = z
    .object({
      data: z.object({
        Page: z.object({
          pageInfo: z.object({ hasNextPage: z.boolean(), total: z.number() }),
          media: z.array(aniMedia),
        }),
      }),
    })
    .parse(data);
  return {
    items: parsed.data.Page.media.map(normalize),
    hasNext: parsed.data.Page.pageInfo.hasNextPage,
    total: parsed.data.Page.pageInfo.total,
  };
}
const tmdbItem = z.object({
  id: z.number(),
  media_type: z.string().optional(),
  title: z.string().optional(),
  name: z.string().optional(),
  original_title: z.string().optional(),
  overview: z.string().optional(),
  poster_path: z.string().nullable().optional(),
  backdrop_path: z.string().nullable().optional(),
  release_date: z.string().optional(),
  first_air_date: z.string().optional(),
  vote_average: z.number().optional(),
  genre_ids: z.array(z.number()).optional(),
  genres: z.array(z.object({ name: z.string() })).optional(),
  number_of_episodes: z.number().optional(),
});
function normalizeTmdb(
  a: z.infer<typeof tmdbItem>,
  kind: string,
): CatalogTitle {
  return {
    id: `tmdb-${kind}-${a.id}`,
    provider: "tmdb",
    providerId: String(a.id),
    title: a.title || a.name || "Tanpa judul",
    originalTitle: a.original_title,
    description: a.overview || "Sinopsis belum tersedia.",
    poster: a.poster_path
      ? `https://image.tmdb.org/t/p/w500${a.poster_path}`
      : "/placeholder.svg",
    banner: a.backdrop_path
      ? `https://image.tmdb.org/t/p/original${a.backdrop_path}`
      : "/placeholder.svg",
    year:
      Number((a.release_date || a.first_air_date || "").slice(0, 4)) || null,
    score: a.vote_average || null,
    genres: a.genres?.map((g) => g.name) || [],
    country: "",
    status: "Metadata",
    episodes: a.number_of_episodes || null,
    url: `https://www.themoviedb.org/${kind}/${a.id}`,
    playable: false,
  };
}
async function tmdb(path: string, params: Record<string, string> = {}) {
  if (!process.env.TMDB_API_KEY)
    throw new Error(
      "Katalog TMDB belum tersedia. Administrator perlu mengatur TMDB_API_KEY.",
    );
  const query = new URLSearchParams({
    ...params,
    language: "id-ID",
    api_key: process.env.TMDB_API_KEY,
  });
  return fetchProvider(`https://api.themoviedb.org/3/${path}?${query}`);
}
export async function movieCatalog({
  q = "",
  page = 1,
  category = "movies",
}: {
  q?: string;
  page?: number;
  category?: string;
}) {
  const kind = category === "movies" ? "movie" : "tv";
  const country: Record<string, string> = {
    "drama-korea": "KR",
    "drama-china": "CN",
    "drama-jepang": "JP",
    "drama-thailand": "TH",
  };
  const data = z
    .object({
      results: z.array(tmdbItem),
      total_pages: z.number(),
      total_results: z.number(),
    })
    .parse(
      await tmdb(q ? `search/${kind}` : `discover/${kind}`, {
        page: String(page),
        ...(q
          ? { query: q }
          : country[category]
            ? { with_origin_country: country[category] }
            : {}),
      }),
    );
  return {
    items: data.results.map((a) => normalizeTmdb(a, kind)),
    hasNext: page < data.total_pages,
    total: data.total_results,
  };
}
export async function titleDetail(slug: string): Promise<CatalogTitle | null> {
  if (/^anilist-\d+$/.test(slug)) {
    const data = z
      .object({ data: z.object({ Media: aniMedia.nullable() }) })
      .parse(
        await fetchProvider(
          process.env.ANILIST_API_URL || "https://graphql.anilist.co",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: `query($id:Int){Media(id:$id,type:ANIME,isAdult:false){${fields} externalLinks{site url type isDisabled}}}`,
              variables: { id: Number(slug.split("-")[1]) },
            }),
          },
        ),
      );
    return data.data.Media ? normalize(data.data.Media) : null;
  }
  const match = slug.match(/^tmdb-(movie|tv)-(\d+)$/);
  if (match)
    return normalizeTmdb(
      tmdbItem.parse(await tmdb(`${match[1]}/${match[2]}`)),
      match[1],
    );
  return null;
}
