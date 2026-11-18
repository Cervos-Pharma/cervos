import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  deriveAdminSessionToken,
  getHqPortalGateSlug,
  HQ_COOKIE_NAME,
  isHqMockMode,
  isHqSecretConfigured,
  isValidHQToken,
  verifyHqPortalGateSlug,
  verifyHQSecretInput,
} from "@/lib/hq-auth";
import { GET as legacyHqGet, POST as legacyHqPost } from "@/app/api/workspace/hq/route";
import { GET as dispatchGet, POST as dispatchPost } from "@/app/api/ops-v9k4m/dispatch/route";
import { POST as sessionPost } from "@/app/api/ops-v9k4m/session/route";
import { createWorkspaceSupportTicket, getWorkspaceDb } from "@/lib/workspace/store";

const TEST_SECRET = "cervos-test-hq-secret-2026-strong-key-0123456789";

describe("Obfuscated Ops Auth & Dispatch Telemetry API", () => {
  const prevEnv = { ...process.env };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_MOCK_MODE = "false";
    process.env.CERVOS_MOCK_AUTH = "false";
    process.env.HQ_SECRET = TEST_SECRET;
    delete process.env.HQ_OPERATOR_PIN;
  });

  afterEach(() => {
    process.env = { ...prevEnv };
  });

  it("validates clearance secrets, signed v2 tokens, and non-guessable portal gates", () => {
    expect(isHqMockMode()).toBe(false);
    expect(isHqSecretConfigured()).toBe(true);
    expect(verifyHQSecretInput(TEST_SECRET)).toBe(true);
    expect(verifyHQSecretInput("wrong-secret")).toBe(false);

    const gate = getHqPortalGateSlug();
    expect(verifyHqPortalGateSlug(gate)).toBe(true);
    expect(verifyHqPortalGateSlug("hq")).toBe(false);

    const token = deriveAdminSessionToken(TEST_SECRET, "ops-lead", "ops_admin");
    expect(isValidHQToken(token)).toBe(true);
    expect(isValidHQToken(`${token}tamper`)).toBe(false);
    expect(isValidHQToken(undefined)).toBe(false);
  });

  it("never bypasses HQ auth when token is missing even in mock mode, and returns 404 on retired /api/workspace/hq", async () => {
    process.env.CERVOS_MOCK_AUTH = "true";
    expect(isHqMockMode()).toBe(true);
    expect(isValidHQToken(undefined)).toBe(false);

    const mockToken = deriveAdminSessionToken(TEST_SECRET, "mock-ops", "ops_admin");
    expect(isValidHQToken(mockToken)).toBe(true);

    expect((await legacyHqGet()).status).toBe(404);
    expect((await legacyHqPost()).status).toBe(404);
  });

  it("authenticates via obfuscated /api/ops-v9k4m/session only with valid gate + key", async () => {
    const gate = getHqPortalGateSlug();

    const wrongGateRes = await sessionPost(
      new NextRequest("http://localhost:3000/api/ops-v9k4m/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", gateSlug: "bad-gate", secret: TEST_SECRET }),
      })
    );
    expect(wrongGateRes.status).toBe(404);

    const badRes = await sessionPost(
      new NextRequest("http://localhost:3000/api/ops-v9k4m/session", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Ops-Gate": gate },
        body: JSON.stringify({ action: "login", gateSlug: gate, secret: "invalid-secret" }),
      })
    );
    expect(badRes.status).toBe(401);

    const okRes = await sessionPost(
      new NextRequest("http://localhost:3000/api/ops-v9k4m/session", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Ops-Gate": gate },
        body: JSON.stringify({
          action: "login",
          gateSlug: gate,
          secret: TEST_SECRET,
          operatorName: "Amina Ops",
        }),
      })
    );
    expect(okRes.status).toBe(200);
    const cookie = okRes.cookies.get(HQ_COOKIE_NAME);
    expect(cookie?.value).toBeTruthy();
    expect(isValidHQToken(cookie?.value)).toBe(true);
  });

  it("serves sanitized fleet telemetry and executes lock, billing, message, and update actions cleanly", async () => {
    const token = deriveAdminSessionToken(TEST_SECRET, "ops-lead", "ops_admin");

    const fleetReq = new NextRequest("http://localhost:3000/api/ops-v9k4m/dispatch?scope=fleet", {
      method: "GET",
      headers: {
        Authorization: `OpsToken ${token}`,
      },
    });
    const fleetRes = await dispatchGet(fleetReq);
    expect(fleetRes.status).toBe(200);
    const fleetJson = await fleetRes.json();
    expect(fleetJson.scope).toBe("fleet");
    expect(Array.isArray(fleetJson.accounts)).toBe(true);
    expect(fleetJson.accounts.length).toBeGreaterThanOrEqual(2);
    expect(fleetJson.fleetSummary).toBeDefined();
    expect(JSON.stringify(fleetJson.accounts)).not.toContain("passwordHash");
    expect(JSON.stringify(fleetJson.accounts)).not.toContain("pinHash");

    const targetAccountId = fleetJson.accounts[0].id as string;

    const msgRes = await dispatchPost(
      new NextRequest("http://localhost:3000/api/ops-v9k4m/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Ops-Session": token },
        body: JSON.stringify({
          action: "send_message",
          accountId: targetAccountId,
          title: "Ops Verification Check",
          swTitle: "Ukaguzi wa HQ",
          body: "Confirm TMDA batch ledger before close of day.",
          severity: "action",
          ctaTarget: "reports",
        }),
      })
    );
    expect(msgRes.status).toBe(200);
    expect((await msgRes.json()).hqMessage.title).toBe("Ops Verification Check");

    const lockRes = await dispatchPost(
      new NextRequest("http://localhost:3000/api/ops-v9k4m/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `${HQ_COOKIE_NAME}=${token}` },
        body: JSON.stringify({ action: "lock_account", accountId: targetAccountId, reason: "Audit hold" }),
      })
    );
    expect(lockRes.status).toBe(200);
    expect((await lockRes.json()).accessLock).toMatchObject({ locked: true, source: "hq" });

    const unlockRes = await dispatchPost(
      new NextRequest("http://localhost:3000/api/ops-v9k4m/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `${HQ_COOKIE_NAME}=${token}` },
        body: JSON.stringify({ action: "unlock_account", accountId: targetAccountId }),
      })
    );
    expect(unlockRes.status).toBe(200);
    expect((await unlockRes.json()).accessLock.locked).toBe(false);

    const overdueRes = await dispatchPost(
      new NextRequest("http://localhost:3000/api/ops-v9k4m/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `${HQ_COOKIE_NAME}=${token}` },
        body: JSON.stringify({ action: "set_billing_overdue", accountId: targetAccountId, overdue: true }),
      })
    );
    expect(overdueRes.status).toBe(200);
    expect((await overdueRes.json()).accessLock).toMatchObject({ locked: true, source: "billing" });

    const clearRes = await dispatchPost(
      new NextRequest("http://localhost:3000/api/ops-v9k4m/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `${HQ_COOKIE_NAME}=${token}` },
        body: JSON.stringify({
          action: "set_billing_overdue",
          accountId: targetAccountId,
          overdue: false,
          restoreSubscription: true,
        }),
      })
    );
    expect(clearRes.status).toBe(200);
    expect((await clearRes.json()).accessLock.locked).toBe(false);

    const pubRes = await dispatchPost(
      new NextRequest("http://localhost:3000/api/ops-v9k4m/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `${HQ_COOKIE_NAME}=${token}` },
        body: JSON.stringify({
          action: "publish_hq_update",
          tag: "COMPLIANCE",
          title: "TMDA Cold-Chain Checklist",
          summary: "Daily fridge temperature log verification is now active.",
          ctaLabel: "Open Reports",
          ctaTarget: "reports",
        }),
      })
    );
    expect(pubRes.status).toBe(200);
    const createdId = (await pubRes.json()).hqUpdate.id as string;

    const delRes = await dispatchPost(
      new NextRequest("http://localhost:3000/api/ops-v9k4m/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `${HQ_COOKIE_NAME}=${token}` },
        body: JSON.stringify({ action: "delete_hq_update", updateId: createdId }),
      })
    );
    expect(delRes.status).toBe(200);

    // Enforces 5,000 TZS per-branch minimum floor when HQ configures pricing packages
    const lowPkgRes = await dispatchPost(
      new NextRequest("http://localhost:3000/api/ops-v9k4m/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `${HQ_COOKIE_NAME}=${token}` },
        body: JSON.stringify({
          action: "upsert_package",
          id: "too_cheap",
          name: "Too Cheap Plan",
          pricePerBranchMonthlyTzs: 2500,
          priceMonthlyTzs: 2500,
        }),
      })
    );
    expect(lowPkgRes.status).toBe(400);

    const okPkgRes = await dispatchPost(
      new NextRequest("http://localhost:3000/api/ops-v9k4m/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `${HQ_COOKIE_NAME}=${token}` },
        body: JSON.stringify({
          action: "upsert_package",
          id: "district_duo",
          name: "District Branch Plan",
          audience: "pharmacy",
          pricePerBranchMonthlyTzs: 5000,
          priceMonthlyTzs: 5000,
          includedAdminsPerBranch: 1,
          includedOperatorsPerBranch: 1,
        }),
      })
    );
    expect(okPkgRes.status).toBe(200);
    const okPkgJson = await okPkgRes.json();
    expect(okPkgJson.pkg.pricePerBranchMonthlyTzs).toBe(5000);
    expect(okPkgJson.pkg.includedAdminsPerBranch).toBe(1);
    expect(okPkgJson.pkg.includedOperatorsPerBranch).toBe(1);

    const rmPkgRes = await dispatchPost(
      new NextRequest("http://localhost:3000/api/ops-v9k4m/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `${HQ_COOKIE_NAME}=${token}` },
        body: JSON.stringify({ action: "delete_package", id: "district_duo" }),
      })
    );
    expect(rmPkgRes.status).toBe(200);

    // HQ branch terminal command dispatch
    const firstCentreId = fleetJson.accounts[0]?.centres?.[0]?.id as string;
    const cmdRes = await dispatchPost(
      new NextRequest("http://localhost:3000/api/ops-v9k4m/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `${HQ_COOKIE_NAME}=${token}` },
        body: JSON.stringify({
          action: "branch_command",
          accountId: targetAccountId,
          centreId: firstCentreId,
          cmd: "force_sync",
        }),
      })
    );
    expect(cmdRes.status).toBe(200);
  });

  it("onboards HQ workers with invite codes, enforces RBAC clearance, answers support tickets, and logs team notes", async () => {
    const masterToken = deriveAdminSessionToken(TEST_SECRET, "master-key", "hq_master");
    const gate = getHqPortalGateSlug();
    const email = `amina.support.${Date.now()}@cervos.online`;

    // 1. HQ Master invites a Support Specialist
    const inviteRes = await dispatchPost(
      new NextRequest("http://localhost:3000/api/ops-v9k4m/dispatch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `OpsToken ${masterToken}`,
        },
        body: JSON.stringify({
          action: "create_hq_worker",
          name: "Amina Yusuf",
          email,
          role: "support_specialist",
          region: "Dar es Salaam HQ",
        }),
      })
    );
    expect(inviteRes.status).toBe(200);
    const inviteJson = await inviteRes.json();
    expect(inviteJson.inviteCode).toMatch(/^CVHQ-/);
    expect(inviteJson.worker.status).toBe("invited");
    expect(inviteJson.worker.role).toBe("support_specialist");

    // 2. Worker claims invite with permanent password & PIN, receiving scoped token
    const claimRes = await sessionPost(
      new NextRequest("http://localhost:3000/api/ops-v9k4m/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Ops-Gate": gate,
          "X-Ops-Mode": "bearer",
        },
        body: JSON.stringify({
          action: "claim_worker_invite",
          gateSlug: gate,
          email,
          inviteCode: inviteJson.inviteCode,
          password: "StrongSupportPass!2026",
          pin: "4917",
        }),
      })
    );
    expect(claimRes.status).toBe(200);
    const claimJson = await claimRes.json();
    expect(claimJson.role).toBe("support_specialist");
    const workerToken = claimJson.token as string;
    expect(isValidHQToken(workerToken)).toBe(true);

    // Worker signs back in via email + password + PIN
    const loginRes = await sessionPost(
      new NextRequest("http://localhost:3000/api/ops-v9k4m/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Ops-Gate": gate,
          "X-Ops-Mode": "bearer",
        },
        body: JSON.stringify({
          action: "login_credentials",
          gateSlug: gate,
          email,
          password: "StrongSupportPass!2026",
          workerPin: "4917",
        }),
      })
    );
    expect(loginRes.status).toBe(200);

    // 3. Support Specialist is blocked from Master-only actions (RBAC 403)
    const blockedRes = await dispatchPost(
      new NextRequest("http://localhost:3000/api/ops-v9k4m/dispatch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `OpsToken ${workerToken}`,
        },
        body: JSON.stringify({
          action: "upsert_package",
          id: "unauthorized_pkg",
          name: "Should Fail",
          pricePerBranchMonthlyTzs: 15000,
          priceMonthlyTzs: 15000,
        }),
      })
    );
    expect(blockedRes.status).toBe(403);

    // 4. Support Specialist answers a live customer ticket & posts HQ shift note
    const db = getWorkspaceDb();
    const targetAccount = db.accounts[0];
    const ticket = createWorkspaceSupportTicket(db, {
      accountId: targetAccount?.id ?? null,
      orgName: targetAccount?.orgName,
      contactEmail: targetAccount?.email ?? "owner@pharmacy.co.tz",
      subject: "Counter Receipt Printer Pairing Help",
      message: "Need help reconnecting Bluetooth 58mm thermal printer.",
      category: "technical",
      source: "workspace",
    });

    const replyRes = await dispatchPost(
      new NextRequest("http://localhost:3000/api/ops-v9k4m/dispatch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `OpsToken ${workerToken}`,
        },
        body: JSON.stringify({
          action: "reply_support_ticket",
          ticketId: ticket.id,
          replyBody: "Reconnect Bluetooth under Settings -> Counter Hardware and print a test slip.",
          nextStatus: "waiting_user",
        }),
      })
    );
    expect(replyRes.status).toBe(200);
    const replyJson = await replyRes.json();
    expect(replyJson.ticket.status).toBe("waiting_user");
    expect(replyJson.ticket.replies).toHaveLength(1);
    expect(
      (db.hqMessages ?? []).some(
        (m) => m.accountId === targetAccount?.id && m.title.includes(ticket.ticketRef)
      )
    ).toBe(true);

    const noteRes = await dispatchPost(
      new NextRequest("http://localhost:3000/api/ops-v9k4m/dispatch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `OpsToken ${workerToken}`,
        },
        body: JSON.stringify({
          action: "post_hq_team_note",
          topic: "shift_handoff",
          body: `Handing over ${ticket.ticketRef} to night shift for confirmation.`,
          pinned: true,
        }),
      })
    );
    expect(noteRes.status).toBe(200);
    const noteJson = await noteRes.json();
    expect(noteJson.note.pinned).toBe(true);

    // 5. Master suspends worker -> immediate 403 rejection on active token
    const suspRes = await dispatchPost(
      new NextRequest("http://localhost:3000/api/ops-v9k4m/dispatch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `OpsToken ${masterToken}`,
        },
        body: JSON.stringify({
          action: "update_hq_worker",
          workerId: inviteJson.worker.id,
          status: "suspended",
        }),
      })
    );
    expect(suspRes.status).toBe(200);

    const suspendedCall = await dispatchPost(
      new NextRequest("http://localhost:3000/api/ops-v9k4m/dispatch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `OpsToken ${workerToken}`,
        },
        body: JSON.stringify({
          action: "post_hq_team_note",
          topic: "general",
          body: "Should be rejected because account is suspended.",
        }),
      })
    );
    expect(suspendedCall.status).toBe(403);
  });
});
