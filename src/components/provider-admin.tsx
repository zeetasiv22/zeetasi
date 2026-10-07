"use client";
import { useState } from "react";
import type {
  PlaybackResult,
  ProviderHealth,
  ProviderOperation,
} from "@/lib/playback";
import { ProviderPlayer } from "./provider-player";
export function ProviderAdmin({ initial }: { initial: ProviderHealth[] }) {
  const [providers, setProviders] = useState(initial),
    [input, setInput] = useState(""),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [playback, setPlayback] = useState<PlaybackResult | null>(null);
  async function test(provider: string, operation: ProviderOperation) {
    setBusy(`${provider}:${operation}`);
    setMessage("Menguji respons provider…");
    setPlayback(null);
    try {
      const r = await fetch("/api/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, operation, input }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Pengujian gagal");
      setProviders((prev) =>
        prev.map((p) => (p.provider === provider ? data.health : p)),
      );
      const pass = data.health?.checks?.[operation]?.pass;
      setMessage(
        `${operation.toUpperCase()}: ${pass ? "PASS" : "FAIL"} — ${operation === "playback" ? "Validasi source; video baru terverifikasi setelah benar-benar diputar." : "Respons diperiksa."}`,
      );
      if (operation === "playback") setPlayback(data.result);
      else
        setMessage(
          (m) =>
            `${m}\n${JSON.stringify(data.result, null, 2).slice(0, 18000)}`,
        );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Pengujian gagal");
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <h1>Provider diagnostics</h1>
      <div className="panel">
        <p>
          Total: {providers.length} · Active:{" "}
          {providers.filter((p) => p.enabled).length} · Playback providers:{" "}
          {
            providers.filter((p) =>
              p.capabilities.some((c) =>
                ["HLS", "DASH", "DIRECT_MP4", "AUTHORIZED_EMBED"].includes(c),
              ),
            ).length
          }{" "}
          · Catalog providers:{" "}
          {
            providers.filter(
              (p) =>
                p.capabilities.includes("METADATA") ||
                p.capabilities.includes("CATALOG_ONLY"),
            ).length
          }{" "}
          · Failed:{" "}
          {
            providers.filter((p) => ["down", "degraded"].includes(p.status))
              .length
          }{" "}
          · Rate limit warnings:{" "}
          {providers.reduce((n, p) => n + p.rateLimitWarnings, 0)}
        </p>
        <label>
          Query atau ID asli dari respons provider{" "}
          <input
            value={input}
            maxLength={1000}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search: judul; Title/Episodes: ID title; Playback: ID episode"
            style={{ width: "100%" }}
          />
        </label>
        <p className="muted">
          Untuk Streaming Availability, ID episode adalah providerId dari TEST
          EPISODES. Jangan mengubah ID atau menebak URL.
        </p>
      </div>
      {providers.map((p) => (
        <section className="panel" key={p.provider}>
          <h2>{p.name}</h2>
          <p>
            {p.host} · {p.status} ·{" "}
            {p.latency === null ? "Belum diuji" : `${p.latency} ms`}
          </p>
          <p>Plan: {p.plan}</p>
          <p>
            Capabilities: {p.capabilities.join(", ") || "Belum terverifikasi"}
          </p>
          <p>Last test: {p.lastTest || "—"}</p>
          {p.error && <p className="notice">{p.error}</p>}
          <p>
            {(["search", "title", "episodes", "playback"] as const)
              .map(
                (op) =>
                  `${op.toUpperCase()}: ${p.checks[op] ? (p.checks[op]!.pass ? "PASS" : "FAIL") : "NOT TESTED"}`,
              )
              .join(" · ")}
          </p>
          <p>
            {["HLS", "DIRECT_MP4", "DASH", "AUTHORIZED_EMBED", "OFFICIAL_WATCH"]
              .map(
                (c) =>
                  `${c}: ${p.capabilities.includes(c as ProviderHealth["capabilities"][number]) ? "YES" : "NO"}`,
              )
              .join(" · ")}
          </p>
          <div className="actions-row">
            {(["search", "title", "episodes", "playback"] as const).map(
              (op) => (
                <button
                  key={op}
                  className="button outline"
                  disabled={!!busy || !input.trim()}
                  onClick={() => void test(p.provider, op)}
                >
                  TEST {op.toUpperCase()}
                </button>
              ),
            )}
          </div>
        </section>
      ))}
      {message && (
        <pre
          className="panel"
          role="status"
          style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
        >
          {message}
        </pre>
      )}
      {playback && (
        <ProviderPlayer key={JSON.stringify(playback)} playback={playback} />
      )}
    </>
  );
}
