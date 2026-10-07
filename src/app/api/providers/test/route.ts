import { NextRequest } from "next/server";
import { z } from "zod";
import { currentUser, db } from "@/lib/supabase/server";
import { testProvider } from "@/server/providers/engine";
import { json, apiError } from "@/server/providers/http";
export const maxDuration = 30;
export async function POST(req: NextRequest) {
  if (
    req.headers.get("origin") !== req.nextUrl.origin &&
    req.headers.get("origin") !== process.env.NEXT_PUBLIC_APP_URL
  )
    return json({ error: "ORIGIN_DENIED" }, 403);
  if (!(await currentUser())) return json({ error: "UNAUTHORIZED" }, 401);
  const s = await db();
  if (!(await s.rpc("can", { p: "operations" })).data)
    return json({ error: "FORBIDDEN" }, 403);
  const body = z
    .object({
      provider: z.string().max(50),
      operation: z.enum(["search", "title", "episodes", "playback"]),
      input: z.string().trim().min(1).max(1000),
    })
    .safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ error: "INVALID_INPUT" }, 400);
  try {
    return json(
      await testProvider(
        body.data.provider,
        body.data.operation,
        body.data.input,
      ),
    );
  } catch (e) {
    return apiError(e);
  }
}
