import Link from "next/link";
import { notFound } from "next/navigation";
import { officialStreams, selectOfficialVideo } from "@/lib/official-streams";
import { youtubeMetadata } from "@/lib/youtube";
import { YouTubePlayer } from "./youtube-player";
import { CommunityPage } from "./content-pages";
export function OfficialStreamCards({ category }: { category?: string }) {
  const sources = officialStreams.filter(
    (source) => !category || source.category === category,
  );
  if (!sources.length) return null;
  return (
    <section className="section-block">
      <h2>Player kanal resmi</h2>
      <p className="muted">
        Pilihan unggahan anime, donghua, drama, dan film untuk dimuat di halaman
        ZetaHub. Pemutaran diperiksa oleh YouTube saat dibuka.
      </p>
      <div className="official-stream-grid">
        {sources.map((source) => (
          <article className="panel" key={source.id}>
            <span className="eyebrow">
              {source.categoryLabel} · {source.channel}
            </span>
            <h3>{source.title}</h3>
            <p>{source.coverage}</p>
            <p className="muted">{source.subtitleNote}</p>
            <Link className="button outline" href={`/streaming/${source.id}`}>
              Buka player & daftar video
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
export async function OfficialStreamPage({
  id,
  video,
}: {
  id: string;
  video?: string;
}) {
  const source = officialStreams.find((item) => item.id === id);
  if (!source) notFound();
  const selected = selectOfficialVideo(source, video);
  const usePlaylist = !!source.playlistId && !video;
  const metadata = await youtubeMetadata(source, selected.id, usePlaylist);
  return (
    <>
      <Link href="/watch-now" className="text-link">
        ← Pilihan tontonan
      </Link>
      <div className="page-heading">
        <span className="eyebrow">
          {source.categoryLabel} · {source.channel}
        </span>
        <h1>{source.title}</h1>
        <p>{source.coverage}</p>
        <p>{source.subtitleNote}</p>
      </div>
      {metadata ? (
        <>
          <p className="muted">
            Unggahan: {metadata.title} · {metadata.author}
          </p>
          <YouTubePlayer
            key={`${selected.id}:${usePlaylist}`}
            videoId={selected.id}
            playlistId={usePlaylist ? source.playlistId : undefined}
            title={metadata.title}
          />
        </>
      ) : (
        <p className="notice" role="alert">
          Unggahan tidak dapat diverifikasi dari kanal sumber saat ini. Coba
          kembali nanti atau pilih video lain.
        </p>
      )}
      <h2>Pilihan video</h2>
      <nav className="episode-list" aria-label="Pilihan video">
        {source.playlistId && (
          <Link href={`/streaming/${source.id}`}>
            Playlist resmi · daftar video di player
          </Link>
        )}
        {source.videos.map((item) => (
          <Link
            key={item.id}
            href={`/streaming/${source.id}?video=${item.id}`}
            aria-current={
              !usePlaylist && selected.id === item.id ? "page" : undefined
            }
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <p className="muted">
        Pemutaran menggunakan YouTube, termasuk batas wilayah, akun, dan iklan
        YouTube. Progres, XP, serta iklan ZetaHub belum dihubungkan ke player
        ini.
      </p>
      <section className="panel">
        <h2>Diskusi</h2>
        <CommunityPage
          target={source.catalogIds[0]}
          inline
          returnTo={`/streaming/${source.id}`}
        />
      </section>
    </>
  );
}
