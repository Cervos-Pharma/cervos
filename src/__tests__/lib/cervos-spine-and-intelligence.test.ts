import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  appendSpineEvent,
  buildFullIntelligenceDetail,
  buildModelScorecards,
  buildPromiseBoard,
  buildSignedEdgeModelPack,
  checkEscrowFundsIntegrity,
  computeBranchFeatures,
  computeBranchProductFeatures,
  computeCalendarFeatures,
  computeEffectiveAccessState,
  computeLotFeatures,
  computeOrgFeatures,
  computeSupplierFeatures,
  crostonTsbForecast,
  deterministicLegacyUuid,
  ensureSpineBackfill,
  evaluateReadinessGates,
  evaluateRollingOriginBacktest,
  executePrivacyGatewayQuery,
  generateAgentDraftProposals,
  generateUuidV7,
  issueAndTraceRecall,
  nextHlc,
  resolveProductAlias,
  runCatalogDetectors,
  runModel1DemandAndReorder,
  runModel2ExpiryAndRescue,
  runModel3OrgHealthHazard,
  runRedTeamSyntheticDrill,
  verifyOrgHashChain,
} from "@/lib/spine";
import { deriveAdminSessionToken } from "@/lib/hq-auth";
import { GET as dispatchGet, POST as dispatchPost } from "@/app/api/ops-v9k4m/dispatch/route";
import { getWorkspaceDb, type WorkspaceDbSnapshot } from "@/lib/workspace/store";

const TEST_SECRET = "cervos-test-hq-secret-2026-strong-key-0123456789";

describe("Cervos Ontology, Event Spine & Intelligence Layer", () => {
  beforeEach(() => {
    process.env.HQ_SECRET = TEST_SECRET;
    process.env.NEXT_PUBLIC_MOCK_MODE = "false";
    process.env.CERVOS_MOCK_AUTH = "false";
  });

  it("generates time-sortable UUIDv7, deterministic legacy UUIDs, monotonic HLC, and idempotent hash-chained events", () => {
    const u1 = generateUuidV7(1_700_000_000_000);
    const u2 = generateUuidV7(1_700_000_001_000);
    expect(u1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(u2 > u1).toBe(true);

    const mapA = deterministicLegacyUuid("org", "acc_demo_01");
    const mapB = deterministicLegacyUuid("org", "acc_demo_01");
    const mapC = deterministicLegacyUuid("branch", "acc_demo_01");
    expect(mapA).toBe(mapB);
    expect(mapA).not.toBe(mapC);

    const h1 = nextHlc(1_700_000_000_000, undefined, "pos-1");
    const h2 = nextHlc(1_700_000_000_000, h1, "pos-1");
    expect(h2 > h1).toBe(true);

    const db: WorkspaceDbSnapshot = { accounts: [], centres: [], profiles: [], passkeys: [] };
    const first = appendSpineEvent(db, {
      legacyOrgId: "acc_test_1",
      actorKind: "staff",
      type: "sale.completed",
      idempotencyKey: "dev1:101",
      payload: { total_tzs: 12500 },
      piiClass: "none",
      source: "desktop",
    });
    const dup = appendSpineEvent(db, {
      legacyOrgId: "acc_test_1",
      actorKind: "staff",
      type: "sale.completed",
      idempotencyKey: "dev1:101",
      payload: { total_tzs: 99999 },
      piiClass: "none",
      source: "desktop",
    });
    expect(first.deduplicated).toBe(false);
    expect(dup.deduplicated).toBe(true);
    expect(dup.event.eventId).toBe(first.event.eventId);

    appendSpineEvent(db, {
      legacyOrgId: "acc_test_1",
      actorKind: "staff",
      type: "stock.adjusted",
      idempotencyKey: "dev1:102",
      payload: { delta_qty: -2, reason: "damage" },
      piiClass: "none",
      source: "desktop",
    });

    const events = db.spine!.events;
    expect(verifyOrgHashChain(events).verified).toBe(true);

    // Tampering with historical payload must break SHA-256 verification immediately
    const tampered = events.map((ev, idx) =>
      idx === 0 ? { ...ev, payload: { total_tzs: 1 } } : ev
    );
    const checkTamper = verifyOrgHashChain(tampered);
    expect(checkTamper.verified).toBe(false);
    expect(checkTamper.mismatchSeq).toBe(events[0].globalSeq);
  });

  it("resolves ProductMaster aliases cleanly and enforces Access & Escrow state invariants", () => {
    const byBarcode = resolveProductAlias("Random Brand", "Unknown", "ALU20120");
    expect(byBarcode.confidence).toBe(1);
    expect(byBarcode.status).toBe("auto");

    const byStem = resolveProductAlias("Coartem", "Artemether Lumefantrine");
    expect(byStem.masterLabel).toContain("Artemether / Lumefantrine");
    expect(byStem.confidence).toBeGreaterThanOrEqual(0.75);

    const db = getWorkspaceDb();
    ensureSpineBackfill(db);
    const acc = db.accounts[0];
    expect(computeEffectiveAccessState(acc)).toBe(
      acc.hqLock?.locked ? "locked" : acc.billingOverdue ? "overdue" : acc.subscriptionActive ? "active" : "trial"
    );

    const escrowCheck = checkEscrowFundsIntegrity(db.wholesaleOrders ?? []);
    expect(escrowCheck.deltaTzs).toBe(0);
  });

  it("computes Promise Board 7 metrics, readiness gates, scorecards, recalls, and enforces Privacy Gateway k>=5", () => {
    const db = getWorkspaceDb();
    ensureSpineBackfill(db);

    const promises = buildPromiseBoard(db);
    expect(promises).toHaveLength(7);
    expect(promises.find((p) => p.id === "audit_integrity")?.primaryValue).toBe("100%");

    const gates = evaluateReadinessGates(db);
    expect(gates.map((g) => g.id)).toEqual(["G-ID", "G-HIST", "G-COV", "G-LABEL", "G-GROUP"]);

    const scorecards = buildModelScorecards(db, gates);
    expect(scorecards.length).toBeGreaterThanOrEqual(5);

    const recall = issueAndTraceRecall(db, {
      regulatorRef: "TMDA-TEST-01",
      innName: "Amoxicillin",
      batchNumber: "AUTO",
    });
    expect(recall.regulatorRef).toBe("TMDA-TEST-01");
    expect(recall.affectedBranches.length).toBeGreaterThan(0);

    // Small cell test: filtering to a tiny non-5-org region must block release
    const blockedRel = executePrivacyGatewayQuery(db, {
      recipient: "Research Lab",
      project: "Regional Test",
      region: "NoSuchTinyDistrict",
      epsilon: 0.5,
    });
    expect(blockedRel.status).toBe("blocked_small_cell");
    expect(blockedRel.epsilonSpent).toBe(0);

    const redTeam = runRedTeamSyntheticDrill(db);
    expect(redTeam.passedChecks).toBe(redTeam.totalChecks);
  });

  it("serves Spine telemetry, hash verification proof, Decision Inbox & Privacy commands via /api/ops-v9k4m/dispatch", async () => {
    const token = deriveAdminSessionToken(TEST_SECRET, "ops-lead", "hq_master");

    const fleetRes = await dispatchGet(
      new NextRequest("http://localhost:3000/api/ops-v9k4m/dispatch?scope=fleet", {
        headers: { Authorization: `OpsToken ${token}` },
      })
    );
    expect(fleetRes.status).toBe(200);
    const fleetJson = await fleetRes.json();
    expect(fleetJson.spine.chainVerified).toBe(true);
    expect(Array.isArray(fleetJson.promiseBoard)).toBe(true);
    expect(fleetJson.promiseBoard.length).toBe(7);

    const verifyRes = await dispatchGet(
      new NextRequest("http://localhost:3000/api/ops-v9k4m/dispatch?verifyChain=1", {
        headers: { "X-Ops-Session": token },
      })
    );
    expect(verifyRes.status).toBe(200);
    expect((await verifyRes.json()).verified).toBe(true);

    // Autonomy safety: human gate blocks `auto` on billing_grace
    const badAutoRes = await dispatchPost(
      new NextRequest("http://localhost:3000/api/ops-v9k4m/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Ops-Session": token },
        body: JSON.stringify({
          action: "set_autonomy_mode",
          kind: "billing_grace",
          mode: "auto",
        }),
      })
    );
    expect(badAutoRes.status).toBe(403);

    // Generate & approve a proposal cleanly through Command Registry
    const genRes = await dispatchPost(
      new NextRequest("http://localhost:3000/api/ops-v9k4m/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Ops-Session": token },
        body: JSON.stringify({ action: "run_agent_drafts" }),
      })
    );
    expect(genRes.status).toBe(200);
    const genJson = await genRes.json();
    const firstProp = (genJson.proposals ?? []).find((p: { status: string }) => p.status === "proposed");
    if (firstProp) {
      const appRes = await dispatchPost(
        new NextRequest("http://localhost:3000/api/ops-v9k4m/dispatch", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Ops-Session": token },
          body: JSON.stringify({ action: "approve_proposal", proposalId: firstProp.id }),
        })
      );
      expect(appRes.status).toBe(200);
      expect((await appRes.json()).proposal.status).toBe("executed");
    }

    const drillRes = await dispatchPost(
      new NextRequest("http://localhost:3000/api/ops-v9k4m/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Ops-Session": token },
        body: JSON.stringify({ action: "run_red_team_drill" }),
      })
    );
    expect(drillRes.status).toBe(200);
    const drillJson = await drillRes.json();
    expect(drillJson.report.passedChecks).toBe(drillJson.report.totalChecks);

    expect(Array.isArray(fleetJson.intelligenceDetail?.demandReorders)).toBe(true);
    expect(Array.isArray(fleetJson.intelligenceDetail?.shelfExpiryForecasts)).toBe(true);
    expect(Array.isArray(fleetJson.intelligenceDetail?.orgHealthHazards)).toBe(true);
    expect(fleetJson.intelligenceDetail?.edgeModelPack?.hmacSignature).toBeTruthy();
    expect(fleetJson.peakTelemetry?.dailyTimeline?.length).toBe(14);

    // Label an anomaly alert & update Model 3 health weights
    const firstAlertId = fleetJson.intelligenceDetail?.detectorAlerts?.[0]?.id ?? "det_test_1";
    const labelRes = await dispatchPost(
      new NextRequest("http://localhost:3000/api/ops-v9k4m/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Ops-Session": token },
        body: JSON.stringify({ action: "label_anomaly_alert", alertId: firstAlertId, verdict: "real" }),
      })
    );
    expect(labelRes.status).toBe(200);
    expect((await labelRes.json()).verdict).toBe("real");

    const weightsRes = await dispatchPost(
      new NextRequest("http://localhost:3000/api/ops-v9k4m/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Ops-Session": token },
        body: JSON.stringify({
          action: "update_health_weights",
          syncRecency: 30,
          salesTrend: 25,
          shiftCompliance: 15,
          paymentTimeliness: 20,
          ticketAge: 5,
          versionLag: 5,
        }),
      })
    );
    expect(weightsRes.status).toBe(200);
    expect((await weightsRes.json()).healthWeights.syncRecency).toBe(30);

    // Queue Model 1 reorder & Model 2 expiry rescue proposals straight into Decision Inbox
    const reorderTarget = fleetJson.intelligenceDetail?.demandReorders?.[0];
    if (reorderTarget) {
      const m1Res = await dispatchPost(
        new NextRequest("http://localhost:3000/api/ops-v9k4m/dispatch", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Ops-Session": token },
          body: JSON.stringify({
            action: "create_proposal_from_model",
            kind: "reorder_draft",
            branchId: reorderTarget.branchId,
            masterId: reorderTarget.masterId,
          }),
        })
      );
      expect(m1Res.status).toBe(200);
      expect((await m1Res.json()).proposal.kind).toBe("reorder_draft");
    }

    const expiryTarget = fleetJson.intelligenceDetail?.shelfExpiryForecasts?.[0];
    if (expiryTarget) {
      const m2Res = await dispatchPost(
        new NextRequest("http://localhost:3000/api/ops-v9k4m/dispatch", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Ops-Session": token },
          body: JSON.stringify({
            action: "create_proposal_from_model",
            kind: "expiry_rescue",
            branchId: expiryTarget.branchId,
            batchId: expiryTarget.batchId,
          }),
        })
      );
      expect(m2Res.status).toBe(200);
      expect((await m2Res.json()).proposal.kind).toBe("expiry_rescue");
    }
  }, 15000);

  it("computes point-in-time feature views, Model 1-3 outputs, Catalog Detectors, Backtest & signed Edge Pack", () => {
    const asOfIso = "2026-04-28T10:00:00.000Z";
    const cal = computeCalendarFeatures(asOfIso);
    expect(cal.isPaydayWeek).toBe(true);
    expect(cal.rainySeason).toBe("masika_long");

    expect(crostonTsbForecast([2, 0, 0, 3, 0, 2, 0])).toBeGreaterThan(0);

    const db = getWorkspaceDb();
    ensureSpineBackfill(db);

    const firstBatch = (db.batches ?? [])[0];
    const branchForBatch = firstBatch
      ? db.centres.find((c) => c.id === firstBatch.centreId) ?? db.centres[0]
      : db.centres[0];
    if (branchForBatch && firstBatch) {
      const master = resolveProductAlias(firstBatch.brandName, firstBatch.genericName);
      const bpFeat = computeBranchProductFeatures(db, branchForBatch.id, master.masterId, asOfIso);
      expect(bpFeat).not.toBeNull();
      expect(typeof bpFeat?.stockOutDays28d).toBe("number");

      const lotFeat = computeLotFeatures(db, branchForBatch.id, firstBatch.id, asOfIso);
      expect(lotFeat).not.toBeNull();
      const bFeat = computeBranchFeatures(db, branchForBatch.id, asOfIso);
      expect(bFeat).not.toBeNull();
    }

    if (db.accounts[0]) {
      const oFeat = computeOrgFeatures(db, db.accounts[0].id, asOfIso);
      expect(oFeat).not.toBeNull();
    }
    const supFeat = computeSupplierFeatures(db, "Test Supplier", asOfIso);
    expect(supFeat.orderCount).toBeGreaterThanOrEqual(0);

    const reorders = runModel1DemandAndReorder(db, asOfIso);
    expect(Array.isArray(reorders)).toBe(true);
    if (reorders[0]) {
      expect(reorders[0].dailyP90).toBeGreaterThanOrEqual(reorders[0].dailyP50);
      expect(reorders[0].dailyP50).toBeGreaterThanOrEqual(reorders[0].dailyP10);
    }

    const rescues = runModel2ExpiryAndRescue(db, asOfIso);
    expect(Array.isArray(rescues)).toBe(true);
    if (rescues[0]) {
      expect(rescues[0].allRescueOptions).toHaveLength(5);
      expect(rescues[0].probLossPct).toBeGreaterThanOrEqual(0);
      expect(rescues[0].probLossPct).toBeLessThanOrEqual(100);
    }

    const hazards = runModel3OrgHealthHazard(db, { syncRecency: 40, paymentTimeliness: 30 }, asOfIso);
    expect(hazards.length).toBe(db.accounts.length);
    if (hazards[0]) {
      expect(hazards[0].ciHighPct).toBeGreaterThanOrEqual(hazards[0].churnRisk30dPct);
      expect(hazards[0].ciLowPct).toBeLessThanOrEqual(hazards[0].churnRisk30dPct);
    }

    const detectors = runCatalogDetectors(db, asOfIso);
    expect(Array.isArray(detectors.alerts)).toBe(true);
    expect(Array.isArray(detectors.sentinelSignals)).toBe(true);

    const bt = evaluateRollingOriginBacktest(db);
    expect(bt.foldsEvaluated).toBe(4);

    const pack = buildSignedEdgeModelPack(db, asOfIso);
    expect(pack.hmacSignature.length).toBe(24);
    expect(pack.payloadBytes).toBeGreaterThan(20);

    const detail = buildFullIntelligenceDetail(db, asOfIso);
    expect(detail.edgeModelPack.packVersion).toBe(pack.packVersion);
  }, 15000);
});
