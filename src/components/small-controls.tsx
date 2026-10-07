"use client";
import { useState, useEffect } from "react";
import { Sun, Moon, Download } from "lucide-react";
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export function ThemeToggle() {
  const [light, setLight] = useState(false);
  return (
    <button
      className="icon-button theme-toggle"
      aria-label="Ganti tema"
      onClick={() => {
        setLight(!light);
        document.documentElement.dataset.theme = light ? "dark" : "light";
      }}
    >
      {light ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
export function PwaInstall() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const listener = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", listener);
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => window.removeEventListener("beforeinstallprompt", listener);
  }, []);
  return (
    <>
      <button
        className="button outline full"
        onClick={async () => {
          if (event) {
            await event.prompt();
            await event.userChoice;
            setEvent(null);
          } else
            setMessage(
              "Buka menu browser → Instal aplikasi / Tambahkan ke Layar Utama jika tersedia.",
            );
        }}
      >
        <Download size={15} /> Instal aplikasi web
      </button>
      {message && <p role="status">{message}</p>}
    </>
  );
}
export function Checkout({
  planId,
  enabled,
}: {
  planId: string;
  enabled: boolean;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button
        disabled={busy || !enabled}
        className="button lime full"
        onClick={async () => {
          setBusy(true);
          try {
            const res = await fetch("/api/payments/checkout", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ planId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            window.location.assign(data.url);
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "Pembayaran gagal.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy
          ? "Menyiapkan..."
          : enabled
            ? "Pilih paket"
            : "Pembayaran belum tersedia"}
      </button>
      {message && <p role="alert">{message}</p>}
    </>
  );
}
