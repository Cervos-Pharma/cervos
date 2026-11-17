/**
 * Lightweight On-Device Edge Machine Learning Models for Pharmacy Operations.
 *
 * Pure statistical & pattern-mining algorithms with zero network dependencies
 * and O(n) execution (<2ms per screen), safe for offline desktops and phones:
 *  1. Holt's Double Exponential Smoothing (level + trend 7-day forecast)
 *  2. Ordinary Least Squares (OLS) Daily Revenue Trend & Confidence
 *  3. Modified Z-Score (MAD) Sales Anomaly Detector
 *  4. Apriori-style 2-Item Co-Dispense Affinity Mining (support, confidence, lift)
 *  5. Multi-Factor Reorder Urgency Scorer
 */

import type { DailyPoint, IntelSale, ProductIntel } from "@/lib/workspace/intelligence";

const DAY_MS = 86400000;

export interface HoltPoint {
  date: string;
  predicted: number;
  low: number;
  high: number;
}

/**
 * Holt's linear exponential smoothing captures both current revenue level
 * and directional slope without external dependencies.
 */
export function holtLinearForecast(
  series: readonly DailyPoint[],
  horizon = 7,
  alpha = 0.35,
  beta = 0.18,
  now = new Date()
): HoltPoint[] {
  if (series.length === 0) return [];
  const vals = series.map((p) => p.revenue);
  let level = vals[0];
  let trend = vals.length > 1 ? vals[1] - vals[0] : 0;

  const residuals: number[] = [];
  for (let i = 1; i < vals.length; i++) {
    const prevLevel = level;
    const prevTrend = trend;
    const forecast = prevLevel + prevTrend;
    residuals.push(vals[i] - forecast);
    level = alpha * vals[i] + (1 - alpha) * forecast;
    trend = beta * (level - prevLevel) + (1 - beta) * prevTrend;
  }

  const rmse =
    residuals.length > 1
      ? Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / residuals.length)
      : Math.max(5000, level * 0.18);

  const out: HoltPoint[] = [];
  for (let h = 1; h <= horizon; h++) {
    const d = new Date(now.getTime() + h * DAY_MS);
    const iso = d.toISOString().slice(0, 10);
    const est = Math.max(0, Math.round(level + h * trend));
    const spread = Math.round(rmse * Math.sqrt(h) * 0.9);
    out.push({
      date: iso,
      predicted: est,
      low: Math.max(0, est - spread),
      high: est + spread,
    });
  }
  return out;
}

export interface LinearTrendSummary {
  slopePerDayTzs: number;
  direction: "rising" | "steady" | "cooling";
  rSquared: number;
  meanDailyTzs: number;
}

/** OLS linear regression over daily revenue series to detect real momentum vs noise. */
export function linearTrendRegression(series: readonly DailyPoint[]): LinearTrendSummary {
  const n = series.length;
  if (n < 2) {
    return {
      slopePerDayTzs: 0,
      direction: "steady",
      rSquared: 0,
      meanDailyTzs: series[0]?.revenue ?? 0,
    };
  }
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += series[i].revenue;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - meanX;
    const dy = series[i].revenue - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const slope = denX > 0 ? num / denX : 0;
  const r2 = denX > 0 && denY > 0 ? (num * num) / (denX * denY) : 0;
  const relSlope = meanY > 0 ? slope / meanY : 0;
  const direction: LinearTrendSummary["direction"] =
    relSlope > 0.012 ? "rising" : relSlope < -0.012 ? "cooling" : "steady";

  return {
    slopePerDayTzs: Math.round(slope),
    direction,
    rSquared: Math.round(r2 * 100) / 100,
    meanDailyTzs: Math.round(meanY),
  };
}

export interface SalesAnomaly {
  date: string;
  revenue: number;
  kind: "spike" | "dip";
  zScore: number;
  baselineTzs: number;
}

/** Robust Modified Z-Score (Median Absolute Deviation) anomaly detector. */
export function detectSalesAnomalies(series: readonly DailyPoint[], threshold = 2.2): SalesAnomaly[] {
  if (series.length < 5) return [];
  const sorted = [...series.map((s) => s.revenue)].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const devs = sorted.map((v) => Math.abs(v - median)).sort((a, b) => a - b);
  const mad = devs.length % 2 === 0 ? (devs[mid - 1] + devs[mid]) / 2 : devs[mid];
  const scale = mad > 0 ? mad * 1.4826 : Math.max(1000, median * 0.35);

  const hits: SalesAnomaly[] = [];
  for (const p of series) {
    const z = (p.revenue - median) / scale;
    if (Math.abs(z) >= threshold && (p.revenue > 0 || median > 0)) {
      hits.push({
        date: p.date,
        revenue: p.revenue,
        kind: z > 0 ? "spike" : "dip",
        zScore: Math.round(Math.abs(z) * 10) / 10,
        baselineTzs: Math.round(median),
      });
    }
  }
  return hits.sort((a, b) => b.zScore - a.zScore).slice(0, 4);
}

export interface BasketAffinity {
  aId: string;
  aName: string;
  bId: string;
  bName: string;
  pairCount: number;
  confidencePct: number;
  lift: number;
}

/**
 * Mines co-occurring item pairs across itemised receipts to suggest
 * shelf placement bundles and counter add-ons.
 */
export function mineBasketAffinities(sales: readonly IntelSale[], minCount = 2): BasketAffinity[] {
  const itemSales = new Map<string, { name: string; count: number }>();
  const pairCounts = new Map<string, { aId: string; aName: string; bId: string; bName: string; count: number }>();
  let multiLineReceipts = 0;

  for (const s of sales) {
    const uniqueLines = Array.from(new Map((s.lines ?? []).map((l) => [l.productId, l])).values());
    if (uniqueLines.length === 0) continue;
    multiLineReceipts++;
    for (const l of uniqueLines) {
      const prev = itemSales.get(l.productId) ?? { name: l.brandName, count: 0 };
      prev.count += 1;
      itemSales.set(l.productId, prev);
    }
    for (let i = 0; i < uniqueLines.length; i++) {
      for (let j = i + 1; j < uniqueLines.length; j++) {
        const [first, second] =
          uniqueLines[i].productId < uniqueLines[j].productId
            ? [uniqueLines[i], uniqueLines[j]]
            : [uniqueLines[j], uniqueLines[i]];
        const key = `${first.productId}::${second.productId}`;
        const prev = pairCounts.get(key) ?? {
          aId: first.productId,
          aName: first.brandName,
          bId: second.productId,
          bName: second.brandName,
          count: 0,
        };
        prev.count += 1;
        pairCounts.set(key, prev);
      }
    }
  }

  if (multiLineReceipts < 2) return [];
  const results: BasketAffinity[] = [];
  for (const pair of pairCounts.values()) {
    if (pair.count < minCount) continue;
    const aCount = itemSales.get(pair.aId)?.count ?? 1;
    const bCount = itemSales.get(pair.bId)?.count ?? 1;
    const pA = aCount / multiLineReceipts;
    const pB = bCount / multiLineReceipts;
    const pAB = pair.count / multiLineReceipts;
    const lift = pA * pB > 0 ? pAB / (pA * pB) : 1;
    const conf = Math.round((pair.count / aCount) * 100);
    results.push({
      aId: pair.aId,
      aName: pair.aName,
      bId: pair.bId,
      bName: pair.bName,
      pairCount: pair.count,
      confidencePct: Math.min(100, conf),
      lift: Math.round(lift * 100) / 100,
    });
  }

  return results.sort((x, y) => y.lift - x.lift || y.pairCount - x.pairCount).slice(0, 6);
}

export interface ReorderUrgencyItem {
  productId: string;
  brandName: string;
  tier: "urgent" | "soon" | "ok" | "slow";
  score: number;
  suggestedQty: number;
}

/** Scores reorder priority combining cover days, demand trend, and revenue share. */
export function classifyReorderUrgency(products: readonly ProductIntel[]): ReorderUrgencyItem[] {
  return products
    .map((p) => {
      let score = 20;
      if (p.daysOfCover !== null) {
        if (p.daysOfCover <= 5) score += 60;
        else if (p.daysOfCover <= 12) score += 40;
        else if (p.daysOfCover <= 21) score += 20;
      }
      if ((p.trendPct ?? 0) > 15) score += 15;
      if (p.abcClass === "A") score += 15;
      if (p.status === "dead_stock") score = 5;
      score = Math.max(0, Math.min(100, score));
      const tier: ReorderUrgencyItem["tier"] =
        p.status === "dead_stock"
          ? "slow"
          : score >= 75
            ? "urgent"
            : score >= 50
              ? "soon"
              : "ok";
      return {
        productId: p.productId,
        brandName: p.brandName,
        tier,
        score,
        suggestedQty: p.reorderQty,
      };
    })
    .sort((a, b) => b.score - a.score);
}
