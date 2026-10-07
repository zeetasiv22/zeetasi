import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/server";
import { safeRedirect } from "@/lib/domain";
import { appOrigin } from "@/lib/auth-config";
export async function GET(req: NextRequest) {
  const origin = appOrigin();
  const code = req.nextUrl.searchParams.get("code");
  if (code) {
    const s = await db();
    const { error } = await s.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(safeRedirect(req.nextUrl.searchParams.get("next")), origin),
      );
  }
  return NextResponse.redirect(
    new URL(
      "/login?error=Tautan+kedaluwarsa.+Buka+tautan+di+browser+yang+sama+atau+minta+tautan+baru.",
      origin,
    ),
  );
}
