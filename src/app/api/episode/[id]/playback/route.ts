import { getPlayback } from "@/server/providers/engine";
import { json } from "@/server/providers/http";
export const maxDuration = 30;
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return json(await getPlayback((await params).id));
}
