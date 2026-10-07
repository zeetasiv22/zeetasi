"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { playableSources, type PlaybackResult } from "@/lib/playback";

export function ProviderPlayer({ playback }: { playback: PlaybackResult }) {
  const sources = useMemo(() => playableSources(playback), [playback]);
  const [selected, setSelected] = useState(0),
    [attempt, setAttempt] = useState(0),
    [failed, setFailed] = useState(false),
    [message, setMessage] = useState("");
  const [subtitle, setSubtitle] = useState("off");
  const [clock, setClock] = useState(() => Date.now());
  const video = useRef<HTMLVideoElement>(null),
    saved = useRef({ position: 0, playing: false }),
    advancing = useRef(false);
  const source = sources[selected];
  const expired =
    !!source &&
    !playableSources(playback, clock).some((s) => s.url === source.url);
  const failRef = useRef<() => void>(() => {});
  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    failRef.current = () => {
      if (advancing.current) return;
      advancing.current = true;
      if (video.current)
        saved.current = {
          position: video.current.currentTime,
          playing: !video.current.paused,
        };
      // Two retries per source, then advance. An exhausted source is never cycled automatically.
      if (attempt < 2) {
        setAttempt(attempt + 1);
        setMessage("Mencoba kembali sumber video…");
      } else if (selected + 1 < sources.length) {
        setSelected(selected + 1);
        setAttempt(0);
        setMessage("Beralih ke sumber berikutnya…");
      } else {
        setFailed(true);
        setMessage("Playback unavailable from configured providers.");
      }
    };
  }, [attempt, selected, sources.length]);
  useEffect(() => {
    const el = video.current;
    if (
      !el ||
      !source ||
      failed ||
      expired ||
      source.type === "official" ||
      source.type === "embed"
    )
      return;
    let disposed = false,
      cleanup = () => {};
    advancing.current = false;
    const fail = () => {
      if (!disposed) failRef.current();
    };
    // A stalled source must not leave a permanent blank player.
    let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(
      fail,
      15000,
    );
    const ready = () => {
      clearTimeout(timer);
      timer = undefined;
      setMessage("");
    };
    const stall = () => {
      if (!timer) timer = setTimeout(fail, 15000);
    };
    el.addEventListener("loadeddata", ready);
    el.addEventListener("playing", ready);
    el.addEventListener("waiting", stall);
    el.addEventListener("error", fail);
    async function load() {
      if (
        source!.type === "hls" &&
        !el!.canPlayType("application/vnd.apple.mpegurl")
      ) {
        const { default: Hls } = await import("hls.js");
        if (disposed) return;
        if (!Hls.isSupported()) {
          fail();
          return;
        }
        const hls = new Hls({
          manifestLoadPolicy: {
            default: {
              maxTimeToFirstByteMs: 5000,
              maxLoadTimeMs: 10000,
              timeoutRetry: null,
              errorRetry: null,
            },
          },
          playlistLoadPolicy: {
            default: {
              maxTimeToFirstByteMs: 5000,
              maxLoadTimeMs: 10000,
              timeoutRetry: null,
              errorRetry: null,
            },
          },
          fragLoadPolicy: {
            default: {
              maxTimeToFirstByteMs: 5000,
              maxLoadTimeMs: 10000,
              timeoutRetry: null,
              errorRetry: null,
            },
          },
        });
        cleanup = () => hls.destroy();
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) fail();
        });
        hls.loadSource(source!.url);
        hls.attachMedia(el!);
      } else if (source!.type === "dash") {
        const dash = await import("dashjs");
        if (disposed) return;
        const player = dash.MediaPlayer().create();
        cleanup = () => player.reset();
        player.updateSettings({
          streaming: {
            retryAttempts: {
              MPD: 0,
              MediaSegment: 0,
              InitializationSegment: 0,
            },
          },
        });
        player.on(dash.MediaPlayer.events.ERROR, fail);
        player.initialize(el!, source!.url, false);
      } else {
        el!.src = source!.url;
        el!.load();
      }
    }
    void load().catch(fail);
    return () => {
      disposed = true;
      clearTimeout(timer);
      el.removeEventListener("loadeddata", ready);
      el.removeEventListener("playing", ready);
      el.removeEventListener("waiting", stall);
      el.removeEventListener("error", fail);
      cleanup();
      el.removeAttribute("src");
      el.load();
    };
  }, [source, attempt, failed, expired]); // Source identity, not the enclosing response object.
  if (!playback.available || !source || expired || failed)
    return (
      <section className="notice" role="status">
        <h2>Playback unavailable</h2>
        <p>
          {expired
            ? "Sumber video kedaluwarsa. Buka kembali episode untuk mengambil sumber terbaru."
            : "Playback unavailable from configured providers."}
        </p>
        <OfficialLinks playback={playback} />
      </section>
    );
  if (source.type === "official")
    return (
      <section className="panel">
        <h2>Watch officially</h2>
        <p>
          Video tersedia di layanan resmi. Akun, paket langganan, atau batas
          wilayah layanan tersebut mungkin berlaku.
        </p>
        <OfficialLinks playback={playback} />
      </section>
    );
  return (
    <section className="video-shell">
      {source.type === "embed" ? (
        <iframe
          title="Pemutar resmi"
          src={source.url}
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          onError={() => failRef.current()}
          style={{ width: "100%", aspectRatio: "16/9", border: 0 }}
        />
      ) : (
        <video
          ref={video}
          controls
          playsInline
          preload="metadata"
          crossOrigin="anonymous"
          aria-label="ZetaHub player"
          onLoadedMetadata={() => {
            const el = video.current;
            if (!el) return;
            if (Number.isFinite(el.duration))
              el.currentTime = Math.min(saved.current.position, el.duration);
            if (saved.current.playing)
              void el
                .play()
                .catch(() => setMessage("Tekan putar untuk melanjutkan."));
          }}
        >
          {(playback.subtitles || []).map((track, i) => (
            <track
              key={`${track.url}:${i}`}
              kind="subtitles"
              src={track.url}
              srcLang={track.language}
              label={track.label}
              onError={() =>
                setMessage("Subtitle gagal dimuat. Pilih bahasa lain.")
              }
            />
          ))}
        </video>
      )}
      <div className="player-toolbar">
        <label>
          Sumber / kualitas{" "}
          <select
            aria-label="Sumber / kualitas"
            value={selected}
            onChange={(e) => {
              const el = video.current;
              if (el)
                saved.current = {
                  position: el.currentTime,
                  playing: !el.paused,
                };
              setSelected(Number(e.target.value));
              setAttempt(0);
              setFailed(false);
            }}
          >
            {sources.map((s, i) => (
              <option key={`${s.url}:${i}`} value={i}>
                {s.type.toUpperCase()} · {s.quality || `Sumber ${i + 1}`}
              </option>
            ))}
          </select>
        </label>
        {!!playback.subtitles?.length && source.type !== "embed" && (
          <label>
            Subtitle{" "}
            <select
              aria-label="Subtitle provider"
              value={subtitle}
              onChange={(e) => {
                setSubtitle(e.target.value);
                const el = video.current;
                if (el)
                  for (let i = 0; i < el.textTracks.length; i++)
                    el.textTracks[i].mode =
                      String(i) === e.target.value ? "showing" : "disabled";
              }}
            >
              <option value="off">Nonaktif</option>
              {playback.subtitles.map((s, i) => (
                <option key={i} value={i}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
export function OfficialLinks({ playback }: { playback: PlaybackResult }) {
  return (
    <div className="actions-row">
      {playableSources(playback)
        .filter((s) => s.type === "official")
        .map((s) => (
          <a
            className="button lime"
            key={s.url}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Watch officially
          </a>
        ))}
    </div>
  );
}
