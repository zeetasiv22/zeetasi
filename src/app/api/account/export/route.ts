import { NextResponse } from "next/server";
import { db, currentUser } from "@/lib/supabase/server";
export async function GET() {
  const user = await currentUser();
  if (!user)
    return NextResponse.json({ error: "Login diperlukan" }, { status: 401 });
  const s = await db();
  const tables = [
    "profiles",
    "watchlist_items",
    "watch_progress",
    "title_follows",
    "comments",
    "notifications",
    "subscriptions",
    "payment_events",
    "xp_transactions",
    "user_avatar_equipment",
    "notification_preferences",
  ];
  const output: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
  };
  for (const table of tables) {
    const { data, error } = await s
      .from(table)
      .select("*")
      .eq(table === "profiles" ? "id" : "user_id", user.id)
      .limit(10000);
    if (error)
      return NextResponse.json(
        { error: "Ekspor belum dapat dibuat" },
        { status: 500 },
      );
    output[table] = data;
  }
  return new NextResponse(JSON.stringify(output, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="zetahub-data.json"',
      "Cache-Control": "private, no-store",
    },
  });
}
