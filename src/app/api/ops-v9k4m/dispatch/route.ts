import type { NextRequest } from "next/server";
import {
  extractHqTokenFromRequest,
  HQ_COOKIE_NAME,
  HQ_OP_COOKIE,
  isHqMockMode,
  isValidHQToken,
} from "@/lib/hq-auth";
import { clientIpFrom } from "@/lib/rate-limit";
import {
  checkRateLimit,
  clearFailedAttempts,
  hashSecret,
  recordFailedAttempt,
  sanitizeText,
} from "@/lib/security/harness";
import { noStoreJson } from "@/lib/workspace/cookies";
import {
  dispatchExceptionNotification,
  getNotificationEnvStatus,
  isValidHqSecret,
  sendTextifySms,
} from "@/lib/workspace/env";
import {
  clampProfileCapabilities,
  type WorkspaceProfileRole,
} from "@/lib/workspace/permissions";
import { hasAnyInjection, parseJsonObject } from "@/lib/workspace/request-auth";
import {
  appendAuditLog,
  getHqUpdates,
  getWorkspaceDb,
  isAccountAccessLocked,
  newId,
  publicAccountSummary,
  pushHqMessage,
  saveWorkspaceDb,
  suggestUniqueUsername,
  type AuditLogEntry,
  type HqUpdateItem,
} from "@/lib/workspace/store";

const ALLOWED_ROLES = new Set<WorkspaceProfileRole>([
  "pharmacy_owner",
  "superintendent_pharmacist",
  "pos_cashier",
  "warehouse_dispatcher",
  "supplier_admin",
]);

function checkHqRequestAuth(request: NextRequest) {
  const clientIp = clientIpFrom(request);
  const keyHeader =
    request.headers.get("x-ops-key")?.trim() ||
    request.headers.get("x-cervos-hq-secret")?.trim() ||
    "";

  if (keyHeader) {
    const rateKey = `ops-dispatch-secret:${clientIp}`;
    const limit = checkRateLimit(rateKey, 8, 15 * 60 * 1000, 15 * 60 * 1000);
    if (!limit.allowed) {
      return {
        ok: false as const,
        status: 429,
        error: `Too many invalid clearance attempts. Retry in ${limit.retryAfterSec}s.`,
      };
    }
    if (!isValidHqSecret(keyHeader)) {
      recordFailedAttempt(rateKey, 8, 15 * 60 * 1000, 15 * 60 * 1000);
      return { ok: false as const, status: 403, error: "Clearance key rejected." };
    }
    clearFailedAttempts(rateKey);
    return {
      ok: true as const,
      operator: sanitizeText(request.headers.get("x-ops-operator"), 80) || "Ops Remote Desk",
    };
  }

  const token = extractHqTokenFromRequest(
    request.headers,
    request.cookies.get(HQ_COOKIE_NAME)?.value
  );
  if (!isValidHQToken(token)) {
    return { ok: false as const, status: 401, error: "Operations clearance required." };
  }
  const operator =
    sanitizeText(request.cookies.get(HQ_OP_COOKIE)?.value, 80) ||
    (isHqMockMode() ? "Ops Sandbox Desk" : "Ops Clearance Unit");
  return { ok: true as const, operator };
}

function buildFleetPayload(operator: string) {
  const db = getWorkspaceDb();
  const nowMs = Date.now();
  const cutoff30dMs = nowMs - 30 * 24 * 60 * 60 * 1000;
  const nearCutoffMs = nowMs + 90 * 24 * 60 * 60 * 1000;

  let totalBranches = 0;
  let totalOperators = 0;
  let totalSalesCount = 0;
  let totalSalesRevenueTzs = 0;
  let totalStockCostTzs = 0;
  let nearExpiryBatches = 0;
  let expiredBatches = 0;

  const accountNames = new Map<string, { orgName: string; region: string }>();
  for (const acc of db.accounts) {
    accountNames.set(acc.id, { orgName: acc.orgName, region: acc.region });
  }

  const accounts = db.accounts.map((acc) => {
    const centres = db.centres.filter((c) => c.accountId === acc.id);
    const profiles = db.profiles.filter((p) => p.accountId === acc.id);
    const batches = (db.batches ?? []).filter((b) => b.accountId === acc.id);
    const sales = (db.sales ?? []).filter((s) => s.accountId === acc.id);
    const orders = (db.wholesaleOrders ?? []).filter((o) => o.accountId === acc.id);
    const expenses = (db.expenses ?? []).filter((e) => e.accountId === acc.id);
    const audits = (db.auditLogs ?? []).filter((l) => l.accountId === acc.id);
    const joinReqs = (db.joinRequests ?? []).filter(
      (r) => r.targetAccountId === acc.id && r.status === "pending"
    );
    const msgs = (db.hqMessages ?? []).filter(
      (m) => m.accountId === acc.id && !m.acknowledged
    );

    let salesRev = 0;
    let sales30d = 0;
    for (const s of sales) {
      salesRev += s.totalTzs;
      if (Date.parse(s.createdAt) >= cutoff30dMs) sales30d += s.totalTzs;
    }

    let stockUnitsTotal = 0;
    let stockCost = 0;
    let nearExp = 0;
    let expCount = 0;
    let lowCount = 0;
    let quarCount = 0;
    for (const b of batches) {
      stockUnitsTotal += b.quantity;
      stockCost += b.quantity * b.costPriceTzs;
      const expMs = Date.parse(b.expiryDate);
      if (Number.isFinite(expMs)) {
        if (expMs < nowMs) expCount += 1;
        else if (expMs <= nearCutoffMs) nearExp += 1;
      }
      if (b.quantity <= (b.lowStockThreshold ?? 15)) lowCount += 1;
      if (b.quarantined) quarCount += 1;
    }

    totalBranches += centres.length;
    totalOperators += profiles.length;
    totalSalesCount += sales.length;
    totalSalesRevenueTzs += salesRev;
    totalStockCostTzs += stockCost;
    nearExpiryBatches += nearExp;
    expiredBatches += expCount;

    const pub = publicAccountSummary(acc);
    return {
      ...pub,
      username: acc.username,
      customRoleLabel: acc.customRoleLabel,
      billingOverdue: Boolean(acc.billingOverdue),
      trialEndsAt: acc.trialEndsAt,
      hqLock: acc.hqLock,
      certificates: acc.certificates,
      createdAt: acc.createdAt,
      trustGeneration: acc.trustGeneration,
      centresCount: centres.length,
      centres: centres.map((c) => ({
        id: c.id,
        name: c.name,
        region: c.region,
        address: c.address,
        phone: c.phone,
        lat: c.lat,
        lng: c.lng,
        isPrimary: c.isPrimary,
        staffCount: profiles.filter((p) => p.centreId === c.id).length,
        createdAt: c.createdAt,
      })),
      profilesCount: profiles.length,
      profiles: profiles.map((p) => ({
        id: p.id,
        centreId: p.centreId,
        username: p.username,
        displayName: p.displayName,
        role: p.role,
        isMasterAdmin: p.isMasterAdmin,
      })),
      salesCount: sales.length,
      salesRevenueTzs: salesRev,
      sales30dTzs: sales30d,
      batchesCount: batches.length,
      stockUnitsTotal,
      stockValueAtCostTzs: stockCost,
      nearExpiryCount: nearExp,
      expiredCount: expCount,
      lowStockCount: lowCount,
      quarantinedCount: quarCount,
      wholesaleOrdersCount: orders.length,
      wholesaleVolumeTzs: orders.reduce((sum, o) => sum + o.totalTzs, 0),
      escrowHeldCount: orders.filter((o) => o.escrowStatus === "escrow_held").length,
      expensesTotalTzs: expenses.reduce((sum, e) => sum + e.amountTzs, 0),
      auditEventsCount: audits.length,
      lastActivityAt: audits[0]?.createdAt ?? acc.createdAt,
      pendingJoinRequestsCount: joinReqs.length,
      unacknowledgedHqMessagesCount: msgs.length,
    };
  });

  const auditCategoryCounts: Record<AuditLogEntry["category"], number> = {
    AUTH: 0,
    SETUP: 0,
    SECURITY: 0,
    POS: 0,
    COMPLIANCE: 0,
    BILLING: 0,
  };
  const auditLogs = (db.auditLogs ?? []).slice(0, 250).map((entry) => {
    auditCategoryCounts[entry.category] = (auditCategoryCounts[entry.category] ?? 0) + 1;
    const meta = accountNames.get(entry.accountId);
    return {
      ...entry,
      orgName: meta?.orgName ?? entry.accountId,
      region: meta?.region ?? "TZ",
    };
  });

  const hqMessages = (db.hqMessages ?? []).slice(0, 120).map((m) => ({
    ...m,
    orgName: accountNames.get(m.accountId)?.orgName ?? m.accountId,
  }));

  const joinRequests = (db.joinRequests ?? []).slice(0, 100).map((r) => ({
    id: r.id,
    targetAccountId: r.targetAccountId,
    targetOrgName: r.targetOrgName,
    requesterFullName: r.requesterFullName,
    requesterUsername: r.requesterUsername,
    requesterEmail: r.requesterEmail,
    requesterSex: r.requesterSex,
    requesterLang: r.requesterLang,
    requesterRegion: r.requesterRegion,
    requestedRoleLabel: r.requestedRoleLabel,
    note: r.note,
    status: r.status,
    allocatedCentreId: r.allocatedCentreId,
    allocatedCentreName: r.allocatedCentreName,
    allocatedRole: r.allocatedRole,
    allocatedPinPreview: r.allocatedPinPreview,
    declineReason: r.declineReason,
    createdAt: r.createdAt,
    reviewedAt: r.reviewedAt,
  }));

  const activeOrgs = accounts.filter((a) => !a.accessLock.locked && a.subscriptionActive).length;
  const trialOrgs = accounts.filter((a) => !a.accessLock.locked && !a.subscriptionActive).length;
  const lockedOrgs = accounts.filter((a) => a.accessLock.locked).length;

  return {
    scope: "fleet" as const,
    operator,
    fleetSummary: {
      totalOrgs: accounts.length,
      activeOrgs,
      trialOrgs,
      lockedOrgs,
      hqLockedOrgs: accounts.filter((a) => Boolean(a.hqLock?.locked)).length,
      billingOverdueOrgs: accounts.filter((a) => a.billingOverdue).length,
      verifiedOrgs: accounts.filter((a) => a.verificationStatus === "verified").length,
      totalBranches,
      totalOperators,
      totalSalesCount,
      totalSalesRevenueTzs,
      totalStockCostTzs,
      nearExpiryBatches,
      expiredBatches,
      pendingJoinRequests: joinRequests.filter((r) => r.status === "pending").length,
      unreadHqMessages: hqMessages.filter((m) => !m.acknowledged).length,
    },
    accounts,
    auditLogs,
    auditCategoryCounts,
    hqMessages,
    joinRequests,
    hqUpdates: getHqUpdates(db),
    notificationEnv: getNotificationEnvStatus(),
  };
}

export async function GET(request: NextRequest) {
  const auth = checkHqRequestAuth(request);
  if (!auth.ok) {
    return noStoreJson({ error: auth.error }, { status: auth.status });
  }

  const scope = request.nextUrl.searchParams.get("scope")?.trim();
  if (scope === "fleet") {
    return noStoreJson(buildFleetPayload(auth.operator));
  }

  const db = getWorkspaceDb();
  const targetIdParam = request.nextUrl.searchParams.get("accountId")?.trim();
  const account =
    (targetIdParam ? db.accounts.find((a) => a.id === targetIdParam) : undefined) ?? db.accounts[0];

  if (!account) {
    return noStoreJson({ error: "Organization not found." }, { status: 404 });
  }

  const hqMessages = (db.hqMessages ?? []).filter((m) => m.accountId === account.id).slice(0, 20);
  return noStoreJson({
    accountId: account.id,
    orgName: account.orgName,
    accessLock: isAccountAccessLocked(account),
    hqLock: account.hqLock ?? { locked: false, reason: "", lockedBy: "", lockedAt: "" },
    billingOverdue: Boolean(account.billingOverdue),
    subscriptionActive: account.subscriptionActive,
    hqMessages,
    notificationEnv: getNotificationEnvStatus(),
  });
}

export async function POST(request: NextRequest) {
  const auth = checkHqRequestAuth(request);
  if (!auth.ok) {
    return noStoreJson({ error: auth.error }, { status: auth.status });
  }

  const parsed = await parseJsonObject(request, "Invalid JSON payload.");
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const action = sanitizeText(body.action, 40);
  if (
    hasAnyInjection([
      body.title,
      body.swTitle,
      body.body,
      body.swBody,
      body.summary,
      body.swSummary,
      body.reason,
      body.senderName,
      body.ctaLabel,
      body.auditAction,
      body.declineReason,
    ])
  ) {
    return noStoreJson({ error: "Unsupported characters in ops payload." }, { status: 400 });
  }

  const db = getWorkspaceDb();
  const actorName = sanitizeText(body.senderName, 80) || auth.operator;

  if (action === "publish_hq_update") {
    const title = sanitizeText(body.title, 120);
    const summary = sanitizeText(body.summary, 400);
    if (title.length < 3 || summary.length < 5) {
      return noStoreJson({ error: "Title and summary are required." }, { status: 400 });
    }
    const allowedTags = new Set<HqUpdateItem["tag"]>(["RELEASE", "HARDWARE", "COMPLIANCE", "GROWTH"]);
    const tagRaw = sanitizeText(body.tag, 24).toUpperCase() as HqUpdateItem["tag"];
    const tag = allowedTags.has(tagRaw) ? tagRaw : "RELEASE";
    const allowedTargets = new Set<HqUpdateItem["ctaTarget"]>(["network", "billing", "download", "reports", "auth"]);
    const targetRaw = sanitizeText(body.ctaTarget, 24) as HqUpdateItem["ctaTarget"];
    const ctaTarget = allowedTargets.has(targetRaw) ? targetRaw : "reports";

    const list = getHqUpdates(db);
    const created: HqUpdateItem = {
      id: newId("hq"),
      tag,
      title,
      swTitle: sanitizeText(body.swTitle, 120) || title,
      summary,
      swSummary: sanitizeText(body.swSummary, 400) || summary,
      ctaLabel: sanitizeText(body.ctaLabel, 40) || "Open",
      ctaTarget,
      publishedAt: new Date().toISOString(),
    };
    list.unshift(created);
    saveWorkspaceDb(db);
    return noStoreJson({ ok: true, hqUpdate: created });
  }

  if (action === "delete_hq_update") {
    const updateId = sanitizeText(body.updateId, 80);
    const list = getHqUpdates(db);
    const next = list.filter((item) => item.id !== updateId);
    if (next.length === list.length) {
      return noStoreJson({ error: "HQ update not found." }, { status: 404 });
    }
    db.hqUpdates = next;
    saveWorkspaceDb(db);
    return noStoreJson({ ok: true });
  }

  if (action === "delete_hq_message") {
    const messageId = sanitizeText(body.messageId, 80);
    const prev = db.hqMessages ?? [];
    const next = prev.filter((m) => m.id !== messageId);
    if (next.length === prev.length) {
      return noStoreJson({ error: "Message not found." }, { status: 404 });
    }
    db.hqMessages = next;
    saveWorkspaceDb(db);
    return noStoreJson({ ok: true });
  }

  if (action === "review_join_request") {
    const requestId = sanitizeText(body.requestId, 80);
    const decision = body.decision === "decline" ? "decline" : "approve";
    const reqItem = (db.joinRequests ?? []).find((r) => r.id === requestId);
    if (!reqItem) {
      return noStoreJson({ error: "Join request not found." }, { status: 404 });
    }
    if (reqItem.status !== "pending") {
      return noStoreJson({ error: "Join request already processed." }, { status: 400 });
    }
    if (decision === "decline") {
      reqItem.status = "declined";
      reqItem.declineReason = sanitizeText(body.declineReason, 220) || "Declined during HQ access review.";
      reqItem.reviewedAt = new Date().toISOString();
      appendAuditLog(db, {
        accountId: reqItem.targetAccountId,
        actor: actorName,
        category: "SECURITY",
        action: `HQ declined join request from @${reqItem.requesterUsername}`,
      });
      saveWorkspaceDb(db);
      return noStoreJson({ ok: true, status: "declined" });
    }

    const centreId = sanitizeText(body.centreId, 80);
    const targetCentre =
      db.centres.find((c) => c.id === centreId && c.accountId === reqItem.targetAccountId) ??
      db.centres.find((c) => c.accountId === reqItem.targetAccountId);
    if (!targetCentre) {
      return noStoreJson({ error: "No active branch found on target org." }, { status: 400 });
    }
    const roleRaw = sanitizeText(body.role, 40) as WorkspaceProfileRole;
    const finalRole: WorkspaceProfileRole = ALLOWED_ROLES.has(roleRaw) ? roleRaw : "superintendent_pharmacist";
    const pinStr = String(body.pin ?? "2468").replace(/\D/g, "").slice(0, 6) || "2468";
    const profId = newId("prof");
    const finalUsername = db.profiles.some(
      (p) => p.username?.toLowerCase() === reqItem.requesterUsername.toLowerCase()
    )
      ? suggestUniqueUsername(db, reqItem.requesterUsername)
      : reqItem.requesterUsername;

    db.profiles.push({
      id: profId,
      accountId: reqItem.targetAccountId,
      centreId: targetCentre.id,
      username: finalUsername,
      displayName: reqItem.requesterFullName,
      role: finalRole,
      pinHash: hashSecret(pinStr).hash,
      passwordHash: reqItem.requesterPasswordHash,
      isMasterAdmin: false,
      capabilities: clampProfileCapabilities(finalRole),
      createdAt: new Date().toISOString(),
    });

    reqItem.requesterUsername = finalUsername;
    reqItem.status = "approved";
    reqItem.allocatedCentreId = targetCentre.id;
    reqItem.allocatedCentreName = targetCentre.name;
    reqItem.allocatedRole = finalRole;
    reqItem.allocatedProfileId = profId;
    reqItem.allocatedPinPreview = pinStr;
    reqItem.reviewedAt = new Date().toISOString();

    appendAuditLog(db, {
      accountId: reqItem.targetAccountId,
      actor: actorName,
      category: "SECURITY",
      action: `HQ approved & allocated @${finalUsername} to ${targetCentre.name}`,
    });
    saveWorkspaceDb(db);
    return noStoreJson({ ok: true, status: "approved", profileId: profId });
  }

  // Target selection (`ALL` supported for send_message)
  const rawTarget = typeof body.accountId === "string" ? body.accountId.trim() : "";

  if (action === "send_message") {
    const title = sanitizeText(body.title, 120);
    const msgBody = sanitizeText(body.body, 500);
    if (title.length < 3 || msgBody.length < 5) {
      return noStoreJson({ error: "Title and message body are required." }, { status: 400 });
    }
    const sevRaw = sanitizeText(body.severity, 20);
    const severity = sevRaw === "critical" || sevRaw === "action" ? sevRaw : "info";
    const channelRaw = sanitizeText(body.deliveryChannel, 24);
    const deliveryChannel =
      channelRaw === "sms_textify" || channelRaw === "both" ? channelRaw : "in_app";
    const allowedTargets = new Set(["overview", "reports", "billing", "network", "team", "download"]);
    const targetRaw = sanitizeText(body.ctaTarget, 30);
    const ctaTarget = allowedTargets.has(targetRaw)
      ? (targetRaw as "overview" | "reports" | "billing" | "network" | "team" | "download")
      : "overview";

    const rolePrefix = rawTarget.startsWith("ROLE:") ? rawTarget.slice(5).trim().toLowerCase() : "";
    const recipients =
      rawTarget === "ALL"
        ? db.accounts
        : rolePrefix
          ? db.accounts.filter((a) => a.roleType.toLowerCase() === rolePrefix)
          : [
              db.accounts.find(
                (a) => a.id === rawTarget || a.username?.toLowerCase() === rawTarget.toLowerCase()
              ),
            ].filter((x): x is NonNullable<typeof x> => Boolean(x));

    if (recipients.length === 0) {
      return noStoreJson({ error: "No matching recipient accounts found." }, { status: 404 });
    }

    let firstCreated = null;
    let smsDeliveredCount = 0;
    const swTitleText = sanitizeText(body.swTitle, 120) || title;
    const swBodyText = sanitizeText(body.swBody, 500) || msgBody;

    for (const acc of recipients) {
      if (deliveryChannel === "in_app" || deliveryChannel === "both") {
        const created = pushHqMessage(db, {
          accountId: acc.id,
          title,
          swTitle: swTitleText,
          body: msgBody,
          swBody: swBodyText,
          severity,
          ctaLabel: sanitizeText(body.ctaLabel, 40) || "Inspect",
          ctaTarget,
          senderName: actorName,
        });
        if (!firstCreated) firstCreated = created;
      }

      if (deliveryChannel === "sms_textify" || deliveryChannel === "both") {
        const centres = db.centres.filter((c) => c.accountId === acc.id);
        const ownerPhone =
          acc.ownerPhone?.trim() || centres.find((c) => c.phone?.trim())?.phone?.trim() || "";
        if (ownerPhone) {
          const localizedTitle = acc.lang === "SW" ? swTitleText : title;
          const localizedBody = acc.lang === "SW" ? swBodyText : msgBody;
          const smsRes = await sendTextifySms({
            to: ownerPhone,
            message: `${localizedTitle}: ${localizedBody}`,
            sender: "Nama",
          });
          if (smsRes.delivered) smsDeliveredCount += 1;
        }
      }

      appendAuditLog(db, {
        accountId: acc.id,
        actor: actorName,
        category: "COMPLIANCE",
        action: `HQ ${deliveryChannel === "sms_textify" ? "SMS (Nama)" : deliveryChannel === "both" ? "notice + SMS" : "notice"} dispatched: ${title}`,
      });
      if (severity === "critical") {
        await dispatchExceptionNotification({
          accountId: acc.id,
          orgName: acc.orgName,
          severity: "critical",
          code: "HQ_CRITICAL_NOTICE",
          summary: `${title} - ${msgBody}`,
        });
      }
    }
    saveWorkspaceDb(db);
    return noStoreJson({
      ok: true,
      hqMessage: firstCreated,
      deliveredCount: recipients.length,
      smsDeliveredCount,
      deliveryChannel,
    });
  }

  const targetAccount =
    (rawTarget
      ? db.accounts.find((a) => a.id === rawTarget || a.username?.toLowerCase() === rawTarget.toLowerCase())
      : undefined) ?? db.accounts[0];

  if (!targetAccount) {
    return noStoreJson({ error: "Target workspace account not found." }, { status: 404 });
  }

  if (action === "log_audit_event") {
    const allowedCats = new Set<AuditLogEntry["category"]>([
      "AUTH",
      "SETUP",
      "SECURITY",
      "POS",
      "COMPLIANCE",
      "BILLING",
    ]);
    const catRaw = sanitizeText(body.category, 24).toUpperCase() as AuditLogEntry["category"];
    const category = allowedCats.has(catRaw) ? catRaw : "COMPLIANCE";
    const auditAction = sanitizeText(body.auditAction, 220);
    if (auditAction.length < 4) {
      return noStoreJson({ error: "Audit event note is too short." }, { status: 400 });
    }
    const created = appendAuditLog(db, {
      accountId: targetAccount.id,
      actor: actorName,
      category,
      action: auditAction,
    });
    saveWorkspaceDb(db);
    return noStoreJson({ ok: true, auditLog: created });
  }

  if (action === "lock_account") {
    const reason =
      sanitizeText(body.reason, 220) ||
      "Manual HQ hold placed pending compliance or account review.";
    targetAccount.hqLock = {
      locked: true,
      reason,
      lockedBy: actorName,
      lockedAt: new Date().toISOString(),
    };
    pushHqMessage(db, {
      accountId: targetAccount.id,
      title: "HQ Manual Access Override Active",
      swTitle: "Kuzuia kwa Muda Kutoka Makao Makuu (HQ)",
      body: reason,
      swBody: reason,
      severity: "critical",
      ctaLabel: "Contact HQ",
      ctaTarget: "billing",
      senderName: actorName,
    });
    appendAuditLog(db, {
      accountId: targetAccount.id,
      actor: actorName,
      category: "SECURITY",
      action: `HQ manual lock activated: ${reason}`,
    });
    saveWorkspaceDb(db);
    await dispatchExceptionNotification({
      accountId: targetAccount.id,
      orgName: targetAccount.orgName,
      severity: "critical",
      code: "HQ_MANUAL_LOCK",
      summary: reason,
    });
    return noStoreJson({ ok: true, accessLock: isAccountAccessLocked(targetAccount) });
  }

  if (action === "unlock_account") {
    targetAccount.hqLock = {
      locked: false,
      reason: "",
      lockedBy: actorName,
      lockedAt: new Date().toISOString(),
    };
    targetAccount.billingOverdue = false;
    appendAuditLog(db, {
      accountId: targetAccount.id,
      actor: actorName,
      category: "SECURITY",
      action: "HQ manual override released and workspace unlocked",
    });
    saveWorkspaceDb(db);
    return noStoreJson({ ok: true, accessLock: isAccountAccessLocked(targetAccount) });
  }

  if (action === "set_billing_overdue") {
    const overdue = Boolean(body.overdue);
    targetAccount.billingOverdue = overdue;
    if (overdue) {
      targetAccount.subscriptionActive = false;
      pushHqMessage(db, {
        accountId: targetAccount.id,
        title: "Subscription Payment Overdue - Access Paused",
        swTitle: "Malipo ya Usajili Yamechelewa - Mfumo Umefungwa",
        body: "Renew your active plan to resume Counter POS, FEFO stock edits, and wholesale orders.",
        swBody: "Kamilisha malipo ya mpango wako ili kufungua Kaunta ya POS, stoo na oda za bohari.",
        severity: "critical",
        ctaLabel: "Pay & Unlock",
        ctaTarget: "billing",
        senderName: "Cervos Billing Guard",
      });
      await dispatchExceptionNotification({
        accountId: targetAccount.id,
        orgName: targetAccount.orgName,
        severity: "warning",
        code: "BILLING_OVERDUE_LOCK",
        summary: `Account ${targetAccount.orgName} paused pending subscription payment.`,
      });
    } else if (body.restoreSubscription === true) {
      targetAccount.subscriptionActive = true;
    }
    appendAuditLog(db, {
      accountId: targetAccount.id,
      actor: actorName,
      category: "BILLING",
      action: overdue ? "Billing lock engaged (payment required)" : "Billing lock cleared",
    });
    saveWorkspaceDb(db);
    return noStoreJson({ ok: true, accessLock: isAccountAccessLocked(targetAccount) });
  }

  if (action === "toggle_network_verify") {
    const verified = Boolean(body.verified);
    targetAccount.verificationStatus = verified ? "verified" : "skipped";
    targetAccount.networkUnlocked = verified;
    appendAuditLog(db, {
      accountId: targetAccount.id,
      actor: actorName,
      category: "COMPLIANCE",
      action: verified
        ? "HQ verified compliance permits and unlocked wholesale preview"
        : "HQ paused compliance verification flag",
    });
    saveWorkspaceDb(db);
    return noStoreJson({ ok: true, verificationStatus: targetAccount.verificationStatus });
  }

  if (action === "update_subscription") {
    if (typeof body.extendTrialDays === "number" && body.extendTrialDays > 0) {
      const baseMs = Math.max(Date.now(), Date.parse(targetAccount.trialEndsAt ?? "") || Date.now());
      targetAccount.trialEndsAt = new Date(
        baseMs + Math.min(90, body.extendTrialDays) * 24 * 60 * 60 * 1000
      ).toISOString();
      targetAccount.billingOverdue = false;
      appendAuditLog(db, {
        accountId: targetAccount.id,
        actor: actorName,
        category: "BILLING",
        action: `HQ extended trial window by ${Math.min(90, body.extendTrialDays)} days`,
      });
      saveWorkspaceDb(db);
      return noStoreJson({ ok: true, trialEndsAt: targetAccount.trialEndsAt });
    }

    const plan = sanitizeText(body.subscriptionPlan, 80);
    if (plan) targetAccount.subscriptionPlan = plan;
    if (typeof body.subscriptionActive === "boolean") {
      targetAccount.subscriptionActive = body.subscriptionActive;
      if (body.subscriptionActive) targetAccount.billingOverdue = false;
    }
    appendAuditLog(db, {
      accountId: targetAccount.id,
      actor: actorName,
      category: "BILLING",
      action: `HQ updated subscription plan (${targetAccount.subscriptionPlan})`,
    });
    saveWorkspaceDb(db);
    return noStoreJson({
      ok: true,
      subscriptionPlan: targetAccount.subscriptionPlan,
      subscriptionActive: targetAccount.subscriptionActive,
    });
  }

  return noStoreJson({ error: "Unsupported ops dispatch action." }, { status: 400 });
}
