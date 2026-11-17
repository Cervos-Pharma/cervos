/**
 * @file scripts/seed-hq-admin.mjs
 * @description Provisions an isolated Ops Admin account with a salted scrypt hash.
 * Stores the scrypt hash into Supabase `hq_admins` (when configured) and updates
 * git-ignored `.env.local` (`HQ_ADMIN_EMAIL` and `HQ_ADMIN_HASH`) without ever writing plaintext.
 *
 * Usage: node scripts/seed-hq-admin.mjs <email> <password>
 */
import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const email = (process.argv[2] || process.env.SEED_HQ_EMAIL || "").trim().toLowerCase();
const password = process.argv[3] || process.env.SEED_HQ_PASSWORD || "";

if (!email || !password) {
  console.error("Usage: node scripts/seed-hq-admin.mjs <email> <password>");
  process.exit(1);
}

const salt = randomBytes(16).toString("base64");
const derived = scryptSync(password, Buffer.from(salt, "base64"), 64, {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
}).toString("base64");
const scryptHash = `scrypt$16384$8$1$${salt}$${derived}`;

// 1. Update git-ignored .env.local cleanly
const envPath = join(process.cwd(), ".env.local");
let envContent = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const setEnvKey = (src, key, val) => {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${escaped}=.*$`, "m");
  const line = `${key}=${val}`;
  return re.test(src) ? src.replace(re, line) : `${src.trimEnd()}\n${line}\n`;
};
envContent = setEnvKey(envContent, "HQ_ADMIN_EMAIL", email);
envContent = setEnvKey(envContent, "HQ_ADMIN_HASH", scryptHash);
writeFileSync(envPath, envContent, "utf8");
console.log(`[seed-hq] Saved salted scrypt hash for ${email} in .env.local`);

// 2. Also upsert into Supabase `hq_admins` when credentials exist
const parseEnvMap = (raw) => {
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
};
const envVars = parseEnvMap(envContent);
const sbUrl = envVars.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const sbKey = envVars.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (sbUrl && sbKey && !sbUrl.includes("YOUR-PROJECT")) {
  try {
    const res = await fetch(`${sbUrl.replace(/\/$/, "")}/rest/v1/hq_admins?on_conflict=email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: sbKey,
        Authorization: `Bearer ${sbKey}`,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify([
        {
          email,
          password_hash: scryptHash,
          name: "Cervos Primary Ops",
          role: "admin",
          disabled: false,
        },
      ]),
    });
    console.log(`[seed-hq] Supabase hq_admins sync status: ${res.status}`);
  } catch (err) {
    console.warn("[seed-hq] Supabase upsert skipped/offline:", err.message);
  }
}
