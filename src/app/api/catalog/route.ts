import { NextRequest, NextResponse } from "next/server";
import { animeCatalog, movieCatalog } from "@/lib/catalog";
import { z } from "zod";
export async function GET(req: NextRequest) {
  const parsed = z
    .object({
      q: z.string().max(100).default(""),
      genre: z.string().max(40).optional(),
      year: z.coerce.number().int().min(1940).max(2100).optional(),
      sort: z
        .enum([
          "TRENDING_DESC",
          "POPULARITY_DESC",
          "SCORE_DESC",
          "START_DATE_DESC",
          "SEARCH_MATCH",
        ])
        .default("TRENDING_DESC"),
      page: z.coerce.number().int().min(1).max(100).default(1),
      category: z
        .enum([
          "anime",
          "donghua",
          "movies",
          "tv-series",
          "drama-korea",
          "drama-china",
          "drama-jepang",
          "drama-thailand",
        ])
        .default("anime"),
    })
    .safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Pencarian tidak valid." },
      { status: 400 },
    );
  try {
    const p = parsed.data;
    return NextResponse.json(
      ["anime", "donghua"].includes(p.category)
        ? await animeCatalog({
            ...p,
            sort: p.sort === "SEARCH_MATCH" && !p.q ? "TRENDING_DESC" : p.sort,
            country: p.category === "donghua" ? "CN" : undefined,
          })
        : await movieCatalog(p),
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Katalog tidak tersedia." },
      { status: 503 },
    );
  }
}
