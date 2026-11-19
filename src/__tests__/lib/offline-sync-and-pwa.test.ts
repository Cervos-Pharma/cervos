import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import {
  applyOfflineMutationToSnapshot,
  createOfflinePinVerifier,
  sha256Hex,
  verifyOfflinePinRecord,
  type OfflineSnapshotPatchable,
} from "@cervos/core";
import { GET as syncGet, POST as syncPost } from "@/app/api/sync/route";
import { hashSecret, normalizeSecurityAnswer } from "@/lib/security/harness";
import { createAccountCookieValue, WS_ACCOUNT_COOKIE } from "@/lib/security/session";
import { getWorkspaceDb, saveWorkspaceDb, type WorkspaceAccount } from "@/lib/workspace/store";

function seedOfflineSyncAccount(accountId: string) {
  const db = getWorkspaceDb();
  db.accounts = db.accounts.filter((a) => a.id !== accountId);
  db.centres = db.centres.filter((c) => c.accountId !== accountId);
  db.profiles = db.profiles.filter((p) => p.accountId !== accountId);
  db.batches = (db.batches ?? []).filter((b) => b.accountId !== accountId);
  db.sales = (db.sales ?? []).filter((s) => s.accountId !== accountId);
  db.expenses = (db.expenses ?? []).filter((e) => e.accountId !== accountId);
  db.shiftLogs = (db.shiftLogs ?? []).filter((s) => s.accountId !== accountId);
  db.branchMessages = (db.branchMessages ?? []).filter((m) => m.accountId !== accountId);

  const centreId = `ctr-${accountId}`;
  const profId = `prof-${accountId}`;
  const acct: WorkspaceAccount = {
    id: accountId,
    email: `${accountId}@cervos.test`,
    fullName: "Neema Joseph",
    ownerPhone: "+255712111222",
    roleType: "pharmacy",
    orgName: "Neema Care Pharmacy",
    region: "Dar es Salaam",
    lang: "EN",
    passwordHash: hashSecret("OfflineSync2026!").hash,
    securityQuestion: "Birth city?",
    securityAnswerHash: hashSecret(normalizeSecurityAnswer("Arusha")).hash,
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
  };

  db.accounts.push(acct);
  db.centres.push({
    id: centreId,
    accountId,
    name: "Kijitonyama Main",
    region: "Dar es Salaam",
    address: "Ali Hassan Mwinyi Rd",
    phone: "+255712111222",
    isPrimary: true,
    createdAt: new Date().toISOString(),
  });
  db.profiles.push({
    id: profId,
    accountId,
    centreId,
    username: `neema_${accountId}`,
    displayName: "Neema Joseph",
    role: "pharmacy_owner",
    pinHash: hashSecret("2580").hash,
    isMasterAdmin: true,
    createdAt: new Date().toISOString(),
  });
  db.batches.push({
    id: `bat-existing-${accountId}`,
    accountId,
    centreId,
    productId: "prod-amox-off",
    barcode: "629100100102",
    segment: "Antibiotic",
    genericName: "Amoxicillin 500mg",
    brandName: "Amoxil",
    category: "Antibiotics",
    batchNumber: "AMX-OFF-1",
    quantity: 12,
    costPriceTzs: 2500,
    salePriceTzs: 4000,
    expiryDate: "2027-06-30",
    lowStockThreshold: 5,
    requiresPrescription: true,
    isControlled: false,
    quarantined: false,
    createdAt: new Date().toISOString(),
  });
  saveWorkspaceDb(db);
  return { accountId, centreId, profId };
}

describe("Offline-first crypto PIN verifier, snapshot engine, SW precache, and /api/sync", () => {
  it("computes FIPS 180-4 SHA-256 digests and salted offline PIN verifiers cleanly", () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );

    const verifier = createOfflinePinVerifier("prof_99", "4589");
    expect(verifier).not.toContain("4589");
    expect(verifyOfflinePinRecord(verifier, "prof_99", "4589")).toBe(true);
    expect(verifyOfflinePinRecord(verifier, "prof_99", "1234")).toBe(false);
    expect(verifyOfflinePinRecord(verifier, "prof_other", "4589")).toBe(false);
    expect(verifyOfflinePinRecord("malformed", "prof_99", "4589")).toBe(false);
  });

  it("optimistically applies FEFO sales, stock mutations, expenses, shifts, and chat to cached snapshots", () => {
    const base: OfflineSnapshotPatchable = {
      activeCentreId: "ctr-1",
      activeProfile: { id: "prof-1", displayName: "Asha", role: "pharmacy_owner", centreId: "ctr-1" },
      batches: [
        {
          id: "b-expired",
          centreId: "ctr-1",
          productId: "prod-coartem",
          brandName: "Coartem",
          genericName: "Artemether/Lumefantrine",
          category: "Antimalarials",
          batchNumber: "COA-EXP",
          expiryDate: "2025-01-01",
          quantity: 10,
          costPriceTzs: 2000,
          salePriceTzs: 3500,
        },
        {
          id: "b-quarantined",
          centreId: "ctr-1",
          productId: "prod-coartem",
          brandName: "Coartem",
          genericName: "Artemether/Lumefantrine",
          category: "Antimalarials",
          batchNumber: "COA-Q",
          expiryDate: "2027-02-01",
          quantity: 10,
          costPriceTzs: 2000,
          salePriceTzs: 3500,
          quarantined: true,
        },
        {
          id: "b-early",
          centreId: "ctr-1",
          productId: "prod-coartem",
          brandName: "Coartem",
          genericName: "Artemether/Lumefantrine",
          category: "Antimalarials",
          batchNumber: "COA-EARLY",
          expiryDate: "2027-03-01",
          quantity: 3,
          costPriceTzs: 2000,
          salePriceTzs: 3500,
        },
        {
          id: "b-late",
          centreId: "ctr-1",
          productId: "prod-coartem",
          brandName: "Coartem",
          genericName: "Artemether/Lumefantrine",
          category: "Antimalarials",
          batchNumber: "COA-LATE",
          expiryDate: "2027-09-01",
          quantity: 8,
          costPriceTzs: 2000,
          salePriceTzs: 3500,
        },
      ],
      sales: [],
      shiftLogs: [],
      expenses: [],
      branchMessages: [],
    };

    const afterSale = applyOfflineMutationToSnapshot(base, {
      idempotencyKey: "mob_sale_abc123",
      type: "sale",
      createdAt: "2026-11-19T08:00:00.000Z",
      items: [{ productId: "prod-coartem", qty: 5 }],
      paymentMethod: "mpesa",
      customerName: "Juma",
    });

    expect(afterSale.batches?.find((b) => b.id === "b-expired")?.quantity).toBe(10);
    expect(afterSale.batches?.find((b) => b.id === "b-quarantined")?.quantity).toBe(10);
    expect(afterSale.batches?.find((b) => b.id === "b-early")?.quantity).toBe(0);
    expect(afterSale.batches?.find((b) => b.id === "b-late")?.quantity).toBe(6);
    expect(afterSale.sales?.[0]?.receiptNumber).toBe("RCP-ABC123");
    expect(afterSale.sales?.[0]?.totalTzs).toBe(17500);

    const afterBatch = applyOfflineMutationToSnapshot(afterSale, {
      idempotencyKey: "mob_add_panadol",
      type: "add_batch",
      createdAt: "2026-11-19T08:05:00.000Z",
      brandName: "Panadol Extra",
      genericName: "Paracetamol + Caffeine",
      category: "Analgesics & Fever",
      batchNumber: "PAN-2026",
      barcode: "620999888777",
      expiryDate: "2028-01-01",
      quantity: 20,
      costPriceTzs: 1200,
      salePriceTzs: 2000,
    });
    expect(afterBatch.batches?.some((b) => b.batchNumber === "PAN-2026" && b.barcode === "620999888777")).toBe(true);

    const afterEdit = applyOfflineMutationToSnapshot(afterBatch, {
      idempotencyKey: "mob_edit_panadol",
      type: "edit_batch",
      createdAt: "2026-11-19T08:06:00.000Z",
      batchId: "mob_add_panadol",
      quantity: 25,
      salePriceTzs: 2200,
    });
    expect(afterEdit.batches?.find((b) => b.id === "mob_add_panadol")?.quantity).toBe(25);
    expect(afterEdit.batches?.find((b) => b.id === "mob_add_panadol")?.salePriceTzs).toBe(2200);

    const afterAdjust = applyOfflineMutationToSnapshot(afterEdit, {
      idempotencyKey: "mob_adj_panadol",
      type: "adjust_qty",
      createdAt: "2026-11-19T08:07:00.000Z",
      batchId: "mob_add_panadol",
      delta: -3,
    });
    expect(afterAdjust.batches?.find((b) => b.id === "mob_add_panadol")?.quantity).toBe(22);

    const afterQuarantine = applyOfflineMutationToSnapshot(afterAdjust, {
      idempotencyKey: "mob_q_panadol",
      type: "toggle_quarantine",
      createdAt: "2026-11-19T08:08:00.000Z",
      batchId: "mob_add_panadol",
    });
    expect(afterQuarantine.batches?.find((b) => b.id === "mob_add_panadol")?.quarantined).toBe(true);

    const afterExpense = applyOfflineMutationToSnapshot(afterQuarantine, {
      idempotencyKey: "mob_exp_1",
      type: "log_expense",
      createdAt: "2026-11-19T08:09:00.000Z",
      category: "Utilities & Cold Chain",
      description: "Cold-chain generator fuel",
      amountTzs: 18500,
    });
    expect(afterExpense.expenses?.[0]?.amountTzs).toBe(18500);

    const afterShiftIn = applyOfflineMutationToSnapshot(afterExpense, {
      idempotencyKey: "mob_shift_in",
      type: "shift_clock",
      clockType: "in",
      createdAt: "2026-11-19T08:10:00.000Z",
    });
    expect(afterShiftIn.shiftLogs?.[0]?.clockOutAt).toBeUndefined();

    const afterShiftClose = applyOfflineMutationToSnapshot(afterShiftIn, {
      idempotencyKey: "mob_shift_rec",
      type: "shift_reconcile",
      createdAt: "2026-11-19T16:10:00.000Z",
      openingCashTzs: 50000,
      cashSalesTzs: 0,
      declaredCashTzs: 50000,
    });
    expect(afterShiftClose.shiftLogs?.[0]?.clockOutAt).toBe("2026-11-19T16:10:00.000Z");

    const afterChat = applyOfflineMutationToSnapshot(afterShiftClose, {
      idempotencyKey: "mob_chat_1",
      type: "branch_chat",
      createdAt: "2026-11-19T16:15:00.000Z",
      text: "Restocked cold-chain fridge",
    });
    expect(afterChat.branchMessages?.[0]?.body).toBe("Restocked cold-chain fridge");
  });

  it("idempotently syncs all offline mutation types through /api/sync and returns hydrated pull snapshots", async () => {
    const { accountId, centreId, profId } = seedOfflineSyncAccount("off_sync_u1");
    const cookieVal = createAccountCookieValue(accountId, `${accountId}@cervos.test`);
    const headers = {
      "Content-Type": "application/json",
      Cookie: `${WS_ACCOUNT_COOKIE}=${cookieVal}`,
    };

    const mutations = [
      {
        idempotencyKey: "k_sale_1",
        type: "sale",
        centreId,
        profileId: profId,
        operatorName: "Neema Joseph",
        paymentMethod: "cash",
        prescriptionRef: "RX-OFF-101",
        items: [{ productId: "prod-amox-off", qty: 2 }],
        createdAt: "2026-11-19T09:00:00.000Z",
      },
      {
        idempotencyKey: "k_batch_1",
        type: "add_batch",
        centreId,
        profileId: profId,
        operatorName: "Neema Joseph",
        brandName: "Zinnat 500mg",
        genericName: "Cefuroxime",
        category: "Antibiotics",
        batchNumber: "ZIN-2026",
        barcode: "629100999888",
        expiryDate: "2027-11-30",
        quantity: 15,
        costPriceTzs: 8000,
        salePriceTzs: 12000,
        createdAt: "2026-11-19T09:01:00.000Z",
      },
      {
        idempotencyKey: "k_edit_1",
        type: "edit_batch",
        centreId,
        batchId: `bat-existing-${accountId}`,
        salePriceTzs: 4500,
        barcode: "629100100109",
      },
      {
        idempotencyKey: "k_adj_1",
        type: "adjust_qty",
        centreId,
        batchId: `bat-existing-${accountId}`,
        delta: 3,
      },
      {
        idempotencyKey: "k_exp_1",
        type: "log_expense",
        centreId,
        operatorName: "Neema Joseph",
        category: "Rent & Premises",
        description: "Security guard shift",
        amountTzs: 25000,
        createdAt: "2026-11-19T09:03:00.000Z",
      },
      {
        idempotencyKey: "k_rec_1",
        type: "shift_reconcile",
        centreId,
        profileId: profId,
        operatorName: "Neema Joseph",
        openingCashTzs: 40000,
        cashSalesTzs: 8000,
        declaredCashTzs: 48000,
        createdAt: "2026-11-19T18:00:00.000Z",
      },
      {
        idempotencyKey: "k_chat_1",
        type: "branch_chat",
        centreId,
        profileId: profId,
        operatorName: "Neema Joseph",
        role: "pharmacy_owner",
        text: "End of shift handover clean",
        createdAt: "2026-11-19T18:05:00.000Z",
      },
    ];

    const res1 = await syncPost(
      new NextRequest("http://localhost:3000/api/sync", {
        method: "POST",
        headers,
        body: JSON.stringify({ mutations }),
      })
    );
    expect(res1.status).toBe(200);
    const out1 = (await res1.json()) as { ok: boolean; syncedKeys: string[] };
    expect(out1.ok).toBe(true);
    expect(out1.syncedKeys).toHaveLength(mutations.length);

    // Replay the exact same batch -> must stay idempotent (no duplicate sales, batches, expenses, or messages)
    const res2 = await syncPost(
      new NextRequest("http://localhost:3000/api/sync", {
        method: "POST",
        headers,
        body: JSON.stringify({ mutations }),
      })
    );
    expect(res2.status).toBe(200);

    const db = getWorkspaceDb();
    const amox = (db.batches ?? []).find((b) => b.id === `bat-existing-${accountId}`);
    expect(amox?.quantity).toBe(13); // 12 initial - 2 sold + 3 adjusted (NOT doubled on replay)
    expect(amox?.salePriceTzs).toBe(4500);
    expect(amox?.barcode).toBe("629100100109");

    const acctZinnat = (db.batches ?? []).filter((b) => b.accountId === accountId && b.batchNumber === "ZIN-2026");
    expect(acctZinnat).toHaveLength(1);
    expect(acctZinnat[0]?.quantity).toBe(15);

    const acctExpenses = (db.expenses ?? []).filter((e) => e.accountId === accountId);
    expect(acctExpenses).toHaveLength(1);
    expect(acctExpenses[0]?.amountTzs).toBe(25000);

    const acctMsgs = (db.branchMessages ?? []).filter((m) => m.accountId === accountId);
    expect(acctMsgs).toHaveLength(1);
    expect(acctMsgs[0]?.body).toBe("End of shift handover clean");

    const pullRes = await syncGet(
      new NextRequest("http://localhost:3000/api/sync?since=1970-01-01T00:00:00.000Z", {
        method: "GET",
        headers,
      })
    );
    expect(pullRes.status).toBe(200);
    const pullJson = (await pullRes.json()) as {
      expenses?: unknown[];
      shiftLogs?: unknown[];
      cloudCatalog?: unknown[];
    };
    expect((pullJson.expenses ?? []).length).toBeGreaterThanOrEqual(1);
    expect((pullJson.cloudCatalog ?? []).length).toBeGreaterThan(0);
  });

  it("precaches root, /app, and /app/gate in public/sw.js for genuine PWA offline boot", () => {
    const swText = fs.readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8");
    expect(swText).toContain('CACHE_VERSION = "v2"');
    expect(swText).toContain('"/app"');
    expect(swText).toContain('"/app/gate"');
  });
});
