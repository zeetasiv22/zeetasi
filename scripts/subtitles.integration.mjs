import assert from "node:assert/strict";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
nextEnv.loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.ok(
  url?.startsWith("http://127.0.0.1:"),
  "Disposable local Supabase only",
);
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const anon = createClient(
  url,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  options,
);
const users = [];
const title = `subtitles-${crypto.randomUUID()}`;
const episode = crypto.randomUUID();
const source = crypto.randomUUID();
const track = {
  id: crypto.randomUUID(),
  episode_id: episode,
  language: "id",
  label: "Indonesia",
  url: "/media/zeta-orbit-id.vtt",
  license: "ZetaHub original CC0",
  enabled: true,
};
let count = 0;
const check = (condition, label) => {
  assert.ok(condition, label);
  count++;
  console.log("PASS", label);
};
const requireOk = (result) => {
  assert.equal(result.error, null, result.error?.message);
  return result.data;
};
const browser = (...args) =>
  execFileSync("coderabbit-agent-browser", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30000,
  });
const evaluate = (js) => JSON.parse(browser("eval", js));
try {
  for (let i = 0; i < 2; i++) {
    const email = `subtitle-${crypto.randomUUID()}@example.test`,
      password = crypto.randomUUID() + "Aa1!";
    const created = requireOk(
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      }),
    );
    const client = createClient(
      url,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      options,
    );
    users.push({ id: created.user.id, client });
    requireOk(await client.auth.signInWithPassword({ email, password }));
  }
  requireOk(
    await admin
      .from("user_roles")
      .insert({ user_id: users[1].id, role: "admin" }),
  );
  requireOk(
    await admin
      .from("catalog_titles")
      .insert({
        id: title,
        title: "Subtitle integration fixture",
        published: true,
      }),
  );
  requireOk(
    await admin
      .from("episodes")
      .insert({
        id: episode,
        title_id: title,
        number: 1,
        title: "Original caption test",
        duration: 24,
        published: true,
      }),
  );
  requireOk(
    await admin
      .from("playback_sources")
      .insert({
        id: source,
        episode_id: episode,
        url: "/media/zeta-orbit.webm",
        license: "CC0 original",
        type: "video/webm",
      }),
  );
  const args = {
    p_section: "subtitles",
    p_record: track,
    p_reason: "Local caption integration verification",
  };
  check(
    !!(await users[0].client.rpc("manage_record", args)).error,
    "ordinary account cannot add subtitles",
  );
  requireOk(await users[1].client.rpc("manage_record", args));
  check(
    requireOk(
      await anon.from("episode_subtitles").select("id").eq("id", track.id),
    ).length === 1,
    "published free subtitles readable",
  );
  check(
    requireOk(
      await admin
        .from("admin_audit_logs")
        .select("action")
        .eq("actor", users[1].id)
        .eq("target", track.id),
    ).some((row) => row.action === "save:subtitles"),
    "subtitle management audited",
  );
  const invalid = await admin
    .from("episode_subtitles")
    .insert({ ...track, id: crypto.randomUUID(), language: "invalid<script>" });
  check(!!invalid.error, "database rejects invalid subtitle language");
  await users[0].client
    .from("episode_subtitles")
    .update({ label: "forged" })
    .eq("id", track.id);
  check(
    requireOk(
      await admin
        .from("episode_subtitles")
        .select("label")
        .eq("id", track.id)
        .single(),
    ).label === "Indonesia",
    "ordinary account cannot change captions",
  );
  requireOk(
    await admin
      .from("playback_sources")
      .update({ premium_only: true })
      .eq("id", source),
  );
  check(
    requireOk(
      await anon.from("episode_subtitles").select("id").eq("id", track.id),
    ).length === 0,
    "premium subtitles hidden from anonymous visitors",
  );
  check(
    requireOk(
      await users[0].client
        .from("episode_subtitles")
        .select("id")
        .eq("id", track.id),
    ).length === 0,
    "premium subtitles hidden from free accounts",
  );
  requireOk(
    await admin
      .from("playback_sources")
      .update({ premium_only: false })
      .eq("id", source),
  );
  requireOk(
    await admin
      .from("catalog_titles")
      .update({ published: false })
      .eq("id", title),
  );
  check(
    requireOk(
      await anon.from("episode_subtitles").select("id").eq("id", track.id),
    ).length === 0,
    "unpublished title subtitles hidden",
  );
  requireOk(
    await admin
      .from("catalog_titles")
      .update({ published: true })
      .eq("id", title),
  );
  requireOk(
    await admin
      .from("episode_subtitles")
      .update({ enabled: false })
      .eq("id", track.id),
  );
  check(
    requireOk(
      await anon.from("episode_subtitles").select("id").eq("id", track.id),
    ).length === 0,
    "disabled subtitles hidden",
  );
  requireOk(
    await admin
      .from("episode_subtitles")
      .update({ enabled: true })
      .eq("id", track.id),
  );
  if (process.argv.includes("--browser")) {
    browser("open", `http://localhost:3000/watch/${episode}`);
    const until = Date.now() + 15000;
    while (Date.now() < until) {
      if (
        evaluate(
          '(()=>{const t=document.querySelector("video").textTracks[0];return !!t?.cues?.length})()',
        )
      )
        break;
      await new Promise((r) => setTimeout(r, 300));
    }
    check(
      evaluate(
        '(()=>{const t=document.querySelector("video").textTracks[0];return t.language==="id" && t.cues.length===2 && t.mode==="showing"})()',
      ),
      "real Indonesian WebVTT cues load and show by default",
    );
    browser("select", 'select[aria-label="Subtitle"]', "off");
    check(
      evaluate(
        'document.querySelector("video").textTracks[0].mode==="disabled"',
      ),
      "subtitle can be disabled",
    );
    browser("select", 'select[aria-label="Subtitle"]', track.id);
    evaluate(
      '(()=>{const v=document.querySelector("video");v.currentTime=3;return true})()',
    );
    check(
      evaluate(
        'document.querySelector("video").textTracks[0].mode==="showing"',
      ),
      "subtitle can be reenabled",
    );
    browser("open", `http://localhost:3000/title/${title}`);
    check(
      evaluate(
        `!!document.querySelector('a[href="/watch/${episode}"]') && !document.body.textContent.includes("Tonton melalui penyedia")`,
      ),
      "title offers in-web playback without provider panel",
    );
  }
  console.log(`Subtitle integration: ${count} passed`);
} finally {
  await admin.from("catalog_titles").delete().eq("id", title);
  for (const user of users) await admin.auth.admin.deleteUser(user.id);
  if (process.argv.includes("--browser"))
    browser("open", "http://localhost:3000/watch-now");
}
