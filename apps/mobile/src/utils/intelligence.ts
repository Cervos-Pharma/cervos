import type { WorkspaceBatch, WorkspaceExpense, WorkspaceSale } from "@/types/workspace";

const DAY_MS = 86_400_000;

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
