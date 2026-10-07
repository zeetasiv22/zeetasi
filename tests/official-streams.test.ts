import { expect, it } from "vitest";
import {
  officialStreams,
  selectOfficialVideo,
  streamForCatalog,
  youtubeErrorMessage,
} from "../src/lib/official-streams";
import { commentReturnPath } from "../src/lib/comments";
it("maps only verified catalog works and does not enable unrelated seasons or similarly named titles", () => {
  expect(streamForCatalog("anilist-174576")?.id).toBe("wistoria");
  expect(streamForCatalog("anilist-182300")).toBeUndefined();
  expect(streamForCatalog("tmdb-tv-4313")).toBeUndefined(); // US Full House is a different work.
  expect(streamForCatalog("tmdb-tv-3504")?.id).toBe("full-house");
});
it("never embeds an arbitrary query string video or URL", () => {
  const source = officialStreams[0];
  for (const input of [
    "//evil.test",
    "M7lc1UVf-VE",
    "<script>",
    "https://youtube.com/watch?v=foreign",
  ])
    expect(selectOfficialVideo(source, input)).toEqual(source.videos[0]);
  expect(selectOfficialVideo(source, source.videos[1].id)).toEqual(
    source.videos[1],
  );
});
it("curation uses unique validated YouTube identifiers and keeps subtitle claims distinct", () => {
  expect(new Set(officialStreams.map((source) => source.id)).size).toBe(
    officialStreams.length,
  );
  for (const source of officialStreams) {
    for (const video of source.videos) expect(video.id).toMatch(/^[\w-]{11}$/);
    if (source.playlistId) expect(source.playlistId).toMatch(/^PL[\w-]+$/);
  }
  expect(
    officialStreams.find((source) => source.id === "mendadak-kaya")
      ?.subtitleNote,
  ).toContain("berbahasa Indonesia");
});
it("explains provider errors without treating an initialized iframe as successful playback", () => {
  expect(youtubeErrorMessage(150)).toContain("verifikasi bukan bot");
  expect(youtubeErrorMessage(100)).toContain("privat");
  expect(youtubeErrorMessage(153)).toContain("identitas situs");
  expect(youtubeErrorMessage(5)).toContain("browser");
});
it("comments return to the in-site streaming page and reject unrelated destinations", () => {
  expect(commentReturnPath("/streaming/wistoria")).toBe("/streaming/wistoria");
  expect(commentReturnPath("/streaming/../../admin")).toBe("/community");
});
