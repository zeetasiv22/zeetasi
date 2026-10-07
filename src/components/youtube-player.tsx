"use client";
import { useEffect, useRef, useState } from "react";
import { youtubeErrorMessage } from "@/lib/official-streams";
type Player = {
  destroy(): void;
  getIframe(): HTMLIFrameElement;
  getPlaylist(): string[];
};
type YouTubeAPI = {
  Player: new (
    element: HTMLElement,
    options: {
      host: string;
      width: string;
      height: string;
      videoId: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady: (event: { target: Player }) => void;
        onError: (event: { data: number }) => void;
        onStateChange: (event: { data: number }) => void;
      };
    },
  ) => Player;
};
declare global {
  interface Window {
    YT?: YouTubeAPI;
    onYouTubeIframeAPIReady?: () => void;
  }
}
let loader: Promise<YouTubeAPI> | undefined;
function loadPlayer() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loader) return loader;
  loader = new Promise<YouTubeAPI>((resolve, reject) => {
    const script = document.createElement("script");
    const fail = () => {
      clearTimeout(timer);
      script.remove();
      loader = undefined;
      reject(
        new Error(
          "Player YouTube tidak dapat dimuat. Periksa koneksi atau pemblokir konten.",
        ),
      );
    };
    const timer = setTimeout(fail, 15000);
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer);
      if (window.YT) resolve(window.YT);
      else fail();
    };
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return loader;
}
export function YouTubePlayer({
  videoId,
  playlistId,
  title,
}: {
  videoId: string;
  playlistId?: string;
  title: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const host = container.current;
    if (!active || !host) return;
    let cancelled = false;
    let player: Player | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    loadPlayer()
      .then((api) => {
        if (cancelled) return;
        const mount = document.createElement("div");
        host.replaceChildren(mount);
        timeout = setTimeout(() => {
          if (!cancelled) {
            setFailed(true);
            setMessage(
              "Player belum merespons. Periksa koneksi atau muat ulang player.",
            );
          }
        }, 20000);
        player = new api.Player(mount, {
          host: "https://www.youtube.com",
          width: "100%",
          height: "100%",
          videoId,
          playerVars: {
            origin: window.location.origin,
            playsinline: 1,
            autoplay: 0,
            controls: 1,
            hl: "id",
            cc_lang_pref: "id",
            cc_load_policy: 1,
            ...(playlistId ? { listType: "playlist", list: playlistId } : {}),
          },
          events: {
            onReady: (event) => {
              if (cancelled) return;
              clearTimeout(timeout);
              event.target.getIframe().title = title;
              setFailed(false);
              setMessage(
                "Player dimuat. Tekan tombol putar; kualitas dan subtitle tersedia di pengaturan player.",
              );
            },
            onError: (event) => {
              if (cancelled) return;
              clearTimeout(timeout);
              setFailed(true);
              setMessage(youtubeErrorMessage(event.data));
            },
            onStateChange: (event) => {
              if (!cancelled && event.data === 1) {
                setFailed(false);
                setMessage("Sedang diputar di halaman ini.");
              }
            },
          },
        });
      })
      .catch((error) => {
        if (!cancelled) {
          setFailed(true);
          setMessage(
            error instanceof Error ? error.message : "Player tidak tersedia.",
          );
        }
      });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      player?.destroy();
      host.replaceChildren();
    };
  }, [active, attempt, videoId, playlistId, title]);
  return (
    <section className="panel">
      {!active ? (
        <>
          <p>
            Player YouTube tampil di halaman ini. Saat dimuat, YouTube menerima
            data koneksi dan dapat menggunakan cookie sesuai pengaturannya.
          </p>
          <button
            className="button lime"
            onClick={() => {
              setActive(true);
              setMessage("Memuat player…");
            }}
          >
            Muat player di ZetaHub
          </button>
        </>
      ) : (
        <div ref={container} className="youtube-frame" />
      )}
      {message && (
        <p className="notice" role={failed ? "alert" : "status"}>
          {message}
        </p>
      )}
      {failed && (
        <button
          className="button outline"
          onClick={() => {
            setFailed(false);
            setMessage("Memuat ulang player…");
            setAttempt((value) => value + 1);
          }}
        >
          Muat ulang player
        </button>
      )}
      {playlistId && (
        <p className="muted">
          Daftar video dan perpindahan episode mengikuti playlist resmi di dalam
          player. Tidak semua judul dalam katalog memiliki sumber ini.
        </p>
      )}
    </section>
  );
}
