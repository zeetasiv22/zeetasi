import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { bootstrapAdmin } from "./bootstrap-admin.mjs";
const env = { ...process.env };
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match && !env[match[1]]) env[match[1]] = match[2].replace(/^"|"$/g, "");
}
assert.ok(
  env.NEXT_PUBLIC_SUPABASE_URL?.startsWith("http://127.0.0.1:"),
  "Only disposable local Supabase is allowed",
);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  opts,
);
const userClient = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  opts,
);
const email = `bootstrap-${crypto.randomUUID()}@example.test`;
const password = crypto.randomUUID() + "Aa1!";
const target = {
  ...env,
  ZETAHUB_BOOTSTRAP_ADMIN: "true",
  BOOTSTRAP_ADMIN_EMAIL: email,
  BOOTSTRAP_ADMIN_PASSWORD: password,
};
let id;
try {
  assert.equal(await bootstrapAdmin({}), "disabled");
  assert.equal(
    await bootstrapAdmin({ ZETAHUB_BOOTSTRAP_ADMIN: "true" }),
    "missing_configuration",
  );
  const denied = await bootstrapAdmin({
    ...target,
    SUPABASE_SERVICE_ROLE_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  assert.equal(denied, "auth_access_failed");
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "owner" },
  });
  assert.equal(created.error, null);
  id = created.data.user.id;
  assert.equal(
    (await admin.from("user_roles").select("role").eq("user_id", id)).data
      .length,
    0,
  );
  assert.equal(
    (await admin.from("profiles").delete().eq("id", id)).error,
    null,
  );
  const sql = readFileSync(
    "supabase/migrations/202610010010_backfill_profiles.sql",
    "utf8",
  );
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_security",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: sql + sql, stdio: ["pipe", "pipe", "pipe"] },
  );
  const restored = await admin
    .from("profiles")
    .select("is_public,xp")
    .eq("id", id)
    .single();
  assert.equal(restored.error, null);
  assert.deepEqual(restored.data, { is_public: false, xp: 0 });
  assert.equal(
    (await admin.from("user_roles").select("role").eq("user_id", id)).data
      .length,
    0,
  );
  assert.equal(await bootstrapAdmin(target), "created");
  assert.equal(
    await bootstrapAdmin({
      ...target,
      BOOTSTRAP_ADMIN_PASSWORD: "DoNotResetPassword123!",
    }),
    "already_admin",
  );
  const login = await userClient.auth.signInWithPassword({ email, password });
  assert.equal(login.error, null);
  assert.equal((await userClient.rpc("can", { p: "operations" })).data, true);
  assert.equal((await userClient.rpc("can", { p: "roles" })).data, false);
  assert.deepEqual(
    (await admin.from("user_roles").select("role").eq("user_id", id)).data,
    [{ role: "admin" }],
  );
  const audit = await admin
    .from("admin_audit_logs")
    .select("action")
    .eq("target", id)
    .order("created_at");
  assert.deepEqual(
    audit.data.map((row) => row.action),
    ["bootstrap-admin-requested", "bootstrap-admin-completed"],
  );
  console.log(
    "PASS local backfill is idempotent and does not grant roles; admin bootstrap requires service credentials, is audited, permits login, and does not reset or elevate on retry",
  );
} finally {
  if (id) {
    await admin.from("admin_audit_logs").delete().eq("target", id);
    await admin.auth.admin.deleteUser(id);
  }
}
