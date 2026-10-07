import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
export const configured = () =>
  !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
export async function db() {
  if (!configured())
    throw new Error("Supabase belum dikonfigurasi. Lihat panduan instalasi.");
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (items) => {
          try {
            items.forEach(({ name, value, options }) =>
              jar.set(name, value, options),
            );
          } catch {
            /* Read-only server render; refreshed by proxy. */
          }
        },
      },
    },
  );
}
export function adminDb() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("Server database belum dikonfigurasi.");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function currentUser() {
  if (!configured()) return null;
  const s = await db();
  const {
    data: { user },
  } = await s.auth.getUser();
  return user;
}

export async function accountStoreReady() {
  if (!configured()) return false;
  try {
    const s = await db();
    const { error } = await s.from("profiles").select("id").limit(0);
    return !error;
  } catch {
    return false;
  }
}
