# Deploy ZetaHub ke Render

Arsitektur: **Render Web Service (Next.js)** → **Supabase cloud (Auth, PostgreSQL, Storage)**. Tidak perlu menjalankan Docker/Supabase lokal di Render. Ini aplikasi dengan backend; pilih Web Service, bukan Static Site.

Konfigurasi `render.yaml` memakai instance Free untuk mencoba aplikasi. Baca batas instance pada [dokumentasi Render](https://render.com/docs/free), termasuk kemungkinan spin-down. Pilih paket yang sesuai kebutuhan produksi melalui dashboard. Blueprint tidak membuat layanan berbayar atau scheduler tambahan secara otomatis.

## 1. Siapkan Supabase cloud

1. Buat proyek Supabase milik Anda dan tunggu status siap.
2. Di komputer yang memiliki checkout branch ZetaHub dan Node 24, jalankan:

   ```bash
   npm ci
   npx supabase login
   npx supabase link --project-ref ID_PROYEK_ANDA
   npx supabase db push
   ```

   Login CLI dan password database diisi melalui mekanisme Supabase; jangan masukkan ke Git. Jangan jalankan `db reset` atau `scripts/configure-local.mjs` untuk proyek cloud. Jangan tambahkan `--include-seed` untuk deploy produksi: `seed.sql` berisi data video uji.

3. Buka SQL Editor pada proyek yang sama. Jalankan isi [`supabase/bootstrap.sql`](../supabase/bootstrap.sql) setelah seluruh migrasi selesai (termasuk backfill profil akun yang sudah ada). Skrip ini mengisi konfigurasi awal paket, bingkai, pencapaian, dan beranda tanpa akun atau video demo. Aman dijalankan ulang; konfigurasi yang sudah ada tidak ditimpa.
4. Catat Project URL, public anon/publishable key, dan private service-role/secret key dari dashboard. **Isi private key langsung di Render**, bukan di chat, README, atau GitHub.

Jika ingin menyediakan video uji Zeta Orbit di deploy demo, tambahkan hanya tiga perintah terakhir `supabase/seed.sql` (catalog_titles, episodes, playback_sources) satu kali pada proyek demo setelah bootstrap. Materi tersebut berlisensi CC0 dan ditandai sebagai video uji. Jangan jalankan seluruh seed setelah bootstrap karena record konfigurasi sudah ada.

## 2. Buat Blueprint di Render

Buka [Deploy ZetaHub ke Render](https://render.com/deploy?repo=https://github.com/zeetasiv22/zeetasi/tree/coderabbit/push-changes-to-github/1945a175).

Login ke Render, izinkan akses GitHub jika diminta, dan tinjau layanan `zetahub`. Branch yang dipakai adalah `coderabbit/push-changes-to-github/1945a175`.

Isi empat environment variable wajib:

| Variabel                        | Nilai                                                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`           | URL HTTPS aplikasi yang akan dipakai, tanpa `/` terakhir; misalnya `https://nama-layanan-anda.onrender.com` |
| `NEXT_PUBLIC_SUPABASE_URL`      | Project URL Supabase cloud, misalnya `https://PROJECT_REF.supabase.co`                                      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon/publishable key proyek yang sama                                                                |
| `SUPABASE_SERVICE_ROLE_KEY`     | Private service-role/secret key proyek yang sama; simpan hanya sebagai secret environment di Render         |

Render menampilkan URL layanan yang sebenarnya setelah pembuatan. Jika berbeda dari `NEXT_PUBLIC_APP_URL`, ubah variabel tersebut dan lakukan **Save, rebuild, and deploy** sebelum menguji login atau reset password. Variabel `NEXT_PUBLIC_*` perlu sudah benar saat build; restart saja tidak cukup untuk mengganti nilai yang telah dibundel.

Klik **Deploy Blueprint**. Konfigurasi repo menyediakan:

- Node `24.14.1` dari `.node-version`.
- Build: `npm ci --include=dev && npm run build` (Tailwind/TypeScript tersedia saat build).
- Start: `npm start` (Next.js mendengarkan `0.0.0.0` dan membaca `PORT` dari Render).
- Health check: `/api/health`, yang menguji akses database nyata.
- Auto-deploy dimatikan. Gunakan **Manual Deploy → Deploy latest commit** untuk perubahan berikutnya, atau aktifkan auto-deploy secara sengaja.

Alternatif tanpa Blueprint: **New → Web Service**, pilih repo/branch di atas, runtime Node, Root Directory kosong, build/start/health check sesuai daftar tersebut. Masukkan environment variable dari `render.yaml` melalui dashboard. Buat `CRON_SECRET` acak sendiri jika tidak memakai Blueprint.

## 3. Atur autentikasi

Pada Supabase **Authentication → URL Configuration**:

- Site URL: URL HTTPS Render yang sebenarnya.
- Redirect URLs: `https://URL-ANDA/auth/callback` dan `https://URL-ANDA/auth/callback?next=/reset-password` untuk alur pemulihan yang digunakan aplikasi. Gunakan URL produksi yang spesifik; tinjau allowlist saat pindah domain.

Aktifkan kebijakan konfirmasi email yang diinginkan dan siapkan SMTP produksi. Uji pendaftaran, tautan verifikasi, login, logout, dan pemulihan password dari domain Render. Email lokal Mailpit tidak digunakan di cloud.

Untuk membuat owner pertama, ikuti SQL bootstrap owner pada [panduan deployment](DEPLOYMENT.md#database) setelah memverifikasi UUID akun. Tidak ada endpoint publik untuk mengangkat akun menjadi owner.

## 4. Verifikasi deploy

- Render menyatakan layanan **Live**.
- `https://URL-ANDA/api/health` mengembalikan HTTP 200 dengan `database: true`.
- Beranda dan pencarian AniList terbuka.
- Akun bisa mendaftar/login dan perubahan profil bertahan setelah refresh.
- Avatar dapat diunggah dan ditampilkan kembali.
- Metadata anime tidak dianggap sebagai video yang otomatis bisa dimainkan. Tambahkan sumber berizin melalui admin atau gunakan fixture CC0 pada proyek demo.

Health check tidak menyatakan pembayaran/TMDB siap. Keduanya menampilkan `not-configured` sampai kredensial ditambahkan.

## 5. Integrasi opsional

Tambahkan `TMDB_API_KEY` untuk film/drama. Untuk pembayaran, tambahkan `MIDTRANS_SERVER_KEY` sandbox dan set notification URL Midtrans ke `https://URL-ANDA/api/payments/webhook`. Pertahankan `MIDTRANS_PRODUCTION=false` sampai alur sandbox terverifikasi. Tidak ada transaksi nyata yang dibuat hanya karena deploy sukses.

Blueprint menghasilkan `CRON_SECRET`, tetapi **tidak menjadwalkan job**. Jika diperlukan, atur scheduler terpisah untuk memanggil `/api/jobs` dengan `Authorization: Bearer <CRON_SECRET>`. Entitlement tetap memeriksa tanggal kedaluwarsa pada setiap pembacaan.

## Troubleshooting

- **Build gagal karena modul Tailwind/TypeScript tidak ditemukan:** gunakan `npm ci --include=dev`, bukan install yang menghilangkan devDependencies.
- **Health check 503:** periksa URL/key Supabase cloud, proyek yang belum siap/terjeda, dan apakah migrasi sudah diterapkan. Jangan memasukkan `127.0.0.1:54321` dari Preview.
- **Tidak terdeteksi port:** pakai `npm start`; jangan hardcode port lokal dalam dashboard. Next.js menggunakan `PORT` yang diberikan Render.
- **Paket premium/bingkai kosong:** jalankan `supabase/bootstrap.sql` pada proyek cloud setelah migrasi.
- **Login kembali ke localhost / tautan email salah:** perbaiki `NEXT_PUBLIC_APP_URL`, rebuild, dan cocokkan Site URL/Redirect URLs Supabase.
- **Halaman lambat pada kunjungan pertama:** cek batas spin-down paket instance Anda dan pertimbangkan paket yang sesuai.
- **File avatar hilang saat redeploy:** avatar harus tersimpan di Supabase Storage, bukan filesystem layanan Render. Implementasi ini sudah menggunakan Storage.

## Referensi resmi

- [Deploy Next.js di Render](https://render.com/docs/deploy-nextjs-app)
- [Blueprint YAML](https://render.com/docs/blueprint-spec)
- [Node version](https://render.com/docs/node-version)
- [Port Web Service](https://render.com/docs/web-services#port-binding)
- [Deploy button dan branch](https://render.com/docs/deploy-to-render)

Konfigurasi dan perintah dapat diverifikasi di sandbox, tetapi deploy Render dan autentikasi Supabase cloud belum dianggap berhasil sebelum akun/proyek sebenarnya disiapkan dan URL live diuji.

## Login Google, email, dan admin awal

- **URL Configuration Supabase:** Site URL `https://zetahub.onrender.com`; Redirect URLs `https://zetahub.onrender.com/auth/callback` dan `https://zetahub.onrender.com/auth/callback?next=/reset-password`. Jika memakai domain lain, ganti ketiganya dan `NEXT_PUBLIC_APP_URL`. Supabase dapat jatuh kembali ke Site URL jika redirect tidak masuk allowlist. Tautan email lama perlu diminta ulang.
- **Google:** Supabase Authentication → Sign In / Providers → Google. Aktifkan provider dan isi OAuth Client ID/Secret dari Google Cloud. Di Google Cloud, authorized redirect URI harus URL callback Supabase yang ditampilkan panel provider (`https://PROJECT.supabase.co/auth/v1/callback`), bukan callback aplikasi. Tombol Google hanya tampil ketika endpoint pengaturan Auth mengonfirmasi provider aktif. Penyelesaian login Google memerlukan akun dan persetujuan pengguna; tombol/redirect saja bukan bukti login berhasil.
- **Email:** konfigurasi SMTP produksi pada Supabase jika pengiriman email bawaan dibatasi; tidak ada SMTP lokal pada deploy Render. Jangan mengubah template email menjadi URL localhost; gunakan tautan konfirmasi bawaan Supabase. Gunakan tombol kirim ulang pada `/verify-email` setelah memperbaiki konfigurasi.
- **Migrasi:** memasukkan API key tidak membuat tabel. Terapkan migrasi dan bootstrap sebagaimana langkah 1. `/api/health` melaporkan `schema_missing` jika tabel belum tersedia, `access_denied` untuk kegagalan izin yang diketahui, atau `unavailable` untuk kegagalan lain.
- **Admin awal:** setelah migrasi, operator dapat mengisi `ZETAHUB_BOOTSTRAP_ADMIN=true`, `BOOTSTRAP_ADMIN_EMAIL` dan `BOOTSTRAP_ADMIN_PASSWORD` melalui secret environment Render, lalu deploy. Proses startup menjalankan `scripts/bootstrap-admin.mjs` menggunakan service-role key di server. Skrip memeriksa skema sebelum membuat akun, mengonfirmasi email akun yang ditunjuk operator, memberi peran `admin` (bukan owner), dan mencatat audit sebelum perubahan serta setelah berhasil. Akun yang sudah admin/owner tidak diubah atau direset oleh pengulangan. Hasil log hanya kode status, tidak berisi password. **Hapus/kosongkan variabel bootstrap dan set flag false setelah provisioning selesai.** Ini tidak menyediakan endpoint publik pemberi hak akses.
- **Donghua dan video:** `/donghua` menggunakan data AniList dengan negara `CN`. Metadata judul tidak menyediakan berkas episode. Halaman detail kini menampilkan tautan penyedia streaming dari AniList jika tersedia. Untuk pemutaran di ZetaHub sendiri, tambahkan episode dan sumber MP4/WebM berizin menggunakan panel admin setelah database siap.
