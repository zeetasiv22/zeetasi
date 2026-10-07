import { NextRequest, NextResponse } from "next/server";
import { db, currentUser } from "@/lib/supabase/server";
import { z } from "zod";
export async function POST(req: NextRequest) {
  if (
    req.headers.get("origin") !== req.nextUrl.origin &&
    req.headers.get("origin") !== process.env.NEXT_PUBLIC_APP_URL
  )
    return NextResponse.json({ error: "Origin ditolak" }, { status: 403 });
  if (!(await currentUser()))
    return NextResponse.json({ error: "Login diperlukan" }, { status: 401 });
  const p = z
    .object({
      eventId: z.uuid(),
      status: z.enum(["shown", "unavailable", "dismissed"]),
    })
    .safeParse(await req.json().catch(() => null));
  if (!p.success)
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  const s = await db();
  const { error } = await s.rpc("ad_delivery", {
    p_event: p.data.eventId,
    p_status: p.data.status,
  });
  return NextResponse.json({ ok: !error }, { status: error ? 400 : 200 });
}
