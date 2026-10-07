import "server-only";
import { z } from "zod";
import type { OfficialStream } from "./official-streams";
const metadataSchema = z.object({
  title: z.string().max(500),
  author_name: z.string().max(200),
  author_url: z.string(),
  provider_name: z.literal("YouTube"),
  type: z.literal("video"),
});
/** Use the documented public oEmbed endpoint. Never scrape or extract media URLs. */
export async function youtubeMetadata(
  source: OfficialStream,
  videoId: string,
  playlist = false,
) {
  const url =
    playlist && source.playlistId
      ? `https://www.youtube.com/playlist?list=${source.playlistId}`
      : `https://www.youtube.com/watch?v=${videoId}`;
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?${new URLSearchParams({ url, format: "json" })}`,
      { signal: AbortSignal.timeout(8000), next: { revalidate: 3600 } },
    );
    if (!response.ok) return null;
    const data = metadataSchema.parse(await response.json());
    const author = new URL(data.author_url, "https://www.youtube.com");
    if (
      author.protocol !== "https:" ||
      author.hostname !== "www.youtube.com" ||
      author.pathname.toLowerCase() !==
        `/@${source.channelHandle.toLowerCase()}`
    )
      return null;
    return { title: data.title, author: data.author_name };
  } catch {
    return null;
  }
}
