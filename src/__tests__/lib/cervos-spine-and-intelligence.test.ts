import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  appendSpineEvent,
  buildModelScorecards,
  buildPromiseBoard,
  checkEscrowFundsIntegrity,
  computeEffectiveAccessState,
  deterministicLegacyUuid,
  ensureSpineBackfill,
  evaluateReadinessGates,
  executePrivacyGatewayQuery,
  generateAgentDraftProposals,
  generateUuidV7,
  issueAndTraceRecall,
  nextHlc,
  resolveProductAlias,
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
  });
});
