import { configureSetting, configurePlan } from "@/app/actions";
import { db } from "@/lib/supabase/server";
export async function SettingsEditor() {
  const s = await db();
  const { data } = await s
    .from("application_settings")
    .select("*")
    .in("key", ["home", "ads", "gamification"]);
  return (
    <div className="panel">
      <h2>Konfigurasi platform</h2>
      <p className="muted">
        home: urutan, judul dan visibilitas bagian. ads.frequency: 0 mematikan
        iklan. gamification.completion_xp: 0–100 XP.
      </p>
      {data?.map((row) => (
        <details key={row.key}>
          <summary>{row.key}</summary>
          <form className="form-stack" action={configureSetting}>
            <input type="hidden" name="key" value={row.key} />
            <label>
              Konfigurasi JSON
              <textarea
                name="payload"
                defaultValue={JSON.stringify(row.value, null, 2)}
                rows={12}
                required
              />
            </label>
            <label>
              Alasan
              <input name="reason" minLength={5} required />
            </label>
            <label className="checkbox">
              <input type="checkbox" name="confirm" required /> Saya telah
              memeriksa konfigurasi.
            </label>
            <button className="button lime">Simpan konfigurasi</button>
          </form>
        </details>
      ))}
    </div>
  );
}
export async function PlanEditor() {
  const s = await db();
  const { data } = await s
    .from("subscription_plans")
    .select("*")
    .order("price");
  return (
    <div className="panel">
      <h2>Konfigurasi paket prabayar</h2>
      {data?.map((p) => (
        <details key={p.id}>
          <summary>
            {p.name} · Rp{Number(p.price).toLocaleString("id-ID")}
          </summary>
          <form action={configurePlan} className="form-stack">
            <input type="hidden" name="id" value={p.id} />
            <label>
              Nama
              <input
                name="name"
                defaultValue={p.name}
                required
                maxLength={70}
              />
            </label>
            <label>
              Harga IDR
              <input
                type="number"
                name="price"
                defaultValue={p.price}
                required
                min={1000}
                max={100000000}
              />
            </label>
            <label>
              Durasi hari
              <input
                type="number"
                name="days"
                defaultValue={p.days}
                required
                min={1}
                max={1825}
              />
            </label>
            <label className="checkbox">
              <input
                name="enabled"
                type="checkbox"
                defaultChecked={p.enabled}
              />{" "}
              Paket aktif
            </label>
            <label>
              Alasan
              <input name="reason" required minLength={5} />
            </label>
            <label className="checkbox">
              <input name="confirm" type="checkbox" required /> Perubahan
              berlaku untuk pembelian baru.
            </label>
            <button className="button lime">Simpan paket</button>
          </form>
        </details>
      ))}
    </div>
  );
}
