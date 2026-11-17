import type { NextRequest } from "next/server";
import {
  allocateFefoBatches,
  parseGs1Barcode,
  reconcileCashShift,
} from "@cervos/core";
import {
  hashSecret,
  normalizeSecurityAnswer,
  sanitizeText,
  validatePinPolicy,
  validateUsernameSafe,
  verifySecret,
} from "@/lib/security/harness";
import {
  createProfileCookieValue,
  isTrustedBrowserCookieValid,
  WORKSPACE_PROFILE_TTL_SEC,
  WS_PROFILE_COOKIE,
  WS_TRUSTED_COOKIE,
} from "@/lib/security/session";
import { noStoreJson, setHttpCookie, setLangCookie } from "@/lib/workspace/cookies";
import { getNotificationEnvStatus } from "@/lib/workspace/env";
import {
  hasAnyInjection,
  isBearerClientRequest,
  parseJsonObject,
  readWorkspaceAccountToken,
  readWorkspaceProfileToken,
  readWorkspaceTrustedToken,
  sanitizeBatchImageUrl,
  sanitizeBrandCustomization,
} from "@/lib/workspace/request-auth";
import {
  appendAuditLog,
  clampProfileCapabilities,
  ensureAccountDomainData,
  getHqUpdates,
  getWorkspaceDb,
  isAccountAccessLocked,
  isUsernameTaken,
  newId,
  publicAccountSummary,
  publicJoinRequestSummary,
  publicProfileSummary,
  pushHqMessage,
  saveWorkspaceDb,
  suggestUniqueUsername,
  warmDbFromSupabase,
  SUPPLIER_CATALOG_SEED,
  type ProfileCapabilities,
  type WorkspaceExpenseRecord,
  type WorkspaceProfileRole,
  type WorkspaceSaleLine,
  type WorkspaceSaleRecord,
} from "@/lib/workspace/store";

const ALLOWED_PROFILE_ROLES = new Set<WorkspaceProfileRole>([
  "pharmacy_owner",
  "superintendent_pharmacist",
  "pos_cashier",
  "supplier_admin",
  "warehouse_dispatcher",
  "hospital_pharmacist",
  "policy_researcher",
  "investor_partner",
]);

export async function GET(request: NextRequest) {
  // Warm in-memory DB from Supabase on cold start
  await warmDbFromSupabase();

  const session = readWorkspaceAccountToken(request);
  if (!session) {
    return noStoreJson({ authenticated: false }, { status: 401 });
  }
  if (session.accountId.startsWith("joinreq:")) {
    return noStoreJson({ authenticated: true, loungeOnly: true, redirectTo: "/app/lounge" });
  }

  const db = getWorkspaceDb();
  const account = db.accounts.find((a) => a.id === session.accountId);
  if (!account) {
    return noStoreJson({ authenticated: false }, { status: 401 });
  }

  const ua = request.headers.get("user-agent") || "";
  const trustToken = readWorkspaceTrustedToken(request);
  const browserTrusted =
    !account.requireSecurityEveryTime &&
    Boolean(account.securityAnswerHash) &&
    isTrustedBrowserCookieValid(trustToken, account.id, ua);

  const profileSession = readWorkspaceProfileToken(request);
  const centres = db.centres.filter((c) => c.accountId === account.id);
  const profiles = db.profiles.filter((p) => p.accountId === account.id).map(publicProfileSummary);
  const passkeys = db.passkeys
    .filter((pk) => pk.accountId === account.id)
    .map((pk) => ({
      credentialId: pk.credentialId,
      profileId: pk.profileId,
      label: pk.label,
      createdAt: pk.createdAt,
    }));

  const activeProfile =
    profileSession && profileSession.accountId === account.id
      ? profiles.find((p) => p.id === profileSession.profileId) ?? null
      : null;

  const isOwnerSession =
    !!activeProfile &&
    (activeProfile.isMasterAdmin ||
      activeProfile.role === "pharmacy_owner" ||
      activeProfile.role === "supplier_admin");
  const activeCentreId =
    (isOwnerSession && profileSession?.centreId && centres.some((c) => c.id === profileSession.centreId)
      ? profileSession.centreId
      : activeProfile?.centreId) ??
    centres[0]?.id ??
    null;
  if (activeCentreId && ensureAccountDomainData(db, account.id, activeCentreId)) {
    saveWorkspaceDb(db);
  }

  // Gate / pre-unlock views must not expose operational or financial domain data before PIN unlock.
  if (!activeProfile) {
    return noStoreJson({
      authenticated: true,
      browserTrusted,
      account: publicAccountSummary(account),
      centres,
      profiles,
      passkeys,
      auditLogs: [],
      batches: [],
      sales: [],
      wholesaleOrders: [],
      branchMessages: [],
      notifications: [],
      hqMessages: [],
      savedCustomers: [],
      shiftLogs: [],
      notificationEnv: getNotificationEnvStatus(),
      expenses: [],
      paymentSettings: null,
      joinRequests: [],
      hqUpdates: getHqUpdates(db),
      supplierCatalog: SUPPLIER_CATALOG_SEED,
      stockAlerts: { nearExpiryCount: 0, expiredCount: 0, lowStockCount: 0 },
      activeCentreId,
      activeProfile: null,
    });
  }

  const activeCaps = activeProfile.capabilities;
  const auditLogs = isOwnerSession
    ? (db.auditLogs ?? []).filter((log) => log.accountId === account.id).slice(0, 15)
    : [];

  const batches = (db.batches ?? []).filter((b) => b.accountId === account.id);
  const allSales = (db.sales ?? []).filter((s) => s.accountId === account.id);
  const sales = activeCaps.canViewOrgReports
    ? allSales
    : allSales.filter((s) => s.profileId === activeProfile.id);
  const wholesaleOrders = (db.wholesaleOrders ?? []).filter((o) => o.accountId === account.id);
  const branchMessages = (db.branchMessages ?? []).filter(
    (m) => m.accountId === account.id && m.centreId === activeCentreId
  );
  const notifications = (db.notifications ?? []).filter((n) => n.accountId === account.id).slice(0, 12);
  const hqMessages = (db.hqMessages ?? []).filter((m) => m.accountId === account.id).slice(0, 15);
  const expenses = activeCaps.canViewFinance
    ? (db.expenses ?? []).filter((e) => e.accountId === account.id)
    : [];
  const savedCustomers = (db.savedCustomers ?? []).filter((c) => c.accountId === account.id);
  const shiftLogs = (db.shiftLogs ?? []).filter((s) => s.accountId === account.id).slice(0, 25);
  const paymentSettings = activeCaps.canViewFinance ? (db.paymentSettings?.[account.id] ?? null) : null;
  const joinRequests = isOwnerSession
    ? (db.joinRequests ?? [])
        .filter((r) => r.targetAccountId === account.id && r.status !== "accepted")
        .map(publicJoinRequestSummary)
    : [];

  const todayIso = new Date().toISOString().slice(0, 10);
  const cutoff30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const nearExpiryCount = batches.filter(
    (b) => !b.quarantined && b.quantity > 0 && b.expiryDate >= todayIso && b.expiryDate <= cutoff30
  ).length;
  const expiredCount = batches.filter((b) => b.quantity > 0 && b.expiryDate < todayIso).length;
  const lowStockCount = batches.filter((b) => !b.quarantined && b.quantity > 0 && b.quantity <= (b.lowStockThreshold ?? 25)).length;

  return noStoreJson({
    authenticated: true,
    browserTrusted,
    account: publicAccountSummary(account),
    centres,
    profiles,
    passkeys,
    auditLogs,
    batches,
    sales,
    wholesaleOrders,
    branchMessages,
    notifications,
    hqMessages,
    savedCustomers,
    shiftLogs,
    notificationEnv: getNotificationEnvStatus(),
    expenses,
    paymentSettings,
    joinRequests,
    hqUpdates: getHqUpdates(db),
    supplierCatalog: SUPPLIER_CATALOG_SEED,
    stockAlerts: { nearExpiryCount, expiredCount, lowStockCount },
    activeCentreId,
    activeProfile,
  });
}

export async function POST(request: NextRequest) {
  const session = readWorkspaceAccountToken(request);
  if (!session) {
    return noStoreJson({ error: "Not authenticated." }, { status: 401 });
  }
  if (session.accountId.startsWith("joinreq:")) {
    return noStoreJson({ error: "Complete team allocation in the Lounge first." }, { status: 403 });
  }

  const parsed = await parseJsonObject(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;
  const bearerMode = isBearerClientRequest(request, body);

  const action = sanitizeText(body.action, 40);
  const db = getWorkspaceDb();
  const account = db.accounts.find((a) => a.id === session.accountId);
  if (!account) {
    return noStoreJson({ error: "Account not found." }, { status: 404 });
  }

  const profileSession = readWorkspaceProfileToken(request);
  const unlockedProfile =
    profileSession && profileSession.accountId === account.id
      ? db.profiles.find((p) => p.id === profileSession.profileId && p.accountId === account.id)
      : null;

  if (!unlockedProfile) {
    return noStoreJson({ error: "Profile unlock required." }, { status: 403 });
  }

  const callerCaps = clampProfileCapabilities(
    unlockedProfile.role,
    unlockedProfile.capabilities,
    unlockedProfile.isMasterAdmin
  );
  const isManagerRole =
    unlockedProfile.isMasterAdmin ||
    unlockedProfile.role === "pharmacy_owner" ||
    unlockedProfile.role === "supplier_admin";

  const accessLock = isAccountAccessLocked(account);
  const allowedWhileLocked = new Set([
    "mark_notifications_read",
    "ack_hq_message",
    "activate_subscription",
    "update_lang",
  ]);
  if (accessLock.locked && !allowedWhileLocked.has(action)) {
    return noStoreJson({ error: accessLock.reason, accessLock }, { status: 423 });
  }
  if (accessLock.locked && accessLock.source === "hq" && action === "activate_subscription") {
    return noStoreJson({ error: accessLock.reason, accessLock }, { status: 423 });
  }

  if (action === "ack_hq_message") {
    const msgId = sanitizeText(body.messageId, 60);
    const msg = (db.hqMessages ?? []).find((m) => m.id === msgId && m.accountId === account.id);
    if (!msg) {
      return noStoreJson({ error: "HQ message not found." }, { status: 404 });
    }
    msg.acknowledged = true;
    saveWorkspaceDb(db);
    return noStoreJson({ ok: true });
  }

  if (action === "shift_clock") {
    ensureAccountDomainData(db, account.id, unlockedProfile.centreId);
    db.shiftLogs ??= [];
    const clockType = body.clockType === "out" ? "out" : "in";
    const openShift = db.shiftLogs.find(
      (s) => s.accountId === account.id && s.profileId === unlockedProfile.id && !s.clockOutAt
    );
    const nowIso = new Date().toISOString();
    if (clockType === "in") {
      if (openShift) {
        return noStoreJson({ ok: true, shift: openShift, alreadyClockedIn: true });
      }
      const created = {
        id: newId("shift"),
        accountId: account.id,
        centreId: unlockedProfile.centreId,
        profileId: unlockedProfile.id,
        staffName: unlockedProfile.displayName,
        role: unlockedProfile.role,
        clockInAt: nowIso,
      };
      db.shiftLogs.unshift(created);
      appendAuditLog(db, {
        accountId: account.id,
        actor: unlockedProfile.displayName,
        category: "POS",
        action: `Clocked IN shift at ${nowIso.slice(11, 16)}`,
      });
      saveWorkspaceDb(db);
      return noStoreJson({ ok: true, shift: created });
    } else {
      if (!openShift) {
        return noStoreJson({ error: "No active clocked-in shift found." }, { status: 400 });
      }
      openShift.clockOutAt = nowIso;
      openShift.durationMinutes = Math.max(
        1,
        Math.round((Date.parse(nowIso) - Date.parse(openShift.clockInAt)) / 60000)
      );
      appendAuditLog(db, {
        accountId: account.id,
        actor: unlockedProfile.displayName,
        category: "POS",
        action: `Clocked OUT shift (${openShift.durationMinutes} min logged)`,
      });
      saveWorkspaceDb(db);
      return noStoreJson({ ok: true, shift: openShift });
    }
  }

  if (action === "save_customer_preset") {
    if (!callerCaps.canSellPos && !isManagerRole) {
      return noStoreJson({ error: "Counter POS permission required." }, { status: 403 });
    }
    if (hasAnyInjection([body.customerName, body.phone, body.note])) {
      return noStoreJson({ error: "Unsupported characters in customer preset." }, { status: 400 });
    }
    ensureAccountDomainData(db, account.id, unlockedProfile.centreId);
    db.savedCustomers ??= [];
    const customerName = sanitizeText(body.customerName, 80);
    const phone = sanitizeText(body.phone, 40);
    const note = sanitizeText(body.note, 140);
    const rawItems = Array.isArray(body.items)
      ? (body.items as Array<{ productId?: unknown; brandName?: unknown; qty?: unknown }>)
      : [];
    const items = rawItems
      .map((i) => ({
        productId: sanitizeText(i.productId, 40),
        brandName: sanitizeText(i.brandName, 80),
        qty: Math.max(1, Math.min(500, Math.round(Number(i.qty) || 1))),
      }))
      .filter((i) => i.productId && i.brandName);
    if (customerName.length < 2 || items.length === 0) {
      return noStoreJson({ error: "Customer name and at least one basket medicine are required." }, { status: 400 });
    }
    const created = {
      id: newId("cust"),
      accountId: account.id,
      centreId: unlockedProfile.centreId,
      customerName,
      phone: phone || undefined,
      note: note || undefined,
      items,
      createdAt: new Date().toISOString(),
    };
    db.savedCustomers.unshift(created);
    appendAuditLog(db, {
      accountId: account.id,
      actor: unlockedProfile.displayName,
      category: "POS",
      action: `Saved recurring customer order for ${customerName} (${items.length} item(s))`,
    });
    saveWorkspaceDb(db);
    return noStoreJson({ ok: true, customer: created });
  }

  // Non-admin everyday counter & shift actions (powered by @cervos/core FEFO + Shift engines)
  if (action === "record_pos_sale") {
    if (!callerCaps.canSellPos) {
      return noStoreJson(
        { error: "This profile role does not have Counter POS permission." },
        { status: 403 }
      );
    }
    const total = Math.max(0, Number(body.amountTzs) || 0);
    const itemCount = Math.max(1, Number(body.itemCount) || 1);
    const methodRaw = sanitizeText(body.paymentMethod, 20) as WorkspaceSaleRecord["paymentMethod"];
    const paymentMethod = ["cash", "mpesa", "tigo", "halopesa", "card"].includes(methodRaw)
      ? methodRaw
      : "mpesa";
    ensureAccountDomainData(db, account.id, unlockedProfile.centreId);
    db.sales!.unshift({
      id: newId("sale"),
      accountId: account.id,
      centreId: unlockedProfile.centreId,
      profileId: unlockedProfile.id,
      actorName: unlockedProfile.displayName,
      totalTzs: total,
      itemCount,
      paymentMethod,
      createdAt: new Date().toISOString(),
    });
    appendAuditLog(db, {
      accountId: account.id,
      actor: unlockedProfile.displayName,
      category: "POS",
      action: `Issued counter receipt (${paymentMethod.toUpperCase()}) for ${itemCount} item(s) - TZS ${total.toLocaleString("en-US")}`,
    });
    saveWorkspaceDb(db);
    return noStoreJson({ ok: true });
  }

  if (action === "dispense_pos") {
    if (!callerCaps.canSellPos) {
      return noStoreJson(
        { error: "This profile role does not have Counter POS permission." },
        { status: 403 }
      );
    }
    if (hasAnyInjection([body.customerName, body.customerPhone, body.prescriptionRef, body.pharmacistLicenseNo])) {
      return noStoreJson({ error: "Unsupported characters in dispense details." }, { status: 400 });
    }
    const lines = Array.isArray(body.items)
      ? (body.items as Array<{ productId?: unknown; qty?: unknown }>)
      : [];
    if (lines.length === 0) {
      return noStoreJson({ error: "Add at least one medicine to the basket." }, { status: 400 });
    }
    const methodRaw = sanitizeText(body.paymentMethod, 20) as WorkspaceSaleRecord["paymentMethod"];
    const paymentMethod = ["cash", "mpesa", "tigo", "halopesa", "card"].includes(methodRaw)
      ? methodRaw
      : "mpesa";
    const prescriptionRef = sanitizeText(body.prescriptionRef, 60);
    const pharmacistLicenseNo = sanitizeText(body.pharmacistLicenseNo, 60);

    ensureAccountDomainData(db, account.id, unlockedProfile.centreId);
    const accountBatches = (db.batches ?? []).filter((b) => b.accountId === account.id);

    let totalTzs = 0;
    let totalUnits = 0;
    const allocatedSummary: string[] = [];
    const pendingDeductions: Array<{ batchId: string; qty: number }> = [];
    const saleLines: WorkspaceSaleLine[] = [];

    for (const line of lines) {
      const productId = sanitizeText(line.productId, 40);
      const qty = Math.max(1, Math.min(500, Math.round(Number(line.qty) || 0)));
      const productBatches = accountBatches.filter((b) => b.productId === productId);
      if (productBatches.length === 0) {
        return noStoreJson({ error: `No stocked batches found for ${productId}.` }, { status: 400 });
      }
      const sample = productBatches[0];
      const fefo = allocateFefoBatches(
        productBatches.map((b) => ({
          id: b.id,
          batchNumber: b.batchNumber,
          quantity: b.quantity,
          expiryDate: b.expiryDate,
          createdAt: b.createdAt,
          quarantined: b.quarantined,
        })),
        qty,
        {
          requiresPrescription: sample.requiresPrescription,
          isControlled: sample.isControlled,
          prescriptionRef,
          pharmacistLicenseNo,
        }
      );
      if (!fefo.ok) {
        return noStoreJson(
          { error: `${sample.brandName}: ${fefo.error || "FEFO allocation blocked."}` },
          { status: 400 }
        );
      }
      totalUnits += qty;
      totalTzs += qty * sample.salePriceTzs;
      for (const alloc of fefo.allocations) {
        pendingDeductions.push({ batchId: alloc.batchId, qty: alloc.quantityAllocated });
        allocatedSummary.push(`${sample.brandName} x${alloc.quantityAllocated} (${alloc.batchNumber})`);
        const allocBatch = productBatches.find((b) => b.id === alloc.batchId) ?? sample;
        saleLines.push({
          productId,
          brandName: sample.brandName,
          category: sample.category,
          batchId: alloc.batchId,
          batchNumber: alloc.batchNumber,
          qty: alloc.quantityAllocated,
          unitPriceTzs: sample.salePriceTzs,
          unitCostTzs: allocBatch.costPriceTzs,
        });
      }
    }

    for (const ded of pendingDeductions) {
      const target = db.batches!.find((b) => b.id === ded.batchId);
      if (target) {
        target.quantity = Math.max(0, target.quantity - ded.qty);
      }
    }

    const customerName = sanitizeText(body.customerName, 80);
    const customerPhone = sanitizeText(body.customerPhone, 40);
    const receiptNumber = `RCP-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    const saleRecord: WorkspaceSaleRecord = {
      id: newId("sale"),
      accountId: account.id,
      centreId: unlockedProfile.centreId,
      profileId: unlockedProfile.id,
      actorName: unlockedProfile.displayName,
      receiptNumber,
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      totalTzs,
      itemCount: totalUnits,
      paymentMethod,
      prescriptionRef: prescriptionRef || undefined,
      lines: saleLines,
      createdAt: new Date().toISOString(),
    };
    db.sales!.unshift(saleRecord);

    if (body.saveCustomerPreset === true && customerName.length >= 2) {
      db.savedCustomers ??= [];
      db.savedCustomers.unshift({
        id: newId("cust"),
        accountId: account.id,
        centreId: unlockedProfile.centreId,
        customerName,
        phone: customerPhone || undefined,
        note: prescriptionRef ? `Rx ${prescriptionRef}` : "Saved from Counter POS",
        items: lines.map((l) => {
          const pid = sanitizeText(l.productId, 40);
          const match = accountBatches.find((b) => b.productId === pid);
          return {
            productId: pid,
            brandName: match?.brandName || pid,
            qty: Math.max(1, Math.round(Number(l.qty) || 1)),
          };
        }),
        createdAt: new Date().toISOString(),
      });
    }

    appendAuditLog(db, {
      accountId: account.id,
      actor: unlockedProfile.displayName,
      category: "POS",
      action: `FEFO Dispense ${receiptNumber} (${paymentMethod.toUpperCase()}): ${allocatedSummary.join(", ")} - TZS ${totalTzs.toLocaleString("en-US")}`,
    });
    saveWorkspaceDb(db);
    return noStoreJson({ ok: true, totalTzs, allocated: allocatedSummary, receipt: saleRecord });
  }

  if (action === "reconcile_shift") {
    if (!callerCaps.canSellPos && !isManagerRole) {
      return noStoreJson({ error: "Counter POS permission required to reconcile shifts." }, { status: 403 });
    }
    const result = reconcileCashShift({
      openingCashTzs: Number(body.openingCashTzs) || 0,
      cashSalesTzs: Number(body.cashSalesTzs) || 0,
      cashRefundsTzs: Number(body.cashRefundsTzs) || 0,
      mobileMoneySalesTzs: Number(body.mobileMoneySalesTzs) || 0,
      declaredCashTzs: Number(body.declaredCashTzs) || 0,
    });
    appendAuditLog(db, {
      accountId: account.id,
      actor: unlockedProfile.displayName,
      category: "POS",
      action: `Closed shift drawer (${result.status.toUpperCase()} · Expected TZS ${result.expectedCashTzs.toLocaleString("en-US")}, Variance TZS ${result.varianceTzs.toLocaleString("en-US")})`,
    });
    saveWorkspaceDb(db);
    return noStoreJson({ ok: true, reconciliation: result });
  }

  if (action === "update_lang") {
    account.lang = body.lang === "SW" ? "SW" : "EN";
    saveWorkspaceDb(db);
    const res = noStoreJson({ ok: true, account: publicAccountSummary(account) });
    setLangCookie(res, account.lang);
    return res;
  }

  // Personal User Profile Settings (Available to ANY unlocked staff profile)
  if (action === "update_profile_settings") {
    if (hasAnyInjection([body.displayName])) {
      return noStoreJson({ error: "Unsupported characters in display name." }, { status: 400 });
    }
    const nextName = sanitizeText(body.displayName, 100);
    if (nextName && nextName.length >= 2) {
      unlockedProfile.displayName = nextName;
    }

    const allowedScales = new Set(["compact", "standard", "large"]);
    const allowedThemes = new Set(["light", "dark", "system"]);
    const prevPrefs = unlockedProfile.profilePrefs ?? {};
    unlockedProfile.profilePrefs = {
      fontScale:
        typeof body.fontScale === "string" && allowedScales.has(body.fontScale)
          ? (body.fontScale as "compact" | "standard" | "large")
          : prevPrefs.fontScale,
      themePref:
        typeof body.themePref === "string" && allowedThemes.has(body.themePref)
          ? (body.themePref as "light" | "dark" | "system")
          : prevPrefs.themePref,
      preferredLang:
        body.preferredLang === "SW" || body.preferredLang === "EN"
          ? body.preferredLang
          : prevPrefs.preferredLang,
    };

    if (typeof body.newPin === "string" && body.newPin.length > 0) {
      if (unlockedProfile.pinHash && typeof body.currentPin === "string") {
        if (!verifySecret(body.currentPin.trim(), unlockedProfile.pinHash)) {
          return noStoreJson({ error: "Current profile PIN does not match." }, { status: 401 });
        }
      } else if (unlockedProfile.pinHash) {
        return noStoreJson({ error: "Enter your current PIN to set a new PIN." }, { status: 400 });
      }
      const pinCheck = validatePinPolicy(body.newPin.trim());
      if (!pinCheck.ok) {
        return noStoreJson({ error: pinCheck.error }, { status: 400 });
      }
      unlockedProfile.pinHash = hashSecret(body.newPin.trim()).hash;
    }

    appendAuditLog(db, {
      accountId: account.id,
      actor: unlockedProfile.displayName,
      category: "SECURITY",
      action: body.newPin
        ? "Updated personal profile settings & rotated unlock PIN"
        : "Updated personal profile display preferences",
    });
    saveWorkspaceDb(db);
    return noStoreJson({ ok: true, profile: publicProfileSummary(unlockedProfile) });
  }

  const effectiveCentreId =
    (unlockedProfile.isMasterAdmin ||
      unlockedProfile.role === "pharmacy_owner" ||
      unlockedProfile.role === "supplier_admin") &&
    profileSession?.centreId &&
    db.centres.some((c) => c.id === profileSession.centreId && c.accountId === account.id)
      ? profileSession.centreId
      : unlockedProfile.centreId;

  // Branch-scoped WhatsApp-style Chat + Record Attachment (Available to all unlocked staff at that centre)
  if (action === "send_branch_chat") {
    const rawAtt = (body.attachment ?? null) as Record<string, unknown> | null;
    if (hasAnyInjection([body.body, rawAtt?.title, rawAtt?.subtitle, rawAtt?.refId])) {
      return noStoreJson({ error: "Unsupported characters in message." }, { status: 400 });
    }
    const text = sanitizeText(body.body, 400);
    if (!text && !rawAtt) {
      return noStoreJson({ error: "Write a message or attach a system record." }, { status: 400 });
    }
    ensureAccountDomainData(db, account.id, effectiveCentreId);
    const allowedKinds = new Set(["batch", "sale", "order", "wholesale_request"]);
    const attachment =
      rawAtt && typeof rawAtt.kind === "string" && allowedKinds.has(rawAtt.kind)
        ? {
            kind: rawAtt.kind as "batch" | "sale" | "order" | "wholesale_request",
            refId: sanitizeText(rawAtt.refId, 60) || newId("ref"),
            title: sanitizeText(rawAtt.title, 120),
            subtitle: sanitizeText(rawAtt.subtitle, 160),
            amountTzs: typeof rawAtt.amountTzs === "number" ? rawAtt.amountTzs : undefined,
          }
        : undefined;

    db.branchMessages!.push({
      id: newId("msg"),
      accountId: account.id,
      centreId: effectiveCentreId,
      senderProfileId: unlockedProfile.id,
      senderName: unlockedProfile.displayName,
      senderRole: unlockedProfile.role,
      body: text || "Shared system record",
      attachment,
      createdAt: new Date().toISOString(),
    });
    saveWorkspaceDb(db);
    return noStoreJson({ ok: true });
  }

  if (action === "mark_notifications_read") {
    ensureAccountDomainData(db, account.id, unlockedProfile.centreId);
    for (const n of db.notifications ?? []) {
      if (n.accountId === account.id) n.read = true;
    }
    saveWorkspaceDb(db);
    return noStoreJson({ ok: true });
  }

  // Calm Operator Wholesale Escalation: operators without direct wholesale grant get calmly notified & sent to Owner in branch chat
  if (action === "request_wholesale_approval" || (action === "place_wholesale_order" && !callerCaps.canManageWholesale)) {
    const catalogId = sanitizeText(body.catalogId, 40);
    const item = SUPPLIER_CATALOG_SEED.find((c) => c.id === catalogId);
    if (!item) {
      return noStoreJson({ error: "Selected supplier product not found." }, { status: 404 });
    }
    const qty = Math.max(item.minOrderQty, Math.min(2000, Math.round(Number(body.quantity) || item.minOrderQty)));
    const totalTzs = qty * item.unitPriceTzs;
    ensureAccountDomainData(db, account.id, unlockedProfile.centreId);

    db.branchMessages!.push({
      id: newId("msg"),
      accountId: account.id,
      centreId: unlockedProfile.centreId,
      senderProfileId: unlockedProfile.id,
      senderName: unlockedProfile.displayName,
      senderRole: unlockedProfile.role,
      body: `Wholesale permission needed: Requested ${item.productName} (${qty}x) from ${item.supplierName} for Owner approval.`,
      attachment: {
        kind: "wholesale_request",
        refId: newId("req"),
        catalogId: item.id,
        quantity: qty,
        amountTzs: totalTzs,
        title: `Wholesale Approval: ${item.productName} ${qty}x`,
        subtitle: `${item.supplierName} · TZS ${totalTzs.toLocaleString("en-US")} via Kasri Escrow`,
        approvalStatus: "pending",
      },
      createdAt: new Date().toISOString(),
    });

    db.notifications!.unshift({
      id: newId("ntf"),
      accountId: account.id,
      centreId: unlockedProfile.centreId,
      kind: "approval",
      title: "Operator requested wholesale approval",
      body: `${unlockedProfile.displayName} sent ${item.productName} (${qty}x) to branch chat.`,
      read: false,
      createdAt: new Date().toISOString(),
    });

    appendAuditLog(db, {
      accountId: account.id,
      actor: unlockedProfile.displayName,
      category: "BILLING",
      action: `Escalated wholesale order request (${item.productName} x${qty}) to Owner in branch chat`,
    });
    saveWorkspaceDb(db);
    return noStoreJson({
      ok: true,
      escalatedToChat: true,
      message: "You need Owner permission to place wholesale orders directly. Request sent to your Owner in branch chat.",
    });
  }

  if (action === "place_wholesale_order") {
    if (!callerCaps.canManageWholesale && !isManagerRole) {
      return noStoreJson({ error: "Wholesale order permission required." }, { status: 403 });
    }
    if (!account.networkUnlocked) {
      return noStoreJson(
        { error: "Upload operating permits in Organization Settings before placing wholesale orders." },
        { status: 403 }
      );
    }
    const catalogId = sanitizeText(body.catalogId, 40);
    const item = SUPPLIER_CATALOG_SEED.find((c) => c.id === catalogId);
    if (!item) {
      return noStoreJson({ error: "Selected supplier product not found." }, { status: 404 });
    }
    const qty = Math.max(item.minOrderQty, Math.min(2000, Math.round(Number(body.quantity) || item.minOrderQty)));
    const transportFeeTzs = item.transportFeeTzs ?? 0;
    const totalTzs = qty * item.unitPriceTzs + transportFeeTzs;
    const ref = `ORD-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    ensureAccountDomainData(db, account.id, unlockedProfile.centreId);
    db.wholesaleOrders!.unshift({
      id: newId("ord"),
      accountId: account.id,
      centreId: unlockedProfile.centreId,
      orderReference: ref,
      supplierId: item.supplierId,
      supplierName: item.supplierName,
      productId: item.productId,
      productName: item.productName,
      genericName: item.genericName,
      category: item.category,
      quantity: qty,
      unitPriceTzs: item.unitPriceTzs,
      transportFeeTzs,
      routeLabel: item.routeLabel,
      totalTzs,
      escrowStatus: "escrow_held",
      orderStatus: "in_transit",
      createdAt: new Date().toISOString(),
    });
    appendAuditLog(db, {
      accountId: account.id,
      actor: unlockedProfile.displayName,
      category: "BILLING",
      action: `Placed wholesale order ${ref} (${item.productName} x${qty}) held in Kasri escrow (TZS ${totalTzs.toLocaleString("en-US")})`,
    });
    saveWorkspaceDb(db);
    return noStoreJson({ ok: true, orderReference: ref });
  }

  if (action === "confirm_grn_delivery") {
    if (!callerCaps.canManageWholesale && !callerCaps.canEditInventory && !isManagerRole) {
      return noStoreJson({ error: "Wholesale or inventory intake permission required." }, { status: 403 });
    }
    if (!account.networkUnlocked) {
      return noStoreJson({ error: "Network permit verification required." }, { status: 403 });
    }
    if (hasAnyInjection([body.batchNumber, body.gs1Barcode])) {
      return noStoreJson({ error: "Unsupported characters in GRN payload." }, { status: 400 });
    }
    const orderId = sanitizeText(body.orderId, 40);
    ensureAccountDomainData(db, account.id, unlockedProfile.centreId);
    const order = db.wholesaleOrders!.find((o) => o.id === orderId && o.accountId === account.id);
    if (!order || order.orderStatus === "delivered") {
      return noStoreJson({ error: "Pending wholesale order not found." }, { status: 404 });
    }

    const scanned = typeof body.gs1Barcode === "string" && body.gs1Barcode.trim()
      ? parseGs1Barcode(body.gs1Barcode)
      : null;

    const batchNumber =
      scanned?.batchNumber ||
      sanitizeText(body.batchNumber, 40) ||
      `GRN-${Date.now().toString().slice(-4)}`;
    const expiryDate =
      scanned?.expiryDate ||
      (typeof body.expiryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.expiryDate)
        ? body.expiryDate
        : new Date(Date.now() + 240 * 86400000).toISOString().slice(0, 10));

    order.orderStatus = "delivered";
    order.escrowStatus = "released";
    order.deliveredAt = new Date().toISOString();

    const catItem = SUPPLIER_CATALOG_SEED.find((c) => c.productId === order.productId);
    db.batches!.unshift({
      id: newId("bat"),
      accountId: account.id,
      centreId: order.centreId,
      productId: order.productId,
      genericName: order.genericName,
      brandName: order.productName,
      category: order.category,
      batchNumber,
      quantity: order.quantity,
      costPriceTzs: order.unitPriceTzs,
      salePriceTzs: Math.round(order.unitPriceTzs * 1.32),
      expiryDate,
      requiresPrescription: catItem?.requiresPrescription ?? true,
      isControlled: false,
      quarantined: false,
      createdAt: new Date().toISOString(),
    });

    appendAuditLog(db, {
      accountId: account.id,
      actor: unlockedProfile.displayName,
      category: "COMPLIANCE",
      action: `Confirmed GRN delivery ${order.orderReference} (${batchNumber}) & released Kasri escrow (TZS ${order.totalTzs.toLocaleString("en-US")})`,
    });
    saveWorkspaceDb(db);
    return noStoreJson({ ok: true, batchNumber, expiryDate });
  }

  // Inventory Batch Operations (Owners + Superintendent Pharmacists)
  if (action === "manage_batch") {
    if (!callerCaps.canEditInventory) {
      return noStoreJson(
        { error: "Inventory modification permission is not granted for this profile." },
        { status: 403 }
      );
    }
    if (
      hasAnyInjection([
        body.brandName,
        body.genericName,
        body.batchNumber,
        body.category,
        body.gs1Barcode,
        body.imageUrl,
      ])
    ) {
      return noStoreJson({ error: "Unsupported characters in batch details." }, { status: 400 });
    }
    ensureAccountDomainData(db, account.id, unlockedProfile.centreId);
    const subAction = sanitizeText(body.subAction, 30);

    if (subAction === "toggle_quarantine") {
      const batchId = sanitizeText(body.batchId, 40);
      const batch = db.batches!.find((b) => b.id === batchId && b.accountId === account.id);
      if (!batch) return noStoreJson({ error: "Batch not found." }, { status: 404 });
      batch.quarantined = !batch.quarantined;
      appendAuditLog(db, {
        accountId: account.id,
        actor: unlockedProfile.displayName,
        category: "COMPLIANCE",
        action: `${batch.quarantined ? "Quarantined" : "Restored"} lot ${batch.batchNumber} (${batch.brandName})`,
      });
      saveWorkspaceDb(db);
      return noStoreJson({ ok: true });
    }

    if (subAction === "adjust_qty") {
      const batchId = sanitizeText(body.batchId, 40);
      const nextQty = Math.max(0, Math.min(10000, Math.round(Number(body.quantity) || 0)));
      const batch = db.batches!.find((b) => b.id === batchId && b.accountId === account.id);
      if (!batch) return noStoreJson({ error: "Batch not found." }, { status: 404 });
      batch.quantity = nextQty;
      appendAuditLog(db, {
        accountId: account.id,
        actor: unlockedProfile.displayName,
        category: "SETUP",
        action: `Updated stock lot ${batch.batchNumber} (${batch.brandName}) quantity to ${nextQty}`,
      });
      saveWorkspaceDb(db);
      return noStoreJson({ ok: true });
    }

    if (subAction === "add_batch") {
      const brandName = sanitizeText(body.brandName, 80);
      const genericName = sanitizeText(body.genericName, 80) || brandName;
      const scanned = typeof body.gs1Barcode === "string" && body.gs1Barcode.trim()
        ? parseGs1Barcode(body.gs1Barcode)
        : null;
      const batchNumber = scanned?.batchNumber || sanitizeText(body.batchNumber, 40) || `LOT-${Date.now().toString().slice(-4)}`;
      const expiryDate =
        scanned?.expiryDate ||
        (typeof body.expiryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.expiryDate)
          ? body.expiryDate
          : new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10));
      const qty = Math.max(1, Math.min(5000, Math.round(Number(body.quantity) || 20)));
      const salePriceTzs = Math.max(100, Math.round(Number(body.salePriceTzs) || 3500));
      const costPriceTzs = Math.max(50, Math.round(Number(body.costPriceTzs) || Math.round(salePriceTzs * 0.72)));
      const lowStockThreshold = Math.max(1, Math.min(1000, Math.round(Number(body.lowStockThreshold) || 25)));
      const dateEntered =
        typeof body.dateEntered === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.dateEntered)
          ? body.dateEntered
          : new Date().toISOString().slice(0, 10);
      const imageUrl = sanitizeBatchImageUrl(body.imageUrl);

      if (brandName.length < 2) {
        return noStoreJson({ error: "Medicine name is required." }, { status: 400 });
      }
      db.batches!.unshift({
        id: newId("bat"),
        accountId: account.id,
        centreId: unlockedProfile.centreId,
        productId: sanitizeText(body.productId, 40) || newId("prod"),
        genericName,
        brandName,
        category: sanitizeText(body.category, 40) || "Essential",
        batchNumber,
        quantity: qty,
        costPriceTzs,
        salePriceTzs,
        expiryDate,
        dateEntered,
        lowStockThreshold,
        imageUrl,
        requiresPrescription: Boolean(body.requiresPrescription),
        isControlled: false,
        quarantined: false,
        createdAt: new Date().toISOString(),
      });
      appendAuditLog(db, {
        accountId: account.id,
        actor: unlockedProfile.displayName,
        category: "SETUP",
        action: `Added remote stock batch ${batchNumber}: ${brandName} (${qty} units, Exp ${expiryDate})`,
      });
      saveWorkspaceDb(db);
      return noStoreJson({ ok: true, batchNumber });
    }

    if (subAction === "edit_batch") {
      const batchId = sanitizeText(body.batchId, 40);
      const batch = db.batches!.find((b) => b.id === batchId && b.accountId === account.id);
      if (!batch) return noStoreJson({ error: "Batch not found." }, { status: 404 });
      const brandName = sanitizeText(body.brandName, 80);
      const genericName = sanitizeText(body.genericName, 80);
      const category = sanitizeText(body.category, 40);
      const batchNumber = sanitizeText(body.batchNumber, 40);
      if (brandName.length >= 2) batch.brandName = brandName;
      if (genericName.length >= 2) batch.genericName = genericName;
      if (category.length >= 2) batch.category = category;
      if (batchNumber.length >= 2) batch.batchNumber = batchNumber;
      if (body.quantity !== undefined) batch.quantity = Math.max(0, Math.min(10000, Math.round(Number(body.quantity) || 0)));
      if (body.costPriceTzs !== undefined) batch.costPriceTzs = Math.max(50, Math.round(Number(body.costPriceTzs) || batch.costPriceTzs));
      if (body.salePriceTzs !== undefined) batch.salePriceTzs = Math.max(100, Math.round(Number(body.salePriceTzs) || batch.salePriceTzs));
      if (typeof body.expiryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.expiryDate)) {
        batch.expiryDate = body.expiryDate;
      }
      if (typeof body.dateEntered === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.dateEntered)) {
        batch.dateEntered = body.dateEntered;
      }
      if (body.lowStockThreshold !== undefined) {
        batch.lowStockThreshold = Math.max(1, Math.min(1000, Math.round(Number(body.lowStockThreshold) || 25)));
      }
      if (typeof body.imageUrl === "string") {
        batch.imageUrl = sanitizeBatchImageUrl(body.imageUrl);
      }
      if (typeof body.requiresPrescription === "boolean") {
        batch.requiresPrescription = body.requiresPrescription;
      }
      appendAuditLog(db, {
        accountId: account.id,
        actor: unlockedProfile.displayName,
        category: "SETUP",
        action: `Edited batch ${batch.batchNumber} (${batch.brandName}) details`,
      });
      saveWorkspaceDb(db);
      return noStoreJson({ ok: true, batch });
    }

    return noStoreJson({ error: "Unsupported batch action." }, { status: 400 });
  }

  if (!isManagerRole) {
    return noStoreJson(
      { error: "Owner or master profile PIN unlock is required for organization actions." },
      { status: 403 }
    );
  }

  if (action === "update_customization") {
    account.customization = sanitizeBrandCustomization(
      body,
      account.customization ?? {},
      body.clearLogo === true
    );
    appendAuditLog(db, {
      accountId: account.id,
      actor: unlockedProfile.displayName,
      category: "SETUP",
      action: "Updated organization brand logo, accent, font scale & layout",
    });
    saveWorkspaceDb(db);
    return noStoreJson({ ok: true, account: publicAccountSummary(account) });
  }

  if (
    hasAnyInjection([
      body.name,
      body.address,
      body.region,
      body.phone,
      body.displayName,
      body.licenseNumber,
      body.fileName,
      body.docType,
      body.securityQuestion,
      body.securityAnswer,
      body.planName,
      body.paymentChannel,
      body.payerPhoneOrRef,
      body.description,
      body.mpesaPaybill,
      body.tigoLipaNumber,
      body.bankName,
      body.bankAccount,
    ])
  ) {
    return noStoreJson({ error: "Unsupported characters in input." }, { status: 400 });
  }

  if (action === "add_centre") {
    if (!callerCaps.canManageTeam) {
      return noStoreJson({ error: "Team & organization management permission required." }, { status: 403 });
    }
    const name = sanitizeText(body.name, 120);
    const region = sanitizeText(body.region, 80) || account.region;
    const address = sanitizeText(body.address, 180);
    const phone = sanitizeText(body.phone, 40);
    const lat = typeof body.lat === "number" && Number.isFinite(body.lat) ? Number(body.lat.toFixed(5)) : undefined;
    const lng = typeof body.lng === "number" && Number.isFinite(body.lng) ? Number(body.lng.toFixed(5)) : undefined;
    if (name.length < 2 || address.length < 3) {
      return noStoreJson({ error: "Centre name and street address are required." }, { status: 400 });
    }
    const centre = {
      id: newId("ctr"),
      accountId: account.id,
      name,
      region,
      address,
      phone,
      ...(lat !== undefined ? { lat } : {}),
      ...(lng !== undefined ? { lng } : {}),
      isPrimary: false,
      createdAt: new Date().toISOString(),
    };
    db.centres.push(centre);
    const assignIds = Array.isArray(body.assignProfileIds)
      ? (body.assignProfileIds as unknown[]).map((x) => sanitizeText(x, 80)).filter(Boolean)
      : [];
    let movedCount = 0;
    for (const pid of assignIds) {
      const targetProf = db.profiles.find((p) => p.id === pid && p.accountId === account.id);
      if (targetProf) {
        targetProf.centreId = centre.id;
        movedCount += 1;
      }
    }
    appendAuditLog(db, {
      accountId: account.id,
      actor: unlockedProfile.displayName,
      category: "SETUP",
      action:
        movedCount > 0
          ? `Added centre location: ${name} (${region}) & assigned ${movedCount} operator(s)`
          : `Added centre location: ${name} (${region})`,
    });
    saveWorkspaceDb(db);
    return noStoreJson({ ok: true, centre, movedCount });
  }

  if (action === "add_profile") {
    if (!callerCaps.canManageTeam) {
      return noStoreJson({ error: "Team management permission required." }, { status: 403 });
    }
    const displayName = sanitizeText(body.displayName, 100);
    const centreId = sanitizeText(body.centreId, 80);
    const roleRaw = sanitizeText(body.role, 40) as WorkspaceProfileRole;
    const pinCheck = validatePinPolicy(body.pin);
    if (displayName.length < 2) {
      return noStoreJson({ error: "Staff display name is required." }, { status: 400 });
    }
    if (!ALLOWED_PROFILE_ROLES.has(roleRaw)) {
      return noStoreJson({ error: "Select a valid staff role." }, { status: 400 });
    }
    if ((roleRaw === "pharmacy_owner" || roleRaw === "supplier_admin") && !unlockedProfile.isMasterAdmin) {
      return noStoreJson({ error: "Only the master owner can provision admin roles." }, { status: 403 });
    }
    if (!pinCheck.ok) {
      return noStoreJson({ error: pinCheck.error }, { status: 400 });
    }
    if (!db.centres.some((c) => c.id === centreId && c.accountId === account.id)) {
      return noStoreJson({ error: "Valid centre selection is required." }, { status: 400 });
    }
    let username = "";
    if (typeof body.username === "string" && body.username.trim().length > 0) {
      const uCheck = validateUsernameSafe(body.username);
      if (!uCheck.ok) {
        return noStoreJson({ error: uCheck.error }, { status: 400 });
      }
      if (isUsernameTaken(db, uCheck.username)) {
        return noStoreJson({ error: `Username "@${uCheck.username}" is already taken.` }, { status: 409 });
      }
      username = uCheck.username;
    } else {
      username = suggestUniqueUsername(db, displayName);
    }
    const prof = {
      id: newId("prof"),
      accountId: account.id,
      centreId,
      username,
      displayName,
      role: roleRaw,
      pinHash: hashSecret(String(body.pin)).hash,
      isMasterAdmin: false,
      capabilities: clampProfileCapabilities(
        roleRaw,
        body.capabilities && typeof body.capabilities === "object"
          ? (body.capabilities as Partial<ProfileCapabilities>)
          : undefined,
        false
      ),
      createdAt: new Date().toISOString(),
    };
    db.profiles.push(prof);
    appendAuditLog(db, {
      accountId: account.id,
      actor: unlockedProfile.displayName,
      category: "SETUP",
      action: `Provisioned staff profile: ${displayName} (${roleRaw.replace(/_/g, " ")})`,
    });
    saveWorkspaceDb(db);
    return noStoreJson({ ok: true, profile: publicProfileSummary(prof) });
  }

  if (action === "upload_certificates") {
    if (!callerCaps.canManageTeam) {
      return noStoreJson({ error: "Organization permit upload requires owner authority." }, { status: 403 });
    }
    const docType = sanitizeText(body.docType, 100) || "Operating Permit";
    const licenseNumber = sanitizeText(body.licenseNumber, 80);
    const fileName = sanitizeText(body.fileName, 140);
    if (licenseNumber.length < 3 || fileName.length < 3) {
      return noStoreJson(
        { error: "License number and certificate file are required to verify for network access." },
        { status: 400 }
      );
    }
    account.certificates.push({
      id: newId("cert"),
      docType,
      licenseNumber,
      fileName,
      uploadedAt: new Date().toISOString(),
    });
    account.verificationStatus = "verified";
    account.networkUnlocked = true;
    appendAuditLog(db, {
      accountId: account.id,
      actor: unlockedProfile.displayName,
      category: "COMPLIANCE",
      action: `Uploaded ${docType} (${licenseNumber}) & unlocked Network access`,
    });
    saveWorkspaceDb(db);
    return noStoreJson({ ok: true, account: publicAccountSummary(account) });
  }

  if (action === "activate_subscription") {
    const planName = sanitizeText(body.planName, 80) || account.subscriptionPlan;
    const channel = sanitizeText(body.paymentChannel, 30) || "M-Pesa Paybill";
    const payerRef = sanitizeText(body.payerPhoneOrRef, 60);
    if (body.simulateBounce === true || (typeof body.payerPhoneOrRef === "string" && payerRef.length < 4)) {
      return noStoreJson(
        {
          error: "Payment did not clear (insufficient funds or invalid phone/account ref). Edit payer details and retry.",
          bounced: true,
        },
        { status: 402 }
      );
    }
    const payReceipt = `SUB-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    account.subscriptionActive = true;
    account.billingOverdue = false;
    account.subscriptionPlan = planName;
    appendAuditLog(db, {
      accountId: account.id,
      actor: unlockedProfile.displayName,
      category: "BILLING",
      action: `Activated plan ${planName} via ${channel}${payerRef ? ` (${payerRef})` : ""} - Receipt ${payReceipt}`,
    });
    saveWorkspaceDb(db);
    return noStoreJson({
      ok: true,
      receiptNumber: payReceipt,
      account: publicAccountSummary(account),
    });
  }

  if (action === "update_security") {
    if (!callerCaps.canManageTeam) {
      return noStoreJson({ error: "Security policy updates require owner authority." }, { status: 403 });
    }
    if (typeof body.requireSecurityEveryTime === "boolean") {
      account.requireSecurityEveryTime = body.requireSecurityEveryTime;
    }
    const q = sanitizeText(body.securityQuestion, 180);
    const ans = normalizeSecurityAnswer(body.securityAnswer);
    if (q && ans) {
      account.securityQuestion = q;
      account.securityAnswerHash = hashSecret(ans).hash;
    }
    appendAuditLog(db, {
      accountId: account.id,
      actor: unlockedProfile.displayName,
      category: "SECURITY",
      action: body.revokeTrustedBrowsers
        ? "Revoked all remembered browser trust tokens"
        : "Updated workspace security question preferences",
    });
    saveWorkspaceDb(db);
    const res = noStoreJson({ ok: true, account: publicAccountSummary(account) });
    if (body.revokeTrustedBrowsers) {
      res.cookies.delete(WS_TRUSTED_COOKIE);
    }
    return res;
  }

  if (action === "edit_profile") {
    if (!callerCaps.canManageTeam) {
      return noStoreJson({ error: "Team management permission required." }, { status: 403 });
    }
    const profileId = sanitizeText(body.profileId, 80);
    const target = db.profiles.find((p) => p.id === profileId && p.accountId === account.id);
    if (!target) {
      return noStoreJson({ error: "Operator profile not found." }, { status: 404 });
    }
    if (target.isMasterAdmin && !unlockedProfile.isMasterAdmin) {
      return noStoreJson({ error: "Only the master owner can modify the master profile." }, { status: 403 });
    }
    const nextName = sanitizeText(body.displayName, 100);
    if (nextName && nextName.length >= 2) target.displayName = nextName;
    if (typeof body.username === "string" && body.username.trim().length > 0) {
      const uCheck = validateUsernameSafe(body.username);
      if (!uCheck.ok) {
        return noStoreJson({ error: uCheck.error }, { status: 400 });
      }
      if (isUsernameTaken(db, uCheck.username, target.id)) {
        return noStoreJson({ error: `Username "@${uCheck.username}" is already taken.` }, { status: 409 });
      }
      target.username = uCheck.username;
    }
    const roleRaw = sanitizeText(body.role, 40) as WorkspaceProfileRole;
    if (ALLOWED_PROFILE_ROLES.has(roleRaw) && !target.isMasterAdmin) {
      if ((roleRaw === "pharmacy_owner" || roleRaw === "supplier_admin") && !unlockedProfile.isMasterAdmin) {
        return noStoreJson({ error: "Only the master owner can assign admin roles." }, { status: 403 });
      }
      target.role = roleRaw;
    }
    const nextCentre = sanitizeText(body.centreId, 80);
    if (nextCentre && db.centres.some((c) => c.id === nextCentre && c.accountId === account.id)) {
      target.centreId = nextCentre;
    }
    if (body.capabilities && typeof body.capabilities === "object") {
      target.capabilities = clampProfileCapabilities(
        target.role,
        body.capabilities as Partial<ProfileCapabilities>,
        target.isMasterAdmin
      );
    } else if (ALLOWED_PROFILE_ROLES.has(roleRaw) && !target.isMasterAdmin) {
      target.capabilities = clampProfileCapabilities(roleRaw, target.capabilities, target.isMasterAdmin);
    }
    if (typeof body.newPin === "string" && body.newPin.trim().length > 0) {
      const pinCheck = validatePinPolicy(body.newPin.trim());
      if (!pinCheck.ok) {
        return noStoreJson({ error: pinCheck.error }, { status: 400 });
      }
      target.pinHash = hashSecret(body.newPin.trim()).hash;
    }
    appendAuditLog(db, {
      accountId: account.id,
      actor: unlockedProfile.displayName,
      category: "SECURITY",
      action: `Remotely updated operator profile: ${target.displayName} (${target.role.replace(/_/g, " ")})`,
    });
    saveWorkspaceDb(db);
    return noStoreJson({ ok: true, profile: publicProfileSummary(target) });
  }

  if (action === "resolve_chat_approval") {
    if (!callerCaps.canManageTeam && !callerCaps.canManageWholesale) {
      return noStoreJson({ error: "Approval authority required." }, { status: 403 });
    }
    const messageId = sanitizeText(body.messageId, 60);
    const decision = body.decision === "decline" ? "decline" : "approve";
    ensureAccountDomainData(db, account.id, unlockedProfile.centreId);
    const msg = db.branchMessages!.find((m) => m.id === messageId && m.accountId === account.id);
    if (!msg || !msg.attachment || msg.attachment.kind !== "wholesale_request") {
      return noStoreJson({ error: "Approval request message not found." }, { status: 404 });
    }
    if (msg.attachment.approvalStatus !== "pending") {
      return noStoreJson({ error: "Request has already been resolved." }, { status: 400 });
    }

    if (decision === "decline") {
      msg.attachment.approvalStatus = "declined";
      db.branchMessages!.push({
        id: newId("msg"),
        accountId: account.id,
        centreId: msg.centreId,
        senderProfileId: unlockedProfile.id,
        senderName: unlockedProfile.displayName,
        senderRole: unlockedProfile.role,
        body: `Declined wholesale request (${msg.attachment.title}).`,
        createdAt: new Date().toISOString(),
      });
      appendAuditLog(db, {
        accountId: account.id,
        actor: unlockedProfile.displayName,
        category: "BILLING",
        action: `Declined chat request: ${msg.attachment.title}`,
      });
      saveWorkspaceDb(db);
      return noStoreJson({ ok: true, status: "declined" });
    }

    if (!account.networkUnlocked) {
      return noStoreJson(
        { error: "Upload operating permits in Team & Permits before approving wholesale orders." },
        { status: 403 }
      );
    }

    const catItem = SUPPLIER_CATALOG_SEED.find((c) => c.id === msg.attachment?.catalogId);
    const qty = msg.attachment.quantity || catItem?.minOrderQty || 20;
    const totalTzs = catItem ? qty * catItem.unitPriceTzs : msg.attachment.amountTzs || 84000;
    const ref = `ORD-${Date.now().toString(36).toUpperCase().slice(-6)}`;

    msg.attachment.approvalStatus = "approved";
    db.wholesaleOrders!.unshift({
      id: newId("ord"),
      accountId: account.id,
      centreId: msg.centreId,
      orderReference: ref,
      supplierId: catItem?.supplierId || "acc-afya",
      supplierName: catItem?.supplierName || "Afya Wholesale Ltd",
      productId: catItem?.productId || "prod-1",
      productName: catItem?.productName || msg.attachment.title,
      genericName: catItem?.genericName || "Essential Medicine",
      category: catItem?.category || "Essential",
      quantity: qty,
      unitPriceTzs: catItem?.unitPriceTzs || Math.round(totalTzs / qty),
      totalTzs,
      escrowStatus: "escrow_held",
      orderStatus: "in_transit",
      createdAt: new Date().toISOString(),
    });

    db.branchMessages!.push({
      id: newId("msg"),
      accountId: account.id,
      centreId: msg.centreId,
      senderProfileId: unlockedProfile.id,
      senderName: unlockedProfile.displayName,
      senderRole: unlockedProfile.role,
      body: `Approved ${msg.attachment.title}. Order ${ref} placed in Kasri escrow (TZS ${totalTzs.toLocaleString("en-US")}).`,
      attachment: {
        kind: "order",
        refId: ref,
        title: `Approved Order ${ref}`,
        subtitle: `TZS ${totalTzs.toLocaleString("en-US")} · Held in Kasri Escrow`,
      },
      createdAt: new Date().toISOString(),
    });

    appendAuditLog(db, {
      accountId: account.id,
      actor: unlockedProfile.displayName,
      category: "BILLING",
      action: `Approved chat request & placed ${ref} in Kasri escrow (TZS ${totalTzs.toLocaleString("en-US")})`,
    });
    saveWorkspaceDb(db);
    return noStoreJson({ ok: true, status: "approved", orderReference: ref });
  }

  if (action === "switch_centre") {
    const targetCentreId = sanitizeText(body.centreId, 80);
    const targetCentre = db.centres.find((c) => c.id === targetCentreId && c.accountId === account.id);
    if (!targetCentre) {
      return noStoreJson({ error: "Target branch not found." }, { status: 404 });
    }
    ensureAccountDomainData(db, account.id, targetCentre.id);
    appendAuditLog(db, {
      accountId: account.id,
      actor: unlockedProfile.displayName,
      category: "SETUP",
      action: `Switched active oversight branch to ${targetCentre.name}`,
    });
    saveWorkspaceDb(db);
    const profileToken = createProfileCookieValue(
      account.id,
      targetCentre.id,
      unlockedProfile.id,
      unlockedProfile.role
    );
    const res = noStoreJson({
      ok: true,
      activeCentreId: targetCentre.id,
      ...(bearerMode
        ? { tokens: { profileToken, expiresInSec: WORKSPACE_PROFILE_TTL_SEC } }
        : {}),
    });
    setHttpCookie(res, WS_PROFILE_COOKIE, profileToken, WORKSPACE_PROFILE_TTL_SEC);
    return res;
  }

  if (action === "log_expense") {
    if (!callerCaps.canViewFinance) {
      return noStoreJson({ error: "Finance permission required to log expenses." }, { status: 403 });
    }
    const allowedCategories = new Set<WorkspaceExpenseRecord["category"]>([
      "Rent & Premises",
      "Utilities & Cold Chain",
      "Staff & Shift",
      "Compliance & Permits",
      "Packaging & Supplies",
    ]);
    const categoryRaw = sanitizeText(body.category, 60) as WorkspaceExpenseRecord["category"];
    const category = allowedCategories.has(categoryRaw) ? categoryRaw : "Packaging & Supplies";
    const description = sanitizeText(body.description, 160);
    const amountTzs = Math.max(0, Math.round(Number(body.amountTzs) || 0));
    if (description.length < 2 || amountTzs <= 0) {
      return noStoreJson({ error: "Description and positive TZS amount required." }, { status: 400 });
    }
    ensureAccountDomainData(db, account.id, effectiveCentreId);
    const record: WorkspaceExpenseRecord = {
      id: newId("exp"),
      accountId: account.id,
      centreId: effectiveCentreId,
      category,
      description,
      amountTzs,
      createdAt: new Date().toISOString(),
    };
    db.expenses!.unshift(record);
    appendAuditLog(db, {
      accountId: account.id,
      actor: unlockedProfile.displayName,
      category: "BILLING",
      action: `Logged ${category} expense: ${description} (TZS ${amountTzs.toLocaleString("en-US")})`,
    });
    saveWorkspaceDb(db);
    return noStoreJson({ ok: true, expense: record });
  }

  if (action === "save_payment_settings") {
    if (!callerCaps.canViewFinance) {
      return noStoreJson({ error: "Finance permission required to update settlement channels." }, { status: 403 });
    }
    const mpesaPaybill = sanitizeText(body.mpesaPaybill, 40);
    const tigoLipaNumber = sanitizeText(body.tigoLipaNumber, 40);
    const bankName = sanitizeText(body.bankName, 80);
    const bankAccount = sanitizeText(body.bankAccount, 60);
    const cycleRaw = sanitizeText(body.settlementCycle, 20);
    const settlementCycle = cycleRaw === "instant" || cycleRaw === "weekly" ? cycleRaw : "daily";
    const vatRegistered = Boolean(body.vatRegistered);
    ensureAccountDomainData(db, account.id, effectiveCentreId);
    db.paymentSettings![account.id] = {
      mpesaPaybill,
      tigoLipaNumber,
      bankName,
      bankAccount,
      settlementCycle,
      vatRegistered,
    };
    appendAuditLog(db, {
      accountId: account.id,
      actor: unlockedProfile.displayName,
      category: "BILLING",
      action: `Updated settlement channels (${settlementCycle.toUpperCase()}, ${bankName || "M-Pesa"})`,
    });
    saveWorkspaceDb(db);
    return noStoreJson({ ok: true, paymentSettings: db.paymentSettings![account.id] });
  }

  if (action === "review_join_request") {
    if (!callerCaps.canManageTeam) {
      return noStoreJson({ error: "Team management permission required to review join requests." }, { status: 403 });
    }
    const requestId = sanitizeText(body.requestId, 80);
    const decision = body.decision === "decline" ? "decline" : "approve";
    const reqItem = (db.joinRequests ?? []).find(
      (r) => r.id === requestId && r.targetAccountId === account.id
    );
    if (!reqItem) {
      return noStoreJson({ error: "Join request not found." }, { status: 404 });
    }
    if (reqItem.status !== "pending") {
      return noStoreJson({ error: "Join request has already been reviewed." }, { status: 400 });
    }

    if (decision === "decline") {
      if (hasAnyInjection([body.declineReason])) {
        return noStoreJson({ error: "Unsupported characters in decline note." }, { status: 400 });
      }
      reqItem.status = "declined";
      reqItem.declineReason =
        sanitizeText(body.declineReason, 220) || "The owner was unable to confirm this role at this time.";
      reqItem.reviewedAt = new Date().toISOString();
      appendAuditLog(db, {
        accountId: account.id,
        actor: unlockedProfile.displayName,
        category: "SECURITY",
        action: `Declined access request from ${reqItem.requesterFullName} (@${reqItem.requesterUsername})`,
      });
      saveWorkspaceDb(db);
      return noStoreJson({ ok: true, status: "declined" });
    }

    const centreId = sanitizeText(body.centreId, 80);
    const targetCentre = db.centres.find((c) => c.id === centreId && c.accountId === account.id);
    if (!targetCentre) {
      return noStoreJson({ error: "Select an active branch for allocation." }, { status: 400 });
    }
    const roleRaw = sanitizeText(body.role, 40) as WorkspaceProfileRole;
    if (!ALLOWED_PROFILE_ROLES.has(roleRaw)) {
      return noStoreJson({ error: "Select a valid staff role." }, { status: 400 });
    }
    if ((roleRaw === "pharmacy_owner" || roleRaw === "supplier_admin") && !unlockedProfile.isMasterAdmin) {
      return noStoreJson({ error: "Only the master owner can allocate admin roles." }, { status: 403 });
    }
    const pinCheck = validatePinPolicy(body.pin);
    if (!pinCheck.ok) {
      return noStoreJson({ error: pinCheck.error }, { status: 400 });
    }

    const pinStr = String(body.pin).trim();
    const profId = newId("prof");
    const finalUsername = db.profiles.some((p) => p.username?.toLowerCase() === reqItem.requesterUsername.toLowerCase())
      ? suggestUniqueUsername(db, reqItem.requesterUsername)
      : reqItem.requesterUsername;

    const grantedCaps = clampProfileCapabilities(
      roleRaw,
      body.capabilities && typeof body.capabilities === "object"
        ? (body.capabilities as Partial<ProfileCapabilities>)
        : undefined,
      false
    );

    db.profiles.push({
      id: profId,
      accountId: account.id,
      centreId: targetCentre.id,
      username: finalUsername,
      displayName: reqItem.requesterFullName,
      role: roleRaw,
      pinHash: hashSecret(pinStr).hash,
      passwordHash: reqItem.requesterPasswordHash,
      isMasterAdmin: false,
      capabilities: grantedCaps,
      createdAt: new Date().toISOString(),
    });

    reqItem.requesterUsername = finalUsername;
    reqItem.status = "approved";
    reqItem.allocatedCentreId = targetCentre.id;
    reqItem.allocatedCentreName = targetCentre.name;
    reqItem.allocatedRole = roleRaw;
    reqItem.allocatedProfileId = profId;
    reqItem.allocatedPinPreview = pinStr;
    reqItem.reviewedAt = new Date().toISOString();

    appendAuditLog(db, {
      accountId: account.id,
      actor: unlockedProfile.displayName,
      category: "SECURITY",
      action: `Approved & allocated @${finalUsername} (${roleRaw.replace(/_/g, " ")}) to ${targetCentre.name}`,
    });
    saveWorkspaceDb(db);
    return noStoreJson({
      ok: true,
      status: "approved",
      profileId: profId,
      username: finalUsername,
      centreName: targetCentre.name,
    });
  }

  if (action === "reply_hq_trail") {
    const title = sanitizeText(body.title, 120) || `Owner Note (${account.orgName})`;
    const msgBody = sanitizeText(body.body, 500);
    if (msgBody.length < 3) {
      return noStoreJson({ error: "Reply message is too short." }, { status: 400 });
    }
    const created = pushHqMessage(db, {
      accountId: account.id,
      title,
      swTitle: title,
      body: msgBody,
      swBody: msgBody,
      severity: "info",
      ctaLabel: "Inspect",
      ctaTarget: "overview",
      senderName: unlockedProfile.displayName,
    });
    appendAuditLog(db, {
      accountId: account.id,
      actor: unlockedProfile.displayName,
      category: "COMPLIANCE",
      action: `Posted reply to HQ action trail: ${title}`,
    });
    saveWorkspaceDb(db);
    return noStoreJson({ ok: true, hqMessage: created });
  }

  return noStoreJson({ error: "Unsupported workspace action." }, { status: 400 });
}
