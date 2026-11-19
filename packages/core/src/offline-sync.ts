export type OfflineMutationType =
  | "sale"
  | "shift_clock"
  | "shift_reconcile"
  | "add_batch"
  | "edit_batch"
  | "adjust_qty"
  | "toggle_quarantine"
  | "log_expense"
  | "branch_chat";

export interface OfflineMutationEnvelope {
  idempotencyKey: string;
  type: OfflineMutationType;
  createdAt: string;
  centreId?: string;
  profileId?: string;
  operatorName?: string;
  role?: string;
  [key: string]: unknown;
}

export interface SnapshotBatchLike {
  id: string;
  centreId?: string;
  productId: string;
  brandName: string;
  genericName: string;
  category: string;
  batchNumber: string;
  barcode?: string;
  segment?: string;
  expiryDate: string;
  dateEntered?: string;
  quantity: number;
  costPriceTzs: number;
  salePriceTzs: number;
  lowStockThreshold?: number;
  requiresPrescription?: boolean;
  quarantined?: boolean;
  imageUrl?: string;
}

export interface SnapshotSaleLike {
  id: string;
  centreId?: string;
  profileId?: string;
  actorName: string;
  receiptNumber?: string;
  customerName?: string;
  customerPhone?: string;
  totalTzs: number;
  itemCount: number;
  paymentMethod: "cash" | "mpesa" | "tigo" | "card" | "credit" | string;
  lines?: Array<{
    productId: string;
    brandName: string;
    category: string;
    batchNumber?: string;
    qty: number;
    unitPriceTzs: number;
    unitCostTzs: number;
  }>;
  createdAt: string;
}

export interface SnapshotShiftLike {
  id: string;
  centreId?: string;
  profileId?: string;
  staffName: string;
  role: string;
  clockInAt: string;
  clockOutAt?: string;
  durationMinutes?: number;
}

export interface SnapshotExpenseLike {
  id: string;
  centreId: string;
  category: string;
  description: string;
  amountTzs: number;
  createdAt: string;
}

export interface SnapshotMessageLike {
  id: string;
  centreId: string;
  senderProfileId: string;
  senderName: string;
  senderRole: string;
  body: string;
  createdAt: string;
}

export interface OfflineSnapshotPatchable {
  activeCentreId?: string | null;
  activeProfile?: {
    id: string;
    displayName: string;
    role: string;
    centreId?: string;
  } | null;
  batches?: SnapshotBatchLike[];
  sales?: SnapshotSaleLike[];
  shiftLogs?: SnapshotShiftLike[];
  expenses?: SnapshotExpenseLike[];
  branchMessages?: SnapshotMessageLike[];
}

// Standard FIPS 180-4 SHA-256 implementation in pure TypeScript (zero native/node dependencies)
const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

function encodeUtf8Bytes(input: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i += 1) {
    let code = input.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < input.length) {
      const next = input.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + (((code - 0xd800) << 10) | (next - 0xdc00));
        bytes.push(
          0xf0 | (code >> 18),
          0x80 | ((code >> 12) & 0x3f),
          0x80 | ((code >> 6) & 0x3f),
          0x80 | (code & 0x3f)
        );
        i += 1;
      }
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return bytes;
}

export function sha256Hex(input: string): string {
  const bytes = encodeUtf8Bytes(input);
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0);
  const highBits = Math.floor(bitLen / 0x100000000);
  const lowBits = bitLen >>> 0;
  bytes.push(
    (highBits >>> 24) & 0xff,
    (highBits >>> 16) & 0xff,
    (highBits >>> 8) & 0xff,
    highBits & 0xff,
    (lowBits >>> 24) & 0xff,
    (lowBits >>> 16) & 0xff,
    (lowBits >>> 8) & 0xff,
    lowBits & 0xff
  );

  const H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const W = new Array<number>(64).fill(0);

  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let t = 0; t < 16; t += 1) {
      const i = offset + t * 4;
      W[t] = ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0;
    }
    for (let t = 16; t < 64; t += 1) {
      const s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
      const s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[t] + W[t]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  return H.map((v) => v.toString(16).padStart(8, "0")).join("");
}

export function createOfflinePinVerifier(profileId: string, pin: string): string {
  const salt = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const digest = sha256Hex(`${salt}:${profileId}:${pin.trim()}`);
  return `${salt}:${digest}`;
}

export function verifyOfflinePinRecord(
  verifier: string | null | undefined,
  profileId: string,
  pin: string
): boolean {
  if (!verifier || !profileId || pin.trim().length < 4) return false;
  const idx = verifier.indexOf(":");
  if (idx <= 0) return false;
  const salt = verifier.slice(0, idx);
  const expected = verifier.slice(idx + 1);
  const actual = sha256Hex(`${salt}:${profileId}:${pin.trim()}`);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i += 1) {
    diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export function applyOfflineMutationToSnapshot<T extends OfflineSnapshotPatchable>(
  snapshot: T,
  mutation: OfflineMutationEnvelope
): T {
  const centreId =
    (typeof mutation.centreId === "string" && mutation.centreId) ||
    snapshot.activeCentreId ||
    snapshot.activeProfile?.centreId ||
    "ctr-main";
  const createdAt = mutation.createdAt || new Date().toISOString();
  const todayIso = createdAt.slice(0, 10);

  if (mutation.type === "sale") {
    const rawItems = Array.isArray(mutation.items)
      ? (mutation.items as Array<{ productId?: string; qty?: number }>)
      : [];
    const nextBatches = (snapshot.batches ?? []).map((b) => ({ ...b }));
    const receiptLines: NonNullable<SnapshotSaleLike["lines"]> = [];
    let totalTzs = 0;
    let totalUnits = 0;

    for (const item of rawItems) {
      const pid = String(item.productId || "");
      let rem = Math.max(1, Math.round(Number(item.qty) || 0));
      if (!pid || rem <= 0) continue;

      const candidates = nextBatches
        .filter(
          (b) =>
            (!b.centreId || b.centreId === centreId) &&
            b.productId === pid &&
            !b.quarantined &&
            b.expiryDate >= todayIso &&
            b.quantity > 0
        )
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

      for (const batch of candidates) {
        if (rem <= 0) break;
        const take = Math.min(batch.quantity, rem);
        batch.quantity -= take;
        rem -= take;
        totalUnits += take;
        totalTzs += take * batch.salePriceTzs;
        receiptLines.push({
          productId: pid,
          brandName: batch.brandName,
          category: batch.category,
          batchNumber: batch.batchNumber,
          qty: take,
          unitPriceTzs: batch.salePriceTzs,
          unitCostTzs: batch.costPriceTzs,
        });
      }
    }

    const receiptNumber = `RCP-${mutation.idempotencyKey.slice(-6).toUpperCase()}`;
    const saleRecord: SnapshotSaleLike = {
      id: mutation.idempotencyKey,
      centreId,
      profileId: mutation.profileId || snapshot.activeProfile?.id || "",
      actorName: mutation.operatorName || snapshot.activeProfile?.displayName || "Offline Staff",
      receiptNumber,
      customerName: typeof mutation.customerName === "string" ? mutation.customerName : undefined,
      customerPhone: typeof mutation.customerPhone === "string" ? mutation.customerPhone : undefined,
      totalTzs,
      itemCount: totalUnits,
      paymentMethod: typeof mutation.paymentMethod === "string" ? mutation.paymentMethod : "cash",
      lines: receiptLines,
      createdAt,
    };

    return {
      ...snapshot,
      batches: nextBatches,
      sales: [saleRecord, ...(snapshot.sales ?? [])],
    };
  }

  if (mutation.type === "add_batch") {
    const brandName = String(mutation.brandName || "").trim();
    const batchNumber =
      String(mutation.batchNumber || "").trim() || `LOT-${Date.now().toString(36).toUpperCase().slice(-5)}`;
    const newBatch: SnapshotBatchLike = {
      id: mutation.idempotencyKey,
      centreId,
      productId:
        typeof mutation.productId === "string" && mutation.productId
          ? mutation.productId
          : `prod_${brandName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
      brandName,
      genericName: String(mutation.genericName || brandName).trim(),
      category: String(mutation.category || "Essential"),
      batchNumber,
      barcode: typeof mutation.barcode === "string" ? mutation.barcode : undefined,
      segment: typeof mutation.segment === "string" ? mutation.segment : undefined,
      expiryDate: String(mutation.expiryDate || ""),
      dateEntered: todayIso,
      quantity: Math.max(0, Math.round(Number(mutation.quantity) || 0)),
      costPriceTzs: Math.max(50, Math.round(Number(mutation.costPriceTzs) || 0)),
      salePriceTzs: Math.max(100, Math.round(Number(mutation.salePriceTzs) || 0)),
      lowStockThreshold: Math.max(1, Math.round(Number(mutation.lowStockThreshold) || 25)),
      requiresPrescription: Boolean(mutation.requiresPrescription),
      quarantined: false,
      imageUrl: typeof mutation.imageUrl === "string" ? mutation.imageUrl : undefined,
    };
    return {
      ...snapshot,
      batches: [newBatch, ...(snapshot.batches ?? [])],
    };
  }

  if (mutation.type === "edit_batch") {
    const batchId = String(mutation.batchId || "");
    const nextBatches = (snapshot.batches ?? []).map((b) => {
      if (b.id !== batchId) return b;
      return {
        ...b,
        ...(typeof mutation.brandName === "string" && mutation.brandName.trim()
          ? { brandName: mutation.brandName.trim() }
          : {}),
        ...(typeof mutation.genericName === "string" && mutation.genericName.trim()
          ? { genericName: mutation.genericName.trim() }
          : {}),
        ...(typeof mutation.category === "string" && mutation.category.trim()
          ? { category: mutation.category.trim() }
          : {}),
        ...(typeof mutation.batchNumber === "string" && mutation.batchNumber.trim()
          ? { batchNumber: mutation.batchNumber.trim() }
          : {}),
        ...(typeof mutation.barcode === "string" ? { barcode: mutation.barcode } : {}),
        ...(mutation.quantity !== undefined
          ? { quantity: Math.max(0, Math.round(Number(mutation.quantity) || 0)) }
          : {}),
        ...(mutation.costPriceTzs !== undefined
          ? { costPriceTzs: Math.max(50, Math.round(Number(mutation.costPriceTzs) || b.costPriceTzs)) }
          : {}),
        ...(mutation.salePriceTzs !== undefined
          ? { salePriceTzs: Math.max(100, Math.round(Number(mutation.salePriceTzs) || b.salePriceTzs)) }
          : {}),
        ...(typeof mutation.expiryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(mutation.expiryDate)
          ? { expiryDate: mutation.expiryDate }
          : {}),
        ...(mutation.lowStockThreshold !== undefined
          ? {
              lowStockThreshold: Math.max(
                1,
                Math.round(Number(mutation.lowStockThreshold) || b.lowStockThreshold || 25)
              ),
            }
          : {}),
        ...(typeof mutation.requiresPrescription === "boolean"
          ? { requiresPrescription: mutation.requiresPrescription }
          : {}),
      };
    });
    return { ...snapshot, batches: nextBatches };
  }

  if (mutation.type === "adjust_qty") {
    const batchId = String(mutation.batchId || "");
    const nextBatches = (snapshot.batches ?? []).map((b) => {
      if (b.id !== batchId) return b;
      const nextQty =
        typeof mutation.delta === "number"
          ? Math.max(0, Math.round(b.quantity + mutation.delta))
          : mutation.quantity !== undefined
            ? Math.max(0, Math.round(Number(mutation.quantity) || 0))
            : b.quantity;
      return { ...b, quantity: nextQty };
    });
    return { ...snapshot, batches: nextBatches };
  }

  if (mutation.type === "toggle_quarantine") {
    const batchId = String(mutation.batchId || "");
    const nextBatches = (snapshot.batches ?? []).map((b) => {
      if (b.id !== batchId) return b;
      const nextQ =
        typeof mutation.quarantined === "boolean" ? mutation.quarantined : !Boolean(b.quarantined);
      return { ...b, quarantined: nextQ };
    });
    return { ...snapshot, batches: nextBatches };
  }

  if (mutation.type === "log_expense") {
    const exp: SnapshotExpenseLike = {
      id: mutation.idempotencyKey,
      centreId,
      category: String(mutation.category || "Packaging & Supplies"),
      description: String(mutation.description || "Expense"),
      amountTzs: Math.max(0, Math.round(Number(mutation.amountTzs) || 0)),
      createdAt,
    };
    return {
      ...snapshot,
      expenses: [exp, ...(snapshot.expenses ?? [])],
    };
  }

  if (mutation.type === "shift_clock" || mutation.type === "shift_reconcile") {
    const profileId = mutation.profileId || snapshot.activeProfile?.id || "";
    const staffName = mutation.operatorName || snapshot.activeProfile?.displayName || "Staff";
    const role = mutation.role || snapshot.activeProfile?.role || "pos_cashier";
    const shifts = [...(snapshot.shiftLogs ?? [])];
    const openIdx = shifts.findIndex((s) => s.profileId === profileId && !s.clockOutAt);

    if (mutation.type === "shift_clock" && mutation.clockType === "in") {
      if (openIdx === -1) {
        shifts.unshift({
          id: mutation.idempotencyKey,
          centreId,
          profileId,
          staffName,
          role,
          clockInAt: createdAt,
        });
      }
      return { ...snapshot, shiftLogs: shifts };
    }

    if (openIdx !== -1) {
      const open = shifts[openIdx];
      const mins = Math.max(
        1,
        Math.round((Date.parse(createdAt) - Date.parse(open.clockInAt)) / 60000)
      );
      shifts[openIdx] = {
        ...open,
        clockOutAt: createdAt,
        durationMinutes: Number.isFinite(mins) ? mins : 1,
      };
    } else if (mutation.type === "shift_reconcile") {
      shifts.unshift({
        id: mutation.idempotencyKey,
        centreId,
        profileId,
        staffName,
        role,
        clockInAt: createdAt,
        clockOutAt: createdAt,
        durationMinutes: 1,
      });
    }
    return { ...snapshot, shiftLogs: shifts };
  }

  if (mutation.type === "branch_chat") {
    const msg: SnapshotMessageLike = {
      id: mutation.idempotencyKey,
      centreId,
      senderProfileId: mutation.profileId || snapshot.activeProfile?.id || "",
      senderName: mutation.operatorName || snapshot.activeProfile?.displayName || "Staff",
      senderRole: mutation.role || snapshot.activeProfile?.role || "pos_cashier",
      body: String(mutation.body || mutation.text || ""),
      createdAt,
    };
    return {
      ...snapshot,
      branchMessages: [...(snapshot.branchMessages ?? []), msg],
    };
  }

  return snapshot;
}
