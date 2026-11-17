/**
 * @file lib/actions/desktop-sync.ts
 * @description Server actions + API route handlers for the Cervos desktop endpoint.
 *
 * The desktop app (Electron/SQLite at each pharmacy branch) syncs data by calling
 * `GET /api/sync?since=<last_synced_at>` â€” an API route (not a "use server" action)
 * that uses the session cookie for auth and returns delta changes across all tables.
 *
 * Subscription status is checked per-branch on every sync:
 *   - account subscription is active â†’ branch access granted
 *   - account is trial â†’ branch is trial (trial_ends_at)
 *   - account is grace â†’ branch is grace (grace_ends_at)
 *   - account is locked â†’ branch is locked (desktop goes into read-only mode)
 *
 * For HQ-managed unlocks, `manualUnlockBranch` in hq.ts sets status back to active.
 *
 * @environment NEXT_PUBLIC_SUPABASE_URL
 * @environment NEXT_PUBLIC_SUPABASE_ANON_KEY
 * @environment SUPABASE_SERVICE_ROLE_KEY  â€” used only in the sync API route for
 *          writes (upserting syncacknowledgements), never in read-only paths.
 */

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

const TRIAL_DAYS = 7;
const GRACE_DAYS = 3;
const OFFLINE_LOCK_DAYS = 30;

function addDays(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString();
}

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type BranchStatus = "active" | "trial" | "grace" | "locked";

export interface BranchAccess {
  branchId: string;
  accountId: string;
  status: BranchStatus;
  canWrite: boolean;
  trialEndsAt: string | null;
  graceEndsAt: string | null;
  accountBillingStatus: string;
  suspended: boolean;
  syncedAt: string;
}

export interface SyncResponse {
  branches: Array<{
    id: string;
    name: string;
    account_id: string;
    lat: number | null;
    lng: number | null;
    subscription_status: string;
    trial_ends_at: string | null;
    grace_ends_at: string | null;
    last_synced_at: string | null;
    locked_reason: string | null;
    updated_at: string;
  }>;
  batches: Array<{
    id: string;
    branch_id: string;
    product_id: string;
    batch_number: string | null;
    quantity: number;
    cost_price: number;
    sale_price: number;
    expiry_date: string;
    sync_version: number;
    updated_at: string;
  }>;
  products: Array<{
    id: string;
    generic_name: string;
    brand_name: string | null;
    category: string | null;
    requires_prescription: boolean;
    unit_desc: string | null;
    updated_at: string;
  }>;
  sale_items: Array<{
    id: string;
    sale_id: string;
    batch_id: string;
    quantity: number;
    unit_price: number;
    created_at: string | null;
  }>;
  operators: Array<{
    id: string;
    branch_id: string;
    name: string;
    pin_hash: string;
    role: string;
    created_at: string | null;
  }>;
  commands: Array<{
    id: string;
    branch_id: string;
    command: string;
    reason: string | null;
    created_at: string;
  }>;
  serverTime: string;
  suspended?: boolean;
}

// â”€â”€â”€ Subscription helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Returns the effective branch access status for the desktop endpoint.
 * Mirrors the subscription logic from the shared migration â€” trial, grace,
 * and locked states are derived from the account's subscription + branch-level stamps.
 *
 * Called by: the sync API route (read-only, uses anon client with RLS).
 */
export async function getBranchAccess(branchId: string): Promise<BranchAccess | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: branch } = await supabase
    .from("branches")
    .select("id, name, account_id, subscription_status, trial_ends_at, grace_ends_at, last_synced_at, lat, lng")
    .eq("id", branchId)
    .maybeSingle();

  if (!branch) return null;

  const { data: account } = await supabase
    .from("accounts")
    .select("id, billing_status, subscription_status, subscription_expires_at, suspended_at")
    .eq("id", branch.account_id)
    .maybeSingle();

  if (!account) return null;

  const now = new Date();
  const suspended = Boolean(account.suspended_at);
  const effectiveStatus = suspended
    ? "locked"
    : resolveStatus(account.subscription_status, branch.subscription_status, branch.trial_ends_at, branch.grace_ends_at, now);
  const canWrite = effectiveStatus !== "locked";

  return {
    branchId: branch.id,
    accountId: account.id,
    status: effectiveStatus,
    canWrite,
    trialEndsAt: branch.trial_ends_at,
    graceEndsAt: branch.grace_ends_at,
    accountBillingStatus: account.billing_status,
    suspended,
    syncedAt: new Date().toISOString(),
  };
}

/**
 * Determines effective subscription status from account + branch timestamps.
 * - "active"   : account active and not expired, branch not in trial/grace/locked
 * - "trial"    : trial_ends_at is set and in the future
 * - "grace"    : grace_ends_at is set and in the future
 * - "locked"   : account is "locked" OR account subscription is past expires_at
 */
function resolveStatus(
  acctSub: string | null,
  branchStatus: string | null,
  trialEndsAt: string | null,
  graceEndsAt: string | null,
  now: Date
): BranchStatus {
  if (branchStatus === "locked") return "locked";
  if (acctSub === "locked") return "locked";

  const trialEnd = trialEndsAt ? new Date(trialEndsAt) : null;
  const graceEnd = graceEndsAt ? new Date(graceEndsAt) : null;

  if (trialEnd && trialEnd > now) return "trial";
  if (graceEnd && graceEnd > now) return "grace";
  if (acctSub === "active" || acctSub === "trial") return "active";
  return "locked";
}

/**
 * Evaluates and auto-transitions a branch's subscription status.
 * Called during every sync to enforce the lifecycle:
 *   trial (7 days) â†’ grace (3 days) â†’ locked
 * Also locks branches that have been offline for > 30 days while not on active plan.
 *
 * Uses service-role client to bypass RLS.
 */
async function transitionBranchSubscription(
  branchId: string,
  accountId: string,
  currentStatus: string,
  trialEndsAt: string | null,
  graceEndsAt: string | null,
  lastSyncedAt: string | null
): Promise<string> {
  const supabase = await createServiceClient();
  const now = new Date();

  const patch: Record<string, unknown> = {};
  let newStatus = currentStatus;

  // Trial â†’ Grace transition
  if (currentStatus === "trial" && trialEndsAt && new Date(trialEndsAt) <= now) {
    patch.grace_ends_at = addDays(GRACE_DAYS);
    patch.trial_ends_at = null;
    patch.subscription_status = "grace";
    newStatus = "grace";
  }

  // Grace â†’ Locked transition
  if ((currentStatus === "grace" || newStatus === "grace") && graceEndsAt && new Date(graceEndsAt) <= now) {
    patch.subscription_status = "locked";
    patch.grace_ends_at = null;
    newStatus = "locked";
  }

  // Offline lock: > 30 days since last sync and not active
  if (lastSyncedAt && newStatus !== "active" && newStatus !== "locked") {
    const lastSync = new Date(lastSyncedAt);
    const daysSinceSync = (now.getTime() - lastSync.getTime()) / 86400000;
    if (daysSinceSync > OFFLINE_LOCK_DAYS) {
      patch.subscription_status = "locked";
      patch.locked_reason = "offline_lock";
      newStatus = "locked";
    }
  }

  if (Object.keys(patch).length > 0) {
    await supabase
      .from("branches")
      .update(patch)
      .eq("id", branchId)
      .eq("account_id", accountId);
  }

  return newStatus;
}

// â”€â”€â”€ Delta-sync â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Returns all records modified since `since` across branches, batches, and products.
 * Used by `GET /api/sync` â€” the desktop endpoint's primary sync endpoint.
 *
 * The response always includes `serverTime` so the client can update its
 * `last_synced_at` to the server's clock (prevents clock-skew drift).
 *
 * Branch rows are scoped to the authenticated account's branches.
 * Only rows with `updated_at > since` are returned (delta, not full).
 *
 * @param since     - ISO timestamp of last successful sync (exclusive)
 * @param accountId - The account ID to scope the sync to (validated against session)
 * @returns SyncResponse with changed rows, or null if unauthenticated
 */
export async function getSyncData(since: string, accountId: string): Promise<SyncResponse | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: account } = await supabase
    .from("accounts")
    .select("id, suspended_at")
    .eq("id", accountId)
    .eq("auth_user_id", user.id)
    .single();

  if (!account) return null;

  // Suspended accounts are cut off from new data. Their branches are reported
  // as locked so the desktop keeps existing local data but enters read-only.
  if (account.suspended_at) {
    const { data: lockedBranches } = await supabase
      .from("branches")
      .select("id, name, account_id, lat, lng, subscription_status, trial_ends_at, grace_ends_at, last_synced_at, locked_reason, updated_at")
      .eq("account_id", account.id);

    const { data: commands } = await supabase
      .from("branch_commands")
      .select("id, branch_id, command, reason, created_at")
      .eq("account_id", account.id)
      .eq("status", "pending");

    return {
      branches: (lockedBranches ?? []).map((b) => ({ ...b, subscription_status: "locked" })) as SyncResponse["branches"],
      batches: [],
      products: [],
      sale_items: [],
      operators: [],
      commands: (commands ?? []) as SyncResponse["commands"],
      serverTime: new Date().toISOString(),
      suspended: true,
    };
  }

  // Fetch all branches for the account to evaluate subscription status
  const { data: allBranches } = await supabase
    .from("branches")
    .select("id, name, account_id, lat, lng, subscription_status, trial_ends_at, grace_ends_at, last_synced_at, locked_reason, updated_at")
    .eq("account_id", account.id);

  // Also fetch branches modified since `since` for delta calculation
  const { data: branchesModified } = await supabase
    .from("branches")
    .select("id")
    .eq("account_id", account.id)
    .gt("updated_at", since);

  const branchesModifiedSince = new Set((branchesModified ?? []).map((b: { id: string }) => b.id));

  // Auto-transition subscription status for all branches (trialâ†’graceâ†’locked, offline lock)
  const transitionedBranches: SyncResponse["branches"] = [];

  for (const branch of (allBranches ?? []) as SyncResponse["branches"]) {
    const newStatus = await transitionBranchSubscription(
      branch.id,
      account.id,
      branch.subscription_status ?? "active",
      branch.trial_ends_at,
      branch.grace_ends_at,
      branch.last_synced_at
    );
    if (newStatus !== (branch.subscription_status ?? "active") || branchesModifiedSince.has(branch.id)) {
      const lockedReason = (newStatus === "locked" && !branch.locked_reason) ? "auto_locked" : branch.locked_reason;
      transitionedBranches.push({
        ...branch,
        subscription_status: newStatus,
        locked_reason: lockedReason ?? null,
      });
    }
  }

  const branchIds = (allBranches ?? []).map((b: { id: string }) => b.id);

  const [batchesResult, productsResult, commandsResult, saleItemsResult, operatorsResult] = await Promise.all([
    branchIds.length > 0
      ? supabase.from("batches").select("id, branch_id, product_id, batch_number, quantity, cost_price, sale_price, expiry_date, sync_version, updated_at").in("branch_id", branchIds).gt("updated_at", since)
      : Promise.resolve({ data: [] }),
    supabase
      .from("products")
      .select("id, generic_name, brand_name, category, formulation, requires_prescription, barcode, unit_desc, default_expiry, default_cost_price, default_sale_price, low_stock_threshold, notify_threshold, updated_at")
      .gt("updated_at", since),
    branchIds.length > 0
      ? supabase.from("branch_commands").select("id, branch_id, command, reason, created_at").in("branch_id", branchIds).eq("status", "pending")
      : Promise.resolve({ data: [] }),
    branchIds.length > 0
      ? (async () => {
        const { data: branchSales } = await supabase
          .from("sales")
          .select("id")
          .in("branch_id", branchIds)
          .gt("created_at", since);
        if (!branchSales || branchSales.length === 0) return { data: [] };
        return supabase
          .from("sale_items")
          .select("id, sale_id, batch_id, quantity, unit_price, created_at")
          .in("sale_id", branchSales.map((s: { id: string }) => s.id));
      })()
      : Promise.resolve({ data: [] }),
    branchIds.length > 0
      ? supabase.from("operators").select("id, branch_id, name, pin_hash, role, created_at").in("branch_id", branchIds)
      : Promise.resolve({ data: [] }),
  ]);

  return {
    branches: transitionedBranches,
    batches: (batchesResult.data ?? []) as SyncResponse["batches"],
    products: (productsResult.data ?? []) as SyncResponse["products"],
    sale_items: (saleItemsResult.data ?? []) as SyncResponse["sale_items"],
    operators: (operatorsResult.data ?? []) as SyncResponse["operators"],
    commands: (commandsResult.data ?? []) as SyncResponse["commands"],
    serverTime: new Date().toISOString(),
  };
}

/**
 * Called by the desktop endpoint after it has applied a batch of changes locally.
 * Acknowledges the sync by updating `branches.last_synced_at` so subsequent
 * delta queries exclude records already in the desktop's local DB.
 *
 * Uses the service-role client so the update bypasses RLS (the branch belongs
 * to the account but the session is at account level, not branch level).
 *
 * @param branchId  - The branch whose last_synced_at should be updated
 * @param syncedAt   - The server timestamp returned by getSyncData for this sync batch
 * @param accountId  - The account ID to scope the update (validated against session)
 */
export async function acknowledgeSync(
  branchId: string,
  syncedAt: string,
  accountId: string
): Promise<{ error: string | null }> {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const supabase = await createServiceClient();

  const { data: ownedAccount } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", accountId)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!ownedAccount) {
    return { error: "Unauthorized" };
  }

  const [{ error: branchError }, { error: cmdError }] = await Promise.all([
    supabase
      .from("branches")
      .update({ last_synced_at: syncedAt })
      .eq("id", branchId)
      .eq("account_id", accountId),
    supabase
      .from("branch_commands")
      .update({ status: "acknowledged", acknowledged_at: new Date().toISOString() })
      .eq("branch_id", branchId)
      .eq("account_id", accountId)
      .eq("status", "pending"),
  ]);

  if (branchError) return { error: branchError.message };
  if (cmdError) return { error: cmdError.message };
  return { error: null };
}
