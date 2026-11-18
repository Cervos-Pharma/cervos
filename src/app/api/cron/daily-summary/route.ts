import type { NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { noStoreJson } from "@/lib/workspace/cookies";
import { isValidHqSecret, sendTextifySms } from "@/lib/workspace/env";
import {
  appendAuditLog,
  findWorkspacePackageMatch,
  flushWorkspaceDb,
  getSubscriptionExpiryInfo,
  getWorkspaceDb,
  getWorkspacePackages,
  isAccountAccessLocked,
  newId,
  saveWorkspaceDb,
  warmDbFromSupabase,
} from "@/lib/workspace/store";

export const dynamic = "force-dynamic";

function isAuthorizedCron(request: NextRequest): boolean {
  const opsKey = request.headers.get("x-ops-key") || request.headers.get("x-cervos-hq-secret");
  if (isValidHqSecret(opsKey)) return true;

  const cronSecret = (process.env.CRON_SECRET ?? "").trim();
  const authHeader = request.headers.get("authorization") ?? "";
  if (cronSecret && authHeader.startsWith("Bearer ")) {
    const provided = authHeader.slice(7).trim();
    const a = createHash("sha256").update(provided, "utf8").digest();
    const b = createHash("sha256").update(cronSecret, "utf8").digest();
    if (timingSafeEqual(a, b)) return true;
  }

  return false;
}

function buildPersonalizedBillingReminder(params: {
  lang: "EN" | "SW";
  ownerFirstName: string;
  orgName: string;
  planName: string;
  daysLeft: number | null;
  isInGraceDay: boolean;
  branchesUsed: number;
  maxBranches: number | null;
  operatorsUsed: number;
  maxOperators: number | null;
}): string | null {
  const parts: string[] = [];
  const { lang, ownerFirstName, orgName, planName, daysLeft, isInGraceDay, branchesUsed, maxBranches, operatorsUsed, maxOperators } =
    params;

  if (isInGraceDay) {
    parts.push(
      lang === "SW"
        ? `${ownerFirstName}, kifurushi chako (${planName}) kimeisha leo - lipa usiku huu kupitia cervos.online/app/billing ili huduma na ripoti za ${orgName} zisikatike kesho.`
        : `Hi ${ownerFirstName}, your ${planName} plan expired today - renew tonight at cervos.online/app/billing so ${orgName} counters & evening updates don't pause tomorrow.`
    );
  } else if (daysLeft !== null && daysLeft <= 7) {
    parts.push(
      lang === "SW"
        ? `${ownerFirstName}, zimebaki siku ${daysLeft} kwenye kifurushi chako (${planName}) cha ${orgName} - lipia mapema kupitia cervos.online/app/billing.`
        : `Hi ${ownerFirstName}, ${daysLeft} day${daysLeft === 1 ? "" : "s"} left on your ${planName} plan for ${orgName} - renew anytime at cervos.online/app/billing.`
    );
  }

  const nearBranchCap = maxBranches !== null && branchesUsed >= Math.max(1, maxBranches - 1);
  const nearOpCap = maxOperators !== null && operatorsUsed >= Math.ceil(maxOperators * 0.8);
  if (nearBranchCap || nearOpCap) {
    const limitNote =
      lang === "SW"
        ? `Matumizi ya ${orgName}: matawi ${branchesUsed}/${maxBranches ?? "bila ukomo"}, wafanyakazi ${operatorsUsed}/${maxOperators ?? "bila ukomo"} - pandisha kifurushi kupitia cervos.online/app/billing.`
        : `${orgName} capacity at ${branchesUsed}/${maxBranches ?? "unlimited"} branches, ${operatorsUsed}/${maxOperators ?? "unlimited"} staff - upgrade cleanly at cervos.online/app/billing.`;
    parts.push(limitNote);
  }

  if (parts.length === 0) return null;
  return parts.join(" ");
}

function buildBranchDigestSms(params: {
  lang: "EN" | "SW";
  orgName: string;
  branchName: string;
  dateLabel: string;
  salesCount: number;
  revenueTzs: number;
  nearExpiryCount: number;
  lowStockCount: number;
  personalReminder?: string | null;
}): string {
  const revFmt = Math.round(params.revenueTzs).toLocaleString("en-US");
  const base =
    params.lang === "SW"
      ? `Nama (${params.branchName} · ${params.dateLabel}): Mauzo ${params.salesCount} (TZS ${revFmt}). Zinazokaribia kuisha: ${params.nearExpiryCount}, chini ya kiwango: ${params.lowStockCount}. ${params.orgName}`
      : `Nama (${params.branchName} · ${params.dateLabel}): ${params.salesCount} sales totaling TZS ${revFmt}. Near-expiry lots: ${params.nearExpiryCount}, low stock: ${params.lowStockCount}. ${params.orgName}`;
  if (!params.personalReminder) return base;
  return `${base} | ${params.personalReminder}`.slice(0, 480);
}

/**
 * Automated Daily 18:00 EAT Summary SMS + In-App Digest Job (`0 15 * * *` UTC).
 * Dispatches one concise, owner-preferred-language (EN/SW) branch summary
 * via Textify under Sender Name "Nama" AND mirrors the same update + personalized
 * expiry/capacity reminders into the org's in-app notifications.
 * Cuts off automatically on the day after subscription expiration.
 */
async function runDailyDigest(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return noStoreJson({ error: "Unauthorized cron trigger." }, { status: 401 });
  }

  await warmDbFromSupabase(true);
  const db = getWorkspaceDb();
  const packages = getWorkspacePackages(db);
  const now = new Date();
  const nowMs = now.getTime();
  const eatDate = new Date(nowMs + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const dayStartMs = Date.parse(`${eatDate}T00:00:00.000+03:00`);
  const nearCutoffMs = nowMs + 90 * 24 * 60 * 60 * 1000;

  const dispatches: Array<{
    accountId: string;
    orgName: string;
    branchId: string;
    branchName: string;
    lang: "EN" | "SW";
    to: string;
    sender: string;
    channel: string;
    delivered: boolean;
    message: string;
  }> = [];

  const cutOffAccounts: Array<{ accountId: string; orgName: string; reason: string }> = [];

  for (const acc of db.accounts) {
    if (acc.roleType !== "pharmacy" && acc.roleType !== "supplier") continue;

    const lock = isAccountAccessLocked(acc);
    const expiryInfo = getSubscriptionExpiryInfo(acc, nowMs);
    if (lock.locked || expiryInfo.isCutOff) {
      if (expiryInfo.isCutOff && !acc.billingOverdue) {
        acc.billingOverdue = true;
        db.notifications ??= [];
        db.notifications.unshift({
          id: newId("ntf"),
          accountId: acc.id,
          centreId: "",
          kind: "approval",
          title:
            acc.lang === "SW"
              ? `Kifurushi Kimekatika: ${acc.orgName}`
              : `Subscription Paused: ${acc.orgName}`,
          body: lock.reason,
          read: false,
          createdAt: now.toISOString(),
        });
        appendAuditLog(db, {
          accountId: acc.id,
          actor: "Nama Daily Cron (18:00 EAT)",
          category: "BILLING",
          action: `Evening updates and counter access paused after expiration cutoff (${acc.subscriptionPlan}).`,
        });
      }
      cutOffAccounts.push({ accountId: acc.id, orgName: acc.orgName, reason: lock.reason });
      continue;
    }

    const centres = db.centres.filter((c) => c.accountId === acc.id);
    const profiles = db.profiles.filter((p) => p.accountId === acc.id);
    const matchedPkg = findWorkspacePackageMatch(packages, acc.subscriptionPlan);
    const ownerFirstName = (acc.fullName || acc.orgName).trim().split(/\s+/)[0] || acc.orgName;
    const personalReminder = buildPersonalizedBillingReminder({
      lang: acc.lang,
      ownerFirstName,
      orgName: acc.orgName,
      planName: acc.subscriptionPlan,
      daysLeft: expiryInfo.daysLeft,
      isInGraceDay: expiryInfo.isInGraceDay,
      branchesUsed: centres.length,
      maxBranches: matchedPkg?.maxBranches ?? null,
      operatorsUsed: profiles.length,
      maxOperators: matchedPkg?.maxOperators ?? null,
    });

    const ownerPhone =
      acc.ownerPhone?.trim() ||
      centres.find((c) => c.phone?.trim())?.phone?.trim() ||
      "";

    const branchLinesForInApp: string[] = [];

    for (let idx = 0; idx < centres.length; idx++) {
      const ctr = centres[idx];
      const branchSales = (db.sales ?? []).filter(
        (s) =>
          s.accountId === acc.id &&
          s.centreId === ctr.id &&
          Date.parse(s.createdAt) >= dayStartMs
      );
      const revenueTzs = branchSales.reduce((sum, s) => sum + s.totalTzs, 0);

      const branchBatches = (db.batches ?? []).filter(
        (b) => b.accountId === acc.id && b.centreId === ctr.id
      );
      const nearExpiryCount = branchBatches.filter((b) => {
        const ms = Date.parse(b.expiryDate);
        return Number.isFinite(ms) && ms <= nearCutoffMs && b.quantity > 0;
      }).length;
      const lowStockCount = branchBatches.filter(
        (b) => b.quantity <= (b.lowStockThreshold ?? 15)
      ).length;

      branchLinesForInApp.push(
        acc.lang === "SW"
          ? `${ctr.name}: Mauzo ${branchSales.length} (TZS ${Math.round(revenueTzs).toLocaleString("en-US")}), karibu kuisha ${nearExpiryCount}, chini ya kiwango ${lowStockCount}`
          : `${ctr.name}: ${branchSales.length} sales (TZS ${Math.round(revenueTzs).toLocaleString("en-US")}), near-expiry ${nearExpiryCount}, low stock ${lowStockCount}`
      );

      if (!ownerPhone) continue;

      const msg = buildBranchDigestSms({
        lang: acc.lang,
        orgName: acc.orgName,
        branchName: ctr.name,
        dateLabel: eatDate,
        salesCount: branchSales.length,
        revenueTzs,
        nearExpiryCount,
        lowStockCount,
        personalReminder: idx === 0 ? personalReminder : null,
      });

      const res = await sendTextifySms({
        to: ownerPhone,
        message: msg,
        sender: "Nama",
      });

      dispatches.push({
        accountId: acc.id,
        orgName: acc.orgName,
        branchId: ctr.id,
        branchName: ctr.name,
        lang: acc.lang,
        to: ownerPhone,
        sender: res.sender,
        channel: res.channel,
        delivered: res.delivered,
        message: msg,
      });
    }

    // Mirror exact evening update + personalized reminder inside the app (once per EAT day)
    if (acc.lastExpiryReminderEatDate !== eatDate) {
      db.notifications ??= [];
      if (branchLinesForInApp.length > 0) {
        db.notifications.unshift({
          id: newId("ntf"),
          accountId: acc.id,
          centreId: "",
          kind: "system",
          title:
            acc.lang === "SW"
              ? `Muhtasari wa Jioni (${eatDate})`
              : `Evening Update (${eatDate})`,
          body: `${branchLinesForInApp.join(" · ")}${personalReminder ? ` — ${personalReminder}` : ""}`,
          read: false,
          createdAt: now.toISOString(),
        });
      } else if (personalReminder) {
        db.notifications.unshift({
          id: newId("ntf"),
          accountId: acc.id,
          centreId: "",
          kind: "approval",
          title:
            acc.lang === "SW"
              ? `Ukumbusho wa Kifurushi (${acc.subscriptionPlan})`
              : `Personal Renewal Reminder (${acc.subscriptionPlan})`,
          body: personalReminder,
          read: false,
          createdAt: now.toISOString(),
        });
      }
      acc.lastExpiryReminderEatDate = eatDate;
    }

    appendAuditLog(db, {
      accountId: acc.id,
      actor: "Nama Daily Cron (18:00 EAT)",
      category: "BILLING",
      action: `Dispatched ${centres.length} daily branch summary update(s) in ${acc.lang}${personalReminder ? " with personalized billing reminder" : ""}`,
    });
  }

  saveWorkspaceDb(db);
  await flushWorkspaceDb();

  return noStoreJson({
    ok: true,
    sender: "Nama",
    eatDate,
    dispatchesCount: dispatches.length,
    cutOffCount: cutOffAccounts.length,
    dispatches,
    cutOffAccounts,
  });
}

export async function GET(request: NextRequest) {
  return runDailyDigest(request);
}

export async function POST(request: NextRequest) {
  return runDailyDigest(request);
}
