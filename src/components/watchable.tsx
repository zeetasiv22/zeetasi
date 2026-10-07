import { OfficialStreamCards } from "./official-streams";
import Link from "next/link";
import { Play } from "lucide-react";
import { db, configured, currentUser } from "@/lib/supabase/server";
import { openFilm } from "@/lib/open-cinema";
import { VideoPlayer } from "./player";
import { CommunityPage } from "./content-pages";

export async function WatchablePage({ page = 1 }: { page?: number }) {
  const s = configured() ? await db() : null;
  // Inner relationships and their RLS policies include only published episodes and sources accessible to this viewer.
  const result = s
    ? await s
        .from("catalog_titles")
        .select(
          "id,title,description,episodes!inner(id,playback_sources!inner(id))",
          { count: "exact" },
        )
        .eq("published", true)
        .eq("episodes.published", true)
        .eq("episodes.playback_sources.enabled", true)
        .neq("id", openFilm.id)
        .order("id")
        .range((page - 1) * 24, page * 24 - 1)
    : null;
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">PUTAR LANGSUNG DI ZETAHUB</span>
        <h1>
          Siap Ditonton<span className="green">.</span>
        </h1>
        <p>
          Film dengan sumber pemutaran berizin. Katalog anime dan drama memiliki
          ketersediaan terpisah.
        </p>
      </div>
      {page === 1 && <OfficialStreamCards />}
      {page === 1 && (
        <article className="panel">
          <span className="eyebrow">
            FILM PENDEK · 2008 · 10 MENIT 35 DETIK
          </span>
          <h2>{openFilm.title}</h2>
          <p>{openFilm.description}</p>
          <p className="muted">
            {openFilm.attribution} · {openFilm.license}
          </p>
          <Link href="/open-cinema" className="button lime">
            <Play size={18} /> Putar film
          </Link>
        </article>
      )}
      {result?.error && (
        <p className="notice">
          Katalog database belum tersedia. Film terbuka di atas tetap dapat
          diputar tanpa akun.
        </p>
      )}
      {result?.data?.map((item) => (
        <article className="panel" key={item.id}>
          <h2>{item.title}</h2>
          <p>{item.description}</p>
          <Link className="button outline" href={`/title/${item.id}`}>
            Lihat episode
          </Link>
        </article>
      ))}
      <div className="actions-row">
        {page > 1 && (
          <Link href={`/watch-now?page=${page - 1}`}>← Sebelumnya</Link>
        )}
        {(result?.count || 0) > page * 24 && (
          <Link href={`/watch-now?page=${page + 1}`}>Berikutnya →</Link>
        )}
      </div>
    </>
  );
}

export async function OpenCinemaPage() {
  const user = await currentUser();
  const s = configured() ? await db() : null;
  const episode = s
    ? await s
        .from("episodes")
        .select("id")
        .eq("id", openFilm.episodeId)
        .maybeSingle()
    : null;
  const progress =
    user && episode?.data && s
      ? await s
          .from("watch_progress")
          .select("position")
          .eq("user_id", user.id)
          .eq("episode_id", openFilm.episodeId)
          .maybeSingle()
      : null;
  return (
    <>
      <Link href="/watch-now" className="text-link">
        ← Siap Ditonton
      </Link>
      <h1>{openFilm.title}</h1>
      <p>{openFilm.description}</p>
      <VideoPlayer
        key={openFilm.episodeId}
        episodeId={openFilm.episodeId}
        sources={openFilm.sources}
        resume={progress?.data?.position || 0}
        authenticated={!!user && !!episode?.data}
      />
      {!episode?.data && (
        <p className="notice">
          Pemutaran tersedia tanpa akun. Penyimpanan progres menunggu aktivasi
          film ini di database.
        </p>
      )}
      <p>
        {openFilm.attribution} ·{" "}
        <a
          className="text-link"
          href={openFilm.licenseUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {openFilm.license} · sumber lisensi
        </a>
      </p>
      <section className="panel">
        <h2>Diskusi film</h2>
        <CommunityPage target={openFilm.id} inline returnTo="/open-cinema" />
      </section>
    </>
  );
}
