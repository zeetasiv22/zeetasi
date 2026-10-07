import { titleDetail } from "@/lib/catalog";
import { fromCatalogTitle } from "@/server/providers/normalizers/title-normalizer";
import { getProviderTitle } from "@/server/providers/engine";
import { json, apiError } from "@/server/providers/http";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (/^(anilist-\d+|tmdb-(movie|tv)-\d+)$/.test(id)) {
      const title = await titleDetail(id);
      return title
        ? json(fromCatalogTitle(title))
        : json({ error: "TITLE_NOT_FOUND" }, 404);
    }
    return json(await getProviderTitle(id));
  } catch (e) {
    return apiError(e);
  }
}
