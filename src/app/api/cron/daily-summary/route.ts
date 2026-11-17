import type { NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { noStoreJson } from "@/lib/workspace/cookies";
import { isValidHqSecret, sendTextifySms } from "@/lib/workspace/env";
import { appendAuditLog, getWorkspaceDb, saveWorkspaceDb } from "@/lib/workspace/store";

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

function buildBranchDigestSms(params: {
  lang: "EN" | "SW";
  orgName: string;
  branchName: string;
  dateLabel: string;
  salesCount: number;
  revenueTzs: number;
  nearExpiryCount: number;
  lowStockCount: number;
}): string {
  const revFmt = Math.round(params.revenueTzs).toLocaleString("en-US");
  if (params.lang === "SW") {
    return (
      `Nama (${params.branchName} · ${params.dateLabel}): ` +
      `Mauzo ${params.salesCount} (TZS ${revFmt}). ` +
      `Zinazokaribia kuisha: ${params.nearExpiryCount}, chini ya kiwango: ${params.lowStockCount}. ` +
      `${params.orgName}`
    );
  }
  return (
    `Nama (${params.branchName} · ${params.dateLabel}): ` +
    `${params.salesCount} sales totaling TZS ${revFmt}. ` +
    `Near-expiry lots: ${params.nearExpiryCount}, low stock: ${params.lowStockCount}. ` +
    `${params.orgName}`
  );
}

/**
 * Automated Daily 18:00 EAT Summary SMS Job (`0 15 * * *` UTC).
 * Dispatches one concise, owner-preferred-language (EN/SW) branch summary
 * via Textify under Sender Name "Nama" to each pharmacy owner.
 */
async function runDailyDigest(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return noStoreJson({ error: "Unauthorized cron trigger." }, { status: 401 });
  }

  const db = getWorkspaceDb();
  const now = new Date();
  const eatDate = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const dayStartMs = Date.parse(`${eatDate}T00:00:00.000+03:00`);
  const nearCutoffMs = now.getTime() + 90 * 24 * 60 * 60 * 1000;

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

  for (const acc of db.accounts) {
    if (acc.roleType !== "pharmacy") continue;
    const centres = db.centres.filter((c) => c.accountId === acc.id);
    const ownerPhone =
      acc.ownerPhone?.trim() ||
      centres.find((c) => c.phone?.trim())?.phone?.trim() ||
      "";
    if (!ownerPhone) continue;

    for (const ctr of centres) {
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

      const msg = buildBranchDigestSms({
        lang: acc.lang,
        orgName: acc.orgName,
        branchName: ctr.name,
        dateLabel: eatDate,
        salesCount: branchSales.length,
        revenueTzs,
        nearExpiryCount,
        lowStockCount,
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

    appendAuditLog(db, {
      accountId: acc.id,
      actor: "Nama Daily Cron (18:00 EAT)",
      category: "BILLING",
      action: `Dispatched ${centres.length} daily branch SMS summary digest(s) in ${acc.lang}`,
    });
  }

  saveWorkspaceDb(db);

  return noStoreJson({
    ok: true,
    sender: "Nama",
    eatDate,
    dispatchesCount: dispatches.length,
    dispatches,
  });
}

export async function GET(request: NextRequest) {
  return runDailyDigest(request);
}

export async function POST(request: NextRequest) {
  return runDailyDigest(request);
}
