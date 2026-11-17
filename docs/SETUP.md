# Cervos — Setup, Run & Deploy

> **Start here.** This is the single entry point for getting a fresh clone
> running. Every env key, every command, every common failure is documented
> below. If you only read one file in this repo, read this one.

---

## 0. What's in this repo

| Path | What it is | Runs on |
|---|---|---|
| `src/` | **Web app** — dashboard, HQ console, supplier portal, billing | Browser / Vercel |
| `cervos-desktop/` | **Endpoint** — the POS. Builds to desktop **and** Android APK | Pharmacy machine / phone |
| `cervos-supplier-desktop/` | Supplier-facing desktop endpoint | Supplier machine |
| `sql/` | Schema, migrations, diagnostics | Supabase SQL Editor |
| `docs/` | Architecture and feature docs | — |
| `scripts/` | Dev/verification helpers | Node |

The endpoint does **not** talk to the web app's API. It writes to Supabase
directly. See [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) §5.2.

---

## 1. Prerequisites

| Tool | Version used here | Check |
|---|---|---|
| Node.js | v26.9.0 | `node -v` |
| npm | 11.19.1 | `npm -v` |
| Git | 2.55.0 | `git --version` |
| Rust + cargo | only for `npm run tauri:build` / APK | `cargo -v` |

You also need a **Supabase project** (web + endpoint both need it), except
when running the web app in mock mode (§4).

---

## 2. Configure environment — the ONLY place env keys live

There are exactly **two** env templates. Copy each, fill it in, done.

```powershell
# 1. Web app
copy .env.example .env.local

# 2. Endpoint (desktop + Android)
copy cervos-desktop\.env.example cervos-desktop\.env
```

```bash
# macOS / Linux
cp .env.example .env.local
cp cervos-desktop/.env.example cervos-desktop/.env
```

### 2.1 Web keys (`.env.local`)

| Key | Required | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Same page → `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Same page → `service_role` secret (**server only — never shipped to the browser**) |
| `HQ_SECRET` | ✅ | Generate: `openssl rand -hex 32`. **Must be ≥ 32 chars** and must not contain the word `placeholder` |
| `NEXT_PUBLIC_APP_URL` | ✅ | Your deployed origin, e.g. `https://cervos.online` |
| `PAYME_APP_ID` / `PAYME_APP_SECRET` / `PAYME_API_URL` / `PAYME_ENVIRONMENT` | ⬜ | Payme merchant dashboard. Blank = billing pages degrade gracefully |
| `NEXT_PUBLIC_MOCK_MODE` | ⬜ | `true` = in-memory demo backend, no Supabase needed |

### 2.2 Endpoint keys (`cervos-desktop/.env`)

| Key | Required | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | **Must match the web's `NEXT_PUBLIC_SUPABASE_URL`** or the endpoint syncs to a different database than the dashboard shows |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Must match the web's anon key |
| `VITE_WEB_URL` | ✅ | Deployed web origin |
| `VITE_APP_URL` | ⬜ | Fallback for `VITE_WEB_URL` |
| `VITE_DEV_WEB_URL` | ⬜ | Dev-only override, defaults to `http://localhost:3000` |

### 2.3 Verify before you start

```bash
npm run check:env
```

```
✓ Environment OK — 5 required key(s) present.
```

or, if something's missing:

```
  Missing required key(s):
    ✗ HQ_SECRET
        where: shared secret for the /hq back-office login — generate with: openssl rand -hex 32
```

> **This check also runs automatically** before `npm run dev` and
> `npm run build` (npm `predev` / `prebuild` hooks). You will never again hit
> an opaque `500 Internal Server Error` because a key was forgotten — you get
> the list above instead.

---

## 3. Install

```bash
npm install                      # web app
npm install --prefix cervos-desktop   # endpoint
```

> Both `node_modules/` are git-ignored. A fresh clone always needs both.

---

## 4. Run

### 4.1 Web app against real Supabase

```bash
npm run dev          # http://localhost:3000  (runs check:env first)
```

### 4.2 Web app with NO Supabase (demo)

```bash
npm run dev:mock     # http://localhost:5000
```

Serves an in-memory demo backend. No keys, no database. This is the fastest
way to see the UI. **Does not run `check:env`**, so it works on a bare clone.

### 4.3 Endpoint (POS)

```bash
npm install --prefix cervos-desktop
npm run dev --prefix cervos-desktop
```

---

## 5. Verify (run all three before you commit)

```bash
npm run lint          # tsc --noEmit          → 0 errors
npm test              # vitest                → all pass
npm run build         # next build            → exit 0
```

Endpoint:

```bash
npm run build --prefix cervos-desktop   # tsc && vite build → exit 0
```

| Command | Expected |
|---|---|
| `npm run lint` | no output, exit 0 |
| `npm test` | 4 files, 23 tests, all passed |
| `npm run build` | `✓ Compiled successfully`, route table, exit 0 |
| `npm run build --prefix cervos-desktop` | `✓ built in …s`, exit 0 |

> **PowerShell note:** npm/git write to stderr, so PowerShell reports a
> `NativeCommandError` even on success. Always check the **exit code** and the
> actual output, not the presence of red text.

---

## 6. Deploy

### 6.1 Web app

```bash
npm run build
npm run start         # serves .next on :3000
```

Or push to the branch your Vercel project is linked to (`.vercel` is
git-ignored; link once with `npx vercel link`).

**Set every required key in the deployment environment** — Vercel does not
read your local `.env.local`. After changing any `NEXT_PUBLIC_*` key you must
**rebuild**; those values are inlined into the bundle at build time.

### 6.2 Endpoint — desktop bundle

```bash
npm run tauri:build --prefix cervos-desktop
```

### 6.3 Endpoint — Android APK

```bash
# one-time
npm run android:init --prefix cervos-desktop

# debug (unsigned arm64 — quick device testing)
npm run android:build:debug --prefix cervos-desktop

# release
npm run android:build --prefix cervos-desktop
```

Output is git-ignored (`*.apk`, `src-tauri/gen/`).

### 6.4 Database migrations

Run in **Supabase Dashboard → SQL Editor**, in this order:

```sql
-- 1. canonical schema (first-time setup only)
sql/00_hq_schema_requirements.sql

-- 2. one-off migrations, oldest first
sql/migrations/*.sql

-- 3. endpoint sync repair — see docs/ENDPOINT_SYNC.md
sql/diagnostics/endpoint_sync_diagnostics.sql   -- read-only report first
sql/migrations/fix_endpoint_push_permissions.sql -- then repair
```

All migrations are written to be **idempotent** (safe to re-run).

---

## 7. Troubleshooting

### `Cervos environment check FAILED`
Run `npm run check:env` and fill in the listed keys. Template values copied
without editing are detected and reported as *"still set to the .env.example
placeholder"*.

### Web app returns 500 on every page
Almost always a missing `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY`. The
root layout builds a Supabase client during render. Run `npm run check:env`.

### `/sw.js`, `/robots.txt` or `/sitemap.xml` return 500
Fixed — `src/proxy.ts` used to run those static files through the auth
middleware because only image extensions were excluded from its matcher. If
you see this again, check the `config.matcher` in `src/proxy.ts`.

### Endpoint says "POS not configured — Supabase keys missing"
`cervos-desktop/.env` is missing or empty. Copy the template (§2) and
**rebuild** — Vite inlines `VITE_*` at build time.

### Endpoint syncs but the dashboard shows nothing
This is the known failure mode. See **[`docs/ENDPOINT_SYNC.md`](./ENDPOINT_SYNC.md)**
— run the diagnostics SQL. Most likely RLS is missing an INSERT policy
(HTTP 403), cascading into FK errors (HTTP 409).

### `npm ci` fails with `Missing: … from lock file`
Use `npm install` instead — it regenerates `package-lock.json` to match
`package.json`.

### Type errors mentioning `Cannot find module 'react-router-dom'`
The sub-package's dependencies aren't installed. Run
`npm install --prefix cervos-desktop`.

---

## 8. Conventions in this repo

- **Read `node_modules/next/dist/docs/` before writing Next.js code.** This
  Next.js version has breaking changes (e.g. `metadata.themeColor` is
  deprecated → use the `viewport` export; middleware lives in `src/proxy.ts`).
  See `AGENTS.md`.
- **Never commit secrets.** `.env`, `.env.*` are ignored; only `.env.example`
  templates are tracked.
- **Comments explain *why*, not *what*.** Keep that style in new code.
- **Docstrings in English**, matching the existing files.
