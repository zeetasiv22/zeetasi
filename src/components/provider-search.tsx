"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { categories } from "@/lib/domain";
import { playableSources, type ProviderTitle } from "@/lib/playback";
export function ProviderSearch({
  initialQuery = "",
  initialCategory = "",
}: {
  initialQuery?: string;
  initialCategory?: string;
}) {
  const [query, setQuery] = useState(initialQuery),
    [category, setCategory] = useState(initialCategory),
    [watchable, setWatchable] = useState(false);
  const [items, setItems] = useState<ProviderTitle[]>([]),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [partial, setPartial] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setBusy(true);
      setError("");
      try {
        const r = await fetch(
          `/api/search?${new URLSearchParams({ q: query, category, watchable: String(watchable) })}`,
          { signal: controller.signal },
        );
        if (!r.ok) throw new Error("Pencarian gagal. Coba lagi nanti.");
        const data = await r.json();
        if (controller.signal.aborted) return;
        setItems(data.items);
        setPartial(data.failures.length > 0);
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Pencarian gagal.");
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, 350);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, category, watchable]);
  return (
    <>
      <div className="search-controls">
        <label className="search-large">
          <span aria-hidden>⌕</span>
          <input
            aria-label="Cari judul"
            placeholder="Cari anime, drama, film…"
            value={query}
            maxLength={100}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          Kategori{" "}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Semua kategori</option>
            {[
              ...categories,
              ["animation", "Animation"],
              ["documentary", "Documentary"],
            ].map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={watchable}
            onChange={(e) => setWatchable(e.target.checked)}
          />{" "}
          ▶ Watchable
        </label>
      </div>
      <p className="muted">
        Ketersediaan video diperiksa per episode. “Watch officially” membuka
        layanan resmi.
      </p>
      {busy ? (
        <p role="status">Mencari judul…</p>
      ) : error ? (
        <p role="alert" className="notice">
          {error}
        </p>
      ) : (
        <>
          {partial && (
            <p className="notice">
              Sebagian penyedia belum tersedia. Hasil yang berhasil dimuat tetap
              ditampilkan.
            </p>
          )}
          <div className="catalog-grid">
            {items.map((t) => {
              const sources = playableSources(t.playback);
              return (
                <article key={t.id} className="panel">
                  <Link href={`/title/${t.id}`}>
                    <img
                      src={t.poster}
                      alt={t.title}
                      loading="lazy"
                      style={{
                        width: "100%",
                        aspectRatio: "2/3",
                        objectFit: "cover",
                      }}
                    />
                    <h3>{t.title}</h3>
                  </Link>
                  <p>
                    {t.year || "—"} · {t.provider}
                  </p>
                  <span className="muted">
                    {sources.some((s) => s.type !== "official")
                      ? "▶ Play"
                      : sources.length
                        ? "Watch officially"
                        : "Metadata · playback belum tersedia"}
                  </span>
                  {t.alternatives?.map((a) => (
                    <Link key={a.id} href={`/title/${a.id}`}>
                      Lihat di {a.provider}
                    </Link>
                  ))}
                </article>
              );
            })}
          </div>
          {!items.length && (
            <section className="notice">
              <h2>
                {watchable
                  ? "Belum ada sumber terverifikasi"
                  : "Judul belum ditemukan"}
              </h2>
              <p>
                {watchable
                  ? "Playback unavailable from configured providers. Coba judul lain atau nonaktifkan filter Watchable."
                  : "Coba judul alternatif atau kembali nanti."}
              </p>
            </section>
          )}
        </>
      )}
      {items.some((t) => t.provider === "availability") && (
        <p className="muted">
          Streaming availability information provided by{" "}
          <a href="https://www.movieofthenight.com/about/api">
            Streaming Availability API by Movie of the Night
          </a>
          .
        </p>
      )}
    </>
  );
}
