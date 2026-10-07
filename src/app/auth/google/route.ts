import { NextResponse } from "next/server";
import { db, configured } from "@/lib/supabase/server";
import { appOrigin } from "@/lib/auth-config";
import { googleAvailable } from "@/lib/auth-providers";

export async function GET() {
  const origin = appOrigin();
  const failure = () =>
    NextResponse.redirect(
      new URL(
        "/login?error=" +
          encodeURIComponent(
            "Login Google belum tersedia. Gunakan email atau coba kembali nanti.",
          ),
        origin,
      ),
    );
  if (!configured() || !(await googleAvailable())) return failure();
  const s = await db();
  const { data, error } = await s.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error || !data.url) return failure();
  const response = NextResponse.redirect(data.url);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
