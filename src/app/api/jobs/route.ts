import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/server";
export async function GET(req: NextRequest) {
  if (
    !process.env.CRON_SECRET ||
    req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const s = adminDb();
  const { error } = await s
    .from("subscriptions")
    .update({ status: "expired" })
    .eq("status", "active")
    .lte("expires_at", new Date().toISOString());
  if (error) return NextResponse.json({ error: "Job failed" }, { status: 500 });
  await s
    .from("viewing_sessions")
    .delete()
    .lt("last_ping", new Date(Date.now() - 86400000).toISOString());
  await s
    .from("background_jobs")
    .insert({ kind: "subscription-expiration", status: "complete" });
  return NextResponse.json({ ok: true });
}
