/**
 * Creates the workspace_db table in Supabase if it does not exist.
 * Run: node scripts/create-workspace-db-table.mjs
 */
import { readFileSync } from "fs";
import { createRequire } from "module";
import https from "https";

const require = createRequire(import.meta.url);

// Load .env.local manually
const envFile = new URL("../.env.local", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
let envText = "";
try { envText = readFileSync(envFile, "utf8"); } catch { /* ignore */ }
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const { createClient } = require("@supabase/supabase-js");
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Use Supabase SQL via the postgres REST endpoint
const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
const projectRef = url.hostname.split(".")[0];

const SQL = `
CREATE TABLE IF NOT EXISTS workspace_db (
  shard text PRIMARY KEY DEFAULT 'main',
  snapshot jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'workspace_db' AND policyname = 'workspace_db_deny_all'
  ) THEN
    ALTER TABLE workspace_db ENABLE ROW LEVEL SECURITY;
    CREATE POLICY workspace_db_deny_all ON workspace_db USING (false) WITH CHECK (false);
  END IF;
END $$;
`;

// Try via Supabase management API (needs access token or service role)
// Fall back to inserting a dummy row to confirm table exists
async function main() {
  // Check if table exists first
  const { data, error } = await sb.from("workspace_db").select("shard").limit(1);
  if (!error) {
    console.log("[create-workspace-db-table] Table already exists. Rows:", data?.length ?? 0);
    process.exit(0);
  }

  console.log("[create-workspace-db-table] Table not found:", error.message);
  console.log("[create-workspace-db-table] Creating via management API...");

  // Use Supabase management API - requires a personal access token (SUPABASE_ACCESS_TOKEN)
  // or we can use the pg connection string
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  if (!accessToken) {
    console.error(
      "[create-workspace-db-table] SUPABASE_ACCESS_TOKEN not set. Please run this SQL in the Supabase dashboard:\n\n" +
      SQL
    );
    process.exit(1);
  }

  const body = JSON.stringify({ query: SQL });
  const options = {
    hostname: "api.supabase.com",
    path: `/v1/projects/${projectRef}/database/query`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
      "Content-Length": Buffer.byteLength(body),
    },
  };

  await new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log("[create-workspace-db-table] Table created successfully.");
          resolve(null);
        } else {
          console.error("[create-workspace-db-table] API error:", res.statusCode, data);
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

main().catch((e) => {
  console.error("[create-workspace-db-table] Fatal:", e.message);
  process.exit(1);
});
