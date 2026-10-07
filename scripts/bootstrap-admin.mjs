// Operator-only process, never exposed through an HTTP route or browser bundle.
import { createClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";

export async function bootstrapAdmin(env = process.env) {
  if (env.ZETAHUB_BOOTSTRAP_ADMIN !== "true") return "disabled";
  const email = env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.BOOTSTRAP_ADMIN_PASSWORD;
  if (
    !email ||
    !password ||
    password.length < 8 ||
    !env.NEXT_PUBLIC_SUPABASE_URL ||
    !env.SUPABASE_SERVICE_ROLE_KEY
  )
    return "missing_configuration";
  const client = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, signal: AbortSignal.timeout(10000) }),
      },
    },
  );
  // Fail before creating an Auth account if migrations are not installed.
  for (const table of ["profiles", "user_roles", "admin_audit_logs"]) {
    const { error } = await client.from(table).select("*").limit(0);
    if (error)
      return ["PGRST205", "42P01"].includes(error.code)
        ? "schema_missing"
        : "database_access_failed";
  }
  let user;
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) return "auth_access_failed";
    user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email,
    );
    if (user || data.users.length < 100) break;
  }
  if (!user) {
    const { data, error } = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) return "account_creation_failed";
    user = data.user;
  }
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile) return "profile_missing";
  const { data: roles, error: roleError } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  if (roleError) return "role_lookup_failed";
  if (roles.some((r) => ["admin", "super_admin", "owner"].includes(r.role)))
    return "already_admin";
  // Audit the privileged operation BEFORE changing credentials or permissions.
  const { error: auditError } = await client.from("admin_audit_logs").insert({
    actor: user.id,
    target: user.id,
    action: "bootstrap-admin-requested",
    reason:
      "Deployment operator explicitly requested initial administrator provisioning",
    metadata: { operator: "deployment", role: "admin" },
  });
  if (auditError) return "audit_failed";
  const { error: passwordError } = await client.auth.admin.updateUserById(
    user.id,
    { password, email_confirm: true },
  );
  if (passwordError) return "account_update_failed";
  const { error: grantError } = await client
    .from("user_roles")
    .insert({ user_id: user.id, role: "admin" });
  if (grantError && grantError.code !== "23505") return "role_grant_failed";
  const { error: completedAuditError } = await client
    .from("admin_audit_logs")
    .insert({
      actor: user.id,
      target: user.id,
      action: "bootstrap-admin-completed",
      reason: "Initial administrator provisioned by deployment operator",
      metadata: { operator: "deployment", role: "admin" },
    });
  return completedAuditError ? "completion_audit_failed" : "created";
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const result = await bootstrapAdmin();
    if (result !== "disabled") console.log(`Admin provisioning: ${result}`);
  } catch {
    // SDK errors may contain request data: never log raw errors or configuration.
    console.error("Admin provisioning: unavailable");
  }
}
