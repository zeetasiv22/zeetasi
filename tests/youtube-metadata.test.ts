import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { youtubeMetadata } from "../src/lib/youtube";
import { officialStreams } from "../src/lib/official-streams";
const source = officialStreams[0];
afterEach(() => vi.unstubAllGlobals());
const response = (author_url: string) =>
  new Response(
    JSON.stringify({
      title: "Official episode",
      author_name: "Muse Indonesia",
      author_url,
      provider_name: "YouTube",
      type: "video",
      html: "<script>untrusted</script>",
    }),
  );
it("accepts the expected channel and returns text only", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(response("/@MuseIndonesia")),
  );
  expect(await youtubeMetadata(source, source.videos[0].id)).toEqual({
    title: "Official episode",
    author: "Muse Indonesia",
  });
});
it.each([
  "https://evil.test/@MuseIndonesia",
  "https://www.youtube.com/@Impostor",
  "javascript:alert(1)",
])("rejects unexpected channel identity %s", async (author) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(author)));
  expect(await youtubeMetadata(source, source.videos[0].id)).toBeNull();
});
it("treats a provider failure as unavailable, never cached invented metadata", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("unavailable", { status: 429 })),
  );
  expect(await youtubeMetadata(source, source.videos[0].id)).toBeNull();
});
