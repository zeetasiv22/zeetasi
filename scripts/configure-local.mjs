import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
if (existsSync(".env.local") && !process.argv.includes("--replace"))
  throw new Error(
    ".env.local already exists. Use --replace only for disposable local configuration.",
  );
const output = execFileSync("npx", ["supabase", "status", "-o", "env"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"],
});
const values = Object.fromEntries(
  output
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
    }),
);
if (!values.API_URL || !values.ANON_KEY || !values.SERVICE_ROLE_KEY)
  throw new Error("Local Supabase is not ready.");
writeFileSync(
  ".env.local",
  `NEXT_PUBLIC_APP_URL=http://localhost:3000\nNEXT_PUBLIC_SUPABASE_URL=${values.API_URL}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${values.ANON_KEY}\nSUPABASE_SERVICE_ROLE_KEY=${values.SERVICE_ROLE_KEY}\nANILIST_API_URL=https://graphql.anilist.co\n`,
  { mode: 0o600 },
);
console.log(
  "Configured .env.local for local Supabase. Credentials are not printed.",
);
