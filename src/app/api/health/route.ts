import { NextResponse } from "next/server";
import { db, configured } from "@/lib/supabase/server";
export async function GET() {
  let database = false;
  let databaseStatus = "missing_configuration";
  if (configured()) {
    try {
      const s = await db();
      const { error } = await s
        .from("subscription_plans")
        .select("id")
        .limit(1);
      database = !error;
      databaseStatus = !error
        ? "ready"
        : ["PGRST205", "42P01"].includes(error.code)
          ? "schema_missing"
          : ["42501", "PGRST301", "PGRST302", "PGRST303"].includes(error.code)
            ? "access_denied"
            : "unavailable";
    } catch {
      databaseStatus = "unavailable";
    }
  }
  return NextResponse.json(
    {
      database,
      database_status: databaseStatus,
      anilist: "not-probed",
      tmdb: process.env.TMDB_API_KEY ? "configured" : "not-configured",
      payments: process.env.MIDTRANS_SERVER_KEY
        ? "configured"
        : "not-configured",
    },
    { status: database ? 200 : 503 },
  );
}
