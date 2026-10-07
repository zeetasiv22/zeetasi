import { describe, it, expect } from "vitest";
import { commentReturnPath } from "../src/lib/comments";
import { adminSchemas } from "../src/lib/admin";
describe("discussion return routing", () => {
  it("preserves title, episode and reply context", () => {
    for (const path of [
      "/title/anilist-1",
      "/watch/00000000-0000-4000-8000-000000000001",
      "/community?target=comment%3Aabc",
      "/open-cinema",
    ])
      expect(commentReturnPath(path)).toBe(path);
  });
  it("rejects external redirects and unexpected routes", () => {
    for (const path of [
      "https://evil.test",
      "//evil.test",
      "/\\evil.test",
      "/title/a\n",
      "/admin",
      "/community/../../admin",
      "/title/foo?redirect=https://evil.test",
    ])
      expect(commentReturnPath(path)).toBe("/community");
  });
  it("removes extra query parameters", () => {
    expect(commentReturnPath("/community?target=anime&error=forged")).toBe(
      "/community?target=anime",
    );
  });
});
it("validates rendition resolution without inventing an unknown resolution", () => {
  const source = {
    id: "00000000-0000-4000-8000-000000000001",
    episode_id: "00000000-0000-4000-8000-000000000001",
    url: "https://example.test/film.mp4",
    license: "Licensed",
    type: "video/mp4",
    enabled: true,
    premium_only: false,
  };
  expect(
    adminSchemas.playback.safeParse({ ...source, height: 480 }).success,
  ).toBe(true);
  expect(adminSchemas.playback.parse(source)).toHaveProperty("height", null);
  expect(
    adminSchemas.playback.safeParse({ ...source, height: -1 }).success,
  ).toBe(false);
});

it("validates subtitle language and secure source URLs", () => {
  const track = {
    id: "00000000-0000-4000-8000-000000000001",
    episode_id: "00000000-0000-4000-8000-000000000001",
    language: "id",
    label: "Indonesia",
    url: "/media/zeta-orbit-id.vtt",
    license: "CC0 original",
    enabled: true,
  };
  expect(adminSchemas.subtitles.safeParse(track).success).toBe(true);
  for (const url of [
    "javascript:alert(1)",
    "http://example.test/a.vtt",
    "//evil.test/a.vtt",
    "/media/../../a.vtt",
  ])
    expect(adminSchemas.subtitles.safeParse({ ...track, url }).success).toBe(
      false,
    );
  expect(
    adminSchemas.subtitles.safeParse({ ...track, language: "<script>" })
      .success,
  ).toBe(false);
});
