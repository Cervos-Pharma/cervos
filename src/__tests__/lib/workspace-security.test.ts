import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import {
  clampProfileCapabilities,
  getWorkspaceDb,
  isAccountAccessLocked,
  publicAccountSummary,
  publicJoinRequestSummary,
  publicProfileSummary,
} from "@/lib/workspace/store";
import { isValidHqSecret } from "@/lib/workspace/env";
import {
  createAccountCookieValue,
  createProfileCookieValue,
  readProfileCookieValue,
} from "@/lib/security/session";
import { hashSecret, normalizeSecurityAnswer } from "@/lib/security/harness";
import { POST as authPost } from "@/app/api/workspace/auth/route";
import { POST as gatePost } from "@/app/api/workspace/gate/route";
import { POST as onboardingPost } from "@/app/api/workspace/onboarding/route";
import { GET as stateGet, POST as statePost } from "@/app/api/workspace/state/route";
import { GET as legacyHqGet } from "@/app/api/workspace/hq/route";
import { GET as opsDispatchGet } from "@/app/api/ops-v9k4m/dispatch/route";
import { GET as healthGet } from "@/app/api/health/route";

function jsonReq(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("Workspace Permissions, Access Lock, and API Security", () => {
  const prevEnv = { ...process.env };

  beforeEach(() => {
    process.env.HQ_SECRET = "test-hq-secret-with-at-least-32-characters-2026";
    process.env.NEXT_PUBLIC_MOCK_MODE = "true";
  });

  afterEach(() => {
    process.env = { ...prevEnv };
  });

  it("enforces immutable capability guardrails via clampProfileCapabilities", () => {
    const cashierCaps = clampProfileCapabilities("pos_cashier", {
      canSellPos: false,
      canViewOwnReports: false,
      canEditInventory: true,
      canManageWholesale: true,
      canViewFinance: true,
      canManageTeam: true,
    });
    expect(cashierCaps.canSellPos).toBe(true);
    expect(cashierCaps.canViewOwnReports).toBe(true);
    expect(cashierCaps.canEditInventory).toBe(false);
    expect(cashierCaps.canManageWholesale).toBe(false);
    expect(cashierCaps.canViewFinance).toBe(false);
    expect(cashierCaps.canManageTeam).toBe(false);

    const researcherCaps = clampProfileCapabilities("policy_researcher", {
      canSellPos: true,
      canEditInventory: true,
      canManageTeam: true,
    });
    expect(researcherCaps.canSellPos).toBe(false);
    expect(researcherCaps.canEditInventory).toBe(false);
    expect(researcherCaps.canManageTeam).toBe(false);
    expect(researcherCaps.canExportReports).toBe(true);

    const adminCaps = clampProfileCapabilities("pos_cashier", { canManageTeam: false, canViewFinance: false }, true);
    expect(adminCaps.canManageTeam).toBe(true);
    expect(adminCaps.canViewFinance).toBe(true);
  });

  it("evaluates HQ, billing overdue, and expired trial locks accurately", () => {
    const db = getWorkspaceDb();
    const base = { ...db.accounts[0], hqLock: undefined, billingOverdue: false, subscriptionActive: true };
    expect(isAccountAccessLocked(base).locked).toBe(false);

    expect(
      isAccountAccessLocked({
        ...base,
        hqLock: { locked: true, reason: "Audit hold", lockedBy: "HQ", lockedAt: "2026-11-17T00:00:00Z" },
      })
    ).toMatchObject({ locked: true, source: "hq" });

    expect(
      isAccountAccessLocked({ ...base, subscriptionActive: false, billingOverdue: true })
    ).toMatchObject({ locked: true, source: "billing" });

    expect(
      isAccountAccessLocked({
        ...base,
        subscriptionActive: false,
        trialEndsAt: "2020-01-01T00:00:00Z",
      })
    ).toMatchObject({ locked: true, source: "billing" });
  });

  it("never leaks sensitive hashes in public summaries", () => {
    const db = getWorkspaceDb();
    const accJson = JSON.stringify(publicAccountSummary(db.accounts[0]));
    expect(accJson).not.toContain("passwordHash");
    expect(accJson).not.toContain("securityAnswerHash");
    expect(accJson).not.toContain(db.accounts[0].passwordHash);

    const profJson = JSON.stringify(publicProfileSummary(db.profiles[0]));
    expect(profJson).not.toContain("pinHash");
    expect(profJson).not.toContain(db.profiles[0].pinHash);

    const req = (db.joinRequests ?? [])[0];
    if (req) {
      const reqJson = JSON.stringify(publicJoinRequestSummary(req));
      expect(reqJson).not.toContain("requesterPasswordHash");
      expect(reqJson).not.toContain(req.requesterPasswordHash);
    }
  });

  it("verifies HQ secret in constant time and rejects missing or placeholder values even in mock mode", () => {
    expect(isValidHqSecret(null)).toBe(false);
    expect(isValidHqSecret("")).toBe(false);
    expect(isValidHqSecret("wrong-secret")).toBe(false);
    expect(isValidHqSecret(process.env.HQ_SECRET)).toBe(true);

    process.env.HQ_SECRET = "REPLACE-WITH-AT-LEAST-32-CHARACTERS-0123456789";
    expect(isValidHqSecret(process.env.HQ_SECRET)).toBe(false);
    expect(isValidHqSecret(null)).toBe(false);
  });

  it("supports bearer clientMode for Expo mobile and prevents cashier escalation via gate directUnlock", async () => {
    const db = getWorkspaceDb();
    const account = db.accounts[0];
    const cashier = db.profiles.find((p) => p.accountId === account.id && p.role === "pos_cashier")!;
    account.requireSecurityEveryTime = true;
    account.securityAnswerHash = hashSecret(normalizeSecurityAnswer("Kariakoo")).hash;

    const signInRes = await authPost(
      jsonReq("http://localhost:3000/api/workspace/auth", {
        action: "signin",
        identifier: cashier.username,
        pin: "6194",
        clientMode: "bearer",
      })
    );
    expect(signInRes.status).toBe(200);
    expect(signInRes.headers.get("cache-control")).toContain("no-store");
    const signInBody = (await signInRes.json()) as {
      ok: boolean;
      redirectTo: string;
      tokens?: { accountToken: string; profileToken?: string };
    };
    expect(signInBody.ok).toBe(true);
    expect(signInBody.redirectTo).toBe("/app/gate?stage=security");
    expect(signInBody.tokens?.accountToken).toBeTruthy();

    // Attempt privilege escalation with directUnlock: true on security gate
    const gateRes = await gatePost(
      jsonReq(
        "http://localhost:3000/api/workspace/gate",
        {
          action: "verify_security",
          answer: "Kariakoo",
          directUnlock: true,
          clientMode: "bearer",
        },
        { Authorization: `Bearer ${signInBody.tokens!.accountToken}` }
      )
    );
    expect(gateRes.status).toBe(200);
    const gateBody = (await gateRes.json()) as { tokens?: { profileToken?: string } };
    const mintedProfile = readProfileCookieValue(gateBody.tokens?.profileToken);
    expect(mintedProfile?.profileId).toBe(cashier.id);
    expect(mintedProfile?.role).toBe("pos_cashier");

    account.requireSecurityEveryTime = false;
  });

  it("blocks repeat onboarding calls once onboardingDone is true", async () => {
    const db = getWorkspaceDb();
    const acc = db.accounts[0];
    const accountToken = createAccountCookieValue(acc.id, acc.email, 3600, "prof_demo_cashier");

    const res = await onboardingPost(
      jsonReq(
        "http://localhost:3000/api/workspace/onboarding",
        {
          address: "Tampered Street",
          phone: "+255700000000",
          securityQuestion: "Hijacked question?",
          securityAnswer: "hijack",
          masterPin: "8392",
        },
        { Authorization: `Bearer ${accountToken}` }
      )
    );
    expect(res.status).toBe(403);
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("redacts financial/operational state pre-unlock and enforces role capabilities on state GET and POST", async () => {
    const db = getWorkspaceDb();
    const acc = db.accounts[0];
    const cashier = db.profiles.find((p) => p.accountId === acc.id && p.role === "pos_cashier")!;
    const accountToken = createAccountCookieValue(acc.id, acc.email, 3600, cashier.id);

    // Pre-unlock GET: no profile token
    const preUnlockRes = await stateGet(
      new NextRequest("http://localhost:3000/api/workspace/state", {
        headers: { Authorization: `Bearer ${accountToken}` },
      })
    );
    expect(preUnlockRes.status).toBe(200);
    const preBody = (await preUnlockRes.json()) as {
      activeProfile: unknown;
      batches: unknown[];
      expenses: unknown[];
      paymentSettings: unknown;
    };
    expect(preBody.activeProfile).toBeNull();
    expect(preBody.batches).toEqual([]);
    expect(preBody.expenses).toEqual([]);
    expect(preBody.paymentSettings).toBeNull();

    // Unlocked cashier GET: finance & audit logs stay hidden
    const cashierProfileToken = createProfileCookieValue(acc.id, cashier.centreId, cashier.id, cashier.role);
    const cashierGetRes = await stateGet(
      new NextRequest("http://localhost:3000/api/workspace/state", {
        headers: {
          Authorization: `Bearer ${accountToken}`,
          "X-Workspace-Profile": cashierProfileToken,
        },
      })
    );
    expect(cashierGetRes.status).toBe(200);
    const cashierBody = (await cashierGetRes.json()) as {
      expenses: unknown[];
      paymentSettings: unknown;
      auditLogs: unknown[];
    };
    expect(cashierBody.expenses).toEqual([]);
    expect(cashierBody.paymentSettings).toBeNull();
    expect(cashierBody.auditLogs).toEqual([]);

    // Researcher profile cannot call dispense_pos (canSellPos = false)
    const researcherProfId = "prof_test_researcher";
    db.profiles.push({
      id: researcherProfId,
      accountId: acc.id,
      centreId: cashier.centreId,
      displayName: "Test Researcher",
      role: "policy_researcher",
      pinHash: hashSecret("4829").hash,
      isMasterAdmin: false,
      createdAt: new Date().toISOString(),
    });
    const researcherToken = createProfileCookieValue(acc.id, cashier.centreId, researcherProfId, "policy_researcher");
    const dispenseBlocked = await statePost(
      jsonReq(
        "http://localhost:3000/api/workspace/state",
        {
          action: "dispense_pos",
          items: [{ productId: "prod-2", qty: 1 }],
        },
        {
          Authorization: `Bearer ${accountToken}`,
          "X-Workspace-Profile": researcherToken,
        }
      )
    );
    expect(dispenseBlocked.status).toBe(403);
    db.profiles = db.profiles.filter((p) => p.id !== researcherProfId);
  });

  it("retires /api/workspace/hq with 404, blocks unauthenticated and joinreq access on obfuscated ops dispatch, and sanitizes /api/health", async () => {
    process.env.NEXT_PUBLIC_MOCK_MODE = "false";
    process.env.CERVOS_MOCK_AUTH = "false";

    const legacyHq = await legacyHqGet();
    expect(legacyHq.status).toBe(404);

    const unauthOps = await opsDispatchGet(new NextRequest("http://localhost:3000/api/ops-v9k4m/dispatch"));
    expect(unauthOps.status).toBe(401);

    const joinReqToken = createAccountCookieValue("joinreq:jreq_demo_zainab", "zainab@pharmacy.co.tz");
    const joinOps = await opsDispatchGet(
      new NextRequest("http://localhost:3000/api/ops-v9k4m/dispatch", {
        headers: { Authorization: `Bearer ${joinReqToken}` },
      })
    );
    expect(joinOps.status).toBe(401);

    process.env.NEXT_PUBLIC_MOCK_MODE = "true";
    const mockUnauthOps = await opsDispatchGet(new NextRequest("http://localhost:3000/api/ops-v9k4m/dispatch"));
    expect(mockUnauthOps.status).toBe(401);

    process.env.NEXT_PUBLIC_MOCK_MODE = "true";
    const healthRes = await healthGet(new NextRequest("http://localhost:3000/api/health"));
    expect(healthRes.status).toBe(200);
    expect(healthRes.headers.get("cache-control")).toContain("no-store");
    const healthJson = await healthRes.json();
    const serialized = JSON.stringify(healthJson);
    expect(healthJson.ok).toBe(true);
    expect(healthJson.dbReadable).toBe(true);
    expect(serialized).not.toContain(process.env.HQ_SECRET!);
  });

  it("applies strict allowlisted CORS for workspace mobile/desktop routes without wildcard *", async () => {
    const allowedRes = await proxy(
      new NextRequest("http://localhost:3000/api/workspace/state", {
        method: "OPTIONS",
        headers: { origin: "https://cervos.online" },
      })
    );
    expect(allowedRes.status).toBe(204);
    expect(allowedRes.headers.get("access-control-allow-origin")).toBe("https://cervos.online");
    expect(allowedRes.headers.get("access-control-allow-credentials")).toBe("true");
    expect(allowedRes.headers.get("access-control-allow-headers")).toContain("X-Workspace-Profile");

    const evilRes = await proxy(
      new NextRequest("http://localhost:3000/api/workspace/state", {
        method: "OPTIONS",
        headers: { origin: "https://evil.example.com" },
      })
    );
    expect(evilRes.status).toBe(204);
    expect(evilRes.headers.get("access-control-allow-origin")).toBeNull();
  });
});
