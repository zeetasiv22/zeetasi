import { getProviderEpisode } from "@/server/providers/engine";
import { json, apiError } from "@/server/providers/http";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ep = await getProviderEpisode((await params).id);
    return json(ep || { error: "EPISODE_NOT_FOUND" }, ep ? 200 : 404);
  } catch (e) {
    return apiError(e);
  }
}
