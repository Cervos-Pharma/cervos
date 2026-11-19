import type { MlDailyPoint, MlProduct } from "@cervos/core";
import type { WorkspaceBatch, WorkspaceExpense, WorkspaceSale } from "@/types/workspace";

const DAY_MS = 86_400_000;
export const DEFAULT_STATION_LAT = -6.7924;
export const DEFAULT_STATION_LNG = 39.2083;

export function todayIsoDay(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface ProductShelfSummary {
  productId: string;
  brandName: string;
  genericName: string;
  category: string;
  validQty: number;
  totalQty: number;
  expiredQty: number;
  quarantinedQty: number;
  earliestBatch: string;
  earliestExpiry: string;
  salePriceTzs: number;
  costPriceTzs: number;
  requiresPrescription: boolean;
  isControlled: boolean;
  imageUrl?: string;
}

/** Groups branch batches by product with earliest valid expiry first. */
export function summarizeProductsByEarliestExpiry(
  batches: readonly WorkspaceBatch[],
  todayIso = todayIsoDay()
): ProductShelfSummary[] {
  const grouped = new Map<string, WorkspaceBatch[]>();
  for (const b of batches) {
    const arr = grouped.get(b.productId);
    if (arr) arr.push(b);
    else grouped.set(b.productId, [b]);
  }

  const out: ProductShelfSummary[] = [];
  for (const [productId, list] of grouped.entries()) {
    const sortedValid = [...list]
      .filter((b) => !b.quarantined && b.quantity > 0 && b.expiryDate >= todayIso)
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

    const validQty = sortedValid.reduce((s, b) => s + b.quantity, 0);
    const totalQty = list.reduce((s, b) => s + b.quantity, 0);
    const expiredQty = list
      .filter((b) => b.expiryDate < todayIso)
      .reduce((s, b) => s + b.quantity, 0);
    const quarantinedQty = list
      .filter((b) => b.quarantined)
      .reduce((s, b) => s + b.quantity, 0);

    const lead = sortedValid[0] ?? list[0];
    out.push({
      productId,
      brandName: lead.brandName,
      genericName: lead.genericName,
      category: lead.category,
      validQty,
      totalQty,
      expiredQty,
      quarantinedQty,
      earliestBatch: sortedValid[0]?.batchNumber ?? lead.batchNumber,
      earliestExpiry: sortedValid[0]?.expiryDate ?? lead.expiryDate,
      salePriceTzs: sortedValid[0]?.salePriceTzs ?? lead.salePriceTzs,
      costPriceTzs: sortedValid[0]?.costPriceTzs ?? lead.costPriceTzs,
      requiresPrescription: list.some((b) => b.requiresPrescription),
      isControlled: list.some((b) => b.isControlled),
      imageUrl: lead.imageUrl,
    });
  }

  return out.sort((a, b) => a.brandName.localeCompare(b.brandName));
}

export function summarizeBranchPnl(
  sales: readonly WorkspaceSale[],
  expenses: readonly WorkspaceExpense[],
  days = 30
) {
  const cutoff = Date.now() - days * DAY_MS;
  const scopedSales = sales.filter((s) => new Date(s.createdAt).getTime() >= cutoff);
  const scopedExpenses = expenses.filter((e) => new Date(e.createdAt).getTime() >= cutoff);

  let revenue = 0;
  let cogs = 0;
  for (const s of scopedSales) {
    revenue += s.totalTzs;
    if (s.lines && s.lines.length > 0) {
      cogs += s.lines.reduce((sum, l) => sum + l.qty * l.unitCostTzs, 0);
    } else {
      cogs += Math.round(s.totalTzs * 0.74);
    }
  }
  const opex = scopedExpenses.reduce((s, e) => s + e.amountTzs, 0);
  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - opex;
  const grossMarginPct = revenue > 0 ? Math.round((grossProfit / revenue) * 100) : 0;

  return {
    salesCount: scopedSales.length,
    revenue,
    cogs,
    grossProfit,
    opex,
    netProfit,
    grossMarginPct,
  };
}

export function computeStockHealth(
  batches: readonly WorkspaceBatch[],
  todayIso = todayIsoDay()
) {
  const todayMs = new Date(`${todayIso}T00:00:00`).getTime();
  let atCost = 0;
  let atRetail = 0;
  let expiring30Units = 0;
  let expiring30Cost = 0;
  let expiredCount = 0;
  let lowStockCount = 0;

  for (const b of batches) {
    if (b.quantity <= 0) continue;
    atCost += b.quantity * b.costPriceTzs;
    atRetail += b.quantity * b.salePriceTzs;
    const daysLeft = Math.round((new Date(`${b.expiryDate}T00:00:00`).getTime() - todayMs) / DAY_MS);
    if (b.expiryDate < todayIso) {
      expiredCount += 1;
    } else if (!b.quarantined && daysLeft <= 30) {
      expiring30Units += b.quantity;
      expiring30Cost += b.quantity * b.costPriceTzs;
    }
    if (!b.quarantined && b.quantity <= (b.lowStockThreshold ?? 15)) {
      lowStockCount += 1;
    }
  }

  return { atCost, atRetail, expiring30Units, expiring30Cost, expiredCount, lowStockCount };
}

export function buildDailyRevenueSeries(
  sales: readonly WorkspaceSale[],
  days: number,
  now = new Date()
): MlDailyPoint[] {
  const map = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    map.set(todayIsoDay(new Date(now.getTime() - i * DAY_MS)), 0);
  }
  for (const s of sales) {
    const day = todayIsoDay(new Date(s.createdAt));
    if (!map.has(day)) continue;
    map.set(day, (map.get(day) ?? 0) + s.totalTzs);
  }
  return Array.from(map.entries()).map(([date, revenue]) => ({ date, revenue }));
}

function ewma(values: readonly number[], alpha = 0.3): number {
  if (values.length === 0) return 0;
  let acc = values[0];
  for (let i = 1; i < values.length; i++) acc = alpha * values[i] + (1 - alpha) * acc;
  return acc;
}

export function buildMlProducts(
  sales: readonly WorkspaceSale[],
  batches: readonly WorkspaceBatch[],
  windowDays = 30,
  now = new Date()
): MlProduct[] {
  const todayIso = todayIsoDay(now);
  const startIso = todayIsoDay(new Date(now.getTime() - (windowDays - 1) * DAY_MS));
  const targetCover = 21;
  const leadTime = 3;

  const meta = new Map<string, { brandName: string; onHand: number }>();
  for (const b of batches) {
    const m = meta.get(b.productId) ?? { brandName: b.brandName, onHand: 0 };
    if (!b.quarantined && b.expiryDate >= todayIso) m.onHand += b.quantity;
    meta.set(b.productId, m);
  }

  const agg = new Map<string, { units: number; revenue: number; daily: Map<string, number> }>();
  for (const s of sales) {
    const day = todayIsoDay(new Date(s.createdAt));
    if (day < startIso || day > todayIso) continue;
    for (const l of s.lines ?? []) {
      const a = agg.get(l.productId) ?? { units: 0, revenue: 0, daily: new Map<string, number>() };
      a.units += l.qty;
      a.revenue += l.qty * l.unitPriceTzs;
      a.daily.set(day, (a.daily.get(day) ?? 0) + l.qty);
      agg.set(l.productId, a);
      if (!meta.has(l.productId)) {
        meta.set(l.productId, { brandName: l.brandName, onHand: 0 });
      }
    }
  }

  const totalRevenue = Array.from(agg.values()).reduce((s, a) => s + a.revenue, 0) || 1;
  const rows: Array<MlProduct & { revenueSharePct: number }> = [];

  for (const [productId, m] of meta) {
    const a = agg.get(productId) ?? { units: 0, revenue: 0, daily: new Map<string, number>() };
    const dailySeries: number[] = [];
    for (let i = windowDays - 1; i >= 0; i--) {
      dailySeries.push(a.daily.get(todayIsoDay(new Date(now.getTime() - i * DAY_MS))) ?? 0);
    }
    const velocity = Math.max(ewma(dailySeries), (a.units / windowDays) * 0.5);
    const last7 = dailySeries.slice(-7).reduce((x, y) => x + y, 0);
    const prev7 = dailySeries.slice(-14, -7).reduce((x, y) => x + y, 0);
    const cover = velocity > 0.01 ? m.onHand / velocity : null;
    const reorder = Math.max(0, Math.ceil(velocity * (targetCover + leadTime) - m.onHand));
    let status = "healthy";
    if (a.units === 0 && m.onHand > 0) status = "dead_stock";
    else if (cover !== null && cover <= leadTime + 4) status = "stockout_risk";
    else if (cover !== null && cover > 90) status = "overstock";

    rows.push({
      productId,
      brandName: m.brandName,
      daysOfCover: cover === null ? null : Math.round(cover * 10) / 10,
      trendPct: prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : null,
      abcClass: "C",
      status,
      reorderQty: reorder,
      onHand: m.onHand,
      unitsSold: a.units,
      revenue: a.revenue,
      revenueSharePct: Math.round((a.revenue / totalRevenue) * 1000) / 10,
    });
  }

  rows.sort((x, y) => y.revenue - x.revenue);
  let cumulative = 0;
  for (const r of rows) {
    cumulative += r.revenueSharePct;
    r.abcClass = cumulative <= 80 ? "A" : cumulative <= 95 ? "B" : "C";
  }
  if (rows.length > 0 && rows[0].revenue > 0) rows[0].abcClass = "A";
  return rows;
}

export function getOsmStationTileUrl(
  lat?: number,
  lng?: number,
  zoom = 15,
  isDark = false
) {
  const hasGeo =
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    (Math.abs(lat) > 0.001 || Math.abs(lng) > 0.001);
  const safeLat = Math.max(-85, Math.min(85, hasGeo ? lat! : DEFAULT_STATION_LAT));
  const safeLng = Math.max(-180, Math.min(180, hasGeo ? lng! : DEFAULT_STATION_LNG));
  const n = 2 ** zoom;
  const x = Math.floor(((safeLng + 180) / 360) * n);
  const latRad = (safeLat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );

  const sub = ["a", "b", "c", "d"][Math.abs(x + y) % 4];
  const stylePath = isDark ? "dark_all" : "rastertiles/voyager";

  return {
    url: `https://${sub}.basemaps.cartocdn.com/${stylePath}/${zoom}/${x}/${y}.png`,
    lat: safeLat,
    lng: safeLng,
    zoom,
    isDefaultGeo: !hasGeo,
  };
}
