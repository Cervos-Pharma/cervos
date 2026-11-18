import type { NextRequest } from "next/server";
import {
  extractHqTokenFromRequest,
  HQ_COOKIE_NAME,
  HQ_OP_COOKIE,
  isHqMockMode,
  isValidHQToken,
} from "@/lib/hq-auth";
import { clientIpFrom } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";
import {
  checkRateLimit,
  clearFailedAttempts,
  hashSecret,
  recordFailedAttempt,
  sanitizeText,
  validatePinPolicy,
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
import { hasAnyInjection, parseJsonObject, sanitizeBatchImageUrl } from "@/lib/workspace/request-auth";
import {
  appendAuditLog,
  findWorkspacePackageMatch,
  flushWorkspaceDb,
  getHqUpdates,
  getJournalArticles,
  getSubscriptionExpiryInfo,
  getWorkspaceDb,
  getWorkspacePackages,
  isAccountAccessLocked,
  MIN_BRANCH_PRICE_TZS,
  newId,
  publicAccountSummary,
  pushHqMessage,
  saveWorkspaceDb,
  suggestUniqueUsername,
  upsertJournalArticle,
  upsertWorkspacePackage,
  warmDbFromSupabase,
  type AuditLogEntry,
  type HqUpdateItem,
} from "@/lib/workspace/store";

async function persistDb(db: ReturnType<typeof getWorkspaceDb>) {
  saveWorkspaceDb(db);
  await flushWorkspaceDb();
}

function canQuerySupabaseTables(): boolean {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  return Boolean(url && key && process.env.NEXT_PUBLIC_MOCK_MODE !== "true" && process.env.NODE_ENV !== "test");
}

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

async function buildFleetPayload(operator: string) {
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

  const packages = getWorkspacePackages(db);
  let monthlyRecurringRevenueTzs = 0;
  let fleetExpiryExposureTzs = 0;
  const regionMap = new Map<
    string,
    { region: string; orgsCount: number; branchesCount: number; revenue30dTzs: number; lowStockCount: number; expiryExposureTzs: number }
  >();
  const skuMap = new Map<string, { brandName: string; genericName: string; unitsSold: number; revenueTzs: number }>();

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
      const in30d = Date.parse(s.createdAt) >= cutoff30dMs;
      if (in30d) sales30d += s.totalTzs;
      for (const ln of s.lines ?? []) {
        const key = (ln.brandName || "").trim().toLowerCase();
        if (!key) continue;
        const curSku = skuMap.get(key) ?? {
          brandName: ln.brandName,
          genericName: ln.category || "Medicine",
          unitsSold: 0,
          revenueTzs: 0,
        };
        curSku.unitsSold += ln.qty;
        curSku.revenueTzs += ln.qty * ln.unitPriceTzs;
        skuMap.set(key, curSku);
      }
    }

    let stockUnitsTotal = 0;
    let stockCost = 0;
    let nearExp = 0;
    let expCount = 0;
    let lowCount = 0;
    let quarCount = 0;
    let orgExpiryExposureTzs = 0;
    for (const b of batches) {
      stockUnitsTotal += b.quantity;
      stockCost += b.quantity * b.costPriceTzs;
      const expMs = Date.parse(b.expiryDate);
      if (Number.isFinite(expMs)) {
        if (expMs < nowMs) {
          expCount += 1;
          orgExpiryExposureTzs += Math.max(0, b.quantity * b.costPriceTzs);
        } else if (expMs <= nearCutoffMs) {
          nearExp += 1;
          orgExpiryExposureTzs += Math.max(0, b.quantity * b.costPriceTzs);
        }
      }
      if (b.quantity <= (b.lowStockThreshold ?? 15)) lowCount += 1;
      if (b.quarantined) quarCount += 1;
    }

    const matchedPkg = findWorkspacePackageMatch(packages, acc.subscriptionPlan);
    const branchCountSafe = Math.max(1, centres.length);
    const estMonthly = matchedPkg
      ? Math.max(matchedPkg.priceMonthlyTzs, matchedPkg.pricePerBranchMonthlyTzs * branchCountSafe)
      : 45000;
    if (acc.subscriptionActive && !acc.billingOverdue) {
      monthlyRecurringRevenueTzs += estMonthly;
    }
    fleetExpiryExposureTzs += orgExpiryExposureTzs;

    const regKey = (acc.region || "Dar es Salaam").trim() || "Dar es Salaam";
    const regEntry = regionMap.get(regKey) ?? {
      region: regKey,
      orgsCount: 0,
      branchesCount: 0,
      revenue30dTzs: 0,
      lowStockCount: 0,
      expiryExposureTzs: 0,
    };
    regEntry.orgsCount += 1;
    regEntry.branchesCount += centres.length;
    regEntry.revenue30dTzs += sales30d;
    regEntry.lowStockCount += lowCount;
    regEntry.expiryExposureTzs += orgExpiryExposureTzs;
    regionMap.set(regKey, regEntry);

    totalBranches += centres.length;
    totalOperators += profiles.length;
    totalSalesCount += sales.length;
    totalSalesRevenueTzs += salesRev;
    totalStockCostTzs += stockCost;
    nearExpiryBatches += nearExp;
    expiredBatches += expCount;

    const pub = publicAccountSummary(acc);
    const expInfo = getSubscriptionExpiryInfo(acc, nowMs);
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
      planMaxBranches: matchedPkg?.maxBranches ?? null,
      planMaxOperators: matchedPkg?.maxOperators ?? null,
      subscriptionDaysLeft: expInfo.daysLeft,
      expiryExposureTzs: orgExpiryExposureTzs,
      estimatedMonthlyFeeTzs: estMonthly,
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

  const wholesaleOrders = (db.wholesaleOrders ?? []).slice(0, 120).map((o) => ({
    id: o.id,
    accountId: o.accountId,
    orgName: accountNames.get(o.accountId)?.orgName ?? o.accountId,
    orderReference: o.orderReference,
    supplierName: o.supplierName,
    productName: o.productName,
    quantity: o.quantity,
    totalTzs: o.totalTzs,
    escrowStatus: o.escrowStatus,
    orderStatus: o.orderStatus,
    createdAt: o.createdAt,
  }));

  let quoteRequests: Array<{
    id: string;
    companyName: string;
    contactName: string;
    email: string;
    phone: string;
    planName: string;
    locations: number;
    status: string;
    createdAt: string;
  }> = [];
  let supplierInvites: Array<{
    id: string;
    email: string;
    companyName: string;
    status: string;
    createdAt: string;
  }> = [];

  if (canQuerySupabaseTables()) {
    try {
      const supabase = await createServiceClient();
      const [quotesRes, invitesRes] = await Promise.all([
        supabase
          .from("quote_requests")
          .select("id, company_name, contact_name, email, phone, plan_name, locations, status, created_at")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("supplier_invites")
          .select("id, email, company_name, status, created_at")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      quoteRequests = (quotesRes.data ?? []).map((q) => ({
        id: String(q.id),
        companyName: String(q.company_name ?? ""),
        contactName: String(q.contact_name ?? ""),
        email: String(q.email ?? ""),
        phone: String(q.phone ?? ""),
        planName: String(q.plan_name ?? "Custom"),
        locations: Number(q.locations ?? 1),
        status: String(q.status ?? "pending"),
        createdAt: String(q.created_at ?? ""),
      }));
      supplierInvites = (invitesRes.data ?? []).map((inv) => ({
        id: String(inv.id),
        email: String(inv.email ?? ""),
        companyName: String(inv.company_name ?? ""),
        status: String(inv.status ?? "pending"),
        createdAt: String(inv.created_at ?? ""),
      }));
    } catch {
      // Optional telemetry tables may not exist in all environments
    }
  }

  return {
    scope: "fleet" as const,
    operator,
    minBranchPriceTzs: MIN_BRANCH_PRICE_TZS,
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
    peakTelemetry: {
      monthlyRecurringRevenueTzs,
      expiryExposureTzs: fleetExpiryExposureTzs,
      regionDemand: Array.from(regionMap.values()).sort((a, b) => b.revenue30dTzs - a.revenue30dTzs),
      topDispensedProducts: Array.from(skuMap.values())
        .sort((a, b) => b.unitsSold - a.unitsSold)
        .slice(0, 8),
    },
    accounts,
    packages,
    wholesaleOrders,
    quoteRequests,
    supplierInvites,
    auditLogs,
    auditCategoryCounts,
    hqMessages,
    joinRequests,
    hqUpdates: getHqUpdates(db),
    journalArticles: getJournalArticles(db),
    notificationEnv: getNotificationEnvStatus(),
  };
}

export async function GET(request: NextRequest) {
  const auth = checkHqRequestAuth(request);
  if (!auth.ok) {
    return noStoreJson({ error: auth.error }, { status: auth.status });
  }

  await warmDbFromSupabase();
  const scope = request.nextUrl.searchParams.get("scope")?.trim();
  if (scope === "fleet") {
    return noStoreJson(await buildFleetPayload(auth.operator));
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

  await warmDbFromSupabase();
  const db = getWorkspaceDb();
  const actorName = sanitizeText(body.senderName, 80) || auth.operator;

  if (action === "upsert_journal_article") {
    const titleEn = sanitizeText(body.titleEn, 180);
    const deckEn = sanitizeText(body.deckEn, 320);
    if (titleEn.length < 4 || deckEn.length < 8) {
      return noStoreJson({ error: "Headline and summary deck are required for The Dispatch journal." }, { status: 400 });
    }
    const paragraphsEn = Array.isArray(body.paragraphsEn)
      ? body.paragraphsEn.map((p) => sanitizeText(p, 2000)).filter(Boolean)
      : typeof body.bodyEn === "string"
        ? body.bodyEn.split(/\n{2,}/).map((p) => sanitizeText(p, 2000)).filter(Boolean)
        : [deckEn];
    const paragraphsSw = Array.isArray(body.paragraphsSw)
      ? body.paragraphsSw.map((p) => sanitizeText(p, 2000)).filter(Boolean)
      : typeof body.bodySw === "string"
        ? body.bodySw.split(/\n{2,}/).map((p) => sanitizeText(p, 2000)).filter(Boolean)
        : [];
    const safeCover = sanitizeBatchImageUrl(body.image) || "/cervos-people-counter.jpg";
    const article = upsertJournalArticle(db, {
      id: typeof body.id === "string" ? sanitizeText(body.id, 80) : undefined,
      slug: typeof body.slug === "string" ? sanitizeText(body.slug, 80) : undefined,
      topic: body.topic === "craft" || body.topic === "supply" ? body.topic : "field",
      titleEn,
      titleSw: sanitizeText(body.titleSw, 180) || titleEn,
      deckEn,
      deckSw: sanitizeText(body.deckSw, 320) || deckEn,
      quoteEn: sanitizeText(body.quoteEn, 260) || deckEn,
      quoteSw: sanitizeText(body.quoteSw, 260) || sanitizeText(body.quoteEn, 260) || deckEn,
      paragraphsEn,
      paragraphsSw: paragraphsSw.length > 0 ? paragraphsSw : paragraphsEn,
      author: sanitizeText(body.author, 80) || actorName,
      authorRoleEn: sanitizeText(body.authorRoleEn, 80) || "Cervos Field Desk",
      authorRoleSw: sanitizeText(body.authorRoleSw, 80) || "Dawati la Cervos",
      image: safeCover,
      status: body.status === "draft" ? "draft" : "published",
    });
    appendAuditLog(db, {
      accountId: db.accounts[0]?.id ?? "acc-hq",
      actor: actorName,
      category: "COMPLIANCE",
      action: `HQ ${article.status === "published" ? "published" : "saved draft"} journal article: ${article.titleEn} (/dispatch/${article.slug})`,
    });
    await persistDb(db);
    return noStoreJson({ ok: true, article, journalArticles: getJournalArticles(db) });
  }

  if (action === "delete_journal_article") {
    const id = sanitizeText(body.id, 80);
    const list = (db.journalArticles ??= []);
    const next = list.filter((a) => a.id !== id);
    if (next.length === list.length) {
      return noStoreJson({ error: "Journal article not found." }, { status: 404 });
    }
    db.journalArticles = next;
    await persistDb(db);
    return noStoreJson({ ok: true, journalArticles: next });
  }

  if (action === "upsert_package") {
    const id = sanitizeText(body.id, 60) || sanitizeText(body.name, 40).toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
    const name = sanitizeText(body.name, 80);
    if (!id || name.length < 2) {
      return noStoreJson({ error: "Package ID and name are required." }, { status: 400 });
    }
    const perBranchRaw = Number(body.pricePerBranchMonthlyTzs ?? body.priceMonthlyTzs ?? MIN_BRANCH_PRICE_TZS);
    if (!Number.isFinite(perBranchRaw) || perBranchRaw < MIN_BRANCH_PRICE_TZS) {
      return noStoreJson(
        { error: `Per-branch price must be at least ${MIN_BRANCH_PRICE_TZS.toLocaleString("en-US")} TZS/month.` },
        { status: 400 }
      );
    }
    const monthlyRaw = Number(body.priceMonthlyTzs ?? perBranchRaw);
    if (!Number.isFinite(monthlyRaw) || monthlyRaw < MIN_BRANCH_PRICE_TZS) {
      return noStoreJson(
        { error: `Monthly package base price must be at least ${MIN_BRANCH_PRICE_TZS.toLocaleString("en-US")} TZS.` },
        { status: 400 }
      );
    }

    const updated = upsertWorkspacePackage(db, {
      id,
      audience:
        body.audience === "hospital" || body.audience === "supplier" ? body.audience : "pharmacy",
      name,
      priceMonthlyTzs: monthlyRaw,
      priceAnnualTzs: Number(body.priceAnnualTzs ?? monthlyRaw * 10),
      pricePerBranchMonthlyTzs: perBranchRaw,
      includedAdminsPerBranch: Number(body.includedAdminsPerBranch ?? 1),
      includedOperatorsPerBranch: Number(body.includedOperatorsPerBranch ?? 1),
      extraOperatorMonthlyTzs: Number(body.extraOperatorMonthlyTzs ?? 5000),
      maxBranches: body.maxBranches === null || body.maxBranches === "" ? null : Number(body.maxBranches ?? 1),
      maxOperators: body.maxOperators === null || body.maxOperators === "" ? null : Number(body.maxOperators ?? 2),
      maxSuppliers: body.maxSuppliers === null || body.maxSuppliers === "" ? null : Number(body.maxSuppliers ?? 5),
      maxConnectedPharmacies:
        body.maxConnectedPharmacies === null || body.maxConnectedPharmacies === ""
          ? null
          : Number(body.maxConnectedPharmacies ?? 15),
      features: Array.isArray(body.features) ? body.features : undefined,
      active: body.active !== false,
    });

    if (canQuerySupabaseTables()) {
      try {
        const supabase = await createServiceClient();
        await supabase.from("subscription_plans").upsert({
          id: updated.id,
          name: updated.name,
          price_monthly_tzs: updated.priceMonthlyTzs,
          price_annual_tzs: updated.priceAnnualTzs,
          max_branches: updated.maxBranches,
          max_operators: updated.maxOperators,
          features: updated.features,
        });
      } catch {
        // subscription_plans mirror is optional
      }
    }

    appendAuditLog(db, {
      accountId: db.accounts[0]?.id ?? "acc-hq",
      actor: actorName,
      category: "BILLING",
      action: `HQ updated package ${updated.name} (${updated.pricePerBranchMonthlyTzs.toLocaleString("en-US")} TZS/branch/mo, ${updated.includedAdminsPerBranch} Admin + ${updated.includedOperatorsPerBranch} Operator included)`,
    });
    await persistDb(db);
    return noStoreJson({ ok: true, pkg: updated, packages: getWorkspacePackages(db) });
  }

  if (action === "toggle_package_active") {
    const id = sanitizeText(body.id, 60);
    const list = getWorkspacePackages(db);
    const target = list.find((p) => p.id === id);
    if (!target) {
      return noStoreJson({ error: "Package not found." }, { status: 404 });
    }
    target.active = typeof body.active === "boolean" ? body.active : !target.active;
    db.packages = list;
    await persistDb(db);
    return noStoreJson({ ok: true, pkg: target, packages: list });
  }

  if (action === "delete_package") {
    const id = sanitizeText(body.id, 60);
    const list = getWorkspacePackages(db);
    const next = list.filter((p) => p.id !== id);
    if (next.length === list.length) {
      return noStoreJson({ error: "Package not found." }, { status: 404 });
    }
    db.packages = next;
    await persistDb(db);
    return noStoreJson({ ok: true, packages: next });
  }

  if (action === "resolve_escrow") {
    const orderId = sanitizeText(body.orderId, 80);
    const decision = body.decision === "cancel" ? "cancel" : "release";
    const order = (db.wholesaleOrders ?? []).find((o) => o.id === orderId);
    if (!order) {
      return noStoreJson({ error: "Wholesale order not found." }, { status: 404 });
    }
    if (decision === "cancel") {
      order.escrowStatus = "cancelled";
    } else {
      order.escrowStatus = "released";
      order.orderStatus = "delivered";
      order.deliveredAt = new Date().toISOString();
    }
    appendAuditLog(db, {
      accountId: order.accountId,
      actor: actorName,
      category: "BILLING",
      action:
        decision === "cancel"
          ? `HQ cancelled order ${order.orderReference} & refunded Kasri escrow`
          : `HQ released Kasri escrow on order ${order.orderReference} (TZS ${order.totalTzs.toLocaleString("en-US")})`,
    });
    await persistDb(db);
    return noStoreJson({ ok: true, order });
  }

  if (action === "mark_quote_contacted" || action === "create_supplier_invite" || action === "cancel_supplier_invite") {
    if (!canQuerySupabaseTables()) {
      return noStoreJson({ error: "Supabase service credentials required for quotes & invites." }, { status: 400 });
    }
    const supabase = await createServiceClient();
    if (action === "mark_quote_contacted") {
      const quoteId = sanitizeText(body.quoteId, 80);
      const { error } = await supabase.from("quote_requests").update({ status: "contacted" }).eq("id", quoteId);
      if (error) return noStoreJson({ error: error.message }, { status: 500 });
      return noStoreJson({ ok: true });
    }
    if (action === "create_supplier_invite") {
      const quoteRequestId = sanitizeText(body.quoteRequestId, 80) || null;
      const email = sanitizeText(body.email, 120).toLowerCase();
      const companyName = sanitizeText(body.companyName, 120);
      if (!email || !companyName) {
        return noStoreJson({ error: "Email and company name are required." }, { status: 400 });
      }
      const token = `sup_${newId("inv").replace(/[^a-zA-Z0-9]/g, "")}`;
      const { error } = await supabase.from("supplier_invites").insert({
        quote_request_id: quoteRequestId,
        email,
        company_name: companyName,
        token,
        status: "pending",
      });
      if (error) return noStoreJson({ error: error.message }, { status: 500 });
      return noStoreJson({ ok: true, inviteToken: token });
    }
    const inviteId = sanitizeText(body.inviteId, 80);
    const { error } = await supabase.from("supplier_invites").update({ status: "cancelled" }).eq("id", inviteId);
    if (error) return noStoreJson({ error: error.message }, { status: 500 });
    return noStoreJson({ ok: true });
  }

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
    await persistDb(db);
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
    await persistDb(db);
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
    await persistDb(db);
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
      await persistDb(db);
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
    await persistDb(db);
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
    await persistDb(db);
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
    await persistDb(db);
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
    await persistDb(db);
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
    await persistDb(db);
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
    await persistDb(db);
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
    await persistDb(db);
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
      await persistDb(db);
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
    await persistDb(db);
    return noStoreJson({
      ok: true,
      subscriptionPlan: targetAccount.subscriptionPlan,
      subscriptionActive: targetAccount.subscriptionActive,
    });
  }

  if (action === "branch_command") {
    const centreId = sanitizeText(body.centreId, 80);
    const cmd = sanitizeText(body.cmd, 40);
    const reason = sanitizeText(body.reason, 220);
    const allowedCmds = new Set(["force_sync", "lock_branch", "unlock_branch", "suspend_branch"]);
    if (!allowedCmds.has(cmd)) {
      return noStoreJson({ error: "Invalid branch command." }, { status: 400 });
    }
    const centre = db.centres.find((c) => c.id === centreId && c.accountId === targetAccount.id);
    if (!centre) {
      return noStoreJson({ error: "Branch not found on organization." }, { status: 404 });
    }

    if (canQuerySupabaseTables()) {
      try {
        const supabase = await createServiceClient();
        await supabase.from("branch_commands").insert({
          branch_id: centre.id,
          account_id: targetAccount.id,
          command: cmd,
          reason: reason || null,
          status: "pending",
        });
        if (cmd === "lock_branch" || cmd === "suspend_branch") {
          await supabase.from("branches").update({ subscription_status: "locked", locked_reason: reason || "hq_command" }).eq("id", centre.id);
        } else if (cmd === "unlock_branch") {
          await supabase.from("branches").update({ subscription_status: "active", locked_reason: null }).eq("id", centre.id);
        }
      } catch {
        // Optional branch telemetry table sync
      }
    }

    appendAuditLog(db, {
      accountId: targetAccount.id,
      actor: actorName,
      category: "SECURITY",
      action: `HQ queued '${cmd}' on branch ${centre.name}${reason ? ` (${reason})` : ""}`,
    });
    if (cmd === "lock_branch" || cmd === "suspend_branch") {
      pushHqMessage(db, {
        accountId: targetAccount.id,
        title: `Branch Command: ${centre.name}`,
        swTitle: `Amri ya Tawi: ${centre.name}`,
        body: reason || `Terminal command ${cmd} issued by HQ.`,
        swBody: reason || `Amri ${cmd} imetumwa kutoka HQ.`,
        severity: "action",
        ctaLabel: "Inspect",
        ctaTarget: "overview",
        senderName: actorName,
      });
    }
    await persistDb(db);
    return noStoreJson({ ok: true, cmd, centreId: centre.id });
  }

  if (action === "manage_operator") {
    const op = sanitizeText(body.op, 30);
    if (op === "add") {
      const displayName = sanitizeText(body.displayName, 80);
      const centreId = sanitizeText(body.centreId, 80) || db.centres.find((c) => c.accountId === targetAccount.id)?.id || "";
      const roleRaw = sanitizeText(body.role, 40) as WorkspaceProfileRole;
      const role: WorkspaceProfileRole = ALLOWED_ROLES.has(roleRaw) ? roleRaw : "pos_cashier";
      const pinStr = String(body.pin ?? "").trim();
      const pinCheck = validatePinPolicy(pinStr);
      if (!pinCheck.ok) return noStoreJson({ error: pinCheck.error ?? "Invalid PIN." }, { status: 400 });
      if (displayName.length < 2 || !centreId) {
        return noStoreJson({ error: "Operator display name and branch are required." }, { status: 400 });
      }
      const rawUser = sanitizeText(body.username, 40) || displayName.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      const username = db.profiles.some((p) => p.username?.toLowerCase() === rawUser.toLowerCase())
        ? suggestUniqueUsername(db, rawUser)
        : rawUser;
      const created = {
        id: newId("prof"),
        accountId: targetAccount.id,
        centreId,
        username,
        displayName,
        role,
        pinHash: hashSecret(pinStr).hash,
        isMasterAdmin: false,
        capabilities: clampProfileCapabilities(role),
        createdAt: new Date().toISOString(),
      };
      db.profiles.push(created);
      appendAuditLog(db, {
        accountId: targetAccount.id,
        actor: actorName,
        category: "SECURITY",
        action: `HQ provisioned operator @${username} (${role})`,
      });
      await persistDb(db);
      return noStoreJson({ ok: true, profileId: created.id, username });
    }

    const profileId = sanitizeText(body.profileId, 80);
    const prof = db.profiles.find((p) => p.id === profileId && p.accountId === targetAccount.id);
    if (!prof) return noStoreJson({ error: "Operator profile not found." }, { status: 404 });

    if (op === "set_role") {
      const roleRaw = sanitizeText(body.role, 40) as WorkspaceProfileRole;
      if (!ALLOWED_ROLES.has(roleRaw)) return noStoreJson({ error: "Invalid role." }, { status: 400 });
      prof.role = roleRaw;
      prof.capabilities = clampProfileCapabilities(roleRaw, prof.capabilities);
      appendAuditLog(db, {
        accountId: targetAccount.id,
        actor: actorName,
        category: "SECURITY",
        action: `HQ changed role for ${prof.displayName} to ${roleRaw}`,
      });
      await persistDb(db);
      return noStoreJson({ ok: true });
    }
    if (op === "reset_pin") {
      const pinStr = String(body.pin ?? "").trim();
      const pinCheck = validatePinPolicy(pinStr);
      if (!pinCheck.ok) return noStoreJson({ error: pinCheck.error ?? "Invalid PIN." }, { status: 400 });
      prof.pinHash = hashSecret(pinStr).hash;
      appendAuditLog(db, {
        accountId: targetAccount.id,
        actor: actorName,
        category: "SECURITY",
        action: `HQ reset terminal PIN for ${prof.displayName}`,
      });
      await persistDb(db);
      return noStoreJson({ ok: true });
    }
    if (op === "remove") {
      if (prof.isMasterAdmin) {
        return noStoreJson({ error: "Cannot remove primary account owner." }, { status: 400 });
      }
      db.profiles = db.profiles.filter((p) => p.id !== prof.id);
      appendAuditLog(db, {
        accountId: targetAccount.id,
        actor: actorName,
        category: "SECURITY",
        action: `HQ removed operator ${prof.displayName}`,
      });
      await persistDb(db);
      return noStoreJson({ ok: true });
    }
    return noStoreJson({ error: "Invalid operator operation." }, { status: 400 });
  }

  return noStoreJson({ error: "Unsupported ops dispatch action." }, { status: 400 });
}
