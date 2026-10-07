"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, currentUser, accountStoreReady } from "@/lib/supabase/server";
import { commentReturnPath } from "@/lib/comments";
import { profileInput, commentInput } from "@/lib/domain";
import { z } from "zod";
import { appOrigin, authErrorMessage } from "@/lib/auth-config";
const value = (f: FormData, k: string) => String(f.get(k) || "");
async function context() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return { s: await db(), user };
}
function finish(path: string, error?: string | null): never {
  revalidatePath("/", "layout");
  redirect(
    `${path}${path.includes("?") ? "&" : "?"}${error ? "error=" + encodeURIComponent(error) : "success=1"}`,
  );
}
export async function authenticate(f: FormData) {
  const mode = value(f, "mode");
  const parsed = z
    .object({ email: z.email(), password: z.string().min(8).max(128) })
    .safeParse({ email: value(f, "email"), password: value(f, "password") });
  if (!parsed.success)
    finish(
      `/${mode === "register" ? "register" : "login"}`,
      "Email atau kata sandi tidak valid (minimal 8 karakter).",
    );
  if (mode === "register" && !(await accountStoreReady()))
    finish(
      "/register",
      "Layanan akun belum siap. Pengelola perlu menyelesaikan instalasi database.",
    );
  const s = await db();
  const { data, error } =
    mode === "register"
      ? await s.auth.signUp({
          ...parsed.data,
          email: parsed.data.email,
          options: {
            emailRedirectTo: `${appOrigin()}/auth/callback`,
          },
        })
      : await s.auth.signInWithPassword(parsed.data);
  if (error)
    finish(
      `/${mode === "register" ? "register" : "login"}`,
      mode === "register"
        ? authErrorMessage(error.code)
        : "Email atau kata sandi salah, atau email belum diverifikasi.",
    );
  redirect(mode === "register" && !data.session ? "/verify-email" : "/");
}
export async function resendVerification(f: FormData) {
  const email = z.email().safeParse(value(f, "email"));
  if (!email.success) finish("/verify-email", "Email tidak valid.");
  const s = await db();
  const { error } = await s.auth.resend({
    type: "signup",
    email: email.data,
    options: { emailRedirectTo: `${appOrigin()}/auth/callback` },
  });
  finish("/verify-email", error ? authErrorMessage(error.code) : null);
}
export async function logout() {
  const s = await db();
  await s.auth.signOut();
  redirect("/");
}
export async function forgotPassword(f: FormData) {
  const email = z.email().safeParse(value(f, "email"));
  if (!email.success) finish("/forgot-password", "Email tidak valid.");
  const s = await db();
  const { error } = await s.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${appOrigin()}/auth/callback?next=/reset-password`,
  });
  finish("/forgot-password", error ? authErrorMessage(error.code) : null);
}
export async function resetPassword(f: FormData) {
  const { s } = await context();
  const p = z.string().min(8).max(128).safeParse(value(f, "password"));
  if (!p.success) finish("/reset-password", "Gunakan minimal 8 karakter.");
  const { error } = await s.auth.updateUser({ password: p.data });
  finish("/settings/security", error?.message);
}
export async function saveProfile(f: FormData) {
  const { s } = await context();
  const p = profileInput.safeParse({
    username: value(f, "username"),
    display_name: value(f, "display_name"),
    bio: value(f, "bio"),
    is_public: f.get("is_public") === "on",
  });
  if (!p.success)
    finish(
      "/settings/profile",
      "Periksa nama, username (3–24 huruf kecil/angka/garis bawah), dan bio.",
    );
  const { error } = await s.rpc("update_profile", {
    p_username: p.data.username,
    p_name: p.data.display_name,
    p_bio: p.data.bio,
    p_public: p.data.is_public,
  });
  finish(
    "/settings/profile",
    error ? "Username tidak tersedia atau perubahan ditolak." : null,
  );
}
export async function toggleWatchlist(f: FormData) {
  const { s, user } = await context();
  const id = z
    .string()
    .regex(/^[a-z0-9-]{1,100}$/)
    .parse(value(f, "id"));
  const { data } = await s
    .from("watchlist_items")
    .select("title_id")
    .eq("user_id", user.id)
    .eq("title_id", id)
    .maybeSingle();
  let error;
  if (data) {
    ({ error } = await s
      .from("watchlist_items")
      .delete()
      .eq("user_id", user.id)
      .eq("title_id", id));
  } else {
    const { titleDetail } = await import("@/lib/catalog");
    const title =
      (await titleDetail(id)) ||
      (
        await s
          .from("catalog_titles")
          .select("title,poster")
          .eq("id", id)
          .eq("published", true)
          .maybeSingle()
      ).data;
    if (!title) finish(`/title/${id}`, "Judul tidak tersedia.");
    ({ error } = await s.from("watchlist_items").insert({
      user_id: user.id,
      title_id: id,
      title: title?.title || "Zeta Orbit",
      poster: title?.poster || "/placeholder.svg",
    }));
  }
  finish(`/title/${id}`, error?.message);
}
export async function followTitle(f: FormData) {
  const { s, user } = await context();
  const id = z.string().max(100).parse(value(f, "id"));
  const { data } = await s
    .from("title_follows")
    .select("title_id")
    .eq("title_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  const { error } = data
    ? await s
        .from("title_follows")
        .delete()
        .eq("title_id", id)
        .eq("user_id", user.id)
    : await s.from("title_follows").insert({ user_id: user.id, title_id: id });
  finish(`/title/${id}`, error?.message);
}
export async function addComment(f: FormData) {
  const { s } = await context();
  const p = commentInput.safeParse({
    target: value(f, "target"),
    body: value(f, "body"),
    spoiler: f.get("spoiler") === "on",
  });
  if (!p.success)
    finish(
      commentReturnPath(value(f, "returnTo")),
      "Komentar harus berisi 2–2.000 karakter.",
    );
  const { error } = await s.rpc("add_comment", {
    p_target: p.data.target,
    p_body: p.data.body,
    p_spoiler: p.data.spoiler,
  });
  finish(commentReturnPath(value(f, "returnTo")), error?.message);
}
export async function deleteComment(f: FormData) {
  const { s } = await context();
  const { error } = await s
    .from("comments")
    .delete()
    .eq("id", z.uuid().parse(value(f, "id")));
  finish(commentReturnPath(value(f, "returnTo")), error?.message);
}
export async function likeComment(f: FormData) {
  const { s, user } = await context();
  const id = z.uuid().parse(value(f, "id"));
  const { data } = await s
    .from("comment_likes")
    .select("comment_id")
    .eq("user_id", user.id)
    .eq("comment_id", id)
    .maybeSingle();
  const { error } = data
    ? await s
        .from("comment_likes")
        .delete()
        .eq("user_id", user.id)
        .eq("comment_id", id)
    : await s
        .from("comment_likes")
        .insert({ user_id: user.id, comment_id: id });
  finish(commentReturnPath(value(f, "returnTo")), error?.message);
}
export async function markNotifications() {
  const { s, user } = await context();
  const { error } = await s
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id);
  finish("/notifications", error?.message);
}
export async function equipAvatar(f: FormData) {
  const { s } = await context();
  const { error } = await s.rpc("equip_avatar", { item: value(f, "item") });
  finish("/avatar-editor", error?.message);
}
export async function clearHistory(f: FormData) {
  const { s, user } = await context();
  if (f.get("confirm") !== "on")
    finish("/history", "Konfirmasikan penghapusan terlebih dahulu.");
  const { error } = await s
    .from("watch_progress")
    .delete()
    .eq("user_id", user.id);
  finish("/history", error?.message);
}
export async function reportContent(f: FormData) {
  const { s, user } = await context();
  const p = z
    .object({
      target: z.string().min(1).max(200),
      reason: z.string().min(5).max(2000),
    })
    .safeParse({ target: value(f, "target"), reason: value(f, "reason") });
  if (!p.success)
    finish("/content-report", "Isi target dan alasan minimal 5 karakter.");
  const { error } = await s
    .from("reports")
    .insert({ user_id: user.id, ...p.data });
  finish("/content-report", error?.message);
}
export async function staffAction(f: FormData) {
  const { s } = await context();
  if (f.get("confirm") !== "on")
    finish("/admin/users", "Konfirmasi wajib diisi.");
  const { error } = await s.rpc("staff_action", {
    p_action: value(f, "action"),
    p_target: value(f, "target"),
    p_value: value(f, "value"),
    p_reason: value(f, "reason"),
  });
  finish("/admin/users", error?.message);
}
export async function savePreferences(f: FormData) {
  const { s, user } = await context();
  const { error } = await s.from("notification_preferences").upsert({
    user_id: user.id,
    series: f.get("series") === "on",
    community: f.get("community") === "on",
    announcements: f.get("announcements") === "on",
  });
  finish("/settings/notifications", error?.message);
}
export async function saveAdminRecord(f: FormData) {
  const { s } = await context();
  const { adminSchemas, adminSections } = await import("@/lib/admin");
  const section = value(f, "section");
  const schema = adminSchemas[section];
  const def = adminSections[section];
  if (!schema || !def) finish("/admin", "Modul tidak dapat disunting.");
  if (value(f, "reason").trim().length < 5 || f.get("confirm") !== "on")
    finish(`/admin/${section}`, "Konfirmasi dan alasan diperlukan.");
  const { data: allowed } = await s.rpc("can", { p: def.permission });
  if (!allowed) finish("/admin", "Akses ditolak.");
  let payload;
  try {
    payload = JSON.parse(value(f, "payload"));
  } catch {
    finish(`/admin/${section}`, "JSON tidak valid.");
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success)
    finish(
      `/admin/${section}`,
      "Data tidak memenuhi skema. Periksa jenis, batas, dan kolom wajib.",
    );
  const { error } = await s.rpc("manage_record", {
    p_section: section,
    p_record: parsed.data,
    p_reason: value(f, "reason"),
  });
  finish(`/admin/${section}`, error?.message);
}
export async function moderate(f: FormData) {
  const { s } = await context();
  const { error } = await s.rpc("moderate_content", {
    p_kind: value(f, "kind"),
    p_id: value(f, "id"),
    p_reason: value(f, "reason"),
  });
  finish("/staff/reports", error?.message);
}

export async function configureSetting(f: FormData) {
  const { s } = await context();
  const { settingSchemas } = await import("@/lib/settings");
  const key = value(f, "key");
  if (!settingSchemas[key] || f.get("confirm") !== "on")
    finish("/admin/settings", "Periksa konfirmasi dan kunci.");
  let data;
  try {
    data = JSON.parse(value(f, "payload"));
  } catch {
    finish("/admin/settings", "JSON tidak valid.");
  }
  const p = settingSchemas[key].safeParse(data);
  if (!p.success) finish("/admin/settings", "Nilai pengaturan tidak valid.");
  const { error } = await s.rpc("configure_setting", {
    p_key: key,
    p_value: p.data,
    p_reason: value(f, "reason"),
  });
  finish("/admin/settings", error?.message);
}
export async function configurePlan(f: FormData) {
  const { s } = await context();
  const p = z
    .object({
      id: z.string().regex(/^[a-z0-9_-]{1,40}$/),
      name: z.string().min(1).max(70),
      price: z.coerce.number().int().min(1000).max(100000000),
      days: z.coerce.number().int().min(1).max(1825),
    })
    .safeParse(Object.fromEntries(f));
  if (!p.success || f.get("confirm") !== "on")
    finish("/admin/premium", "Periksa data paket dan konfirmasi.");
  const { error } = await s.rpc("configure_plan", {
    p_id: p.data.id,
    p_name: p.data.name,
    p_price: p.data.price,
    p_days: p.data.days,
    p_enabled: f.get("enabled") === "on",
    p_reason: value(f, "reason"),
  });
  finish("/admin/premium", error?.message);
}
