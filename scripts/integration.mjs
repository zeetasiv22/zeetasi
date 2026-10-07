import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.ok(
  url?.startsWith("http://127.0.0.1:"),
  "Integration tests require disposable local Supabase",
);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, opts);
const a = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, opts);
const b = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, opts);
const staff = createClient(
  url,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  opts,
);
const ids = [];
let passed = 0;
const ok = (x, label) => {
  assert.ok(x, label);
  passed++;
  console.log("PASS", label);
};
const requireOk = (result) => {
  assert.equal(result.error, null, result.error?.message);
  return result.data;
};
try {
  for (const [index, client] of [a, b, staff].entries()) {
    const email = `zeta-test-${Date.now()}-${index}@example.test`;
    const password = crypto.randomUUID() + "Aa1!";
    const { data, error } = await client.auth.signUp({ email, password });
    assert.equal(error, null, error?.message);
    assert.ok(data.user);
    ids.push(data.user.id);
    if (!data.session) {
      await admin.auth.admin.updateUserById(data.user.id, {
        email_confirm: true,
      });
      requireOk(await client.auth.signInWithPassword({ email, password }));
    }
  }
  const [uid, other, sid] = ids;
  ok(ids.length === 3, "Supabase registration and login");
  requireOk(
    await a.rpc("update_profile", {
      p_username: `test_${Date.now()}`,
      p_name: "Integration Explorer",
      p_bio: "Synthetic test",
      p_public: false,
    }),
  );
  ok(
    (await a.from("profiles").select("display_name").eq("id", uid).single())
      .data?.display_name === "Integration Explorer",
    "Profile persists",
  );
  ok(
    (await b.from("profiles").select("id").eq("id", uid)).data?.length === 0,
    "Private profile hidden from other users",
  );
  const escalation = await a
    .from("user_roles")
    .insert({ user_id: uid, role: "owner" });
  ok(!!escalation.error, "Self-promotion denied by RLS");
  await a.from("profiles").update({ xp: 999999 }).eq("id", uid);
  ok(
    (await admin.from("profiles").select("xp").eq("id", uid).single()).data
      .xp === 0,
    "Direct XP manipulation rejected",
  );
  ok(
    !!(
      await a.rpc("staff_action", {
        p_action: "grant_premium",
        p_target: uid,
        p_value: "2027-01-01T00:00:00Z",
        p_reason: "test forbidden grant",
      })
    ).error,
    "Unauthorized manual premium denied",
  );
  requireOk(
    await a.from("watchlist_items").insert({
      user_id: uid,
      title_id: "zeta-orbit",
      title: "Zeta Orbit",
      poster: "/placeholder.svg",
    }),
  );
  ok(
    (await a.from("watchlist_items").select("*")).data.length === 1,
    "Watchlist persists",
  );
  ok(
    (await b.from("watchlist_items").select("*")).data.length === 0,
    "Watchlist isolation",
  );
  requireOk(
    await a.rpc("add_comment", {
      p_target: "integration-test",
      p_body: "Hello from integration test",
      p_spoiler: true,
    }),
  );
  const comment = requireOk(
    await a.from("comments").select("id").eq("user_id", uid).single(),
  );
  await b.from("comments").delete().eq("id", comment.id);
  ok(
    !!(await a.from("comments").select("id").eq("id", comment.id).maybeSingle())
      .data,
    "Other users cannot delete comments",
  );
  requireOk(
    await a
      .from("title_follows")
      .insert({ user_id: uid, title_id: "zeta-orbit" }),
  );
  ok(
    (await a.from("title_follows").select("*")).data.length === 1,
    "Series following persists",
  );
  ok(
    !!(await a.rpc("equip_avatar", { item: "premium" })).error,
    "Premium avatar cannot be equipped without entitlement",
  );
  requireOk(await a.rpc("equip_avatar", { item: "orbit" }));
  ok(
    (await a.from("user_avatar_equipment").select("frame_id").single()).data
      .frame_id === "orbit",
    "Owned avatar frame persists",
  );
  const eid = "00000000-0000-4000-8000-000000000001";
  let session = requireOk(await a.rpc("start_viewing", { eid }));
  requireOk(await a.rpc("heartbeat", { sid: session, pos: 24 }));
  ok(
    (await a.from("episode_completions").select("*")).data.length === 0,
    "Instant seek to end does not earn completion",
  );
  for (const episode of [eid, "00000000-0000-4000-8000-000000000002"]) {
    session = requireOk(await a.rpc("start_viewing", { eid: episode }));
    // Controlled time fixture: move last_ping in privileged test context only; no production shortcut.
    for (const position of [12, 24]) {
      requireOk(
        await admin
          .from("viewing_sessions")
          .update({ last_ping: new Date(Date.now() - 12000).toISOString() })
          .eq("id", session),
      );
      requireOk(await a.rpc("heartbeat", { sid: session, pos: position }));
    }
    for (let retry = 0; retry < 3; retry++)
      requireOk(await a.rpc("heartbeat", { sid: session, pos: 24 }));
  }
  ok(
    (await a.from("episode_completions").select("*")).data.length === 2,
    "Unique server-validated episode completion",
  );
  ok(
    (await a.from("xp_transactions").select("*")).data.length === 2,
    "Retries do not duplicate XP",
  );
  ok(
    (await a.from("ad_events").select("*")).data.length === 1,
    "One ad eligibility after exactly two completions",
  );
  ok(
    (await a.from("notifications").select("*")).data.length === 2,
    "Completion notifications persist without duplicates",
  );
  ok(
    (await a.from("watch_progress").select("*")).data.every(
      (x) => x.position === 24,
    ),
    "Resume positions persist",
  );
  requireOk(
    await admin.from("user_roles").insert({ user_id: sid, role: "owner" }),
  );
  requireOk(
    await staff.rpc("staff_action", {
      p_action: "grant_premium",
      p_target: uid,
      p_value: "2027-01-01T00:00:00Z",
      p_reason: "Integration manual grant",
    }),
  );
  ok(
    (await a.rpc("premium", { uid })).data === true,
    "Authorized manual premium grant",
  );
  ok(
    (await staff.from("admin_audit_logs").select("*").eq("target", uid)).data
      .length === 1,
    "Manual grant has audit record",
  );
  ok(
    !!(
      await staff.rpc("staff_action", {
        p_action: "role",
        p_target: sid,
        p_value: "user",
        p_reason: "Test owner protection",
      })
    ).error,
    "Owner cannot downgrade self",
  );
  requireOk(
    await staff.rpc("staff_action", {
      p_action: "role",
      p_target: other,
      p_value: "moderator",
      p_reason: "Test delegated moderation",
    }),
  );
  ok(
    (await b.rpc("can", { p: "moderate" })).data === true,
    "Moderator receives only explicit permission",
  );
  ok(
    (await b.rpc("can", { p: "roles" })).data === false,
    "Moderator cannot assign roles",
  );
  requireOk(await a.rpc("equip_avatar", { item: "premium" }));
  ok(
    (await a.from("user_avatar_equipment").select("frame_id").single()).data
      .frame_id === "premium",
    "Premium cosmetic enforcement",
  );
  const order = "test-" + crypto.randomUUID();
  requireOk(
    await admin.from("payment_events").insert({
      user_id: uid,
      plan_id: "monthly",
      order_id: order,
      amount: 29000,
    }),
  );
  ok(
    !!(
      await a.rpc("settle_payment", {
        p_order: order,
        p_status: "settlement",
        p_amount: 29000,
      })
    ).error,
    "Browser cannot reconcile payments",
  );
  requireOk(
    await admin.rpc("settle_payment", {
      p_order: order,
      p_status: "settlement",
      p_amount: 29000,
    }),
  );
  requireOk(
    await admin.rpc("settle_payment", {
      p_order: order,
      p_status: "settlement",
      p_amount: 29000,
    }),
  );
  ok(
    (await admin.from("subscriptions").select("*").eq("reference", order)).data
      .length === 1,
    "Payment settlement idempotency",
  );
  requireOk(
    await admin.rpc("settle_payment", {
      p_order: order,
      p_status: "refund",
      p_amount: 29000,
    }),
  );
  requireOk(
    await admin.rpc("settle_payment", {
      p_order: order,
      p_status: "settlement",
      p_amount: 29000,
    }),
  );
  ok(
    (
      await admin
        .from("subscriptions")
        .select("status")
        .eq("reference", order)
        .single()
    ).data.status === "revoked",
    "Refund cannot be undone by late settlement",
  );
  ok(
    !!(
      await admin.rpc("settle_payment", {
        p_order: order,
        p_status: "settlement",
        p_amount: 1,
      })
    ).error,
    "Payment amount mismatch rejected",
  );
  const cat = {
    id: "integration-title",
    title: "Test title",
    description: "Synthetic",
    poster: "/placeholder.svg",
    banner: "/placeholder.svg",
    year: 2026,
    genres: [],
    country: "",
    published: false,
    license: "CC0 test fixture",
  };
  requireOk(
    await staff.rpc("manage_record", {
      p_section: "catalog",
      p_record: cat,
      p_reason: "Test catalog creation",
    }),
  );
  requireOk(
    await staff.rpc("manage_record", {
      p_section: "catalog",
      p_record: { ...cat, title: "Updated" },
      p_reason: "Test catalog update",
    }),
  );
  ok(
    (
      await staff
        .from("catalog_titles")
        .select("title")
        .eq("id", cat.id)
        .single()
    ).data.title === "Updated",
    "Admin catalog insert/update",
  );
  await admin.from("catalog_titles").delete().eq("id", cat.id);

  // Publication and follow notifications, including opt-out and replay behavior.
  requireOk(
    await b
      .from("title_follows")
      .insert({ user_id: other, title_id: "zeta-orbit" }),
  );
  requireOk(
    await b
      .from("notification_preferences")
      .update({ series: false })
      .eq("user_id", other),
  );
  const source = requireOk(
    await admin
      .from("playback_sources")
      .select("id")
      .eq("episode_id", eid)
      .single(),
  );
  requireOk(
    await admin
      .from("playback_sources")
      .update({ enabled: true })
      .eq("id", source.id),
  );
  requireOk(
    await admin
      .from("playback_sources")
      .update({ enabled: true })
      .eq("id", source.id),
  );
  ok(
    (await a.from("notifications").select("id").eq("category", "series")).data
      .length === 1,
    "Publication notifies followers once",
  );
  ok(
    (await b.from("notifications").select("id").eq("category", "series")).data
      .length === 0,
    "Publication respects notification opt-out",
  );
  ok(
    !!(
      await a.rpc("configure_setting", {
        p_key: "ads",
        p_value: { frequency: 1 },
        p_reason: "Test forbidden configuration",
      })
    ).error,
    "User cannot change ad settings",
  );
  const originalAds = requireOk(
    await admin
      .from("application_settings")
      .select("value")
      .eq("key", "ads")
      .single(),
  );
  requireOk(
    await staff.rpc("configure_setting", {
      p_key: "ads",
      p_value: originalAds.value,
      p_reason: "Test audited configuration",
    }),
  );
  ok(
    (
      await staff
        .from("admin_audit_logs")
        .select("id")
        .eq("action", "configure")
        .eq("target", "ads")
    ).data.length > 0,
    "Configuration edits are audited",
  );
  const dashboard = requireOk(await staff.rpc("operational_metrics"));
  ok(
    dashboard.accounts >= 3 && typeof dashboard.verified_revenue === "number",
    "Operational metrics use database aggregates",
  );
  ok(
    !!(await a.rpc("operational_metrics")).error,
    "Operational metrics deny ordinary users",
  );
  for (const period of ["week", "month", "all"]) {
    const board = requireOk(
      await a.rpc("period_leaderboard", { p_period: period }),
    );
    ok(
      !board.some((row) => row.display_name === "Integration Explorer"),
      `${period} leaderboard respects private profile`,
    );
  }
  // Stationary heartbeats never accrue time, even with a privileged clock fixture.
  const stat = requireOk(await b.rpc("start_viewing", { eid }));
  requireOk(
    await admin
      .from("viewing_sessions")
      .update({ last_ping: new Date(Date.now() - 30000).toISOString() })
      .eq("id", stat),
  );
  requireOk(await b.rpc("heartbeat", { sid: stat, pos: 0 }));
  ok(
    (
      await b
        .from("watch_progress")
        .select("watched_seconds")
        .eq("episode_id", eid)
        .single()
    ).data.watched_seconds === 0,
    "Paused/stationary playback cannot earn credit",
  );
  requireOk(
    await admin
      .from("viewing_sessions")
      .update({ last_ping: new Date(Date.now() - 12000).toISOString() })
      .eq("id", stat),
  );
  requireOk(await b.rpc("heartbeat", { sid: stat, pos: 12 }));
  const resumed = requireOk(await b.rpc("start_viewing", { eid }));
  requireOk(
    await admin
      .from("viewing_sessions")
      .update({ last_ping: new Date(Date.now() - 12000).toISOString() })
      .eq("id", resumed),
  );
  requireOk(await b.rpc("heartbeat", { sid: resumed, pos: 24 }));
  ok(
    (
      await b
        .from("episode_completions")
        .select("episode_id")
        .eq("episode_id", eid)
    ).data.length === 1,
    "Resume retains validated watch time across sessions",
  );
  await a.auth.signOut();
  ok((await a.auth.getUser()).data.user === null, "Logout clears session");
  console.log(`Integration tests: ${passed} passed`);
} finally {
  for (const id of ids) await admin.auth.admin.deleteUser(id);
  await admin.from("admin_audit_logs").delete().like("reason", "Integration%");
  await admin.from("admin_audit_logs").delete().like("reason", "Test%");
}
