import crypto from "crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  allocateFefoBatches,
  clampDiscount,
  deduplicateSalesRevenue,
  formatTzs,
  parseGs1Barcode,
  reconcileCashShift,
  resolvePermissions,
} from "@cervos/core";
import {
  buildAnonymizedTelemetryVector,
  computeInventoryIntelligence,
  matchHospitalStockoutWithNearbySurplus,
} from "@cervos/intelligence";
import {
  buildBatchRecallAlertSms,
  buildOrderDispatchSms,
  buildPrescriptionClaimSms,
  getMessage,
  maskMsisdn,
  normalizeMsisdn,
  sendOtp,
  sendSms,
  smsSegments,
  verifyOtp,
  type FetchLike,
  type TextifyConfig,
} from "@cervos/textify";
import { verifyWebhookSignature } from "@/lib/payme";

function createRecorder(responses: Array<{ status?: number; body?: unknown }> = [{ status: 201 }]) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const next = responses[Math.min(calls.length - 1, responses.length - 1)]!;
    return new Response(JSON.stringify(next.body ?? { success: true, data: null }), {
      status: next.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  return { calls, fetchImpl };
}

describe("@cervos/core clinical, money & RBAC primitives", () => {
  it("formats TZS currency cleanly without dollar prefixes and clamps discounts", () => {
    expect(formatTzs(12500.4)).toBe("TZS 12,500");
    expect(formatTzs(2_500_000, { compact: true })).toBe("TZS 2.5M");
    expect(clampDiscount(10_000, 15_000)).toBe(10_000);
    expect(clampDiscount(10_000, -500)).toBe(0);
    expect(clampDiscount(10_000, 2_500, 0.2)).toBe(2_000);
  });

  it("deduplicates multi-item joined sale headers so N items never multiply revenue by N", () => {
    const result = deduplicateSalesRevenue([
      { saleId: "sale-1", saleTotalTzs: 25_000 },
      { saleId: "sale-1", saleTotalTzs: 25_000 },
      { saleId: "sale-1", saleTotalTzs: 25_000 },
      { saleId: "sale-2", saleTotalTzs: 12_000 },
    ]);
    expect(result).toEqual({ totalRevenueTzs: 37_000, uniqueSaleCount: 2 });
  });

  it("enforces FEFO ordering, blocks expired/quarantined batches, and gates Rx & Schedule IV items", () => {
    const batches = [
      { id: "b-expired", batchNumber: "EXP01", quantity: 20, expiryDate: "2026-10-01" },
      { id: "b-quarantined", batchNumber: "REC01", quantity: 30, expiryDate: "2026-12-15", quarantined: true },
      { id: "b-late", batchNumber: "LAT01", quantity: 10, expiryDate: "2027-06-01" },
      { id: "b-soon", batchNumber: "SOO01", quantity: 4, expiryDate: "2026-12-01" },
    ];

    const fefo = allocateFefoBatches(batches, 7, { referenceDate: "2026-11-14" });
    expect(fefo.ok).toBe(true);
    expect(fefo.excludedExpiredCount).toBe(1);
    expect(fefo.excludedQuarantinedCount).toBe(1);
    expect(fefo.allocations).toEqual([
      {
        batchId: "b-soon",
        batchNumber: "SOO01",
        quantityAllocated: 4,
        remainingAfterAllocation: 0,
        expiryDate: "2026-12-01",
      },
      {
        batchId: "b-late",
        batchNumber: "LAT01",
        quantityAllocated: 3,
        remainingAfterAllocation: 7,
        expiryDate: "2027-06-01",
      },
    ]);

    const rxMissing = allocateFefoBatches(batches, 2, {
      referenceDate: "2026-11-14",
      requiresPrescription: true,
    });
    expect(rxMissing.ok).toBe(false);

    const scheduleIvWithoutPharmacist = allocateFefoBatches(batches, 2, {
      referenceDate: "2026-11-14",
      isControlled: true,
      prescriptionRef: "RX-990",
    });
    expect(scheduleIvWithoutPharmacist.ok).toBe(false);

    const scheduleIvAuthorized = allocateFefoBatches(batches, 2, {
      referenceDate: "2026-11-14",
      isControlled: true,
      claimToken: "CLM-123456",
      pharmacistLicenseNo: "PC-TZ-4421",
    });
    expect(scheduleIvAuthorized.ok).toBe(true);
  });

  it("parses parenthesized & FNC1 GS1 barcodes and falls back cleanly for plain SKUs", () => {
    const hri = parseGs1Barcode("(01)06291041500213(17)271231(10)BATCH09A(21)SN991");
    expect(hri).toMatchObject({
      format: "gs1",
      gtin: "06291041500213",
      expiryDate: "2027-12-31",
      batchNumber: "BATCH09A",
      serialNumber: "SN991",
    });

    const fnc1 = parseGs1Barcode("01062910415002131727020010LOT88\u001d21SER02");
    expect(fnc1).toMatchObject({
      format: "gs1",
      gtin: "06291041500213",
      expiryDate: "2027-02-28",
      batchNumber: "LOT88",
      serialNumber: "SER02",
    });

    const sku = parseGs1Barcode("6291041500213");
    expect(sku.format).toBe("sku");
    expect(sku.gtin).toBe("6291041500213");
  });

  it("reconciles shift expected cash, refunds, and variance accurately", () => {
    const recon = reconcileCashShift({
      openingCashTzs: 50_000,
      cashSalesTzs: 125_000,
      cashRefundsTzs: 5_000,
      mobileMoneySalesTzs: 40_000,
      declaredCashTzs: 168_000,
    });
    expect(recon.expectedCashTzs).toBe(170_000);
    expect(recon.varianceTzs).toBe(-2_000);
    expect(recon.status).toBe("shortage");
  });

  it("resolves distinct least-privilege capabilities across the 8 Cervos OS stakeholders", () => {
    expect(resolvePermissions("patient")).toMatchObject({
      stakeholder: "patient",
      canViewCostMargins: false,
      canBroadcastRecall: false,
    });
    expect(resolvePermissions("pharmacy_owner")).toMatchObject({
      stakeholder: "business_owner",
      canManageBranches: true,
      canViewCostMargins: true,
    });
    expect(resolvePermissions("pos_cashier")).toMatchObject({
      stakeholder: "business_operator",
      canCloseShift: true,
      canDispenseControlled: false,
      canViewCostMargins: false,
    });
    expect(resolvePermissions("regulator_tmda")).toMatchObject({
      stakeholder: "regulator",
      canBroadcastRecall: true,
      canAccessResearchTelemetry: true,
    });
    expect(resolvePermissions("policy_researcher")).toMatchObject({
      stakeholder: "researcher",
      canAccessResearchTelemetry: true,
      canBroadcastRecall: false,
    });
    expect(resolvePermissions("hospital_pharmacist")).toMatchObject({
      stakeholder: "hospital",
      canRequestHospitalTransfer: true,
      canIssueClaimToken: true,
    });
    expect(resolvePermissions("warehouse_dispatcher")).toMatchObject({
      stakeholder: "supplier",
      canViewCostMargins: false,
    });
    expect(resolvePermissions("physician_prescriber")).toMatchObject({
      stakeholder: "prescriber",
      canIssueClaimToken: true,
      canDispenseControlled: false,
    });
  });
});

describe("@cervos/intelligence forecasting, telemetry & surplus transfer matching", () => {
  it("computes EWMA demand velocity, stockout risk, and 1-click draft PO quantities", () => {
    const forecast = computeInventoryIntelligence({
      productId: "prod-amox-500",
      productName: "Amoxicillin 500mg Caps",
      innName: "Amoxicillin",
      currentStockQty: 12,
      dailySalesSeries: [5, 6, 7, 8, 9, 10],
      leadTimeDays: 3,
      targetCoverDays: 14,
      unitCostTzs: 250,
      expiringWithin60DaysQty: 4,
      preferredSupplierId: "sup-1",
    });

    expect(forecast.stockoutRiskLevel).toBe("critical");
    expect(forecast.recommendedOrderQty).toBeGreaterThan(0);
    expect(forecast.expiryExposureTzs).toBe(1000);
    expect(forecast.draftOrder?.supplierId).toBe("sup-1");
  });

  it("emits de-identified telemetry vectors with WHO AWaRe stewardship triggers", () => {
    const vector = buildAnonymizedTelemetryVector({
      region: "Dar es Salaam",
      atcCode: "J01CR02",
      innName: "Amoxicillin + Clavulanic Acid",
      dosageForm: "Tablet",
      whoAwareClass: "Watch",
      unitsDispensed: 420,
      branchesReporting: 10,
      branchesStockedOut: 3,
      medianDaysOfCover: 6.4,
    });

    expect(vector).toEqual({
      schemaVersion: "cervos-telemetry-v1",
      region: "Dar es Salaam",
      atcCode: "J01CR02",
      innName: "Amoxicillin + Clavulanic Acid",
      dosageForm: "Tablet",
      whoAwareClass: "Watch",
      totalUnitsDispensed: 420,
      stockoutPressureIndex: 0.3,
      medianDaysOfCover: 6.4,
      antimicrobialStewardshipAlert: true,
    });
  });

  it("matches hospital stockouts with safe non-expiring nearby surplus", () => {
    const matches = matchHospitalStockoutWithNearbySurplus(50, "Mwanza", [
      {
        facilityId: "fac-expired-soon",
        facilityName: "Near Expiry Clinic",
        region: "Mwanza",
        productId: "p1",
        batchNumber: "SHORT1",
        surplusQty: 100,
        daysUntilExpiry: 20,
        distanceKm: 1,
      },
      {
        facilityId: "fac-distant",
        facilityName: "Arusha Regional Depot",
        region: "Arusha",
        productId: "p1",
        batchNumber: "FAR1",
        surplusQty: 30,
        daysUntilExpiry: 240,
        distanceKm: 80,
      },
      {
        facilityId: "fac-local",
        facilityName: "Bugando Regional Store",
        region: "Mwanza",
        productId: "p1",
        batchNumber: "MWZ1",
        surplusQty: 35,
        daysUntilExpiry: 180,
        distanceKm: 4,
      },
    ]);

    expect(matches).toHaveLength(2);
    expect(matches[0]).toMatchObject({ sourceFacilityId: "fac-local", transferQty: 35 });
    expect(matches[1]).toMatchObject({ sourceFacilityId: "fac-distant", transferQty: 15 });
  });
});

describe("@cervos/textify SMS & OTP adapter contract", () => {
  const cfg: TextifyConfig = { apiKey: "txf_test_server_secret" };

  it("normalizes Tanzanian MSISDNs, masks logs, and calculates ASCII/UCS-2 segments accurately", () => {
    expect(normalizeMsisdn("0712 345 678")).toBe("255712345678");
    expect(normalizeMsisdn("+255755111222")).toBe("255755111222");
    expect(normalizeMsisdn("712345678")).toBe("255712345678");
    expect(maskMsisdn("0712345678")).toBe("+2557***678");

    expect(smsSegments("x".repeat(160))).toBe(1);
    expect(smsSegments("x".repeat(161))).toBe(2);
    expect(smsSegments("é".repeat(70))).toBe(1);
    expect(smsSegments("é".repeat(71))).toBe(2);
  });

  it("sends SMS with Bearer auth & Idempotency-Key, handles OTP flows, and builds zero-PHI Cervos SMS", async () => {
    const { calls, fetchImpl } = createRecorder([
      { status: 201 },
      { status: 400, body: { success: false, message: "insufficient balance", error: "creation_error" } },
      { status: 200 },
      { status: 200 },
      { status: 200, body: { success: true, data: { id: "msg-99", status: "delivered" } } },
    ]);

    const rxSms = buildPrescriptionClaimSms({
      patientPhone: "0712345678",
      claimToken: "RX-4821",
      branchName: "Kariakoo Branch",
      prescriptionId: "presc-1",
    });
    expect(rxSms.maskedRecipients).toEqual(["+2557***678"]);

    const res1 = await sendSms(cfg, rxSms.input, fetchImpl);
    expect(res1.success).toBe(true);
    expect(calls[0]!.url).toBe("https://portal.textify.africa/api/v1/messages");
    expect((calls[0]!.init.headers as Record<string, string>)["Idempotency-Key"]).toBe("cervos-rx-presc-1");

    const recallSms = buildBatchRecallAlertSms({
      recipients: ["0755111222"],
      drugGenericName: "Paracetamol",
      batchNumber: "PCM-99",
      recallId: "rec-1",
    });
    const res2 = await sendSms(cfg, recallSms.input, fetchImpl);
    expect(res2.success).toBe(false);
    expect(res2.error).toBe("creation_error");

    const otpSend = await sendOtp(cfg, { phoneNumber: "0712345678", brandName: "Cervos" }, fetchImpl);
    expect(otpSend.success).toBe(true);
    expect(calls[2]!.url).toBe("https://portal.textify.africa/api/v1/otps");

    await verifyOtp(cfg, { code: 484895, phoneNumber: "0712345678" }, fetchImpl);
    expect(JSON.parse(String(calls[3]!.init.body)).code).toBe(484895);

    const status = await getMessage(cfg, "msg-99", fetchImpl);
    expect((status.data as { status: string }).status).toBe("delivered");

    const dispatch = buildOrderDispatchSms({
      buyerPhone: "+255755111222",
      orderReference: "ORD-102",
      supplierName: "Shelys Pharma",
      orderId: "ord-102",
    });
    expect(dispatch.input.idempotencyKey).toBe("cervos-dispatch-ord-102");
  });
});

describe("PayMe webhook cryptographic and replay hardening", () => {
  const originalSecret = process.env.PAYME_APP_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.PAYME_APP_SECRET;
    } else {
      process.env.PAYME_APP_SECRET = originalSecret;
    }
  });

  it("rejects empty secrets, forged signatures, future timestamps, and expired replay timestamps", () => {
    const payload = JSON.stringify({ transid: "t1", reference: "ref-1", payment_status: "COMPLETED" });
    const nowSec = Math.floor(Date.now() / 1000);

    delete process.env.PAYME_APP_SECRET;
    expect(verifyWebhookSignature(payload, String(nowSec), "anything")).toBe(false);

    process.env.PAYME_APP_SECRET = "super-secret-hmac-key";
    const sign = (ts: number) =>
      crypto.createHmac("sha256", "super-secret-hmac-key").update(payload + String(ts)).digest("base64");

    expect(verifyWebhookSignature(payload, String(nowSec), sign(nowSec))).toBe(true);
    expect(verifyWebhookSignature(payload, String(nowSec), "forged==")).toBe(false);
    expect(verifyWebhookSignature(payload, String(nowSec + 180), sign(nowSec + 180))).toBe(false);
    expect(verifyWebhookSignature(payload, String(nowSec - 600), sign(nowSec - 600))).toBe(false);
  });
});
