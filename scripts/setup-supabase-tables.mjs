/**
 * Creates required Supabase tables via the Supabase Management API.
 * Needs SUPABASE_ACCESS_TOKEN (personal access token from supabase.com/dashboard/account/tokens).
 *
 * Run: node scripts/setup-supabase-tables.mjs
 */
import { readFileSync } from "fs";
import https from "https";

// Load .env.local
const envFile = new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
let envText = "";
try { envText = readFileSync(envFile, "utf8"); } catch { /* ignore */ }
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

if (!supabaseUrl || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const projectRef = new URL(supabaseUrl).hostname.split(".")[0];

const SQL = `
-- Workspace DB: single-row JSONB snapshot store (one row per shard, default 'main')
CREATE TABLE IF NOT EXISTS workspace_db (
  shard text PRIMARY KEY DEFAULT 'main',
  snapshot jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Lock it down: only service role can read/write (via SUPABASE_SERVICE_ROLE_KEY)
ALTER TABLE workspace_db ENABLE ROW LEVEL SECURITY;

-- Drop old policy if name changed
DROP POLICY IF EXISTS workspace_db_deny_all ON workspace_db;
DROP POLICY IF EXISTS workspace_db_service_only ON workspace_db;

-- Deny all direct access from anon/authenticated roles; server uses service key which bypasses RLS
CREATE POLICY workspace_db_deny_all ON workspace_db USING (false) WITH CHECK (false);
`;

async function runSql(sql) {
  if (!accessToken) {
    console.log("\n[setup-supabase-tables] SUPABASE_ACCESS_TOKEN not set.\n");
    console.log("Please run the following SQL in your Supabase SQL Editor:");
    console.log("https://supabase.com/dashboard/project/" + projectRef + "/sql/new\n");
    console.log("--- SQL START ---");
    console.log(sql);
    console.log("--- SQL END ---\n");
    return;
  }

  const body = JSON.stringify({ query: sql });
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.supabase.com",
      path: `/v1/projects/${projectRef}/database/query`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Length": Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log("[setup-supabase-tables] SQL executed successfully.");
          resolve(null);
        } else {
          console.error("[setup-supabase-tables] Error:", res.statusCode, data.slice(0, 300));
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

await runSql(SQL);
console.log("[setup-supabase-tables] Done. Run: node scripts/seed-hq-admin.mjs to re-seed HQ admin.");
