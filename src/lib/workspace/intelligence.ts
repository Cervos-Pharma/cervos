/**
 * Cervos Business Intelligence Engine (pure, side-effect free).
 *
 * Turns raw station records (itemised sales, FEFO batches, Kasri wholesale
 * orders, expenses) into owner-grade intelligence: margin, EWMA velocity,
 * days-of-cover, ABC Pareto classes, FEFO sell-through vs expiry write-off
 * projection, weekday-seasonal revenue forecast, staff and branch league
 * tables, a composite health score and ranked plain-language insights.
 */

export interface IntelSaleLine {
  productId: string;
  brandName: string;
  category: string;
  batchId?: string;
  qty: number;
  unitPriceTzs: number;
  unitCostTzs: number;
}

export interface IntelSale {
  id: string;
  centreId?: string;
  profileId?: string;
  actorName: string;
  totalTzs: number;
  itemCount: number;
  paymentMethod: string;
  prescriptionRef?: string;
  lines?: IntelSaleLine[];
  createdAt: string;
}

export interface IntelBatch {
  id: string;
  centreId?: string;
  productId: string;
  brandName: string;
  genericName: string;
  category: string;
  batchNumber: string;
  quantity: number;
  costPriceTzs: number;
  salePriceTzs: number;
  expiryDate: string;
  requiresPrescription: boolean;
  quarantined: boolean;
}

export interface IntelOrder {
  supplierName: string;
  productName: string;
  quantity: number;
  totalTzs: number;
  escrowStatus: string;
  orderStatus: string;
  createdAt: string;
  deliveredAt?: string;
}

export interface IntelExpense {
  category: string;
  amountTzs: number;
  createdAt: string;
}

const DAY_MS = 86400000;

export function isoDay(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((new Date(toIso + "T00:00:00").getTime() - new Date(fromIso + "T00:00:00").getTime()) / DAY_MS);
}

/** Cost of goods for a sale: exact from lines, else estimated from a blended margin. */
export function saleCogs(sale: IntelSale, fallbackCostRatio = 0.74): number {
  if (sale.lines && sale.lines.length > 0) {
    return sale.lines.reduce((s, l) => s + l.qty * l.unitCostTzs, 0);
  }
  return Math.round(sale.totalTzs * fallbackCostRatio);
}

/* ------------------------------------------------------------------ */
/* Revenue time series, period comparison, forecast                   */
/* ------------------------------------------------------------------ */

export interface DailyPoint {
  date: string;
  revenue: number;
  cogs: number;
  profit: number;
  tx: number;
  units: number;
}

export function buildDailySeries(sales: readonly IntelSale[], days: number, now = new Date()): DailyPoint[] {
  const map = new Map<string, DailyPoint>();
  for (let i = days - 1; i >= 0; i--) {
    const d = isoDay(new Date(now.getTime() - i * DAY_MS));
    map.set(d, { date: d, revenue: 0, cogs: 0, profit: 0, tx: 0, units: 0 });
  }
  for (const s of sales) {
    const p = map.get(isoDay(s.createdAt));
    if (!p) continue;
    const cogs = saleCogs(s);
    p.revenue += s.totalTzs;
    p.cogs += cogs;
    p.profit += s.totalTzs - cogs;
    p.tx += 1;
    p.units += s.itemCount;
  }
  return Array.from(map.values());
}

export interface PeriodCompare {
  current: number;
  previous: number;
  deltaPct: number | null;
}

export function comparePeriods(series: readonly DailyPoint[], windowDays: number, key: keyof Omit<DailyPoint, "date"> = "revenue"): PeriodCompare {
  const cur = series.slice(-windowDays).reduce((s, p) => s + p[key], 0);
  const prev = series.slice(-windowDays * 2, -windowDays).reduce((s, p) => s + p[key], 0);
  return {
    current: cur,
    previous: prev,
    deltaPct: prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null,
  };
}

/**
 * Weekday-seasonal forecast: mean of the same weekday across the history,
 * scaled by the recent-7 vs history trend. Returns low/high band (+-1 sd).
 */
export function forecastRevenue(series: readonly DailyPoint[], horizon = 7, now = new Date()) {
  const byWeekday: number[][] = [[], [], [], [], [], [], []];
  for (const p of series) byWeekday[new Date(p.date + "T00:00:00").getDay()].push(p.revenue);
  const histMean = series.length ? series.reduce((s, p) => s + p.revenue, 0) / series.length : 0;
  const recent = series.slice(-7);
  const recentMean = recent.length ? recent.reduce((s, p) => s + p.revenue, 0) / recent.length : 0;
  const trend = histMean > 0 ? Math.min(1.5, Math.max(0.6, recentMean / histMean)) : 1;

  const out: Array<{ date: string; expected: number; low: number; high: number }> = [];
  for (let i = 1; i <= horizon; i++) {
    const d = new Date(now.getTime() + i * DAY_MS);
    const vals = byWeekday[d.getDay()];
    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : histMean;
    const sd = vals.length > 1 ? Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / (vals.length - 1)) : mean * 0.25;
    const expected = Math.round(mean * trend);
    out.push({ date: isoDay(d), expected, low: Math.max(0, Math.round(expected - sd)), high: Math.round(expected + sd) });
  }
  return out;
}

/** 7 x 14 grid (Mon..Sun x 08:00..21:00) of revenue to reveal peak trading hours. */
export function hourWeekHeatmap(sales: readonly IntelSale[], startHour = 8, endHour = 21) {
  const hours = endHour - startHour + 1;
  const grid = Array.from({ length: 7 }, () => new Array<number>(hours).fill(0));
  for (const s of sales) {
    const d = new Date(s.createdAt);
    const h = d.getHours();
    if (h < startHour || h > endHour) continue;
    const wd = d.getDay() === 0 ? 6 : d.getDay() - 1;
    grid[wd][h - startHour] += s.totalTzs;
  }
  const max = Math.max(1, ...grid.flat());
  let peak = { day: 0, hour: startHour, value: 0 };
  grid.forEach((row, di) =>
    row.forEach((v, hi) => {
      if (v > peak.value) peak = { day: di, hour: startHour + hi, value: v };
    })
  );
  return { grid, max, startHour, endHour, peak };
}

/* ------------------------------------------------------------------ */
/* Product intelligence: margin, EWMA velocity, cover, ABC, reorder    */
/* ------------------------------------------------------------------ */

export interface ProductIntel {
  productId: string;
  brandName: string;
  genericName: string;
  category: string;
  unitsSold: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  marginPct: number;
  velocityPerDay: number;
  onHand: number;
  daysOfCover: number | null;
  stockoutDate: string | null;
  abcClass: "A" | "B" | "C";
  revenueSharePct: number;
  trendPct: number | null;
  reorderQty: number;
  status: "stockout_risk" | "healthy" | "overstock" | "dead_stock";
}

/** Exponentially weighted moving average of a daily series (alpha 0.3). */
export function ewma(values: readonly number[], alpha = 0.3): number {
  if (values.length === 0) return 0;
  let acc = values[0];
  for (let i = 1; i < values.length; i++) acc = alpha * values[i] + (1 - alpha) * acc;
  return acc;
}

export function productIntelligence(
  sales: readonly IntelSale[],
  batches: readonly IntelBatch[],
  opts: { windowDays?: number; targetCoverDays?: number; leadTimeDays?: number; now?: Date } = {}
): ProductIntel[] {
  const windowDays = opts.windowDays ?? 30;
  const targetCover = opts.targetCoverDays ?? 21;
  const leadTime = opts.leadTimeDays ?? 3;
  const now = opts.now ?? new Date();
  const todayIso = isoDay(now);
  const startIso = isoDay(new Date(now.getTime() - (windowDays - 1) * DAY_MS));

  const meta = new Map<string, { brandName: string; genericName: string; category: string; onHand: number }>();
  for (const b of batches) {
    const m = meta.get(b.productId) ?? { brandName: b.brandName, genericName: b.genericName, category: b.category, onHand: 0 };
    if (!b.quarantined && b.expiryDate >= todayIso) m.onHand += b.quantity;
    meta.set(b.productId, m);
  }

  const agg = new Map<string, { units: number; revenue: number; cogs: number; daily: Map<string, number> }>();
  for (const s of sales) {
    const day = isoDay(s.createdAt);
    if (day < startIso || day > todayIso) continue;
    for (const l of s.lines ?? []) {
      const a = agg.get(l.productId) ?? { units: 0, revenue: 0, cogs: 0, daily: new Map<string, number>() };
      a.units += l.qty;
      a.revenue += l.qty * l.unitPriceTzs;
      a.cogs += l.qty * l.unitCostTzs;
      a.daily.set(day, (a.daily.get(day) ?? 0) + l.qty);
      agg.set(l.productId, a);
      if (!meta.has(l.productId)) {
        meta.set(l.productId, { brandName: l.brandName, genericName: l.brandName, category: l.category, onHand: 0 });
      }
    }
  }

  const totalRevenue = Array.from(agg.values()).reduce((s, a) => s + a.revenue, 0) || 1;
  const rows: ProductIntel[] = [];
  for (const [productId, m] of meta) {
    const a = agg.get(productId) ?? { units: 0, revenue: 0, cogs: 0, daily: new Map<string, number>() };
    const dailySeries: number[] = [];
    for (let i = windowDays - 1; i >= 0; i--) {
      dailySeries.push(a.daily.get(isoDay(new Date(now.getTime() - i * DAY_MS))) ?? 0);
    }
    const velocity = Math.max(ewma(dailySeries), a.units / windowDays * 0.5);
    const last7 = dailySeries.slice(-7).reduce((x, y) => x + y, 0);
    const prev7 = dailySeries.slice(-14, -7).reduce((x, y) => x + y, 0);
    const cover = velocity > 0.01 ? m.onHand / velocity : null;
    const reorder = Math.max(0, Math.ceil(velocity * (targetCover + leadTime) - m.onHand));
    let status: ProductIntel["status"] = "healthy";
    if (a.units === 0 && m.onHand > 0) status = "dead_stock";
    else if (cover !== null && cover <= leadTime + 4) status = "stockout_risk";
    else if (cover !== null && cover > 90) status = "overstock";

    rows.push({
      productId,
      brandName: m.brandName,
      genericName: m.genericName,
      category: m.category,
      unitsSold: a.units,
      revenue: a.revenue,
      cogs: a.cogs,
      grossProfit: a.revenue - a.cogs,
      marginPct: a.revenue > 0 ? Math.round(((a.revenue - a.cogs) / a.revenue) * 1000) / 10 : 0,
      velocityPerDay: Math.round(velocity * 100) / 100,
      onHand: m.onHand,
      daysOfCover: cover === null ? null : Math.round(cover * 10) / 10,
      stockoutDate: cover === null ? null : isoDay(new Date(now.getTime() + cover * DAY_MS)),
      abcClass: "C",
      revenueSharePct: Math.round((a.revenue / totalRevenue) * 1000) / 10,
      trendPct: prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : null,
      reorderQty: reorder,
      status,
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

/* ------------------------------------------------------------------ */
/* FEFO sell-through vs expiry write-off projection                    */
/* ------------------------------------------------------------------ */

export interface LotRisk {
  batchId: string;
  productId: string;
  brandName: string;
  batchNumber: string;
  quantity: number;
  expiryDate: string;
  daysToExpiry: number;
  projectedSold: number;
  atRiskUnits: number;
  atRiskValueTzs: number;
  bucket: "expired" | "d0_30" | "d31_90" | "d91_180" | "d180_plus";
}

export function expiryRiskProjection(
  batches: readonly IntelBatch[],
  velocityByProduct: ReadonlyMap<string, number>,
  now = new Date()
) {
  const todayIso = isoDay(now);
  const lots: LotRisk[] = [];
  const byProduct = new Map<string, IntelBatch[]>();
  for (const b of batches) {
    if (b.quantity <= 0) continue;
    const list = byProduct.get(b.productId) ?? [];
    list.push(b);
    byProduct.set(b.productId, list);
  }

  for (const [productId, list] of byProduct) {
    const velocity = velocityByProduct.get(productId) ?? 0;
    // FEFO: earlier-expiring lots consume demand first
    const sorted = [...list].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
    let demandConsumedDays = 0;
    for (const b of sorted) {
      const dte = daysBetween(todayIso, b.expiryDate);
      const bucket: LotRisk["bucket"] =
        dte < 0 ? "expired" : dte <= 30 ? "d0_30" : dte <= 90 ? "d31_90" : dte <= 180 ? "d91_180" : "d180_plus";
      let sold = 0;
      if (dte >= 0 && !b.quarantined && velocity > 0) {
        const sellWindow = Math.max(0, dte - demandConsumedDays);
        sold = Math.min(b.quantity, Math.floor(sellWindow * velocity));
        demandConsumedDays += sold / velocity;
      }
      const atRisk = Math.max(0, b.quantity - sold);
      lots.push({
        batchId: b.id,
        productId,
        brandName: b.brandName,
        batchNumber: b.batchNumber,
        quantity: b.quantity,
        expiryDate: b.expiryDate,
        daysToExpiry: dte,
        projectedSold: sold,
        atRiskUnits: bucket === "d180_plus" ? 0 : atRisk,
        atRiskValueTzs: bucket === "d180_plus" ? 0 : atRisk * b.costPriceTzs,
        bucket,
      });
    }
  }

  const buckets = {
    expired: { units: 0, valueTzs: 0 },
    d0_30: { units: 0, valueTzs: 0 },
    d31_90: { units: 0, valueTzs: 0 },
    d91_180: { units: 0, valueTzs: 0 },
    d180_plus: { units: 0, valueTzs: 0 },
  };
  const costById = new Map(batches.map((b) => [b.id, b.costPriceTzs]));
  for (const l of lots) {
    buckets[l.bucket].units += l.quantity;
    buckets[l.bucket].valueTzs += l.quantity * (costById.get(l.batchId) ?? 0);
  }
  const projectedWriteOffTzs = lots.reduce((s, l) => s + l.atRiskValueTzs, 0);
  lots.sort((a, b) => b.atRiskValueTzs - a.atRiskValueTzs || a.daysToExpiry - b.daysToExpiry);
  return { lots, buckets, projectedWriteOffTzs };
}

/* ------------------------------------------------------------------ */
/* Inventory valuation, payment mix, staff, branches, suppliers        */
/* ------------------------------------------------------------------ */

export function inventoryValuation(batches: readonly IntelBatch[], now = new Date()) {
  const todayIso = isoDay(now);
  let atCost = 0;
  let atRetail = 0;
  let sellableUnits = 0;
  for (const b of batches) {
    if (b.quarantined || b.expiryDate < todayIso || b.quantity <= 0) continue;
    atCost += b.quantity * b.costPriceTzs;
    atRetail += b.quantity * b.salePriceTzs;
    sellableUnits += b.quantity;
  }
  return { atCost, atRetail, potentialProfit: atRetail - atCost, sellableUnits };
}

export function paymentMix(sales: readonly IntelSale[]) {
  const total = sales.reduce((s, x) => s + x.totalTzs, 0) || 1;
  const map = new Map<string, { method: string; amount: number; tx: number }>();
  for (const s of sales) {
    const m = map.get(s.paymentMethod) ?? { method: s.paymentMethod, amount: 0, tx: 0 };
    m.amount += s.totalTzs;
    m.tx += 1;
    map.set(s.paymentMethod, m);
  }
  return Array.from(map.values())
    .map((m) => ({ ...m, sharePct: Math.round((m.amount / total) * 1000) / 10 }))
    .sort((a, b) => b.amount - a.amount);
}

export function staffPerformance(sales: readonly IntelSale[]) {
  const map = new Map<string, { actor: string; revenue: number; profit: number; tx: number; units: number; rxTx: number }>();
  for (const s of sales) {
    const key = s.profileId && s.profileId !== "seed" ? s.profileId : s.actorName;
    const r = map.get(key) ?? { actor: s.actorName, revenue: 0, profit: 0, tx: 0, units: 0, rxTx: 0 };
    r.revenue += s.totalTzs;
    r.profit += s.totalTzs - saleCogs(s);
    r.tx += 1;
    r.units += s.itemCount;
    if (s.prescriptionRef) r.rxTx += 1;
    map.set(key, r);
  }
  return Array.from(map.values())
    .map((r) => ({ ...r, aov: r.tx ? Math.round(r.revenue / r.tx) : 0, basket: r.tx ? Math.round((r.units / r.tx) * 10) / 10 : 0 }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function branchComparison(
  sales: readonly IntelSale[],
  batches: readonly IntelBatch[],
  centres: ReadonlyArray<{ id: string; name: string }>,
  now = new Date()
) {
  return centres
    .map((c) => {
      const cs = sales.filter((s) => s.centreId === c.id);
      const val = inventoryValuation(batches.filter((b) => b.centreId === c.id), now);
      const revenue = cs.reduce((s, x) => s + x.totalTzs, 0);
      const profit = cs.reduce((s, x) => s + x.totalTzs - saleCogs(x), 0);
      return {
        centreId: c.id,
        name: c.name,
        revenue,
        profit,
        tx: cs.length,
        marginPct: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0,
        stockAtCost: val.atCost,
        // Stock turn proxy: annualised COGS / stock at cost
        turnover: val.atCost > 0 ? Math.round((((revenue - profit) * 12) / val.atCost) * 10) / 10 : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

export function supplierSpend(orders: readonly IntelOrder[]) {
  const map = new Map<string, { supplier: string; spend: number; orders: number; held: number; released: number; leadDays: number[] }>();
  for (const o of orders) {
    const r = map.get(o.supplierName) ?? { supplier: o.supplierName, spend: 0, orders: 0, held: 0, released: 0, leadDays: [] };
    r.spend += o.totalTzs;
    r.orders += 1;
    if (o.escrowStatus === "escrow_held") r.held += o.totalTzs;
    if (o.escrowStatus === "released") r.released += o.totalTzs;
    if (o.deliveredAt) {
      r.leadDays.push(Math.max(0, (new Date(o.deliveredAt).getTime() - new Date(o.createdAt).getTime()) / DAY_MS));
    }
    map.set(o.supplierName, r);
  }
  return Array.from(map.values())
    .map((r) => ({
      supplier: r.supplier,
      spend: r.spend,
      orders: r.orders,
      held: r.held,
      released: r.released,
      avgLeadDays: r.leadDays.length ? Math.round((r.leadDays.reduce((a, b) => a + b, 0) / r.leadDays.length) * 10) / 10 : null,
    }))
    .sort((a, b) => b.spend - a.spend);
}

/* ------------------------------------------------------------------ */
/* Profit & loss                                                       */
/* ------------------------------------------------------------------ */

export function profitAndLoss(
  sales: readonly IntelSale[],
  expenses: readonly IntelExpense[],
  opts: { days: number; subscriptionMonthlyTzs?: number; vatRate?: number; now?: Date }
) {
  const now = opts.now ?? new Date();
  const startIso = isoDay(new Date(now.getTime() - (opts.days - 1) * DAY_MS));
  const inWindow = <T extends { createdAt: string }>(x: T) => isoDay(x.createdAt) >= startIso;
  const ws = sales.filter(inWindow);
  const revenue = ws.reduce((s, x) => s + x.totalTzs, 0);
  const cogs = ws.reduce((s, x) => s + saleCogs(x), 0);
  const grossProfit = revenue - cogs;
  const we = expenses.filter(inWindow);
  const opexByCategory = new Map<string, number>();
  for (const e of we) opexByCategory.set(e.category, (opexByCategory.get(e.category) ?? 0) + e.amountTzs);
  const subscription = Math.round(((opts.subscriptionMonthlyTzs ?? 0) * opts.days) / 30);
  if (subscription > 0) opexByCategory.set("Cervos subscription", (opexByCategory.get("Cervos subscription") ?? 0) + subscription);
  const opex = Array.from(opexByCategory.values()).reduce((a, b) => a + b, 0);
  const vatRate = opts.vatRate ?? 0.18;
  // Prices are VAT-inclusive at the counter; output VAT = gross * r/(1+r)
  const outputVat = Math.round((revenue * vatRate) / (1 + vatRate));
  const inputVat = Math.round((cogs * vatRate) / (1 + vatRate));
  const netProfit = grossProfit - opex;
  return {
    revenue,
    cogs,
    grossProfit,
    grossMarginPct: revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : 0,
    opex,
    opexByCategory: Array.from(opexByCategory.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
    netProfit,
    netMarginPct: revenue > 0 ? Math.round((netProfit / revenue) * 1000) / 10 : 0,
    outputVat,
    inputVat,
    vatPayable: Math.max(0, outputVat - inputVat),
    breakEvenDailyRevenue:
      grossProfit > 0 && revenue > 0 ? Math.round(opex / opts.days / (grossProfit / revenue)) : null,
  };
}

/* ------------------------------------------------------------------ */
/* Health score + ranked insights                                      */
/* ------------------------------------------------------------------ */

export type ReportView = "brief" | "sales" | "products" | "stock" | "people" | "procurement";

export interface Insight {
  id: string;
  severity: "critical" | "warning" | "opportunity" | "positive";
  title: string;
  detail: string;
  metric?: string;
  target: ReportView | "inventory" | "network" | "operations" | "billing";
}

export function businessHealthScore(input: {
  grossMarginPct: number;
  revenueDeltaPct: number | null;
  writeOffTzs: number;
  stockAtCost: number;
  stockoutRiskCount: number;
  productCount: number;
  digitalSharePct: number;
}) {
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  const margin = clamp((input.grossMarginPct / 35) * 100);
  const growth = input.revenueDeltaPct === null ? 60 : clamp(60 + input.revenueDeltaPct * 2);
  const freshness = input.stockAtCost > 0 ? clamp(100 - (input.writeOffTzs / input.stockAtCost) * 300) : 70;
  const availability = input.productCount > 0 ? clamp(100 - (input.stockoutRiskCount / input.productCount) * 200) : 70;
  const digital = clamp(input.digitalSharePct * 1.2);
  const components = [
    { key: "Margin", score: Math.round(margin), weight: 0.28 },
    { key: "Growth", score: Math.round(growth), weight: 0.22 },
    { key: "Stock freshness", score: Math.round(freshness), weight: 0.2 },
    { key: "Availability", score: Math.round(availability), weight: 0.2 },
    { key: "Digital cash", score: Math.round(digital), weight: 0.1 },
  ];
  const total = Math.round(components.reduce((s, c) => s + c.score * c.weight, 0));
  return {
    total,
    grade: total >= 80 ? "Excellent" : total >= 65 ? "Strong" : total >= 50 ? "Fair" : "At risk",
    components,
  };
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function generateInsights(input: {
  products: readonly ProductIntel[];
  lotRisk: ReturnType<typeof expiryRiskProjection>;
  revenue7: PeriodCompare;
  heat: ReturnType<typeof hourWeekHeatmap>;
  mix: ReturnType<typeof paymentMix>;
  staff: ReturnType<typeof staffPerformance>;
  heldEscrowTzs: number;
  fmt: (n: number) => string;
}): Insight[] {
  const out: Insight[] = [];
  const { fmt } = input;

  const stockouts = input.products
    .filter((p) => p.status === "stockout_risk" && p.daysOfCover !== null)
    .sort((a, b) => (a.daysOfCover ?? 0) - (b.daysOfCover ?? 0));
  if (stockouts.length > 0) {
    const p = stockouts[0];
    out.push({
      id: "stockout",
      severity: "critical",
      title: `${p.brandName} runs out in about ${Math.max(0, Math.round(p.daysOfCover ?? 0))} days`,
      detail: `Selling ${p.velocityPerDay}/day with ${p.onHand} on hand. Reorder ${p.reorderQty} now to keep 21 days of cover.${stockouts.length > 1 ? ` ${stockouts.length - 1} more product(s) are close behind.` : ""}`,
      metric: `${p.daysOfCover}d cover`,
      target: "products",
    });
  }

  if (input.lotRisk.projectedWriteOffTzs > 0) {
    const worst = input.lotRisk.lots[0];
    out.push({
      id: "writeoff",
      severity: input.lotRisk.projectedWriteOffTzs > 100000 ? "critical" : "warning",
      title: `${fmt(input.lotRisk.projectedWriteOffTzs)} of stock will likely expire unsold`,
      detail: worst
        ? `Biggest exposure: ${worst.brandName} lot ${worst.batchNumber} (${worst.atRiskUnits} units, ${worst.daysToExpiry < 0 ? "already expired" : `${worst.daysToExpiry} days left`}). Discount it, transfer it to a branch, or return it to the supplier.`
        : "Review lots nearing expiry.",
      metric: "Projected write-off",
      target: "stock",
    });
  }

  if (input.revenue7.deltaPct !== null) {
    const up = input.revenue7.deltaPct >= 0;
    out.push({
      id: "trend",
      severity: up ? "positive" : "warning",
      title: `Revenue ${up ? "up" : "down"} ${Math.abs(input.revenue7.deltaPct)}% this week`,
      detail: `${fmt(input.revenue7.current)} in the last 7 days against ${fmt(input.revenue7.previous)} the week before.`,
      metric: `${up ? "+" : ""}${input.revenue7.deltaPct}%`,
      target: "sales",
    });
  }

  if (input.heat.peak.value > 0) {
    out.push({
      id: "peak",
      severity: "opportunity",
      title: `Busiest slot: ${WEEKDAYS[input.heat.peak.day]} around ${String(input.heat.peak.hour).padStart(2, "0")}:00`,
      detail: "Put your strongest cashier and a pharmacist on the counter then, and restock fast movers the evening before.",
      target: "sales",
    });
  }

  const dead = input.products.filter((p) => p.status === "dead_stock");
  if (dead.length > 0) {
    out.push({
      id: "dead",
      severity: "warning",
      title: `${dead.length} product(s) have not sold in 30 days`,
      detail: `${dead.slice(0, 3).map((d) => d.brandName).join(", ")}${dead.length > 3 ? " and others" : ""}. That money is tied up on the shelf.`,
      target: "products",
    });
  }

  const marginLeader = [...input.products].filter((p) => p.revenue > 0).sort((a, b) => b.marginPct - a.marginPct)[0];
  if (marginLeader) {
    out.push({
      id: "margin",
      severity: "opportunity",
      title: `${marginLeader.brandName} earns your best margin (${marginLeader.marginPct}%)`,
      detail: "Keep it visible at the counter and always in stock. Each extra unit adds more profit than your average item.",
      target: "products",
    });
  }

  const cash = input.mix.find((m) => m.method === "cash");
  if (cash && cash.sharePct > 45) {
    out.push({
      id: "cash",
      severity: "opportunity",
      title: `${cash.sharePct}% of takings are still cash`,
      detail: "Mobile money settles straight to your wallet and closes shifts with less variance. Show your M-Pesa till number at the counter.",
      target: "billing",
    });
  }

  if (input.heldEscrowTzs > 0) {
    out.push({
      id: "escrow",
      severity: "warning",
      title: `${fmt(input.heldEscrowTzs)} is held in Kasri escrow`,
      detail: "Scan the barcode when goods arrive so the supplier is paid and the lot joins branch stock.",
      target: "network",
    });
  }

  if (input.staff.length > 1) {
    const top = input.staff[0];
    out.push({
      id: "staff",
      severity: "positive",
      title: `${top.actor} leads the counter`,
      detail: `${fmt(top.revenue)} from ${top.tx} receipts (average ${fmt(top.aov)}).`,
      target: "people",
    });
  }

  const rank = { critical: 0, warning: 1, opportunity: 2, positive: 3 } as const;
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
