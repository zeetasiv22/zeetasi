// Requires the registered shared Preview browser and disposable local Supabase.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
nextEnv.loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.ok(
  url?.startsWith("http://127.0.0.1:"),
  "Only disposable local Supabase",
);
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const browser = (...args) =>
  execFileSync("coderabbit-agent-browser", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30000,
  });
const evaluate = (js) => JSON.parse(browser("eval", js));
const waitFor = async (test, label) => {
  const until = Date.now() + 25000;
  while (Date.now() < until) {
    if (await test()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out: ${label}`);
};
const email = `browser-${crypto.randomUUID()}@example.test`;
const password = crypto.randomUUID() + "Aa1!";
const created = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
assert.equal(created.error, null);
const uid = created.data.user.id;
try {
  browser("open", "http://localhost:3000/login");
  browser("fill", 'input[name="email"]', email);
  browser("fill", 'input[name="password"]', password);
  browser("click", 'form:has(input[name="password"]) button');
  await waitFor(() => !browser("get", "url").includes("/login"), "login");
  browser("open", "http://localhost:3000/open-cinema");
  await waitFor(
    () => evaluate('document.querySelector("video").readyState >= 2'),
    "video metadata",
  );
  const media = evaluate(
    '(()=>{const v=document.querySelector("video");return {duration:v.duration,height:v.videoHeight}})()',
  );
  assert.ok(media.duration > 634 && media.duration < 635);
  evaluate(
    '(async()=>{const v=document.querySelector("video");v.muted=true;v.currentTime=30;v.playbackRate=1.5;await v.play();return true})()',
  );
  browser("select", 'select[aria-label="Resolusi video"]', "bbb-360");
  await waitFor(
    () =>
      evaluate(
        '(()=>{const v=document.querySelector("video");return v.videoHeight===360 && !v.paused && v.currentTime>=30})()',
      ),
    "quality switch resumes playback",
  );
  const after = evaluate(
    '(()=>{const v=document.querySelector("video");return {position:v.currentTime,rate:v.playbackRate,frames:v.getVideoPlaybackQuality().totalVideoFrames}})()',
  );
  assert.ok(after.position < 55);
  assert.equal(after.rate, 1.5);
  assert.ok(after.frames > 0);
  console.log(
    "PASS full film decoded; quality switch preserves position, speed and playing state",
  );
  evaluate('document.querySelector("video").pause()');
  const body = "Komentar pengujian browser " + crypto.randomUUID();
  browser("fill", 'textarea[name="body"]', body);
  browser("click", 'form:has(textarea[name="body"]) button');
  await waitFor(
    async () =>
      (
        await admin
          .from("comments")
          .select("id")
          .eq("user_id", uid)
          .eq("body", body)
      ).data?.length === 1,
    "comment stored",
  );
  await waitFor(
    () =>
      evaluate(`document.body.textContent.includes(${JSON.stringify(body)})`),
    "comment rendered",
  );
  assert.ok(browser("get", "url").includes("/open-cinema"));
  browser("reload");
  assert.ok(
    evaluate(`document.body.textContent.includes(${JSON.stringify(body)})`),
  );
  const comment = (
    await admin
      .from("comments")
      .select("id")
      .eq("user_id", uid)
      .eq("body", body)
      .single()
  ).data;
  browser("click", "article.comment form:first-of-type button");
  await waitFor(
    async () =>
      (
        await admin
          .from("comment_likes")
          .select("comment_id")
          .eq("user_id", uid)
          .eq("comment_id", comment.id)
      ).data?.length === 1,
    "like stored",
  );
  browser("click", "article.comment form:last-of-type button");
  await waitFor(
    async () =>
      (await admin.from("comments").select("id").eq("id", comment.id)).data
        ?.length === 0,
    "comment deleted",
  );
  assert.ok(browser("get", "url").includes("/open-cinema"));
  console.log(
    "PASS comment creates, persists after reload, likes and deletes without losing film context",
  );
  browser("set", "viewport", "390", "844");
  browser("open", "http://localhost:3000/watch-now");
  assert.ok(evaluate("document.documentElement.scrollWidth <= innerWidth"));
  console.log("PASS mobile watchable catalog has no horizontal overflow");
} finally {
  await admin.auth.admin.deleteUser(uid);
  browser("set", "viewport", "1440", "900");
  browser("open", "http://localhost:3000/watch-now");
}
