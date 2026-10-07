import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
vi.mock("server-only", () => ({}));
vi.mock("@/server/providers/store", () => ({
  providerStore: () => null,
  reserveRequest: async () => true,
}));
import {
  normalizePlayback,
  publicHttps,
} from "@/server/providers/normalizers/playback-normalizer";
import { rapidapiRequest } from "@/server/providers/rapidapi-client";
import { ProviderCache } from "@/server/providers/cache";
import { rankTitles } from "@/server/providers/normalizers/title-normalizer";
import { providerId, parseProviderId } from "@/server/providers/ids";
import { ProviderPlayer } from "@/components/provider-player";
import { VideoPlayer } from "@/components/player";
import { availabilityPlayback } from "@/server/providers/availability-provider";
import type { PlaybackResult, ProviderTitle } from "@/lib/playback";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
const url = "https://media.example.org/verified.mp4";
const empty: PlaybackResult = {
  available: false,
  sources: [],
  provider: "synthetic",
};

describe("playback normalization", () => {
  it("never treats metadata or an arbitrary url as a playable source", () => {
    for (const input of [
      { url },
      { title: "Poster", poster: url },
      { sources: [{ url }] },
      { sources: [{ type: "video", url }] },
    ])
      expect(
        normalizePlayback("synthetic", input, ["DIRECT_MP4"]).available,
      ).toBe(false);
  });
  it("requires documented capability, preserves supplied URLs and prioritizes formats", () => {
    const result = normalizePlayback(
      "synthetic",
      {
        sources: [
          { type: "official", url: "https://watch.example.org/show" },
          { type: "mp4", url },
          { type: "hls", url: "https://cdn.example.org/signed?token=fixture" },
          { type: "dash", url: "https://cdn.example.org/manifest.mpd" },
        ],
      },
      ["HLS", "DASH", "DIRECT_MP4", "OFFICIAL_WATCH"],
    );
    expect(result.sources.map((s) => s.type)).toEqual([
      "hls",
      "dash",
      "mp4",
      "official",
    ]);
    expect(result.sources[0].url).toBe(
      "https://cdn.example.org/signed?token=fixture",
    );
    expect(
      normalizePlayback("synthetic", { sources: [{ type: "hls", url }] }, [
        "METADATA",
      ]).available,
    ).toBe(false);
  });
  it("rejects expired sources and invalid expirations, keeps only genuine subtitle records", () => {
    const input = {
      sources: [
        { type: "mp4", url, expiresAt: "2000-01-01T00:00:00Z" },
        { type: "mp4", url: url + "?2", expiresAt: "nonsense" },
      ],
      subtitles: [
        { language: "id", label: "Indonesia" },
        {
          url: "https://cdn.example.org/id.vtt",
          language: "id",
          label: "Indonesia",
        },
      ],
    };
    const result = normalizePlayback("synthetic", input, ["DIRECT_MP4"]);
    expect(result.available).toBe(false);
    expect(result.subtitles).toHaveLength(1);
    expect(
      normalizePlayback(
        "synthetic",
        { sources: [{ type: "mp4", url }], expiresAt: "2000-01-01T00:00:00Z" },
        ["DIRECT_MP4"],
      ).available,
    ).toBe(false);
  });
  it("requires an exact authorized embed host", () => {
    expect(
      normalizePlayback(
        "p",
        { sources: [{ type: "embed", url: "https://evil.example.org/embed" }] },
        ["AUTHORIZED_EMBED"],
        ["player.example.org"],
      ).available,
    ).toBe(false);
    expect(
      normalizePlayback(
        "p",
        {
          sources: [{ type: "embed", url: "https://player.example.org/embed" }],
        },
        ["AUTHORIZED_EMBED"],
        ["player.example.org"],
      ).available,
    ).toBe(true);
  });
  it("rejects credentials, local addresses and non-HTTPS URLs", () => {
    for (const u of [
      "javascript:alert(1)",
      "http://cdn.example.org/a.mp4",
      "https://u:p@cdn.example.org/a",
      "https://127.0.0.1/v",
      "https://[::1]/v",
      "https://server.local/v",
      "https://example.org:8443/v",
    ])
      expect(publicHttps(u)).toBe(false);
  });
  it("availability links stay official, never mp4 or subtitle URLs", () => {
    const result = availabilityPlayback(
      { id: [{ link: "https://netflix.com/watch/123", quality: "hd" }] },
      "id",
    );
    expect(result.sources[0].type).toBe("official");
    expect(result.subtitles).toEqual([]);
    expect(
      availabilityPlayback(
        { us: [{ link: "https://netflix.com/watch/123" }] },
        "id",
      ).available,
    ).toBe(false);
  });
});

describe("no empty player", () => {
  it("does not render video/iframe for unavailable, empty, or expired playback", () => {
    for (const p of [
      empty,
      { ...empty, available: true },
      {
        ...empty,
        available: true,
        sources: [
          { type: "mp4" as const, url, expiresAt: "2000-01-01T00:00:00Z" },
        ],
      },
    ]) {
      const html = renderToStaticMarkup(
        createElement(ProviderPlayer, { playback: p }),
      );
      expect(html).not.toMatch(/<(video|iframe)/);
      expect(html).toContain("Playback unavailable");
    }
  });
  it("official-only results render a link without an empty player", () => {
    const html = renderToStaticMarkup(
      createElement(ProviderPlayer, {
        playback: {
          available: true,
          provider: "synthetic",
          sources: [
            { type: "official", url: "https://watch.example.org/title" },
          ],
        },
      }),
    );
    expect(html).not.toMatch(/<(video|iframe)/);
    expect(html).toContain("Watch officially");
  });
  it("legacy local player also refuses an empty source list", () => {
    expect(
      renderToStaticMarkup(
        createElement(VideoPlayer, {
          episodeId: "fixture",
          sources: [],
          authenticated: false,
        }),
      ),
    ).not.toContain("<video");
  });
});

describe("RapidAPI transport", () => {
  beforeEach(() => vi.stubEnv("RAPIDAPI_KEY", "synthetic-test-key-not-real"));
  it("keeps the key in server headers and returns only parsed payload", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ title: "Fixture" }));
    expect(
      await rapidapiRequest(
        "test-headers.p.rapidapi.com",
        "/search",
        { q: "A B" },
        { fetcher },
      ),
    ).toEqual({ title: "Fixture" });
    const [request, options] = fetcher.mock.calls[0];
    expect(String(request)).not.toContain("synthetic-test");
    expect(options.headers["X-RapidAPI-Key"]).toBe(
      "synthetic-test-key-not-real",
    );
    expect(options.redirect).toBe("error");
  });
  it("handles 429 with exponential backoff and no more than two retries", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(async () => new Response("", { status: 429 }));
    const wait = vi.fn().mockResolvedValue(undefined);
    await expect(
      rapidapiRequest(
        "test-429.p.rapidapi.com",
        "/search",
        {},
        { fetcher, wait },
      ),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls.map((c) => c[0])).toEqual([500, 1000]);
  });
  it("honors long Retry-After by cooling down instead of hammering", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response("", { status: 429, headers: { "Retry-After": "60" } }),
      );
    const wait = vi.fn();
    await expect(
      rapidapiRequest(
        "test-cooldown.p.rapidapi.com",
        "/search",
        {},
        { fetcher, wait },
      ),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
    await expect(
      rapidapiRequest(
        "test-cooldown.p.rapidapi.com",
        "/search",
        {},
        { fetcher, wait },
      ),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });
  it("never guesses a new endpoint for 403/404 and redacts upstream errors", async () => {
    for (const status of [403, 404]) {
      const fetcher = vi
        .fn()
        .mockResolvedValue(new Response("secret upstream detail", { status }));
      await expect(
        rapidapiRequest(
          `test-${status}.p.rapidapi.com`,
          "/documented",
          {},
          { fetcher },
        ),
      ).rejects.toThrow("PROVIDER_DEGRADED");
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
  it("rejects HTML 200 and invalid hosts without calling arbitrary endpoints", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response("<html>OK</html>", {
        headers: { "content-type": "text/html" },
      }),
    );
    await expect(
      rapidapiRequest("test-html.p.rapidapi.com", "/search", {}, { fetcher }),
    ).rejects.toThrow("PROVIDER_SCHEMA_CHANGED");
    await expect(
      rapidapiRequest("example.org", "/search", {}, { fetcher }),
    ).rejects.toThrow("INVALID_PROVIDER_CONFIG");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("cache and reliable identities", () => {
  it("coalesces simultaneous requests and never reuses data past expiry", async () => {
    vi.useFakeTimers();
    const cache = new ProviderCache();
    const load = vi.fn(async () => ({ expiresAt: Date.now() + 1000 }));
    await Promise.all([
      cache.get("same", 60000, load, (v) => v.expiresAt),
      cache.get("same", 60000, load, (v) => v.expiresAt),
    ]);
    expect(load).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1001);
    await cache.get("same", 60000, load, (v) => v.expiresAt);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("does not cache failures", async () => {
    const cache = new ProviderCache(),
      load = vi
        .fn()
        .mockRejectedValueOnce(new Error("down"))
        .mockResolvedValueOnce("ok");
    await expect(cache.get("x", 1000, load)).rejects.toThrow("down");
    expect(await cache.get("x", 1000, load)).toBe("ok");
  });
  it("roundtrips opaque provider IDs including episode punctuation", () => {
    const id = providerId("anime", "episode$1/日本語");
    expect(parseProviderId(id)).toEqual({
      provider: "anime",
      id: "episode$1/日本語",
    });
    expect(() => parseProviderId("https://example.org")).toThrow();
  });
  it("ranks playback first for a verified same title, never fuzzy-merges similar titles", () => {
    const title: ProviderTitle = {
      id: "a",
      provider: "a",
      providerId: "1",
      title: "Example",
      description: "",
      poster: "",
      type: "series",
      year: 2020,
      genres: [],
      countries: [],
      playback: empty,
      externalIds: { imdb: "tt1" },
    };
    const playable = {
      ...title,
      id: "b",
      provider: "b",
      playback: {
        available: true,
        provider: "b",
        sources: [{ type: "hls" as const, url }],
      },
    };
    const similar = { ...title, id: "c", externalIds: { imdb: "tt2" } };
    const ranked = rankTitles([title, playable, similar], "Example");
    expect(ranked).toHaveLength(2);
    expect(ranked[0].id).toBe("b");
    expect(ranked[0].alternatives).toEqual([{ id: "a", provider: "a" }]);
  });
});

describe("documented availability adapter contract", () => {
  it("refuses a changed episode identity instead of playing the wrong episode", async () => {
    vi.stubEnv("RAPIDAPI_KEY", "synthetic-contract-key");
    const { availabilityProvider } =
      await import("@/server/providers/availability-provider");
    const fixture = {
      id: "123",
      title: "Synthetic series",
      overview: "Test only",
      showType: "series",
      genres: [],
      streamingOptions: {},
      seasons: [
        {
          title: "Synthetic season",
          episodes: [
            {
              title: "Pilot",
              airYear: 2020,
              streamingOptions: {
                id: [{ link: "https://watch.example.org/episode-a" }],
              },
            },
          ],
        },
      ],
    };
    const fetcher = vi
      .fn()
      .mockImplementation(async () => Response.json(fixture));
    vi.stubGlobal("fetch", fetcher);
    try {
      const episodes = await availabilityProvider.episodes("123");
      expect(episodes[0].number).toBeNull();
      expect(
        (await availabilityProvider.playback(episodes[0].providerId)).sources[0]
          .url,
      ).toBe("https://watch.example.org/episode-a");
      fixture.seasons[0].episodes[0].title = "Different episode";
      expect(
        await availabilityProvider.playback(episodes[0].providerId),
      ).toMatchObject({
        available: false,
        sources: [],
        error: "EPISODE_IDENTITY_CHANGED",
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("retains verified alternatives when ranking a second time", () => {
    const title: ProviderTitle = {
      id: "x",
      provider: "x",
      providerId: "1",
      title: "Example",
      description: "",
      poster: "",
      type: "series",
      year: null,
      genres: [],
      countries: [],
      playback: empty,
      alternatives: [{ id: "y", provider: "y" }],
    };
    expect(rankTitles([title], "Example")[0].alternatives).toEqual([
      { id: "y", provider: "y" },
    ]);
  });
});

it("rejects a provider that echoes the RapidAPI key into its JSON response", async () => {
  vi.stubEnv("RAPIDAPI_KEY", "synthetic-echo-canary-not-real");
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      Response.json({
        url: "https://example.org/video?key=synthetic-echo-canary-not-real",
      }),
    );
  await expect(
    rapidapiRequest("test-echo.p.rapidapi.com", "/search", {}, { fetcher }),
  ).rejects.toThrow("PROVIDER_RESPONSE_REJECTED");
});
