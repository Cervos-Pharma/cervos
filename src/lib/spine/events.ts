import { createHash, randomBytes } from "crypto";
import type { WorkspaceDbSnapshot } from "@/lib/workspace/store";
import { PRODUCT_MASTER_SEED, resolveProductAlias } from "./ontology";
import type {
  LegacyIdMapEntry,
  SpineEventEnvelope,
  WorkspaceSpineStore,
} from "./types";

const CERVOS_UUID_NAMESPACE = "cervos:spine:uuidv5:2026";
const MAX_STORED_EVENTS = 500;
let hlcCounter = 0;

/**
 * RFC 9562 time-ordered UUIDv7 generator.
 */
export function generateUuidV7(nowMs = Date.now()): string {
  const bytes = randomBytes(16);
  const ts = Math.max(0, Math.floor(nowMs));
  bytes[0] = Math.floor(ts / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(ts / 2 ** 32) & 0xff;
  bytes[2] = (ts >>> 24) & 0xff;
  bytes[3] = (ts >>> 16) & 0xff;
  bytes[4] = (ts >>> 8) & 0xff;
  bytes[5] = ts & 0xff;
  bytes[6] = (bytes[6] & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant RFC 4122
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Deterministic UUIDv5-style SHA-256 formatter for mapping legacy acc_/ctr_/bat_ IDs idempotently.
 */
export function deterministicLegacyUuid(entityType: string, legacyId: string): string {
  const digest = createHash("sha256")
    .update(`${CERVOS_UUID_NAMESPACE}:${entityType}:${legacyId}`)
    .digest();
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.toString("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function nextHlc(nowMs = Date.now(), lastHlc?: string, nodeId = "hq-core"): string {
  hlcCounter = (hlcCounter + 1) % 10000;
  const iso = new Date(nowMs).toISOString();
  if (lastHlc && lastHlc >= `${iso}-${String(hlcCounter).padStart(4, "0")}`) {
    hlcCounter = (hlcCounter + 1) % 10000;
  }
  return `${iso}-${String(hlcCounter).padStart(4, "0")}-${nodeId}`;
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJson(v)).join(",")}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`)
    .join(",")}}`;
}

export function computeEnvelopeHash(
  prevHash: string,
  envelopeWithoutHash: Omit<SpineEventEnvelope, "hash" | "prevHash">
): string {
  return createHash("sha256")
    .update(`${prevHash}|${canonicalJson(envelopeWithoutHash)}`)
    .digest("hex");
}

function getOrCreateLegacyMap(
  spine: WorkspaceSpineStore,
  entityType: LegacyIdMapEntry["entityType"],
  legacyId: string,
  source: LegacyIdMapEntry["source"] = "workspace_db"
): string {
  const existing = spine.legacyIdMap.find(
    (m) => m.entityType === entityType && m.legacyId === legacyId
  );
  if (existing) return existing.id;
  const id = deterministicLegacyUuid(entityType, legacyId);
  spine.legacyIdMap.push({
    legacyId,
    entityType,
    id,
    source,
    createdAt: new Date().toISOString(),
  });
  return id;
}

export interface AppendSpineEventInput {
  legacyOrgId: string;
  legacyBranchId?: string;
  actorId?: string;
  actorKind: SpineEventEnvelope["actorKind"];
  type: string;
  occurredAt?: string;
  receivedAt?: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string;
  payload: Record<string, unknown>;
  piiClass: SpineEventEnvelope["piiClass"];
  source: SpineEventEnvelope["source"];
  schemaVersion?: number;
}

export function createEmptySpineStore(): WorkspaceSpineStore {
  return {
    globalSeqCounter: 0,
    legacyIdMap: [],
    productMaster: [...PRODUCT_MASTER_SEED],
    productAliases: [],
    lots: [],
    stockHoldings: [],
    edges: [],
    events: [],
    proposals: [],
    autonomyConfig: {
      reorder_draft: "suggest",
      expiry_rescue: "suggest",
      churn_intervention: "suggest",
      support_reply: "auto_undo",
      billing_grace: "suggest",
      recall_quarantine: "suggest",
      anomaly_review: "suggest",
    },
    recalls: [],
    privacyReleases: [],
    privacyBudgets: {},
    cases: [],
  };
}

/**
 * Append an immutable, idempotent, hash-chained Spine event onto WorkspaceDb.
 */
export function appendSpineEvent(
  db: WorkspaceDbSnapshot,
  input: AppendSpineEventInput
): { event: SpineEventEnvelope; deduplicated: boolean } {
  if (!db.spine) {
    db.spine = createEmptySpineStore();
  }
  const spine = db.spine;
  const orgId = getOrCreateLegacyMap(spine, "org", input.legacyOrgId, "workspace_db");
  const branchId = input.legacyBranchId
    ? getOrCreateLegacyMap(spine, "branch", input.legacyBranchId, "workspace_db")
    : undefined;

  // Dedupe on (orgId, idempotencyKey) per Spec §6
  const existing = spine.events.find(
    (e) => e.orgId === orgId && e.idempotencyKey === input.idempotencyKey
  );
  if (existing) {
    return { event: existing, deduplicated: true };
  }

  spine.globalSeqCounter += 1;
  const globalSeq = spine.globalSeqCounter;
  const nowIso = new Date().toISOString();
  const prevOrgEvent = [...spine.events].reverse().find((e) => e.orgId === orgId);
  const prevHash = prevOrgEvent?.hash ?? "0".repeat(64);
  const lastHlc = spine.events[spine.events.length - 1]?.hlc;

  const baseEnvelope: Omit<SpineEventEnvelope, "hash" | "prevHash"> = {
    globalSeq,
    eventId: generateUuidV7(),
    orgId,
    legacyOrgId: input.legacyOrgId,
    branchId,
    actorId: input.actorId,
    actorKind: input.actorKind,
    type: input.type,
    schemaVersion: input.schemaVersion ?? 1,
    occurredAt: input.occurredAt || nowIso,
    hlc: nextHlc(Date.now(), lastHlc, input.source),
    receivedAt: input.receivedAt || nowIso,
    idempotencyKey: input.idempotencyKey,
    correlationId: input.correlationId,
    causationId: input.causationId,
    payload: input.payload,
    piiClass: input.piiClass,
    source: input.source,
  };

  const hash = computeEnvelopeHash(prevHash, baseEnvelope);
  const fullEvent: SpineEventEnvelope = {
    ...baseEnvelope,
    prevHash,
    hash,
  };

  spine.events.push(fullEvent);
  if (spine.events.length > MAX_STORED_EVENTS) {
    spine.events = spine.events.slice(-MAX_STORED_EVENTS);
  }
  return { event: fullEvent, deduplicated: false };
}

/**
 * Recompute per-org SHA-256 hash chain over sequential stored events (Spec §12).
 */
export function verifyOrgHashChain(
  events: SpineEventEnvelope[],
  filterOrgUuid?: string
): { verified: boolean; checkedCount: number; headHash: string; mismatchSeq?: number } {
  const grouped = new Map<string, SpineEventEnvelope[]>();
  const sorted = [...events]
    .filter((e) => !filterOrgUuid || e.orgId === filterOrgUuid || e.legacyOrgId === filterOrgUuid)
    .sort((a, b) => a.globalSeq - b.globalSeq);

  for (const ev of sorted) {
    const arr = grouped.get(ev.orgId) ?? [];
    arr.push(ev);
    grouped.set(ev.orgId, arr);
  }

  let checkedCount = 0;
  let lastHead = "0".repeat(64);

  for (const orgEvents of grouped.values()) {
    for (let i = 0; i < orgEvents.length; i += 1) {
      const ev = orgEvents[i];
      if (i > 0 && ev.prevHash !== orgEvents[i - 1].hash) {
        return {
          verified: false,
          checkedCount,
          headHash: ev.hash,
          mismatchSeq: ev.globalSeq,
        };
      }
      const { hash, prevHash, ...rest } = ev;
      const expected = computeEnvelopeHash(prevHash, rest);
      if (expected !== hash) {
        return {
          verified: false,
          checkedCount,
          headHash: hash,
          mismatchSeq: ev.globalSeq,
        };
      }
      checkedCount += 1;
      lastHead = hash;
    }
  }

  return { verified: true, checkedCount, headHash: lastHead };
}

/**
 * Idempotently backfill accounts, branches, profiles, batches, sales, orders, and tickets
 * into the canonical Ontology & Event Spine store (`db.spine`).
 */
export function ensureSpineBackfill(db: WorkspaceDbSnapshot): WorkspaceSpineStore {
  if (!db.spine) {
    db.spine = createEmptySpineStore();
  }
  const spine = db.spine;
  if (!spine.productMaster || spine.productMaster.length === 0) {
    spine.productMaster = [...PRODUCT_MASTER_SEED];
  }

  // 1. Legacy ID Map + Membership & ProductAlias sync
  for (const acc of db.accounts) {
    const orgUuid = getOrCreateLegacyMap(spine, "org", acc.id, "workspace_db");
    appendSpineEvent(db, {
      legacyOrgId: acc.id,
      actorKind: "system",
      type: acc.subscriptionActive ? "access.state_changed" : "schema.migrated",
      idempotencyKey: `import:org:${acc.id}`,
      occurredAt: acc.createdAt,
      receivedAt: acc.createdAt,
      payload: {
        org_uuid: orgUuid,
        org_name: acc.orgName,
        to: acc.hqLock?.locked ? "locked" : acc.billingOverdue ? "overdue" : acc.subscriptionActive ? "active" : "trial",
      },
      piiClass: "none",
      source: "import",
    });
  }

  for (const ctr of db.centres) {
    getOrCreateLegacyMap(spine, "branch", ctr.id, "workspace_db");
  }
  for (const prof of db.profiles) {
    getOrCreateLegacyMap(spine, "person", prof.id, "workspace_db");
  }

  // 2. Map Batches -> ProductAlias, Global Lot, Branch StockHolding & Edge Graph
  for (const bat of db.batches ?? []) {
    const orgUuid = getOrCreateLegacyMap(spine, "org", bat.accountId, "workspace_db");
    const branchUuid = getOrCreateLegacyMap(spine, "branch", bat.centreId, "workspace_db");
    const orgName = db.accounts.find((a) => a.id === bat.accountId)?.orgName || bat.accountId;

    const existingAlias = spine.productAliases.find(
      (a) => a.orgId === bat.accountId && a.rawText === `${bat.brandName} (${bat.genericName})`
    );
    const resolved = existingAlias
      ? {
          masterId: existingAlias.masterId,
          masterLabel: existingAlias.masterLabel,
          confidence: existingAlias.confidence,
          status: existingAlias.status,
        }
      : resolveProductAlias(bat.brandName, bat.genericName);

    if (!existingAlias) {
      spine.productAliases.push({
        id: deterministicLegacyUuid("alias", `${bat.accountId}:${bat.brandName}:${bat.genericName}`),
        orgId: bat.accountId,
        orgName,
        rawText: `${bat.brandName} (${bat.genericName})`,
        masterId: resolved.masterId,
        masterLabel: resolved.masterLabel,
        confidence: resolved.confidence,
        status: resolved.status,
      });
    }

    const lotId = getOrCreateLegacyMap(spine, "lot", `${resolved.masterId}:${bat.batchNumber}`, "workspace_db");
    let lot = spine.lots.find((l) => l.id === lotId);
    if (!lot) {
      lot = {
        id: lotId,
        masterId: resolved.masterId,
        manufacturerName: "Registered Distributor",
        batchNumber: bat.batchNumber,
        expiryDate: bat.expiryDate,
        firstSeenEvent: deterministicLegacyUuid("event", `bat:${bat.id}`),
      };
      spine.lots.push(lot);
    }

    const holding = spine.stockHoldings.find((h) => h.branchId === branchUuid && h.lotId === lotId);
    if (!holding) {
      spine.stockHoldings.push({
        branchId: branchUuid,
        lotId,
        orgId: orgUuid,
        qty: bat.quantity,
        avgCostTzs: bat.costPriceTzs,
        quarantined: Boolean(bat.quarantined),
        lastEventSeq: spine.globalSeqCounter + 1,
      });
    } else {
      holding.qty = Math.max(0, bat.quantity);
      holding.quarantined = Boolean(bat.quarantined);
    }

    const evOut = appendSpineEvent(db, {
      legacyOrgId: bat.accountId,
      legacyBranchId: bat.centreId,
      actorKind: "system",
      type: "stock.received",
      idempotencyKey: `import:batch:${bat.id}`,
      occurredAt: bat.dateEntered || new Date().toISOString(),
      receivedAt: bat.dateEntered || new Date().toISOString(),
      payload: {
        lot_id: lotId,
        master_id: resolved.masterId,
        qty: bat.quantity,
        cost_tzs: bat.costPriceTzs,
      },
      piiClass: "none",
      source: "import",
    });

    if (!spine.edges.some((e) => e.srcId === branchUuid && e.rel === "HOLDS" && e.dstId === lotId)) {
      spine.edges.push({
        srcType: "Branch",
        srcId: branchUuid,
        rel: "HOLDS",
        dstType: "Lot",
        dstId: lotId,
        validFrom: bat.dateEntered || new Date().toISOString(),
        sourceEvent: evOut.event.eventId,
      });
    }
  }

  // 3. Backfill Sales, Wholesale Orders & Support Tickets
  for (const s of db.sales ?? []) {
    const patientRef = s.customerPhone || s.customerName
      ? createHash("sha256").update(`${s.accountId}:${s.customerPhone || s.customerName}`).digest("hex").slice(0, 16)
      : null;
    appendSpineEvent(db, {
      legacyOrgId: s.accountId,
      legacyBranchId: s.centreId,
      actorId: s.profileId,
      actorKind: "staff",
      type: "sale.completed",
      idempotencyKey: `import:sale:${s.id}`,
      occurredAt: s.createdAt,
      receivedAt: s.createdAt,
      payload: {
        sale_id: s.id,
        payment: { method: s.paymentMethod, amount_tzs: s.totalTzs },
        item_count: s.itemCount,
        patient_ref: patientRef,
      },
      piiClass: patientRef ? "pseudonymous" : "none",
      source: "import",
    });
  }

  for (const ord of db.wholesaleOrders ?? []) {
    getOrCreateLegacyMap(spine, "order", ord.id, "workspace_db");
    appendSpineEvent(db, {
      legacyOrgId: ord.accountId,
      legacyBranchId: ord.centreId,
      actorKind: "staff",
      type: ord.escrowStatus === "released" ? "escrow.released" : "escrow.held",
      idempotencyKey: `import:order:${ord.id}:${ord.escrowStatus}`,
      occurredAt: ord.createdAt,
      receivedAt: ord.deliveredAt || ord.createdAt,
      payload: {
        order_ref: ord.orderReference,
        total_tzs: ord.totalTzs,
        escrow_status: ord.escrowStatus,
      },
      piiClass: "none",
      source: "import",
    });
  }

  for (const tk of db.supportTickets ?? []) {
    getOrCreateLegacyMap(spine, "ticket", tk.id, "workspace_db");
    appendSpineEvent(db, {
      legacyOrgId: tk.accountId || db.accounts[0]?.id || "system",
      actorKind: "staff",
      type: "ticket.opened",
      idempotencyKey: `import:ticket:${tk.id}`,
      occurredAt: tk.createdAt,
      receivedAt: tk.createdAt,
      payload: {
        ticket_ref: tk.ticketRef,
        category: tk.category,
        priority: tk.priority,
        status: tk.status,
      },
      piiClass: "personal",
      source: "import",
    });
  }

  // 4. Initial Case & Privacy Seed Records if empty
  if (spine.cases.length === 0 && db.accounts[0]) {
    spine.cases.push({
      id: "CASE-INF-01",
      title: "Trailing Shift Cash Variance Baseline Check",
      category: "till_anomaly",
      status: "open",
      severity: "normal",
      pinnedEntities: [db.accounts[0].orgName],
      citedEventIds: spine.events.slice(-2).map((e) => e.eventId),
      notes: [
        {
          id: "note_init_1",
          author: "Compliance Rules Engine",
          body: "Monitoring after-hours sales share and shift close variance across all active branches.",
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
    });
  }

  if (spine.privacyReleases.length === 0) {
    const uniqueRegions = Math.max(1, db.accounts.length);
    spine.privacyReleases.push({
      id: "REL-INIT-01",
      recipient: "Ministry & Academic Partners",
      project: "Essential Medicines Regional Availability Index",
      querySummary: "Monthly Antimalarial & Antibiotic Stock Cover",
      contributingOrgsCount: uniqueRegions,
      minGroupSize: 5,
      maxDominanceSharePct: 38,
      epsilonSpent: 0.5,
      budgetRemaining: 4.5,
      status: uniqueRegions >= 5 ? "approved" : "blocked_small_cell",
      createdAt: new Date().toISOString(),
    });
  }

  spine.backfilledAt = new Date().toISOString();
  return spine;
}
