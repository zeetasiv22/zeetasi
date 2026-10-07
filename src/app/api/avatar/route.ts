import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { currentUser, db, adminDb } from "@/lib/supabase/server";
export async function POST(req: NextRequest) {
  if (
    req.headers.get("origin") !== req.nextUrl.origin &&
    req.headers.get("origin") !== process.env.NEXT_PUBLIC_APP_URL
  )
    return NextResponse.json({ error: "Origin ditolak" }, { status: 403 });
  const user = await currentUser();
  if (!user)
    return NextResponse.json({ error: "Login diperlukan" }, { status: 401 });
  if (Number(req.headers.get("content-length") || 0) > 2200000)
    return NextResponse.json({ error: "Maksimal 2 MB." }, { status: 413 });
  const s = await db();
  if (!(await s.rpc("active_user")).data)
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("avatar");
  if (
    !(file instanceof File) ||
    file.size > 2097152 ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type)
  )
    return NextResponse.json(
      { error: "Gunakan JPG, PNG, atau WebP maksimal 2 MB." },
      { status: 400 },
    );
  let output: Buffer;
  try {
    output = await sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 16000000,
    })
      .rotate()
      .resize(256, 256, { fit: "cover" })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    return NextResponse.json(
      { error: "Gambar tidak valid atau terlalu besar." },
      { status: 400 },
    );
  }
  const a = adminDb();
  const path = `${user.id}/${crypto.randomUUID()}.webp`;
  const { error } = await a.storage
    .from("avatars")
    .upload(path, output, { contentType: "image/webp" });
  if (error)
    return NextResponse.json({ error: "Unggah gagal" }, { status: 500 });
  const result = await s.rpc("set_avatar", { p_path: path });
  if (result.error) {
    await a.storage.from("avatars").remove([path]);
    return NextResponse.json(
      { error: "Batas unggahan tercapai." },
      { status: 429 },
    );
  }
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const user = await currentUser();
  const id = req.nextUrl.searchParams.get("user") || user?.id;
  if (!id || !/^[0-9a-f-]{36}$/.test(id))
    return new NextResponse(null, { status: 404 });
  const s = await db();
  const { data: profile } = await s
    .from("profiles")
    .select("avatar_path")
    .eq("id", id)
    .maybeSingle();
  if (!profile?.avatar_path) return new NextResponse(null, { status: 404 });
  const { data, error } = await s.storage
    .from("avatars")
    .download(profile.avatar_path);
  if (error || !data) return new NextResponse(null, { status: 404 });
  return new NextResponse(data, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
