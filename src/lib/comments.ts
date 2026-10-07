/** Only discussion screens are valid mutation destinations; never redirect to an external origin. */
export function commentReturnPath(value: string): string {
  if (value === "/open-cinema") return value;
  if (value.length > 400 || /[\\\x00-\x20\x7f]/.test(value))
    return "/community";
  if (
    /^\/(?:title|streaming)\/[a-z0-9-]+$/.test(value) ||
    /^\/watch\/[a-f0-9-]{36}$/.test(value)
  )
    return value;
  if (/^\/community(?:\/[a-f0-9-]{36})?$/.test(value)) return value;
  if (value.startsWith("/community?target=")) {
    const url = new URL(value, "https://zetahub.invalid");
    return `/community?target=${encodeURIComponent((url.searchParams.get("target") || "community").slice(0, 100))}`;
  }
  return "/community";
}
