import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/server";
import { validMidtransSignature } from "@/lib/payments";
import { z } from "zod";
export async function POST(req: NextRequest) {
  const key = process.env.MIDTRANS_SERVER_KEY;
  if (!key)
    return NextResponse.json(
      { error: "Payment provider not configured" },
      { status: 503 },
    );
  const parsed = z
    .object({
      order_id: z.string().max(100),
      status_code: z.string(),
      gross_amount: z.string(),
      signature_key: z.string(),
    })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  const p = parsed.data;
  if (
    !validMidtransSignature(
      p.order_id,
      p.status_code,
      p.gross_amount,
      p.signature_key,
      key,
    )
  )
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  const host =
    process.env.MIDTRANS_PRODUCTION === "true"
      ? "api.midtrans.com"
      : "api.sandbox.midtrans.com";
  const response = await fetch(
    `https://${host}/v2/${encodeURIComponent(p.order_id)}/status`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(key + ":").toString("base64")}`,
      },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    },
  );
  if (!response.ok)
    return NextResponse.json(
      { error: "Verification unavailable" },
      { status: 502 },
    );
  const status = z
    .object({
      order_id: z.string(),
      transaction_status: z.string(),
      gross_amount: z.string(),
      fraud_status: z.string().optional(),
    })
    .safeParse(await response.json());
  if (
    !status.success ||
    status.data.order_id !== p.order_id ||
    Number(status.data.gross_amount) !== Number(p.gross_amount)
  )
    return NextResponse.json(
      { error: "Verification mismatch" },
      { status: 400 },
    );
  const t = status.data;
  if (t.fraud_status && t.fraud_status !== "accept")
    return NextResponse.json({ received: true });
  const state =
    t.transaction_status === "capture" ? "settlement" : t.transaction_status;
  const { error } = await adminDb().rpc("settle_payment", {
    p_order: p.order_id,
    p_status: state,
    p_amount: Number(t.gross_amount),
  });
  return NextResponse.json(
    error ? { error: "Reconciliation failed" } : { received: true },
    { status: error ? 500 : 200 },
  );
}
