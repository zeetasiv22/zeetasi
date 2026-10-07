import assert from "node:assert/strict";
const base = process.env.APP_TEST_URL || "http://localhost:3000";
let count = 0;
async function status(path, expected, init) {
  const res = await fetch(base + path, init);
  assert.equal(res.status, expected, path);
  console.log("PASS", path, expected);
  count++;
  return res;
}
const health = await status("/api/health", 200);
assert.equal((await health.json()).database, true);
await status("/api/account/export", 401);
await status("/api/avatar", 404);
await status("/api/playback", 403, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: "https://untrusted.example",
  },
  body: "{}",
});
await status("/api/playback", 401, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: base },
  body: "{}",
});
await status("/api/jobs", 401);
await status("/api/catalog?page=-1", 400);
await status("/api/catalog?category=movies", 503); // This smoke profile intentionally has no TMDB credential.
await status("/api/payments/checkout", 401, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: base },
  body: '{"planId":"monthly"}',
});
await status("/api/payments/webhook", 503, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "{}",
});
const media = await status("/media/zeta-orbit.webm", 200);
assert.ok((media.headers.get("content-type") || "").includes("video/webm"));
assert.ok((await media.arrayBuffer()).byteLength > 100000);
await status("/manifest.webmanifest", 200);
await status("/offline.html", 200);
await status("/icons/icon-192.png", 200);
console.log(`HTTP smoke: ${count} passed`);
