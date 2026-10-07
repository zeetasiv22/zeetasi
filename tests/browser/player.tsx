import React from "react";
import { createRoot } from "react-dom/client";
import { ProviderPlayer } from "../../src/components/provider-player";
import type { PlaybackResult, PlaybackSource } from "../../src/lib/playback";
const fixture = (
  type: PlaybackSource["type"],
  path: string,
): PlaybackSource => ({ type, url: new URL(path, location.origin).href });
document.addEventListener(
  "error",
  (event) => {
    if (event.target instanceof HTMLVideoElement)
      console.error(
        "Fixture media failure",
        event.target.currentSrc,
        event.target.error?.code,
        event.target.error?.message,
      );
  },
  true,
);
const mode = new URLSearchParams(location.search).get("mode") || "mp4";
const data: Record<string, PlaybackResult> = {
  mp4: {
    available: true,
    provider: "local-test-fixture",
    sources: [fixture("mp4", "/fixture.mp4")],
  },
  hls: {
    available: true,
    provider: "local-test-fixture",
    sources: [fixture("hls", "/hls/index.m3u8")],
  },
  dash: {
    available: true,
    provider: "local-test-fixture",
    sources: [fixture("dash", "/dash/index.mpd")],
  },
  failover: {
    available: true,
    provider: "local-test-fixture",
    sources: [fixture("mp4", "/missing.mp4"), fixture("mp4", "/fixture.mp4")],
  },
  exhausted: {
    available: true,
    provider: "local-test-fixture",
    sources: [fixture("mp4", "/missing.mp4")],
  },
  official: {
    available: true,
    provider: "local-test-fixture",
    sources: [{ type: "official", url: "https://www.blender.org/" }],
  },
  fallback: {
    available: true,
    provider: "local-test-fixture",
    sources: [
      fixture("mp4", "/missing.mp4"),
      { type: "official", url: "https://www.blender.org/" },
    ],
  },
  empty: { available: false, provider: "local-test-fixture", sources: [] },
  inconsistent: {
    available: true,
    provider: "local-test-fixture",
    sources: [],
  },
  expired: {
    available: true,
    provider: "local-test-fixture",
    sources: [
      { ...fixture("mp4", "/fixture.mp4"), expiresAt: "2000-01-01T00:00:00Z" },
    ],
  },
  subtitles: {
    available: true,
    provider: "local-test-fixture",
    sources: [fixture("mp4", "/fixture.mp4")],
    subtitles: [
      {
        url: new URL("/id.vtt", location.origin).href,
        language: "id",
        label: "Indonesia",
      },
    ],
  },
};
createRoot(document.getElementById("root")!).render(
  <ProviderPlayer key={mode} playback={data[mode] || data.empty} />,
);
