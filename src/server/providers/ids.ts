/** Opaque provider-qualified IDs. Never interpret an ID as a remote URL. */
export function providerId(provider: string, id: string) {
  return `rp_${provider}_${Buffer.from(id).toString("base64url")}`;
}
export function parseProviderId(value: string): {
  provider: string;
  id: string;
} {
  const m = /^rp_([a-z0-9-]{1,50})_([A-Za-z0-9_-]{1,1400})$/.exec(value);
  if (!m) throw new Error("INVALID_ID");
  const id = Buffer.from(m[2], "base64url").toString("utf8");
  if (
    !id ||
    id.length > 1000 ||
    /[\x00-\x1f\x7f]/.test(id) ||
    Buffer.from(id).toString("base64url") !== m[2]
  )
    throw new Error("INVALID_ID");
  return { provider: m[1], id };
}
