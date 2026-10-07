import { getProviderEpisodes } from "@/server/providers/engine";
import { json, apiError } from "@/server/providers/http";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (/^(anilist-\d+|tmdb-(movie|tv)-\d+)$/.test(id))
      return json({ episodes: [], error: "PLAYBACK_UNAVAILABLE" });
    return json({ episodes: await getProviderEpisodes(id) });
  } catch (e) {
    return apiError(e);
  }
}
