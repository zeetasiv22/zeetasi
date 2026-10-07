import Link from "next/link";
import {
  getProviderTitle,
  getProviderEpisodes,
  getProviderEpisode,
  getPlayback,
} from "@/server/providers/engine";
import { ProviderPlayer } from "./provider-player";
import { EmptyState } from "./catalog-ui";
export async function ProviderTitlePage({ id }: { id: string }) {
  const title = await getProviderTitle(id).catch(() => null);
  if (!title)
    return (
      <EmptyState
        title="Judul belum tersedia"
        message="Provider belum dikonfigurasi atau detail tidak dapat dimuat. Coba kembali nanti."
        href="/search"
      />
    );
  const episodeResult = await Promise.allSettled([getProviderEpisodes(id)]);
  const episodes =
    episodeResult[0].status === "fulfilled" ? episodeResult[0].value : [];
  return (
    <>
      <Link href="/search">← Pencarian</Link>
      <div className="panel">
        <img src={title.poster} alt={title.title} width={180} />
        <h1>{title.title}</h1>
        {title.originalTitle && <p>{title.originalTitle}</p>}
        <p>
          {title.year} · {title.genres.join(" · ")}
          {title.rating !== undefined ? ` · ${title.rating}/100` : ""}
        </p>
        <p>{title.description}</p>
        {episodes[0] && (
          <Link className="button lime" href={`/watch/${episodes[0].id}`}>
            ▶ {title.type === "movie" ? "Play" : "Episode pertama"}
          </Link>
        )}
      </div>
      <section className="panel">
        <h2>{title.type === "movie" ? "Film" : "Episodes"}</h2>
        {episodeResult[0].status === "rejected" && (
          <p role="alert">Daftar episode gagal dimuat. Coba kembali nanti.</p>
        )}
        {episodes.map((ep) => (
          <Link className="button outline" key={ep.id} href={`/watch/${ep.id}`}>
            {ep.season ? `Season ${ep.season} · Episode ${ep.number} · ` : ""}
            {ep.title} ▶
          </Link>
        ))}
        {!episodes.length && (
          <>
            {!title.playback.available && (
              <p>Playback unavailable from configured providers.</p>
            )}
            <ProviderPlayer playback={title.playback} />
          </>
        )}
      </section>
      <Attribution provider={title.provider} />
    </>
  );
}

export async function ProviderWatchPage({ id }: { id: string }) {
  const result = await Promise.all([
    getProviderEpisode(id),
    getPlayback(id),
  ]).catch(() => null);
  if (!result)
    return (
      <EmptyState
        title="Playback unavailable"
        message="Playback unavailable from configured providers."
        href="/search"
      />
    );
  const [episode, playback] = result;
  if (!episode)
    return (
      <EmptyState
        title="Episode tidak ditemukan"
        message="Episode ini tidak tersedia dari provider."
        href="/search"
      />
    );
  return (
    <>
      <Link href={`/title/${episode.titleId}`}>← Kembali ke judul</Link>
      <h1>{episode.title}</h1>
      <ProviderPlayer key={id} playback={playback} />
      <Attribution provider={playback.provider} />
    </>
  );
}

export function Attribution({ provider }: { provider: string }) {
  return provider === "availability" ? (
    <p className="muted">
      Streaming availability information provided by{" "}
      <a
        href="https://www.movieofthenight.com/about/api"
        target="_blank"
        rel="noopener noreferrer"
      >
        Streaming Availability API by Movie of the Night
      </a>
      .
    </p>
  ) : null;
}
