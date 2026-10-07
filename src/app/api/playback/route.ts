import { NextRequest, NextResponse } from "next/server";
import { db, currentUser } from "@/lib/supabase/server";
import { z } from "zod";
export async function POST(req: NextRequest) {
  if (
    req.headers.get("origin") !== req.nextUrl.origin &&
    req.headers.get("origin") !== process.env.NEXT_PUBLIC_APP_URL
  )
    return NextResponse.json({ error: "Origin ditolak" }, { status: 403 });
  const user = await currentUser();
  if (!user)
    return NextResponse.json({ error: "Login diperlukan" }, { status: 401 });
  const body = z
    .union([
      z.object({ episodeId: z.uuid() }),
      z.object({
        sessionId: z.uuid(),
        position: z.number().finite().nonnegative(),
      }),
    ])
    .safeParse(await req.json().catch(() => null));
  if (!body.success)
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  const s = await db();
  const p = body.data;
  const { data, error } =
    "episodeId" in p
      ? await s.rpc("start_viewing", { eid: p.episodeId })
      : await s.rpc("heartbeat", { sid: p.sessionId, pos: p.position });
  if (error)
    return NextResponse.json(
      { error: "Sesi tidak tersedia atau akses ditolak." },
      { status: 400 },
    );
  return NextResponse.json({ data });
}
