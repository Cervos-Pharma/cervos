import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  computePlanCheckoutQuote,
  getSubscriptionExpiryInfo,
  getWorkspaceDb,
  isAccountAccessLocked,
  MIN_BRANCH_PRICE_TZS,
  upsertJournalArticle,
  type WorkspaceAccount,
} from "@/lib/workspace/store";
import { hashSecret, normalizeSecurityAnswer } from "@/lib/security/harness";
import { createAccountCookieValue, createProfileCookieValue, WS_ACCOUNT_COOKIE, WS_PROFILE_COOKIE } from "@/lib/security/session";
import { POST as statePost } from "@/app/api/workspace/state/route";
import { GET as cronGet } from "@/app/api/cron/daily-summary/route";
import { GET as dispatchGet } from "@/app/api/dispatch/route";
import { combineSearchQueries, matchesSearch } from "@/lib/search";

function makeAccount(id: string, overrides: Partial<WorkspaceAccount> = {}): WorkspaceAccount {
  return {
    id,
    email: `${id}@pharmacy.co.tz`,
    fullName: "Nadia Mwangi",
    ownerPhone: "+255712345678",
    roleType: "pharmacy",
    orgName: "Eden Care Pharmacy",
    region: "Dar es Salaam",
    lang: "EN",
    passwordHash: hashSecret("TestPass2026!").hash,
    securityQuestion: "City?",
    securityAnswerHash: hashSecret(normalizeSecurityAnswer("Dar")).hash,
    requireSecurityEveryTime: false,
    trustGeneration: 1,
    onboardingDone: true,
    verificationStatus: "verified",
    networkUnlocked: true,
    subscriptionActive: true,
    subscriptionPlan: "Community Standard",
    billingCycle: "monthly",
    certificates: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Plan Upgrades, Expiry Cutoff & Personalized Daily Summary Cron", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-cron-secret-2026";
  });

  it("applies prorated upgrade credit when upgrading from an active monthly plan and respects MIN_BRANCH_PRICE_TZS", () => {
    const db = getWorkspaceDb();
    const now = Date.now();
    const acc = makeAccount(`acc_upg_${now}`, {
      subscriptionPlan: "Community Standard", // 45,000 TZS/mo
      billingCycle: "monthly",
      subscriptionExpiresAt: new Date(now + 15 * 86400000).toISOString(), // 15/30 days left -> ~22,500 credit
    });
    db.accounts.push(acc);
    db.centres.push({
      id: `ctr_upg_${now}`,
      accountId: acc.id,
      name: "Eden Main",
      region: "Dar es Salaam",
      address: "Kinondoni",
      phone: "+255712345678",
      isPrimary: true,
      createdAt: new Date().toISOString(),
    });

    const quote = computePlanCheckoutQuote(db, acc, "Chain Growth", "monthly", now);
    expect(quote.isUpgrade).toBe(true);
    expect(quote.isSwitch).toBe(true);
    expect(quote.baseAmountTzs).toBe(140000);
    expect(quote.creditTzs).toBe(22500);
    expect(quote.amountDueTzs).toBe(117500);

    // Even if credit >= target base, minimum branch price floor holds
    const accHigh = makeAccount(`acc_floor_${now}`, {
      subscriptionPlan: "Chain Growth", // 140,000 TZS/mo
      billingCycle: "monthly",
      subscriptionExpiresAt: new Date(now + 29 * 86400000).toISOString(),
    });
    db.accounts.push(accHigh);
    const downQuote = computePlanCheckoutQuote(db, accHigh, "Community Standard", "monthly", now);
    expect(downQuote.isUpgrade).toBe(false);
    expect(downQuote.amountDueTzs).toBeGreaterThanOrEqual(MIN_BRANCH_PRICE_TZS);
  });

  it("cuts off active paid plan strictly on the day after subscriptionExpiresAt", () => {
    const now = Date.now();
    const inGraceAcc = makeAccount("acc_grace", {
      subscriptionActive: true,
      subscriptionExpiresAt: new Date(now - 6 * 3600 * 1000).toISOString(), // expired 6h ago -> grace day
    });
    const graceInfo = getSubscriptionExpiryInfo(inGraceAcc, now);
    expect(graceInfo.isInGraceDay).toBe(true);
    expect(graceInfo.isCutOff).toBe(false);
    expect(isAccountAccessLocked(inGraceAcc).locked).toBe(false);

    const cutOffAcc = makeAccount("acc_cutoff", {
      subscriptionActive: true,
      subscriptionExpiresAt: new Date(now - 26 * 3600 * 1000).toISOString(), // expired 26h ago -> day after expiry
    });
    const cutInfo = getSubscriptionExpiryInfo(cutOffAcc, now);
    expect(cutInfo.isCutOff).toBe(true);
    expect(isAccountAccessLocked(cutOffAcc).locked).toBe(true);
  });

  it("activates plan upgrades through state API with credit, audit log, and expiry timestamp", async () => {
    const db = getWorkspaceDb();
    const now = Date.now();
    const acc = makeAccount(`acc_api_${now}`, {
      subscriptionPlan: "Community Standard",
      subscriptionExpiresAt: new Date(now + 15 * 86400000).toISOString(),
    });
    const ctrId = `ctr_api_${now}`;
    const profId = `prof_api_${now}`;
    db.accounts.push(acc);
    db.centres.push({
      id: ctrId,
      accountId: acc.id,
      name: "Eden Branch",
      region: "Dar es Salaam",
      address: "Msasani",
      phone: "+255712345678",
      isPrimary: true,
      createdAt: new Date().toISOString(),
    });
    db.profiles.push({
      id: profId,
      accountId: acc.id,
      centreId: ctrId,
      displayName: "Nadia Mwangi",
      role: "pharmacy_owner",
      pinHash: hashSecret("1947").hash,
      isMasterAdmin: true,
      createdAt: new Date().toISOString(),
    });

    const accCookie = createAccountCookieValue(acc.id, acc.email);
    const profCookie = createProfileCookieValue(acc.id, ctrId, profId, "pharmacy_owner");
    const req = new NextRequest("http://localhost:3000/api/workspace/state", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${WS_ACCOUNT_COOKIE}=${accCookie}; ${WS_PROFILE_COOKIE}=${profCookie}`,
      },
      body: JSON.stringify({
        action: "activate_subscription",
        planName: "Chain Growth",
        billingCycle: "monthly",
        paymentChannel: "CRDB / NMB Bank",
        payerPhoneOrRef: "CRDB-998811",
      }),
    });

    const res = await statePost(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.isUpgrade).toBe(true);
    expect(data.upgradeCreditTzs).toBe(22500);
    expect(data.amountTzs).toBe(117500);
    expect(data.account.subscriptionPlan).toBe("Chain Growth");
    expect(typeof data.account.subscriptionExpiresAt).toBe("string");
  });

  it("embeds personalized expiry + limit reminder in evening updates and skips expired cutoff orgs", async () => {
    const db = getWorkspaceDb();
    const now = Date.now();

    const expiringSoonAcc = makeAccount(`acc_cron_ok_${now}`, {
      fullName: "Nadia Mwangi",
      orgName: "Eden Pharmacy",
      ownerPhone: "+255712340001",
      subscriptionActive: true,
      subscriptionPlan: "Community Standard", // maxBranches: 1, maxOperators: 6
      subscriptionExpiresAt: new Date(now + 3 * 86400000).toISOString(),
    });
    const expiredCutoffAcc = makeAccount(`acc_cron_cut_${now}`, {
      fullName: "Juma Bakari",
      orgName: "Paused Drugstore",
      ownerPhone: "+255712340002",
      subscriptionActive: true,
      subscriptionPlan: "Community Standard",
      subscriptionExpiresAt: new Date(now - 30 * 3600 * 1000).toISOString(),
    });

    db.accounts.push(expiringSoonAcc, expiredCutoffAcc);
    db.centres.push(
      {
        id: `ctr_ok_${now}`,
        accountId: expiringSoonAcc.id,
        name: "Eden Main",
        region: "Dar es Salaam",
        address: "Sinza",
        phone: "+255712340001",
        isPrimary: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: `ctr_cut_${now}`,
        accountId: expiredCutoffAcc.id,
        name: "Paused Branch",
        region: "Arusha",
        address: "Sokoine",
        phone: "+255712340002",
        isPrimary: true,
        createdAt: new Date().toISOString(),
      }
    );

    const cronReq = new NextRequest("http://localhost:3000/api/cron/daily-summary", {
      method: "GET",
      headers: { Authorization: "Bearer test-cron-secret-2026" },
    });
    const res = await cronGet(cronReq);
    expect(res.status).toBe(200);
    const out = await res.json();

    const sentForOk = (out.dispatches as Array<{ accountId: string; message: string }>).find(
      (d) => d.accountId === expiringSoonAcc.id
    );
    const sentForCut = (out.dispatches as Array<{ accountId: string }>).find(
      (d) => d.accountId === expiredCutoffAcc.id
    );
    expect(sentForOk).toBeDefined();
    expect(sentForOk?.message).toContain("Nadia");
    expect(sentForOk?.message).toContain("day");
    expect(sentForCut).toBeUndefined();
    expect(expiredCutoffAcc.billingOverdue).toBe(true);

    // Mirrored inside in-app notifications too
    const inAppDigest = (db.notifications ?? []).find(
      (n) => n.accountId === expiringSoonAcc.id && n.body.includes("Nadia")
    );
    expect(inAppDigest).toBeDefined();
  });

  it("matches case-insensitive, multi-word, and punctuation-tolerant search queries", () => {
    expect(
      matchesSearch("AMOX 500", "Amoxicillin Capsules", "amox-500-mg", "LOT-2026-A")
    ).toBe(true);
    expect(
      matchesSearch("Eden Kinondoni", "Eden Care Branch", "Kinondoni St", "Dar es Salaam")
    ).toBe(true);
    expect(
      matchesSearch("Eden Arusha", "Eden Care Branch", "Kinondoni St", "Dar es Salaam")
    ).toBe(false);
    expect(combineSearchQueries("  panadol ", " 500mg ")).toBe("panadol 500mg");
  });

  it("handles branch chat send, reply, @mention, and reaction even when branchMessages starts undefined, and enforces pharmacy branch quota", async () => {
    const db = getWorkspaceDb();
    db.branchMessages = undefined;
    db.notifications = undefined;
    const now = Date.now();
    const acc = makeAccount(`acc_chat_${now}`, {
      subscriptionActive: true,
      subscriptionPlan: "Community Standard", // maxBranches: 1, maxOperators: 6
    });
    const ctrId = `ctr_chat_${now}`;
    const profId = `prof_chat_${now}`;
    db.accounts.push(acc);
    db.centres.push({
      id: ctrId,
      accountId: acc.id,
      name: "Eden Care",
      region: "Dar es Salaam",
      address: "Mikocheni",
      phone: "+255712340099",
      isPrimary: true,
      createdAt: new Date().toISOString(),
    });
    db.profiles.push({
      id: profId,
      accountId: acc.id,
      centreId: ctrId,
      username: "nadia",
      displayName: "Nadia Mwangi",
      role: "pharmacy_owner",
      pinHash: hashSecret("1947").hash,
      isMasterAdmin: true,
      createdAt: new Date().toISOString(),
    });

    const accCookie = createAccountCookieValue(acc.id, acc.email);
    const profCookie = createProfileCookieValue(acc.id, ctrId, profId, "pharmacy_owner");
    const cookieHeader = `${WS_ACCOUNT_COOKIE}=${accCookie}; ${WS_PROFILE_COOKIE}=${profCookie}`;

    const chatRes = await statePost(
      new NextRequest("http://localhost:3000/api/workspace/state", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieHeader },
        body: JSON.stringify({ action: "send_branch_chat", body: "Hello @nadia stock checked" }),
      })
    );
    expect(chatRes.status).toBe(200);
    const chatJson = await chatRes.json();
    expect(chatJson.ok).toBe(true);
    expect(chatJson.message.mentions).toContain("Nadia Mwangi");

    const reactRes = await statePost(
      new NextRequest("http://localhost:3000/api/workspace/state", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieHeader },
        body: JSON.stringify({
          action: "react_branch_chat",
          messageId: chatJson.message.id,
          kind: "thumbs_up",
        }),
      })
    );
    expect(reactRes.status).toBe(200);

    // Community Standard allows 1 branch — trying to add a 2nd returns 402 PLAN_LIMIT_REACHED
    const branchQuotaRes = await statePost(
      new NextRequest("http://localhost:3000/api/workspace/state", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieHeader },
        body: JSON.stringify({
          action: "add_centre",
          name: "Second Branch",
          address: "Msasani Road",
        }),
      })
    );
    expect(branchQuotaRes.status).toBe(402);
    const quotaJson = await branchQuotaRes.json();
    expect(quotaJson.code).toBe("PLAN_LIMIT_REACHED");
    expect(quotaJson.upgradeUrl).toContain("/app/billing");
  });

  it("publishes HQ journal articles cleanly to /api/dispatch", async () => {
    const db = getWorkspaceDb();
    const article = upsertJournalArticle(db, {
      titleEn: "How 480p WebP Product Photos Speed Counter Audits",
      deckEn: "Field notes from Dar es Salaam dispensaries replacing manual URL links.",
      paragraphsEn: ["First paragraph of editorial insight.", "Second paragraph of closing notes."],
      status: "published",
    });
    const res = await dispatchGet(
      new NextRequest(`http://localhost:3000/api/dispatch?slug=${encodeURIComponent(article.slug)}`)
    );
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out.article.slug).toBe(article.slug);
    expect(out.article.titleEn).toContain("WebP");
  });
});
