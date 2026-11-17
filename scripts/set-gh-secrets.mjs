/**
 * Sets GitHub Actions secrets for Cervos-Pharma/cervos
 * Uses tweetsodium to encrypt values with the repo's public key
 */
import sodium from 'tweetsodium';

// Values are read from environment variables or .env.local to avoid committing secrets.
// Run: node -r dotenv/config scripts/set-gh-secrets.mjs
// Or set env vars: GH_PAT, EXPO_TOKEN, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
//                  HQ_SECRET, WORKSPACE_SESSION_SECRET, TEXTIFY_API_KEY, PAYME_APP_SECRET
import { readFileSync } from 'fs';

function loadEnv() {
  const env = { ...process.env };
  try {
    const lines = readFileSync('.env.local', 'utf8').split('\n');
    for (const line of lines) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
  } catch {}
  return env;
}

const ENV = loadEnv();

const PAT = ENV.GH_PAT || '';
const REPO = 'Cervos-Pharma/cervos';
const KEY_ID = ENV.GH_KEY_ID || '';
const PUBLIC_KEY = ENV.GH_PUBLIC_KEY || '';

if (!PAT) { console.error('GH_PAT env var required'); process.exit(1); }

const secrets = {
  EXPO_TOKEN: ENV.EXPO_TOKEN || '',
  EXPO_PUBLIC_SUPABASE_URL: ENV.NEXT_PUBLIC_SUPABASE_URL || '',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  NEXT_PUBLIC_SUPABASE_URL: ENV.NEXT_PUBLIC_SUPABASE_URL || '',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: ENV.SUPABASE_SERVICE_ROLE_KEY || '',
  HQ_SECRET: ENV.HQ_SECRET || '',
  WORKSPACE_SESSION_SECRET: ENV.WORKSPACE_SESSION_SECRET || ENV.HQ_SECRET || '',
  TEXTIFY_API_KEY: ENV.TEXTIFY_API_KEY || '',
  PAYME_APP_SECRET: ENV.PAYME_APP_SECRET || '',
  PAYME_APP_ID: ENV.PAYME_APP_ID || 'CERVOS-APP-001',
  PAYME_API_URL: ENV.PAYME_API_URL || 'https://portal.paymeafrica.com/api/v1',
  PAYME_ENVIRONMENT: ENV.PAYME_ENVIRONMENT || 'production',
};

function encryptSecret(publicKeyBase64, secretValue) {
  const keyBytes = Buffer.from(publicKeyBase64, 'base64');
  const secretBytes = Buffer.from(secretValue, 'utf8');
  const encryptedBytes = sodium.seal(secretBytes, keyBytes);
  return Buffer.from(encryptedBytes).toString('base64');
}

async function setSecret(name, value) {
  const encrypted = encryptSecret(PUBLIC_KEY, value);
  const resp = await fetch(`https://api.github.com/repos/${REPO}/actions/secrets/${name}`, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${PAT}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'cervos-setup',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ encrypted_value: encrypted, key_id: KEY_ID }),
  });
  if (resp.status === 201 || resp.status === 204) {
    console.log(`  [OK] ${name}`);
  } else {
    const text = await resp.text();
    console.error(`  [FAIL] ${name}: ${resp.status} ${text}`);
  }
}

async function setVariable(name, value) {
  // Try update first, then create
  const patchResp = await fetch(`https://api.github.com/repos/${REPO}/actions/variables/${name}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `token ${PAT}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'cervos-setup',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, value }),
  });
  if (patchResp.status === 204) {
    console.log(`  [OK] VAR ${name} (updated)`);
    return;
  }
  const postResp = await fetch(`https://api.github.com/repos/${REPO}/actions/variables`, {
    method: 'POST',
    headers: {
      'Authorization': `token ${PAT}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'cervos-setup',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, value }),
  });
  if (postResp.status === 201) {
    console.log(`  [OK] VAR ${name} (created)`);
  } else {
    const text = await postResp.text();
    console.error(`  [FAIL] VAR ${name}: ${postResp.status} ${text}`);
  }
}

console.log('Setting GitHub Actions secrets...');
for (const [name, value] of Object.entries(secrets)) {
  await setSecret(name, value);
}

console.log('\nSetting GitHub Actions variables...');
await setVariable('EXPO_PUBLIC_API_URL', 'https://cervos.online');
await setVariable('EXPO_PUBLIC_APP_URL', 'https://cervos.online');

console.log('\nAll done.');
