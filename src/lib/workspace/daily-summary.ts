import { sendTextifySms } from "@/lib/workspace/env";
import { composeEveningMessage, type BranchDay } from "@/lib/workspace/owner-messages";
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

const DAY_MS = 24 * 60 * 60 * 1000;

export async function runDailyOwnerDigest(options?: {
  force?: boolean;
  targetAccountId?: string;
}) {
  await warmDbFromSupabase(true);
  const db = getWorkspaceDb();
  const packages = getWorkspacePackages(db);
  const now = new Date();
  const nowMs = now.getTime();
  const eatDate = new Date(nowMs + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const dayStartMs = Date.parse(`${eatDate}T00:00:00.000+03:00`);
  const senderName = (process.env.TEXTIFY_SENDER_NAME || "Nama").trim() || "Nama";
  const force = Boolean(options?.force);
  const targetAccountId = options?.targetAccountId?.trim() || "";

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
    error?: string;
  }> = [];

  const cutOffAccounts: Array<{ accountId: string; orgName: string; reason: string }> = [];
  const skippedAccounts: Array<{ accountId: string; orgName: string; reason: string }> = [];

  for (const acc of db.accounts) {
    if (targetAccountId && acc.id !== targetAccountId) continue;
    if (
      acc.roleType !== "pharmacy" &&
      acc.roleType !== "supplier" &&
      acc.roleType !== "dispensary" &&
      acc.roleType !== "other"
    ) {
      continue;
    }

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
          actor: "Cervos Evening Update (18:00 EAT)",
          category: "BILLING",
          action: `Evening updates and counter access paused after expiration cutoff (${acc.subscriptionPlan}).`,
        });
      }
      cutOffAccounts.push({ accountId: acc.id, orgName: acc.orgName, reason: lock.reason });
      continue;
    }

    if (!force && !targetAccountId && acc.lastExpiryReminderEatDate === eatDate) {
      skippedAccounts.push({
        accountId: acc.id,
        orgName: acc.orgName,
        reason: `Already dispatched for ${eatDate}`,
      });
      continue;
    }

    const allCentres = db.centres.filter((c) => c.accountId === acc.id);
    const activeCentres = allCentres.filter(
      (c) => c.status !== "paused" && c.status !== "archived" && !c.excludedFromRollup
    );
    const centres =
      activeCentres.length > 0
        ? activeCentres
        : allCentres.length === 0
          ? [
              {
                id: `${acc.id}-primary`,
                accountId: acc.id,
                name: acc.orgName,
                region: acc.region,
                address: acc.region,
                phone: acc.ownerPhone || "",
                isPrimary: true,
                createdAt: acc.createdAt,
              },
            ]
          : [];
    const profiles = db.profiles.filter((p) => p.accountId === acc.id);
    const matchedPkg = findWorkspacePackageMatch(packages, acc.subscriptionPlan);
    const ownerFirstName = (acc.fullName || acc.orgName).trim().split(/\s+/)[0] || acc.orgName;

    const ownerPhone =
      acc.ownerPhone?.trim() ||
      allCentres.find((c) => c.phone?.trim())?.phone?.trim() ||
      "";
    if (ownerPhone && !acc.ownerPhone) {
      acc.ownerPhone = ownerPhone;
    }

    const branchDays: BranchDay[] = centres.map((ctr) => {
      const centreSales = (db.sales ?? []).filter((s) => s.accountId === acc.id && s.centreId === ctr.id);
      const todaySales = centreSales.filter((s) => Date.parse(s.createdAt) >= dayStartMs);
      const yesterdaySales = centreSales.filter((s) => {
        const ms = Date.parse(s.createdAt);
        return ms >= dayStartMs - DAY_MS && ms < dayStartMs;
      });

      const sellerQty = new Map<string, number>();
      for (const sale of todaySales) {
        for (const line of sale.lines ?? []) {
          if (!line.brandName) continue;
          sellerQty.set(line.brandName, (sellerQty.get(line.brandName) ?? 0) + line.qty);
        }
      }
      const topEntry = [...sellerQty.entries()].sort((a, b) => b[1] - a[1])[0];

      const batches = (db.batches ?? []).filter(
        (b) => b.accountId === acc.id && b.centreId === ctr.id && !b.quarantined
      );
      const inStock = batches.filter((b) => b.quantity > 0);
      const expired = inStock
        .filter((b) => Number.isFinite(Date.parse(b.expiryDate)) && Date.parse(b.expiryDate) < nowMs)
        .sort((a, b) => Date.parse(a.expiryDate) - Date.parse(b.expiryDate));
      const expiringSoon = inStock
        .filter((b) => {
          const ms = Date.parse(b.expiryDate);
          return Number.isFinite(ms) && ms >= nowMs && ms <= nowMs + 30 * DAY_MS;
        })
        .sort((a, b) => Date.parse(a.expiryDate) - Date.parse(b.expiryDate));
      const low = batches
        .filter((b) => b.quantity <= (b.lowStockThreshold ?? 15))
        .sort((a, b) => a.quantity - b.quantity);

      const day: BranchDay = {
        name: ctr.name,
        salesCount: todaySales.length,
        revenueTzs: todaySales.reduce((sum, s) => sum + s.totalTzs, 0),
        yesterdayRevenueTzs: yesterdaySales.reduce((sum, s) => sum + s.totalTzs, 0),
        lowStockCount: low.length,
        expiredCount: expired.length,
        expiringSoonCount: expiringSoon.length,
      };
      if (low[0]) day.lowStockTop = low[0].brandName || low[0].genericName;
      if (expired[0]) day.expiredTop = expired[0].brandName || expired[0].genericName;
      if (expiringSoon[0]) {
        day.expiringSoon = {
          name: expiringSoon[0].brandName || expiringSoon[0].genericName,
          days: Math.max(1, Math.ceil((Date.parse(expiringSoon[0].expiryDate) - nowMs) / DAY_MS)),
        };
      }
      if (topEntry) day.topSeller = { name: topEntry[0], qty: topEntry[1] };
      return day;
    });

    if (branchDays.length === 0) {
      skippedAccounts.push({ accountId: acc.id, orgName: acc.orgName, reason: "No active branches" });
      continue;
    }

    const message = composeEveningMessage({
      lang: acc.lang,
      accountId: acc.id,
      firstName: ownerFirstName,
      orgName: acc.orgName,
      eatDate,
      branches: branchDays,
      billing: {
        planName: acc.subscriptionPlan,
        daysLeft: expiryInfo.daysLeft,
        isInGraceDay: expiryInfo.isInGraceDay,
        branchesUsed: allCentres.filter((c) => c.status !== "archived").length,
        maxBranches: matchedPkg?.maxBranches ?? null,
        operatorsUsed: profiles.length,
        maxOperators: matchedPkg?.maxOperators ?? null,
      },
    });

    if (ownerPhone) {
      const res = await sendTextifySms({ to: ownerPhone, message: message.sms, sender: senderName });
      dispatches.push({
        accountId: acc.id,
        orgName: acc.orgName,
        branchId: centres.length === 1 ? centres[0].id : "all",
        branchName: centres.length === 1 ? centres[0].name : `${centres.length} branches`,
        lang: acc.lang,
        to: ownerPhone,
        sender: res.sender,
        channel: res.channel,
        delivered: res.delivered,
        message: message.sms,
        ...(res.error ? { error: res.error } : {}),
      });
    }

    if (force || acc.lastExpiryReminderEatDate !== eatDate) {
      db.notifications ??= [];
      db.notifications.unshift({
        id: newId("ntf"),
        accountId: acc.id,
        centreId: "",
        kind: message.billingNote ? "approval" : "system",
        title: message.inAppTitle,
        body: message.inAppBody,
        read: false,
        createdAt: now.toISOString(),
      });
      acc.lastExpiryReminderEatDate = eatDate;
    }

    appendAuditLog(db, {
      accountId: acc.id,
      actor: "Cervos Evening Update (18:00 EAT)",
      category: "BILLING",
      action: `Sent evening update for ${centres.length} branch(es) in ${acc.lang}${message.billingNote ? " with plan reminder" : ""}${ownerPhone ? "" : " (in-app only, no owner phone)"}`,
    });
  }

  saveWorkspaceDb(db);
  await flushWorkspaceDb();

  return {
    ok: true,
    sender: senderName,
    eatDate,
    dispatchesCount: dispatches.length,
    cutOffCount: cutOffAccounts.length,
    skippedCount: skippedAccounts.length,
    dispatches,
    cutOffAccounts,
    skippedAccounts,
  };
}
