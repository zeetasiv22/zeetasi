import { homeSchema } from "@/lib/settings";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Play,
  Sparkles,
  MessageSquare,
  ArrowUpRight,
  MonitorPlay,
  Compass,
} from "lucide-react";
import { animeCatalog } from "@/lib/catalog";
import { db, currentUser, configured } from "@/lib/supabase/server";
import {
  Hero,
  PosterRow,
  SectionTitle,
  GenreTiles,
  EmptyState,
} from "./catalog-ui";
import { Sidebar } from "./shell";
export async function Home() {
  const [trending, popular, donghua] = await Promise.allSettled([
    animeCatalog(),
    animeCatalog({ sort: "POPULARITY_DESC" }),
    animeCatalog({ country: "CN", sort: "POPULARITY_DESC" }),
  ]);
  const s = configured() ? await db() : null;
  const { data: row } = s
    ? await s
        .from("application_settings")
        .select("value")
        .eq("key", "home")
        .maybeSingle()
    : { data: null };
  const config = homeSchema.safeParse(row?.value);
  const sections = config.success ? config.data.sections : [];
  const title = (id: string, fallback: string) =>
    sections.find((s) => s.id === id)?.title || fallback;
  const items = trending.status === "fulfilled" ? trending.value.items : [];
  const user = await currentUser();
  const progress: {
    episode_id: string;
    position: number;
    title: string;
    duration: number;
    poster: string;
  }[] = [];
  if (user) {
    const s = await db();
    const { data } = await s
      .from("watch_progress")
      .select("episode_id,position")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(3);
    for (const row of data || []) {
      const { data: e } = await s
        .from("episodes")
        .select("title,duration,title_id")
        .eq("id", row.episode_id)
        .maybeSingle();
      if (!e) continue;
      const { data: t } = await s
        .from("catalog_titles")
        .select("poster")
        .eq("id", e.title_id)
        .maybeSingle();
      progress.push({
        ...row,
        title: e.title,
        duration: e.duration,
        poster: t?.poster || "/placeholder.svg",
      });
    }
  }
  return (
    <div className="home-layout">
      <div className="home-content">
        <Hero item={items[0]} />
        <div className="welcome-strip">
          <div>
            <Sparkles size={15} />
            <b>Nonton. Explore. Level Up.</b>
            <span>Cerita favoritmu berikutnya dimulai di sini.</span>
          </div>
          <Link href="/watch-now">
            Putar film berizin <ArrowRight size={14} />
          </Link>
        </div>
        <HomeSection sections={sections} id="trending">
          <SectionTitle
            title={title("trending", "Trending Sekarang")}
            kicker="SEDANG JADI PERBINCANGAN"
            icon
            href="/explore"
          />
          {items.length ? (
            <PosterRow items={items.slice(0, 6)} ranked />
          ) : (
            <EmptyState
              title="AniList sedang tidak tersedia"
              message="Coba lagi nanti untuk melihat tren terbaru dari penyedia."
            />
          )}
        </HomeSection>
        <HomeSection sections={sections} id="popular">
          <SectionTitle
            title={title("popular", "Anime Populer")}
            kicker="WAJIB MASUK WATCHLIST"
            href="/anime"
          />
          {popular.status === "fulfilled" ? (
            <PosterRow items={popular.value.items} />
          ) : (
            <EmptyState title="Katalog belum tersedia" />
          )}
        </HomeSection>
        <HomeSection sections={sections} id="genres">
          <SectionTitle
            title={title("genres", "Pilih Duniamu")}
            href="/genres"
          />
          <GenreTiles />
        </HomeSection>
        <HomeSection sections={sections} id="continue">
          <SectionTitle
            title={title("continue", "Lanjutkan Petualanganmu")}
            href="/history"
          />
          <div className="continue-row">
            {progress.length ? (
              progress.map((p) => (
                <Link
                  className="continue-card"
                  key={p.episode_id}
                  href={`/watch/${p.episode_id}`}
                >
                  <img src={p.poster} alt="" />
                  <div>
                    <span className="eyebrow">LANJUTKAN MENONTON</span>
                    <h3>{p.title}</h3>
                    <p>Lanjutkan dari {Math.floor(p.position)} detik</p>
                    <progress value={p.position} max={p.duration} />
                  </div>
                  <Play size={22} />
                </Link>
              ))
            ) : (
              <EmptyState
                title="Belum ada tontonan untuk dilanjutkan"
                message="Episode yang kamu tonton akan tersimpan di sini. Jelajahi katalog untuk melihat ketersediaan judul."
              />
            )}
          </div>
        </HomeSection>
        <HomeSection sections={sections} id="donghua">
          <SectionTitle
            title={title("donghua", "Dunia Donghua")}
            kicker="CERITA MELAMPAUI BATAS"
            href="/donghua"
          />
          {donghua.status === "fulfilled" ? (
            <PosterRow items={donghua.value.items} />
          ) : (
            <EmptyState title="Katalog belum tersedia" />
          )}
        </HomeSection>
        <HomeSection
          sections={sections}
          id="community"
          className="community-banner"
        >
          <div className="community-orbit">
            <MessageSquare size={30} />
          </div>
          <div>
            <span className="eyebrow">LEBIH DARI SEKADAR MENONTON</span>
            <h2>{title("community", "Cerita seru, lebih seru dibahas.")}</h2>
            <p>Temukan teman satu frekuensi di komunitas ZetaHub.</p>
          </div>
          <Link href="/community" className="button outline">
            Gabung diskusi <ArrowUpRight size={17} />
          </Link>
        </HomeSection>
        <div className="feature-row">
          <div>
            <MonitorPlay size={21} />
            <span>
              Sumber berizin<small>Jelas asal dan hak tayangnya.</small>
            </span>
          </div>
          <div>
            <Compass size={21} />
            <span>
              Eksplorasi tanpa batas<small>Metadata dari penyedia resmi.</small>
            </span>
          </div>
          <div>
            <Sparkles size={21} />
            <span>
              Jadi versi unikmu<small>Bangun profil dan koleksi.</small>
            </span>
          </div>
        </div>
      </div>
      <Sidebar />
    </div>
  );
}

function HomeSection({
  id,
  children,
  className,
  sections,
}: {
  id: string;
  children: ReactNode;
  className?: string;
  sections: { id: string; title: string; visible: boolean }[];
}) {
  const section = sections.find((s) => s.id === id);
  return (
    <section
      className={className}
      hidden={section?.visible === false}
      style={{
        order:
          2 +
          Math.max(
            0,
            sections.findIndex((s) => s.id === id),
          ),
      }}
    >
      {children}
    </section>
  );
}
