import { randomBytes } from "crypto";
import type { NextRequest } from "next/server";
import { runDailyOwnerDigest } from "@/lib/workspace/daily-summary";
import {
  extractHqTokenFromRequest,
  HQ_COOKIE_NAME,
  HQ_OP_COOKIE,
  isHqMockMode,
  isValidHQToken,
  parseHqToken,
} from "@/lib/hq-auth";
import {
  canHqWorker,
  clampHqCapabilities,
  HQ_ROLE_METADATA,
  sanitizeHqRole,
  type HqWorkerCapabilities,
  type HqWorkerRole,
} from "@/lib/hq-workers";
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
import {
  appendSpineEvent,
  authorizeRegistryAction,
  buildAgentCrewProfiles,
  buildFullIntelligenceDetail,
  buildModelScorecards,
  buildPromiseBoard,
  buildSpineTelemetrySummary,
  DEFAULT_HEALTH_WEIGHTS,
  emitRegistryCommandEvent,
  ensureSpineBackfill,
  evaluateReadinessGates,
  executePrivacyGatewayQuery,
  generateAgentDraftProposals,
  issueAndTraceRecall,
  runModel1DemandAndReorder,
  runModel2ExpiryAndRescue,
  runRedTeamSyntheticDrill,
  verifyOrgHashChain,
} from "@/lib/spine";
import { hasAnyInjection, parseJsonObject, sanitizeBatchImageUrl } from "@/lib/workspace/request-auth";
import {
  appendAuditLog,
  createHqTeamNote,
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
  publicHqWorkerSummary,
  pushHqMessage,
  saveWorkspaceDb,
  suggestUniqueUsername,
  upsertJournalArticle,
  upsertWorkspacePackage,
  warmDbFromSupabase,
  type AuditLogEntry,
  type HqUpdateItem,
  type HqWorkerRecord,
  type WorkspaceSupportTicket,
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
      workerId: "master-key",
      workerRole: "hq_master" as HqWorkerRole,
    };
  }

  const token = extractHqTokenFromRequest(
    request.headers,
    request.cookies.get(HQ_COOKIE_NAME)?.value
  );
  const parsed = parseHqToken(token);
  if (!parsed || !isValidHQToken(token)) {
    return { ok: false as const, status: 401, error: "Operations clearance required." };
  }
  const operator =
    sanitizeText(request.cookies.get(HQ_OP_COOKIE)?.value, 80) ||
    (isHqMockMode() ? "Ops Sandbox Desk" : "Ops Clearance Unit");
  return {
    ok: true as const,
    operator,
    workerId: parsed.adminId,
    workerRole: parsed.role,
  };
}

function resolveSessionWorker(
  db: ReturnType<typeof getWorkspaceDb>,
  auth: { operator: string; workerId: string; workerRole: HqWorkerRole }
) {
  const dbWorker = (db.hqWorkers ?? []).find((w) => w.id === auth.workerId);
  if (dbWorker) {
    return {
      id: dbWorker.id,
      name: dbWorker.name,
      role: dbWorker.role,
      title: dbWorker.title,
      capabilities: clampHqCapabilities(dbWorker.role, dbWorker.capabilities),
      isMaster: dbWorker.role === "hq_master",
      suspended: dbWorker.status === "suspended",
    };
  }
  const role = auth.workerRole;
  const meta = HQ_ROLE_METADATA[role];
  return {
    id: auth.workerId,
    name: auth.operator,
    role,
    title: meta.defaultTitle,
    capabilities: clampHqCapabilities(role),
    isMaster: role === "hq_master",
    suspended: false,
  };
}

const ACTION_PERMISSION_MAP: Partial<Record<string, keyof HqWorkerCapabilities>> = {
  create_hq_worker: "canManageHqTeam",
  update_hq_worker: "canManageHqTeam",
  delete_hq_worker: "canManageHqTeam",
  reply_support_ticket: "canAnswerSupport",
  update_support_ticket: "canAnswerSupport",
  upsert_package: "canManagePackages",
  toggle_package_active: "canManagePackages",
  delete_package: "canManagePackages",
  resolve_escrow: "canManageBillingEscrow",
  set_billing_overdue: "canManageBillingEscrow",
  update_subscription: "canManageBillingEscrow",
  lock_account: "canManageFleetLocks",
  unlock_account: "canManageFleetLocks",
  toggle_network_verify: "canManageFleetLocks",
  branch_command: "canManageFleetLocks",
  manage_operator: "canManageFleetLocks",
  review_join_request: "canManageOnboarding",
  mark_quote_contacted: "canManageOnboarding",
  create_supplier_invite: "canManageOnboarding",
  cancel_supplier_invite: "canManageOnboarding",
  upsert_journal_article: "canPublishEditorial",
  delete_journal_article: "canPublishEditorial",
  publish_hq_update: "canPublishEditorial",
  delete_hq_update: "canPublishEditorial",
  send_message: "canBroadcastComms",
  delete_hq_message: "canBroadcastComms",
  trigger_daily_summary: "canBroadcastComms",
  label_anomaly_alert: "canAnswerSupport",
  update_health_weights: "canManageHqTeam",
  create_proposal_from_model: "canAnswerSupport",
};

async function buildFleetPayload(auth: { operator: string; workerId: string; workerRole: HqWorkerRole }) {
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
        status: c.status ?? "active",
        excludedFromRollup: Boolean(c.excludedFromRollup),
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
      paymentSettings: db.paymentSettings?.[acc.id] ?? null,
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
      const [quotesRes, invitesRes, ticketsRes] = await Promise.all([
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
        supabase
          .from("support_tickets")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(80),
      ]);
      for (const row of ticketsRes.data ?? []) {
        const rid = String(row.id);
        db.supportTickets ??= [];
        if (!db.supportTickets.some((t) => t.id === rid)) {
          const matchedOrg = row.account_id
            ? db.accounts.find((a) => a.id === String(row.account_id))
            : undefined;
          db.supportTickets.push({
            id: rid,
            ticketRef: `SUP-${rid.slice(0, 6).toUpperCase()}`,
            accountId: row.account_id ? String(row.account_id) : null,
            orgName: matchedOrg?.orgName,
            contactEmail: String(row.contact_email ?? ""),
            subject: String(row.subject ?? ""),
            message: String(row.message ?? ""),
            category:
              row.category === "billing" ||
              row.category === "technical" ||
              row.category === "other"
                ? row.category
                : "general",
            priority: "normal",
            status:
              row.status === "in_progress" || row.status === "resolved"
                ? row.status
                : "open",
            internalNote: row.internal_note ? String(row.internal_note) : null,
            replies: [],
            source: "web",
            createdAt: String(row.created_at ?? new Date().toISOString()),
            updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
          });
        }
      }
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

  const currentWorker = resolveSessionWorker(db, auth);
  const spine = ensureSpineBackfill(db);
  const readinessGates = evaluateReadinessGates(db);
  const modelScorecards = buildModelScorecards(db, readinessGates);
  const promiseBoard = buildPromiseBoard(db);
  const spineTelemetry = buildSpineTelemetrySummary(db);
  const agents = buildAgentCrewProfiles(db);
  const intelligenceDetail = buildFullIntelligenceDetail(db);
  const hqWorkers = (db.hqWorkers ?? []).map(publicHqWorkerSummary);
  const supportTickets: WorkspaceSupportTicket[] = [...(db.supportTickets ?? [])].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  const hqTeamNotes = [...(db.hqTeamNotes ?? [])].slice(0, 80);

  // Build trailing 14-day daily telemetry strictly from actual DB records
  const dailyTimeline = Array.from({ length: 14 }, (_, idx) => {
    const dayMs = nowMs - (13 - idx) * 86_400_000;
    const dStr = new Date(dayMs).toISOString().slice(0, 10);
    const label = dStr.slice(5);
    const daySales = (db.sales ?? []).filter((s) => s.createdAt.slice(0, 10) === dStr);
    const dayOrders = (db.wholesaleOrders ?? []).filter((o) => o.createdAt.slice(0, 10) === dStr);
    const dayEvents = spine.events.filter((e) => e.receivedAt.slice(0, 10) === dStr);
    return {
      date: dStr,
      label,
      salesTzs: daySales.reduce((sum, s) => sum + s.totalTzs, 0),
      salesCount: daySales.length,
      escrowTzs: dayOrders.reduce((sum, o) => sum + o.totalTzs, 0),
      eventsCount: dayEvents.length,
    };
  });

  return {
    scope: "fleet" as const,
    operator: currentWorker.name || auth.operator,
    currentWorker: {
      id: currentWorker.id,
      name: currentWorker.name,
      role: currentWorker.role,
      title: currentWorker.title,
      capabilities: currentWorker.capabilities,
      isMaster: currentWorker.isMaster,
    },
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
      openSupportTickets: supportTickets.filter((t) => t.status !== "resolved").length,
      urgentSupportTickets: supportTickets.filter(
        (t) => t.status !== "resolved" && (t.priority === "high" || t.priority === "urgent")
      ).length,
      activeHqWorkers: hqWorkers.filter((w) => w.status === "active").length,
      invitedHqWorkers: hqWorkers.filter((w) => w.status === "invited").length,
    },
    peakTelemetry: {
      monthlyRecurringRevenueTzs,
      expiryExposureTzs: fleetExpiryExposureTzs,
      regionDemand: Array.from(regionMap.values()).sort((a, b) => b.revenue30dTzs - a.revenue30dTzs),
      topDispensedProducts: Array.from(skuMap.values())
        .sort((a, b) => b.unitsSold - a.unitsSold)
        .slice(0, 8),
      dailyTimeline,
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
    hqWorkers,
    supportTickets,
    hqTeamNotes,
    notificationEnv: getNotificationEnvStatus(),
    spine: spineTelemetry,
    promiseBoard,
    readinessGates,
    modelScorecards,
    proposals: spine.proposals,
    autonomyConfig: spine.autonomyConfig,
    agents,
    recalls: spine.recalls,
    privacyReleases: spine.privacyReleases,
    cases: spine.cases,
    intelligenceDetail,
  };
}

export async function GET(request: NextRequest) {
  const auth = checkHqRequestAuth(request);
  if (!auth.ok) {
    return noStoreJson({ error: auth.error }, { status: auth.status });
  }

  await warmDbFromSupabase();
  const verifyChainParam = request.nextUrl.searchParams.get("verifyChain")?.trim();
  if (verifyChainParam === "1") {
    const db = getWorkspaceDb();
    const spine = ensureSpineBackfill(db);
    const filterOrg = request.nextUrl.searchParams.get("orgId")?.trim() || undefined;
    const proof = verifyOrgHashChain(spine.events, filterOrg);
    return noStoreJson({
      ...proof,
      globalSeqHead: spine.globalSeqCounter,
      verifiedAt: new Date().toISOString(),
    });
  }

  const scope = request.nextUrl.searchParams.get("scope")?.trim();
  if (scope === "fleet") {
    return noStoreJson(await buildFleetPayload(auth));
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
  const sessionWorker = resolveSessionWorker(db, auth);
  if (sessionWorker.suspended) {
    return noStoreJson({ error: "Your HQ operator clearance has been suspended by Master." }, { status: 403 });
  }
  const requiredPerm = ACTION_PERMISSION_MAP[action];
  if (requiredPerm && !canHqWorker(sessionWorker.role, sessionWorker.capabilities, requiredPerm)) {
    emitRegistryCommandEvent(db, {
      action,
      actorId: sessionWorker.id,
      payload: { deniedPerm: requiredPerm },
      failedReason: `Clearance denied: missing ${requiredPerm}`,
    });
    return noStoreJson(
      {
        error: `Clearance denied: ${HQ_ROLE_METADATA[sessionWorker.role].label} lacks ${requiredPerm} permission.`,
      },
      { status: 403 }
    );
  }
  const regCheck = authorizeRegistryAction(action, sessionWorker.role, sessionWorker.capabilities);
  if (!regCheck.allowed) {
    emitRegistryCommandEvent(db, {
      action,
      actorId: sessionWorker.id,
      payload: {},
      failedReason: regCheck.reason,
    });
    return noStoreJson({ error: regCheck.reason }, { status: 403 });
  }
  const actorName = sanitizeText(body.senderName, 80) || sessionWorker.name || auth.operator;

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

  if (action === "trigger_daily_summary") {
    const requestedTarget = sanitizeText(body.accountId, 80);
    const targetAccId =
      requestedTarget && requestedTarget !== "ALL" && !requestedTarget.startsWith("ROLE:")
        ? requestedTarget
        : undefined;
    const result = await runDailyOwnerDigest({
      force: body.force === false ? false : true,
      targetAccountId: targetAccId,
    });
    return noStoreJson(result);
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
    delete reqItem.allocatedPinPreview;
    reqItem.reviewedAt = new Date().toISOString();

    emitRegistryCommandEvent(db, {
      action: "review_join_request",
      actorId: sessionWorker.id,
      legacyOrgId: reqItem.targetAccountId,
      legacyBranchId: targetCentre.id,
      payload: { profileId: profId, username: finalUsername, role: finalRole },
    });
    appendAuditLog(db, {
      accountId: reqItem.targetAccountId,
      actor: actorName,
      category: "SECURITY",
      action: `HQ approved & allocated @${finalUsername} to ${targetCentre.name}`,
    });
    await persistDb(db);
    return noStoreJson({ ok: true, status: "approved", profileId: profId, oneTimePin: pinStr });
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
          });
          if (smsRes.delivered) smsDeliveredCount += 1;
        }
      }

      appendAuditLog(db, {
        accountId: acc.id,
        actor: actorName,
        category: "COMPLIANCE",
        action: `HQ ${deliveryChannel === "sms_textify" ? "SMS" : deliveryChannel === "both" ? "notice + SMS" : "notice"} dispatched: ${title}`,
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
        body: "Renew your active plan to resume Counter POS, inventory edits, and wholesale orders.",
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
    const certificateId = sanitizeText(body.certificateId, 80);
    const note = sanitizeText(body.note, 240);
    const nowIso = new Date().toISOString();

    targetAccount.verificationStatus = verified ? "verified" : "skipped";
    targetAccount.networkUnlocked = verified;

    if (Array.isArray(targetAccount.certificates) && targetAccount.certificates.length > 0) {
      let matched = false;
      for (const cert of targetAccount.certificates) {
        if (!certificateId || cert.id === certificateId) {
          cert.status = verified ? "verified" : "rejected";
          cert.reviewedBy = actorName;
          cert.reviewedAt = nowIso;
          if (note) cert.reviewNote = note;
          else if (verified) cert.reviewNote = undefined;
          matched = true;
        }
      }
      if (certificateId && !matched) {
        for (const cert of targetAccount.certificates) {
          cert.status = verified ? "verified" : "rejected";
          cert.reviewedBy = actorName;
          cert.reviewedAt = nowIso;
          if (note) cert.reviewNote = note;
        }
      }
    }

    appendAuditLog(db, {
      accountId: targetAccount.id,
      actor: actorName,
      category: "COMPLIANCE",
      action: verified
        ? `HQ verified compliance proofs & unlocked Network access${note ? ` (${note})` : ""}`
        : `HQ marked compliance proof unverified/paused${note ? ` (${note})` : ""}`,
    });
    pushHqMessage(db, {
      accountId: targetAccount.id,
      title: verified ? "Compliance Permits Verified" : "Compliance Verification Paused / Unverified",
      swTitle: verified ? "Vibali vya Uzingatiaji Vimethibitishwa" : "Uthibitisho wa Vibali Umesitishwa",
      body: verified
        ? `Your operating permits have been reviewed and verified by Compliance.${note ? ` Note: ${note}` : ""}`
        : `Compliance could not verify your current permit submission.${note ? ` Reason: ${note}` : " Please review and re-upload your permit in Org Settings."}`,
      swBody: verified
        ? `Vibali vyako vimekaguliwa na kuthibitishwa na Kitengo cha Uzingatiaji.${note ? ` Maelezo: ${note}` : ""}`
        : `Kitengo cha Uzingatiaji hakikuweza kuthibitisha vibali vyako.${note ? ` Sababu: ${note}` : " Tafadhali pakia cheti sahihi kwenye Mipangilio ya Shirika."}`,
      severity: verified ? "info" : "action",
      ctaLabel: verified ? "Open Network" : "Upload Permit",
      ctaTarget: verified ? "network" : "overview",
      senderName: `${actorName} (Compliance)`,
    });
    await persistDb(db);
    return noStoreJson({
      ok: true,
      verificationStatus: targetAccount.verificationStatus,
      certificates: targetAccount.certificates,
    });
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
    const allowedCmds = new Set([
      "force_sync",
      "lock_branch",
      "unlock_branch",
      "suspend_branch",
      "pause_branch",
      "resume_branch",
      "archive_branch",
      "toggle_exclude_branch",
      "delete_branch",
    ]);
    if (!allowedCmds.has(cmd)) {
      return noStoreJson({ error: "Invalid branch command." }, { status: 400 });
    }
    const orgCentres = db.centres.filter((c) => c.accountId === targetAccount.id);
    const centre = orgCentres.find((c) => c.id === centreId);
    if (!centre) {
      return noStoreJson({ error: "Branch not found on organization." }, { status: 404 });
    }

    if (cmd === "pause_branch" || cmd === "suspend_branch" || cmd === "lock_branch") {
      centre.status = "paused";
      centre.pausedReason = reason || "Paused by Cervos HQ";
    } else if (cmd === "resume_branch" || cmd === "unlock_branch") {
      centre.status = "active";
      centre.pausedReason = undefined;
    } else if (cmd === "archive_branch") {
      if (centre.isPrimary && orgCentres.filter((c) => c.status !== "archived").length <= 1) {
        return noStoreJson({ error: "Cannot archive the only active primary branch." }, { status: 400 });
      }
      centre.status = "archived";
      centre.excludedFromRollup = true;
      centre.pausedReason = reason || "Archived by Cervos HQ";
    } else if (cmd === "toggle_exclude_branch") {
      centre.excludedFromRollup = !Boolean(centre.excludedFromRollup);
    } else if (cmd === "delete_branch") {
      if (centre.isPrimary || orgCentres.length <= 1) {
        return noStoreJson({ error: "Cannot delete an organization's primary branch." }, { status: 400 });
      }
      const fallback = orgCentres.find((c) => c.id !== centre.id && c.isPrimary) ?? orgCentres.find((c) => c.id !== centre.id);
      if (fallback) {
        for (const prof of db.profiles) {
          if (prof.accountId === targetAccount.id && prof.centreId === centre.id) {
            prof.centreId = fallback.id;
          }
        }
      }
      db.centres = db.centres.filter((c) => c.id !== centre.id);
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
        if (cmd === "lock_branch" || cmd === "suspend_branch" || cmd === "pause_branch" || cmd === "archive_branch") {
          await supabase.from("branches").update({ subscription_status: "locked", locked_reason: reason || "hq_command" }).eq("id", centre.id);
        } else if (cmd === "unlock_branch" || cmd === "resume_branch") {
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
      action: `HQ executed '${cmd}' on branch ${centre.name}${reason ? ` (${reason})` : ""}`,
    });
    if (cmd === "lock_branch" || cmd === "suspend_branch" || cmd === "pause_branch" || cmd === "archive_branch") {
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

  if (action === "create_hq_worker") {
    const name = sanitizeText(body.name, 80);
    const email = sanitizeText(body.email, 160).toLowerCase();
    const phone = sanitizeText(body.phone, 40);
    const role = sanitizeHqRole(body.role);
    const title = sanitizeText(body.title, 80) || HQ_ROLE_METADATA[role].defaultTitle;
    const region = sanitizeText(body.region, 60) || "Dar es Salaam HQ";

    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return noStoreJson({ error: "Valid worker full name and work email are required." }, { status: 400 });
    }
    db.hqWorkers ??= [];
    if (db.hqWorkers.some((w) => w.email.toLowerCase() === email)) {
      return noStoreJson({ error: "An HQ operator with that email already exists." }, { status: 409 });
    }

    const rawInviteCode = `CVHQ-${randomBytes(3).toString("hex").toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`;
    const caps = clampHqCapabilities(
      role,
      body.capabilities && typeof body.capabilities === "object"
        ? (body.capabilities as Partial<HqWorkerCapabilities>)
        : undefined
    );
    const worker: HqWorkerRecord = {
      id: newId("hqw"),
      name,
      email,
      phone: phone || undefined,
      role,
      title,
      region,
      capabilities: caps,
      status: "invited",
      inviteTokenHash: hashSecret(rawInviteCode).hash,
      inviteCodeHint: `****-${rawInviteCode.slice(-4)}`,
      invitedBy: actorName,
      invitedAt: new Date().toISOString(),
    };
    db.hqWorkers.unshift(worker);
    appendAuditLog(db, {
      accountId: db.accounts[0]?.id ?? "acc-hq",
      actor: actorName,
      category: "SECURITY",
      action: `HQ Master invited ${name} (${HQ_ROLE_METADATA[role].label}) to Operations Desk`,
    });
    await persistDb(db);
    return noStoreJson({
      ok: true,
      worker: publicHqWorkerSummary(worker),
      inviteCode: rawInviteCode,
    });
  }

  if (action === "update_hq_worker") {
    const workerId = sanitizeText(body.workerId, 60);
    const worker = (db.hqWorkers ?? []).find((w) => w.id === workerId);
    if (!worker) {
      return noStoreJson({ error: "HQ worker not found." }, { status: 404 });
    }
    if (body.role !== undefined) {
      worker.role = sanitizeHqRole(body.role);
      worker.capabilities = clampHqCapabilities(
        worker.role,
        body.capabilities && typeof body.capabilities === "object"
          ? (body.capabilities as Partial<HqWorkerCapabilities>)
          : undefined
      );
    } else if (body.capabilities && typeof body.capabilities === "object") {
      worker.capabilities = clampHqCapabilities(
        worker.role,
        body.capabilities as Partial<HqWorkerCapabilities>
      );
    }
    if (typeof body.title === "string" && body.title.trim()) {
      worker.title = sanitizeText(body.title, 80);
    }
    if (typeof body.region === "string" && body.region.trim()) {
      worker.region = sanitizeText(body.region, 60);
    }
    if (body.status === "active" || body.status === "suspended" || body.status === "invited") {
      worker.status = body.status;
    }

    let regeneratedCode: string | undefined;
    if (body.regenerateInvite) {
      regeneratedCode = `CVHQ-${randomBytes(3).toString("hex").toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`;
      worker.inviteTokenHash = hashSecret(regeneratedCode).hash;
      worker.inviteCodeHint = `****-${regeneratedCode.slice(-4)}`;
      if (worker.status !== "suspended") {
        worker.status = "invited";
      }
    }

    appendAuditLog(db, {
      accountId: db.accounts[0]?.id ?? "acc-hq",
      actor: actorName,
      category: "SECURITY",
      action: `HQ Master updated operator ${worker.name} (${worker.role}, status=${worker.status})`,
    });
    await persistDb(db);
    return noStoreJson({
      ok: true,
      worker: publicHqWorkerSummary(worker),
      ...(regeneratedCode ? { inviteCode: regeneratedCode } : {}),
    });
  }

  if (action === "delete_hq_worker") {
    const workerId = sanitizeText(body.workerId, 60);
    const list = (db.hqWorkers ??= []);
    const target = list.find((w) => w.id === workerId);
    if (!target) {
      return noStoreJson({ error: "HQ worker not found." }, { status: 404 });
    }
    if (workerId === sessionWorker.id) {
      return noStoreJson({ error: "Cannot delete your own active Master session." }, { status: 400 });
    }
    db.hqWorkers = list.filter((w) => w.id !== workerId);
    appendAuditLog(db, {
      accountId: db.accounts[0]?.id ?? "acc-hq",
      actor: actorName,
      category: "SECURITY",
      action: `HQ Master revoked & removed worker ${target.name} (${target.email})`,
    });
    await persistDb(db);
    return noStoreJson({ ok: true });
  }

  if (action === "reply_support_ticket") {
    const ticketId = sanitizeText(body.ticketId, 80);
    const replyBody = sanitizeText(body.replyBody, 3000);
    if (replyBody.length < 2) {
      return noStoreJson({ error: "Reply message cannot be empty." }, { status: 400 });
    }
    const ticket = (db.supportTickets ?? []).find((t) => t.id === ticketId);
    if (!ticket) {
      return noStoreJson({ error: "Support ticket not found." }, { status: 404 });
    }
    const nextStatus =
      body.nextStatus === "open" ||
      body.nextStatus === "in_progress" ||
      body.nextStatus === "waiting_user" ||
      body.nextStatus === "resolved"
        ? body.nextStatus
        : "waiting_user";
    const nowIso = new Date().toISOString();
    ticket.replies.push({
      id: newId("supr"),
      authorName: sessionWorker.name,
      authorRole: "hq",
      authorWorkerId: sessionWorker.id,
      body: replyBody,
      createdAt: nowIso,
    });
    ticket.status = nextStatus;
    ticket.assignedWorkerId = ticket.assignedWorkerId || sessionWorker.id;
    ticket.assignedWorkerName = ticket.assignedWorkerName || sessionWorker.name;
    ticket.updatedAt = nowIso;

    // Mirror reply straight into pharmacy's HQ Inbox if linked to an org
    const targetAcc = ticket.accountId
      ? db.accounts.find((a) => a.id === ticket.accountId)
      : db.accounts.find((a) => a.email.toLowerCase() === ticket.contactEmail.toLowerCase());
    if (targetAcc) {
      pushHqMessage(db, {
        accountId: targetAcc.id,
        title: `Support Reply (${ticket.ticketRef}): ${ticket.subject}`,
        swTitle: `Jibu la Msaada (${ticket.ticketRef}): ${ticket.subject}`,
        body: replyBody,
        swBody: replyBody,
        severity: ticket.priority === "urgent" || ticket.priority === "high" ? "action" : "info",
        ctaLabel: "Open Workspace",
        ctaTarget: "overview",
        senderName: `${sessionWorker.name} (Cervos Support)`,
      });
      if (body.sendSms && targetAcc.ownerPhone) {
        await sendTextifySms({
          to: targetAcc.ownerPhone,
          message: `[Cervos Support ${ticket.ticketRef}] ${replyBody.slice(0, 140)}`,
          sender: "Cervos",
        });
      }
    }

    if (canQuerySupabaseTables()) {
      try {
        const supabase = await createServiceClient();
        await supabase
          .from("support_tickets")
          .update({
            status: nextStatus === "resolved" ? "resolved" : "in_progress",
            updated_at: nowIso,
          })
          .eq("id", ticket.id);
      } catch {
        // Primary state saved cleanly in workspace DB
      }
    }

    appendAuditLog(db, {
      accountId: targetAcc?.id ?? db.accounts[0]?.id ?? "acc-hq",
      actor: sessionWorker.name,
      category: "COMPLIANCE",
      action: `HQ Support replied on ${ticket.ticketRef} (${ticket.contactEmail}) -> ${nextStatus}`,
    });
    await persistDb(db);
    return noStoreJson({ ok: true, ticket });
  }

  if (action === "update_support_ticket") {
    const ticketId = sanitizeText(body.ticketId, 80);
    const ticket = (db.supportTickets ?? []).find((t) => t.id === ticketId);
    if (!ticket) {
      return noStoreJson({ error: "Support ticket not found." }, { status: 404 });
    }
    if (
      body.status === "open" ||
      body.status === "in_progress" ||
      body.status === "waiting_user" ||
      body.status === "resolved"
    ) {
      ticket.status = body.status;
    }
    if (
      body.priority === "low" ||
      body.priority === "normal" ||
      body.priority === "high" ||
      body.priority === "urgent"
    ) {
      ticket.priority = body.priority;
    }
    if (body.internalNote !== undefined) {
      ticket.internalNote = sanitizeText(body.internalNote, 3000) || null;
    }
    if (body.assignedWorkerId !== undefined) {
      const wId = sanitizeText(body.assignedWorkerId, 60);
      if (!wId) {
        ticket.assignedWorkerId = null;
        ticket.assignedWorkerName = null;
      } else {
        const matched = (db.hqWorkers ?? []).find((w) => w.id === wId);
        ticket.assignedWorkerId = wId;
        ticket.assignedWorkerName = matched?.name || sessionWorker.name;
      }
    }
    ticket.updatedAt = new Date().toISOString();

    if (canQuerySupabaseTables()) {
      try {
        const supabase = await createServiceClient();
        await supabase
          .from("support_tickets")
          .update({
            status: ticket.status === "resolved" ? "resolved" : ticket.status === "open" ? "open" : "in_progress",
            internal_note: ticket.internalNote,
            updated_at: ticket.updatedAt,
          })
          .eq("id", ticket.id);
      } catch {
        // Primary state persisted in workspace DB
      }
    }

    await persistDb(db);
    return noStoreJson({ ok: true, ticket });
  }

  if (action === "post_hq_team_note") {
    const noteBody = sanitizeText(body.body, 1500);
    if (noteBody.length < 3) {
      return noStoreJson({ error: "Team note is too short." }, { status: 400 });
    }
    const topic =
      body.topic === "shift_handoff" ||
      body.topic === "escalation" ||
      body.topic === "directive"
        ? body.topic
        : "general";
    const targetWorkerId = sanitizeText(body.targetWorkerId, 60) || null;
    const targetWorker = targetWorkerId
      ? (db.hqWorkers ?? []).find((w) => w.id === targetWorkerId)
      : undefined;
    const note = createHqTeamNote(db, {
      authorWorkerId: sessionWorker.id,
      authorName: sessionWorker.name,
      authorRole: sessionWorker.role,
      topic,
      targetWorkerId,
      targetWorkerName: targetWorker?.name || (targetWorkerId === "master" ? "HQ Master" : null),
      linkedTicketId: sanitizeText(body.linkedTicketId, 60) || null,
      linkedAccountId: sanitizeText(body.linkedAccountId, 60) || null,
      body: noteBody,
      pinned: Boolean(body.pinned),
    });
    await persistDb(db);
    return noStoreJson({ ok: true, note });
  }

  if (action === "toggle_pin_team_note") {
    const noteId = sanitizeText(body.noteId, 60);
    const note = (db.hqTeamNotes ?? []).find((n) => n.id === noteId);
    if (!note) {
      return noStoreJson({ error: "Team note not found." }, { status: 404 });
    }
    note.pinned = !note.pinned;
    await persistDb(db);
    return noStoreJson({ ok: true, note });
  }

  // -------------------------------------------------------------------------
  // Ontology & Intelligence Layer Registry Actions (Spine v1)
  // -------------------------------------------------------------------------
  const spine = ensureSpineBackfill(db);

  if (action === "run_agent_drafts") {
    const proposals = generateAgentDraftProposals(db);
    await persistDb(db);
    return noStoreJson({ ok: true, proposals });
  }

  if (action === "approve_proposal" || action === "reject_proposal" || action === "revert_proposal") {
    const proposalId = sanitizeText(body.proposalId, 60);
    const prop = spine.proposals.find((p) => p.id === proposalId);
    if (!prop) {
      return noStoreJson({ error: "Proposal not found." }, { status: 404 });
    }
    if (action === "approve_proposal") {
      if (prop.status !== "proposed") {
        return noStoreJson({ error: "Proposal is already resolved." }, { status: 400 });
      }
      prop.status = "executed";
      emitRegistryCommandEvent(db, {
        action,
        actorId: sessionWorker.id,
        legacyOrgId: prop.orgId,
        legacyBranchId: prop.branchId,
        payload: { proposalId: prop.id, tool: prop.tool, tzs: prop.impact.tzs },
      });
    } else if (action === "reject_proposal") {
      prop.status = "rejected";
      emitRegistryCommandEvent(db, {
        action,
        actorId: sessionWorker.id,
        legacyOrgId: prop.orgId,
        payload: { proposalId: prop.id },
      });
    } else {
      if (prop.reversibility === "irreversible") {
        return noStoreJson({ error: "Irreversible proposals cannot be reverted." }, { status: 400 });
      }
      prop.status = "reverted";
      emitRegistryCommandEvent(db, {
        action,
        actorId: sessionWorker.id,
        legacyOrgId: prop.orgId,
        payload: { proposalId: prop.id },
      });
    }
    await persistDb(db);
    return noStoreJson({ ok: true, proposal: prop });
  }

  if (action === "set_autonomy_mode") {
    const kind = sanitizeText(body.kind, 40);
    const mode = sanitizeText(body.mode, 20);
    if (mode !== "off" && mode !== "suggest" && mode !== "auto_undo" && mode !== "auto") {
      return noStoreJson({ error: "Invalid autonomy mode." }, { status: 400 });
    }
    if ((kind === "billing_grace" || kind === "recall_quarantine") && (mode === "auto" || mode === "auto_undo")) {
      return noStoreJson(
        { error: "Financial locks and clinical recalls require a human gate." },
        { status: 403 }
      );
    }
    spine.autonomyConfig[kind] = mode;
    emitRegistryCommandEvent(db, {
      action,
      actorId: sessionWorker.id,
      payload: { kind, mode },
    });
    await persistDb(db);
    return noStoreJson({ ok: true, autonomyConfig: spine.autonomyConfig });
  }

  if (action === "issue_recall") {
    const regulatorRef = sanitizeText(body.regulatorRef, 60) || `TMDA-${Date.now().toString(36).toUpperCase()}`;
    const innName = sanitizeText(body.innName, 100);
    const batchNumber = sanitizeText(body.batchNumber, 60) || "AUTO";
    if (innName.length < 3) {
      return noStoreJson({ error: "INN or product name is required." }, { status: 400 });
    }
    const recall = issueAndTraceRecall(db, { regulatorRef, innName, batchNumber });
    await persistDb(db);
    return noStoreJson({ ok: true, recall });
  }

  if (action === "confirm_recall_quarantine") {
    const recallId = sanitizeText(body.recallId, 60);
    const branchId = sanitizeText(body.branchId, 80);
    const recall = spine.recalls.find((r) => r.id === recallId);
    if (!recall) {
      return noStoreJson({ error: "Recall record not found." }, { status: 404 });
    }
    const targetBranch = recall.affectedBranches.find((b) => b.branchId === branchId);
    if (!targetBranch) {
      return noStoreJson({ error: "Affected branch not found in recall." }, { status: 404 });
    }
    targetBranch.quarantinedConfirmed = true;
    for (const bat of db.batches ?? []) {
      if (
        bat.centreId === branchId &&
        (recall.batchNumber === "ALL-LOTS" || bat.batchNumber.toLowerCase() === recall.batchNumber.toLowerCase())
      ) {
        bat.quarantined = true;
      }
    }
    if (recall.affectedBranches.every((b) => b.quarantinedConfirmed)) {
      recall.state = "quarantined";
    }
    appendSpineEvent(db, {
      legacyOrgId: db.centres.find((c) => c.id === branchId)?.accountId || db.accounts[0]?.id || "hq_org",
      legacyBranchId: branchId,
      actorId: sessionWorker.id,
      actorKind: "hq",
      type: "recall.quarantine_confirmed",
      idempotencyKey: `recall:q:${recall.id}:${branchId}`,
      payload: { recallId: recall.id, branchId },
      piiClass: "none",
      source: "hq",
    });
    await persistDb(db);
    return noStoreJson({ ok: true, recall });
  }

  if (action === "approve_product_alias") {
    const aliasId = sanitizeText(body.aliasId, 60);
    const alias = spine.productAliases.find((a) => a.id === aliasId);
    if (!alias) {
      return noStoreJson({ error: "Product alias not found." }, { status: 404 });
    }
    alias.status = "reviewed";
    alias.confidence = 1.0;
    emitRegistryCommandEvent(db, {
      action,
      actorId: sessionWorker.id,
      legacyOrgId: alias.orgId,
      payload: { aliasId: alias.id, masterId: alias.masterId },
    });
    await persistDb(db);
    return noStoreJson({ ok: true, alias });
  }

  if (action === "release_privacy_aggregate") {
    const recipient = sanitizeText(body.recipient, 100);
    const project = sanitizeText(body.project, 120);
    const region = sanitizeText(body.region, 60) || "ALL";
    const epsilon = Number(body.epsilon ?? 0.5);
    if (recipient.length < 2 || project.length < 2) {
      return noStoreJson({ error: "Recipient and project name required." }, { status: 400 });
    }
    const release = executePrivacyGatewayQuery(db, { recipient, project, region, epsilon });
    await persistDb(db);
    return noStoreJson({ ok: true, release });
  }

  if (action === "create_investigation_case") {
    const title = sanitizeText(body.title, 160);
    if (title.length < 4) {
      return noStoreJson({ error: "Case title is too short." }, { status: 400 });
    }
    const category:
      | "counterfeit_diversion"
      | "controlled_drug"
      | "till_anomaly"
      | "escrow_dispute" =
      body.category === "controlled_drug" ||
      body.category === "counterfeit_diversion" ||
      body.category === "escrow_dispute"
        ? body.category
        : "till_anomaly";
    const newCase = {
      id: newId("case"),
      title,
      category,
      status: "investigating" as const,
      severity: "high" as const,
      pinnedEntities: db.accounts.slice(0, 1).map((a) => a.orgName),
      citedEventIds: spine.events.slice(-2).map((e) => e.eventId),
      notes: [],
      createdAt: new Date().toISOString(),
    };
    spine.cases.unshift(newCase);
    emitRegistryCommandEvent(db, {
      action,
      actorId: sessionWorker.id,
      payload: { caseId: newCase.id, category },
    });
    await persistDb(db);
    return noStoreJson({ ok: true, caseRecord: newCase });
  }

  if (action === "add_case_note") {
    const caseId = sanitizeText(body.caseId, 60);
    const noteBody = sanitizeText(body.body, 800);
    const targetCase = spine.cases.find((c) => c.id === caseId);
    if (!targetCase || noteBody.length < 2) {
      return noStoreJson({ error: "Case not found or note too short." }, { status: 400 });
    }
    targetCase.notes.push({
      id: newId("cnote"),
      author: sessionWorker.name,
      body: noteBody,
      createdAt: new Date().toISOString(),
    });
    await persistDb(db);
    return noStoreJson({ ok: true, caseRecord: targetCase });
  }

  if (action === "label_anomaly_alert") {
    const alertId = sanitizeText(body.alertId, 120);
    const rawVerdict = sanitizeText(body.verdict, 30);
    const verdict =
      rawVerdict === "real" || rawVerdict === "false_alarm" || rawVerdict === "known"
        ? rawVerdict
        : null;
    if (!alertId || !verdict) {
      return noStoreJson({ error: "alertId and valid verdict (real | false_alarm | known) are required." }, { status: 400 });
    }
    spine.anomalyVerdicts = { ...(spine.anomalyVerdicts ?? {}), [alertId]: verdict };
    emitRegistryCommandEvent(db, {
      action,
      actorId: sessionWorker.id,
      payload: { alertId, verdict },
    });
    await persistDb(db);
    return noStoreJson({ ok: true, alertId, verdict });
  }

  if (action === "update_health_weights") {
    const numOr = (val: unknown, fallback: number) => {
      const n = Number(val);
      return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : fallback;
    };
    const prev = spine.healthWeights ?? DEFAULT_HEALTH_WEIGHTS;
    const nextWeights = {
      syncRecency: numOr(body.syncRecency, prev.syncRecency),
      salesTrend: numOr(body.salesTrend, prev.salesTrend),
      shiftCompliance: numOr(body.shiftCompliance, prev.shiftCompliance),
      paymentTimeliness: numOr(body.paymentTimeliness, prev.paymentTimeliness),
      ticketAge: numOr(body.ticketAge, prev.ticketAge),
      versionLag: numOr(body.versionLag, prev.versionLag),
    };
    spine.healthWeights = nextWeights;
    emitRegistryCommandEvent(db, {
      action,
      actorId: sessionWorker.id,
      payload: nextWeights,
    });
    await persistDb(db);
    return noStoreJson({ ok: true, healthWeights: nextWeights });
  }

  if (action === "create_proposal_from_model") {
    const kind = sanitizeText(body.kind, 40) === "expiry_rescue" ? "expiry_rescue" : "reorder_draft";
    const branchId = sanitizeText(body.branchId, 100);
    const masterId = sanitizeText(body.masterId, 100);
    const batchId = sanitizeText(body.batchId, 100);
    const nowIso = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();

    if (kind === "reorder_draft") {
      const list = runModel1DemandAndReorder(db);
      const target =
        list.find((r) => (!branchId || r.branchId === branchId) && (!masterId || r.masterId === masterId)) ??
        list[0];
      if (!target) {
        return noStoreJson({ error: "No demand reorder candidate available in database." }, { status: 404 });
      }
      const orderQty = Math.max(10, target.recommendedOrderQty);
      const propId = newId("prop");
      const proposal = {
        id: propId,
        kind: "reorder_draft" as const,
        orgId: target.orgId,
        orgName: target.orgName,
        branchId: target.branchId,
        branchName: target.branchName,
        tool: "send_message",
        args: {
          accountId: target.orgId,
          branchId: target.branchId,
          masterId: target.masterId,
          title: `Reorder Draft: ${target.masterLabel} (${orderQty} units)`,
        },
        why: `${target.masterLabel} at ${target.branchName}: ${target.reason}`,
        evidence: {
          eventRange: `seq 1..${spine.globalSeqCounter}`,
          eventIds: spine.events.slice(-2).map((e) => e.eventId),
          modelVersion: "lgbm-q-v1.3",
          featureSnapshot: `cover=${target.daysOfCover}d, p50=${target.dailyP50}/d, p90=${target.dailyP90}/d`,
        },
        confidence: {
          p10: Math.max(1, Math.round(target.dailyP10 * target.leadTimeDays)),
          p50: Math.max(1, Math.round(target.dailyP50 * target.leadTimeDays)),
          p90: Math.max(1, Math.round(target.dailyP90 * target.leadTimeDays)),
          unit: "units/lead",
        },
        impact: { tzs: orderQty * 4500, units: orderQty, orgsTouched: 1, branchesTouched: 1 },
        reversibility: "reversible" as const,
        status: "proposed" as const,
        createdAt: nowIso,
        expiresAt,
      };
      spine.proposals.unshift(proposal);
      appendSpineEvent(db, {
        legacyOrgId: target.orgId,
        legacyBranchId: target.branchId,
        actorId: sessionWorker.id,
        actorKind: "agent",
        type: "agent.action_proposed",
        idempotencyKey: `model_prop:${propId}`,
        payload: { proposal_id: propId, model: "model_1_demand", qty: orderQty },
        piiClass: "none",
        source: "hq",
      });
      await persistDb(db);
      return noStoreJson({ ok: true, proposal });
    }

    const rescues = runModel2ExpiryAndRescue(db);
    const targetRescue =
      rescues.find((x) => (!batchId || x.batchId === batchId) && (!branchId || x.branchId === branchId)) ??
      rescues[0];
    if (!targetRescue) {
      return noStoreJson({ error: "No expiry rescue candidate available in database." }, { status: 404 });
    }
    const propId = newId("prop");
    const proposal = {
      id: propId,
      kind: "expiry_rescue" as const,
      orgId: targetRescue.orgId,
      orgName: targetRescue.orgName,
      branchId: targetRescue.branchId,
      branchName: targetRescue.branchName,
      tool: "transfer_stock",
      args: {
        batchId: targetRescue.batchId,
        batchNumber: targetRescue.batchNumber,
        rescueOption: targetRescue.recommendedRescue.option,
      },
      why: `${targetRescue.brandName} (${targetRescue.batchNumber}) ${targetRescue.reason} Best action: ${targetRescue.recommendedRescue.label}.`,
      evidence: {
        eventRange: `seq 1..${spine.globalSeqCounter}`,
        eventIds: spine.events.slice(-2).map((e) => e.eventId),
        modelVersion: "fefo-mc-v1.2",
        featureSnapshot: `prob_loss=${targetRescue.probLossPct}%, unsold=${targetRescue.expectedUnsoldUnits}`,
      },
      confidence: {
        p10: Math.round(targetRescue.recommendedRescue.expectedRecoveryTzs * 0.72),
        p50: targetRescue.recommendedRescue.expectedRecoveryTzs,
        p90: Math.round(targetRescue.recommendedRescue.expectedRecoveryTzs * 1.18),
        unit: "TZS",
      },
      impact: {
        tzs: targetRescue.recommendedRescue.expectedRecoveryTzs,
        units: targetRescue.expectedUnsoldUnits,
        orgsTouched: 1,
        branchesTouched: 1,
      },
      reversibility: "reversible" as const,
      status: "proposed" as const,
      createdAt: nowIso,
      expiresAt,
    };
    spine.proposals.unshift(proposal);
    appendSpineEvent(db, {
      legacyOrgId: targetRescue.orgId,
      legacyBranchId: targetRescue.branchId,
      actorId: sessionWorker.id,
      actorKind: "agent",
      type: "agent.action_proposed",
      idempotencyKey: `model_prop:${propId}`,
      payload: { proposal_id: propId, model: "model_2_expiry", batch: targetRescue.batchNumber },
      piiClass: "none",
      source: "hq",
    });
    await persistDb(db);
    return noStoreJson({ ok: true, proposal });
  }

  if (action === "run_red_team_drill") {
    const report = runRedTeamSyntheticDrill(db);
    await persistDb(db);
    return noStoreJson({ ok: true, report });
  }

  emitRegistryCommandEvent(db, {
    action: action || "unknown",
    actorId: sessionWorker.id,
    payload: {},
    failedReason: "Unsupported ops dispatch action",
  });
  return noStoreJson({ error: "Unsupported ops dispatch action." }, { status: 400 });
}
