import { describe, expect, it } from "vitest";
import {
  classifyAbcXyzMatrix,
  classifyReorderUrgency,
  computeSafetyStockRecommendations,
  detectSalesAnomalies,
  holtLinearForecast,
  linearTrendRegression,
  mineBasketAffinities,
  predictCounterStaffingWindows,
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

  it("computes 95% Z-score safety stock, ABC-XYZ demand segmentation, and rush counter staffing windows", () => {
    const now = new Date("2026-11-18T12:00:00Z");
    const sales: IntelSale[] = [1, 2, 3, 4, 5, 6].map((i) => ({
      id: `ml-${i}`,
      actorName: "Cashier",
      totalTzs: 25000,
      itemCount: 3,
      paymentMethod: "cash",
      lines: [
        { productId: "p1", brandName: "Coartem", category: "Malaria", qty: 3, unitPriceTzs: 6500, unitCostTzs: 4800 },
      ],
      createdAt: new Date(2026, 10, 10 + i, 10, 15).toISOString(),
    }));
    const prods: ProductIntel[] = [
      {
        productId: "p1",
        brandName: "Coartem",
        genericName: "AL",
        category: "Malaria",
        unitsSold: 18,
        revenue: 117000,
        cogs: 86400,
        grossProfit: 30600,
        marginPct: 26,
        velocityPerDay: 0.6,
        onHand: 3,
        daysOfCover: 5,
        stockoutDate: "2026-11-23",
        abcClass: "A",
        revenueSharePct: 100,
        trendPct: 12,
        reorderQty: 20,
        status: "stockout_risk",
      },
    ];

    const safety = computeSafetyStockRecommendations(sales, prods, 4, now);
    expect(safety).toHaveLength(1);
    expect(safety[0].safetyStockUnits).toBeGreaterThanOrEqual(2);
    expect(safety[0].status).toBe("under_safety");
    expect(safety[0].recommendedOrderQty).toBeGreaterThan(0);

    const matrix = classifyAbcXyzMatrix(sales, prods, now);
    expect(matrix).toHaveLength(1);
    expect(matrix[0].abcClass).toBe("A");
    expect(["X", "Y", "Z"]).toContain(matrix[0].xyzClass);

    const staffing = predictCounterStaffingWindows(sales);
    expect(staffing.length).toBeGreaterThan(0);
    expect(staffing[0].hourLabel).toBe("10:00");
  });
});
