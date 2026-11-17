/**
 * @file scripts/check-env.mjs
 * @description Validates that every required environment variable is present
 * and well-formed BEFORE the dev server or production build starts.
 *
 * Run manually:   npm run check:env
 * Runs automatically via the `predev` / `prebuild` npm hooks, so a missing key
 * produces this readable report instead of an opaque `500 Internal Server
 * Error` from `createServerClient(undefined, undefined)` at request time.
 *
 * Exits 0 when the environment is usable, 1 otherwise.
 *
 * Bypass (intentional): `NEXT_PUBLIC_MOCK_MODE=true` runs the whole app against
 * the in-memory demo backend, so Supabase keys are not required in that mode.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/**
 * Minimal `.env` parser - avoids adding a dependency (dotenv) purely to print
 * a startup report. Handles `KEY=value`, `export KEY=value`, `#` comments and
 * single/double quoted values.
 */
function loadEnvFile(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).replace(/^export\s+/, "").trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

// Real process.env wins over files, mirroring Next.js precedence.
// `.env.example` is deliberately NOT a source here - it holds placeholders,
// and treating them as real values would make this check pass on a machine
// that has never been configured at all.
const env = {
  ...loadEnvFile(path.join(root, ".env")),
  ...loadEnvFile(path.join(root, ".env.local")),
  ...process.env,
};

const isMock = env.NEXT_PUBLIC_MOCK_MODE === "true";
const isProdDeploy = env.VERCEL_ENV === "production" || env.NODE_ENV === "production";

/** Placeholder text left in `.env.example` that must never count as configured. */
const PLACEHOLDER = /YOUR-|REPLACE-WITH|^$|example\.com/i;

/** @type {{key:string, required:boolean, why:string, check?:(v:string)=>string|null}[]} */
const RULES = [
  {
    key: "NEXT_PUBLIC_SUPABASE_URL",
    required: !isMock,
    why: "Supabase Project Settings -> API -> Project URL",
    check: (v) =>
      /^https?:\/\/.+/.test(v) ? null : "must start with http:// or https://",
  },
  {
    key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    required: !isMock,
    why: "Supabase Project Settings -> API -> anon public key",
  },
  {
    key: "SUPABASE_SERVICE_ROLE_KEY",
    required: !isMock,
    why: "Supabase Project Settings -> API -> service_role secret (server-only, never shipped to the browser)",
  },
  {
    key: "HQ_SECRET",
    required: true,
    why: "shared secret for the /hq back-office login - generate with: openssl rand -hex 32",
    check: (v) => {
      if (v.length < 32) return `too short (${v.length} chars) - must be at least 32`;
      if (/placeholder/i.test(v)) return "must not contain the word 'placeholder'";
      return null;
    },
  },
  {
    key: "WORKSPACE_SESSION_SECRET",
    required: false,
    why: "optional dedicated HMAC key for workspace sessions/bearer tokens (falls back to HQ_SECRET)",
    check: (v) => {
      if (v.length < 24) return `too short (${v.length} chars) - must be at least 24 when set`;
      return null;
    },
  },
  {
    key: "NEXT_PUBLIC_APP_URL",
    required: true,
    why: "canonical production origin, e.g. https://cervos.online - fixes metadataBase / OG image URLs",
    check: (v) =>
      /^https?:\/\/.+/.test(v) ? null : "must start with http:// or https://",
  },
  {
    key: "PAYME_ENVIRONMENT",
    required: false,
    why: "Payme gateway mode: sandbox | production",
    check: (v) =>
      v === "sandbox" || v === "production" ? null : "must be 'sandbox' or 'production'",
  },
];

const missing = [];
const invalid = [];
const present = [];

if (isProdDeploy && (isMock || env.CERVOS_MOCK_AUTH === "true")) {
  invalid.push({
    key: "NEXT_PUBLIC_MOCK_MODE / CERVOS_MOCK_AUTH",
    required: true,
    why: "mock mode must be disabled in production builds and deployments",
    problem: "enabled in production environment",
  });
}

for (const rule of RULES) {
  const value = env[rule.key];
  const raw = value === undefined ? "" : String(value).trim();
  const isPlaceholder = raw !== "" && PLACEHOLDER.test(raw);
  const set = raw !== "" && !isPlaceholder;

  if (!set) {
    if (isPlaceholder) {
      // Present but still the example text - treat as unconfigured, since the
      // check's whole job is to catch "copied the file but never edited it".
      invalid.push({ ...rule, problem: "still set to the .env.example placeholder" });
    } else if (rule.required) {
      missing.push(rule);
    } else {
      present.push(`${rule.key} (optional, unset)`);
    }
    continue;
  }

  const problem = rule.check?.(raw);
  if (problem) invalid.push({ ...rule, problem });
  else present.push(rule.key);
}

// ── Report ──────────────────────────────────────────────────────────────────
const line = "─".repeat(74);

if (missing.length === 0 && invalid.length === 0) {
  console.log(`\nOK: Environment valid - ${present.length} required key(s) present.`);
  if (isMock) console.log("  (mock mode: Supabase keys not required)\n");
  process.exit(0);
}

console.error(`\n${line}`);
console.error("  Cervos environment check FAILED");
console.error(line);

if (missing.length > 0) {
  console.error("\n  Missing required key(s):\n");
  for (const rule of missing) {
    console.error(`    ✗ ${rule.key}`);
    console.error(`        where: ${rule.why}`);
  }
}

if (invalid.length > 0) {
  console.error("\n  Present but invalid:\n");
  for (const rule of invalid) {
    console.error(`    [x] ${rule.key} - ${rule.problem}`);
    console.error(`        where: ${rule.why}`);
  }
}

console.error(`\n${line}`);
console.error("  Fix:");
console.error("    1. copy .env.example .env.local     (cp .env.example .env.local)");
console.error("    2. fill in the values above");
console.error("    3. npm run check:env                (re-run this check)");
console.error("");
console.error("  No Supabase project yet?  npm run dev:mock   (demo backend, no keys)");
console.error(line);
console.error("");

process.exit(1);
