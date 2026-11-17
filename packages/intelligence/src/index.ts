export type StockoutRiskLevel = "critical" | "reorder_now" | "watch" | "healthy";
export type WhoAwareCategory = "Access" | "Watch" | "Reserve" | "Non-Antibiotic";

export interface InventoryIntelligenceInput {
  productId: string;
  productName: string;
  innName?: string;
  atcCode?: string;
  whoAwareClass?: WhoAwareCategory;
  currentStockQty: number;
  dailySalesSeries: readonly number[];
  leadTimeDays?: number;
  targetCoverDays?: number;
  unitCostTzs: number;
  expiringWithin60DaysQty?: number;
  preferredSupplierId?: string | null;
}

export interface DraftPurchaseOrderLine {
  productId: string;
  productName: string;
  innName: string;
  quantity: number;
  estimatedUnitCostTzs: number;
  estimatedLineTotalTzs: number;
  supplierId: string | null;
}

export interface InventoryIntelligenceResult {
  productId: string;
  trailingDailyVelocity: number;
  ewmaDailyVelocity: number;
  daysOfCover: number;
  stockoutRiskLevel: StockoutRiskLevel;
  safetyStockQty: number;
  recommendedOrderQty: number;
  expiryExposureTzs: number;
  draftOrder: DraftPurchaseOrderLine | null;
}

const EWMA_ALPHA = 0.35;

/**
 * Computes demand forecasting using Trailing Mean + Exponentially Weighted Moving
 * Average (alpha = 0.35), expiry capital exposure, and a 1-click B2B draft PO line.
 */
export function computeInventoryIntelligence(
  input: InventoryIntelligenceInput
): InventoryIntelligenceResult {
  const series = input.dailySalesSeries.filter((n) => Number.isFinite(n) && n >= 0);
  const trailingDailyVelocity =
    series.length > 0 ? series.reduce((acc, v) => acc + v, 0) / series.length : 0;

  let ewmaDailyVelocity = series[0] ?? 0;
  for (let i = 1; i < series.length; i += 1) {
    ewmaDailyVelocity = EWMA_ALPHA * series[i] + (1 - EWMA_ALPHA) * ewmaDailyVelocity;
  }

  const blendedVelocity = Math.max(ewmaDailyVelocity, trailingDailyVelocity * 0.75);
  const currentStock = Math.max(0, Math.round(input.currentStockQty || 0));
  const leadTimeDays = Math.max(1, input.leadTimeDays ?? 3);
  const targetCoverDays = Math.max(leadTimeDays + 5, input.targetCoverDays ?? 14);

  const daysOfCover =
    blendedVelocity > 0.001 ? Number((currentStock / blendedVelocity).toFixed(1)) : 999;

  // Safety stock balances lead-time demand variance
  const safetyStockQty = Math.ceil(blendedVelocity * Math.max(2, leadTimeDays * 0.75));
  const reorderPointQty = Math.ceil(blendedVelocity * leadTimeDays + safetyStockQty);

  let stockoutRiskLevel: StockoutRiskLevel = "healthy";
  if (currentStock === 0 || daysOfCover <= leadTimeDays) {
    stockoutRiskLevel = "critical";
  } else if (currentStock <= reorderPointQty || daysOfCover <= leadTimeDays + 4) {
    stockoutRiskLevel = "reorder_now";
  } else if (daysOfCover <= targetCoverDays) {
    stockoutRiskLevel = "watch";
  }

  const desiredTargetQty = Math.ceil(blendedVelocity * targetCoverDays + safetyStockQty);
  const recommendedOrderQty =
    stockoutRiskLevel === "healthy"
      ? 0
      : Math.max(0, desiredTargetQty - currentStock);

  const unitCostTzs = Math.max(0, Math.round(input.unitCostTzs || 0));
  const expiringQty = Math.max(0, Math.round(input.expiringWithin60DaysQty || 0));
  const expiryExposureTzs = expiringQty * unitCostTzs;

  const draftOrder: DraftPurchaseOrderLine | null =
    recommendedOrderQty > 0
      ? {
          productId: input.productId,
          productName: input.productName,
          innName: input.innName ?? input.productName,
          quantity: recommendedOrderQty,
          estimatedUnitCostTzs: unitCostTzs,
          estimatedLineTotalTzs: recommendedOrderQty * unitCostTzs,
          supplierId: input.preferredSupplierId ?? null,
        }
      : null;

  return {
    productId: input.productId,
    trailingDailyVelocity: Number(trailingDailyVelocity.toFixed(2)),
    ewmaDailyVelocity: Number(ewmaDailyVelocity.toFixed(2)),
    daysOfCover,
    stockoutRiskLevel,
    safetyStockQty,
    recommendedOrderQty,
    expiryExposureTzs,
    draftOrder,
  };
}

export interface RegionalTelemetryObservation {
  region: string;
  atcCode: string;
  innName: string;
  dosageForm: string;
  whoAwareClass: WhoAwareCategory;
  unitsDispensed: number;
  branchesReporting: number;
  branchesStockedOut: number;
  medianDaysOfCover: number;
}

export interface AnonymizedResearchTensor {
  schemaVersion: "cervos-telemetry-v1";
  region: string;
  atcCode: string;
  innName: string;
  dosageForm: string;
  whoAwareClass: WhoAwareCategory;
  totalUnitsDispensed: number;
  stockoutPressureIndex: number; // 0..1 ratio of stocked-out sites
  medianDaysOfCover: number;
  antimicrobialStewardshipAlert: boolean;
}

/**
 * Produces strictly de-identified pharmacovigilance, antimicrobial stewardship,
 * and ML demand-forecasting feature vectors for researchers & digital-biology pipelines.
 */
export function buildAnonymizedTelemetryVector(
  obs: RegionalTelemetryObservation
): AnonymizedResearchTensor {
  const reporting = Math.max(1, obs.branchesReporting);
  const pressure = Math.min(1, Math.max(0, obs.branchesStockedOut / reporting));
  const stewardshipAlert =
    obs.whoAwareClass === "Watch" || obs.whoAwareClass === "Reserve"
      ? obs.unitsDispensed > 0
      : false;

  return {
    schemaVersion: "cervos-telemetry-v1",
    region: obs.region,
    atcCode: obs.atcCode,
    innName: obs.innName,
    dosageForm: obs.dosageForm,
    whoAwareClass: obs.whoAwareClass,
    totalUnitsDispensed: Math.max(0, Math.round(obs.unitsDispensed)),
    stockoutPressureIndex: Number(pressure.toFixed(3)),
    medianDaysOfCover: Number(Math.max(0, obs.medianDaysOfCover).toFixed(1)),
    antimicrobialStewardshipAlert: stewardshipAlert,
  };
}

export interface FacilitySurplusCandidate {
  facilityId: string;
  facilityName: string;
  region: string;
  productId: string;
  batchNumber: string;
  surplusQty: number;
  daysUntilExpiry: number;
  distanceKm: number;
}

export interface HospitalTransferMatch {
  sourceFacilityId: string;
  sourceFacilityName: string;
  batchNumber: string;
  transferQty: number;
  daysUntilExpiry: number;
  distanceKm: number;
  score: number;
}

/**
 * Matches a hospital experiencing an urgent stockout with nearby facilities
 * holding safe non-expiring surplus (`daysUntilExpiry >= minShelfLifeDays`),
 * prioritizing proximity and avoiding near-expiry dumps unless no other lot exists.
 */
export function matchHospitalStockoutWithNearbySurplus(
  neededQty: number,
  targetRegion: string,
  candidates: readonly FacilitySurplusCandidate[],
  minShelfLifeDays = 60
): HospitalTransferMatch[] {
  let remaining = Math.max(0, Math.round(neededQty));
  if (remaining === 0) return [];

  const eligible = candidates
    .filter((c) => c.surplusQty > 0 && c.daysUntilExpiry >= minShelfLifeDays)
    .map((c) => {
      const sameRegionBonus = c.region.toLowerCase() === targetRegion.toLowerCase() ? 50 : 0;
      const distanceScore = Math.max(0, 100 - c.distanceKm);
      const shelfScore = Math.min(60, c.daysUntilExpiry / 6);
      const score = Number((sameRegionBonus + distanceScore + shelfScore).toFixed(2));
      return { ...c, score };
    })
    .sort((a, b) => b.score - a.score);

  const matches: HospitalTransferMatch[] = [];
  for (const candidate of eligible) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, candidate.surplusQty);
    matches.push({
      sourceFacilityId: candidate.facilityId,
      sourceFacilityName: candidate.facilityName,
      batchNumber: candidate.batchNumber,
      transferQty: take,
      daysUntilExpiry: candidate.daysUntilExpiry,
      distanceKm: candidate.distanceKm,
      score: candidate.score,
    });
    remaining -= take;
  }

  return matches;
}

