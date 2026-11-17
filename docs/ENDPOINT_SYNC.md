# Endpoint → Central Web Sync

> **Symptom:** data entered at the pharmacy (POS sales, stock, operators)
> never appears on the central web dashboard, even though the app reports a
> successful sync.

This document explains the architecture, every root cause found, how to
diagnose which one you have, and how to fix it.

---

## 1. How sync actually works

**The web app's `/api/sync` route is dormant.** The endpoint does not use it.

```
cervos-desktop/src/lib/sync.ts   ← the real sync engine
        │
        ├── PUSH (upload)   queueForSync() → sync_queue → bulkPush()
        │                         │
        │                         └── Supabase upsert (direct, authenticated)
        │
        └── PULL (download) runSyncCycle() → Supabase select → local SQLite
```

It talks to Supabase **directly** with the authenticated client (`Ie`), not
through the Next.js API. This is documented in
[`ARCHITECTURE.md` §5.2](./ARCHITECTURE.md): the old route authenticates with
session cookies, which the desktop's `fetch()` cannot supply, so it always
returned 401.

**Consequence:** fixing the web app will not fix endpoint sync. The problem is
in `cervos-desktop/src/lib/sync.ts` and/or the **Supabase schema/RLS**.

### The write path in detail

```js
// 1. A local write happens (POS sale, stock adjustment, …)
await queueForSync('sales', saleId, 'insert', payload)
        │
        └── row appended to local `sync_queue` table
            (skipped entirely if workspace_mode === 'local')

// 2. Sync cycle runs (auto-tick, or manual)
await runSyncCycle()
        ├── PULL  — download rows changed since last pull
        └── PUSH  — bulkPush() uploads sync_queue, then deletes each row
                     that succeeded
```

A row **stays queued** if the upload is rejected, so the next cycle retries
it. That is why `pending` can grow forever with no visible error.

---

## 2. Root causes (all confirmed against production)

### Cause A — RLS has no INSERT policy → HTTP 403

```
42501  new row violates row-level security policy
```

The live database had `products` with `ENABLE ROW LEVEL SECURITY` and policies
for **SELECT and UPDATE but none for INSERT**. Every "Add New Product" upload
was rejected.

> Documented in `sql/migrations/fix_desktop_sync_cloud_drift.sql`.

### Cause B — foreign-key cascade → HTTP 409 (the sneaky one)

```
23503  insert or update violates foreign key constraint
```

Because Cause A blocked the **parent** `products` row, every `batches` row
referencing that product id was rejected too. **Stock never left the POS**, and
the error shown (FK) bore no resemblance to the real cause (RLS).

This is why looking at a single failing row can send you down the wrong path.

### Cause C — NOT NULL column → HTTP 400

```
23502  null value in column "expiry_date" violates not-null constraint
```

`batches.expiry_date` was `NOT NULL` in the live DB, but the canonical schema
(`sql/00_hq_schema_requirements.sql`) declares it nullable — and the endpoint
legitimately creates batches for products with no default expiry.

### Cause D — table missing from the cloud → HTTP 42P01

```
42P01  relation "…" does not exist
```

`sales`, `sale_items`, `operators` and `shifts` are defined **only in the
endpoint's local SQLite** (`cervos-desktop/src/lib/database.ts`). No SQL file
in this repo creates them in Supabase. If they're absent in your project,
every push to them fails and the data stays on-device.

### Cause E — device in local mode (no error at all)

If `app_settings.workspace_mode = 'local'`, `queueForSync()` returns
immediately. Nothing is ever queued, so there is nothing to fail — the data
simply never leaves the device.

Re-link the device (Settings → Link branch) to clear this.

### Cause F — errors were swallowed (why nobody could see it)

`bulkPush()` caught every failure with an **empty catch**:

```js
} catch {
  failed += 1        // no log, no message, no surface
}
```

An RLS 403 and a fully successful upload were **indistinguishable** to the
user, the console and `runSyncCycle()` — which returned `ok: true` either way.

**This is the reason the bug survived.** It was not one failure but a failure
that could not be observed.

---

## 3. Diagnose — run this first

**Supabase Dashboard → SQL Editor → New query** → paste
[`sql/diagnostics/endpoint_sync_diagnostics.sql`](../sql/diagnostics/endpoint_sync_diagnostics.sql)
→ **Run**.

It is **read-only** and returns four result sets:

| Result set | Meaning | Action |
|---|---|---|
| **A** | RLS + policy inventory per pushed table | Reference |
| **B** | RLS on, **no INSERT policy** | Cause A → run the repair |
| **C** | Table **doesn't exist** in the cloud | Cause D → create the table |
| **D** | **NOT NULL** column the endpoint sends as null | Cause C → run the repair |

**B, C or D returning rows = you found it.**

If all three are empty, the cloud is healthy — look at Cause E (device local
mode) and check the endpoint console for `[sync] push failed → …` lines.

---

## 4. Fix

```sql
-- Supabase Dashboard → SQL Editor
sql/migrations/fix_endpoint_push_permissions.sql
```

What it does, in order:

1. `ALTER TABLE batches ALTER COLUMN expiry_date DROP NOT NULL` — Cause C.
2. `CREATE TABLE IF NOT EXISTS` for `sales`, `sale_items`, `operators`,
   `shifts` (schema mirrors the endpoint's local SQLite) — Cause D.
   **No-op if your cloud already has them** — your schema wins.
3. Adds **SELECT** policies where RLS is on but no read policy exists.
4. Adds **INSERT** policies where RLS is on but no write policy exists —
   **the actual 403 fix** (Cause A, which also clears Cause B).
5. Adds **UPDATE** and **DELETE** policies if missing.
6. Adds `anon` INSERT policies so a device that pushes before its sign-in
   completes doesn't strand its first writes. *(Comment section 6 out if you
   prefer to require a completed sign-in.)*

**Safety:** idempotent, non-destructive. Policies are only *added* when
missing; existing ones are never dropped or altered. No `DELETE`/`TRUNCATE`.

---

## 5. Verify

```sql
-- Re-run the diagnostics: B, C and D must return zero rows.
sql/diagnostics/endpoint_sync_diagnostics.sql
```

Then on the endpoint:

1. **Settings → Sync now** (or wait for the auto tick).
2. Open devtools console. Look for:
   ```
   [sync] push failed → batches insert: new row violates row-level security policy
   ```
   **No such line = the upload landed.**
3. Confirm on the web that the sale/stock appears under the branch.

---

## 6. What changed in the client (so it can't hide again)

| File | Change |
|---|---|
| `cervos-desktop/src/lib/sync.ts` | `bulkPush()` now **captures, logs and returns** every failure as `errors: string[]`, instead of an empty `catch`. Undecodable queue rows are logged before being dropped. Unknown operations are reported instead of silently counted. |
| `cervos-desktop/src/lib/sync.ts` | `runSyncCycle()` returns `failed` + `errors` and sets `ok: false` when uploads were rejected. Previously it returned `ok: true` no matter what. |
| `cervos-desktop/src/lib/sync.ts` | `queueForSync()` logs a one-time warning when `workspace_mode === 'local'` (Cause E). |
| `cervos-desktop/src/lib/store.ts` | New `pushFailed` / `pushError` state. |
| `cervos-desktop/src/pages/Dashboard.tsx` | Red alert banner showing the exact rejection reason. Also fixed: a push failure no longer silently skips the local stats refresh (`if (!sync.ok) return`). |

New console output you should see on a healthy sync:

```
[sync] push incomplete: 12 uploaded, 3 failed  ["sales insert: …", …]
```

---

## 7. Known issues not covered here

From [`ARCHITECTURE.md` §10](./ARCHITECTURE.md):

- **Server lifecycle dormant** — `transitionBranchSubscription`
  (trial→grace→locked) only ran inside `getSyncData`, which the endpoint no
  longer calls. Move it to a Supabase cron.
- **No conflict resolution** — sync is last-writer-wins by `updated_at`.
- **RLS hardening** — the permissive `WITH CHECK (true)` policies here restore
  *functionality*; tightening them to per-account scoping is a follow-up once
  `account_id` exists on these tables.

---

## 8. Quick reference — error codes

| HTTP | SQLSTATE | Meaning | Likely cause |
|---|---|---|---|
| 403 | 42501 | row violates RLS | **A** — no INSERT policy |
| 409 | 23503 | foreign key violation | **B** — parent row never uploaded (usually caused by A) |
| 400 | 23502 | null in NOT NULL column | **C** — `expiry_date` |
| 400/404 | 42P01 | relation does not exist | **D** — table missing |
| 401 | — | not authenticated | session expired — sign in again |
| — | — | nothing queued | **E** — `workspace_mode = local` |
