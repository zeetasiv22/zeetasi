import assert from "node:assert/strict";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
nextEnv.loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.ok(
  url?.startsWith("http://127.0.0.1:"),
  "Only disposable local Supabase",
);
const options = { auth: { persistSession: false } };
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const anon = createClient(
  url,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  options,
);
const suffix = crypto.randomUUID();
const host = `fixture-${suffix}.p.rapidapi.com`;
const monthlyHost = `month-${suffix}.p.rapidapi.com`;
const user = await admin.auth.admin.createUser({
  email: `provider-${suffix}@example.test`,
  password: `Aa1!${suffix}`,
  email_confirm: true,
});
assert.equal(user.error, null);
const authenticated = createClient(
  url,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  options,
);
assert.equal(
  (
    await authenticated.auth.signInWithPassword({
      email: `provider-${suffix}@example.test`,
      password: `Aa1!${suffix}`,
    })
  ).error,
  null,
);
try {
  for (const client of [anon, authenticated]) {
    for (const table of [
      "external_providers",
      "external_titles",
      "external_episodes",
      "external_playback_sources",
      "provider_cache",
      "provider_quota",
    ]) {
      assert.ok(
        (await client.from(table).select("*")).error,
        `${table}: client read must be denied`,
      );
    }
    assert.ok(
      (await client.rpc("reserve_provider_request", { p_host: host })).error,
      "browser cannot modify quotas",
    );
    assert.ok(
      (
        await client.from("provider_cache").insert({
          key: suffix,
          payload: { secret: "synthetic" },
          expires_at: new Date().toISOString(),
        })
      ).error,
      "browser cannot inject sources/cache",
    );
  }
  for (const client of [anon, authenticated])
    assert.ok(
      (
        await client.rpc("record_provider_health", {
          p_provider: suffix,
          p_health: { checks: { search: { pass: true } } },
        })
      ).error,
      "clients cannot overwrite health",
    );
  const observations = await Promise.all(
    ["search", "title", "episodes", "playback"].map((operation) =>
      admin.rpc("record_provider_health", {
        p_provider: suffix,
        p_health: { checks: { [operation]: { pass: true } } },
      }),
    ),
  );
  observations.forEach((r) => assert.equal(r.error, null));
  const health = await admin
    .from("external_providers")
    .select("health")
    .eq("id", suffix)
    .single();
  assert.equal(health.error, null);
  assert.equal(
    Object.keys(health.data.health.checks).length,
    4,
    "concurrent diagnostics preserve all operation results",
  );
  const calls = await Promise.all(
    Array.from({ length: 35 }, () =>
      admin.rpc("reserve_provider_request", {
        p_host: host,
        p_monthly_limit: 1000,
      }),
    ),
  );
  calls.forEach((c) => assert.equal(c.error, null));
  assert.equal(
    calls.filter((c) => c.data === true).length,
    30,
    "global minute limit must be atomic",
  );
  const month = await Promise.all(
    Array.from({ length: 4 }, () =>
      admin.rpc("reserve_provider_request", {
        p_host: monthlyHost,
        p_monthly_limit: 2,
      }),
    ),
  );
  month.forEach((c) => assert.equal(c.error, null));
  assert.equal(
    month.filter((c) => c.data === true).length,
    2,
    "hard monthly quota",
  );
  assert.ok(
    (
      await admin.from("external_playback_sources").insert({
        episode_ref: suffix,
        provider: "synthetic",
        payload: { sources: [] },
      })
    ).error,
    "source persistence requires expiry",
  );
  assert.equal(
    (
      await admin.from("provider_cache").insert({
        key: suffix,
        payload: { fixture: true },
        expires_at: "2000-01-01T00:00:00Z",
      })
    ).error,
    null,
  );
  await admin.rpc("reserve_provider_request", {
    p_host: host,
    p_monthly_limit: 1000,
  });
  const expired = await admin
    .from("provider_cache")
    .select("key")
    .eq("key", suffix);
  assert.equal(expired.error, null);
  assert.deepEqual(expired.data, [], "expired shared cache is purged");
  console.log(
    "PASS: provider RLS, denied browser writes, atomic minute/month quotas, required source expiry and expired-cache cleanup.",
  );
} finally {
  await admin.from("external_providers").delete().eq("id", suffix);
  await admin.from("provider_quota").delete().like("key", `%${suffix}%`);
  await admin.from("provider_cache").delete().eq("key", suffix);
  await admin
    .from("external_playback_sources")
    .delete()
    .eq("episode_ref", suffix);
  await admin.auth.admin.deleteUser(user.data.user.id);
}
