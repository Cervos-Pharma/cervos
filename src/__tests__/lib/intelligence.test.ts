import { describe, expect, it } from "vitest";
import {
  buildDailySeries,
  businessHealthScore,
  comparePeriods,
  expiryRiskProjection,
  forecastRevenue,
  productIntelligence,
  profitAndLoss,
  type IntelBatch,
  type IntelSale,
} from "@/lib/workspace/intelligence";

const NOW = new Date("2026-11-17T12:00:00Z");

describe("Business Intelligence Engine", () => {
  const batches: IntelBatch[] = [
    {
      id: "b1",
      centreId: "c1",
      productId: "p1",
      brandName: "Coartem",
      genericName: "Artemether/Lumefantrine",
      category: "Antimalarials",
      batchNumber: "LOT-1",
      quantity: 30,
      costPriceTzs: 5000,
      salePriceTzs: 7000,
      expiryDate: "2026-11-27", // 10 days left
      requiresPrescription: true,
      quarantined: false,
    },
    {
      id: "b2",
      centreId: "c1",
      productId: "p2",
      brandName: "Panadol Extra",
      genericName: "Paracetamol",
      category: "Analgesics",
      batchNumber: "LOT-2",
      quantity: 100,
      costPriceTzs: 1000,
      salePriceTzs: 2000,
      expiryDate: "2027-06-01",
      requiresPrescription: false,
      quarantined: false,
    },
  ];

  const sales: IntelSale[] = Array.from({ length: 14 }, (_, i) => ({
    id: `s-${i}`,
    centreId: "c1",
    actorName: "Neema",
    totalTzs: 22000,
    itemCount: 3,
    paymentMethod: i % 2 === 0 ? "mpesa" : "cash",
    lines: [
      {
        productId: "p1",
        brandName: "Coartem",
        category: "Antimalarials",
        qty: 2,
        unitPriceTzs: 7000,
        unitCostTzs: 5000,
      },
      {
        productId: "p2",
        brandName: "Panadol Extra",
        category: "Analgesics",
        qty: 4,
        unitPriceTzs: 2000,
        unitCostTzs: 1000,
      },
    ],
    createdAt: new Date(NOW.getTime() - i * 86400000).toISOString(),
  }));

  it("builds daily revenue and exact COGS series + compares windows", () => {
    const series = buildDailySeries(sales, 14, NOW);
    expect(series).toHaveLength(14);
    expect(series[13].revenue).toBe(22000);
    expect(series[13].cogs).toBe(14000);
    expect(series[13].profit).toBe(8000);

    const delta = comparePeriods(series, 7, "revenue");
    expect(delta.current).toBe(7 * 22000);
    expect(delta.previous).toBe(7 * 22000);
    expect(delta.deltaPct).toBe(0);
  });

  it("computes ABC Pareto classes, gross margin, EWMA velocity, and expiry write-off risk", () => {
    const prods = productIntelligence(sales, batches, { windowDays: 14, now: NOW });
    expect(prods).toHaveLength(2);
    expect(prods[0].productId).toBe("p1");
    expect(prods[0].abcClass).toBe("A");
    expect(prods[1].marginPct).toBe(50);

    const velMap = new Map(prods.map((p) => [p.productId, p.velocityPerDay]));
    const risk = expiryRiskProjection(batches, velMap, NOW);
    // LOT-1 has 30 units expiring in 10d selling ~2/d -> ~10 unsold units at 5000 cost = 50000 risk
    expect(risk.projectedWriteOffTzs).toBeGreaterThan(0);
    expect(risk.buckets.d0_30.units).toBe(30);
  });

  it("computes 7-day forecast, P&L statement with OPEX + VAT, and health score", () => {
    const series = buildDailySeries(sales, 14, NOW);
    const fc = forecastRevenue(series, 7, NOW);
    expect(fc).toHaveLength(7);
    expect(fc[0].expected).toBeGreaterThan(0);

    const pnl = profitAndLoss(
      sales,
      [{ category: "Rent", amountTzs: 50000, createdAt: NOW.toISOString() }],
      { days: 14, subscriptionMonthlyTzs: 30000, now: NOW }
    );
    expect(pnl.revenue).toBe(14 * 22000);
    expect(pnl.cogs).toBe(14 * 14000);
    expect(pnl.netProfit).toBe(14 * 8000 - 64000);
    expect(pnl.vatPayable).toBeGreaterThan(0);

    const score = businessHealthScore({
      grossMarginPct: pnl.grossMarginPct,
      revenueDeltaPct: 12,
      writeOffTzs: 25000,
      stockAtCost: 250000,
      stockoutRiskCount: 0,
      productCount: 2,
      digitalSharePct: 50,
    });
    expect(score.total).toBeGreaterThan(60);
    expect(score.components).toHaveLength(5);
  });
});
