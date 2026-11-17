import { describe, expect, it } from "vitest";
import {
  classifyReorderUrgency,
  detectSalesAnomalies,
  holtLinearForecast,
  linearTrendRegression,
  mineBasketAffinities,
} from "@/lib/workspace/edge-ml";
import type { DailyPoint, IntelSale, ProductIntel } from "@/lib/workspace/intelligence";

describe("On-Device Edge ML Engine", () => {
  const risingSeries: DailyPoint[] = Array.from({ length: 14 }, (_, i) => ({
    date: `2026-11-${String(i + 1).padStart(2, "0")}`,
    revenue: 10000 + i * 2500 + (i === 10 ? 45000 : 0),
    cogs: 7000,
    profit: 3000 + i * 2500,
    tx: 2,
    units: 4,
  }));

  it("computes Holt double exponential forecast and OLS rising trend", () => {
    const fc = holtLinearForecast(risingSeries, 7);
    expect(fc).toHaveLength(7);
    expect(fc[0].predicted).toBeGreaterThan(20000);
    expect(fc[6].high).toBeGreaterThanOrEqual(fc[6].predicted);

    const ols = linearTrendRegression(risingSeries);
    expect(ols.direction).toBe("rising");
    expect(ols.slopePerDayTzs).toBeGreaterThan(0);
    expect(ols.rSquared).toBeGreaterThan(0);
  });

  it("detects trading day spike anomaly using robust MAD z-score", () => {
    const anomalies = detectSalesAnomalies(risingSeries, 2.0);
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0].kind).toBe("spike");
    expect(anomalies[0].date).toBe("2026-11-11");
  });

  it("mines co-dispense basket affinities and classifies reorder urgency", () => {
    const sales: IntelSale[] = [1, 2, 3, 4].map((i) => ({
      id: `s-${i}`,
      actorName: "Cashier",
      totalTzs: 9000,
      itemCount: 2,
      paymentMethod: "mpesa",
      lines: [
        { productId: "p1", brandName: "Coartem", category: "Malaria", qty: 1, unitPriceTzs: 6500, unitCostTzs: 5000 },
        { productId: "p2", brandName: "Panadol", category: "Pain", qty: 1, unitPriceTzs: 2500, unitCostTzs: 1500 },
      ],
      createdAt: "2026-11-16T10:00:00Z",
    }));

    const pairs = mineBasketAffinities(sales, 2);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].confidencePct).toBe(100);
    expect(pairs[0].pairCount).toBe(4);

    const prods: ProductIntel[] = [
      {
        productId: "p1",
        brandName: "Coartem",
        genericName: "AL",
        category: "Malaria",
        unitsSold: 40,
        revenue: 260000,
        cogs: 180000,
        grossProfit: 80000,
        marginPct: 30.8,
        velocityPerDay: 4,
        onHand: 12,
        daysOfCover: 3,
        stockoutDate: "2026-11-20",
        abcClass: "A",
        revenueSharePct: 80,
        trendPct: 25,
        reorderQty: 84,
        status: "stockout_risk",
      },
    ];
    const scored = classifyReorderUrgency(prods);
    expect(scored[0].tier).toBe("urgent");
    expect(scored[0].score).toBeGreaterThanOrEqual(85);
  });
});
