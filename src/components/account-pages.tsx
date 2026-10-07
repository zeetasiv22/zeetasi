import { AvatarUpload } from "./avatar-upload";
import Link from "next/link";
import {
  Crown,
  Check,
  ShieldCheck,
  Sparkles,
  Lock,
  ArrowUpRight,
} from "lucide-react";
import { db, configured, currentUser } from "@/lib/supabase/server";
import {
  authenticate,
  forgotPassword,
  resetPassword,
  saveProfile,
  equipAvatar,
  markNotifications,
  clearHistory,
  savePreferences,
  resendVerification,
} from "@/app/actions";
import { googleAvailable } from "@/lib/auth-providers";
import { levelForXp } from "@/lib/domain";
import { EmptyState } from "./catalog-ui";
import { Checkout } from "./small-controls";
export async function AuthPage({ mode }: { mode: string }) {
  const register = mode === "register";
  const forgot = mode === "forgot-password";
  const reset = mode === "reset-password";
  if (mode === "verify-email")
    return (
      <div className="auth-card panel">
        <ShieldCheck className="green" size={38} />
        <h1>Periksa email kamu.</h1>
        <p>
          Buka tautan konfirmasi di browser yang kamu gunakan untuk mendaftar.
          Periksa juga folder spam. Jika tautan lama tidak berfungsi, minta
          tautan baru di bawah.
        </p>
        {configured() && (
          <form action={resendVerification} className="form-stack">
            <label>
              Email
              <input type="email" name="email" autoComplete="email" required />
            </label>
            <button className="button outline full">
              Kirim ulang verifikasi
            </button>
          </form>
        )}
        <Link href="/login" className="button lime">
          Lanjut ke masuk
        </Link>
      </div>
    );
  return (
    <div className="auth-layout">
      <div className="auth-brand">
        <span className="eyebrow">SELAMAT DATANG DI SEMESTAMU</span>
        <h1>
          Cerita hebat.
          <br />
          Dimulai dari <span className="green">kamu.</span>
        </h1>
        <p>
          Simpan tontonan, temukan komunitas,
          <br />
          dan jadikan setiap cerita pengalaman baru.
        </p>
        <div className="orbit-decoration">Z</div>
      </div>
      <div className="auth-card panel">
        <span className="eyebrow">ZETAHUB ACCOUNT</span>
        <h2>
          {register
            ? "Mulai petualanganmu"
            : forgot
              ? "Lupa kata sandi?"
              : reset
                ? "Kata sandi baru"
                : "Senang melihatmu lagi."}
        </h2>
        <p className="muted">
          {register
            ? "Buat akun dan temukan cerita favoritmu."
            : forgot
              ? "Kami akan mengirim tautan pemulihan jika akun tersedia."
              : "Semua hiburanmu menunggu di sini."}
        </p>
        {(register || mode === "login") && (await googleAvailable()) && (
          <Link
            href="/auth/google"
            prefetch={false}
            className="button outline full"
          >
            Lanjutkan dengan Google
          </Link>
        )}
        {configured() ? (
          <form
            className="form-stack"
            action={
              forgot ? forgotPassword : reset ? resetPassword : authenticate
            }
          >
            <input type="hidden" name="mode" value={mode} />
            {!reset && (
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="kamu@email.com"
                  required
                />
              </label>
            )}
            {!forgot && (
              <label>
                Kata sandi
                <input
                  name="password"
                  type="password"
                  autoComplete={
                    register || reset ? "new-password" : "current-password"
                  }
                  minLength={8}
                  maxLength={128}
                  placeholder="Minimal 8 karakter"
                  required
                />
              </label>
            )}
            {mode === "login" && (
              <Link href="/forgot-password" className="text-link">
                Lupa kata sandi?
              </Link>
            )}
            <button className="button lime full">
              {register
                ? "Buat akun"
                : forgot
                  ? "Kirim tautan pemulihan"
                  : reset
                    ? "Simpan kata sandi"
                    : "Masuk ke ZetaHub"}
              <ArrowUpRight size={17} />
            </button>
          </form>
        ) : (
          <p className="notice">
            Supabase belum dikonfigurasi. Administrator perlu mengatur URL dan
            kunci publik.
          </p>
        )}
        <p>
          {register ? "Sudah punya akun?" : "Belum punya akun?"}{" "}
          <Link className="green" href={register ? "/login" : "/register"}>
            {register ? "Masuk" : "Daftar sekarang"}
          </Link>
        </p>
        <small className="muted">
          Dengan melanjutkan, kamu menyetujui{" "}
          <Link href="/terms">Ketentuan</Link> dan{" "}
          <Link href="/privacy">Kebijakan Privasi</Link>.
        </small>
      </div>
    </div>
  );
}
export async function PremiumPage() {
  const s = configured() ? await db() : null;
  const { data: plans } = s
    ? await s
        .from("subscription_plans")
        .select("*")
        .eq("enabled", true)
        .order("price")
    : { data: null };
  return (
    <>
      <div className="premium-intro">
        <span className="premium-tag">
          <Crown size={17} /> ZETAHUB PREMIUM
        </span>
        <h1>
          Ceritamu. <span className="green">Tanpa jeda.</span>
        </h1>
        <p>
          Lebih personal, lebih nyaman, lebih kamu.
          <br />
          Tingkatkan pengalaman ZetaHub dengan keistimewaan ekstra.
        </p>
      </div>
      <div className="plans">
        {plans?.map((p, i) => (
          <div
            className={`plan panel ${i === 1 ? "featured-plan" : ""}`}
            key={p.id}
          >
            {i === 1 && <span className="popular-plan">PILIHAN FAVORIT</span>}
            <Crown size={27} className={i === 1 ? "green" : "gold"} />
            <h2>{p.name}</h2>
            <p className="price">
              Rp{Number(p.price).toLocaleString("id-ID")}
              <small> / {p.days} hari</small>
            </p>
            <p className="muted">
              Satu pembayaran · tanpa perpanjangan otomatis
            </p>
            <ul>
              {[
                "Bebas iklan ZetaHub",
                "Badge premium di profil",
                "Bingkai avatar premium",
                "Personalisasi profil eksklusif",
              ].map((b) => (
                <li key={b}>
                  <Check size={17} />
                  {b}
                </li>
              ))}
            </ul>
            <Checkout
              planId={p.id}
              enabled={!!process.env.MIDTRANS_SERVER_KEY}
            />
          </div>
        ))}
      </div>
      {!process.env.MIDTRANS_SERVER_KEY && (
        <p className="notice">
          Pembayaran belum diaktifkan. Paket di atas adalah konfigurasi awal;
          tidak ada transaksi atau akses berbayar yang dibuat sebelum provider
          dikonfigurasi.
        </p>
      )}
      <div className="panel">
        <h3>Transparan sejak awal.</h3>
        <p className="muted">
          Premium mencakup iklan dan kosmetik ZetaHub. Premium tidak membuka
          episode yang belum memiliki lisensi tayang. Iklan pada layanan
          eksternal mengikuti aturan penyedianya.
        </p>
      </div>
    </>
  );
}
const settingsLinks = [
  ["profile", "Profil"],
  ["account", "Akun"],
  ["privacy", "Privasi"],
  ["notifications", "Notifikasi"],
  ["security", "Keamanan"],
];
export async function AccountPage({ path }: { path: string[] }) {
  const s = await db();
  const user = (await currentUser())!;
  const { data: p } = await s
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  const avatarUrl = p?.avatar_path ? `/api/avatar?user=${user.id}` : null;
  const section = path[0];
  if (section === "settings") {
    const sub = path[1] || "profile";
    const { data: pref } = await s
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    return (
      <>
        <div className="page-heading">
          <span className="eyebrow">RUANG PERSONALMU</span>
          <h1>Pengaturan</h1>
        </div>
        <div className="settings-layout">
          <nav className="settings-nav">
            {settingsLinks.map(([id, name]) => (
              <Link
                className={sub === id ? "active" : ""}
                key={id}
                href={`/settings/${id}`}
              >
                {name}
              </Link>
            ))}
            <Link href="/avatar-editor">Avatar Studio</Link>
          </nav>
          <div className="panel">
            {["profile", "privacy"].includes(sub) ? (
              <>
                <h2>Profil & privasi</h2>
                <form action={saveProfile} className="form-stack">
                  <label>
                    Nama tampilan
                    <input
                      name="display_name"
                      defaultValue={p?.display_name}
                      required
                      minLength={2}
                      maxLength={60}
                    />
                  </label>
                  <label>
                    Username
                    <input
                      name="username"
                      defaultValue={p?.username}
                      required
                      pattern="[a-z0-9_]{3,24}"
                    />
                  </label>
                  <label>
                    Bio
                    <textarea
                      name="bio"
                      defaultValue={p?.bio}
                      maxLength={300}
                    />
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      name="is_public"
                      defaultChecked={p?.is_public}
                    />{" "}
                    Tampilkan profil di publik dan leaderboard
                  </label>
                  <button className="button lime">Simpan perubahan</button>
                </form>
              </>
            ) : sub === "notifications" ? (
              <>
                <h2>Preferensi notifikasi</h2>
                <form action={savePreferences} className="form-stack">
                  {[
                    ["series", "Update serial"],
                    ["community", "Aktivitas komunitas"],
                    ["announcements", "Pengumuman"],
                  ].map(([id, label]) => (
                    <label key={id} className="checkbox">
                      <input
                        type="checkbox"
                        name={id}
                        defaultChecked={pref?.[id]}
                      />
                      {label}
                    </label>
                  ))}
                  <button className="button lime">Simpan preferensi</button>
                </form>
                <p className="notice">
                  Inbox tersedia. Pengiriman email/push belum diaktifkan.
                </p>
              </>
            ) : sub === "security" ? (
              <>
                <h2>Keamanan akun</h2>
                <form action={resetPassword} className="form-stack">
                  <label>
                    Kata sandi baru
                    <input
                      name="password"
                      type="password"
                      minLength={8}
                      required
                      autoComplete="new-password"
                    />
                  </label>
                  <button className="button lime">Ganti kata sandi</button>
                </form>
              </>
            ) : (
              <>
                <h2>Akun</h2>
                <p>{user.email}</p>
                <p className="muted">ID akun: {user.id}</p>
                <Link
                  className="button outline"
                  href="/content-report?target=account-deletion"
                >
                  Ajukan penghapusan akun
                </Link>
                <a
                  download
                  className="button outline"
                  href="/api/account/export"
                >
                  Unduh data akun (JSON)
                </a>
                <p className="notice">
                  Penghapusan akun diproses oleh administrator setelah
                  verifikasi. Unduh salinan data milikmu di bawah ini.
                </p>
              </>
            )}
          </div>
        </div>
      </>
    );
  }
  if (section === "avatar-editor") {
    const { data: items } = await s.from("avatar_items").select("*");
    const { data: equipped } = await s
      .from("user_avatar_equipment")
      .select("frame_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const { data: premium } = await s.rpc("premium", { uid: user.id });
    return (
      <>
        <div className="page-heading">
          <span className="eyebrow">BUKAN SEKADAR AVATAR</span>
          <h1>
            Avatar Studio<span className="green">.</span>
          </h1>
          <p>Tunjukkan siapa kamu. Bangun gayamu sendiri.</p>
        </div>
        <div className="avatar-layout">
          <div className="avatar-preview panel">
            <div
              className="avatar huge"
              style={{
                borderColor: items?.find((i) => i.id === equipped?.frame_id)
                  ?.color,
              }}
            >
              {avatarUrl ? <img src={avatarUrl} alt="Avatar kamu" /> : "Z"}
            </div>
            <h2>{p?.display_name}</h2>
            <span className="chip">
              Level {levelForXp(p?.xp || 0)} · Explorer
            </span>
            <p>
              Bingkai aktif:{" "}
              {items?.find((i) => i.id === equipped?.frame_id)?.name || "Orbit"}
            </p>
          </div>
          <div className="panel">
            <AvatarUpload />
            <h2 style={{ marginTop: 30 }}>Koleksi bingkai</h2>
            <p className="muted">
              Bingkai kosmetik tidak memberikan izin staf.
            </p>
            <div className="avatar-grid">
              {items?.map((i) => {
                const locked =
                  (i.premium && !premium) || (p?.xp || 0) < i.required_xp;
                return (
                  <form action={equipAvatar} key={i.id} className="avatar-item">
                    <input type="hidden" name="item" value={i.id} />
                    <div className="avatar" style={{ borderColor: i.color }}>
                      Z
                    </div>
                    <b>{i.name}</b>
                    <small>
                      {i.premium
                        ? "Premium"
                        : i.required_xp
                          ? `${i.required_xp} XP`
                          : "Gratis"}
                    </small>
                    <button className="button outline" disabled={locked}>
                      {locked ? (
                        <>
                          <Lock size={14} /> Terkunci
                        </>
                      ) : equipped?.frame_id === i.id ? (
                        "Terpasang"
                      ) : (
                        "Pasang"
                      )}
                    </button>
                  </form>
                );
              })}
            </div>
          </div>
        </div>
      </>
    );
  }
  if (section === "watchlist") {
    const { data } = await s
      .from("watchlist_items")
      .select("*")
      .order("created_at", { ascending: false });
    return (
      <>
        <PageHeading
          title="Daftar Saya"
          subtitle="Cerita yang kamu simpan untuk nanti."
        />
        {data?.length ? (
          <div className="catalog-grid">
            {data.map((i) => (
              <Link
                className="poster-card"
                key={i.title_id}
                href={`/title/${i.title_id}`}
              >
                <div className="poster-image">
                  <img src={i.poster} alt={i.title} />
                </div>
                <h3>{i.title}</h3>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="Daftarmu menunggu cerita pertama" />
        )}
      </>
    );
  }
  if (section === "notifications") {
    const { data } = await s
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    return (
      <>
        <PageHeading
          title="Notifikasi"
          subtitle="Update yang berarti untukmu."
        />
        <form action={markNotifications}>
          <button className="button outline">Tandai semua dibaca</button>
        </form>
        {data?.length ? (
          data.map((n) => (
            <article key={n.id} className="panel">
              <span className={n.read_at ? "muted" : "green"}>
                {n.read_at ? "Dibaca" : "Baru"}
              </span>
              <h3>{n.title}</h3>
              <p>{n.body}</p>
            </article>
          ))
        ) : (
          <EmptyState title="Kamu sudah mengikuti semua kabar" />
        )}
      </>
    );
  }
  if (section === "history") {
    const { data } = await s
      .from("watch_progress")
      .select("*,episodes(title)")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    return (
      <>
        <PageHeading
          title="Riwayat Tontonan"
          subtitle="Kembali ke cerita yang belum selesai."
        />
        {data?.length ? (
          <>
            <div className="episode-list">
              {data.map((h) => (
                <Link key={h.episode_id} href={`/watch/${h.episode_id}`}>
                  <PlayIcon />
                  <span>
                    {h.episodes?.title}
                    <small>{Math.floor(h.position)} detik ditonton</small>
                  </span>
                </Link>
              ))}
            </div>
            <form action={clearHistory} className="form-stack panel">
              <label className="checkbox">
                <input type="checkbox" name="confirm" required /> Saya ingin
                menghapus seluruh riwayat progres.
              </label>
              <button className="button outline">Hapus riwayat</button>
            </form>
          </>
        ) : (
          <EmptyState title="Belum ada riwayat" href="/explore" />
        )}
      </>
    );
  }
  if (section === "my-level" || section === "my-titles") {
    const { data: xp } = await s
      .from("xp_transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    const { data: ach } = await s
      .from("user_achievements")
      .select("achievements(name,description)")
      .eq("user_id", user.id);
    const level = levelForXp(p?.xp || 0);
    return (
      <>
        <PageHeading
          title="Setiap Cerita, Satu Langkah"
          subtitle="Nonton. Explore. Level Up."
        />
        <div className="level-panel panel">
          <Sparkles size={36} className="green" />
          <h2>Level {level}</h2>
          <p>
            {p?.xp || 0} XP / {level * level * 100} XP menuju level berikutnya
          </p>
          <progress
            value={(p?.xp || 0) - (level - 1) ** 2 * 100}
            max={(2 * level - 1) * 100}
          />
        </div>
        <h2>Pencapaian</h2>
        {ach?.length ? (
          <pre>{JSON.stringify(ach, null, 2)}</pre>
        ) : (
          <p className="muted">
            Selesaikan episode berizin pertama untuk membuka First Light.
          </p>
        )}
        <h2>Riwayat XP</h2>
        {xp?.map((x) => (
          <div className="list-row" key={x.id}>
            <span>{x.reason}</span>
            <b className="green">
              {x.amount > 0 ? "+" : ""}
              {x.amount} XP
            </b>
          </div>
        ))}
      </>
    );
  }
  if (section === "subscription" || section === "payment-history") {
    const { data } = await s
      .from(section === "subscription" ? "subscriptions" : "payment_events")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    return (
      <>
        <PageHeading
          title={
            section === "subscription" ? "Langganan Saya" : "Riwayat Pembayaran"
          }
          subtitle="Status dari catatan server yang terverifikasi."
        />
        {data?.length ? (
          data.map((x) => (
            <article className="panel" key={x.id}>
              <h3>{x.plan_id || "Premium manual"}</h3>
              <p>Status: {x.status}</p>
              {x.expires_at && (
                <p>
                  Berlaku sampai{" "}
                  {new Date(x.expires_at).toLocaleString("id-ID")}
                </p>
              )}
              {x.amount && <p>Rp{Number(x.amount).toLocaleString("id-ID")}</p>}
            </article>
          ))
        ) : (
          <EmptyState
            title="Belum ada transaksi atau langganan"
            href="/premium"
          />
        )}
      </>
    );
  }
  const { data } = await s
    .from("title_follows")
    .select("title_id")
    .eq("user_id", user.id);
  return (
    <>
      <PageHeading
        title="Serial yang Diikuti"
        subtitle="Tetap dekat dengan cerita favoritmu."
      />
      {data?.length ? (
        data.map((x) => (
          <Link
            className="list-row"
            key={x.title_id}
            href={`/title/${x.title_id}`}
          >
            {x.title_id} <ArrowUpRight size={17} />
          </Link>
        ))
      ) : (
        <EmptyState title="Belum mengikuti serial" />
      )}
    </>
  );
}
function PlayIcon() {
  return <span className="green">▶</span>;
}
export function PageHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="page-heading">
      <span className="eyebrow">YOUR ZETA UNIVERSE</span>
      <h1>
        {title}
        <span className="green">.</span>
      </h1>
      <p>{subtitle}</p>
    </div>
  );
}
