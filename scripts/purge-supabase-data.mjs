/**
 * @file scripts/purge-supabase-data.mjs
 * @description Purges all tenant/user data from Supabase to provide a clean production slate.
 * Preserves the standard product catalog formulary and provisions the HQ admin account.
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local
const envPath = join(process.cwd(), ".env.local");
const envContent = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const parseEnv = (raw) => {
  const map = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) map[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return map;
};
const env = parseEnv(envContent);
const sbUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const sbKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!sbUrl || !sbKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(sbUrl, sbKey, { auth: { persistSession: false } });

async function purgeTable(table, idCol = "id") {
  try {
    const { error } = await sb.from(table).delete().neq(idCol, "00000000-0000-0000-0000-000000000000");
    if (error) {
      console.warn(`[purge] ${table}: ${error.message}`);
    } else {
      console.log(`[purge] ${table}: cleared`);
    }
  } catch (err) {
    console.warn(`[purge] ${table} error: ${err.message}`);
  }
}

async function run() {
  console.log("=== Purging Supabase Database for Clean Production Slate ===");

  // 1. Purge all child & transaction tables in strict foreign-key order
  const tables = [
    "sale_items",
    "sales",
    "batches",
    "stock",
    "inventory_items",
    "quote_answers",
    "quotes",
    "tickets",
    "payments",
    "branch_orders",
    "orders",
    "branch_operators",
    "operators",
    "invites",
    "reports",
    "audit",
    "branches",
    "accounts",
  ];

  for (const t of tables) {
    await purgeTable(t);
  }

  // 2. Clean hq_admins to keep ONLY cervospharma@gmail.com
  const hqEmail = "cervospharma@gmail.com";
  const { data: hqList } = await sb.from("hq_admins").select("id, email");
  if (hqList) {
    for (const admin of hqList) {
      if (admin.email.toLowerCase() !== hqEmail) {
        await sb.from("hq_admins").delete().eq("id", admin.id);
        console.log(`[purge] Removed non-primary HQ admin: ${admin.email}`);
      }
    }
  }

  // 3. Reset local json DB cache to clean empty slate
  const cleanDb = {
    accounts: [],
    centres: [],
    profiles: [],
    passkeys: [],
    auditLogs: [],
    batches: [],
    sales: [],
    wholesaleOrders: [],
    branchMessages: [],
    notifications: [],
    expenses: [],
  };

  const localPaths = [
    join(process.cwd(), ".local-workspace-db.json"),
    join(process.cwd(), ".next", "cache", "cervos-workspace-db.json"),
  ];

  for (const p of localPaths) {
    try {
      writeFileSync(p, JSON.stringify(cleanDb, null, 2), "utf8");
      console.log(`[purge] Reset local cache: ${p}`);
    } catch {
      // Ignore if dir doesn't exist
    }
  }

  console.log("=== Purge Complete ===");
}

run().catch((err) => {
  console.error("Purge failed:", err);
  process.exit(1);
});
