import { NextRequest, NextResponse } from "next/server";
import { adminDb, currentUser, db } from "@/lib/supabase/server";
export async function POST(req: NextRequest) {
  if (
    req.headers.get("origin") !== req.nextUrl.origin &&
    req.headers.get("origin") !== process.env.NEXT_PUBLIC_APP_URL
  )
    return NextResponse.json({ error: "Origin ditolak" }, { status: 403 });
  const user = await currentUser();
  if (!user)
    return NextResponse.json(
      { error: "Login terlebih dahulu." },
      { status: 401 },
    );
  if (
    !process.env.MIDTRANS_SERVER_KEY ||
    process.env.PAYMENT_PROVIDER !== "midtrans"
  )
    return NextResponse.json(
      {
        error:
          "Pembayaran belum diaktifkan. Administrator perlu mengonfigurasi Midtrans.",
      },
      { status: 503 },
    );
  const body = await req.json().catch(() => null);
  const s = await db();
  const limit = await s.rpc("active_user");
  if (!limit.data)
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const { data: plan } = await s
    .from("subscription_plans")
    .select("*")
    .eq("id", String(body?.planId || ""))
    .eq("enabled", true)
    .maybeSingle();
  if (!plan)
    return NextResponse.json(
      { error: "Paket tidak ditemukan" },
      { status: 400 },
    );
  const a = adminDb();
  const order = `zeta-${crypto.randomUUID()}`;
  const { error } = await a.from("payment_events").insert({
    user_id: user.id,
    plan_id: plan.id,
    order_id: order,
    amount: plan.price,
    duration_days: plan.days,
  });
  if (error)
    return NextResponse.json(
      { error: "Gagal membuat pesanan" },
      { status: 500 },
    );
  const host =
    process.env.MIDTRANS_PRODUCTION === "true"
      ? "app.midtrans.com"
      : "app.sandbox.midtrans.com";
  const result = await fetch(`https://${host}/snap/v1/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(process.env.MIDTRANS_SERVER_KEY + ":").toString("base64")}`,
    },
    body: JSON.stringify({
      transaction_details: { order_id: order, gross_amount: plan.price },
      customer_details: { email: user.email },
    }),
    signal: AbortSignal.timeout(10000),
  });
  const data = await result.json();
  if (!result.ok || typeof data.redirect_url !== "string")
    return NextResponse.json(
      { error: "Penyedia pembayaran belum dapat memproses pesanan." },
      { status: 502 },
    );
  const target = new URL(data.redirect_url);
  if (target.protocol !== "https:" || target.hostname !== host)
    return NextResponse.json(
      { error: "Invalid checkout URL" },
      { status: 502 },
    );
  return NextResponse.json({ url: target.href });
}
