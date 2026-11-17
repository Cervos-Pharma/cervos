# Cervos Pharmacy OS — Architecture (as of v0.1.4)

> Scope: this document describes the system **as built**, with emphasis on the
> endpoint (desktop) ↔ cloud (Supabase/Next.js) **sync architecture** that was
> reworked in v0.1.4. It is written for engineers who will extend or operate it.

---

## 1. System overview

Cervos is a pharmacy point-of-sale + inventory + HQ-intelligence product. Three
deployable surfaces share one Supabase backend:

| Surface | Repo path | Runtime | Role |
|---|---|---|---|
| **Endpoint (branch)** | `cervos-desktop/` | Tauri 2 + React + local SQLite | The till: sales (POS), inventory, stock, operators. Runs at each pharmacy branch. |
| **Backend / HQ web** | root `src/` (Next.js) | Next.js + Supabase | API routes, server actions, HQ console, admin portal, subscription/lifecycle logic. |
| **Supplier desktop** | `cervos-supplier-desktop/` | Tauri + React | Separate supplier-facing client (out of scope here). |

The endpoint is **local-first**: every operation writes to a local SQLite file
first and never blocks on the network. The network is a *background
replication* layer that keeps the branch's data and the cloud eventually
consistent, and lets HQ push configuration/commands down.

```
                ┌─────────────────────────────┐
                │      Supabase (Postgres)     │
                │  products | batches | sales  │
                │  branches | accounts |       │
                │  branch_commands             │
                └──────────────┬──────────────┘
                               │  direct Supabase client
                               │  (anon key + user session)
                ┌──────────────┴──────────────┐
                │   cervos-desktop (endpoint)  │
                │  SQLite  ──▶  sync_queue     │
                │  POS / Inventory / Settings  │
                └─────────────────────────────┘
```

---

## 2. Repository layout (endpoint)

```
cervos-desktop/
  src/
    App.tsx                 # routes + auto-sync bootstrap + lock overlay
    types.ts                # Product, Batch, Branch, Operator, Sale, ...
    lib/
      database.ts           # SQLite wrapper: Fe (select), Pe (exec), Et (uuid), Mt (now)
      sync.ts               # ALL sync logic (push, pull, auto-sync, block check)
      store.ts              # zustand: auth + UI + sync status stores
      supabase.ts           # supabase client + isConfigured
      queries.ts            # operator CRUD helpers
      hooks.ts              # useAuth / useRequireAuth / usePermissions
    pages/
      Pos.tsx               # point of sale (enqueues sales)
      Inventory.tsx         # product + batch CRUD (enqueues products/batches)
      Settings.tsx          # "Sync Now" button, link/unlink, operator mgmt
      Dashboard.tsx Records.tsx Reports.tsx Users.tsx Alerts.tsx
      Marketplace.tsx Subscription.tsx Login.tsx Onboarding.tsx
    components/ Shell.tsx TopBar.tsx ...
  src-tauri/                # Rust shell + tauri.conf.json (bundle: nsis)
sql/
  00_hq_schema_requirements.sql  # idempotent cloud schema (run in Supabase)
  migrations/
    branch_commands.sql          # command queue table
```

---

## 3. Local data model (endpoint SQLite)

Defined in `database.ts → runMigrations()`. Key tables:

| Table | Purpose |
|---|---|
| `products` | Catalog. `id, generic_name, brand_name, category, formulation, requires_prescription, barcode, updated_at, default_expiry, default_cost_price, default_sale_price`. |
| `batches` | Stock lots. `id, branch_id, product_id, batch_number, quantity, cost_price, sale_price, expiry_date, sync_version, updated_at`. |
| `sales` / `sale_items` / `receipts` | Transactions. |
| `operators` | Branch staff (PIN auth). |
| `branches` | Mirror of cloud branch row (id, name, lat/lng, subscription_*). |
| `app_settings` | Key/value local config: `branch_id`, `account_id`, `subscription_status`, `last_pull_<branchId>`, `last_synced_at`, centre_* , pharmacy_name. |
| `sync_queue` | **Outbound replication log.** `id, table_name, row_id, operation (insert|update|delete), payload (JSON), created_at, attempts`. |
| `notifications`, `activity_log`, `shifts` | Misc. |

`Fe(sql, params)` returns rows; `Pe(sql, params)` executes; `Et()` = UUID;
`Mt()` = ISO timestamp. `runMigrations()` is idempotent — it uses
`CREATE TABLE IF NOT EXISTS` plus per-column `ALTER TABLE ... ADD COLUMN`
wrapped in try/catch, so old databases self-heal new columns on next launch.

---

## 4. Cloud data model (Supabase Postgres)

Defined/expected in `sql/00_hq_schema_requirements.sql` (the operator must run
this in the Supabase SQL editor — it is **not** applied automatically). Relevant
tables for the endpoint sync:

| Table | Notes |
|---|---|
| `accounts` | Tenant. `billing_status`, `subscription_status`, `suspended_at`, `trial_ends_at`, `grace_ends_at`, `subscription_expires_at`. |
| `branches` | `account_id`, `subscription_status`, `trial_ends_at`, `grace_ends_at`, `last_synced_at`, `locked_reason`. **Authoritative source for the endpoint's lock state.** |
| `products` | Mirrors local `products` + `unit_desc`, `stock`, `updated_at`. |
| `batches` | Mirrors local `batches` + `batch_number`, `updated_at`. |
| `sales` | Transactions (already synced pre-v0.1.4). |
| `branch_commands` | HQ → endpoint command queue: `branch_id, account_id, command, reason, status (pending|acknowledged|failed), created_at, acknowledged_at`. |

> **Important:** `products` and `batches` are **not** in the RLS-enabled list
> in the schema SQL, so the Supabase **anon key has read/write access** to them
> (same as `sales`). This is what lets the endpoint's anon client replicate
> directly. It is functionally correct but insecure for production — see §9.

---

## 5. Sync architecture

### 5.1 Principles

1. **Local-first.** UI writes hit SQLite; the network is async and
   best-effort.
2. **Outbound = queue + batch push.** Writes that must reach the cloud are
   recorded in `sync_queue` and flushed in bulk.
3. **Inbound = delta pull, applied locally.** The endpoint pulls rows changed
   since its last successful pull and upserts them into SQLite.
4. **Commands = one-way HQ→endpoint channel** (`branch_commands`) for remote
   control (lock/unlock/suspend/force_sync).
5. **Single source of truth for lock state = `branches.subscription_status`**
   in the cloud.

### 5.2 Why the desktop talks to Supabase *directly* (not via `/api/sync`)

`src/app/api/sync/route.ts` authenticates with **session cookies**
(`@supabase/ssr`). The desktop's `fetch()` cannot supply those cookies, so the
route returned 401 and **the old pull never applied anything**. As of v0.1.4 the
desktop performs the pull **directly against the authenticated Supabase client**
(`Ie`), exactly like the push already did. `runSyncCycle()` is the single
unified routine.

> `GET /api/sync` and `lib/actions/desktop-sync.ts` are now **dormant** from the
> endpoint's perspective (see §10, known issue: the server-side
> trial→grace→locked lifecycle that lived in `getSyncData` no longer runs).

### 5.3 The unified cycle — `runSyncCycle()` (`sync.ts`)

```
runSyncCycle()
  ├─ guard: linked? online? already syncing?  → else return
  ├─ read branch_id, account_id from app_settings
  ├─ since = last_pull_<branchId>  (default 1970)
  ├─ PULL (parallel Supabase selects)
  │    products      .select('*').gt('updated_at', since)
  │    batches       .select('*').eq('branch_id', branchId).gt('updated_at', since)
  │    branch_commands .select('*').eq('branch_id', branchId).eq('status','pending')
  │    branches      .select('subscription_status, ...').eq('id', branchId)
  ├─ applyPulledData()
  │    → upsertLocal('products'|'batches', row)   (ON CONFLICT(id) DO UPDATE)
  │    → applyCommand(cmd)  for each branch_command
  ├─ acknowledge: branch_commands.status = 'acknowledged'
  ├─ write subscription_* from branch row → app_settings
  ├─ PUSH: bulkPush()  (flush sync_queue)
  ├─ K0(branchId, now); Xd('last_synced_at', now)
  └─ evaluate checkSubscriptionBlocked() → update sync store
```

### 5.4 Outbound — `qs()` → `sync_queue` → `bulkPush()`

- A write that should replicate calls `qs(table, rowId, op, payload)`. The
  **payload is shaped to the cloud schema**, not the local row (e.g. products
  include `formulation`, `barcode`, `default_*`, `updated_at`).
- `bulkPush()` groups the queue by `table:operation` and issues **one**
  `supabase.from(table).upsert(rows, {onConflict:'id'})` (or `.delete().in('id', ids)`)
  per group. This collapses N queued rows into a handful of requests — critical
  on the Supabase free tier.
- Successful rows are removed from `sync_queue`; the cloud `updated_at` is what
  future *pulls* will use as the delta cursor.

| Caller | Enqueues |
|---|---|
| `Pos.tsx` (sale) | `sales` insert |
| `Inventory.tsx` (save) | `products` insert/update **and** `batches` insert (when Stock Qty > 0) |

### 5.5 Inbound — `applyPulledData()` / `upsertLocal()`

- `upsertLocal(table, row)` builds `INSERT ... ON CONFLICT(id) DO UPDATE SET ...`
  against SQLite. Columns not present locally are ignored safely.
- Applies cloud `products`/`batches` into the local catalog/stock.
- Applies HQ **commands** (see 5.6).

### 5.6 Commands & remote control (`branch_commands`)

HQ writes a command via `POST /api/hq/commands` (see `src/app/api/hq/commands/route.ts`):

```
{ cmd: "lock_branch" | "unlock_branch" | "suspend_branch" | "force_sync",
  branchId, reason? }
```

The route (a) inserts a `pending` `branch_commands` row **and** (b) immediately
flips `branches.subscription_status` to `locked`/`active`. The endpoint, on its
next pull, receives the pending command and `applyCommand()` sets the local
`subscription_status` (and `locked_reason`):

| Command | Local effect |
|---|---|
| `lock_branch` / `suspend_branch` | `subscription_status = 'locked'` |
| `unlock_branch` | `subscription_status = 'active'` |
| `force_sync` | no-op locally (next cycle handles it) |

After applying, the endpoint **acknowledges** the command (`status='acknowledged'`),
so it is not re-applied.

### 5.7 Subscription lifecycle & blocking

- **Cloud is authoritative.** `branches.subscription_status` ∈
  `trial | active | grace | locked` (+ account `suspended`).
- The endpoint reads it each cycle into `app_settings.subscription_status`.
- `checkSubscriptionBlocked()` blocks when status is `locked`, `past_due`, or
  `inactive` (with an expired grace window).
- Enforcement points:
  - **Startup** (`App.tsx`): initial `checkSubscriptionBlocked()` sets the sync
    store; a full-screen **"Terminal Locked"** overlay renders when blocked.
  - **Before each sale** (`Pos.tsx`): sale is aborted with an alert if blocked.
- The overlay stays mounted while syncing so an HQ **unlock** is picked up on
  the next cycle and the terminal automatically re-opens.

> **Known gap (§10):** the server-side auto-transition
> `trial → grace → locked` (and the 30-day offline lock) lived in
> `desktop-sync.ts → transitionBranchSubscription`, invoked only by the now-dormant
> `getSyncData`. With the desktop no longer calling `/api/sync`, that code does
> not run. Lifecycle transitions currently rely on HQ/external triggers.

### 5.8 Auto-sync scheduler — `startAutoSync()` / `stopAutoSync()`

Designed for **Supabase free tier** (500k req/mo, tight egress):

| Behavior | Detail |
|---|---|
| Single-flight | `_syncing` guard prevents overlapping cycles. |
| Base interval | **5 minutes** (recursive `setTimeout`). |
| Backoff | On failure, next delay = `min(5m * 2^failStreak, 30m)`. Resets on success. |
| Trigger on focus | `visibilitychange` → run a cycle when tab becomes visible. |
| Trigger on reconnect | `window 'online'` → run a cycle. |
| Guards | Skips when `navigator.onLine === false` or not linked. |
| Cost | Idle cycle ≈ **2 requests** (1 pull batch + 1 ack); pushes only when `sync_queue` is non-empty. |

`startAutoSync()` is called once `App.tsx` reports the DB ready; `stopAutoSync()`
cleans up listeners on unmount.

---

## 6. Sequence: endpoint edit → HQ sees it

```
Operator saves product in Inventory.tsx
  ├─ Pe()  → local SQLite (instant, offline-safe)
  ├─ qs("products", id, "update", cloudPayload)  → sync_queue
  └─ runSyncCycle()  (fire-and-forget)
        └─ bulkPush() → supabase.from("products").upsert([row])   ★ reaches cloud
HQ console / admin query reads Supabase `products`  → sees the change
```

## 7. Sequence: HQ locks a branch

```
HQ admin → POST /api/hq/commands {cmd:"lock_branch", branchId}
  ├─ insert branch_commands(status=pending)
  └─ update branches set subscription_status='locked'
(next auto-sync on the endpoint)
  ├─ pull: branches row (status=locked) + branch_commands(pending)
  ├─ applyCommand → app_settings.subscription_status='locked'
  ├─ acknowledge branch_commands
  └─ checkSubscriptionBlocked() → blocked=true → "Terminal Locked" overlay
```

---

## 8. Schema responsibility & migrations

- **Local SQLite**: owned by `database.ts` (self-migrating).
- **Cloud Postgres**: owned by the operator. The endpoint does **not** create
  cloud tables. Run, in Supabase SQL editor:
  1. `sql/00_hq_schema_requirements.sql` — creates/extends `products`,
     `batches`, `accounts`, `branches` columns, indexes, RLS for other tables.
  2. `sql/migrations/branch_commands.sql` — the command queue table.
- All statements are idempotent (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
- When adding a cloud column, you must update **both** `database.ts` (local) and
  the SQL file (cloud), and shape the `qs()` payload accordingly.

---

## 9. Security considerations

1. **RLS off for `products`/`batches`** → the anon key can read/write every
   branch's catalog and stock. This is why direct client replication works, but
   it means *any* caller with the anon key can mutate these tables. Before
   production, enable RLS with policies scoping rows to the authenticated
   account/branch (e.g. `branches.account_id = auth.uid()...` joined via
   `batches.branch_id`). Note: the endpoint's `bulkPush`/`runSyncCycle` would
   then need those policies to permit the account user's writes.
2. **`branch_commands`** is written by HQ (service role) and read by the
   endpoint (anon). If you enable RLS on it, allow the endpoint account to
   `select` its own `pending` commands and `update` to `acknowledged`.
3. **Token in git remote**: the configured push URL embeds a GitHub PAT — rotate
   it and prefer SSH/deploy keys.
4. **Lock enforcement is client-side** (best-effort). A determined user could
   tamper with local `app_settings` to hide a lock; treat the cloud
   `subscription_status` as the enforceable truth for billing, not as a hard
   security boundary.

---

## 10. Known issues / follow-ups

- **Server lifecycle dormant.** `transitionBranchSubscription`
  (trial→grace→locked, 30-day offline lock) only ran inside `getSyncData`, which
  the desktop no longer calls. Move it to a Supabase cron / HQ scheduled job, or
  re-introduce a server pull that the desktop tolerates.
- **`GET /api/sync` is unused** by the endpoint. Keep it (other clients / future
  server-push) or delete to reduce surface area.
- **No conflict resolution.** Sync is last-writer-wins by `updated_at`; concurrent
  edits at HQ and branch can clobber. Acceptable for catalog/stock today, revisit
  if multi-writer contention appears.
- **`sales` push does not enqueue `sale_items`** (only the `sales` header). HQ
  sale intel works; per-line item replication would need `qs("sale_items", …)`.
- **RLS hardening** (see §9) is the top production blocker.

---

## 11. How to add a new synced entity (recipe)

1. Add the column/table to **local** `database.ts` (`CREATE` + idempotent
   `ALTER`).
2. Add the matching **cloud** definition to `sql/00_hq_schema_requirements.sql`.
3. In the write path, call `qs("my_table", rowId, op, cloudShapedPayload)` after
   the `Pe()` local write, and `runSyncCycle()` if you want prompt upload.
4. In `applyPulledData()` (`sync.ts`), add a `for (const r of data.my_table) upsertLocal(...)`.
5. In `runSyncCycle()` pull block, add the Supabase `select` (scoped by
   `branch_id` where relevant, filtered by `updated_at > since`) and include its
   count in `pulled`.
6. Ensure RLS (once enabled) permits the account user's select/upsert on the
   table.

---

## 12. Build & release

- Frontend: `npm run build` (`tsc && vite build`) → `dist/`.
- Desktop bundle: `npm run tauri:build` →
  `src-tauri/target/release/bundle/nsis/Cervos POS_<ver>_x64-setup.exe`
  (NSIS installer) + `src-tauri/target/release/cervos-pos.exe`.
- Version is set in `src-tauri/tauri.conf.json` (`version`).
- Build artifacts (`dist/`, `src-tauri/target/`, `node_modules/`) are gitignored.
