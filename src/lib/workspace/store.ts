import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { randomUUID } from "crypto";
import { hashSecret, normalizeSecurityAnswer } from "@/lib/security/harness";
import {
  clampProfileCapabilities,
  ROLE_PERMISSION_RULES,
  type ProfileCapabilities,
  type WorkspaceProfileRole,
} from "@/lib/workspace/permissions";

export { clampProfileCapabilities, ROLE_PERMISSION_RULES };
export type { ProfileCapabilities, WorkspaceProfileRole };

/** True when running on Vercel production (no writable local filesystem) */
const IS_VERCEL = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
/** True in demo/mock mode only */
const IS_MOCK = process.env.NEXT_PUBLIC_MOCK_MODE === "true" || process.env.CERVOS_MOCK_AUTH === "true";

export type WorkspaceRoleType =
  | "pharmacy"
  | "supplier"
  | "dispensary"
  | "researcher"
  | "investor"
  | "other";

export interface CertificateRecord {
  id: string;
  docType: string;
  licenseNumber: string;
  fileName: string;
  uploadedAt: string;
}

export interface PasskeyCredentialRecord {
  credentialId: string;
  accountId: string;
  profileId?: string;
  label: string;
  publicKeySpkiBase64: string;
  createdAt: string;
}

export interface WorkspaceCentre {
  id: string;
  accountId: string;
  name: string;
  region: string;
  address: string;
  phone: string;
  lat?: number;
  lng?: number;
  isPrimary: boolean;
  createdAt: string;
}

export interface WorkspaceProfile {
  id: string;
  accountId: string;
  centreId: string;
  username?: string;
  displayName: string;
  role: WorkspaceProfileRole;
  pinHash: string;
  passwordHash?: string;
  isMasterAdmin: boolean;
  capabilities?: Partial<ProfileCapabilities>;
  profilePrefs?: {
    fontScale?: "compact" | "standard" | "large";
    themePref?: "light" | "dark" | "system";
    preferredLang?: "EN" | "SW";
  };
  createdAt: string;
}

export interface WorkspaceCustomization {
  brandLogoUrl?: string;
  brandAccent?: string;
  fontScale?: "compact" | "standard" | "large";
  layoutType?: "balanced" | "focus" | "executive";
  themePref?: "light" | "dark" | "system";
}

export interface WorkspaceAccount {
  id: string;
  username?: string;
  email: string;
  fullName: string;
  ownerPhone?: string;
  sex?: "female" | "male" | "prefer_not_to_say";
  signupGeo?: {
    region: string;
    lat?: number;
    lng?: number;
    source: "gps" | "manual";
    snappedAt: string;
  };
  roleType: WorkspaceRoleType;
  customRoleLabel?: string;
  orgName: string;
  region: string;
  lang: "EN" | "SW";
  passwordHash: string;
  securityQuestion: string;
  securityAnswerHash: string;
  requireSecurityEveryTime: boolean;
  trustGeneration: number;
  onboardingDone: boolean;
  verificationStatus: "skipped" | "verified";
  networkUnlocked: boolean;
  subscriptionActive: boolean;
  subscriptionPlan: string;
  billingOverdue?: boolean;
  trialEndsAt?: string;
  hqLock?: {
    locked: boolean;
    reason: string;
    lockedBy: string;
    lockedAt: string;
  };
  certificates: CertificateRecord[];
  customization?: WorkspaceCustomization;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  accountId: string;
  actor: string;
  category: "AUTH" | "SETUP" | "SECURITY" | "POS" | "COMPLIANCE" | "BILLING";
  action: string;
  createdAt: string;
}

export interface WorkspaceStockBatch {
  id: string;
  accountId: string;
  centreId: string;
  productId: string;
  genericName: string;
  brandName: string;
  category: string;
  batchNumber: string;
  quantity: number;
  costPriceTzs: number;
  salePriceTzs: number;
  expiryDate: string;
  dateEntered?: string;
  lowStockThreshold?: number;
  imageUrl?: string;
  requiresPrescription: boolean;
  isControlled: boolean;
  quarantined: boolean;
  createdAt: string;
}

export interface WorkspaceSaleLine {
  productId: string;
  brandName: string;
  category: string;
  batchId?: string;
  batchNumber?: string;
  qty: number;
  unitPriceTzs: number;
  unitCostTzs: number;
}

export interface WorkspaceSaleRecord {
  id: string;
  accountId: string;
  centreId: string;
  profileId: string;
  actorName: string;
  receiptNumber?: string;
  customerName?: string;
  customerPhone?: string;
  totalTzs: number;
  itemCount: number;
  paymentMethod: "cash" | "mpesa" | "tigo" | "halopesa" | "card";
  prescriptionRef?: string;
  lines?: WorkspaceSaleLine[];
  createdAt: string;
}

export interface WorkspaceWholesaleOrder {
  id: string;
  accountId: string;
  centreId: string;
  orderReference: string;
  supplierId: string;
  supplierName: string;
  productId: string;
  productName: string;
  genericName: string;
  category: string;
  quantity: number;
  unitPriceTzs: number;
  transportFeeTzs?: number;
  routeLabel?: string;
  totalTzs: number;
  escrowStatus: "escrow_held" | "released" | "cancelled";
  orderStatus: "pending" | "in_transit" | "delivered";
  createdAt: string;
  deliveredAt?: string;
}

export interface BranchChatAttachment {
  kind: "wholesale_request" | "batch" | "sale" | "order";
  refId: string;
  title: string;
  subtitle: string;
  catalogId?: string;
  quantity?: number;
  amountTzs?: number;
  approvalStatus?: "pending" | "approved" | "declined";
}

export interface BranchChatMessage {
  id: string;
  accountId: string;
  centreId: string;
  senderProfileId: string;
  senderName: string;
  senderRole: string;
  body: string;
  attachment?: BranchChatAttachment;
  createdAt: string;
}

export interface WorkspaceNotification {
  id: string;
  accountId: string;
  centreId: string;
  kind: "approval" | "expiry" | "escrow" | "system";
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface WorkspaceExpenseRecord {
  id: string;
  accountId: string;
  centreId: string;
  category: "Rent & Premises" | "Utilities & Cold Chain" | "Staff & Shift" | "Compliance & Permits" | "Packaging & Supplies";
  description: string;
  amountTzs: number;
  createdAt: string;
}

export interface WorkspacePaymentSettings {
  mpesaPaybill: string;
  tigoLipaNumber: string;
  bankName: string;
  bankAccount: string;
  settlementCycle: "daily" | "instant" | "weekly";
  vatRegistered: boolean;
}

export interface WorkspaceJoinRequest {
  id: string;
  targetAccountId: string;
  targetOrgName: string;
  requesterFullName: string;
  requesterUsername: string;
  requesterEmail: string;
  requesterSex: "female" | "male" | "prefer_not_to_say";
  requesterPasswordHash: string;
  requesterLang: "EN" | "SW";
  requesterRegion: string;
  requesterGeo?: { lat?: number; lng?: number; source: "gps" | "manual" };
  requestedRoleLabel?: string;
  note?: string;
  status: "pending" | "approved" | "declined" | "accepted";
  allocatedCentreId?: string;
  allocatedCentreName?: string;
  allocatedRole?: WorkspaceProfileRole;
  allocatedProfileId?: string;
  allocatedPinPreview?: string;
  declineReason?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface HqUpdateItem {
  id: string;
  tag: "RELEASE" | "HARDWARE" | "COMPLIANCE" | "GROWTH";
  title: string;
  swTitle: string;
  summary: string;
  swSummary: string;
  ctaLabel: string;
  ctaTarget: "network" | "billing" | "download" | "reports" | "auth";
  publishedAt: string;
}

export interface HqCustomMessage {
  id: string;
  accountId: string;
  title: string;
  swTitle: string;
  body: string;
  swBody: string;
  severity: "info" | "action" | "critical";
  ctaLabel?: string;
  ctaTarget?: "overview" | "reports" | "billing" | "network" | "team" | "download";
  acknowledged?: boolean;
  senderName: string;
  createdAt: string;
}

export interface SavedCustomerPreset {
  id: string;
  accountId: string;
  centreId: string;
  customerName: string;
  phone?: string;
  note?: string;
  items: Array<{ productId: string; brandName: string; qty: number }>;
  createdAt: string;
}

export interface WorkspaceShiftLog {
  id: string;
  accountId: string;
  centreId: string;
  profileId: string;
  staffName: string;
  role: string;
  clockInAt: string;
  clockOutAt?: string;
  durationMinutes?: number;
}

export interface WorkspaceDbSnapshot {
  accounts: WorkspaceAccount[];
  centres: WorkspaceCentre[];
  profiles: WorkspaceProfile[];
  passkeys: PasskeyCredentialRecord[];
  auditLogs?: AuditLogEntry[];
  batches?: WorkspaceStockBatch[];
  sales?: WorkspaceSaleRecord[];
  wholesaleOrders?: WorkspaceWholesaleOrder[];
  branchMessages?: BranchChatMessage[];
  notifications?: WorkspaceNotification[];
  expenses?: WorkspaceExpenseRecord[];
  paymentSettings?: Record<string, WorkspacePaymentSettings>;
  joinRequests?: WorkspaceJoinRequest[];
  hqUpdates?: HqUpdateItem[];
  hqMessages?: HqCustomMessage[];
  savedCustomers?: SavedCustomerPreset[];
  shiftLogs?: WorkspaceShiftLog[];
}

const DB_PATH = join(process.cwd(), ".next", "cache", "cervos-workspace-db.json");
const g = globalThis as unknown as {
  __cervosWorkspaceDb?: WorkspaceDbSnapshot;
  __cervosDbSupabaseSynced?: boolean;
  __cervosDbLastSyncMs?: number;
  __cervosPersistPromise?: Promise<void>;
};

// ---------------------------------------------------------------------------
// Supabase persistence helpers (REST fetch — zero Turbopack require issues)
// ---------------------------------------------------------------------------
function getSupabaseRestConfig(): { url: string; key: string } | null {
  if (process.env.NODE_ENV === "test") return null;
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !key) return null;
  return { url, key };
}

/** Push current snapshot to Supabase workspace_db table and track the promise for flushing. */
function persistToSupabase(db: WorkspaceDbSnapshot): Promise<void> {
  const cfg = getSupabaseRestConfig();
  if (!cfg) return Promise.resolve();
  // Never overwrite Supabase with an uninitialized empty cold-start shell unless data actually existed
  const hasContent = db.accounts.length > 0 || (db.joinRequests?.length ?? 0) > 0;
  if (!hasContent && !g.__cervosDbSupabaseSynced) return Promise.resolve();

  const writePromise = (async () => {
    try {
      const resp = await fetch(`${cfg.url}/rest/v1/workspace_db?on_conflict=shard`, {
        method: "POST",
        headers: {
          apikey: cfg.key,
          Authorization: `Bearer ${cfg.key}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          shard: "main",
          snapshot: db,
          updated_at: new Date().toISOString(),
        }),
        cache: "no-store",
      });
      if (!resp.ok) {
        const msg = await resp.text().catch(() => String(resp.status));
        console.warn("[workspace/store] Supabase persist failed:", resp.status, msg.slice(0, 200));
      } else {
        g.__cervosDbLastSyncMs = Date.now();
      }
    } catch (err) {
      console.warn("[workspace/store] Supabase persist error:", err instanceof Error ? err.message : String(err));
    }
  })();

  g.__cervosPersistPromise = writePromise;
  return writePromise;
}

/** Wait for any pending Supabase snapshot write to finish before returning a serverless response. */
export async function flushWorkspaceDb(): Promise<void> {
  if (g.__cervosPersistPromise) {
    await g.__cervosPersistPromise;
  }
}

/** Load snapshot from Supabase workspace_db table. Returns null if unavailable. */
async function loadFromSupabase(): Promise<WorkspaceDbSnapshot | null> {
  const cfg = getSupabaseRestConfig();
  if (!cfg) return null;
  try {
    const resp = await fetch(`${cfg.url}/rest/v1/workspace_db?shard=eq.main&select=snapshot`, {
      method: "GET",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!resp.ok) {
      const msg = await resp.text().catch(() => String(resp.status));
      console.warn("[workspace/store] Supabase load failed:", resp.status, msg.slice(0, 200));
      return null;
    }
    const rows = (await resp.json()) as Array<{ snapshot?: WorkspaceDbSnapshot }>;
    const snap = rows?.[0]?.snapshot;
    if (snap && Array.isArray(snap.accounts) && (snap.accounts.length > 0 || (snap.joinRequests?.length ?? 0) > 0)) {
      return snap;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Warm/refresh the in-memory workspace DB from Supabase so separate serverless
 * instances always see committed signups, onboarding, and PIN updates.
 */
export async function warmDbFromSupabase(force = false): Promise<void> {
  if (process.env.NODE_ENV === "test") return;
  if (g.__cervosPersistPromise) {
    await g.__cervosPersistPromise;
  }
  const now = Date.now();
  if (!force && g.__cervosDbSupabaseSynced && g.__cervosDbLastSyncMs && now - g.__cervosDbLastSyncMs < 1500) {
    return;
  }
  const remote = await loadFromSupabase();
  if (remote) {
    const hasRealAccounts = remote.accounts.some((a) => !a.id.startsWith("acc_demo_"));
    if (hasRealAccounts || !g.__cervosWorkspaceDb || g.__cervosWorkspaceDb.accounts.length === 0) {
      g.__cervosWorkspaceDb = remote;
      if (!IS_VERCEL) {
        try {
          const dir = dirname(DB_PATH);
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          writeFileSync(DB_PATH, JSON.stringify(remote, null, 2), "utf8");
        } catch { /* read-only fs ok */ }
      }
    }
  }
  g.__cervosDbSupabaseSynced = true;
  g.__cervosDbLastSyncMs = Date.now();
}

function buildInitialSeed(): WorkspaceDbSnapshot {
  const accountId = "acc_demo_kariakoo";
  const centre1Id = "ctr_demo_main";
  const centre2Id = "ctr_demo_annex";

  return {
    accounts: [
      {
        id: accountId,
        username: "amani",
        email: "demo@pharmacy.co.tz",
        fullName: "Amani Juma",
        roleType: "pharmacy",
        orgName: "Uzuri Care Pharmacy",
        region: "Dar es Salaam",
        lang: "EN",
        passwordHash: hashSecret("CervosDemo2026!").hash,
        securityQuestion: "Which neighborhood did your first branch open in?",
        securityAnswerHash: hashSecret(normalizeSecurityAnswer("Kariakoo")).hash,
        requireSecurityEveryTime: false,
        trustGeneration: 1,
        onboardingDone: true,
        verificationStatus: "verified",
        networkUnlocked: true,
        subscriptionActive: true,
        subscriptionPlan: "Full Pharmacy (Yearly)",
        certificates: [
          {
            id: "cert_demo_1",
            docType: "Pharmacy Operating Permit",
            licenseNumber: "PC-TZ-2026-0842",
            fileName: "uzuri-care-permit.pdf",
            uploadedAt: "2026-11-01T08:00:00Z",
          },
        ],
        createdAt: "2026-11-01T08:00:00Z",
      },
    ],
    centres: [
      {
        id: centre1Id,
        accountId,
        name: "Kariakoo Main Dispensary",
        region: "Dar es Salaam",
        address: "Msimbazi Street, Plot 14",
        phone: "+255 713 000 101",
        isPrimary: true,
        createdAt: "2026-11-01T08:00:00Z",
      },
      {
        id: centre2Id,
        accountId,
        name: "Mwenge Bus Terminal Branch",
        region: "Dar es Salaam",
        address: "Sam Nujoma Rd, Stall B4",
        phone: "+255 713 000 102",
        isPrimary: false,
        createdAt: "2026-11-02T08:00:00Z",
      },
    ],
    profiles: [
      {
        id: "prof_demo_owner",
        accountId,
        centreId: centre1Id,
        username: "amani",
        displayName: "Amani Juma (Owner)",
        role: "pharmacy_owner",
        pinHash: hashSecret("8429").hash,
        isMasterAdmin: true,
        createdAt: "2026-11-01T08:00:00Z",
      },
      {
        id: "prof_demo_pharm",
        accountId,
        centreId: centre1Id,
        username: "neema.kariakoo",
        displayName: "Neema Mbeki (Pharmacist)",
        role: "superintendent_pharmacist",
        pinHash: hashSecret("5731").hash,
        isMasterAdmin: false,
        createdAt: "2026-11-01T08:05:00Z",
      },
      {
        id: "prof_demo_cashier",
        accountId,
        centreId: centre2Id,
        username: "baraka.mwenge",
        displayName: "Baraka John (Counter)",
        role: "pos_cashier",
        pinHash: hashSecret("6194").hash,
        isMasterAdmin: false,
        createdAt: "2026-11-02T08:10:00Z",
      },
    ],
    passkeys: [],
    auditLogs: [
      {
        id: "aud_seed_1",
        accountId,
        actor: "Amani Juma (Owner)",
        category: "COMPLIANCE",
        action: "Operating Permit PC-TZ-2026-0842 verified for Network access",
        createdAt: "2026-11-16T09:15:00Z",
      },
      {
        id: "aud_seed_2",
        accountId,
        actor: "Amani Juma (Owner)",
        category: "SETUP",
        action: "Added second branch: Mwenge Bus Terminal Branch",
        createdAt: "2026-11-16T11:30:00Z",
      },
      {
        id: "aud_seed_3",
        accountId,
        actor: "Neema Mbeki (Pharmacist)",
        category: "POS",
        action: "Closed evening shift drawer cleanly (TZS 842,000)",
        createdAt: "2026-11-17T08:10:00Z",
      },
    ],
  };
}

export function appendAuditLog(
  db: WorkspaceDbSnapshot,
  entry: Omit<AuditLogEntry, "id" | "createdAt">
): void {
  const list = (db.auditLogs ??= []);
  list.unshift({
    id: newId("aud"),
    createdAt: new Date().toISOString(),
    ...entry,
  });
  if (list.length > 300) {
    list.length = 300;
  }
}

export function isUsernameTaken(
  db: WorkspaceDbSnapshot,
  username: string,
  excludeProfileId?: string
): boolean {
  const clean = username.trim().toLowerCase().replace(/^@+/, "");
  if (!clean) return false;
  return (
    db.profiles.some((p) => p.id !== excludeProfileId && p.username?.toLowerCase() === clean) ||
    db.accounts.some(
      (a) =>
        a.username?.toLowerCase() === clean &&
        !db.profiles.some((p) => p.id === excludeProfileId && p.accountId === a.id && p.isMasterAdmin)
    ) ||
    (db.joinRequests ?? []).some(
      (r) => r.status !== "accepted" && r.requesterUsername.toLowerCase() === clean
    )
  );
}

export function suggestUniqueUsername(
  db: WorkspaceDbSnapshot,
  seedText: string,
  excludeProfileId?: string
): string {
  const base = seedText
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9._-]+/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")
    .slice(0, 24) || "user";
  const safeBase = base.length < 3 ? `${base}01` : base;
  if (!isUsernameTaken(db, safeBase, excludeProfileId)) return safeBase;
  for (let i = 2; i < 999; i++) {
    const cand = `${safeBase.slice(0, 26)}.${i}`;
    if (!isUsernameTaken(db, cand, excludeProfileId)) return cand;
  }
  return `${safeBase.slice(0, 20)}.${randomUUID().slice(0, 4)}`;
}

export function destinationForProfileRole(role: WorkspaceProfileRole, isMasterAdmin: boolean): string {
  if (isMasterAdmin || role === "pharmacy_owner" || role === "supplier_admin") {
    return "/app?scope=all";
  }
  if (role === "superintendent_pharmacist") {
    return "/app?tab=inventory";
  }
  if (role === "pos_cashier" || role === "warehouse_dispatcher" || role === "hospital_pharmacist") {
    return "/app?tab=operations";
  }
  return "/app";
}

function backfillMissingUsernames(db: WorkspaceDbSnapshot): boolean {
  let dirty = false;
  const known: Record<string, string> = {
    prof_demo_owner: "amani",
    prof_demo_pharm: "neema.kariakoo",
    prof_demo_cashier: "baraka.mwenge",
  };
  for (const a of db.accounts) {
    if (!a.username) {
      a.username = a.id === "acc_demo_kariakoo" ? "amani" : suggestUniqueUsername(db, a.email.split("@")[0] || a.fullName);
      dirty = true;
    }
  }
  for (const p of db.profiles) {
    if (!p.username) {
      const preset = known[p.id];
      p.username = preset && !isUsernameTaken(db, preset, p.id)
        ? preset
        : suggestUniqueUsername(db, p.displayName, p.id);
      dirty = true;
    }
  }

  // Demo accounts are only injected in mock/dev or test mode, never in production.
  if (!IS_MOCK && process.env.NODE_ENV !== "test") return dirty;

  // Seed fresh standalone Arusha test org + Waiting/Approved Lounge test users
  if (!db.accounts.some((a) => a.id === "acc_demo_arusha")) {
    db.accounts.push({
      id: "acc_demo_arusha",
      username: "tariq.arusha",
      email: "tariq@kilimanjaropharmacy.co.tz",
      fullName: "Tariq Masawe",
      sex: "male",
      signupGeo: { region: "Arusha", lat: -3.3869, lng: 36.683, source: "gps", snappedAt: "2026-11-16T08:00:00Z" },
      roleType: "pharmacy",
      orgName: "Kilimanjaro Care Pharmacy",
      region: "Arusha",
      lang: "EN",
      passwordHash: hashSecret("TariqDemo2026!").hash,
      securityQuestion: "Which city is your main dispensary located in?",
      securityAnswerHash: hashSecret(normalizeSecurityAnswer("Arusha")).hash,
      requireSecurityEveryTime: false,
      trustGeneration: 1,
      onboardingDone: true,
      verificationStatus: "verified",
      networkUnlocked: true,
      subscriptionActive: true,
      subscriptionPlan: "Community Standard",
      certificates: [],
      createdAt: "2026-11-16T08:00:00Z",
    });
    db.centres.push({
      id: "ctr_arusha_main",
      accountId: "acc_demo_arusha",
      name: "Clocktower Arusha Dispensary",
      region: "Arusha",
      address: "Sokoine Road, Block C",
      phone: "+255 754 112 233",
      lat: -3.3869,
      lng: 36.683,
      isPrimary: true,
      createdAt: "2026-11-16T08:00:00Z",
    });
    db.profiles.push({
      id: "prof_arusha_owner",
      accountId: "acc_demo_arusha",
      centreId: "ctr_arusha_main",
      username: "tariq.arusha",
      displayName: "Tariq Masawe (Owner)",
      role: "pharmacy_owner",
      pinHash: hashSecret("7183").hash,
      passwordHash: hashSecret("TariqDemo2026!").hash,
      isMasterAdmin: true,
      createdAt: "2026-11-16T08:00:00Z",
    });
    dirty = true;
  }

  const joinReqs = (db.joinRequests ??= []);
  if (db.accounts.some((a) => a.id === "acc_demo_kariakoo")) {
    if (!joinReqs.some((r) => r.id === "jreq_demo_zainab")) {
      joinReqs.push({
        id: "jreq_demo_zainab",
        targetAccountId: "acc_demo_kariakoo",
        targetOrgName: "Uzuri Care Pharmacy",
        requesterFullName: "Zainab Omary",
        requesterUsername: "zainab.msasani",
        requesterEmail: "zainab@pharmacy.co.tz",
        requesterSex: "female",
        requesterPasswordHash: hashSecret("ZainabDemo2026!").hash,
        requesterLang: "SW",
        requesterRegion: "Dar es Salaam",
        requesterGeo: { lat: -6.758, lng: 39.279, source: "gps" },
        requestedRoleLabel: "Pharmacist",
        note: "Evening pharmacist cover available.",
        status: "pending",
        createdAt: daysAgoIso(0.08),
      });
      dirty = true;
    }

    if (!joinReqs.some((r) => r.id === "jreq_demo_halima")) {
      const halimaPassHash = hashSecret("HalimaDemo2026!").hash;
      if (!db.profiles.some((p) => p.id === "prof_demo_halima")) {
        db.profiles.push({
          id: "prof_demo_halima",
          accountId: "acc_demo_kariakoo",
          centreId: "ctr_demo_annex",
          username: "halima.temeke",
          displayName: "Halima Bakari",
          role: "pos_cashier",
          pinHash: hashSecret("4927").hash,
          passwordHash: halimaPassHash,
          isMasterAdmin: false,
          createdAt: daysAgoIso(0.15),
        });
      }
      joinReqs.push({
        id: "jreq_demo_halima",
        targetAccountId: "acc_demo_kariakoo",
        targetOrgName: "Uzuri Care Pharmacy",
        requesterFullName: "Halima Bakari",
        requesterUsername: "halima.temeke",
        requesterEmail: "halima@pharmacy.co.tz",
        requesterSex: "female",
        requesterPasswordHash: halimaPassHash,
        requesterLang: "EN",
        requesterRegion: "Dar es Salaam",
        requesterGeo: { lat: -6.865, lng: 39.259, source: "gps" },
        requestedRoleLabel: "Counter Cashier",
        status: "approved",
        allocatedCentreId: "ctr_demo_annex",
        allocatedCentreName: "Mwenge Bus Terminal Branch",
        allocatedRole: "pos_cashier",
        allocatedProfileId: "prof_demo_halima",
        allocatedPinPreview: "4927",
        createdAt: daysAgoIso(0.25),
        reviewedAt: daysAgoIso(0.05),
      });
      dirty = true;
    }
  }

  return dirty;
}

export function getWorkspaceDb(): WorkspaceDbSnapshot {
  if (g.__cervosWorkspaceDb) {
    if (backfillMissingUsernames(g.__cervosWorkspaceDb)) {
      saveWorkspaceDb(g.__cervosWorkspaceDb);
    }
    return g.__cervosWorkspaceDb;
  }

  // On Vercel, skip local file (ephemeral filesystem); rely on Supabase warm-up.
  if (!IS_VERCEL) {
    try {
      if (existsSync(DB_PATH)) {
        const parsed = JSON.parse(readFileSync(DB_PATH, "utf8")) as WorkspaceDbSnapshot;
        if (
          parsed &&
          Array.isArray(parsed.accounts) &&
          (parsed.accounts.length > 0 || process.env.NODE_ENV !== "test")
        ) {
          if (backfillMissingUsernames(parsed)) {
            saveWorkspaceDb(parsed);
          }
          g.__cervosWorkspaceDb = parsed;
          return parsed;
        }
      }
    } catch {
      // Fall back gracefully to seed
    }
  }

  // Cold start with no data yet — start with an empty production slate.
  // Do NOT persist empty cold-start state to Supabase so we never overwrite real accounts.
  const seed = IS_MOCK || process.env.NODE_ENV === "test" ? buildInitialSeed() : buildEmptyDb();
  backfillMissingUsernames(seed);
  g.__cervosWorkspaceDb = seed;
  if (seed.accounts.length > 0) {
    saveWorkspaceDb(seed);
  }
  return seed;
}

/** Empty production DB — no demo data. Used on Vercel cold starts until Supabase warms up. */
function buildEmptyDb(): WorkspaceDbSnapshot {
  return { accounts: [], centres: [], profiles: [], passkeys: [] };
}

export function saveWorkspaceDb(db: WorkspaceDbSnapshot): void {
  g.__cervosWorkspaceDb = db;
  // Local file (dev only; Vercel fs is ephemeral)
  if (!IS_VERCEL) {
    try {
      const dir = dirname(DB_PATH);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
    } catch {
      // Ignore read-only filesystem edge environments
    }
  }
  // Always persist to Supabase (non-blocking background write)
  persistToSupabase(db);
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().slice(0, 12)}`;
}

export function defaultProfileRoleForAccount(roleType: WorkspaceRoleType): WorkspaceProfileRole {
  switch (roleType) {
    case "supplier":
      return "supplier_admin";
    case "dispensary":
      return "hospital_pharmacist";
    case "researcher":
      return "policy_researcher";
    case "investor":
      return "investor_partner";
    default:
      return "pharmacy_owner";
  }
}

export const SUPPLIER_CATALOG_SEED = [
  {
    id: "sc-1",
    supplierId: "acc-afya",
    supplierName: "Afya Wholesale Ltd",
    supplierCity: "Dar es Salaam (Kariakoo Hub)",
    supplierLat: -6.8235,
    supplierLng: 39.2695,
    routeLabel: "Dar Hub -> Branch Express Van",
    transportFeeTzs: 6500,
    productId: "prod-1",
    productName: "Amoxil",
    genericName: "Amoxicillin 500mg",
    category: "Antibiotics",
    packSize: "100 tabs",
    unitPriceTzs: 4200,
    minOrderQty: 20,
    stockAvailable: 500,
    leadTimeDays: 2,
    requiresPrescription: true,
    verified: true,
  },
  {
    id: "sc-2",
    supplierId: "acc-afya",
    supplierName: "Afya Wholesale Ltd",
    supplierCity: "Dar es Salaam (Kariakoo Hub)",
    supplierLat: -6.8235,
    supplierLng: 39.2695,
    routeLabel: "Dar Hub -> Branch Express Van",
    transportFeeTzs: 6500,
    productId: "prod-3",
    productName: "Coartem",
    genericName: "Artemether/Lumefantrine",
    category: "Antimalarials",
    packSize: "24 tabs",
    unitPriceTzs: 5200,
    minOrderQty: 15,
    stockAvailable: 300,
    leadTimeDays: 2,
    requiresPrescription: true,
    verified: true,
  },
  {
    id: "sc-3",
    supplierId: "acc-afya",
    supplierName: "Afya Wholesale Ltd",
    supplierCity: "Dar es Salaam (Kariakoo Hub)",
    supplierLat: -6.8235,
    supplierLng: 39.2695,
    routeLabel: "Same-Day City Rider",
    transportFeeTzs: 4500,
    productId: "prod-6",
    productName: "ORASEL",
    genericName: "Oral Rehydration Salts",
    category: "Rehydration",
    packSize: "20 sachets",
    unitPriceTzs: 900,
    minOrderQty: 30,
    stockAvailable: 1200,
    leadTimeDays: 1,
    requiresPrescription: false,
    verified: true,
  },
  {
    id: "sc-4",
    supplierId: "acc-tibu",
    supplierName: "Tibu Distributors",
    supplierCity: "Dodoma Central Depot",
    supplierLat: -6.163,
    supplierLng: 35.7516,
    routeLabel: "Dodoma Corridor -> Trunk Freight",
    transportFeeTzs: 14500,
    productId: "prod-4",
    productName: "Glucophage",
    genericName: "Metformin 500mg",
    category: "Diabetes",
    packSize: "100 tabs",
    unitPriceTzs: 4600,
    minOrderQty: 20,
    stockAvailable: 250,
    leadTimeDays: 3,
    requiresPrescription: true,
    verified: true,
  },
  {
    id: "sc-5",
    supplierId: "acc-tibu",
    supplierName: "Tibu Distributors",
    supplierCity: "Dodoma Central Depot",
    supplierLat: -6.163,
    supplierLng: 35.7516,
    routeLabel: "Cold-Chain Corridor Van",
    transportFeeTzs: 16000,
    productId: "prod-10",
    productName: "Ventolin",
    genericName: "Salbutamol Inhaler",
    category: "Respiratory",
    packSize: "200 dose",
    unitPriceTzs: 12800,
    minOrderQty: 5,
    stockAvailable: 60,
    leadTimeDays: 3,
    requiresPrescription: true,
    verified: true,
  },
  {
    id: "sc-6",
    supplierId: "acc-furaha",
    supplierName: "Furaha Pharma Supply",
    supplierCity: "Arusha North Hub",
    supplierLat: -3.3869,
    supplierLng: 36.683,
    routeLabel: "Northern Highland Carrier",
    transportFeeTzs: 12000,
    productId: "prod-2",
    productName: "Panadol",
    genericName: "Paracetamol 500mg",
    category: "Analgesics",
    packSize: "100 tabs",
    unitPriceTzs: 1800,
    minOrderQty: 25,
    stockAvailable: 600,
    leadTimeDays: 2,
    requiresPrescription: false,
    verified: true,
  },
];

function expiryDaysAhead(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

/**
 * Lazily hydrates realistic Cervos schema inventory batches, sales, and Kasri
 * wholesale orders whenever an account does not yet have domain records.
 */
export function ensureAccountDomainData(
  db: WorkspaceDbSnapshot,
  accountId: string,
  primaryCentreId: string
): boolean {
  const batches = (db.batches ??= []);
  const sales = (db.sales ??= []);
  const wholesaleOrders = (db.wholesaleOrders ??= []);
  const isCleanStart = process.env.CERVOS_CLEAN_START === "true";
  const isDemoSeedAccount =
    !isCleanStart &&
    IS_MOCK &&
    (accountId === "acc-amani-pharma" ||
      accountId === "acc-kigoma-disp" ||
      accountId === "acc_demo_kariakoo" ||
      accountId === "acc_demo_arusha");

  if (!isDemoSeedAccount) {
    return false;
  }

  let dirty = false;

  if (!batches.some((b) => b.accountId === accountId)) {
    batches.push(
      {
        id: newId("bat"),
        accountId,
        centreId: primaryCentreId,
        productId: "prod-3",
        genericName: "Artemether/Lumefantrine",
        brandName: "Coartem",
        category: "Antimalarials",
        batchNumber: "CO-TZ-012",
        quantity: 42,
        costPriceTzs: 5200,
        salePriceTzs: 6800,
        expiryDate: expiryDaysAhead(12),
        requiresPrescription: true,
        isControlled: false,
        quarantined: false,
        createdAt: daysAgoIso(30),
      },
      {
        id: newId("bat"),
        accountId,
        centreId: primaryCentreId,
        productId: "prod-1",
        genericName: "Amoxicillin 500mg",
        brandName: "Amoxil",
        category: "Antibiotics",
        batchNumber: "AMX-2604",
        quantity: 85,
        costPriceTzs: 4200,
        salePriceTzs: 5500,
        expiryDate: expiryDaysAhead(24),
        requiresPrescription: true,
        isControlled: false,
        quarantined: false,
        createdAt: daysAgoIso(22),
      },
      {
        id: newId("bat"),
        accountId,
        centreId: primaryCentreId,
        productId: "prod-2",
        genericName: "Paracetamol 500mg",
        brandName: "Panadol",
        category: "Analgesics",
        batchNumber: "PAR-8810",
        quantity: 160,
        costPriceTzs: 1800,
        salePriceTzs: 2500,
        expiryDate: expiryDaysAhead(95),
        requiresPrescription: false,
        isControlled: false,
        quarantined: false,
        createdAt: daysAgoIso(18),
      },
      {
        id: newId("bat"),
        accountId,
        centreId: primaryCentreId,
        productId: "prod-4",
        genericName: "Metformin 500mg",
        brandName: "Glucophage",
        category: "Diabetes",
        batchNumber: "MET-401B",
        quantity: 48,
        costPriceTzs: 4600,
        salePriceTzs: 6000,
        expiryDate: expiryDaysAhead(55),
        requiresPrescription: true,
        isControlled: false,
        quarantined: false,
        createdAt: daysAgoIso(14),
      },
      {
        id: newId("bat"),
        accountId,
        centreId: primaryCentreId,
        productId: "prod-6",
        genericName: "Oral Rehydration Salts",
        brandName: "ORASEL",
        category: "Rehydration",
        batchNumber: "ORS-119A",
        quantity: 220,
        costPriceTzs: 500,
        salePriceTzs: 900,
        expiryDate: expiryDaysAhead(110),
        requiresPrescription: false,
        isControlled: false,
        quarantined: false,
        createdAt: daysAgoIso(10),
      },
      {
        id: newId("bat"),
        accountId,
        centreId: primaryCentreId,
        productId: "prod-10",
        genericName: "Salbutamol Inhaler",
        brandName: "Ventolin",
        category: "Respiratory",
        batchNumber: "VEN-702C",
        quantity: 18,
        costPriceTzs: 12800,
        salePriceTzs: 16500,
        expiryDate: expiryDaysAhead(180),
        requiresPrescription: true,
        isControlled: false,
        quarantined: false,
        createdAt: daysAgoIso(8),
      },
      {
        id: newId("bat"),
        accountId,
        centreId: primaryCentreId,
        productId: "prod-2",
        genericName: "Paracetamol 500mg",
        brandName: "Panadol",
        category: "Analgesics",
        batchNumber: "PAR-OLD-01",
        quantity: 10,
        costPriceTzs: 1800,
        salePriceTzs: 2500,
        expiryDate: expiryDaysAhead(-4),
        requiresPrescription: false,
        isControlled: false,
        quarantined: false,
        createdAt: daysAgoIso(90),
      }
    );
    dirty = true;
  }

  if (!sales.some((s) => s.accountId === accountId)) {
    const sample: Array<{ daysAgo: number; total: number; items: number; method: WorkspaceSaleRecord["paymentMethod"] }> = [
      { daysAgo: 0, total: 14500, items: 3, method: "mpesa" },
      { daysAgo: 0, total: 9000, items: 2, method: "cash" },
      { daysAgo: 1, total: 24500, items: 4, method: "mpesa" },
      { daysAgo: 1, total: 16500, items: 1, method: "tigo" },
      { daysAgo: 2, total: 11200, items: 3, method: "cash" },
      { daysAgo: 3, total: 28000, items: 5, method: "mpesa" },
      { daysAgo: 4, total: 7500, items: 3, method: "halopesa" },
    ];
    for (const row of sample) {
      sales.push({
        id: newId("sale"),
        accountId,
        centreId: primaryCentreId,
        profileId: "seed",
        actorName: "Station Register",
        totalTzs: row.total,
        itemCount: row.items,
        paymentMethod: row.method,
        createdAt: daysAgoIso(row.daysAgo),
      });
    }
    dirty = true;
  }

  // 30-day itemised sales history (line items carry cost + price) so Reports
  // can compute real margin, velocity, days-of-cover and staff performance.
  if (!sales.some((s) => s.accountId === accountId && Array.isArray(s.lines))) {
    const accountBatches = batches.filter((b) => b.accountId === accountId && b.expiryDate >= expiryDaysAhead(0));
    const productPool = Array.from(new Map(accountBatches.map((b) => [b.productId, b])).values());
    const centreIds = Array.from(
      new Set(db.centres.filter((c) => c.accountId === accountId).map((c) => c.id))
    );
    const operators = db.profiles.filter((p) => p.accountId === accountId);
    const methods: WorkspaceSaleRecord["paymentMethod"][] = ["mpesa", "mpesa", "cash", "cash", "tigo", "halopesa", "card"];
    let seed = accountId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) || 7;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    if (productPool.length > 0) {
      for (let day = 29; day >= 0; day--) {
        const weekday = new Date(Date.now() - day * 86400000).getDay();
        const volume = 3 + Math.round(rand() * 4) + (weekday === 6 ? 3 : weekday === 0 ? -1 : 0);
        for (let i = 0; i < volume; i++) {
          const lineCount = 1 + Math.floor(rand() * 3);
          const lines: WorkspaceSaleLine[] = [];
          for (let l = 0; l < lineCount; l++) {
            const p = productPool[Math.floor(rand() * productPool.length)];
            const qty = 1 + Math.floor(rand() * 3);
            lines.push({
              productId: p.productId,
              brandName: p.brandName,
              category: p.category,
              batchId: p.id,
              batchNumber: p.batchNumber,
              qty,
              unitPriceTzs: p.salePriceTzs,
              unitCostTzs: p.costPriceTzs,
            });
          }
          const hour = 8 + Math.floor(rand() * 12);
          const createdAt = new Date(Date.now() - day * 86400000);
          createdAt.setHours(hour, Math.floor(rand() * 60), 0, 0);
          if (createdAt.getTime() > Date.now()) continue;
          const operator = operators.length > 0 ? operators[Math.floor(rand() * operators.length)] : null;
          sales.push({
            id: newId("sale"),
            accountId,
            centreId: operator?.centreId || centreIds[Math.floor(rand() * centreIds.length)] || primaryCentreId,
            profileId: operator?.id || "seed",
            actorName: operator?.displayName || "Station Register",
            totalTzs: lines.reduce((sum, ln) => sum + ln.qty * ln.unitPriceTzs, 0),
            itemCount: lines.reduce((sum, ln) => sum + ln.qty, 0),
            paymentMethod: methods[Math.floor(rand() * methods.length)],
            lines,
            createdAt: createdAt.toISOString(),
          });
        }
      }
      sales.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      dirty = true;
    }
  }

  if (!wholesaleOrders.some((o) => o.accountId === accountId)) {
    wholesaleOrders.push(
      {
        id: newId("ord"),
        accountId,
        centreId: primaryCentreId,
        orderReference: "ORD-2026-104",
        supplierId: "acc-afya",
        supplierName: "Afya Wholesale Ltd",
        productId: "prod-1",
        productName: "Amoxil",
        genericName: "Amoxicillin 500mg",
        category: "Antibiotics",
        quantity: 100,
        unitPriceTzs: 4200,
        totalTzs: 420000,
        escrowStatus: "escrow_held",
        orderStatus: "in_transit",
        createdAt: daysAgoIso(1),
      },
      {
        id: newId("ord"),
        accountId,
        centreId: primaryCentreId,
        orderReference: "ORD-2026-098",
        supplierId: "acc-tibu",
        supplierName: "Tibu Distributors",
        productId: "prod-4",
        productName: "Glucophage",
        genericName: "Metformin 500mg",
        category: "Diabetes",
        quantity: 60,
        unitPriceTzs: 4600,
        totalTzs: 276000,
        escrowStatus: "released",
        orderStatus: "delivered",
        createdAt: daysAgoIso(6),
        deliveredAt: daysAgoIso(4),
      }
    );
    dirty = true;
  }

  // Ensure coordinates on centres
  for (const c of db.centres.filter((ctr) => ctr.accountId === accountId)) {
    if (typeof c.lat !== "number" || typeof c.lng !== "number") {
      const reg = (c.region || "").toLowerCase();
      if (reg.includes("arusha")) {
        c.lat = -3.3869;
        c.lng = 36.683;
      } else if (reg.includes("mwanza")) {
        c.lat = -2.5166;
        c.lng = 32.9017;
      } else if (reg.includes("dodoma")) {
        c.lat = -6.163;
        c.lng = 35.7516;
      } else if (c.name.toLowerCase().includes("mwenge")) {
        c.lat = -6.771;
        c.lng = 39.257;
      } else {
        c.lat = -6.8217;
        c.lng = 39.2834;
      }
      dirty = true;
    }
  }

  const branchMessages = (db.branchMessages ??= []);
  if (!branchMessages.some((m) => m.accountId === accountId && m.centreId === primaryCentreId)) {
    branchMessages.push(
      {
        id: newId("msg"),
        accountId,
        centreId: primaryCentreId,
        senderProfileId: "prof_demo_pharm",
        senderName: "Neema Mbeki (Pharmacist)",
        senderRole: "superintendent_pharmacist",
        body: "Good morning team. Coartem lot CO-TZ-012 has 12 days remaining - placed on the front shelf for FEFO priority.",
        attachment: {
          kind: "batch",
          refId: "CO-TZ-012",
          title: "Coartem · Lot CO-TZ-012",
          subtitle: "42 packs · Expires within 12 days",
        },
        createdAt: daysAgoIso(0.4),
      },
      {
        id: newId("msg"),
        accountId,
        centreId: primaryCentreId,
        senderProfileId: "prof_demo_pharm",
        senderName: "Neema Mbeki (Pharmacist)",
        senderRole: "superintendent_pharmacist",
        body: "Requesting Owner approval to restock Amoxil (20x) from Afya Wholesale Ltd into this branch.",
        attachment: {
          kind: "wholesale_request",
          refId: "req_amox_20",
          catalogId: "sc-1",
          quantity: 20,
          amountTzs: 84000,
          title: "Wholesale Approval: Amoxil 20x",
          subtitle: "Afya Wholesale Ltd · TZS 84,000 via Kasri Escrow",
          approvalStatus: "pending",
        },
        createdAt: daysAgoIso(0.1),
      }
    );
    dirty = true;
  }

  const notifications = (db.notifications ??= []);
  if (!notifications.some((n) => n.accountId === accountId)) {
    notifications.push(
      {
        id: newId("ntf"),
        accountId,
        centreId: primaryCentreId,
        kind: "approval",
        title: "Wholesale approval requested",
        body: "Neema Mbeki requested Amoxil 20x (TZS 84,000) in branch chat.",
        read: false,
        createdAt: daysAgoIso(0.1),
      },
      {
        id: newId("ntf"),
        accountId,
        centreId: primaryCentreId,
        kind: "expiry",
        title: "FEFO priority watch",
        body: "Coartem CO-TZ-012 expires in 12 days.",
        read: false,
        createdAt: daysAgoIso(0.4),
      },
      {
        id: newId("ntf"),
        accountId,
        centreId: primaryCentreId,
        kind: "escrow",
        title: "Order in Kasri escrow",
        body: "ORD-2026-104 (TZS 420,000) is awaiting GRN delivery confirmation.",
        read: true,
        createdAt: daysAgoIso(1),
      }
    );
    dirty = true;
  }

  const expenses = (db.expenses ??= []);
  if (!expenses.some((e) => e.accountId === accountId)) {
    expenses.push(
      {
        id: newId("exp"),
        accountId,
        centreId: primaryCentreId,
        category: "Rent & Premises",
        description: "Monthly dispensary shop lease",
        amountTzs: 280000,
        createdAt: daysAgoIso(18),
      },
      {
        id: newId("exp"),
        accountId,
        centreId: primaryCentreId,
        category: "Utilities & Cold Chain",
        description: "LUKU prepaid electricity + vaccine fridge backup",
        amountTzs: 74000,
        createdAt: daysAgoIso(11),
      },
      {
        id: newId("exp"),
        accountId,
        centreId: primaryCentreId,
        category: "Packaging & Supplies",
        description: "Thermal receipt rolls & dispensing envelopes",
        amountTzs: 28500,
        createdAt: daysAgoIso(5),
      },
      {
        id: newId("exp"),
        accountId,
        centreId: primaryCentreId,
        category: "Compliance & Permits",
        description: "TMDA municipal waste & inspection fee",
        amountTzs: 45000,
        createdAt: daysAgoIso(2),
      }
    );
    dirty = true;
  }

  const paymentSettingsMap = (db.paymentSettings ??= {});
  if (!paymentSettingsMap[accountId]) {
    paymentSettingsMap[accountId] = {
      mpesaPaybill: "5582901",
      tigoLipaNumber: "8104421",
      bankName: "CRDB Bank Tanzania",
      bankAccount: "0152 0482 11900",
      settlementCycle: "daily",
      vatRegistered: true,
    };
    dirty = true;
  }

  const hqMessages = (db.hqMessages ??= []);
  if (!hqMessages.some((m) => m.accountId === accountId)) {
    hqMessages.push(
      {
        id: newId("hqmsg"),
        accountId,
        title: "Welcome to Cervos Multi-Branch Command",
        swTitle: "Karibu Kwenye Mfumo wa Matawi wa Cervos",
        body: "Review pending operator requests, branch P&L comparisons, and push Kasri compliance permits from this HQ trail.",
        swBody: "Kagua maombi ya wafanyakazi wapya, linganisha faida za matawi, na uthibitishe vibali vya Kasri hapa.",
        severity: "info",
        ctaLabel: "Open Reports",
        ctaTarget: "reports",
        senderName: "Cervos HQ Ops",
        createdAt: daysAgoIso(1),
      },
      {
        id: newId("hqmsg"),
        accountId,
        title: "Quarter-End FEFO & TMDA Checkup Reminder",
        swTitle: "Ukaguzi wa FEFO na Usalama wa Dawa (TMDA)",
        body: "Inspect lots expiring within 30 days across all branches and download your clean bilingual PDF audit statement.",
        swBody: "Kagua dawa zinazokaribia kuisha ndani ya siku 30 kwenye matawi yote na upakue ripoti safi ya PDF.",
        severity: "action",
        ctaLabel: "Open Reports",
        ctaTarget: "reports",
        senderName: "Cervos Compliance Desk",
        createdAt: daysAgoIso(0),
      }
    );
    dirty = true;
  }

  const savedCustomers = (db.savedCustomers ??= []);
  if (!savedCustomers.some((c) => c.accountId === accountId)) {
    savedCustomers.push(
      {
        id: newId("cust"),
        accountId,
        centreId: primaryCentreId,
        customerName: "Bi. Fatuma Hassan",
        phone: "+255 713 442 890",
        note: "Monthly diabetes & analgesic refill",
        items: [
          { productId: "prod-4", brandName: "Glucophage", qty: 1 },
          { productId: "prod-2", brandName: "Panadol", qty: 1 },
        ],
        createdAt: daysAgoIso(12),
      },
      {
        id: newId("cust"),
        accountId,
        centreId: primaryCentreId,
        customerName: "Mzee Ramadhani K.",
        phone: "+255 754 118 204",
        note: "Respiratory & ORS clinic kit",
        items: [
          { productId: "prod-10", brandName: "Ventolin", qty: 1 },
          { productId: "prod-6", brandName: "ORASEL", qty: 2 },
        ],
        createdAt: daysAgoIso(4),
      }
    );
    dirty = true;
  }

  const joinRequests = (db.joinRequests ??= []);
  if (accountId === "acc_demo_kariakoo" && !joinRequests.some((r) => r.targetAccountId === accountId)) {
    joinRequests.push({
      id: "jreq_demo_salma",
      targetAccountId: accountId,
      targetOrgName: "Uzuri Care Pharmacy",
      requesterFullName: "Salma Hassan",
      requesterUsername: "salma.kariakoo",
      requesterEmail: "salma@pharmacy.co.tz",
      requesterSex: "female",
      requesterPasswordHash: hashSecret("SalmaDemo2026!").hash,
      requesterLang: "EN",
      requesterRegion: "Dar es Salaam",
      requesterGeo: { lat: -6.8195, lng: 39.279, source: "gps" },
      requestedRoleLabel: "Pharmacist",
      note: "Morning dispensary shift applicant at Kariakoo branch.",
      status: "pending",
      createdAt: daysAgoIso(0.2),
    });
    dirty = true;
  }

  return dirty;
}

export const HQ_UPDATES_SEED: HqUpdateItem[] = [
  {
    id: "hq-1",
    tag: "RELEASE",
    title: "Reports Intelligence & FEFO Expiry Loss Forecasting",
    swTitle: "Ripoti Kuu za Akili & Utabiri wa Kuisha Muda (FEFO)",
    summary: "Track 7-day sales forecasts, EWMA SKU cover days, ABC Pareto margin classes, and projected TZS expiry write-offs per branch.",
    swSummary: "Fuatilia utabiri wa mauzo wa siku 7, faida za ABC, na ulinzi wa dawa zinazokaribia kuisha muda.",
    ctaLabel: "Open Reports",
    ctaTarget: "reports",
    publishedAt: "2026-11-16T09:00:00Z",
  },
  {
    id: "hq-2",
    tag: "HARDWARE",
    title: "Offline Desktop & Counter Tablet Sync v2.4 Ready",
    swTitle: "App ya Kompyuta & Kompyuta Kibao Bila Mtandao v2.4",
    summary: "Keep dispensing even when fiber drops. Local SQLite syncs receipts, FEFO stock, and GS1 barcode intake automatically on reconnect.",
    swSummary: "Endelea kuuza hata mtandao ukikatika. Risiti na hifadhi husawazishwa punde mtandao ukirejea.",
    ctaLabel: "Get Desktop / PWA App",
    ctaTarget: "download",
    publishedAt: "2026-11-14T11:00:00Z",
  },
  {
    id: "hq-3",
    tag: "GROWTH",
    title: "Kasri Escrow Wholesale & Chain Growth Multi-Branch",
    swTitle: "Kasri Escrow ya Jumla & Mpango wa Matawi Mengi",
    summary: "Source verified medicines from vetted wholesalers with escrow buyer protection and unlock unified analytics across up to 10 branches.",
    swSummary: "Agiza dawa kwa ulinzi wa escrow ya Kasri na simamia hadi matawi 10 kwenye kituo kimoja.",
    ctaLabel: "Explore Plans & Billing",
    ctaTarget: "billing",
    publishedAt: "2026-11-12T08:00:00Z",
  },
];

export function getHqUpdates(db: WorkspaceDbSnapshot): HqUpdateItem[] {
  if (!Array.isArray(db.hqUpdates) || db.hqUpdates.length === 0) {
    db.hqUpdates = HQ_UPDATES_SEED.map((item) => ({ ...item }));
  }
  return db.hqUpdates;
}

export function publicJoinRequestSummary(req: WorkspaceJoinRequest) {
  return {
    id: req.id,
    targetAccountId: req.targetAccountId,
    targetOrgName: req.targetOrgName,
    requesterFullName: req.requesterFullName,
    requesterUsername: req.requesterUsername,
    requesterEmail: req.requesterEmail,
    requesterSex: req.requesterSex,
    requesterLang: req.requesterLang,
    requesterRegion: req.requesterRegion,
    requesterGeo: req.requesterGeo,
    requestedRoleLabel: req.requestedRoleLabel,
    note: req.note,
    status: req.status,
    allocatedCentreId: req.allocatedCentreId,
    allocatedCentreName: req.allocatedCentreName,
    allocatedRole: req.allocatedRole,
    allocatedProfileId: req.allocatedProfileId,
    allocatedPinPreview: req.allocatedPinPreview,
    declineReason: req.declineReason,
    createdAt: req.createdAt,
    reviewedAt: req.reviewedAt,
  };
}

export function searchPublicOrganizations(
  db: WorkspaceDbSnapshot,
  opts: { q?: string; region?: string; roleType?: string; preferredRegion?: string } = {}
) {
  const q = (opts.q ?? "").trim().toLowerCase();
  const regionFilter = (opts.region ?? "").trim().toLowerCase();
  const roleFilter = (opts.roleType ?? "").trim().toLowerCase();
  const pref = (opts.preferredRegion ?? "").trim().toLowerCase();

  return db.accounts
    .filter((a) => a.onboardingDone)
    .map((a) => {
      const orgCentres = db.centres.filter((c) => c.accountId === a.id);
      return {
        id: a.id,
        username: a.username,
        orgName: a.orgName,
        roleType: a.roleType,
        region: a.region,
        networkUnlocked: a.networkUnlocked,
        centres: orgCentres.map((c) => ({ id: c.id, name: c.name, region: c.region })),
      };
    })
    .filter((org) => {
      if (roleFilter && roleFilter !== "all" && org.roleType !== roleFilter) return false;
      if (regionFilter && regionFilter !== "all") {
        const regMatch =
          org.region.toLowerCase().includes(regionFilter) ||
          org.centres.some((c) => c.region.toLowerCase().includes(regionFilter));
        if (!regMatch) return false;
      }
      if (!q) return true;
      const cleanQ = q.replace(/^@+/, "");
      return (
        org.orgName.toLowerCase().includes(cleanQ) ||
        org.region.toLowerCase().includes(cleanQ) ||
        (org.username && org.username.toLowerCase().includes(cleanQ)) ||
        org.centres.some((c) => c.name.toLowerCase().includes(cleanQ) || c.region.toLowerCase().includes(cleanQ))
      );
    })
    .sort((a, b) => {
      if (!pref) return a.orgName.localeCompare(b.orgName);
      const aMatch = a.region.toLowerCase().includes(pref) ? 0 : 1;
      const bMatch = b.region.toLowerCase().includes(pref) ? 0 : 1;
      return aMatch - bMatch || a.orgName.localeCompare(b.orgName);
    });
}

export function isAccountAccessLocked(acc: WorkspaceAccount): {
  locked: boolean;
  source: "hq" | "billing" | null;
  reason: string;
} {
  if (!acc) return { locked: false, source: null, reason: "" };
  if (acc.hqLock?.locked) {
    return {
      locked: true,
      source: "hq",
      reason: acc.hqLock.reason || "Workspace paused by Cervos HQ compliance override.",
    };
  }
  if (!acc.subscriptionActive && acc.billingOverdue) {
    return {
      locked: true,
      source: "billing",
      reason: "Subscription invoice is past due. Activate or renew a Cervos plan to unlock counter operations.",
    };
  }
  if (!acc.subscriptionActive && acc.trialEndsAt) {
    const endMs = Date.parse(acc.trialEndsAt);
    if (Number.isFinite(endMs) && Date.now() > endMs) {
      return {
        locked: true,
        source: "billing",
        reason: "Your trial window ended. Choose a subscription plan to continue operating.",
      };
    }
  }
  return { locked: false, source: null, reason: "" };
}

export function pushHqMessage(
  db: WorkspaceDbSnapshot,
  msg: Omit<HqCustomMessage, "id" | "createdAt">
): HqCustomMessage {
  db.hqMessages ??= [];
  db.notifications ??= [];
  const item: HqCustomMessage = {
    ...msg,
    id: newId("hqmsg"),
    createdAt: new Date().toISOString(),
  };
  db.hqMessages.unshift(item);
  db.notifications.unshift({
    id: newId("ntf"),
    accountId: msg.accountId,
    centreId: "",
    kind: msg.severity === "critical" ? "approval" : "system",
    title: `HQ: ${msg.title}`,
    body: msg.body,
    read: false,
    createdAt: item.createdAt,
  });
  return item;
}

export function publicAccountSummary(acc: WorkspaceAccount) {
  const lock = isAccountAccessLocked(acc);
  return {
    id: acc.id,
    username: acc.username,
    email: acc.email,
    fullName: acc.fullName,
    roleType: acc.roleType,
    customRoleLabel: acc.customRoleLabel,
    orgName: acc.orgName,
    region: acc.region,
    lang: acc.lang,
    securityQuestion: acc.securityQuestion,
    requireSecurityEveryTime: acc.requireSecurityEveryTime,
    onboardingDone: acc.onboardingDone,
    verificationStatus: acc.verificationStatus,
    networkUnlocked: acc.networkUnlocked,
    subscriptionActive: acc.subscriptionActive,
    subscriptionPlan: acc.subscriptionPlan,
    billingOverdue: Boolean(acc.billingOverdue),
    trialEndsAt: acc.trialEndsAt,
    hqLock: acc.hqLock,
    accessLock: lock,
    certificates: acc.certificates,
    customization: acc.customization ?? {
      brandAccent: "#1039B9",
      fontScale: "standard",
      layoutType: "balanced",
      themePref: "light",
    },
  };
}

export function publicProfileSummary(prof: WorkspaceProfile) {
  return {
    id: prof.id,
    centreId: prof.centreId,
    username: prof.username,
    displayName: prof.displayName,
    role: prof.role,
    isMasterAdmin: prof.isMasterAdmin,
    capabilities: clampProfileCapabilities(prof.role, prof.capabilities, prof.isMasterAdmin),
    profilePrefs: prof.profilePrefs,
  };
}
