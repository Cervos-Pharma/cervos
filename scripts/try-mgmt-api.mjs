// Try Supabase Management API v1 database query endpoint
// This requires a Supabase personal access token (sbp_...), NOT the service role JWT
// But let's try with service role JWT as bearer anyway

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const PROJECT_REF = 'jswmiwzkrttmxhnpcwrn';

const SQL = "CREATE TABLE IF NOT EXISTS workspace_db (shard text PRIMARY KEY DEFAULT 'main', snapshot jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now()); ALTER TABLE workspace_db ENABLE ROW LEVEL SECURITY;";

// Management API endpoint
const resp = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: SQL }),
});
console.log('Management API Status:', resp.status);
const body = await resp.text();
console.log('Body:', body.slice(0, 400));
