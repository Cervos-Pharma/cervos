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
import {
  allocateFefoBatches,
  inferCatalogSegment,
  parseGs1Barcode,
  parseScanIntent,
  reconcileCashShift,
} from "@cervos/core";
import { acknowledgeSync, getSyncData } from "@/lib/actions/desktop-sync";
import { sanitizeText } from "@/lib/security/harness";
import { noStoreJson } from "@/lib/workspace/cookies";
import {
  hasAnyInjection,
  parseJsonObject,
  readWorkspaceAccountToken,
  sanitizeBatchImageUrl,
} from "@/lib/workspace/request-auth";
import {
  appendAuditLog,
  ensureAccountDomainData,
  ensureCloudCatalog,
  flushWorkspaceDb,
  getWorkspaceDb,
  isAccountAccessLocked,
  newId,
  recordCloudCatalogProduct,
  recordCustomDrugCategory,
  saveWorkspaceDb,
  type WorkspaceExpenseRecord,
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
      cloudCatalog: ensureCloudCatalog(db),
      expenses: (db.expenses ?? []).filter((e) => e.accountId === account.id).slice(0, 100),
      shiftLogs: (db.shiftLogs ?? []).filter((s) => s.accountId === account.id).slice(0, 50),
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
    const seenStore = (db as unknown as { syncedKeys?: Record<string, string[]> }).syncedKeys ??= {};
    const accountSeenList = (seenStore[account.id] ??= []);
    const accountSeenSet = new Set(accountSeenList);

    for (const mut of queuedMutations.slice(0, 50)) {
      const idempotencyKey = sanitizeText(mut.idempotencyKey, 80);
      const mutType = sanitizeText(mut.type, 40);

      if (idempotencyKey && accountSeenSet.has(idempotencyKey)) {
        syncedKeys.push(idempotencyKey);
        continue;
      }
      const prevSyncedLen = syncedKeys.length;
      const markSynced = () => {
        if (!idempotencyKey) return;
        syncedKeys.push(idempotencyKey);
        if (!accountSeenSet.has(idempotencyKey)) {
          accountSeenSet.add(idempotencyKey);
          accountSeenList.push(idempotencyKey);
          if (accountSeenList.length > 1000) {
            accountSeenList.splice(0, accountSeenList.length - 1000);
          }
        }
      };

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
              prescriptionRef: sanitizeText(mut.prescriptionRef, 80) || null,
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
      } else if (mutType === "add_batch" && idempotencyKey) {
        const dupId = `bat_sync_${idempotencyKey}`;
        db.batches = db.batches ?? [];
        if (db.batches.some((b) => b.id === dupId)) {
          syncedKeys.push(idempotencyKey);
          continue;
        }
        if (hasAnyInjection([mut.brandName, mut.genericName, mut.batchNumber, mut.category, mut.gs1Barcode, mut.barcode])) {
          syncedKeys.push(idempotencyKey);
          continue;
        }
        const centreId = sanitizeText(mut.centreId, 80) || fallbackCentreId;
        const brandName = sanitizeText(mut.brandName, 80);
        if (brandName.length >= 2) {
          const genericName = sanitizeText(mut.genericName, 80) || brandName;
          const resolvedCategory = sanitizeText(mut.category, 40) || "Essential";
          const scanned = typeof mut.gs1Barcode === "string" && mut.gs1Barcode.trim() ? parseGs1Barcode(mut.gs1Barcode) : null;
          const intent = typeof mut.barcode === "string" && mut.barcode.trim() ? parseScanIntent(mut.barcode) : null;
          const resolvedBarcode = sanitizeText(
            scanned?.gtin ||
              (intent?.kind === "gs1" ? intent.gtin : intent?.kind === "barcode" ? intent.code : mut.barcode),
            64
          );
          const batchNumber = scanned?.batchNumber || sanitizeText(mut.batchNumber, 40) || `LOT-${Date.now().toString().slice(-4)}`;
          const expiryDate =
            scanned?.expiryDate ||
            (typeof mut.expiryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(mut.expiryDate)
              ? mut.expiryDate
              : new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10));
          const quantity = Math.max(1, Math.min(5000, Math.round(Number(mut.quantity) || 20)));
          const salePriceTzs = Math.max(100, Math.round(Number(mut.salePriceTzs) || 3500));
          const costPriceTzs = Math.max(50, Math.round(Number(mut.costPriceTzs) || Math.round(salePriceTzs * 0.72)));
          const lowStockThreshold = Math.max(1, Math.min(1000, Math.round(Number(mut.lowStockThreshold) || 25)));
          recordCustomDrugCategory(account, resolvedCategory);
          const catalogEntry = recordCloudCatalogProduct(db, {
            barcode: resolvedBarcode || undefined,
            brandName,
            genericName,
            category: resolvedCategory,
            costPriceTzs,
            salePriceTzs,
            lowStockThreshold,
            requiresPrescription: Boolean(mut.requiresPrescription),
          });
          db.batches.unshift({
            id: dupId,
            accountId: account.id,
            centreId,
            productId: sanitizeText(mut.productId, 40) || catalogEntry?.masterId || catalogEntry?.id || newId("prod"),
            ...(resolvedBarcode ? { barcode: resolvedBarcode } : {}),
            segment: inferCatalogSegment(`${resolvedCategory} ${genericName} ${brandName}`),
            genericName,
            brandName,
            category: resolvedCategory,
            batchNumber,
            quantity,
            costPriceTzs,
            salePriceTzs,
            expiryDate,
            lowStockThreshold,
            imageUrl: sanitizeBatchImageUrl(mut.imageUrl),
            requiresPrescription: Boolean(mut.requiresPrescription),
            isControlled: false,
            quarantined: false,
            createdAt: typeof mut.createdAt === "string" ? mut.createdAt : new Date().toISOString(),
          });
          appendAuditLog(db, {
            accountId: account.id,
            actor: sanitizeText(mut.operatorName, 80) || "Offline Station",
            category: "SETUP",
            action: `Synced offline batch ${batchNumber}: ${brandName} (${quantity} units)`,
          });
        }
        syncedKeys.push(idempotencyKey);
      } else if (mutType === "edit_batch" && idempotencyKey) {
        const batchId = sanitizeText(mut.batchId, 60);
        const batch = (db.batches ?? []).find((b) => b.id === batchId && b.accountId === account.id);
        if (batch) {
          const brandName = sanitizeText(mut.brandName, 80);
          const genericName = sanitizeText(mut.genericName, 80);
          const category = sanitizeText(mut.category, 40);
          const batchNumber = sanitizeText(mut.batchNumber, 40);
          const barcode = sanitizeText(mut.barcode, 64);
          if (brandName.length >= 2) batch.brandName = brandName;
          if (genericName.length >= 2) batch.genericName = genericName;
          if (category.length >= 2) {
            batch.category = category;
            batch.segment = inferCatalogSegment(category);
            recordCustomDrugCategory(account, category);
          }
          if (batchNumber.length >= 2) batch.batchNumber = batchNumber;
          if (barcode) batch.barcode = barcode;
          if (mut.quantity !== undefined) batch.quantity = Math.max(0, Math.min(10000, Math.round(Number(mut.quantity) || 0)));
          if (mut.costPriceTzs !== undefined) batch.costPriceTzs = Math.max(50, Math.round(Number(mut.costPriceTzs) || batch.costPriceTzs));
          if (mut.salePriceTzs !== undefined) batch.salePriceTzs = Math.max(100, Math.round(Number(mut.salePriceTzs) || batch.salePriceTzs));
          if (mut.lowStockThreshold !== undefined) batch.lowStockThreshold = Math.max(1, Math.min(1000, Math.round(Number(mut.lowStockThreshold) || 25)));
          if (typeof mut.expiryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(mut.expiryDate)) batch.expiryDate = mut.expiryDate;
          if (mut.requiresPrescription !== undefined) batch.requiresPrescription = Boolean(mut.requiresPrescription);
          recordCloudCatalogProduct(db, {
            barcode: batch.barcode,
            brandName: batch.brandName,
            genericName: batch.genericName,
            category: batch.category,
            costPriceTzs: batch.costPriceTzs,
            salePriceTzs: batch.salePriceTzs,
            lowStockThreshold: batch.lowStockThreshold,
            requiresPrescription: batch.requiresPrescription,
          });
        }
        syncedKeys.push(idempotencyKey);
      } else if (mutType === "adjust_qty" && idempotencyKey) {
        const batchId = sanitizeText(mut.batchId, 60);
        const batch = (db.batches ?? []).find((b) => b.id === batchId && b.accountId === account.id);
        if (batch) {
          if (mut.delta !== undefined) {
            batch.quantity = Math.max(0, Math.min(10000, batch.quantity + Math.round(Number(mut.delta) || 0)));
          } else if (mut.quantity !== undefined) {
            batch.quantity = Math.max(0, Math.min(10000, Math.round(Number(mut.quantity) || 0)));
          }
        }
        syncedKeys.push(idempotencyKey);
      } else if (mutType === "toggle_quarantine" && idempotencyKey) {
        const batchId = sanitizeText(mut.batchId, 60);
        const batch = (db.batches ?? []).find((b) => b.id === batchId && b.accountId === account.id);
        if (batch) {
          batch.quarantined = mut.quarantined !== undefined ? Boolean(mut.quarantined) : !batch.quarantined;
        }
        syncedKeys.push(idempotencyKey);
      } else if (mutType === "log_expense" && idempotencyKey) {
        const dupId = `exp_sync_${idempotencyKey}`;
        db.expenses = db.expenses ?? [];
        if (!db.expenses.some((e) => e.id === dupId)) {
          const allowed = new Set<WorkspaceExpenseRecord["category"]>([
            "Rent & Premises",
            "Utilities & Cold Chain",
            "Staff & Shift",
            "Compliance & Permits",
            "Packaging & Supplies",
          ]);
          const rawCat = sanitizeText(mut.category, 60) as WorkspaceExpenseRecord["category"];
          const category = allowed.has(rawCat) ? rawCat : "Packaging & Supplies";
          const description = sanitizeText(mut.description, 160);
          const amountTzs = Math.max(0, Math.round(Number(mut.amountTzs) || 0));
          if (description.length >= 2 && amountTzs > 0) {
            db.expenses.unshift({
              id: dupId,
              accountId: account.id,
              centreId: sanitizeText(mut.centreId, 80) || fallbackCentreId,
              category,
              description,
              amountTzs,
              createdAt: typeof mut.createdAt === "string" ? mut.createdAt : new Date().toISOString(),
            });
            appendAuditLog(db, {
              accountId: account.id,
              actor: sanitizeText(mut.operatorName, 80) || "Offline Station",
              category: "BILLING",
              action: `Synced offline ${category} expense: ${description} (TZS ${amountTzs.toLocaleString("en-US")})`,
            });
          }
        }
        syncedKeys.push(idempotencyKey);
      } else if (mutType === "shift_reconcile" && idempotencyKey) {
        const result = reconcileCashShift({
          openingCashTzs: Number(mut.openingCashTzs) || 0,
          cashSalesTzs: Number(mut.cashSalesTzs) || 0,
          cashRefundsTzs: Number(mut.cashRefundsTzs) || 0,
          mobileMoneySalesTzs: Number(mut.mobileMoneySalesTzs) || 0,
          declaredCashTzs: Number(mut.declaredCashTzs) || 0,
        });
        const profId = sanitizeText(mut.profileId, 80);
        const openShift = (db.shiftLogs ?? []).find((s) => s.accountId === account.id && s.profileId === profId && !s.clockOutAt);
        if (openShift) {
          const nowIso = new Date().toISOString();
          openShift.clockOutAt = nowIso;
          openShift.durationMinutes = Math.max(1, Math.round((Date.now() - Date.parse(openShift.clockInAt)) / 60000));
        }
        appendAuditLog(db, {
          accountId: account.id,
          actor: sanitizeText(mut.operatorName, 80) || "Offline Counter",
          category: "POS",
          action: `Synced blind shift close (${result.status.toUpperCase()} · Expected TZS ${result.expectedCashTzs.toLocaleString("en-US")}, Variance TZS ${result.varianceTzs.toLocaleString("en-US")})`,
        });
        markSynced();
      } else if (mutType === "branch_chat" && idempotencyKey) {
        const dupId = `msg_sync_${idempotencyKey}`;
        db.branchMessages = db.branchMessages ?? [];
        if (!db.branchMessages.some((m) => m.id === dupId)) {
          const msgBody = sanitizeText(mut.body ?? mut.text, 500);
          if (msgBody) {
            db.branchMessages.push({
              id: dupId,
              accountId: account.id,
              centreId: sanitizeText(mut.centreId, 80) || fallbackCentreId,
              senderProfileId: sanitizeText(mut.profileId, 80) || "offline",
              senderName: sanitizeText(mut.operatorName, 80) || "Staff",
              senderRole: sanitizeText(mut.role, 40) || "pos_cashier",
              body: msgBody,
              createdAt: typeof mut.createdAt === "string" ? mut.createdAt : new Date().toISOString(),
            });
          }
        }
        markSynced();
      }
      if (syncedKeys.length === prevSyncedLen && idempotencyKey && mutType !== "shift_clock" && mutType !== "sale") {
        // Record handled non-sale/shift keys as seen even if pushed synchronously
        accountSeenSet.add(idempotencyKey);
        accountSeenList.push(idempotencyKey);
      } else if (syncedKeys.length > prevSyncedLen && idempotencyKey && !accountSeenSet.has(idempotencyKey)) {
        accountSeenSet.add(idempotencyKey);
        accountSeenList.push(idempotencyKey);
        if (accountSeenList.length > 1000) {
          accountSeenList.splice(0, accountSeenList.length - 1000);
        }
      }
    }

    if (syncedKeys.length > 0) {
      saveWorkspaceDb(db);
      await flushWorkspaceDb();
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
