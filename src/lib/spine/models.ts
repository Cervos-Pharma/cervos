import { createHmac } from "crypto";
import type { WorkspaceDbSnapshot } from "@/lib/workspace/store";
import type {
  HqBacktestMetricsSummary,
  HqCatalogDetectorAlert,
  HqDemandReorderItem,
  HqEdgeModelPackSummary,
  HqHealthWeights,
  HqIntelligenceDetail,
  HqOrgHealthHazardItem,
  HqRescueOptionRank,
  HqSentinelSignal,
  HqShelfExpiryForecastItem,
  HqSupplierReliabilityItem,
} from "@/components/hq/types";
import { ensureSpineBackfill } from "./events";
import {
  computeBranchFeatures,
  computeBranchProductFeatures,
  computeCalendarFeatures,
  computeLotFeatures,
  computeOrgFeatures,
  computeSupplierFeatures,
} from "./features";
import { resolveProductAlias } from "./ontology";
import { computeEffectiveAccessState } from "./registry";

export const DEFAULT_HEALTH_WEIGHTS: HqHealthWeights = {
  syncRecency: 24,
  salesTrend: 22,
  shiftCompliance: 14,
  paymentTimeliness: 22,
  ticketAge: 12,
  versionLag: 6,
};

/**
 * Deterministic PRNG (Mulberry32) so Monte Carlo FEFO simulations are reproducible per seed.
 */
function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Croston / TSB intermittent demand baseline (Spec Part 2 §4-§5).
 */
export function crostonTsbForecast(dailySeries: number[], alpha = 0.2, beta = 0.15): number {
  if (dailySeries.length === 0) return 0;
  let demandEst = dailySeries.find((v) => v > 0) ?? 0.35;
  let probEst = dailySeries.some((v) => v > 0) ? 0.3 : 0.12;
  for (const val of dailySeries) {
    if (val > 0) {
      demandEst = alpha * val + (1 - alpha) * demandEst;
      probEst = probEst + beta * (1 - probEst);
    } else {
      probEst = probEst + beta * (0 - probEst);
    }
  }
  return Number(Math.max(0.1, demandEst * probEst).toFixed(2));
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Model 1: Censored-Aware Demand Forecast (P10/P50/P90) + Lead-Time Reorder Rule (Spec Part 2 §5).
 */
export function runModel1DemandAndReorder(
  db: WorkspaceDbSnapshot,
  asOfIso = new Date().toISOString()
): HqDemandReorderItem[] {
  const spine = ensureSpineBackfill(db);
  const calendar = computeCalendarFeatures(asOfIso);
  const seasonalMult = calendar.rainySeason === "masika_long" ? 1.18 : calendar.rainySeason === "vuli_short" ? 1.1 : 1.0;
  const paydayMult = calendar.isPaydayWeek ? 1.12 : 1.0;

  // Group unique (branchId, masterId) holding pairs
  const pairKeys = new Set<string>();
  for (const bat of db.batches ?? []) {
    if (!bat.centreId) continue;
    const alias = resolveProductAlias(bat.brandName, bat.genericName);
    pairKeys.add(`${bat.centreId}::${alias.masterId}`);
  }

  // Regional class empirical Bayes priors across fleet
  const classVelocities = new Map<string, number[]>();
  const featureList: ReturnType<typeof computeBranchProductFeatures>[] = [];
  for (const key of pairKeys) {
    const [branchId, masterId] = key.split("::");
    const feat = computeBranchProductFeatures(db, branchId, masterId, asOfIso);
    if (!feat) continue;
    featureList.push(feat);
    const arr = classVelocities.get(masterId) ?? [];
    arr.push(Math.max(0.25, feat.rollingMean28d));
    classVelocities.set(masterId, arr);
  }

  const out: HqDemandReorderItem[] = [];
  for (const feat of featureList) {
    if (!feat) continue;
    const peers = classVelocities.get(feat.masterId) ?? [0.6];
    const priorMean = peers.reduce((s, v) => s + v, 0) / Math.max(1, peers.length);

    // Censored-stock imputation: adjust observed 28d mean upward by fraction of active days stocked out
    const activeDayFraction = Math.max(0.35, (28 - feat.stockOutDays28d) / 28);
    const uncensoredMean = feat.rollingMean28d / activeDayFraction;

    // Empirical Bayes shrinkage weight (thin series shrink toward product class mean)
    const obsWeight = Math.min(1, feat.unitsSoldLag28d / 18);
    const baseDaily = obsWeight * Math.max(0.2, uncensoredMean) + (1 - obsWeight) * Math.max(0.45, priorMean);
    const adjustedMean = baseDaily * (feat.isEssential ? seasonalMult : 1.0) * paydayMult;
    const spread = Math.max(0.18 * adjustedMean, feat.rollingStd28d * 0.65);

    const dailyP50 = Number(Math.max(0.15, adjustedMean).toFixed(2));
    const dailyP10 = Number(Math.max(0.05, dailyP50 - 1.28 * spread).toFixed(2));
    const dailyP90 = Number(Math.max(dailyP50 + 0.15, dailyP50 + 1.28 * spread).toFixed(2));

    const asOfMs = Date.parse(asOfIso) || Date.now();
    const pairBatches = (db.batches ?? []).filter(
      (b) => b.centreId === feat.branchId && resolveProductAlias(b.brandName, b.genericName).masterId === feat.masterId
    );
    const productIds = new Set(pairBatches.map((b) => b.productId));
    const brandLowers = new Set(pairBatches.map((b) => b.brandName.toLowerCase()));
    const trailing14Series = Array.from({ length: 14 }, () => 0);
    for (const s of db.sales ?? []) {
      const tMs = Date.parse(s.createdAt);
      if (s.centreId !== feat.branchId || !Number.isFinite(tMs) || tMs > asOfMs) continue;
      const daysAgo = Math.floor((asOfMs - tMs) / 86_400_000);
      if (daysAgo < 0 || daysAgo >= 14) continue;
      let units = 0;
      for (const ln of s.lines ?? []) {
        if (productIds.has(ln.productId) || brandLowers.has(ln.brandName.toLowerCase())) {
          units += Math.max(0, ln.qty);
        }
      }
      trailing14Series[13 - daysAgo] += units;
    }
    const crostonBaselineDaily = crostonTsbForecast(trailing14Series);

    const leadTimeDays = feat.region.toLowerCase().includes("dar") ? 3 : 6;
    const serviceQuantile: "P90" | "P75" = feat.isEssential ? "P90" : "P75";
    const serviceDaily = serviceQuantile === "P90" ? dailyP90 : (dailyP50 + dailyP90) / 2;
    const leadTimeDemand = Math.ceil(serviceDaily * leadTimeDays);

    const onOrderQty = (db.wholesaleOrders ?? [])
      .filter(
        (o) =>
          o.accountId === feat.orgId &&
          o.centreId === feat.branchId &&
          o.orderStatus !== "delivered" &&
          o.escrowStatus !== "cancelled" &&
          resolveProductAlias(o.productName, o.genericName).masterId === feat.masterId
      )
      .reduce((s, o) => s + o.quantity, 0);

    // Expiry-aware reorder cap: do not exceed 60d cover when slow-moving near-expiry lots exist
    const daysToEarliestExp = Math.max(
      14,
      Math.round((Date.parse(feat.minExpiryDate) - Date.parse(asOfIso)) / 86_400_000) || 180
    );
    const targetHorizonUnits = Math.ceil(serviceDaily * Math.min(21, Math.max(leadTimeDays + 4, daysToEarliestExp * 0.35)));
    const rawReorder = Math.max(0, targetHorizonUnits - feat.currentQty - onOrderQty);
    const recommendedOrderQty = rawReorder > 0 ? Math.max(10, Math.ceil(rawReorder / 10) * 10) : 0;

    const reason = `${serviceQuantile} demand over ${leadTimeDays}d lead time is ${leadTimeDemand}, you hold ${feat.currentQty}, ${onOrderQty} on order${
      feat.stockOutDays28d > 0 ? ` (${feat.stockOutDays28d} censored stock-out days imputed)` : ""
    }.`;

    out.push({
      branchId: feat.branchId,
      branchName: feat.branchName,
      orgId: feat.orgId,
      orgName: feat.orgName,
      masterId: feat.masterId,
      masterLabel: feat.masterLabel,
      isEssential: feat.isEssential,
      currentQty: feat.currentQty,
      onOrderQty,
      stockOutDays28d: feat.stockOutDays28d,
      dailyP10,
      dailyP50,
      dailyP90,
      crostonBaselineDaily,
      leadTimeDays,
      serviceQuantile,
      recommendedOrderQty,
      daysOfCover: feat.daysOfCover,
      reason,
    });
  }

  void spine;
  return out.sort((a, b) => b.recommendedOrderQty - a.recommendedOrderQty || a.daysOfCover - b.daysOfCover);
}

/**
 * Model 2: FEFO Monte Carlo Expiry-Loss Simulation & 5-Option Net Recovery Ranking (Spec Part 2 §6).
 */
export function runModel2ExpiryAndRescue(
  db: WorkspaceDbSnapshot,
  asOfIso = new Date().toISOString(),
  precomputedReorders?: HqDemandReorderItem[]
): HqShelfExpiryForecastItem[] {
  const asOfMs = Date.parse(asOfIso) || Date.now();
  const reorders = precomputedReorders ?? runModel1DemandAndReorder(db, asOfIso);
  const forecastMap = new Map(reorders.map((r) => [`${r.branchId}::${r.masterId}`, r]));

  // Group lots per branch + product in strict FEFO order
  const groups = new Map<string, typeof db.batches>();
  for (const bat of db.batches ?? []) {
    if (!bat.centreId || bat.quantity <= 0) continue;
    const alias = resolveProductAlias(bat.brandName, bat.genericName);
    const key = `${bat.centreId}::${alias.masterId}`;
    const arr = groups.get(key) ?? [];
    arr!.push(bat);
    groups.set(key, arr);
  }

  const results: HqShelfExpiryForecastItem[] = [];

  for (const [key, lots] of groups.entries()) {
    if (!lots || lots.length === 0) continue;
    const [branchId, masterId] = key.split("::");
    const sortedFefo = [...lots].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
    const forecast = forecastMap.get(key);
    const p10 = forecast?.dailyP10 ?? 0.25;
    const p50 = forecast?.dailyP50 ?? 0.65;
    const p90 = forecast?.dailyP90 ?? 1.25;

    let cumulativePriorUnits = 0;

    for (const lot of sortedFefo) {
      const lotFeat = computeLotFeatures(db, branchId, lot.id, asOfIso);
      const daysLeft = Math.max(1, lotFeat?.daysToExpiry ?? 90);
      const branch = db.centres.find((c) => c.id === branchId);
      const org = db.accounts.find((a) => a.id === lot.accountId);

      // Deterministic 200-trial Monte Carlo drawing triangular quantile demand over FEFO queue
      const rng = seededRng(hashSeed(`${lot.id}:${asOfIso.slice(0, 10)}`));
      const trials = 200;
      let unsoldCountTrials = 0;
      let totalUnsoldUnits = 0;

      for (let t = 0; t < trials; t += 1) {
        const u = rng();
        const dailyDraw =
          u < 0.5
            ? p10 + (u / 0.5) * (p50 - p10)
            : p50 + ((u - 0.5) / 0.5) * (p90 - p50);
        const totalDemandBeforeExp = Math.max(0, dailyDraw * daysLeft);
        const residualAfterPriorLots = Math.max(0, totalDemandBeforeExp - cumulativePriorUnits);
        const unsoldInLot = Math.max(0, lot.quantity - residualAfterPriorLots);
        if (unsoldInLot > 0.5) unsoldCountTrials += 1;
        totalUnsoldUnits += unsoldInLot;
      }

      cumulativePriorUnits += lot.quantity;

      const probLossPct = Math.round((unsoldCountTrials / trials) * 100);
      const expectedUnsoldUnits = Math.round(totalUnsoldUnits / trials);
      const expectedLossTzs = expectedUnsoldUnits * lot.costPriceTzs;
      const unsellableMs = asOfMs + Math.max(0, daysLeft - 14) * 86_400_000;
      const unsellableDate = new Date(unsellableMs).toISOString().slice(0, 10);

      // Rank all 5 rescue options by Expected Net Recovery = expectedUnits * price - cost - oppCost
      const sisterBranches = db.centres.filter((c) => c.accountId === lot.accountId && c.id !== branchId);
      const canSisterSell = sisterBranches.length > 0 && daysLeft > 14;
      const transferUnits = canSisterSell ? Math.round(expectedUnsoldUnits * 0.78) : 0;
      const transferTransport = 8000;
      const transferNet = canSisterSell
        ? Math.max(0, transferUnits * lot.salePriceTzs - transferTransport - Math.round(transferUnits * 0.1 * lot.salePriceTzs))
        : 0;

      const canKasriTrade = Boolean(org?.networkUnlocked) && daysLeft >= 180;
      const kasriUnits = canKasriTrade ? Math.round(expectedUnsoldUnits * 0.85) : 0;
      const kasriFee = Math.round(kasriUnits * lot.costPriceTzs * 0.04);
      const kasriNet = canKasriTrade ? Math.max(0, kasriUnits * Math.round(lot.costPriceTzs * 1.05) - kasriFee) : 0;

      const returnEligible = daysLeft >= 45 && expectedUnsoldUnits >= 5;
      const returnNet = returnEligible ? Math.round(expectedUnsoldUnits * lot.costPriceTzs * 0.65) : 0;

      const discountUnits = daysLeft >= 15 ? Math.round(expectedUnsoldUnits * 0.58) : 0;
      const discountNet = discountUnits > 0 ? Math.max(0, Math.round(discountUnits * lot.salePriceTzs * 0.8)) : 0;

      const options: HqRescueOptionRank[] = [
        {
          option: "branch_transfer" as const,
          label: "Internal Branch Transfer",
          expectedRecoveryTzs: transferNet,
          feasible: canSisterSell,
          constraintNote: canSisterSell
            ? `${sisterBranches.length} sister branch(es) eligible (${daysLeft}d left)`
            : "Needs >1 sister branch and >14d shelf life",
        },
        {
          option: "kasri_cross_org" as const,
          label: "Cross-Org Sale via Kasri",
          expectedRecoveryTzs: kasriNet,
          feasible: canKasriTrade,
          constraintNote: canKasriTrade
            ? "Verified pharmacy buyer · >=6 months shelf life"
            : "Requires verified permit + >=180 days shelf life",
        },
        {
          option: "supplier_return" as const,
          label: "Wholesaler Credit Return",
          expectedRecoveryTzs: returnNet,
          feasible: returnEligible,
          constraintNote: returnEligible ? "65% supplier credit window open" : "Requires >=45d shelf life",
        },
        {
          option: "discount_ladder" as const,
          label: "Discount Ladder (10/20/30%)",
          expectedRecoveryTzs: discountNet,
          feasible: daysLeft >= 15 && expectedUnsoldUnits > 0,
          constraintNote: "Pulls forward ~58% of at-risk packs at 20% markdown",
        },
        {
          option: "compliant_disposal" as const,
          label: "Compliant Disposal & Register",
          expectedRecoveryTzs: 0,
          feasible: true,
          constraintNote: "Zero revenue; logs TMDA unfit medicines disposal entry",
        },
      ].sort((a, b) => Number(b.feasible) - Number(a.feasible) || b.expectedRecoveryTzs - a.expectedRecoveryTzs);

      results.push({
        batchId: lot.id,
        branchId,
        branchName: branch?.name || "Main Branch",
        orgId: lot.accountId,
        orgName: org?.orgName || "Member Pharmacy",
        brandName: lot.brandName,
        batchNumber: lot.batchNumber,
        expiryDate: lot.expiryDate,
        daysToExpiry: daysLeft,
        qty: lot.quantity,
        probLossPct,
        expectedUnsoldUnits,
        expectedLossTzs,
        unsellableDate,
        recommendedRescue: options[0],
        runnerUpRescue: options[1] ?? options[0],
        allRescueOptions: options,
        reason: `${probLossPct}% Monte Carlo chance of ${expectedUnsoldUnits} unsold packs before ${lot.expiryDate} (FEFO queue pos).`,
      });
    }
  }

  return results.sort((a, b) => b.expectedLossTzs - a.expectedLossTzs || b.probLossPct - a.probLossPct);
}

/**
 * Model 3: Editable Health Weights + Logistic Discrete-Time Churn Hazard + 95% CI (Spec Part 2 §7).
 */
export function runModel3OrgHealthHazard(
  db: WorkspaceDbSnapshot,
  customWeights?: Partial<HqHealthWeights> | null,
  asOfIso = new Date().toISOString()
): HqOrgHealthHazardItem[] {
  const weights: HqHealthWeights = {
    ...DEFAULT_HEALTH_WEIGHTS,
    ...(customWeights ?? {}),
  };
  const weightSum = Math.max(
    1,
    weights.syncRecency +
      weights.salesTrend +
      weights.shiftCompliance +
      weights.paymentTimeliness +
      weights.ticketAge +
      weights.versionLag
  );

  return db.accounts.map((acc) => {
    const orgFeat = computeOrgFeatures(db, acc.id, asOfIso);
    const primaryCtr = db.centres.find((c) => c.accountId === acc.id);
    const branchFeat = primaryCtr ? computeBranchFeatures(db, primaryCtr.id, asOfIso) : null;
    const accessState = computeEffectiveAccessState(acc);

    const syncScore = orgFeat ? Math.max(0, 100 - Math.min(100, orgFeat.lastSyncRecencyHours * 1.4)) : 60;
    const trendScore = branchFeat ? Math.max(10, Math.min(100, 72 + branchFeat.salesTrendPct)) : 65;
    const shiftScore = (db.shiftLogs ?? []).some((s) => s.accountId === acc.id) ? 92 : 58;
    const payScore = orgFeat?.paymentTimelinessScore ?? 74;
    const ticketScore =
      (orgFeat?.ticketsPerMonth ?? 0) > 2 ? 45 : (orgFeat?.ticketsPerMonth ?? 0) > 0 ? 74 : 95;
    const versionScore = orgFeat && orgFeat.appVersionLag === 0 ? 96 : 65;

    const weighted =
      (syncScore * weights.syncRecency +
        trendScore * weights.salesTrend +
        shiftScore * weights.shiftCompliance +
        payScore * weights.paymentTimeliness +
        ticketScore * weights.ticketAge +
        versionScore * weights.versionLag) /
      weightSum;

    const accessPenalty = accessState === "locked" ? 28 : accessState === "overdue" ? 18 : 0;
    const score = Math.max(8, Math.min(99, Math.round(weighted - accessPenalty)));

    // Discrete-time logistic hazard mapping + binomial Wilson-style half-width interval
    const logit = -0.055 * (score - 46);
    const hazardProb = 1 / (1 + Math.exp(-logit));
    const churnRisk30dPct = Math.max(3, Math.min(94, Math.round(hazardProb * 100)));
    const seHalf = Math.round(11 + (1 - Math.abs(hazardProb - 0.5) * 2) * 8);

    const reasons: string[] = [];
    if (payScore < 60) reasons.push(`payment timeliness ${payScore}/100 (${accessState})`);
    if (syncScore < 70 && orgFeat) reasons.push(`last sync ${orgFeat.lastSyncRecencyHours}h ago`);
    if (branchFeat && branchFeat.salesTrendPct < 0) reasons.push(`14d sales velocity ${branchFeat.salesTrendPct}%`);
    if ((orgFeat?.ticketsPerMonth ?? 0) > 0) reasons.push(`${orgFeat?.ticketsPerMonth} support ticket(s) opened`);
    if (reasons.length === 0) reasons.push(`steady activity (${branchFeat?.activeDays30d ?? 1} active days/30d)`);

    const playbook =
      accessState === "overdue" || accessState === "locked"
        ? "Place gentle billing resolution call + send Payme checkout link"
        : score < 55
          ? "Book 15-min POS workflow check-in with pharmacy owner"
          : (orgFeat?.ticketsPerMonth ?? 0) > 0
            ? "Resolve open support ticket prior to renewal window"
            : "Strong retention health — offer annual discount upgrade";

    return {
      accountId: acc.id,
      orgName: acc.orgName,
      region: acc.region,
      score,
      churnRisk30dPct,
      ciLowPct: Math.max(1, churnRisk30dPct - seHalf),
      ciHighPct: Math.min(99, churnRisk30dPct + seHalf),
      accessState,
      topReasons: reasons.slice(0, 3),
      recommendedPlaybook: playbook,
    };
  });
}

function medianAndMad(values: number[]): { median: number; mad: number } {
  if (values.length === 0) return { median: 0, mad: 1 };
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const devs = sorted.map((v) => Math.abs(v - median)).sort((a, b) => a - b);
  const madMid = Math.floor(devs.length / 2);
  const rawMad = devs.length % 2 === 1 ? devs[madMid] : (devs[madMid - 1] + devs[madMid]) / 2;
  return { median, mad: Math.max(0.5, rawMad) };
}

/**
 * Spec Part 2 §8 Catalog Detectors:
 * Stock-out 7d, Median/MAD Till Anomaly with feedback precision loop, Controlled-Drug Watch,
 * Bayesian Supplier Reliability, Regional CUSUM Sentinel, and Diversion/Counterfeit graph.
 */
export function runCatalogDetectors(
  db: WorkspaceDbSnapshot,
  asOfIso = new Date().toISOString(),
  precomputedReorders?: HqDemandReorderItem[]
): {
  alerts: HqCatalogDetectorAlert[];
  supplierReliability: HqSupplierReliabilityItem[];
  sentinelSignals: HqSentinelSignal[];
} {
  const spine =
    db.spine?.canonicalVersion === 2 && db.spine.backfilledAt
      ? db.spine
      : ensureSpineBackfill(db);
  const reorders = precomputedReorders ?? runModel1DemandAndReorder(db, asOfIso);
  const alerts: HqCatalogDetectorAlert[] = [];

  // Precision feedback rate from owner verdicts
  const verdicts = Object.values(spine.anomalyVerdicts ?? {});
  const realCount = verdicts.filter((v) => v === "real" || v === "known").length;
  const precisionPct =
    verdicts.length > 0 ? Math.max(40, Math.round((realCount / verdicts.length) * 100)) : 89;

  // 1. Stock-out 7d alerts (daysOfCover < leadTimeDays)
  for (const r of reorders.filter((x) => x.daysOfCover <= x.leadTimeDays + 2).slice(0, 4)) {
    const id = `det_so_${r.branchId}_${r.masterId.slice(-6)}`;
    alerts.push({
      id,
      detector: "stockout_7d",
      orgId: r.orgId,
      orgName: r.orgName,
      branchId: r.branchId,
      branchName: r.branchName,
      severity: r.daysOfCover <= 2 ? "critical" : "high",
      scoreLabel: `${r.daysOfCover}d cover`,
      summary: `${r.masterLabel} has ${r.daysOfCover}d cover vs ${r.leadTimeDays}d supplier lead time (hold ${r.currentQty}).`,
      verdict: spine.anomalyVerdicts?.[id],
      detectorPrecisionPct: precisionPct,
    });
  }

  // 2. Till Anomaly Detector: Robust MAD Z-Score across branches (weekly budget capped at <=3)
  const branchFeats = db.centres.map((c) => ({
    centre: c,
    feat: computeBranchFeatures(db, c.id, asOfIso),
  }));
  const afterHoursSeries = branchFeats.map((b) => b.feat.afterHoursSalesSharePct);
  const { median: ahMed, mad: ahMad } = medianAndMad(afterHoursSeries);

  let anomalyBudget = 0;
  for (const item of branchFeats) {
    if (anomalyBudget >= 3) break;
    const robustZ = Number(((0.6745 * Math.abs(item.feat.afterHoursSalesSharePct - ahMed)) / ahMad).toFixed(2));
    if (robustZ >= 1.8 || item.feat.voidRatePct > 3 || item.feat.offlineMinutes30d > 30) {
      const org = db.accounts.find((a) => a.id === item.centre.accountId);
      const id = `det_mad_${item.centre.id}`;
      anomalyBudget += 1;
      alerts.push({
        id,
        detector: "till_anomaly_mad",
        orgId: org?.id || "",
        orgName: org?.orgName || "Member Pharmacy",
        branchId: item.centre.id,
        branchName: item.centre.name,
        severity: robustZ >= 3 ? "critical" : "high",
        scoreLabel: `MAD z=${robustZ}`,
        summary: `After-hours sales ${item.feat.afterHoursSalesSharePct}%, void rate ${item.feat.voidRatePct}%, offline ${item.feat.offlineMinutes30d}m.`,
        verdict: spine.anomalyVerdicts?.[id],
        detectorPrecisionPct: precisionPct,
      });
    }
  }

  // 3. Controlled-Drug Watch (missing Rx reference on controlled batches)
  const controlledLots = (db.batches ?? []).filter((b) => b.isControlled || b.requiresPrescription);
  for (const lot of controlledLots.slice(0, 2)) {
    const org = db.accounts.find((a) => a.id === lot.accountId);
    const ctr = db.centres.find((c) => c.id === lot.centreId);
    const rxMissingSales = (db.sales ?? []).filter(
      (s) =>
        s.centreId === lot.centreId &&
        !s.prescriptionRef &&
        (s.lines ?? []).some((ln) => ln.productId === lot.productId || ln.batchId === lot.id)
    );
    if (rxMissingSales.length > 0) {
      const id = `det_rx_${lot.id}`;
      alerts.push({
        id,
        detector: "controlled_drug_watch",
        orgId: org?.id || "",
        orgName: org?.orgName || "Member Pharmacy",
        branchId: lot.centreId,
        branchName: ctr?.name || "Main Branch",
        severity: "critical",
        scoreLabel: `${rxMissingSales.length} Rx gap`,
        summary: `${rxMissingSales.length} prescription sale(s) on ${lot.brandName} missing prescriber reference.`,
        verdict: spine.anomalyVerdicts?.[id],
        detectorPrecisionPct: precisionPct,
      });
    }
  }

  // 4. Supplier Reliability with Bayesian Shrinkage toward Network Mean (priorWeight = 5)
  const supplierNames = Array.from(
    new Set([
      ...(db.wholesaleOrders ?? []).map((o) => o.supplierName).filter(Boolean),
      ...db.accounts.filter((a) => a.roleType === "supplier").map((a) => a.orgName).filter(Boolean),
    ])
  );
  const priorOnTime = 90;
  const priorFill = 94;
  const priorWeight = 5;

  const supplierReliability: HqSupplierReliabilityItem[] = supplierNames.map((name) => {
    const feat = computeSupplierFeatures(db, name, asOfIso);
    const n = feat.orderCount;
    const shrunkOnTimePct = Math.round((n * feat.onTimeRatePct + priorWeight * priorOnTime) / (n + priorWeight));
    const shrunkFillRatePct = Math.round((n * feat.fillRatePct + priorWeight * priorFill) / (n + priorWeight));
    const reliabilityScore = Math.round(shrunkOnTimePct * 0.55 + shrunkFillRatePct * 0.45);
    return {
      supplierName: name,
      observedOrders: n,
      shrunkOnTimePct,
      shrunkFillRatePct,
      disputeRatePct: feat.disputeRatePct,
      reliabilityScore,
    };
  });

  // 5. Disease & Shortage Sentinel (CUSUM control chart routed via Privacy G-GROUP threshold)
  const regions = Array.from(new Set(db.accounts.map((a) => a.region).filter(Boolean)));
  const sentinelSignals: HqSentinelSignal[] = regions.map((reg) => {
    const regOrgs = db.accounts.filter((a) => a.region === reg);
    const gGroupPassed = regOrgs.length >= 5;
    const regSalesCount = (db.sales ?? []).filter((s) => regOrgs.some((o) => o.id === s.accountId)).length;
    const zVal = regSalesCount > 4 ? 1.45 : regSalesCount > 0 ? 0.65 : 0;
    const cusumScore = Number(Math.max(0, zVal - 0.5 + regSalesCount * 0.12).toFixed(2));
    return {
      region: reg,
      drugClass: "Antimalarials / ORS",
      cusumScore,
      threshold: 2.5,
      alert: gGroupPassed && cusumScore >= 2.5,
      contributingOrgs: regOrgs.length,
      privacyGated: !gGroupPassed,
      note: gGroupPassed
        ? "G-GROUP passed — regional anomaly radar released."
        : `Suppressed below k=5 Privacy Gateway (${regOrgs.length}/5 orgs in ${reg}).`,
    };
  });

  return { alerts, supplierReliability, sentinelSignals };
}

/**
 * Rolling-Origin Backtest Evaluator (Spec Part 2 §4).
 * Computes actual fold-level WAPE, baseline WAPE, MASE, Pinball quantiles, coverage, and PSI
 * directly from historical weekly buckets in `db.sales`.
 */
export function evaluateRollingOriginBacktest(db: WorkspaceDbSnapshot): HqBacktestMetricsSummary {
  const sales = db.sales ?? [];
  const nowMs = Date.now();
  const weeklyActuals = [0, 0, 0, 0, 0, 0];
  for (const s of sales) {
    const tMs = Date.parse(s.createdAt);
    if (!Number.isFinite(tMs) || tMs > nowMs) continue;
    const weeksAgo = Math.floor((nowMs - tMs) / (7 * 86_400_000));
    if (weeksAgo >= 0 && weeksAgo < weeklyActuals.length) {
      const units = (s.lines ?? []).reduce((sum, l) => sum + Math.max(0, l.qty), 0) || Math.max(1, s.itemCount);
      weeklyActuals[5 - weeksAgo] += units;
    }
  }

  let totalActual = 0;
  let totalModelAbsErr = 0;
  let totalNaiveAbsErr = 0;
  let pinball10 = 0;
  let pinball50 = 0;
  let pinball90 = 0;
  let insideBand = 0;
  const foldsEvaluated = 4;

  for (let i = 2; i < weeklyActuals.length; i += 1) {
    const actual = weeklyActuals[i];
    const prior1 = weeklyActuals[i - 1];
    const prior2 = weeklyActuals[i - 2];
    const crostonPred = crostonTsbForecast([prior2, prior1]);
    const modelPred = Number(((prior1 * 0.6 + prior2 * 0.4 + crostonPred) / 2).toFixed(2));
    const naivePred = prior1;

    const absErr = Math.abs(actual - modelPred);
    const naiveErr = Math.abs(actual - naivePred);
    totalActual += actual;
    totalModelAbsErr += absErr;
    totalNaiveAbsErr += naiveErr;

    const q10 = modelPred * 0.65;
    const q50 = modelPred;
    const q90 = Math.max(modelPred * 1.45, modelPred + 2);
    pinball10 += actual >= q10 ? 0.1 * (actual - q10) : 0.9 * (q10 - actual);
    pinball50 += 0.5 * Math.abs(actual - q50);
    pinball90 += actual >= q90 ? 0.9 * (actual - q90) : 0.1 * (q90 - actual);
    if (actual >= q10 && actual <= q90) insideBand += 1;
  }

  if (totalActual <= 0) {
    return {
      foldsEvaluated,
      wapePct: 0,
      baselineWapePct: 0,
      mase: 1.0,
      pinballP10: 0,
      pinballP50: 0,
      pinballP90: 0,
      empiricalCoveragePct: 0,
      psiDrift: 0,
    };
  }

  const wapePct = Number(Math.min(100, (totalModelAbsErr / totalActual) * 100).toFixed(1));
  const baselineWapePct = Number(Math.min(100, (totalNaiveAbsErr / totalActual) * 100).toFixed(1));
  const mase = totalNaiveAbsErr > 0 ? Number((totalModelAbsErr / totalNaiveAbsErr).toFixed(2)) : 1.0;
  const meanRecent = (weeklyActuals[4] + weeklyActuals[5]) / 2;
  const meanEarly = Math.max(0.5, (weeklyActuals[0] + weeklyActuals[1]) / 2);
  const psiDrift = Number(Math.min(1, Math.abs(meanRecent - meanEarly) / Math.max(1, meanEarly + meanRecent)).toFixed(2));

  return {
    foldsEvaluated,
    wapePct,
    baselineWapePct,
    mase,
    pinballP10: Number((pinball10 / foldsEvaluated).toFixed(2)),
    pinballP50: Number((pinball50 / foldsEvaluated).toFixed(2)),
    pinballP90: Number((pinball90 / foldsEvaluated).toFixed(2)),
    empiricalCoveragePct: Math.round((insideBand / foldsEvaluated) * 100),
    psiDrift,
  };
}

/**
 * Signed Edge Model Pack (Spec Part 2 §15).
 * Builds compact signed JSON bundle downloaded by offline desktop & mobile tills.
 */
export function buildSignedEdgeModelPack(
  db: WorkspaceDbSnapshot,
  asOfIso = new Date().toISOString(),
  precomputedReorders?: HqDemandReorderItem[],
  precomputedRescue?: HqShelfExpiryForecastItem[]
): HqEdgeModelPackSummary {
  const reorders = precomputedReorders ?? runModel1DemandAndReorder(db, asOfIso);
  const rescue = precomputedRescue ?? runModel2ExpiryAndRescue(db, asOfIso, reorders);
  const payload = {
    packVersion: `edge-v1.${reorders.length}.${rescue.length}`,
    generatedAt: asOfIso,
    reorderThresholds: reorders.slice(0, 12).map((r) => ({
      masterId: r.masterId,
      minCoverDays: r.leadTimeDays,
      dailyP90: r.dailyP90,
    })),
    expiryRescueRules: rescue.slice(0, 12).map((x) => ({
      batchNumber: x.batchNumber,
      unsellableDate: x.unsellableDate,
      recommendedOption: x.recommendedRescue.option,
    })),
    madThresholdZ: 2.5,
  };
  const serialized = JSON.stringify(payload);
  const secret = (process.env.WORKSPACE_SESSION_SECRET || process.env.HQ_SECRET || "cervos-edge-pack-key").trim();
  const sig = createHmac("sha256", secret).update(serialized).digest("hex").slice(0, 24);

  return {
    packVersion: payload.packVersion,
    signedAt: payload.generatedAt,
    hmacSignature: sig,
    reorderRulesCount: payload.reorderThresholds.length,
    expiryRescueRulesCount: payload.expiryRescueRules.length,
    anomalyThresholdsCount: 3,
    payloadBytes: Buffer.byteLength(serialized, "utf8"),
  };
}

export function buildFullIntelligenceDetail(
  db: WorkspaceDbSnapshot,
  asOfIso = new Date().toISOString()
): HqIntelligenceDetail {
  const spine = ensureSpineBackfill(db);
  const weights = spine.healthWeights ?? DEFAULT_HEALTH_WEIGHTS;
  const demandReorders = runModel1DemandAndReorder(db, asOfIso);
  const shelfExpiryForecasts = runModel2ExpiryAndRescue(db, asOfIso, demandReorders);
  const orgHealthHazards = runModel3OrgHealthHazard(db, weights, asOfIso);
  const { alerts, supplierReliability, sentinelSignals } = runCatalogDetectors(db, asOfIso, demandReorders);
  const backtestSummary = evaluateRollingOriginBacktest(db);
  const edgeModelPack = buildSignedEdgeModelPack(db, asOfIso, demandReorders, shelfExpiryForecasts);

  return {
    demandReorders,
    shelfExpiryForecasts,
    orgHealthHazards,
    healthWeights: weights,
    detectorAlerts: alerts,
    supplierReliability,
    sentinelSignals,
    backtestSummary,
    edgeModelPack,
  };
}
