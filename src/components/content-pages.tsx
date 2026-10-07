import { streamForCatalog } from "@/lib/official-streams";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Bookmark,
  Plus,
  Star,
  Play,
  ArrowRight,
  ShieldCheck,
  Heart,
  Trash2,
} from "lucide-react";
import { titleDetail } from "@/lib/catalog";
import {
  db,
  currentUser,
  configured,
  accountStoreReady,
} from "@/lib/supabase/server";
import {
  toggleWatchlist,
  followTitle,
  addComment,
  deleteComment,
  likeComment,
} from "@/app/actions";
import { EmptyState } from "./catalog-ui";
import { VideoPlayer } from "./player";
import type { CatalogTitle } from "@/lib/domain";
export async function TitlePage({
  slug,
  season,
}: {
  slug: string;
  season?: string;
}) {
  let item: CatalogTitle | null | undefined;
  let failure = "";
  try {
    item = await titleDetail(slug);
  } catch {
    failure = "Metadata tidak tersedia.";
  }
  const s = configured() ? await db() : null;
  if (!item && s) {
    const { data } = await s
      .from("catalog_titles")
      .select("*")
      .eq("id", slug)
      .maybeSingle();
    if (data)
      item = {
        ...data,
        id: data.id,
        score: null,
        url: "",
        episodes: null,
        status: "Original",
        provider: "local",
        originalTitle: data.title,
      };
  }
  if (!item) {
    if (failure)
      return (
        <EmptyState
          title="Metadata tidak dapat dimuat"
          message="Penyedia sedang tidak tersedia. Coba kembali nanti."
        />
      );
    notFound();
  }
  const officialStream = streamForCatalog(slug);
  const user = await currentUser();
  const { data: episodes } = s
    ? await s
        .from("episodes")
        .select("id,number,title,duration,playback_sources(id)")
        .eq("title_id", slug)
        .eq("published", true)
        .order("number")
    : { data: [] };
  const firstPlayable = episodes?.find(
    (episode) => episode.playback_sources?.length,
  );
  const { data: saved } =
    user && s
      ? await s
          .from("watchlist_items")
          .select("title_id")
          .eq("user_id", user.id)
          .eq("title_id", slug)
          .maybeSingle()
      : { data: null };
  const { data: following } =
    user && s
      ? await s
          .from("title_follows")
          .select("title_id")
          .eq("user_id", user.id)
          .eq("title_id", slug)
          .maybeSingle()
      : { data: null };
  return (
    <>
      <section
        className="title-hero"
        style={{
          backgroundImage: `linear-gradient(0deg,var(--bg),#05080777),url("${item.banner}")`,
        }}
      >
        <img className="detail-poster" src={item.poster} alt={item.title} />
        <div>
          <span className="eyebrow">
            {item.provider === "local"
              ? "KATALOG ZETAHUB · SUMBER BERIZIN"
              : `METADATA ${item.provider?.toUpperCase()}`}
          </span>
          <h1>{item.title}</h1>
          <p>{item.originalTitle}</p>
          <div className="detail-meta">
            {item.score && (
              <span className="gold">
                <Star size={15} />
                {item.score}
              </span>
            )}
            <span>{item.year}</span>
            {item.genres.map((g: string) => (
              <span className="chip" key={g}>
                {g}
              </span>
            ))}
          </div>
          <div className="actions-row">
            {firstPlayable ? (
              <Link href={`/watch/${firstPlayable.id}`} className="button lime">
                <Play size={17} /> Tonton Sekarang
              </Link>
            ) : officialStream ? (
              <Link
                href={`/streaming/${officialStream.id}`}
                className="button lime"
              >
                <Play size={17} /> Buka player di ZetaHub
              </Link>
            ) : (
              <span className="availability">Sumber tayang belum tersedia</span>
            )}
            <form action={toggleWatchlist}>
              <input type="hidden" name="id" value={slug} />
              <button className="button outline">
                <Bookmark size={17} />
                {saved ? "Hapus dari Daftar" : "Daftar Saya"}
              </button>
            </form>
            <form action={followTitle}>
              <input type="hidden" name="id" value={slug} />
              <button className="button outline">
                <Plus size={17} />
                {following ? "Berhenti mengikuti" : "Ikuti serial"}
              </button>
            </form>
          </div>
        </div>
      </section>
      <div className="detail-columns">
        <section>
          <h2>Sinopsis</h2>
          <p className="synopsis">{item.description}</p>
          <h2>{season ? `Season ${season}` : "Episode tersedia"}</h2>
          {officialStream && (
            <div className="panel">
              <h3>{officialStream.channel}</h3>
              <p>{officialStream.coverage}</p>
              <Link
                href={`/streaming/${officialStream.id}`}
                className="button outline"
              >
                Player & pilihan video
              </Link>
            </div>
          )}
          {episodes?.length ? (
            <div className="episode-list">
              {episodes.map((e) => (
                <Link key={e.id} href={`/watch/${e.id}`}>
                  <span className="episode-number">
                    {String(e.number).padStart(2, "0")}
                  </span>
                  <span>
                    <b>{e.title}</b>
                    <small>
                      {Math.ceil(e.duration / 60)} menit ·{" "}
                      {e.playback_sources?.length
                        ? "Putar di ZetaHub"
                        : "Video belum tersedia"}
                    </small>
                  </span>
                  <Play size={20} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="notice">
              <ShieldCheck size={21} />
              <p>
                {item.episodes
                  ? `${item.episodes} episode tercatat di penyedia metadata. `
                  : ""}
                {officialStream
                  ? "Gunakan player kanal resmi di atas untuk unggahan yang telah ditemukan."
                  : "Episode belum terhubung ke sumber video di ZetaHub."}
              </p>
            </div>
          )}
          {item.url && (
            <a
              className="text-link"
              href={item.url}
              target="_blank"
              rel="noreferrer"
            >
              Lihat sumber metadata resmi <ArrowRight size={15} />
            </a>
          )}
        </section>
        <section>
          <h2>Diskusi judul</h2>
          <CommunityPage target={slug} inline returnTo={`/title/${slug}`} />
        </section>
      </div>
    </>
  );
}
export async function CommentForm({
  target = "community",
  returnTo = "/community",
}: {
  target?: string;
  returnTo?: string;
}) {
  if (!(await accountStoreReady()))
    return (
      <p className="notice" role="status">
        Komentar belum tersedia: database akun belum siap.
      </p>
    );
  if (!(await currentUser()))
    return (
      <p className="notice">
        <Link href="/login" className="text-link">
          Masuk untuk mengirim komentar
        </Link>
      </p>
    );
  return (
    <form action={addComment} className="form-stack">
      <input type="hidden" name="target" value={target} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <label>
        Bagikan pendapatmu
        <textarea
          name="body"
          placeholder="Apa yang paling berkesan untukmu?"
          required
          minLength={2}
          maxLength={2000}
        />
      </label>
      <label className="checkbox">
        <input type="checkbox" name="spoiler" /> Mengandung spoiler
      </label>
      <button className="button lime">Kirim komentar</button>
      <small className="muted">
        Jaga percakapan tetap ramah. Masuk diperlukan untuk mengirim.
      </small>
    </form>
  );
}
export async function CommunityPage({
  target = "community",
  inline = false,
  returnTo,
}: {
  target?: string;
  inline?: boolean;
  returnTo?: string;
}) {
  const destination =
    returnTo || `/community?target=${encodeURIComponent(target)}`;
  const s = configured() ? await db() : null;
  const user = await currentUser();
  const parentId = target.startsWith("comment:") ? target.slice(8) : null;
  const parent =
    parentId && s
      ? (
          await s
            .from("comments")
            .select("body,spoiler")
            .eq("id", parentId)
            .eq("removed", false)
            .maybeSingle()
        ).data
      : null;
  const { data, error } = s
    ? await s
        .from("comments")
        .select("id,user_id,body,spoiler,created_at,comment_likes(count)")
        .eq("target", target)
        .eq("removed", false)
        .order("created_at", { ascending: false })
        .limit(30)
    : { data: null, error: { message: "unconfigured" } };
  return (
    <>
      {!inline && (
        <div className="page-heading">
          <span className="eyebrow">TEMUKAN TEMAN SATU FREKUENSI</span>
          <h1>
            Ruang Komunitas<span className="green">.</span>
          </h1>
          <p>Cerita, teori, dan rekomendasi. Semua lebih seru bersama.</p>
        </div>
      )}
      {parent && (
        <div className="panel">
          <h2>Diskusi</h2>
          {parent.spoiler ? (
            <details>
              <summary>Tampilkan spoiler</summary>
              <p>{parent.body}</p>
            </details>
          ) : (
            <p>{parent.body}</p>
          )}
        </div>
      )}
      <div className={inline ? "" : "community-layout"}>
        <div>
          <div className="panel">
            <CommentForm target={target} returnTo={destination} />
          </div>
          {error ? (
            <p className="notice" role="alert">
              La­yanan komentar belum tersedia. Coba kembali setelah koneksi
              database pulih.
            </p>
          ) : data?.length ? (
            data.map((c) => (
              <article className="comment panel" key={c.id}>
                <div className="comment-header">
                  <Link
                    className="avatar small"
                    href={`/community/${c.id}`}
                    aria-label="Buka diskusi"
                  >
                    Z
                  </Link>
                  <b>{c.user_id === user?.id ? "Kamu" : "Anggota ZetaHub"}</b>
                  <time>
                    {new Date(c.created_at).toLocaleDateString("id-ID")}
                  </time>
                </div>
                {c.spoiler ? (
                  <details>
                    <summary>Berisi spoiler · Klik untuk melihat</summary>
                    <p>{c.body}</p>
                  </details>
                ) : (
                  <p>{c.body}</p>
                )}
                <div className="actions-row">
                  <form action={likeComment}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="returnTo" value={destination} />
                    <button className="text-link">
                      <Heart size={15} />
                      {c.comment_likes?.[0]?.count || 0} Suka
                    </button>
                  </form>
                  <Link
                    className="muted"
                    href={`/content-report?target=${c.id}`}
                  >
                    Laporkan
                  </Link>
                  {user?.id === c.user_id && (
                    <form action={deleteComment}>
                      <input type="hidden" name="id" value={c.id} />
                      <input
                        type="hidden"
                        name="returnTo"
                        value={destination}
                      />
                      <button className="text-link">
                        <Trash2 size={14} /> Hapus
                      </button>
                    </form>
                  )}
                </div>
              </article>
            ))
          ) : (
            <EmptyState
              title="Mulai percakapan pertama"
              message="Bagikan rekomendasi atau bahas cerita favoritmu."
              href="/explore"
            />
          )}
        </div>
        {!inline && (
          <aside className="panel">
            <h3>Rumah untuk semua penggemar.</h3>
            <p className="muted">
              Hormati perbedaan pendapat, tandai spoiler, dan jangan bagikan
              tautan konten tanpa izin.
            </p>
            <Link href="/terms" className="text-link">
              Panduan komunitas →
            </Link>
          </aside>
        )}
      </div>
    </>
  );
}
export async function WatchPage({ id }: { id: string }) {
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await db();
  const { data: e } = await s
    .from("episodes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!e) notFound();
  const user = await currentUser();
  const { data: sources } = await s
    .from("playback_sources")
    .select("id,url,license,height")
    .eq("episode_id", id)
    .eq("enabled", true)
    .order("height", { ascending: false, nullsFirst: false });
  const source = sources?.[0];
  const { data: subtitles, error: subtitleError } = await s
    .from("episode_subtitles")
    .select("id,url,language,label")
    .eq("episode_id", id)
    .eq("enabled", true)
    .order("language");
  const { data: progress } = user
    ? await s
        .from("watch_progress")
        .select("position")
        .eq("episode_id", id)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };
  const { data: others } = await s
    .from("episodes")
    .select("id,number")
    .eq("title_id", e.title_id)
    .order("number");
  return (
    <>
      <Link className="text-link" href={`/title/${e.title_id}`}>
        ← Kembali ke judul
      </Link>
      <h1>{e.title}</h1>
      <p className="muted">
        Episode {e.number} · {source?.license || "Sumber tidak tersedia"}
      </p>
      {source ? (
        <VideoPlayer
          key={id}
          episodeId={id}
          sources={sources || []}
          subtitles={subtitles || []}
          resume={progress?.position || 0}
          authenticated={!!user}
        />
      ) : (
        <EmptyState
          title="Pemutaran belum tersedia"
          message="Masuk atau periksa status sumber berizin untuk episode ini."
          href="/login"
        />
      )}
      {subtitleError && (
        <p className="notice">Daftar subtitle belum dapat dimuat.</p>
      )}
      <div className="actions-row">
        {others
          ?.filter((o) => Math.abs(o.number - e.number) === 1)
          .map((o) => (
            <Link className="button outline" key={o.id} href={`/watch/${o.id}`}>
              {o.number < e.number
                ? "← Episode sebelumnya"
                : "Episode berikutnya →"}
            </Link>
          ))}
        <Link href={`/content-report?target=${id}`} className="text-link">
          Laporkan masalah pemutaran
        </Link>
      </div>
      <section className="panel">
        <h2>Diskusi episode</h2>
        <CommunityPage target={id} inline returnTo={`/watch/${id}`} />
      </section>
    </>
  );
}
