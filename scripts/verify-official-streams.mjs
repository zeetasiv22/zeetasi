// Read-only verification. oEmbed confirms metadata/channel identity, NOT playback availability.
import assert from "node:assert/strict";
import { officialStreams } from "../src/lib/official-streams.ts";
let verified = 0;
for (const source of officialStreams) {
  const targets = source.videos.map(
    (video) => `https://www.youtube.com/watch?v=${video.id}`,
  );
  if (source.playlistId)
    targets.push(`https://www.youtube.com/playlist?list=${source.playlistId}`);
  for (const url of targets) {
    const response = await fetch(
      `https://www.youtube.com/oembed?${new URLSearchParams({ url, format: "json" })}`,
      { signal: AbortSignal.timeout(10000) },
    );
    assert.equal(response.status, 200, `${source.id}: oEmbed unavailable`);
    const data = await response.json();
    const author = new URL(data.author_url, "https://www.youtube.com");
    assert.equal(author.origin, "https://www.youtube.com");
    assert.equal(
      author.pathname.toLowerCase(),
      `/@${source.channelHandle.toLowerCase()}`,
    );
    verified++;
  }
  console.log("VERIFIED metadata and channel:", source.id);
}
console.log(
  `${verified} oEmbed sources verified. Actual content playback is a separate acceptance check.`,
);
