"use client";
import { useState, useEffect } from "react";
import { Search, SlidersHorizontal, ArrowRight, ArrowLeft } from "lucide-react";
import { categories, type CatalogTitle } from "@/lib/domain";
import { Poster, EmptyState } from "./catalog-ui";
export function SearchCatalog({
  initialQuery = "",
  initialCategory = "anime",
  initialItems = [],
  initialGenre = "",
  initialResult,
}: {
  initialQuery?: string;
  initialCategory?: string;
  initialItems?: CatalogTitle[];
  initialGenre?: string;
  initialResult?: { items: CatalogTitle[]; hasNext: boolean; total: number };
}) {
  const [q, setQ] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [genre, setGenre] = useState(initialGenre);
  const [year, setYear] = useState("");
  const [sort, setSort] = useState("TRENDING_DESC");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState(initialResult?.items || initialItems);
  const [hasNext, setHasNext] = useState(initialResult?.hasNext || false);
  const [total, setTotal] = useState<number | null>(
    initialResult?.total ?? null,
  );
  const [busy, setBusy] = useState(!initialResult);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    const timer = setTimeout(async () => {
      setBusy(true);
      setError("");
      try {
        if (
          initialResult &&
          q === initialQuery &&
          category === initialCategory &&
          genre === initialGenre &&
          !year &&
          sort === "TRENDING_DESC" &&
          page === 1 &&
          retry === 0
        ) {
          setItems(initialResult.items);
          setHasNext(initialResult.hasNext);
          setTotal(initialResult.total);
          return;
        }
        const res = await fetch(
          `/api/catalog?${new URLSearchParams({ q, category, page: String(page), ...(["anime", "donghua"].includes(category) ? { sort, ...(genre ? { genre } : {}), ...(year ? { year } : {}) } : {}) })}`,
          { signal: c.signal },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setItems(data.items);
        setHasNext(data.hasNext);
        setTotal(data.total);
      } catch (e) {
        if (!c.signal.aborted)
          setError(e instanceof Error ? e.message : "Katalog gagal dimuat.");
      } finally {
        if (!c.signal.aborted) setBusy(false);
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [
    q,
    category,
    page,
    retry,
    genre,
    year,
    sort,
    initialResult,
    initialQuery,
    initialCategory,
    initialGenre,
  ]);
  return (
    <>
      <div className="search-controls">
        <label className="search-large">
          <Search size={22} />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Cerita apa yang kamu cari?"
            aria-label="Pencarian katalog"
            maxLength={100}
          />
        </label>
        <label className="category-select">
          <SlidersHorizontal size={17} />
          <select
            aria-label="Kategori pencarian"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            {categories.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {["anime", "donghua"].includes(category) && (
        <div className="filter-row">
          <label>
            Genre
            <select
              value={genre}
              onChange={(e) => {
                setGenre(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua genre</option>
              {[
                "Action",
                "Adventure",
                "Comedy",
                "Drama",
                "Fantasy",
                "Romance",
                "Sci-Fi",
                "Slice of Life",
                "Sports",
                "Mystery",
                "Supernatural",
              ].map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <label>
            Tahun
            <select
              value={year}
              onChange={(e) => {
                setYear(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua tahun</option>
              {Array.from(
                { length: 30 },
                (_, i) => new Date().getFullYear() + 1 - i,
              ).map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </label>
          <label>
            Urutkan
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
            >
              <option value="TRENDING_DESC">Trending</option>
              <option value="POPULARITY_DESC">Popularitas</option>
              <option value="SCORE_DESC">Rating</option>
              <option value="START_DATE_DESC">Terbaru</option>
              <option value="SEARCH_MATCH">Relevansi judul</option>
            </select>
          </label>
        </div>
      )}
      {busy ? (
        <div className="catalog-grid" aria-label="Memuat katalog">
          {Array.from({ length: 6 }, (_, i) => (
            <div className="skeleton" key={i} />
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="notice">
          <h3>Katalog belum tersedia</h3>
          <p>{error}</p>
          <button
            className="button outline"
            onClick={() => setRetry(retry + 1)}
          >
            Coba lagi
          </button>
        </div>
      ) : (
        <>
          {total !== null && (
            <p className="muted">
              {total.toLocaleString("id-ID")} hasil dari{" "}
              {category === "anime" || category === "donghua"
                ? "AniList"
                : "TMDB"}{" "}
              · Halaman {page}
            </p>
          )}
          <div className="catalog-grid">
            {items.map((item) => (
              <Poster key={item.id} item={item} />
            ))}
          </div>
          {!items.length && (
            <EmptyState
              title="Judul belum ditemukan"
              message="Coba judul alternatif atau kata pencarian yang lebih singkat."
            />
          )}
          <div className="pagination">
            <button
              disabled={page === 1}
              className="button outline"
              onClick={() => setPage(page - 1)}
            >
              <ArrowLeft size={16} /> Sebelumnya
            </button>
            <span>{page}</span>
            <button
              disabled={!hasNext}
              className="button outline"
              onClick={() => setPage(page + 1)}
            >
              Berikutnya <ArrowRight size={16} />
            </button>
          </div>
        </>
      )}
    </>
  );
}
