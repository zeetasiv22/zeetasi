import { ProviderAdmin } from "./provider-admin";
import { providerHealth } from "@/server/providers/engine";
import { SettingsEditor, PlanEditor } from "./admin-config";
import Link from "next/link";
import { db } from "@/lib/supabase/server";
import { adminSections, adminSchemas } from "@/lib/admin";
import { staffAction, saveAdminRecord, moderate } from "@/app/actions";
import { PageHeading } from "./account-pages";
import { EmptyState } from "./catalog-ui";
import { z } from "zod";
export async function AdminPage({
  path,
  page = 1,
  q = "",
}: {
  path: string[];
  page?: number;
  q?: string;
}) {
  const s = await db();
  const root = path[0];
  const section = path[1];
  const permissions = await Promise.all(
    ["operations", "catalog", "moderate", "roles", "entitlements"].map(
      async (p) => ({ p, allowed: (await s.rpc("can", { p })).data }),
    ),
  );
  const allowed = new Set(permissions.filter((p) => p.allowed).map((p) => p.p));
  if (!allowed.size)
    return (
      <EmptyState
        title="Akses ditolak"
        message="Area ini hanya tersedia bagi staf dengan izin yang ditetapkan."
        href="/"
      />
    );
  if (section === "providers" && allowed.has("operations")) return <ProviderAdmin initial={await providerHealth()} />;
  const def = section ? adminSections[section] : null;
  if (section && (!def || !allowed.has(def.permission)))
    return (
      <EmptyState
        title="Izin tidak tersedia"
        message="Peran Anda tidak memiliki akses ke modul ini."
        href={`/${root}`}
      />
    );
  const keys = Object.keys(adminSections).filter(
    (k) => k !== "playback-sources" && allowed.has(adminSections[k].permission),
  );
  let rows: Record<string, unknown>[] = [];
  let queryError = "";
  if (def) {
    let query = s
      .from(def.table)
      .select("*")
      .range((page - 1) * 25, page * 25 - 1);
    if (q && def.table === "profiles")
      query = query.ilike("username", `%${q.replace(/[%_]/g, "")}%`);
    const { data, error } = await query;
    rows = data || [];
    queryError = error ? "Data tidak dapat dimuat." : "";
  }
  return (
    <>
      <PageHeading
        title={root === "staff" ? "Ruang Staf" : "Pusat Kendali"}
        subtitle="Kelola ZetaHub dengan izin yang terukur dan riwayat perubahan."
      />
      <nav className="admin-nav">
        <Link href={`/${root}`}>Ringkasan</Link>
        {allowed.has("operations") && <Link href={`/${root}/providers`}>Providers</Link>}
        {keys.map((key) => (
          <Link
            key={key}
            href={`/${root}/${key}`}
            className={section === key ? "active" : ""}
          >
            {adminSections[key].label}
          </Link>
        ))}
      </nav>
      {!section ? (
        <AdminOverview />
      ) : (
        <>
          <h2>{def?.label}</h2>
          {["settings", "levels", "ads"].includes(section) && (
            <SettingsEditor />
          )}
          {section === "premium" && <PlanEditor />}
          {section === "integrations" && (
            <div className="panel">
              <p>AniList: tersedia melalui API publik</p>
              <p>
                TMDB:{" "}
                {process.env.TMDB_API_KEY
                  ? "Dikonfigurasi; uji diperlukan"
                  : "Belum dikonfigurasi"}
              </p>
              <p>
                Midtrans:{" "}
                {process.env.MIDTRANS_SERVER_KEY
                  ? "Dikonfigurasi; uji diperlukan"
                  : "Belum dikonfigurasi"}
              </p>
              <p>Supabase: terhubung</p>
              <Link href="/api/health" className="text-link">
                Periksa status layanan →
              </Link>
            </div>
          )}
          {section === "users" && (
            <form className="search-controls">
              <input
                className="panel"
                name="q"
                aria-label="Cari username"
                placeholder="Cari username"
                defaultValue={q}
              />
              <button className="button outline">Cari</button>
            </form>
          )}
          {queryError && <p className="notice error">{queryError}</p>}
          {rows.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {Object.keys(rows[0])
                      .filter((k) => k !== "metadata")
                      .slice(0, 8)
                      .map((k) => (
                        <th key={k}>{k.replaceAll("_", " ")}</th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={String(r.id || r.key || i)}>
                      {Object.keys(rows[0])
                        .filter((k) => k !== "metadata")
                        .slice(0, 8)
                        .map((k) => (
                          <td key={k}>
                            {typeof r[k] === "object"
                              ? JSON.stringify(r[k])
                              : String(r[k] ?? "—")}
                          </td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="notice">Belum ada catatan untuk modul ini.</p>
          )}
          <div className="pagination">
            {page > 1 && (
              <Link
                className="button outline"
                href={`/${root}/${section}?page=${page - 1}&q=${encodeURIComponent(q)}`}
              >
                Sebelumnya
              </Link>
            )}
            <span>Halaman {page}</span>
            {rows.length === 25 && (
              <Link
                className="button outline"
                href={`/${root}/${section}?page=${page + 1}&q=${encodeURIComponent(q)}`}
              >
                Berikutnya
              </Link>
            )}
          </div>
          {["users", "premium", "roles"].includes(section) && (
            <div className="panel">
              <h2>Perubahan akun</h2>
              <form className="form-stack" action={staffAction}>
                <label>
                  ID pengguna
                  <input
                    name="target"
                    required
                    placeholder="UUID akun tujuan"
                  />
                </label>
                <label>
                  Aksi
                  <select name="action">
                    {allowed.has("entitlements") && (
                      <>
                        <option value="grant_premium">Berikan premium</option>
                        <option value="revoke_premium">Cabut premium</option>
                      </>
                    )}
                    {allowed.has("roles") && (
                      <>
                        <option value="role">
                          Ubah peran (user / contributor / moderator / admin)
                        </option>
                        <option value="suspend">Tangguhkan akun</option>
                        <option value="restore">Pulihkan akun</option>
                      </>
                    )}
                    {allowed.has("operations") && (
                      <option value="xp">
                        Penyesuaian XP (maksimal ±1000)
                      </option>
                    )}
                  </select>
                </label>
                <label>
                  Nilai (tanggal ISO, nama peran, atau XP)
                  <input name="value" placeholder="2026-12-31T23:59:59Z" />
                </label>
                <label>
                  Alasan
                  <textarea name="reason" minLength={5} required />
                </label>
                <label className="checkbox">
                  <input type="checkbox" name="confirm" required /> Saya telah
                  memeriksa akun, nilai, dan akibat perubahan ini.
                </label>
                <button className="button lime">Terapkan & catat audit</button>
              </form>
            </div>
          )}
          {["comments", "reports"].includes(section) && (
            <form className="panel form-stack" action={moderate}>
              <h3>Tindakan moderasi</h3>
              <label>
                Jenis
                <select name="kind">
                  <option value="comment">Sembunyikan komentar</option>
                  <option value="report">Selesaikan laporan</option>
                </select>
              </label>
              <label>
                ID catatan
                <input name="id" required />
              </label>
              <label>
                Alasan
                <input name="reason" minLength={5} required />
              </label>
              <button className="button lime">Simpan tindakan</button>
            </form>
          )}
          {adminSchemas[section] && (
            <div className="panel">
              <h2>Tambah / perbarui catatan</h2>
              <p className="muted">
                Editor operasional menggunakan JSON tervalidasi. Semua kolom
                wajib dijelaskan dalam skema berikut.
              </p>
              <details>
                <summary>Skema data</summary>
                <pre>
                  {JSON.stringify(
                    z.toJSONSchema(adminSchemas[section]),
                    null,
                    2,
                  )}
                </pre>
              </details>
              <form action={saveAdminRecord} className="form-stack">
                <input type="hidden" name="section" value={section} />
                <label>
                  Data JSON
                  <textarea
                    name="payload"
                    required
                    rows={12}
                    placeholder={'{ "id": "..." }'}
                  />
                </label>
                <label>
                  Alasan
                  <input name="reason" required minLength={5} />
                </label>
                <label className="checkbox">
                  <input name="confirm" type="checkbox" required /> Saya telah
                  memeriksa perubahan ini.
                </label>
                <button className="button lime">Simpan & catat audit</button>
              </form>
            </div>
          )}
        </>
      )}
    </>
  );
}
async function AdminOverview() {
  const s = await db();
  if ((await s.rpc("can", { p: "operations" })).data) {
    const { data: m, error } = await s.rpc("operational_metrics");
    if (error) return <p className="notice">Metrik tidak tersedia.</p>;
    const metrics = [
      ["accounts", "Akun terdaftar"],
      ["new_accounts_30d", "Registrasi 30 hari"],
      ["active_viewers_24h", "Penonton aktif 24 jam"],
      ["premium", "Premium aktif"],
      ["verified_revenue", "Pendapatan terverifikasi (IDR)"],
      ["completions", "Episode selesai"],
      ["open_reports", "Laporan terbuka"],
      ["failed_jobs", "Job gagal"],
    ];
    return (
      <>
        <div className="stats-grid">
          {metrics.map(([key, label]) => (
            <div className="panel" key={key}>
              <span className="muted">{label}</span>
              <b className="stat-number">
                {Number(m[key]).toLocaleString("id-ID")}
              </b>
            </div>
          ))}
        </div>
        <p className="notice">
          Penonton aktif: akun unik dengan progres dalam 24 jam terakhir.
          Pendapatan: jumlah transaksi berstatus settlement, tidak termasuk
          refund/chargeback. Bukan estimasi penghasilan.
        </p>
      </>
    );
  }

  const tables = [
    ["profiles", "Akun terdaftar"],
    ["catalog_titles", "Judul katalog lokal"],
    ["playback_sources", "Sumber berizin"],
    ["reports", "Laporan terbuka"],
  ] as const;
  const metrics = await Promise.all(
    tables.map(async ([table, label]) => {
      let query = s.from(table).select("*", { count: "exact", head: true });
      if (table === "reports") query = query.eq("status", "open");
      const { count, error } = await query;
      return { label, count: error ? null : count };
    }),
  );
  return (
    <>
      <div className="stats-grid">
        {metrics.map((m) => (
          <div className="panel" key={m.label}>
            <span className="muted">{m.label}</span>
            <b className="stat-number">{m.count ?? "—"}</b>
          </div>
        ))}
      </div>
      <div className="panel">
        <h2>Operasional yang dapat ditelusuri.</h2>
        <p>
          Angka di atas berasal dari database yang dapat diakses peran Anda.
          Katalog lokal mencakup sumber tayang yang dikelola administrator;
          metadata eksternal dimuat langsung dari penyedia.
        </p>
        <Link href="/admin/audit-logs" className="text-link">
          Lihat audit log →
        </Link>
      </div>
    </>
  );
}
