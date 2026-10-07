import Link from "next/link";
import {
  ArrowRight,
  Star,
  Flame,
  Play,
  Plus,
  ArrowUpRight,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import type { CatalogTitle } from "@/lib/domain";
export function SectionTitle({
  title,
  kicker,
  href = "/explore",
  icon = false,
}: {
  title: string;
  kicker?: string;
  href?: string;
  icon?: boolean;
}) {
  return (
    <div className="section-heading">
      <div>
        {kicker && <span className="eyebrow">{kicker}</span>}
        <h2>
          {icon && <Flame size={20} className="green" />}
          {title}
        </h2>
      </div>
      <Link href={href}>
        Lihat semua <ArrowRight size={15} />
      </Link>
    </div>
  );
}
export function Poster({
  item,
  index,
}: {
  item: CatalogTitle;
  index?: number;
}) {
  return (
    <Link className="poster-card" href={`/title/${item.id}`}>
      <div className="poster-image">
        <img src={item.poster} alt={`Poster ${item.title}`} loading="lazy" />
        {item.score !== null && (
          <span className="rating">
            <Star size={11} fill="currentColor" />
            {item.score.toFixed(1)}
          </span>
        )}
        <span className="poster-type">
          {item.provider === "local"
            ? "VIDEO BERIZIN"
            : item.country === "CN"
              ? "DONGHUA"
              : item.provider === "tmdb"
                ? "FILM & TV"
                : "ANIME"}
        </span>
        <span className="poster-hover">
          <ArrowUpRight size={24} />
        </span>
        {index !== undefined && (
          <span className="rank-number">
            {String(index + 1).padStart(2, "0")}
          </span>
        )}
      </div>
      <h3>{item.title}</h3>
      <p>
        {item.year || "Segera"}
        <span>•</span>
        {item.genres[0] || "Metadata"}
        {item.episodes && (
          <>
            <span>•</span>
            {item.episodes} Ep
          </>
        )}
      </p>
      <small className="muted">Lihat detail & ketersediaan</small>
    </Link>
  );
}
export function PosterRow({
  items,
  ranked = false,
}: {
  items: CatalogTitle[];
  ranked?: boolean;
}) {
  return (
    <div className="poster-row">
      {items.slice(0, 6).map((item, i) => (
        <Poster key={item.id} item={item} index={ranked ? i : undefined} />
      ))}
    </div>
  );
}
export function Hero({ item }: { item: CatalogTitle | undefined }) {
  return (
    <section className="hero">
      <img
        className="hero-backdrop"
        src={item?.banner || "/placeholder.svg"}
        alt=""
        fetchPriority="high"
      />
      <div className="hero-shade" />
      <div className="hero-content">
        <span className="hero-label">
          <span className="status-dot" /> PILIHAN UNTUK EKSPLORASIMU
        </span>
        <div className="hero-tags">
          <span>{item?.country === "CN" ? "DONGHUA" : "ANIME"}</span>
          {item?.genres.slice(0, 2).map((g) => (
            <span key={g}>{g}</span>
          ))}
        </div>
        <h1>{item?.title || "Semua Hiburan, Satu Tempat."}</h1>
        <div className="hero-meta">
          {item?.score && (
            <b>
              <Star size={14} fill="currentColor" />
              {item.score.toFixed(1)}
            </b>
          )}
          <span>{item?.year}</span>
          <span>
            {item?.episodes ? `${item.episodes} Episode` : "Katalog pilihan"}
          </span>
          <span className="quality-label">METADATA</span>
        </div>
        <p>
          {item?.description.slice(0, 180) ||
            "Temukan cerita yang membuatmu ingin menonton satu episode lagi. Anime, donghua, drama, dan film dalam satu semesta."}
          {item && "..."}
        </p>
        <div className="hero-buttons">
          <Link
            href={item ? `/title/${item.id}` : "/explore"}
            className="button lime"
          >
            <Play size={16} fill="currentColor" /> Jelajahi Cerita
          </Link>
          <Link
            href={item ? `/title/${item.id}` : "/explore"}
            className="button glass"
          >
            <Plus size={19} /> Daftar Saya
          </Link>
        </div>
        <div className="hero-bottom">
          <span>SEMESTA BARU, CERITA BARU.</span>
          <Link href="/explore" aria-label="Jelajahi katalog">
            <span className="carousel-dot active" />
            <span className="carousel-dot" />
            <span className="carousel-dot" />
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
export function GenreTiles() {
  return (
    <div className="genre-tiles">
      {[
        ["Action", "⚡", "Adrenalin tanpa batas"],
        ["Fantasy", "✦", "Dunia di luar imajinasi"],
        ["Romance", "♡", "Cerita yang menyentuh"],
        ["Comedy", "☺", "Waktunya tertawa"],
      ].map(([name, icon, text]) => (
        <Link
          href={`/explore?genre=${name}`}
          key={name}
          className={`genre-tile genre-${name.toLowerCase()}`}
        >
          <span>{icon}</span>
          <div>
            <b>{name}</b>
            <small>{text}</small>
          </div>
          <ArrowUpRight size={16} />
        </Link>
      ))}
    </div>
  );
}
export function EmptyState({
  title = "Belum ada di sini",
  message = "Mulai jelajahi dan temukan cerita favoritmu.",
  href = "/explore",
}: {
  title?: string;
  message?: string;
  href?: string;
}) {
  return (
    <div className="empty-state">
      <Sparkles size={28} />
      <h3>{title}</h3>
      <p>{message}</p>
      <Link className="button outline" href={href}>
        Jelajahi <ArrowRight size={15} />
      </Link>
    </div>
  );
}
