export interface FormatTzsOptions {
  compact?: boolean;
  showSign?: boolean;
}

/**
 * Canonical integer-rounded TZS currency formatter.
 * Always produces `TZS 12,500` (never `TZS $` or `TSh`).
 */
export function formatTzs(
  amount: number | null | undefined,
  options: FormatTzsOptions = {}
): string {
  const numeric = typeof amount === "number" && Number.isFinite(amount) ? Math.round(amount) : 0;
  const abs = Math.abs(numeric);
  const sign = numeric < 0 ? "-" : options.showSign && numeric > 0 ? "+" : "";

  if (options.compact) {
    if (abs >= 1_000_000) {
      const m = (abs / 1_000_000).toFixed(1).replace(/\.0$/, "");
      return `${sign}TZS ${m}M`;
    }
    if (abs >= 10_000) {
      const k = (abs / 1_000).toFixed(1).replace(/\.0$/, "");
      return `${sign}TZS ${k}k`;
    }
  }

  return `${sign}TZS ${abs.toLocaleString("en-US")}`;
}

/**
 * Prevents negative cart totals or unauthorized percentage discounts.
 */
export function clampDiscount(
  subtotalTzs: number,
  rawDiscountTzs: number,
  maxDiscountRatio = 1
): number {
  if (!Number.isFinite(subtotalTzs) || subtotalTzs <= 0) return 0;
  if (!Number.isFinite(rawDiscountTzs) || rawDiscountTzs <= 0) return 0;

  const clampedRatio = Math.min(Math.max(maxDiscountRatio, 0), 1);
  const maxAllowed = Math.floor(subtotalTzs * clampedRatio);
  return Math.min(Math.round(rawDiscountTzs), Math.max(0, maxAllowed));
}

export interface PricedLineItem {
  quantity: number;
  unitPriceTzs: number;
  vatExempt?: boolean;
}

export interface OrderPricingSummary {
  subtotalTzs: number;
  taxableTzs: number;
  vatTzs: number;
  totalTzs: number;
}

export function computeOrderSubtotalAndTax(
  items: readonly PricedLineItem[],
  vatRate = 0.18
): OrderPricingSummary {
  let subtotalTzs = 0;
  let taxableTzs = 0;

  for (const item of items) {
    const qty = Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 0;
    const price = Number.isFinite(item.unitPriceTzs) && item.unitPriceTzs >= 0 ? item.unitPriceTzs : 0;
    const line = Math.round(qty * price);
    subtotalTzs += line;
    if (!item.vatExempt) {
      taxableTzs += line;
    }
  }

  const safeRate = Number.isFinite(vatRate) && vatRate >= 0 ? vatRate : 0;
  const vatTzs = Math.round(taxableTzs * safeRate);

  return {
    subtotalTzs,
    taxableTzs,
    vatTzs,
    totalTzs: subtotalTzs + vatTzs,
  };
}

export interface JoinedSaleRow {
  saleId: string;
  saleTotalTzs: number;
}

/**
 * Deduplicates joined sale-header rows by `saleId` so multi-item SQL joins
 * never multiply revenue by the line-item count (`N * total`).
 */
export function deduplicateSalesRevenue(rows: readonly JoinedSaleRow[]): {
  totalRevenueTzs: number;
  uniqueSaleCount: number;
} {
  const seen = new Map<string, number>();

  for (const row of rows) {
    if (!row.saleId) continue;
    if (!seen.has(row.saleId)) {
      const value = Number.isFinite(row.saleTotalTzs) ? Math.round(row.saleTotalTzs) : 0;
      seen.set(row.saleId, value);
    }
  }

  let totalRevenueTzs = 0;
  for (const value of seen.values()) {
    totalRevenueTzs += value;
  }

  return {
    totalRevenueTzs,
    uniqueSaleCount: seen.size,
  };
}

