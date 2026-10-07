import { messages } from "@/lib/i18n";
import Link from "next/link";
import {
  Search,
  Bell,
  Crown,
  ChevronDown,
  Compass,
  House,
  Bookmark,
  Users,
  ArrowUpRight,
  Play,
  Smartphone,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { currentUser, db } from "@/lib/supabase/server";
import { logout } from "@/app/actions";
import { ThemeToggle, PwaInstall } from "./small-controls";
export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="ZetaHub Beranda">
      <img src="/icon.svg" alt="" width="35" height="35" />
      <span>
        Zeta<span className="green">Hub</span>
        <span className="logo-dot">.</span>
      </span>
    </Link>
  );
}
export async function Header() {
  const copy = messages.id;
  const user = await currentUser();
  let unread = 0;
  if (user) {
    const s = await db();
    const { count } = await s
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null)
      .eq("user_id", user.id);
    unread = count || 0;
  }
  return (
    <>
      <a className="skip-link" href="#main">
        Lewati ke konten
      </a>
      <header className="header">
        <Logo />
        <nav className="desktop-nav" aria-label="Navigasi utama">
          <Link href="/" className="nav-home">
            {copy.home}
          </Link>
          <Link href="/explore">
            {copy.explore} <ChevronDown size={13} />
          </Link>
          <Link href="/watch-now">Siap Ditonton</Link>
          <Link href="/community">{copy.community}</Link>
        </nav>
        <form action="/search" className="header-search">
          <button
            type="submit"
            className="icon-button"
            aria-label="Buka pencarian"
          >
            <Search size={17} />
          </button>
          <input
            name="q"
            aria-label="Cari judul"
            placeholder="Cari anime, drama, film..."
          />
          <kbd>/</kbd>
        </form>
        <div className="header-actions">
          <ThemeToggle />
          <Link
            href="/notifications"
            className="icon-button notification"
            aria-label={`Notifikasi, ${unread} belum dibaca`}
          >
            <Bell size={20} />
            {unread > 0 && <i />}
          </Link>
          <Link className="premium-button" href="/premium">
            <Crown size={16} />
            <span>Premium</span>
          </Link>
          <Link
            className="avatar small"
            href={user ? "/settings/profile" : "/login"}
            aria-label={user ? "Profil saya" : "Masuk"}
          >
            {user ? "Z" : "↗"}
          </Link>
        </div>
      </header>
      <nav className="category-nav" aria-label="Kategori">
        <Link href="/explore">
          <Compass size={15} /> Semua
        </Link>
        <Link href="/anime">Anime</Link>
        <Link href="/donghua">Donghua</Link>
        <Link href="/drama-korea">Drama Korea</Link>
        <Link href="/drama-china">Drama China</Link>
        <Link href="/drama-jepang">Drama Jepang</Link>
        <Link href="/drama-thailand">Drama Thailand</Link>
        <Link href="/movies">Film</Link>
        <Link href="/tv-series">TV Series</Link>
        <Link href="/watchlist" className="nav-watchlist">
          <Bookmark size={15} /> Daftar Saya
        </Link>
      </nav>
      <nav className="bottom-nav" aria-label="Navigasi seluler">
        <Link href="/">
          <House size={21} />
          Beranda
        </Link>
        <Link href="/explore">
          <Compass size={21} />
          Jelajahi
        </Link>
        <Link href="/watchlist">
          <Bookmark size={21} />
          Daftar Saya
        </Link>
        <Link href="/community">
          <Users size={21} />
          Komunitas
        </Link>
        <Link href="/settings/profile">
          <span className="avatar tiny">Z</span>Profil
        </Link>
      </nav>
    </>
  );
}
export function Sidebar() {
  return (
    <aside className="right-sidebar">
      <div className="side-welcome">
        <span className="eyebrow">
          <span className="status-dot" /> YOUR NEXT OBSESSION
        </span>
        <h2>
          Satu tempat.
          <br />
          Banyak cerita.
        </h2>
        <p>
          Temukan dunia baru yang
          <br />
          layak masuk daftar tontonanmu.
        </p>
        <Link href="/explore" className="text-link">
          Mulai eksplorasi <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="mobile-promo">
        <div className="phone">
          <div className="phone-notch" />
          <div className="phone-brand">
            ϟ Zeta<span>Hub</span>
          </div>
          <div className="phone-art">
            <span>
              YOUR WORLD.
              <br />
              <b>UNLIMITED.</b>
            </span>
            <Play size={20} fill="currentColor" />
          </div>
          <div className="phone-caption">Temukan cerita favoritmu</div>
          <div className="phone-cards">
            <i />
            <i />
            <i />
          </div>
          <div className="phone-nav">
            <House size={12} />
            <Compass size={12} />
            <Bookmark size={12} />
          </div>
        </div>
        <span className="floating-pill">
          <Sparkles size={13} /> Hiburan, on the go.
        </span>
        <div className="mobile-promo-copy">
          <Smartphone size={18} />
          <h3>Layar kecil. Cerita besar.</h3>
          <p>Bawa ZetaHub ke mana pun kamu pergi.</p>
          <PwaInstall />
        </div>
      </div>
      <div className="premium-panel">
        <div className="premium-heading">
          <span className="gold">
            <Crown size={23} />
          </span>
          <span>
            ZetaHub <b>PREMIUM</b>
          </span>
        </div>
        <h3>Upgrade pengalamanmu.</h3>
        <p>Lebih personal. Lebih istimewa.</p>
        <ul>
          <li>
            <ShieldCheck size={14} /> Bebas iklan ZetaHub
          </li>
          <li>
            <ShieldCheck size={14} /> Badge & bingkai eksklusif
          </li>
          <li>
            <ShieldCheck size={14} /> Tunjukkan gayamu
          </li>
        </ul>
        <Link className="button lime full" href="/premium">
          Jelajahi Premium <ArrowUpRight size={16} />
        </Link>
      </div>
      <div className="side-note">
        <span className="status-dot" /> Dibangun untuk para penikmat cerita.
        <br />
        <span>Metadata bukan hak siar. Tonton dari sumber berizin.</span>
      </div>
    </aside>
  );
}
export async function Footer() {
  const user = await currentUser();
  return (
    <footer>
      <div>
        <Logo />
        <p>Semua Hiburan, Satu Tempat.</p>
        <small>
          © {new Date().getFullYear()} ZetaHub. Nonton. Explore. Level Up.
        </small>
      </div>
      <nav aria-label="Informasi">
        <Link href="/about">Tentang kami</Link>
        <Link href="/help">Bantuan</Link>
        <Link href="/contact">Kontak</Link>
      </nav>
      <nav aria-label="Legal">
        <Link href="/privacy">Privasi</Link>
        <Link href="/terms">Ketentuan</Link>
        <Link href="/copyright">Hak cipta</Link>
      </nav>
      <div className="footer-meta">
        <a href="https://anilist.co" target="_blank" rel="noreferrer">
          Metadata anime oleh AniList ↗
        </a>
        <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer">
          Metadata film oleh TMDB ↗
        </a>
        <small>
          This product uses the TMDB API but is not endorsed or certified by
          TMDB.
        </small>
        {user && (
          <form action={logout}>
            <button className="text-link">Keluar akun</button>
          </form>
        )}
      </div>
    </footer>
  );
}
