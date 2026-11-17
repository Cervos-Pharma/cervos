# Cervos Web — Local Mock Mode

Run the entire web app (HQ Console + both user portals) with **zero external
dependencies** — no Supabase project, no live backend, no network calls. This is
the fast way to smoke-test the UI/UX and end-to-end flows on your machine.

## Quick start

```bash
cd cervos-web
npm run dev:mock        # next dev on http://localhost:5000 with mock backend
```

Open http://localhost:5000. There is no `dev:mock` magic in your normal
`npm run dev` — mock mode only activates when `NEXT_PUBLIC_MOCK_MODE=true`
(the launcher script sets it for you).

## Demo accounts

| Role | Where | Email | Password |
|------|-------|-------|----------|
| Pharmacy owner | /auth or role bar | `demo.pharmacy@cervos.test` | `Pharmacy@2026!` |
| Supplier | /auth or role bar | `demo.supplier@cervos.test` | `Supplier@2026!` |
| HQ admin | /hq login gate | `admin@cervos.co` | `Cervos2026!` |

### Role switcher

A floating **MOCK** bar in the bottom-right corner lets you flip between
Pharmacy / Supplier / Signed out (and jump to HQ) without logging in. The
choice is a `mock_user` cookie read by `server.ts`, `client.ts`, and
`proxy.ts` — switching reloads the page and the portals follow.

## What's real in mock mode

Everything is served from an in-memory dataset (`src/lib/mock/data.ts`) through
a Supabase-js-compatible client (`src/lib/mock/supabase.ts`). It implements the
query surface the app actually uses:

- `select` with nested embeds (`branches(id, name, accounts(name))`)
- Filters: `eq, neq, gt, gte, lt, lte, in, is, not(col, op, value)`
- `order`, `limit`, `single`, `maybeSingle`, head + `{ count: "exact" }`
- `insert`, `update`, `upsert`, `delete`
- `auth` stubs (`getUser`, `signInWithPassword`, `signUp`, `signOut`, …)
- `rpc("set_current_release")`, `storage.getPublicUrl`

Because the store is **mutable and shared**, the HQ actions that really change
data — suspend/unsuspend accounts, lock/reset branches, extend trials, manage
operators and teams, upload/activate releases, mark quotes contacted, add
support tickets — genuinely flow through to the portals. Restart the dev server
to reset the dataset.

## Known limitations

- Mutations reset on restart (in-memory only — nothing persists to disk).
- File downloads/uploads (app releases) are stubbed: URLs point to
  `/mock/storage/...` which does not serve a real file.
- Email/password reset, OAuth callback, and webhook endpoints are no-ops.
- The dataset is believable Tanzanian pharmacy seed data with ~10 accounts and
  a few hundred orders/sales — enough to exercise every screen, not production
  volume.

## Architecture

- `src/lib/mock/data.ts` — the seed dataset + FK relationship map for embeds.
- `src/lib/mock/supabase.ts` — thenable query builder + auth/RPC/storage stubs.
- `src/lib/supabase/server.ts` & `client.ts` — return the mock when
  `NEXT_PUBLIC_MOCK_MODE=true`, otherwise the real Supabase clients.
- `src/proxy.ts` — in mock mode the "session" is the `mock_user` cookie, so the
  middleware guards/redirects behave like real auth.
- `scripts/dev-mock.mjs` — launches `next dev` with mock mode on and injects a
  demo `HQ_SECRET` (the app's HQ login requires a ≥32-char secret).

## Real (Supabase) mode

```bash
npm run dev        # needs NEXT_PUBLIC_SUPABASE_URL, anon key, service-role key, HQ_SECRET
```
