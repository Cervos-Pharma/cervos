/**
 * @route GET /api/sync
 * @route POST /api/sync
 * @access Multi-client sync endpoint (Desktop Tauri, Android Expo, and Web PWA).
 *
 * Authenticates via either:
 *   1. Workspace HMAC session (`Authorization: Bearer <token>` or `cervos_ws_acct` cookie)
 *   2. Supabase SSR auth session (legacy cloud Postgres desktop sync)
 *
 * Supports idempotent offline-queued sale and shift mutations on POST via `idempotencyKey`.
 */
import type { NextRequest } from "next/server";
import { allocateFefoBatches } from "@cervos/core";
import { acknowledgeSync, getSyncData } from "@/lib/actions/desktop-sync";
import { sanitizeText } from "@/lib/security/harness";
import { noStoreJson } from "@/lib/workspace/cookies";
import { parseJsonObject, readWorkspaceAccountToken } from "@/lib/workspace/request-auth";
import {
  appendAuditLog,
  ensureAccountDomainData,
  getWorkspaceDb,
  isAccountAccessLocked,
  saveWorkspaceDb,
  type WorkspaceSaleLine,
  type WorkspaceSaleRecord,
} from "@/lib/workspace/store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const since = request.nextUrl.searchParams.get("since") || "1970-01-01T00:00:00.000Z";
  const wsSession = readWorkspaceAccountToken(request);

  if (wsSession && !wsSession.accountId.startsWith("joinreq:")) {
    const db = getWorkspaceDb();
    const account = db.accounts.find((a) => a.id === wsSession.accountId);
    if (!account) {
      return noStoreJson({ error: "Workspace account not found." }, { status: 404 });
    }
    const primaryCentre = db.centres.find((c) => c.accountId === account.id);
    if (primaryCentre) {
      ensureAccountDomainData(db, account.id, primaryCentre.id);
    }
    const lock = isAccountAccessLocked(account);
    const sinceMs = Date.parse(since) || 0;

    const centres = db.centres.filter((c) => c.accountId === account.id);
    const batches = (db.batches ?? [])
      .filter((b) => b.accountId === account.id)
      .map((b) => ({
        id: b.id,
        branch_id: b.centreId,
        product_id: b.productId,
        brand_name: b.brandName,
        generic_name: b.genericName,
        category: b.category,
        batch_number: b.batchNumber,
        quantity: b.quantity,
        cost_price: b.costPriceTzs,
        sale_price: b.salePriceTzs,
        expiry_date: b.expiryDate,
        low_stock_threshold: b.lowStockThreshold ?? 15,
        quarantined: b.quarantined,
      }));
    const sales = (db.sales ?? [])
      .filter((s) => s.accountId === account.id && (Date.parse(s.createdAt) || 0) >= sinceMs)
      .slice(0, 100);
    const profiles = db.profiles
      .filter((p) => p.accountId === account.id)
      .map((p) => ({
        id: p.id,
        branch_id: p.centreId,
        name: p.displayName,
        username: p.username,
        role: p.role,
        is_master_admin: p.isMasterAdmin,
      }));

    return noStoreJson({
      mode: "workspace",
      accountId: account.id,
      accessLock: lock,
      suspended: lock.locked,
      branches: centres.map((c) => ({
        id: c.id,
        name: c.name,
        region: c.region,
        account_id: account.id,
        lat: c.lat ?? null,
        lng: c.lng ?? null,
        subscription_status: lock.locked ? "locked" : account.subscriptionActive ? "active" : "trial",
        last_synced_at: new Date().toISOString(),
      })),
      batches,
      sales,
      operators: profiles,
      serverTime: new Date().toISOString(),
    });
  }

  const accountId = request.headers.get("x-account-id");
  if (!accountId) {
    return noStoreJson({ error: "Authentication session or x-account-id required." }, { status: 401 });
  }

  try {
    const data = await getSyncData(since, accountId);
    if (!data) {
      return noStoreJson({ error: "Unauthorized" }, { status: 401 });
    }
    return noStoreJson(data);
  } catch (err) {
    console.error("GET /api/sync error:", err);
    return noStoreJson({ error: "Sync pull failed." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parseJsonObject(request, "Invalid JSON payload.");
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const wsSession = readWorkspaceAccountToken(request);
  if (wsSession && !wsSession.accountId.startsWith("joinreq:")) {
    const db = getWorkspaceDb();
    const account = db.accounts.find((a) => a.id === wsSession.accountId);
    if (!account) {
      return noStoreJson({ error: "Workspace account not found." }, { status: 404 });
    }
    const lock = isAccountAccessLocked(account);
    if (lock.locked) {
      return noStoreJson(
        { error: lock.reason, locked: true, source: lock.source },
        { status: 423 }
      );
    }

    const fallbackCentreId = db.centres.find((c) => c.accountId === account.id)?.id || "";
    if (fallbackCentreId) {
      ensureAccountDomainData(db, account.id, fallbackCentreId);
    }
    const queuedMutations = Array.isArray(body.mutations)
      ? (body.mutations as Array<Record<string, unknown>>)
      : [];
    const syncedKeys: string[] = [];

    for (const mut of queuedMutations.slice(0, 50)) {
      const idempotencyKey = sanitizeText(mut.idempotencyKey, 80);
      const mutType = sanitizeText(mut.type, 40);

      if (mutType === "sale" && idempotencyKey) {
        const dupId = `sync_${idempotencyKey}`;
        if ((db.sales ?? []).some((s) => s.id === dupId)) {
          syncedKeys.push(idempotencyKey);
          continue;
        }
        const centreId = sanitizeText(mut.centreId, 80) || fallbackCentreId;
        const items = Array.isArray(mut.items)
          ? (mut.items as Array<{ productId?: string; qty?: number }>)
          : [];
        const lines: WorkspaceSaleLine[] = [];
        let totalTzs = 0;

        for (const row of items) {
          const productId = sanitizeText(row.productId, 80);
          const qty = Math.max(1, Math.min(999, Number(row.qty) || 1));
          const pool = (db.batches ?? []).filter(
            (b) =>
              b.accountId === account.id &&
              b.centreId === centreId &&
              b.productId === productId &&
              !b.quarantined &&
              b.quantity > 0
          );
          if (pool.length === 0) continue;
          const alloc = allocateFefoBatches(
            pool.map((b) => ({
              id: b.id,
              batchNumber: b.batchNumber,
              quantity: b.quantity,
              expiryDate: b.expiryDate,
              createdAt: b.createdAt,
              quarantined: b.quarantined,
            })),
            qty,
            {
              requiresPrescription: pool[0].requiresPrescription,
              isControlled: pool[0].isControlled,
            }
          );
          if (!alloc.ok) continue;
          for (const step of alloc.allocations) {
            const batchRow = db.batches!.find((b) => b.id === step.batchId);
            if (!batchRow) continue;
            batchRow.quantity = Math.max(0, batchRow.quantity - step.quantityAllocated);
            totalTzs += step.quantityAllocated * batchRow.salePriceTzs;
            lines.push({
              productId,
              brandName: batchRow.brandName,
              category: batchRow.category,
              batchId: batchRow.id,
              batchNumber: batchRow.batchNumber,
              qty: step.quantityAllocated,
              unitPriceTzs: batchRow.salePriceTzs,
              unitCostTzs: batchRow.costPriceTzs,
            });
          }
        }

        if (lines.length > 0) {
          const payRaw = mut.paymentMethod;
          const paymentMethod: WorkspaceSaleRecord["paymentMethod"] =
            payRaw === "mpesa" || payRaw === "tigo" || payRaw === "halopesa" || payRaw === "card"
              ? payRaw
              : "cash";
          const saleRecord: WorkspaceSaleRecord = {
            id: dupId,
            receiptNumber: `RCP-${idempotencyKey.slice(-6).toUpperCase()}`,
            accountId: account.id,
            centreId,
            profileId: sanitizeText(mut.profileId, 80) || "offline-sync",
            actorName: sanitizeText(mut.operatorName, 80) || "Offline Counter",
            paymentMethod,
            totalTzs,
            itemCount: lines.reduce((s, l) => s + l.qty, 0),
            lines,
            createdAt:
              typeof mut.createdAt === "string" && !Number.isNaN(Date.parse(mut.createdAt))
                ? mut.createdAt
                : new Date().toISOString(),
          };
          db.sales!.unshift(saleRecord);
          appendAuditLog(db, {
            accountId: account.id,
            actor: saleRecord.actorName,
            category: "POS",
            action: `Synced offline receipt ${saleRecord.receiptNumber} (${saleRecord.itemCount} items)`,
          });
        }
        syncedKeys.push(idempotencyKey);
      } else if (mutType === "shift_clock" && idempotencyKey) {
        const dupId = `shift_${idempotencyKey}`;
        db.shiftLogs = db.shiftLogs ?? [];
        if (!db.shiftLogs.some((s) => s.id === dupId)) {
          const nowIso = new Date().toISOString();
          db.shiftLogs.unshift({
            id: dupId,
            accountId: account.id,
            centreId: sanitizeText(mut.centreId, 80) || fallbackCentreId,
            profileId: sanitizeText(mut.profileId, 80) || "offline",
            staffName: sanitizeText(mut.operatorName, 80) || "Staff",
            role: sanitizeText(mut.role, 40) || "pos_cashier",
            clockInAt: nowIso,
            ...(mut.clockType === "out" ? { clockOutAt: nowIso } : {}),
          });
        }
        syncedKeys.push(idempotencyKey);
      }
    }

    if (syncedKeys.length > 0) {
      saveWorkspaceDb(db);
    }

    return noStoreJson({
      error: null,
      ok: true,
      syncedKeys,
      serverTime: new Date().toISOString(),
    });
  }

  const accountId = request.headers.get("x-account-id");
  if (!accountId) {
    return noStoreJson({ error: "Missing x-account-id header" }, { status: 400 });
  }
  const branchId = typeof body.branchId === "string" ? body.branchId : "";
  const syncedAt = typeof body.syncedAt === "string" ? body.syncedAt : "";
  if (!branchId || !syncedAt) {
    return noStoreJson({ error: "branchId and syncedAt are required" }, { status: 400 });
  }

  try {
    const result = await acknowledgeSync(branchId, syncedAt, accountId);
    if (result.error) {
      return noStoreJson(
        { error: result.error },
        { status: result.error === "Unauthorized" ? 401 : 500 }
      );
    }
    return noStoreJson({ error: null, ok: true, serverTime: new Date().toISOString() });
  } catch (err) {
    console.error("POST /api/sync error:", err);
    return noStoreJson({ error: "Sync push failed." }, { status: 500 });
  }
}
