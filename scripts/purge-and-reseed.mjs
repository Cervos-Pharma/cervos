/**
 * Purges the workspace_db Supabase table (removes all accounts and data for a clean slate)
 * and re-seeds the HQ admin account.
 *
 * Run: node scripts/purge-and-reseed.mjs
 *
 * WARNING: This deletes ALL user accounts. Only run in dev/test or when resetting prod.
 */
import { readFileSync } from "fs";
import { createRequire } from "module";
import { scrypt, randomBytes, createHmac } from "crypto";
import { promisify } from "util";

const require = createRequire(import.meta.url);
const scryptAsync = promisify(scrypt);

// Load .env.local
const envFile = new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
let envText = "";
try { envText = readFileSync(envFile, "utf8"); } catch { /* ignore */ }
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const { createClient } = require("@supabase/supabase-js");
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function hashScrypt(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt}$${derived.toString("hex")}`;
}

async function main() {
  console.log("[purge-and-reseed] Purging workspace_db...");

  // Upsert empty snapshot to workspace_db (or create a clean slate)
  const { error: upsertErr } = await sb
    .from("workspace_db")
    .upsert(
      { shard: "main", snapshot: { accounts: [], centres: [], profiles: [], passkeys: [] }, updated_at: new Date().toISOString() },
      { onConflict: "shard" }
    );
  if (upsertErr) {
    if (upsertErr.code === "PGRST116" || upsertErr.message?.includes("not found")) {
      console.error(
        "\n[purge-and-reseed] workspace_db table does not exist yet.\n" +
        "Please run this SQL in your Supabase SQL Editor first:\n" +
        "https://supabase.com/dashboard/project/" +
        new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0] +
        "/sql/new\n\n" +
        "CREATE TABLE IF NOT EXISTS workspace_db (\n" +
        "  shard text PRIMARY KEY DEFAULT 'main',\n" +
        "  snapshot jsonb NOT NULL DEFAULT '{}',\n" +
        "  updated_at timestamptz NOT NULL DEFAULT now()\n" +
        ");\n" +
        "ALTER TABLE workspace_db ENABLE ROW LEVEL SECURITY;\n" +
        "CREATE POLICY workspace_db_deny_all ON workspace_db USING (false) WITH CHECK (false);\n"
      );
      process.exit(1);
    }
    console.error("[purge-and-reseed] workspace_db upsert failed:", upsertErr.message);
    process.exit(1);
  }
  console.log("[purge-and-reseed] workspace_db cleared (clean empty snapshot written).");

  // Re-seed HQ admin
  const hqEmail = process.env.HQ_ADMIN_EMAIL || "cervospharma@gmail.com";
  const hqPassword = "threebodyproblem";
  const hqHash = await hashScrypt(hqPassword);

  const { error: hqErr } = await sb
    .from("hq_admins")
    .upsert(
      {
        email: hqEmail,
        password_hash: hqHash,
        name: "Cervos HQ Operator",
        role: "super_admin",
        disabled: false,
      },
      { onConflict: "email" }
    );
  if (hqErr) {
    console.error("[purge-and-reseed] hq_admins upsert failed:", hqErr.message);
  } else {
    console.log("[purge-and-reseed] HQ admin re-seeded:", hqEmail);
  }

  // Also update .env.local HQ_ADMIN_HASH
  try {
    let envContent = readFileSync(envFile, "utf8");
    if (envContent.includes("HQ_ADMIN_HASH=")) {
      envContent = envContent.replace(/^HQ_ADMIN_HASH=.*/m, `HQ_ADMIN_HASH=${hqHash}`);
    } else {
      envContent += `\nHQ_ADMIN_HASH=${hqHash}`;
    }
    if (envContent.includes("HQ_ADMIN_EMAIL=")) {
      envContent = envContent.replace(/^HQ_ADMIN_EMAIL=.*/m, `HQ_ADMIN_EMAIL=${hqEmail}`);
    } else {
      envContent += `\nHQ_ADMIN_EMAIL=${hqEmail}`;
    }
    const { writeFileSync } = await import("fs");
    writeFileSync(envFile, envContent, "utf8");
    console.log("[purge-and-reseed] .env.local updated with new HQ_ADMIN_HASH.");
  } catch (e) {
    console.warn("[purge-and-reseed] Could not update .env.local:", e.message);
  }

  console.log("\n[purge-and-reseed] Done. Fresh clean slate ready.");
  console.log("  - workspace_db: empty (no demo accounts)");
  console.log("  - HQ admin:    ", hqEmail);
  console.log("\nNext: deploy to Vercel and test signup + login flow.");
}

main().catch((e) => {
  console.error("[purge-and-reseed] Fatal:", e.message);
  process.exit(1);
});
