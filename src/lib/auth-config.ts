// Read only trusted deployment configuration, never the request Host header.
export function appOrigin(
  env: Record<string, string | undefined> = process.env,
): string {
  const deployed = !!env.RENDER_EXTERNAL_URL;
  for (const value of [env.NEXT_PUBLIC_APP_URL, env.RENDER_EXTERNAL_URL]) {
    if (!value) continue;
    try {
      const url = new URL(value);
      if (
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== "/"
      )
        continue;
      const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      if (
        url.protocol !== "https:" &&
        !(url.protocol === "http:" && local && !deployed)
      )
        continue;
      return url.origin;
    } catch {
      /* Try the hosting platform's canonical URL. */
    }
  }
  throw new Error("Alamat aplikasi belum dikonfigurasi dengan benar.");
}

export function authErrorMessage(code?: string) {
  if (
    ["over_email_send_rate_limit", "over_request_rate_limit"].includes(
      code || "",
    )
  )
    return "Terlalu banyak permintaan. Tunggu beberapa menit sebelum mencoba lagi.";
  if (code === "email_address_not_authorized")
    return "Pengiriman email belum tersedia untuk alamat ini. Hubungi pengelola untuk mengaktifkan layanan email.";
  if (code === "email_provider_disabled" || code === "signup_disabled")
    return "Pendaftaran email belum diaktifkan oleh pengelola.";
  if (code === "unexpected_failure")
    return "Akun belum dapat disimpan. Pengelola perlu memeriksa konfigurasi database.";
  return "Permintaan belum berhasil. Periksa email dan coba kembali.";
}
