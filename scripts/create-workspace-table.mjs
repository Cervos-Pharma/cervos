/**
 * Creates the workspace_db table in Supabase using direct SQL execution
 * via a custom RPC that accepts raw SQL (uses service role key)
 * 
 * Since PostgREST doesn't allow DDL, we use the Supabase Management REST API
 * or if the user's project has pg_net / execute endpoint available.
 * 
 * This script creates the table by inserting via REST if it already exists,
 * or outputs the exact SQL the user needs to run once in the dashboard.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jswmiwzkrttmxhnpcwrn.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Try Supabase Management API /pg/query endpoint (available via REST with service role for some plans)
// Project ref: jswmiwzkrttmxhnpcwrn

const sql = `
CREATE TABLE IF NOT EXISTS workspace_db (
  shard text PRIMARY KEY DEFAULT 'main',
  snapshot jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE workspace_db ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS workspace_db_svc_only ON workspace_db
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
`;

// Attempt 1: Supabase pgmeta endpoint (not publicly documented but sometimes works)
let attempts = [
  {
    label: 'pg-meta query',
    url: `${SUPABASE_URL}/pg/query`,
    body: { query: sql },
  },
  {
    label: 'rpc/query (custom)',
    url: `${SUPABASE_URL}/rest/v1/rpc/query`,
    body: { sql },
  },
];

for (const attempt of attempts) {
  const resp = await fetch(attempt.url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'apikey': SERVICE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(attempt.body),
  });
  const text = await resp.text();
  console.log(`\n[${attempt.label}] ${resp.status}: ${text.slice(0, 200)}`);
  if (resp.ok) {
    console.log('SUCCESS via', attempt.label);
    process.exit(0);
  }
}

console.log('\n=== COULD NOT AUTO-CREATE TABLE ===');
console.log('Please run this SQL once in Supabase dashboard:');
console.log('https://supabase.com/dashboard/project/jswmiwzkrttmxhnpcwrn/sql/new');
console.log('\n--- SQL START ---');
console.log(sql);
console.log('--- SQL END ---');
