import Link from "next/link";
import { reportContent } from "@/app/actions";
import { db, configured } from "@/lib/supabase/server";
import { levelForXp } from "@/lib/domain";
import { PageHeading } from "./account-pages";
import { EmptyState } from "./catalog-ui";
const documents: Record<string, { title: string; paragraphs: string[] }> = {
  about: {
    title: "Semua Hiburan, Satu Tempat.",
    paragraphs: [
      "ZetaHub adalah tempat untuk menjelajahi anime, donghua, drama, dan film. Temukan cerita, simpan daftar pribadi, dan ikut berdiskusi bersama komunitas.",
      "Metadata berasal dari AniList dan TMDB ketika dikonfigurasi. Sebuah judul dalam katalog tidak berarti ZetaHub memiliki hak untuk menayangkannya. Video hanya tersedia jika administrator menambahkan sumber yang memiliki izin.",
    ],
  },
  privacy: {
    title: "Privasi adalah pilihanmu.",
    paragraphs: [
      "ZetaHub menyimpan profil, daftar tontonan, progres video, komentar, preferensi notifikasi, dan catatan transaksi yang diperlukan untuk menjalankan layanan. Kata sandi dikelola oleh Supabase Auth. Kami tidak menyimpan nomor kartu pembayaran.",
      "Profil bersifat privat secara default. Anda dapat mengaktifkan visibilitas publik di Pengaturan → Privasi. Komentar yang Anda kirim bersifat publik. Jangan sertakan informasi pribadi dalam komentar.",
      "Permintaan penghapusan akun dan data dapat diajukan melalui pusat laporan. Riwayat transaksi serta audit tertentu mungkin perlu dipertahankan sesuai kewajiban operasional. Kebijakan retensi dan identitas badan pengelola harus ditetapkan sebelum peluncuran komersial.",
      "Pencarian dikirim ke penyedia metadata sesuai kategori. Player YouTube baru dimuat setelah Anda menekan tombol muat player. YouTube menerima data koneksi dan dapat menggunakan cookie, menampilkan iklan, serta menerapkan kebijakan privasinya. ZetaHub tidak mengambil file video atau subtitle dari YouTube.",
    ],
  },
  terms: {
    title: "Ketentuan & komunitas.",
    paragraphs: [
      "Gunakan ZetaHub secara bertanggung jawab. Jangan melakukan pelecehan, spam, manipulasi XP, atau membagikan materi yang melanggar hak orang lain. Tandai komentar yang mengandung spoiler.",
      "Metadata tidak memberikan hak distribusi. Penggunaan sumber eksternal tunduk pada ketentuan masing-masing penyedia. Premium hanya memberikan manfaat yang tercantum pada paket aktif.",
      "Moderator dapat menyembunyikan konten dan administrator dapat menangguhkan akun sesuai izin. Laporkan dugaan penyalahgunaan melalui pusat laporan.",
      "Dokumen ini merupakan kebijakan awal proyek. Operator harus melengkapi identitas usaha, ketentuan usia, wilayah layanan, dan prosedur sengketa sebelum peluncuran publik.",
    ],
  },
  copyright: {
    title: "Cerita hebat. Hak yang dihormati.",
    paragraphs: [
      "ZetaHub tidak mengambil video dari situs bajakan atau melewati DRM. Poster dan metadata ditampilkan dari API penyedia. Hak cipta tetap pada pemilik masing-masing.",
      "Video Zeta Orbit dibuat khusus sebagai materi uji orisinal dengan dedikasi CC0 1.0. Video ini bukan episode dari judul komersial yang ada di katalog.",
      "Pemegang hak dapat melaporkan materi dengan mencantumkan URL konten, deskripsi karya, bukti kepemilikan atau kewenangan, dan kontak balasan. Gunakan formulir laporan setelah masuk.",
      "Sebelum penggunaan komersial, operator wajib meninjau dan memperoleh persetujuan atau lisensi komersial yang dibutuhkan AniList, TMDB, dan setiap penyedia tayangan.",
    ],
  },
  help: {
    title: "Ada yang bisa kami bantu?",
    paragraphs: [
      "Untuk menyimpan judul, buat akun lalu pilih Daftar Saya pada halaman judul. Ikuti serial untuk mencatat ketertarikan Anda.",
      "Masuk sebelum memutar video jika Anda ingin menyimpan progres. XP diberikan hanya setelah sesi server memenuhi ambang penyelesaian. Memindahkan video langsung ke akhir tidak memberikan XP.",
      "Jika judul menampilkan “Sumber tayang belum tersedia”, metadata sudah tersedia tetapi belum ada video berizin. Premium tidak mengubah ketersediaan lisensi.",
      "Gunakan Lupa kata sandi untuk meminta tautan pemulihan. Pada pengembangan lokal email masuk ke Mailpit; di produksi operator perlu mengonfigurasi pengiriman email Supabase.",
    ],
  },
  contact: {
    title: "Mari bicara.",
    paragraphs: [
      "Ada metadata yang salah, masalah pemutaran, atau usulan perbaikan? Kirim laporan setelah masuk agar tim dapat menindaklanjuti dengan catatan yang jelas.",
      "Kontak bisnis dan dukungan produksi belum ditetapkan oleh operator. Jangan mengirim informasi pembayaran atau kata sandi melalui formulir laporan.",
    ],
  },
};
export function InfoPage({ id, target = "" }: { id: string; target?: string }) {
  if (id === "content-report")
    return (
      <div className="document">
        <PageHeading
          title="Pusat Laporan"
          subtitle="Bantu kami menjaga ruang ini tetap nyaman."
        />
        <form action={reportContent} className="form-stack panel">
          <label>
            Judul, URL, atau ID yang dilaporkan
            <input
              name="target"
              defaultValue={target}
              required
              maxLength={200}
            />
          </label>
          <label>
            Jelaskan masalah
            <textarea name="reason" required minLength={5} maxLength={2000} />
          </label>
          <button className="button lime">Kirim laporan</button>
          <small className="muted">
            Masuk diperlukan. Jangan kirim kata sandi atau informasi kartu.
          </small>
        </form>
      </div>
    );
  const d = documents[id];
  if (!d) return null;
  return (
    <article className="document">
      <span className="eyebrow">ZETAHUB · {id.toUpperCase()}</span>
      <h1>{d.title}</h1>
      {d.paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      <Link href="/content-report" className="button outline">
        Pusat laporan →
      </Link>
    </article>
  );
}
export async function Leaderboard({ period = "all" }: { period?: string }) {
  const selected = ["all", "week", "month"].includes(period) ? period : "all";
  const s = configured() ? await db() : null;
  const { data } = s
    ? await s.rpc("period_leaderboard", { p_period: selected })
    : { data: null };
  const rows: { username: string; display_name: string; xp: number }[] =
    data || [];
  return (
    <>
      <PageHeading
        title="Para Penjelajah Terbaik"
        subtitle={`Leaderboard ${selected === "all" ? "sepanjang waktu" : selected === "week" ? "minggu ini (UTC)" : "bulan ini (UTC)"} · profil publik · XP terverifikasi.`}
      />
      <nav className="admin-nav">
        <Link href="/leaderboard?period=all">Sepanjang waktu</Link>
        <Link href="/leaderboard?period=week">Minggu ini</Link>
        <Link href="/leaderboard?period=month">Bulan ini</Link>
      </nav>
      {rows.length ? (
        <div className="panel">
          {rows.map((p, i) => (
            <Link
              key={p.username}
              href={`/profile/${p.username}`}
              className="list-row"
            >
              <span>
                <b className="green">#{i + 1}</b>　{p.display_name}
              </span>
              <span>
                {selected === "all" && <>Level {levelForXp(p.xp)}　</>}
                <b>{p.xp} XP</b>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Papan peringkat menunggu penjelajah"
          message="Aktifkan profil publik untuk tampil di sini. XP bukan izin administratif."
          href="/settings/privacy"
        />
      )}
    </>
  );
}
export async function PublicProfile({ username }: { username: string }) {
  const s = await db();
  const { data: p } = await s
    .from("profiles")
    .select("username,display_name,bio,xp,created_at")
    .eq("username", username)
    .maybeSingle();
  if (!p)
    return (
      <EmptyState
        title="Profil tidak tersedia"
        message="Profil ini privat atau belum ada."
      />
    );
  return (
    <div className="panel avatar-preview">
      <div className="avatar huge">Z</div>
      <h1>{p.display_name}</h1>
      <p>@{p.username}</p>
      <p>{p.bio}</p>
      <span className="chip">
        Level {levelForXp(p.xp)} · {p.xp} XP
      </span>
      <p>Bergabung {new Date(p.created_at).toLocaleDateString("id-ID")}</p>
    </div>
  );
}
