"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import Link from "next/link";
import { COMMERCIAL_PLAN_CATALOG, formatTzs, parseGs1Barcode } from "@cervos/core";
import { IconCheck, IconLock, IconShield } from "@/components/LandingIcons";
import StationSpotlightMedia from "@/components/dashboards/StationSpotlightMedia";
import ReportsIntelligenceView, { type ExtendedReportView } from "@/components/dashboards/ReportsIntelligenceView";

const CervosMap = dynamic(() => import("@/components/CervosMap"), { ssr: false });
import {
  clampProfileCapabilities,
  PERMISSION_METADATA,
  ROLE_PERMISSION_RULES,
  type ProfileCapabilities,
  type WorkspaceProfileRole,
} from "@/lib/workspace/permissions";
import {
  branchComparison,
  inventoryValuation,
  profitAndLoss,
  type ReportView,
} from "@/lib/workspace/intelligence";
import { arrayToCSV, downloadCSV, exportCleanPdfReport } from "@/lib/export";
import { combineSearchQueries, matchesSearch } from "@/lib/search";
import WebpPhotoInput from "@/components/WebpPhotoInput";
import WorkspaceTour from "@/components/WorkspaceTour";
import { StationChecklist } from "@/components/onboarding";
import { loadHardwareConfig, type HardwareConfigState } from "@/lib/hardware/devices";
import { playAppSound } from "@/lib/sounds";

const DEFAULT_DRUG_CATEGORIES = [
  "Essential",
  "Antibiotics",
  "Antimalarials",
  "Analgesics & Fever",
  "ORS & Electrolytes",
  "Respiratory & Inhalers",
  "Diabetes & Chronic",
  "Cardiovascular",
  "Vitamins & Supplements",
  "Dermatology & Topical",
  "Gastrointestinal",
  "Maternal & Pediatric",
  "Diagnostics & Devices",
] as const;

export type PharmacyTab =
  | "overview"
  | "operations"
  | "receipts"
  | "inventory"
  | "network"
  | "reports"
  | "billing"
  | "team";

export interface PharmacyDashboardAuditEntry {
  id: string;
  actor: string;
  category: string;
  action: string;
  createdAt: string;
}

export interface DashboardBatch {
  id: string;
  centreId?: string;
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
}

export interface DashboardSale {
  id: string;
  centreId?: string;
  profileId?: string;
  actorName: string;
  receiptNumber?: string;
  customerName?: string;
  customerPhone?: string;
  totalTzs: number;
  itemCount: number;
  paymentMethod: "cash" | "mpesa" | "tigo" | "airtel" | "halopesa" | "card" | "bank";
  prescriptionRef?: string;
  lines?: Array<{
    productId: string;
    brandName: string;
    category: string;
    batchId?: string;
    batchNumber?: string;
    qty: number;
    unitPriceTzs: number;
    unitCostTzs: number;
  }>;
  createdAt: string;
}

export interface DashboardHqMessage {
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

export interface DashboardSavedCustomer {
  id: string;
  centreId: string;
  customerName: string;
  phone?: string;
  note?: string;
  items: Array<{ productId: string; brandName: string; qty: number }>;
  createdAt: string;
}

export interface DashboardShiftLog {
  id: string;
  centreId: string;
  profileId: string;
  staffName: string;
  role: string;
  clockInAt: string;
  clockOutAt?: string;
  durationMinutes?: number;
}

export interface NotificationEnvInfo {
  hqEndpointConfigured: boolean;
  exceptionWebhookConfigured: boolean;
  exceptionEmailConfigured: boolean;
  exceptionEmailMasked: string | null;
  trialGraceDays: number;
  mode: "production" | "staging" | "mock";
}

export interface DashboardExpenseRecord {
  id: string;
  centreId: string;
  category: string;
  description: string;
  amountTzs: number;
  createdAt: string;
}

export interface DashboardPaymentSettings {
  mpesaPaybill: string;
  tigoLipaNumber: string;
  bankName: string;
  bankAccount: string;
  settlementCycle: "daily" | "instant" | "weekly";
  vatRegistered: boolean;
}

export interface DashboardJoinRequest {
  id: string;
  targetOrgName: string;
  requesterFullName: string;
  requesterUsername: string;
  requesterEmail: string;
  requesterSex: string;
  requesterRegion: string;
  requestedRoleLabel?: string;
  note?: string;
  status: "pending" | "approved" | "declined" | "accepted";
  createdAt: string;
}

export interface DashboardHqUpdate {
  id: string;
  tag: string;
  title: string;
  swTitle: string;
  summary: string;
  swSummary: string;
  ctaLabel: string;
  ctaTarget: string;
  publishedAt: string;
}

export interface DashboardWholesaleOrder {
  id: string;
  orderReference: string;
  supplierName: string;
  productId: string;
  productName: string;
  genericName: string;
  quantity: number;
  unitPriceTzs: number;
  transportFeeTzs?: number;
  routeLabel?: string;
  totalTzs: number;
  escrowStatus: "escrow_held" | "released" | "cancelled";
  orderStatus: "pending" | "in_transit" | "delivered";
  createdAt: string;
}

export interface DashboardCatalogItem {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierCity?: string;
  supplierLat?: number;
  supplierLng?: number;
  routeLabel?: string;
  transportFeeTzs?: number;
  productId: string;
  productName: string;
  genericName: string;
  category: string;
  packSize: string;
  unitPriceTzs: number;
  minOrderQty: number;
  stockAvailable: number;
  leadTimeDays: number;
  requiresPrescription: boolean;
  verified: boolean;
}

export interface DashboardStaffProfile {
  id: string;
  centreId: string;
  username?: string;
  displayName: string;
  role: string;
  isMasterAdmin?: boolean;
  capabilities?: ProfileCapabilities;
}

export interface PharmacyDashboardProps {
  account: {
    id: string;
    email: string;
    fullName: string;
    roleType: string;
    orgName: string;
    region: string;
    lang: "EN" | "SW";
    verificationStatus: "skipped" | "verified";
    networkUnlocked: boolean;
    subscriptionActive: boolean;
    subscriptionPlan: string;
    subscriptionExpiresAt?: string;
    subscriptionDaysLeft?: number | null;
    subscriptionInGraceDay?: boolean;
    trialEndsAt?: string;
    billingOverdue?: boolean;
    customCategories?: string[];
    customization?: {
      brandLogoUrl?: string;
      brandAccent?: string;
      fontScale?: "compact" | "standard" | "large";
      layoutType?: "balanced" | "focus" | "executive";
    };
  };
  activeCentre:
  | {
      id: string;
      name: string;
      region: string;
      address: string;
      lat?: number;
      lng?: number;
      isPrimary?: boolean;
      status?: "active" | "paused" | "archived";
      excludedFromRollup?: boolean;
    }
  | undefined;
  centres: Array<{
    id: string;
    name: string;
    region: string;
    address: string;
    lat?: number;
    lng?: number;
    isPrimary?: boolean;
    status?: "active" | "paused" | "archived";
    excludedFromRollup?: boolean;
  }>;
  profiles: DashboardStaffProfile[];
  filteredLogs: PharmacyDashboardAuditEntry[];
  batches: DashboardBatch[];
  sales: DashboardSale[];
  wholesaleOrders: DashboardWholesaleOrder[];
  supplierCatalog: DashboardCatalogItem[];
  expenses?: DashboardExpenseRecord[];
  paymentSettings?: DashboardPaymentSettings | null;
  joinRequests?: DashboardJoinRequest[];
  hqUpdates?: DashboardHqUpdate[];
  hqMessages?: DashboardHqMessage[];
  savedCustomers?: DashboardSavedCustomer[];
  shiftLogs?: DashboardShiftLog[];
  orgBranchComparison?: ReturnType<typeof branchComparison>;
  notificationEnv?: NotificationEnvInfo;
  stockAlerts: { nearExpiryCount: number; expiredCount: number; lowStockCount: number };
  tab: PharmacyTab;
  setTab: (tab: PharmacyTab) => void;
  orgScope?: "all" | "branch";
  onSetOrgScope?: (scope: "all" | "branch") => void;
  activeProfileId?: string;
  activeProfileName?: string;
  activeProfileRole?: string;
  resolvedCapabilities?: ProfileCapabilities;
  isDark: boolean;
  canManageAdmin: boolean;
  canManageStock: boolean;
  searchQuery: string;
  onRefreshState: () => Promise<void>;
  onPaySubscription: (planName?: string) => Promise<void>;
  onOpenChat: () => void;
  onSwitchCentre?: (centreId: string) => Promise<void>;
}

export default function PharmacyDashboard({
  account,
  activeCentre,
  centres,
  profiles,
  filteredLogs,
  batches,
  sales,
  wholesaleOrders,
  supplierCatalog,
  expenses = [],
  paymentSettings = null,
  joinRequests = [],
  hqUpdates = [],
  hqMessages = [],
  savedCustomers = [],
  shiftLogs = [],
  orgBranchComparison = [],
  notificationEnv,
  stockAlerts,
  tab,
  setTab,
  orgScope = "branch",
  onSetOrgScope,
  activeProfileId = "",
  activeProfileName = "",
  activeProfileRole = "pharmacy_owner",
  resolvedCapabilities,
  isDark,
  canManageAdmin,
  canManageStock,
  searchQuery,
  onRefreshState,
  onPaySubscription,
  onOpenChat,
  onSwitchCentre,
}: PharmacyDashboardProps) {
  const isSw = account.lang === "SW";
  const accent = account.customization?.brandAccent || "#1039B9";
  const layoutType = account.customization?.layoutType || "balanced";
  const caps = useMemo(
    () =>
      resolvedCapabilities ??
      clampProfileCapabilities(
        (activeProfileRole as WorkspaceProfileRole) || "pharmacy_owner",
        undefined,
        canManageAdmin
      ),
    [resolvedCapabilities, activeProfileRole, canManageAdmin]
  );

  // Hardware & Audio state + First-launch Guided Tour + Auto Clock-Out guard
  const [hwConfig, setHwConfig] = useState<HardwareConfigState>(() => loadHardwareConfig());
  const [tourOpen, setTourOpen] = useState(false);
  const [shiftPromptDismissed, setShiftPromptDismissed] = useState(false);
  const [autoClockOutNotice, setAutoClockOutNotice] = useState<string | null>(null);
  const autoClockCheckedRef = useRef(false);

  useEffect(() => {
    setHwConfig(loadHardwareConfig());
  }, [tab]);

  useEffect(() => {
    if (typeof window === "undefined" || !activeProfileId) return;
    const key = `cervos-tour-done-${activeProfileId}`;
    try {
      if (!window.localStorage.getItem(key)) {
        const timer = setTimeout(() => setTourOpen(true), 650);
        return () => clearTimeout(timer);
      }
    } catch {
      // Ignore storage error
    }
  }, [activeProfileId]);

  // Reports subpage navigation
  const [reportView, setReportView] = useState<ExtendedReportView>("brief");
  const openReport = (sub: ExtendedReportView) => {
    setReportView(sub);
    setTab("reports");
  };

  // FEFO Counter POS + Search + QR / Barcode Scanner state
  const [cart, setCart] = useState<Record<string, number>>({});
  const [posSearch, setPosSearch] = useState("");
  const [scanCode, setScanCode] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"mpesa" | "cash" | "tigo" | "airtel" | "halopesa" | "card" | "bank">("mpesa");
  const [prescriptionRef, setPrescriptionRef] = useState("");
  const [posMsg, setPosMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [posBusy, setPosBusy] = useState(false);

  // Finance & Billing state
  const [expCategory, setExpCategory] = useState("Packaging & Supplies");
  const [expDesc, setExpDesc] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [billingNotice, setBillingNotice] = useState<string | null>(null);
  const [expenseBusy, setExpenseBusy] = useState(false);
  const [settlementBusy, setSettlementBusy] = useState(false);
  const [mpesaPaybill, setMpesaPaybill] = useState(paymentSettings?.mpesaPaybill ?? "");
  const [tigoLipaNumber, setTigoLipaNumber] = useState(paymentSettings?.tigoLipaNumber ?? "");
  const [bankName, setBankName] = useState(paymentSettings?.bankName ?? "");
  const [bankAccount, setBankAccount] = useState(paymentSettings?.bankAccount ?? "");
  const [settlementCycle, setSettlementCycle] = useState<"daily" | "instant" | "weekly">(
    paymentSettings?.settlementCycle || "daily"
  );
  const [vatRegistered, setVatRegistered] = useState(paymentSettings?.vatRegistered ?? false);
  const [invBusyKey, setInvBusyKey] = useState<string | null>(null);
  const invBusy = invBusyKey !== null;
  const [opEditBusy, setOpEditBusy] = useState(false);
  const [reconcileBusy, setReconcileBusy] = useState(false);
  const [customCatMode, setCustomCatMode] = useState(false);
  const [editCustomCatMode, setEditCustomCatMode] = useState(false);

  useEffect(() => {
    if (!paymentSettings) {
      setMpesaPaybill("");
      setTigoLipaNumber("");
      setBankName("");
      setBankAccount("");
      setSettlementCycle("daily");
      setVatRegistered(false);
      return;
    }
    setMpesaPaybill(paymentSettings.mpesaPaybill ?? "");
    setTigoLipaNumber(paymentSettings.tigoLipaNumber ?? "");
    setBankName(paymentSettings.bankName ?? "");
    setBankAccount(paymentSettings.bankAccount ?? "");
    setSettlementCycle(paymentSettings.settlementCycle);
    setVatRegistered(paymentSettings.vatRegistered);
  }, [paymentSettings]);

  const drugCategoryOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    const pushCat = (raw?: string) => {
      const clean = (raw || "").trim();
      if (!clean) return;
      const lower = clean.toLowerCase();
      if (seen.has(lower)) return;
      seen.add(lower);
      out.push(clean);
    };
    DEFAULT_DRUG_CATEGORIES.forEach(pushCat);
    (account.customCategories ?? []).forEach(pushCat);
    batches.forEach((b) => pushCat(b.category));
    return out;
  }, [account.customCategories, batches]);

  // Shift Reconciliation state
  const [openingCash, setOpeningCash] = useState("50000");
  const [declaredCash, setDeclaredCash] = useState("");
  const [shiftResultMsg, setShiftResultMsg] = useState<string | null>(null);

  // Wholesale & GS1 GRN state
  const [gs1Input, setGs1Input] = useState("");
  const [orderNotice, setOrderNotice] = useState<{ escalated?: boolean; text: string } | null>(null);

  // Remote Inventory Add Batch state
  const [newBrand, setNewBrand] = useState("");
  const [newQty, setNewQty] = useState("40");
  const [newPrice, setNewPrice] = useState("4500");
  const [newExpiry, setNewExpiry] = useState(() => new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10));
  const [newLotGs1, setNewLotGs1] = useState("");
  const [invNotice, setInvNotice] = useState<string | null>(null);

  // Remote Team Editor state (Owners)
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editRole, setEditRole] = useState("superintendent_pharmacist");
  const [editCentreId, setEditCentreId] = useState("");
  const [editPin, setEditPin] = useState("");
  const [teamNotice, setTeamNotice] = useState<string | null>(null);
  const [editCaps, setEditCaps] = useState<ProfileCapabilities>(() =>
    clampProfileCapabilities("superintendent_pharmacist")
  );
  const [allocCaps, setAllocCaps] = useState<ProfileCapabilities>(() =>
    clampProfileCapabilities("pos_cashier")
  );

  // Dedicated Inventory Search, FEFO Filters & Individual Product Focus Card
  const [invSearch, setInvSearch] = useState("");
  const [invFilter, setInvFilter] = useState<"all" | "expiring" | "low" | "expired" | "quarantined">("all");
  const [focusedBatch, setFocusedBatch] = useState<DashboardBatch | null>(null);
  const [editBatchBrand, setEditBatchBrand] = useState("");
  const [editBatchGeneric, setEditBatchGeneric] = useState("");
  const [editBatchCategory, setEditBatchCategory] = useState("");
  const [editBatchNumber, setEditBatchNumber] = useState("");
  const [editBatchQty, setEditBatchQty] = useState("");
  const [editBatchCost, setEditBatchCost] = useState("");
  const [editBatchPrice, setEditBatchPrice] = useState("");
  const [editBatchExpiry, setEditBatchExpiry] = useState("");
  const [editBatchDateEntered, setEditBatchDateEntered] = useState("");
  const [editBatchThreshold, setEditBatchThreshold] = useState("25");
  const [editBatchImageUrl, setEditBatchImageUrl] = useState("");
  const [editBatchRx, setEditBatchRx] = useState(false);

  // Add Stock rich fields
  const [newGeneric, setNewGeneric] = useState("");
  const [newCategory, setNewCategory] = useState("Essential");
  const [newCostPrice, setNewCostPrice] = useState("3200");
  const [newThreshold, setNewThreshold] = useState("25");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newDateEntered, setNewDateEntered] = useState(() => new Date().toISOString().slice(0, 10));
  const [newRequiresRx, setNewRequiresRx] = useState(false);

  const restockPresets = useMemo(() => {
    const qBrand = newBrand.trim().toLowerCase();
    if (!qBrand) return [];
    const byBrand = new Map<string, DashboardBatch>();
    for (const b of batches) {
      const key = b.brandName.trim().toLowerCase();
      if (!key) continue;
      const existing = byBrand.get(key);
      if (!existing || (b.imageUrl && !existing.imageUrl)) {
        byBrand.set(key, b);
      }
    }
    const list = Array.from(byBrand.values());
    if (list.some((b) => b.brandName.trim().toLowerCase() === qBrand)) return [];
    return list
      .filter(
        (b) =>
          b.brandName.toLowerCase().includes(qBrand) ||
          b.genericName.toLowerCase().includes(qBrand) ||
          b.category.toLowerCase().includes(qBrand)
      )
      .slice(0, 6);
  }, [batches, newBrand]);

  // POS Customer, Split Checkout Preview & Receipt Animation
  const [customerSearch, setCustomerSearch] = useState("");
  const [posCustomerName, setPosCustomerName] = useState("");
  const [posCustomerPhone, setPosCustomerPhone] = useState("");
  const [saveAsPreset, setSaveAsPreset] = useState(false);
  const [checkoutPreviewOpen, setCheckoutPreviewOpen] = useState(false);
  const [printingAnim, setPrintingAnim] = useState(false);

  useEffect(() => {
    if (!checkoutPreviewOpen || typeof document === "undefined") return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCheckoutPreviewOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [checkoutPreviewOpen]);
  const [latestPrintedReceipt, setLatestPrintedReceipt] = useState<DashboardSale | null>(null);

  // Dedicated Receipts Vault search & focus card
  const [receiptSearch, setReceiptSearch] = useState("");
  const [focusedReceipt, setFocusedReceipt] = useState<DashboardSale | null>(null);

  // Shift clock & Supplier Map state
  const [shiftBusy, setShiftBusy] = useState(false);
  const [selectedMapSupplierId, setSelectedMapSupplierId] = useState<string>("all");
  const [networkNotifyRequested, setNetworkNotifyRequested] = useState(false);

  // Owner General Hub: Add Branch Modal + Trail Focus + Live Map Coordinates
  const [addBranchOpen, setAddBranchOpen] = useState(false);
  const [branchNameInput, setBranchNameInput] = useState("");
  const [branchRegionInput, setBranchRegionInput] = useState(account.region || "Dar es Salaam");
  const [branchAddrInput, setBranchAddrInput] = useState("");
  const [branchPhoneInput, setBranchPhoneInput] = useState("");
  const [branchLat, setBranchLat] = useState<number>(-6.816);
  const [branchLng, setBranchLng] = useState<number>(39.2803);
  const [branchAssignIds, setBranchAssignIds] = useState<string[]>([]);
  const [branchBusy, setBranchBusy] = useState(false);
  const [hqReplyDraft, setHqReplyDraft] = useState("");
  const [hqChatNotice, setHqChatNotice] = useState<string | null>(null);

  const [selectedTrailItem, setSelectedTrailItem] = useState<
    | { kind: "join"; req: DashboardJoinRequest }
    | { kind: "hq"; msg: DashboardHqMessage }
    | { kind: "escrow"; order: DashboardWholesaleOrder }
    | { kind: "audit"; log: PharmacyDashboardAuditEntry }
    | null
  >(null);
  const [hoveredWeekIdx, setHoveredWeekIdx] = useState<number | null>(null);
  const [hoveredRiskNode, setHoveredRiskNode] = useState<number | null>(null);
  const [inspectedListing, setInspectedListing] = useState<{
    title: string;
    badge: string;
    explanation: string;
    fields: Array<{ label: string; value: string }>;
    ctaLabel?: string;
    onCta?: () => void;
  } | null>(null);

  const todayIso = new Date().toISOString().slice(0, 10);

  const productsSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        productId: string;
        brandName: string;
        genericName: string;
        category: string;
        salePriceTzs: number;
        validQty: number;
        expiredQty: number;
        earliestExpiry: string | null;
        earliestBatch: string | null;
        requiresPrescription: boolean;
      }
    >();

    for (const b of batches) {
      const existing = map.get(b.productId) ?? {
        productId: b.productId,
        brandName: b.brandName,
        genericName: b.genericName,
        category: b.category,
        salePriceTzs: b.salePriceTzs,
        validQty: 0,
        expiredQty: 0,
        earliestExpiry: null,
        earliestBatch: null,
        requiresPrescription: b.requiresPrescription,
      };
      if (b.expiryDate < todayIso) {
        existing.expiredQty += b.quantity;
      } else if (!b.quarantined && b.quantity > 0) {
        existing.validQty += b.quantity;
        if (!existing.earliestExpiry || b.expiryDate < existing.earliestExpiry) {
          existing.earliestExpiry = b.expiryDate;
          existing.earliestBatch = b.batchNumber;
        }
      }
      map.set(b.productId, existing);
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.earliestExpiry || "9999").localeCompare(b.earliestExpiry || "9999")
    );
  }, [batches, todayIso]);

  const grossSalesTzs = useMemo(() => sales.reduce((sum, s) => sum + s.totalTzs, 0), [sales]);
  const mobileSalesTzs = useMemo(
    () => sales.filter((s) => s.paymentMethod !== "cash" && s.paymentMethod !== "card").reduce((sum, s) => sum + s.totalTzs, 0),
    [sales]
  );
  const cashSalesTzs = useMemo(
    () => sales.filter((s) => s.paymentMethod === "cash").reduce((sum, s) => sum + s.totalTzs, 0),
    [sales]
  );
  const mobileSharePct = grossSalesTzs > 0 ? Math.round((mobileSalesTzs / grossSalesTzs) * 100) : 68;
  const cashSharePct = Math.max(0, 100 - mobileSharePct);

  const escrowHeldTzs = useMemo(
    () => wholesaleOrders.filter((o) => o.escrowStatus === "escrow_held").reduce((sum, o) => sum + o.totalTzs, 0),
    [wholesaleOrders]
  );

  const weekActivity = useMemo(() => {
    const labels = isSw
      ? ["J3", "J4", "J5", "Alh", "Iju", "Jms", "J2"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    const revs = [0, 0, 0, 0, 0, 0, 0];
    const txs = [0, 0, 0, 0, 0, 0, 0];
    for (const s of sales) {
      const d = new Date(s.createdAt).getDay();
      const idx = d === 0 ? 6 : d - 1;
      counts[idx] += s.itemCount || 1;
      revs[idx] += s.totalTzs || 0;
      txs[idx] += 1;
    }
    const maxCount = Math.max(1, ...counts);
    const peakIdx = counts.indexOf(maxCount);
    return labels.map((day, idx) => ({
      day,
      count: counts[idx],
      revenueTzs: revs[idx],
      txCount: txs[idx],
      heightPct: Math.max(20, Math.round((counts[idx] / maxCount) * 92)),
      highlight: idx === peakIdx,
      badge: `${counts[idx]}u`,
    }));
  }, [sales, isSw]);

  const categoryMix = useMemo(() => {
    const valid = batches.filter((b) => !b.quarantined && b.quantity > 0 && b.expiryDate >= todayIso);
    const total = valid.reduce((s, b) => s + b.quantity, 0) || 1;
    const rxUnits = valid.filter((b) => b.requiresPrescription).reduce((s, b) => s + b.quantity, 0);
    const otcUnits = valid.filter((b) => !b.requiresPrescription && b.category !== "Rehydration").reduce((s, b) => s + b.quantity, 0);
    const rehydUnits = Math.max(0, total - rxUnits - otcUnits);
    return {
      rxPct: Math.round((rxUnits / total) * 100),
      otcPct: Math.round((otcUnits / total) * 100),
      carePct: Math.max(0, 100 - Math.round((rxUnits / total) * 100) - Math.round((otcUnits / total) * 100)),
      rxUnits,
      otcUnits,
      rehydUnits,
    };
  }, [batches, todayIso]);

  const earliestNearExpiry = useMemo(() => {
    const cutoff30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    return batches
      .filter((b) => !b.quarantined && b.quantity > 0 && b.expiryDate >= todayIso && b.expiryDate <= cutoff30)
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))[0];
  }, [batches, todayIso]);

  const parsedGs1Preview = useMemo(() => (gs1Input.trim() ? parseGs1Barcode(gs1Input) : null), [gs1Input]);

  const cartEntries = Object.entries(cart).filter(([, qty]) => qty > 0);
  const cartTotalTzs = cartEntries.reduce((sum, [pid, qty]) => {
    const prod = productsSummary.find((p) => p.productId === pid);
    return sum + (prod ? prod.salePriceTzs * qty : 0);
  }, 0);
  const cartRequiresRx = cartEntries.some(([pid]) => productsSummary.find((p) => p.productId === pid)?.requiresPrescription);

  const adjustCart = (productId: string, delta: number) => {
    setPosMsg(null);
    if (delta > 0) playAppSound("cart-add");
    setCart((prev) => ({ ...prev, [productId]: Math.max(0, (prev[productId] || 0) + delta) }));
  };

  const printSaleReceipt = (rec: DashboardSale) => {
    const linesList = rec.lines ?? [];
    exportCleanPdfReport({
      orgName: account.orgName,
      logoDataUrl: account.customization?.brandLogoUrl,
      branchName: activeCentre?.name || account.region,
      title: isSw
        ? `Risiti ${rec.receiptNumber || rec.id.slice(-6).toUpperCase()}`
        : `Official Receipt ${rec.receiptNumber || rec.id.slice(-6).toUpperCase()}`,
      subtitle: `${isSw ? "Mteja" : "Customer"}: ${rec.customerName || (isSw ? "Mteja wa Kaunta" : "Walk-in Patient")}${rec.customerPhone ? ` (${rec.customerPhone})` : ""}`,
      generatedLabel: `${rec.createdAt.slice(0, 16).replace("T", " ")} · ${rec.actorName}`,
      lang: isSw ? "SW" : "EN",
      narrative: isSw
        ? `Risiti hii ni kumbukumbu rasmi ya malipo kupitia ${rec.paymentMethod.toUpperCase()} yenye jumla ya TZS ${rec.totalTzs.toLocaleString("en-US")}.`
        : `Verified immutable counter receipt paid via ${rec.paymentMethod.toUpperCase()} totaling TZS ${rec.totalTzs.toLocaleString("en-US")}.`,
      metrics: [
        { label: isSw ? "Jumla" : "Total Paid", value: `TZS ${rec.totalTzs.toLocaleString("en-US")}` },
        { label: isSw ? "Malipo" : "Channel", value: rec.paymentMethod.toUpperCase() },
        { label: isSw ? "Vitu" : "Units", value: String(rec.itemCount) },
        { label: isSw ? "Mhudumu" : "Cashier", value: rec.actorName },
      ],
      tables: [
        {
          title: isSw ? "Orodha ya Dawa Zilizouzwa" : "Dispensed Items & Batches",
          headers: isSw ? ["Dawa", "Batch", "Idadi", "Bei/Moja", "Jumla"] : ["Medicine", "Batch", "Qty", "Unit Price", "Subtotal"],
          rows:
            linesList.length > 0
              ? linesList.map((ln) => [
                ln.brandName,
                ln.batchNumber || "-",
                String(ln.qty),
                `TZS ${ln.unitPriceTzs.toLocaleString("en-US")}`,
                `TZS ${(ln.qty * ln.unitPriceTzs).toLocaleString("en-US")}`,
              ])
              : [[isSw ? "Mauzo ya Kaunta" : "Counter Basket", "-", String(rec.itemCount), "-", `TZS ${rec.totalTzs.toLocaleString("en-US")}`]],
        },
      ],
    });
  };

  const openBatchInspector = (b: DashboardBatch) => {
    setFocusedBatch(b);
    setEditBatchBrand(b.brandName);
    setEditBatchGeneric(b.genericName);
    setEditBatchCategory(b.category);
    setEditCustomCatMode(false);
    setEditBatchNumber(b.batchNumber);
    setEditBatchQty(String(b.quantity));
    setEditBatchCost(String(b.costPriceTzs));
    setEditBatchPrice(String(b.salePriceTzs));
    setEditBatchExpiry(b.expiryDate);
    setEditBatchDateEntered(b.dateEntered || todayIso);
    setEditBatchThreshold(String(b.lowStockThreshold ?? 25));
    setEditBatchImageUrl(b.imageUrl || "");
    setEditBatchRx(Boolean(b.requiresPrescription));
  };

  const handleSaveBatchEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!focusedBatch) return;
    await handleManageBatch(
      {
        subAction: "edit_batch",
        batchId: focusedBatch.id,
        brandName: editBatchBrand,
        genericName: editBatchGeneric,
        category: editBatchCategory,
        batchNumber: editBatchNumber,
        quantity: Number(editBatchQty) || 0,
        costPriceTzs: Number(editBatchCost) || focusedBatch.costPriceTzs,
        salePriceTzs: Number(editBatchPrice) || focusedBatch.salePriceTzs,
        expiryDate: editBatchExpiry,
        dateEntered: editBatchDateEntered,
        lowStockThreshold: Number(editBatchThreshold) || 25,
        imageUrl: editBatchImageUrl,
        requiresPrescription: editBatchRx,
      },
      `Saved updated fields for ${editBatchBrand} (${editBatchNumber}).`
    );
    setFocusedBatch(null);
  };

  const handleShiftClock = async (clockType: "in" | "out") => {
    setShiftBusy(true);
    setShiftResultMsg(null);
    try {
      const res = await fetch("/api/workspace/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "shift_clock", clockType }),
      });
      const out = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        alreadyClockedIn?: boolean;
        shift?: { durationMinutes?: number };
      };
      if (!res.ok || !out.ok) {
        playAppSound("alert");
        setShiftResultMsg(out.error || `Shift clock ${clockType} failed.`);
        return;
      }
      playAppSound("shift-clock");
      setShiftPromptDismissed(false);
      setAutoClockOutNotice(null);
      setShiftResultMsg(
        clockType === "in"
          ? out.alreadyClockedIn
            ? isSw ? "Tayari uko kwenye zamu." : "You are already clocked in."
            : isSw ? "Umeanza zamu yako kikamilifu." : "Clocked IN cleanly."
          : isSw
            ? `Umefunga zamu (${out.shift?.durationMinutes ?? 1}m zimehifadhiwa).`
            : `Clocked OUT cleanly (${out.shift?.durationMinutes ?? 1} min logged).`
      );
      await onRefreshState();
    } catch {
      setShiftResultMsg("Network error while updating shift clock.");
    } finally {
      setShiftBusy(false);
    }
  };

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchNameInput.trim() || !branchAddrInput.trim()) return;
    setBranchBusy(true);
    try {
      const res = await fetch("/api/workspace/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_centre",
          name: branchNameInput.trim(),
          region: branchRegionInput.trim() || account.region,
          address: branchAddrInput.trim(),
          phone: branchPhoneInput.trim() || "+255 712 000 000",
          lat: branchLat,
          lng: branchLng,
          assignProfileIds: branchAssignIds,
        }),
      });
      if (res.ok) {
        setAddBranchOpen(false);
        setBranchNameInput("");
        setBranchAddrInput("");
        setBranchPhoneInput("");
        setBranchAssignIds([]);
        await onRefreshState();
      }
    } finally {
      setBranchBusy(false);
    }
  };

  const handleManageCentre = async (
    centreId: string,
    op: "pause" | "resume" | "archive" | "restore" | "toggle_exclude" | "delete"
  ) => {
    setBranchBusy(true);
    try {
      const res = await fetch("/api/workspace/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "manage_centre", centreId, op }),
      });
      if (res.ok) {
        await onRefreshState();
      }
    } finally {
      setBranchBusy(false);
    }
  };

  const handleAckHqMessage = async (messageId: string) => {
    await fetch("/api/workspace/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ack_hq_message", messageId }),
    });
    setSelectedTrailItem(null);
    await onRefreshState();
  };

  const handleSendHqReply = async () => {
    if (!hqReplyDraft.trim()) return;
    setHqChatNotice(null);
    const res = await fetch("/api/workspace/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reply_hq_trail",
        title: `Owner Reply from ${account.orgName}`,
        body: hqReplyDraft.trim(),
      }),
    });
    if (res.ok) {
      setHqReplyDraft("");
      setHqChatNotice(isSw ? "Ujumbe umetumwa kwa HQ!" : "Message logged to HQ Trail!");
      await onRefreshState();
    }
  };

  const submitFefoDispense = async () => {
    if (cartEntries.length === 0) return;
    setPosBusy(true);
    setPosMsg(null);
    try {
      const res = await fetch("/api/workspace/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "dispense_pos",
          items: cartEntries.map(([productId, qty]) => ({ productId, qty })),
          paymentMethod,
          prescriptionRef: prescriptionRef.trim() || undefined,
          customerName: posCustomerName.trim() || undefined,
          customerPhone: posCustomerPhone.trim() || undefined,
          saveCustomerPreset: saveAsPreset && posCustomerName.trim().length >= 2,
        }),
      });
      const out = (await res.json()) as {
        ok?: boolean;
        totalTzs?: number;
        allocated?: string[];
        receipt?: DashboardSale;
        error?: string;
      };
      if (!res.ok || !out.ok) {
        playAppSound("alert");
        setPosMsg({ ok: false, text: out.error || "Dispense failed." });
        return;
      }
      playAppSound("sale-complete");
      setCart({});
      setPrescriptionRef("");
      setCheckoutPreviewOpen(false);
      setLatestPrintedReceipt(out.receipt ?? null);
      setPrintingAnim(true);
      setTimeout(() => setPrintingAnim(false), 2600);
      setPosMsg({
        ok: true,
        text: `Sold (TZS ${(out.totalTzs || 0).toLocaleString("en-US")}): ${(out.allocated || []).join(", ")}`,
      });
      await onRefreshState();
    } finally {
      setPosBusy(false);
    }
  };

  const submitShiftClose = async () => {
    setReconcileBusy(true);
    setShiftResultMsg(null);
    try {
      const res = await fetch("/api/workspace/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reconcile_shift",
          openingCashTzs: Number(openingCash) || 0,
          cashSalesTzs,
          mobileMoneySalesTzs: mobileSalesTzs,
          declaredCashTzs: Number(declaredCash) || 0,
        }),
      });
      const out = (await res.json()) as {
        ok?: boolean;
        reconciliation?: { status: string; expectedCashTzs: number; varianceTzs: number };
      };
      if (res.ok && out.reconciliation) {
        setShiftResultMsg(
          `Shift reconciled (${out.reconciliation.status.toUpperCase()}): Expected TZS ${out.reconciliation.expectedCashTzs.toLocaleString("en-US")}, Variance TZS ${out.reconciliation.varianceTzs.toLocaleString("en-US")}`
        );
        await onRefreshState();
      }
    } finally {
      setReconcileBusy(false);
    }
  };

  const placeOrder = async (catalogId: string, minQty: number) => {
    setOrderNotice(null);
    const res = await fetch("/api/workspace/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "place_wholesale_order", catalogId, quantity: minQty }),
    });
    const out = (await res.json()) as {
      ok?: boolean;
      escalatedToChat?: boolean;
      message?: string;
      orderReference?: string;
      error?: string;
    };
    if (out.escalatedToChat) {
      setOrderNotice({ escalated: true, text: out.message || "Permission request sent to Owner in branch chat." });
      await onRefreshState();
      onOpenChat();
      return;
    }
    if (!res.ok || !out.ok) {
      setOrderNotice({ text: out.error || "Order failed." });
      return;
    }
    setOrderNotice({ text: `Order ${out.orderReference} placed cleanly in Kasri escrow.` });
    await onRefreshState();
  };

  const confirmDelivery = async (orderId: string) => {
    setOrderNotice(null);
    const res = await fetch("/api/workspace/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm_grn_delivery", orderId, gs1Barcode: gs1Input }),
    });
    const out = (await res.json()) as { ok?: boolean; batchNumber?: string; expiryDate?: string; error?: string };
    if (!res.ok || !out.ok) {
      setOrderNotice({ text: out.error || "Delivery confirmation failed." });
      return;
    }
    setGs1Input("");
    setOrderNotice({ text: `Delivery Confirmed: Lot ${out.batchNumber} (Exp ${out.expiryDate}) added & escrow released.` });
    await onRefreshState();
  };

  const handleManageBatch = async (payload: Record<string, unknown>, msg: string, busyKey?: string) => {
    const key = busyKey || String(payload.subAction ?? "batch");
    setInvBusyKey(key);
    setInvNotice(null);
    try {
      const res = await fetch("/api/workspace/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "manage_batch", ...payload }),
      });
      const out = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !out.ok) {
        setInvNotice(out.error || "Batch update failed.");
        return;
      }
      setInvNotice(msg);
      await onRefreshState();
    } finally {
      setInvBusyKey(null);
    }
  };

  const handleSaveOperatorEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfileId) return;
    setOpEditBusy(true);
    setTeamNotice(null);
    try {
      const res = await fetch("/api/workspace/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit_profile",
          profileId: editingProfileId,
          displayName: editName,
          username: editUsername.trim() || undefined,
          role: editRole,
          centreId: editCentreId,
          capabilities: editCaps,
          newPin: editPin.trim() || undefined,
        }),
      });
      const out = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !out.ok) {
        setTeamNotice(out.error || "Could not update operator.");
        return;
      }
      setEditingProfileId(null);
      setEditPin("");
      setTeamNotice("Operator profile & permissions updated remotely.");
      await onRefreshState();
    } finally {
      setOpEditBusy(false);
    }
  };

  const processScannedCode = (rawInput: string) => {
    const clean = rawInput.trim();
    if (!clean) return;
    const parsed = parseGs1Barcode(clean);
    const lower = clean.toLowerCase();
    const batchMatch = batches.find(
      (b) =>
        (parsed.batchNumber && b.batchNumber.toLowerCase() === parsed.batchNumber.toLowerCase()) ||
        b.batchNumber.toLowerCase() === lower ||
        b.productId.toLowerCase() === lower ||
        b.brandName.toLowerCase() === lower ||
        (parsed.gtin && parsed.gtin.endsWith(b.productId.replace(/\D/g, "")) && b.productId.replace(/\D/g, "").length > 0)
    );
    const prodMatch = batchMatch
      ? productsSummary.find((p) => p.productId === batchMatch.productId)
      : productsSummary.find(
        (p) =>
          p.brandName.toLowerCase().includes(lower) ||
          p.genericName.toLowerCase().includes(lower) ||
          p.productId.toLowerCase() === lower
      );

    if (!prodMatch) {
      playAppSound("alert");
      setPosMsg({ ok: false, text: `No matching stock found for "${clean}".` });
      return;
    }
    if (batchMatch && (batchMatch.quarantined || batchMatch.expiryDate < todayIso)) {
      playAppSound("alert");
      setPosMsg({
        ok: false,
        text: `${batchMatch.brandName} lot ${batchMatch.batchNumber} is expired or quarantined and cannot be dispensed.`,
      });
      return;
    }
    if (prodMatch.validQty <= (cart[prodMatch.productId] || 0)) {
      playAppSound("alert");
      setPosMsg({ ok: false, text: `All valid units of ${prodMatch.brandName} are already in basket.` });
      return;
    }
    playAppSound("scan");
    adjustCart(prodMatch.productId, 1);
    setScanCode("");
    setScannerOpen(false);
    setPosMsg({
      ok: true,
      text: `Scanned ${prodMatch.brandName}${parsed.batchNumber ? ` (GS1 Lot ${parsed.batchNumber})` : ""} +1 added.`,
    });
  };

  useEffect(() => {
    if (!scannerOpen) return;
    let active = true;
    let stream: MediaStream | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    setCameraError(null);

    const startCam = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraError("Camera access is not available in this browser context. Use manual scan or USB scanner.");
          return;
        }
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!active || !videoRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => {
          detect: (src: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
        };
        const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
        if (!Detector) {
          setCameraError("Live camera active. Your browser lacks BarcodeDetector API; type or click a test barcode below.");
          return;
        }
        const detector = new Detector({
          formats: ["qr_code", "code_128", "ean_13", "data_matrix"],
        });
        intervalId = setInterval(async () => {
          if (!active || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const rawVal = codes[0]?.rawValue;
            if (rawVal) {
              processScannedCode(rawVal);
            }
          } catch {
            // Ignore frame decode error
          }
        }, 550);
      } catch {
        setCameraError("Camera permission denied or no camera device detected. Use quick GS1 scan presets below.");
      }
    };

    startCam();
    return () => {
      active = false;
      if (intervalId) clearInterval(intervalId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [scannerOpen]);

  const handleLogExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setBillingNotice(null);
    setExpenseBusy(true);
    try {
      const res = await fetch("/api/workspace/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "log_expense",
          category: expCategory,
          description: expDesc,
          amountTzs: Number(expAmount) || 0,
        }),
      });
      const out = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !out.ok) {
        setBillingNotice(out.error || "Could not record expense.");
        return;
      }
      setExpDesc("");
      setExpAmount("");
      setBillingNotice("Operating expense recorded into 30-day P&L.");
      await onRefreshState();
    } finally {
      setExpenseBusy(false);
    }
  };

  const handleSavePaymentSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setBillingNotice(null);
    setSettlementBusy(true);
    try {
      const res = await fetch("/api/workspace/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_payment_settings",
          mpesaPaybill,
          tigoLipaNumber,
          bankName,
          bankAccount,
          settlementCycle,
          vatRegistered,
        }),
      });
      const out = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !out.ok) {
        setBillingNotice(out.error || "Failed to update settlement settings.");
        return;
      }
      setBillingNotice("Settlement wallets and cycle saved.");
      await onRefreshState();
    } finally {
      setSettlementBusy(false);
    }
  };

  const q = searchQuery.trim();
  const posQ = combineSearchQueries(posSearch, q);
  const visiblePosProducts = useMemo(() => {
    if (!posQ) return productsSummary;
    return productsSummary.filter((p) => {
      const matchingBatch = batches.some(
        (b) =>
          b.productId === p.productId &&
          matchesSearch(posQ, b.batchNumber, b.brandName, b.genericName, b.category)
      );
      return (
        matchingBatch ||
        matchesSearch(posQ, p.brandName, p.genericName, p.category, p.earliestBatch)
      );
    });
  }, [productsSummary, batches, posQ]);

  const invCombinedQ = combineSearchQueries(invSearch, q);
  const visibleBatches = useMemo(() => {
    const cutoff30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const sorted = [...batches].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
    return sorted.filter((b) => {
      if (invFilter === "expired" && b.expiryDate >= todayIso) return false;
      if (invFilter === "quarantined" && !b.quarantined) return false;
      if (invFilter === "low" && (b.quarantined || b.quantity > (b.lowStockThreshold ?? 25))) return false;
      if (invFilter === "expiring" && (b.quarantined || b.expiryDate < todayIso || b.expiryDate > cutoff30)) return false;
      return matchesSearch(
        invCombinedQ,
        b.brandName,
        b.genericName,
        b.batchNumber,
        b.category
      );
    });
  }, [batches, invCombinedQ, invFilter, todayIso]);

  const activeShift = useMemo(
    () => shiftLogs.find((s) => s.profileId === activeProfileId && !s.clockOutAt) ?? null,
    [shiftLogs, activeProfileId]
  );

  // Automatic away/idle shift clock-out + activity heartbeat
  useEffect(() => {
    if (typeof window === "undefined" || !activeProfileId) return;
    const heartbeatKey = `cervos-shift-active-at-${activeProfileId}`;
    const AUTO_CLOCKOUT_AWAY_MS = 4 * 60 * 60 * 1000; // 4 hours out of app -> auto clock out
    const MAX_SHIFT_AGE_MS = 12 * 60 * 60 * 1000;

    const recordHeartbeat = () => {
      try {
        window.localStorage.setItem(heartbeatKey, String(Date.now()));
      } catch {
        // Ignore storage errors
      }
    };

    const checkAwayClockOut = async () => {
      if (!activeShift || autoClockCheckedRef.current) return;
      try {
        const lastActiveRaw = Number(window.localStorage.getItem(heartbeatKey));
        const now = Date.now();
        const awayMs = Number.isFinite(lastActiveRaw) && lastActiveRaw > 0 ? now - lastActiveRaw : 0;
        const shiftAgeMs = now - Date.parse(activeShift.clockInAt);
        if (awayMs >= AUTO_CLOCKOUT_AWAY_MS || shiftAgeMs >= MAX_SHIFT_AGE_MS) {
          autoClockCheckedRef.current = true;
          const awayMinutes = Math.max(
            1,
            Math.round((awayMs >= AUTO_CLOCKOUT_AWAY_MS ? awayMs : shiftAgeMs) / 60000)
          );
          const res = await fetch("/api/workspace/state", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "shift_clock",
              clockType: "auto_out",
              awayMinutes,
            }),
          });
          if (res.ok) {
            const hrs = Math.floor(awayMinutes / 60);
            const mins = awayMinutes % 60;
            playAppSound("shift-clock");
            setAutoClockOutNotice(
              isSw
                ? `Ulitolewa zamu kiotomatiki baada ya kuwa nje ya app kwa saa ${hrs} dak ${mins}. Ingia tena kama unaanza zamu mpya.`
                : `You were away for ${hrs}h ${mins}m, so your previous shift was auto clocked out cleanly.`
            );
            await onRefreshState();
          }
        }
      } catch {
        // Ignore
      } finally {
        recordHeartbeat();
      }
    };

    void checkAwayClockOut();
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void checkAwayClockOut();
      } else {
        recordHeartbeat();
      }
    };
    window.addEventListener("pointerdown", recordHeartbeat, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pointerdown", recordHeartbeat);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [activeProfileId, activeShift, isSw, onRefreshState]);

  useEffect(() => {
    if (!focusedBatch && !focusedReceipt && !selectedTrailItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFocusedBatch(null);
        setFocusedReceipt(null);
        setSelectedTrailItem(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusedBatch, focusedReceipt, selectedTrailItem]);

  const recCombinedQ = combineSearchQueries(receiptSearch, q);
  const visibleReceipts = useMemo(() => {
    const sorted = [...sales].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!recCombinedQ) return sorted;
    return sorted.filter((s) =>
      matchesSearch(
        recCombinedQ,
        s.receiptNumber,
        s.id,
        s.customerName,
        s.customerPhone,
        s.actorName,
        s.paymentMethod,
        s.prescriptionRef,
        ...(s.lines ?? []).flatMap((ln) => [ln.brandName, ln.category, ln.batchNumber])
      )
    );
  }, [sales, recCombinedQ]);

  const visibleProfiles = useMemo(
    () =>
      !q
        ? profiles
        : profiles.filter((p) => {
          const br = centres.find((c) => c.id === p.centreId);
          return matchesSearch(q, p.displayName, p.username, p.role, br?.name, br?.region);
        }),
    [profiles, centres, q]
  );

  const visibleCentres = useMemo(
    () =>
      !q
        ? centres
        : centres.filter((c) => matchesSearch(q, c.name, c.region, c.address)),
    [centres, q]
  );

  const visibleExpenses = useMemo(
    () =>
      !q
        ? expenses
        : expenses.filter((ex) => matchesSearch(q, ex.category, ex.description, ex.amountTzs, ex.createdAt)),
    [expenses, q]
  );

  const validLotsCount = useMemo(
    () => batches.filter((b) => !b.quarantined && b.quantity > 0 && b.expiryDate >= todayIso).length,
    [batches, todayIso]
  );

  const fefoChart = useMemo(() => {
    const in30Iso = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const in90Iso = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    const buckets = [
      { key: "safe", label: isSw ? "Salama (>90s)" : "Safe (>90d)", x: 24, count: 0, units: 0, valueTzs: 0 },
      { key: "watch", label: isSw ? "Fuatilia (31-90s)" : "Watch (31-90d)", x: 132, count: 0, units: 0, valueTzs: 0 },
      { key: "fefo", label: isSw ? "Uza Kwanza (<=30s)" : "Expiring (<=30d)", x: 240, count: 0, units: 0, valueTzs: 0 },
      { key: "blocked", label: isSw ? "Imekwisha/Zuiwa" : "Expired/Blocked", x: 340, count: 0, units: 0, valueTzs: 0 },
    ];
    for (const b of batches) {
      if (b.quantity <= 0) continue;
      const val = b.quantity * b.costPriceTzs;
      if (b.quarantined || b.expiryDate < todayIso) {
        buckets[3].count += 1;
        buckets[3].units += b.quantity;
        buckets[3].valueTzs += val;
      } else if (b.expiryDate <= in30Iso) {
        buckets[2].count += 1;
        buckets[2].units += b.quantity;
        buckets[2].valueTzs += val;
      } else if (b.expiryDate <= in90Iso) {
        buckets[1].count += 1;
        buckets[1].units += b.quantity;
        buckets[1].valueTzs += val;
      } else {
        buckets[0].count += 1;
        buckets[0].units += b.quantity;
        buckets[0].valueTzs += val;
      }
    }
    const maxUnits = Math.max(...buckets.map((b) => b.units), 1);
    const hasAnyStock = batches.some((b) => b.quantity > 0);
    const nodes = buckets.map((b, idx) => ({
      ...b,
      idx,
      y: !hasAnyStock ? 68 : Math.max(18, Math.min(68, 68 - Math.round((b.units / maxUnits) * 48))),
    }));
    let lineD = `M ${nodes[0].x} ${nodes[0].y}`;
    for (let i = 0; i < nodes.length - 1; i++) {
      const p0 = nodes[i];
      const p1 = nodes[i + 1];
      const cx = Math.round((p0.x + p1.x) / 2);
      lineD += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    const areaD = `${lineD} L ${nodes[nodes.length - 1].x} 76 L ${nodes[0].x} 76 Z`;
    return { nodes, lineD, areaD, hasAnyStock };
  }, [batches, todayIso, isSw]);

  const todaySalesTzs = useMemo(
    () => sales.filter((s) => s.createdAt.slice(0, 10) === todayIso).reduce((sum, s) => sum + s.totalTzs, 0),
    [sales, todayIso]
  );

  const pnlSummary = useMemo(() => {
    // Clean slate accounts with zero operations or active trial window incur zero opex/deficit
    const isCleanSlate = sales.length === 0 && expenses.length === 0;
    const isTrialing = Boolean(account.trialEndsAt && new Date(account.trialEndsAt).getTime() > Date.now());
    const monthlyFee = isCleanSlate || isTrialing || !account.subscriptionActive ? 0 : 45000;
    return profitAndLoss(sales, expenses, { days: 30, subscriptionMonthlyTzs: monthlyFee });
  }, [sales, expenses, account.trialEndsAt, account.subscriptionActive]);

  // Join Request Allocation state (Owners)
  const [allocCentreId, setAllocCentreId] = useState<string>(activeCentre?.id || centres[0]?.id || "");
  const [allocRole, setAllocRole] = useState<string>("superintendent_pharmacist");
  const [allocPin, setAllocPin] = useState<string>("7391");
  const [declineNote, setDeclineNote] = useState<string>("");
  const [reqBusyId, setReqBusyId] = useState<string | null>(null);
  const [reqNotice, setReqNotice] = useState<string | null>(null);

  const pendingJoinRequests = useMemo(
    () => joinRequests.filter((r) => r.status === "pending"),
    [joinRequests]
  );

  const handleReviewJoinRequest = async (
    requestId: string,
    decision: "approve" | "decline"
  ) => {
    setReqBusyId(requestId);
    setReqNotice(null);
    try {
      const res = await fetch("/api/workspace/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review_join_request",
          requestId,
          decision,
          centreId: allocCentreId || activeCentre?.id || centres[0]?.id,
          role: allocRole,
          pin: allocPin,
          capabilities: allocCaps,
          declineReason: declineNote || undefined,
        }),
      });
      const out = (await res.json()) as {
        ok?: boolean;
        status?: string;
        username?: string;
        centreName?: string;
        error?: string;
      };
      if (!res.ok || !out.ok) {
        setReqNotice(out.error || "Unable to review join request.");
        return;
      }
      setReqNotice(
        out.status === "approved"
          ? `Provisioned @${out.username} to ${out.centreName}. They will confirm & enter on next sign-in.`
          : "Access request declined cleanly."
      );
      setDeclineNote("");
      await onRefreshState();
    } finally {
      setReqBusyId(null);
    }
  };

  const cardCls = isDark
    ? "bg-[#11161F]/95 border-slate-800/90 text-slate-100 shadow-lg transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-slate-700"
    : "bg-white border-[#EAECF0] text-[#111317] shadow-[0_6px_28px_rgba(15,23,42,0.035)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-[0_12px_34px_rgba(15,23,42,0.06)]";

  const mutedCls = isDark ? "text-slate-400" : "text-[#8B929E]";
  const chipCls = isDark
    ? "bg-[#171D28] border-slate-800 text-slate-200"
    : "bg-white border-[#EAECF0] text-[#111317] shadow-[0_2px_6px_rgba(15,23,42,0.025)]";
  const inputCls = isDark
    ? "bg-slate-900/90 border-slate-700 text-slate-100 focus:border-[#38BDF8]"
    : "bg-[#F8FAFC] border-[#E2E8F0] text-[#111317] focus:border-[#1039B9] focus:bg-white";

  // State-aware Spotlight Card action + target
  const spotlightState = !account.subscriptionActive
    ? {
      eyebrow: isSw ? "Mpango wa Majaribio" : "Trial Plan",
      badge: isSw ? "Siku 15" : "15 Days",
      badgeTone: "bg-[#E2F575] text-[#111317]",
      title: isSw ? "Washa Mpango Kamili" : "Activate Annual Plan",
      desc: "Lock yearly branch rate cleanly while Counter POS stays live.",
      ctaLabel: isSw ? "Lipa & Washa" : "Pay & Activate",
      onClick: () => onPaySubscription(),
      href: undefined,
    }
    : !account.networkUnlocked
      ? {
        eyebrow: isSw ? "Leseni Inasubiriwa" : "Network Locked",
        badge: "1 Step Left",
        badgeTone: "bg-amber-200 text-amber-950",
        title: isSw ? "Pakia Cheti cha Duka" : "Verify Operating Permit",
        desc: "Offline Counter POS runs now. Upload permit to unlock Kasri wholesale trade.",
        ctaLabel: isSw ? "Pakia Cheti" : "Upload Permit",
        onClick: undefined,
        href: "/app/settings?tab=org#certificates",
      }
      : earliestNearExpiry
        ? {
          eyebrow: isSw ? "Tahadhari ya Muda" : "Expiry Watch",
          badge: `${stockAlerts.nearExpiryCount} <= 30d`,
          badgeTone: "bg-[#E2F575] text-[#111317]",
          title: `${earliestNearExpiry.brandName} · ${earliestNearExpiry.batchNumber}`,
          desc: `Priority lot (${earliestNearExpiry.quantity} packs, exp ${earliestNearExpiry.expiryDate}). Inspect or sell first.`,
          ctaLabel: isSw ? "Kagua Stoo" : "Inspect Expiring Stock",
          onClick: () => setTab("inventory"),
          href: undefined,
        }
        : {
          eyebrow: isSw ? "Hali ya Zamu" : "Dispensary Ready",
          badge: "Stock Clear",
          badgeTone: "bg-[#E2F575] text-[#111317]",
          title: "All Lots Within Range",
          desc: "Every active batch is verified and sorted by earliest expiry. Open Counter POS to sell.",
          ctaLabel: isSw ? "Fungua Kaunta" : "Open Counter POS",
          onClick: () => setTab("operations"),
          href: undefined,
        };

  const tabHeading =
    tab === "operations"
      ? isSw ? "Kaunta ya POS & Zamu" : "Counter POS & Shift"
      : tab === "receipts"
        ? isSw ? "Hifadhi ya Risiti" : "Receipts Vault"
        : tab === "inventory"
          ? isSw ? "Usimamizi wa Stoo" : "Inventory & Stock"
          : tab === "network"
            ? isSw ? "Jumla & Kasri Escrow" : "Wholesale & Kasri Escrow"
            : tab === "reports"
              ? isSw ? "Ripoti & Akili ya Biashara" : "Reports & Intelligence"
              : tab === "billing"
                ? isSw ? "Fedha, P&L & Malipo" : "Finance, P&L & Billing"
                : tab === "team"
                  ? isSw ? "Timu, Matawi & Leseni" : "Team, Operators & Permits"
                  : isSw ? "Dashibodi ya Duka" : "Pharmacy Dashboard";

  const renderPendingRequestsSection = () => {
    if (!canManageAdmin || pendingJoinRequests.length === 0) return null;
    return (
      <div className={`rounded-[24px] border p-6 space-y-4 ${cardCls}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">
              Incoming Team Access Requests ({pendingJoinRequests.length})
            </h2>
            <p className={`text-[11px] ${mutedCls}`}>
              Assign a branch, role &amp; 4-6 digit Counter PIN to provision applicants from the Welcome Lounge.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 text-[10px] font-bold">
            Action Needed
          </span>
        </div>

        {reqNotice && (
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-600">
            {reqNotice}
          </div>
        )}

        <div className="space-y-3">
          {pendingJoinRequests.map((rq) => (
            <div key={rq.id} className={`p-4 rounded-2xl border space-y-3 text-xs ${chipCls}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold">{rq.requesterFullName}</span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-[#1039B9] dark:text-[#38BDF8] font-mono text-[10px] font-bold">
                      @{rq.requesterUsername}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] uppercase ${mutedCls}`}>
                      {rq.requesterSex.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className={`text-[11px] mt-0.5 ${mutedCls}`}>
                    {rq.requesterEmail} &middot; Region: {rq.requesterRegion}
                    {rq.requestedRoleLabel ? ` · Applied: ${rq.requestedRoleLabel}` : ""}
                  </div>
                  {rq.note && <div className="text-[11px] italic mt-1 opacity-85">&ldquo;{rq.note}&rdquo;</div>}
                </div>
                <span className={`font-mono text-[10px] ${mutedCls}`}>{rq.createdAt.slice(0, 10)}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
                <select
                  value={allocCentreId}
                  onChange={(e) => setAllocCentreId(e.target.value)}
                  aria-label="Allocate Branch"
                  className={`sm:col-span-4 px-3 py-2 rounded-xl border text-xs ${inputCls}`}
                >
                  {centres.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  value={allocRole}
                  onChange={(e) => setAllocRole(e.target.value)}
                  aria-label="Allocate Role"
                  className={`sm:col-span-4 px-3 py-2 rounded-xl border text-xs ${inputCls}`}
                >
                  <option value="superintendent_pharmacist">Superintendent Pharmacist</option>
                  <option value="pos_cashier">Counter Cashier</option>
                  <option value="warehouse_dispatcher">Warehouse Dispatcher</option>
                  <option value="pharmacy_owner">Branch Admin / Owner</option>
                </select>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={allocPin}
                  onChange={(e) => setAllocPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="PIN (4-6 digits)"
                  aria-label="Counter PIN"
                  className={`sm:col-span-4 px-3 py-2 rounded-xl border font-mono text-xs ${inputCls}`}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <input
                  type="text"
                  value={declineNote}
                  onChange={(e) => setDeclineNote(e.target.value)}
                  placeholder="Optional decline note..."
                  className={`flex-1 min-w-[160px] px-3 py-1.5 rounded-full border text-[11px] ${inputCls}`}
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={reqBusyId === rq.id}
                    onClick={() => handleReviewJoinRequest(rq.id, "decline")}
                    className="px-3.5 py-1.5 rounded-full border border-rose-500/40 text-rose-500 text-[11px] font-semibold cursor-pointer"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    disabled={reqBusyId === rq.id}
                    onClick={() => handleReviewJoinRequest(rq.id, "approve")}
                    className="px-4 py-1.5 rounded-full text-white text-[11px] font-semibold cursor-pointer"
                    style={{ backgroundColor: accent }}
                  >
                    {reqBusyId === rq.id ? "Allocating..." : "Approve & Allocate ->"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Crisp Header + Back / Quick Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
        <div data-tour="branch-header" className="space-y-1.5">
          <div className={`text-[11px] font-medium flex flex-wrap items-center gap-1.5 ${mutedCls}`}>
            {canManageAdmin && centres.length > 0 && onSetOrgScope && (
              <div className={`inline-flex rounded-full border p-0.5 mr-1 ${chipCls}`}>
                <button
                  type="button"
                  onClick={() => {
                    onSetOrgScope("all");
                    setTab("overview");
                  }}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${orgScope === "all" ? "text-white" : mutedCls
                    }`}
                  style={orgScope === "all" ? { backgroundColor: accent } : undefined}
                >
                  {isSw ? "Matawi Yote" : "All Branches"}
                </button>
                <button
                  type="button"
                  onClick={() => onSetOrgScope("branch")}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${orgScope === "branch" ? "text-white" : mutedCls
                    }`}
                  style={orgScope === "branch" ? { backgroundColor: accent } : undefined}
                >
                  {activeCentre?.name || "Branch"}
                </button>
              </div>
            )}
            <button type="button" onClick={() => setTab("overview")} className="hover:underline cursor-pointer">
              {orgScope === "all" && canManageAdmin ? account.orgName : activeCentre?.name || account.orgName}
            </button>
            <span>&rarr;</span>
            <span className={isDark ? "text-slate-200" : "text-[#111317]"}>{tabHeading}</span>
          </div>
          <h1 className="text-3xl sm:text-[34px] font-normal tracking-tight leading-none" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
            {tab === "overview" && orgScope === "all" && canManageAdmin
              ? `${account.orgName} · ${isSw ? "Mtazamo Mkuu" : "All Branches"}`
              : tabHeading}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTourOpen(true)}
            className={`px-3.5 py-2 rounded-full border text-xs font-semibold cursor-pointer transition-colors ${chipCls} hover:border-slate-400`}
          >
            {isSw ? "Mwongozo" : "Quick Tour"}
          </button>
          <Link
            href="/app/settings?tab=hardware"
            data-tour="hardware-settings-link"
            className={`px-3.5 py-2 rounded-full border text-xs font-semibold cursor-pointer transition-colors ${chipCls} hover:border-slate-400`}
          >
            {isSw ? "Vifaa & Sauti" : "Hardware & Sound"}
          </Link>
          {tab !== "overview" ? (
            <button
              type="button"
              onClick={() => setTab("overview")}
              className={`px-4 py-2 rounded-full border text-xs font-semibold cursor-pointer transition-colors ${chipCls} hover:border-slate-400`}
            >
              &larr; {isSw ? "Rudi Muhtasari" : "Back to Overview"}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => openReport("brief")}
                className={`px-4 py-2 rounded-full border text-xs font-semibold cursor-pointer transition-colors ${chipCls} hover:border-slate-400`}
              >
                {isSw ? "Ripoti Kuu" : "Reports & Insights"}
              </button>
              <button
                type="button"
                data-tour="open-pos-cta"
                onClick={() => setTab("operations")}
                className="px-4 py-2 rounded-full text-white text-xs font-semibold cursor-pointer shadow-xs transition-opacity hover:opacity-90"
                style={{ backgroundColor: accent }}
              >
                + {isSw ? "Fungua Kaunta ya POS" : "Open Counter POS"}
              </button>
              {canManageAdmin && orgScope === "all" && (
                <button
                  type="button"
                  onClick={() => setTab("billing")}
                  className="px-4 py-2 rounded-full text-white text-xs font-semibold cursor-pointer shadow-xs transition-opacity hover:opacity-90"
                  style={{ backgroundColor: accent }}
                >
                  {isSw ? "Fedha & Kulinganisha" : "Finance & Compare"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ================================================================ */}
      {/* TAB: REPORTS & DEEP BUSINESS INTELLIGENCE                        */}
      {/* ================================================================ */}
      {tab === "reports" && (
        <ReportsIntelligenceView
          orgName={account.orgName}
          activeCentreName={
            orgScope === "all" && canManageAdmin
              ? isSw
                ? "Matawi Yote"
                : "All Branches"
              : activeCentre?.name || account.orgName
          }
          activeView={reportView}
          orgLogoUrl={account.customization?.brandLogoUrl}
          activeProfileId={activeProfileId}
          activeProfileName={activeProfileName}
          activeProfileRole={activeProfileRole}
          capabilities={caps}
          profiles={profiles}
          onSelectView={setReportView}
          onNavigateTab={(t) => setTab(t)}
          onSwitchCentre={onSwitchCentre}
          sales={sales}
          batches={batches}
          orders={wholesaleOrders}
          expenses={expenses}
          centres={centres}
          orgBranchComparison={orgBranchComparison}
          activeCentreId={activeCentre?.id}
          accent={accent}
          isDark={isDark}
          isSw={isSw}
        />
      )}

      {/* ================================================================ */}
      {/* TAB: INVENTORY & REMOTE BATCH MANAGER                            */}
      {/* ================================================================ */}
      {tab === "inventory" && (
        <div className="space-y-4 animate-stage-pop">
          {invNotice && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-600">
              {invNotice}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            <div className={`lg:col-span-8 rounded-[24px] border p-6 space-y-4 ${cardCls}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">
                    {isSw ? `Makundi ya Stoo (${visibleBatches.length})` : `Live Branch Batches (${visibleBatches.length})`}
                  </h2>
                  <p className={`text-[11px] ${mutedCls}`}>
                    {isSw
                      ? "Bonyeza bidhaa yoyote kuona takwimu, picha, na kuhariri taarifa zake."
                      : "Click any product batch for its individual Focus Card, dispense chart & editable fields."}
                  </p>
                </div>
                <input
                  type="search"
                  value={invSearch}
                  onChange={(e) => setInvSearch(e.target.value)}
                  placeholder={isSw ? "Tafuta dawa, kisayansi, batch..." : "Search brand, generic, batch, category..."}
                  className={`w-full sm:w-64 px-3.5 py-2 rounded-full border text-xs focus:outline-none ${inputCls}`}
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: "all", label: isSw ? "Zote" : "All" },
                    { id: "expiring", label: isSw ? "Inaisha <=30d" : "Expiring <=30d" },
                    { id: "low", label: isSw ? "Stoo Ndogo" : "Below Threshold" },
                    { id: "expired", label: isSw ? "Zimeisha" : "Expired" },
                    { id: "quarantined", label: isSw ? "Karantini" : "Quarantined" },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setInvFilter(f.id)}
                    className={`px-3 py-1 rounded-full border text-[11px] font-semibold cursor-pointer ${invFilter === f.id ? "text-white border-transparent" : chipCls
                      }`}
                    style={invFilter === f.id ? { backgroundColor: accent } : undefined}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {focusedBatch && typeof document !== "undefined" && (() => {
                const sameProductBatches = batches.filter((x) => x.productId === focusedBatch.productId);
                const prodSalesLines = sales.flatMap((s) =>
                  (s.lines ?? [])
                    .filter((ln) => ln.productId === focusedBatch.productId)
                    .map((ln) => ({ date: s.createdAt.slice(5, 10), qty: ln.qty }))
                );
                const trendBars =
                  prodSalesLines.length > 0
                    ? prodSalesLines.slice(0, 6)
                    : [
                      { date: "D-3", qty: 4 },
                      { date: "D-2", qty: 7 },
                      { date: "D-1", qty: 5 },
                    ];
                const maxBar = Math.max(1, ...trendBars.map((t) => t.qty));
                const unitMargin = focusedBatch.salePriceTzs - focusedBatch.costPriceTzs;
                const marginPct = focusedBatch.salePriceTzs > 0 ? Math.round((unitMargin / focusedBatch.salePriceTzs) * 100) : 0;

                return createPortal(
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={focusedBatch.brandName}
                    className="fixed inset-0 z-[125] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
                    onClick={() => setFocusedBatch(null)}
                  >
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 rounded-[26px] border space-y-4 ring-2 shadow-2xl animate-stage-pop ${cardCls}`}
                      style={{ borderColor: accent }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-center gap-3.5">
                          {focusedBatch.imageUrl ? (
                            <img
                              src={focusedBatch.imageUrl}
                              alt={focusedBatch.brandName}
                              className="w-14 h-14 rounded-2xl object-cover border border-slate-200/40"
                            />
                          ) : (
                            <div
                              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg shrink-0"
                              style={{ backgroundColor: accent }}
                            >
                              {focusedBatch.brandName.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>
                              {isSw ? "KADI YA MAELEZO YA DAWA" : "PRODUCT & BATCH FOCUS CARD"}
                            </div>
                            <h3 className="text-base font-bold">{focusedBatch.brandName} ({focusedBatch.genericName})</h3>
                            <div className={`text-[11px] ${mutedCls}`}>
                              {focusedBatch.category} &middot; Batch <span className="font-mono">{focusedBatch.batchNumber}</span> &middot;{" "}
                              {focusedBatch.requiresPrescription ? "Rx Prescription Required" : "OTC Unrestricted"}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFocusedBatch(null)}
                          className={`px-3 py-1 rounded-full border text-xs font-semibold cursor-pointer ${chipCls}`}
                        >
                          Close &times;
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                        <div className={`p-3 rounded-xl border ${cardCls}`}>
                          <div className={`text-[10px] ${mutedCls}`}>Cost / Unit</div>
                          <div className="font-bold mt-0.5">TZS {focusedBatch.costPriceTzs.toLocaleString("en-US")}</div>
                        </div>
                        <div className={`p-3 rounded-xl border ${cardCls}`}>
                          <div className={`text-[10px] ${mutedCls}`}>Sale / Unit</div>
                          <div className="font-bold text-emerald-500 mt-0.5">
                            TZS {focusedBatch.salePriceTzs.toLocaleString("en-US")} ({marginPct}%)
                          </div>
                        </div>
                        <div className={`p-3 rounded-xl border ${cardCls}`}>
                          <div className={`text-[10px] ${mutedCls}`}>Alert Threshold</div>
                          <div className="font-bold mt-0.5">
                            {focusedBatch.quantity} / {focusedBatch.lowStockThreshold ?? 25} min
                          </div>
                        </div>
                        <div className={`p-3 rounded-xl border ${cardCls}`}>
                          <div className={`text-[10px] ${mutedCls}`}>Date Entry / Exp</div>
                          <div className="font-bold font-mono text-[11px] mt-0.5">
                            {focusedBatch.dateEntered || "-"} &rarr; {focusedBatch.expiryDate}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className={`p-3.5 rounded-xl border space-y-2 ${cardCls}`}>
                          <div className={`text-[10px] font-bold uppercase ${mutedCls}`}>
                            {isSw ? "Mwelekeo wa Mauzo" : "Dispense Trend"}
                          </div>
                          <div className="flex items-end gap-2 h-16">
                            {trendBars.map((tb, i) => (
                              <div key={`${tb.date}-${i}`} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                                <div
                                  className="w-full rounded-t"
                                  style={{ height: `${Math.max(18, Math.round((tb.qty / maxBar) * 100))}%`, backgroundColor: accent }}
                                  title={`${tb.date}: ${tb.qty} packs`}
                                />
                                <span className="text-[9px] opacity-70">{tb.date}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className={`p-3.5 rounded-xl border space-y-1.5 ${cardCls}`}>
                          <div className={`text-[10px] font-bold uppercase ${mutedCls}`}>
                            {isSw ? `Makundi Yote (${sameProductBatches.length})` : `All Linked Batches (${sameProductBatches.length})`}
                          </div>
                          {sameProductBatches.map((sb) => (
                            <div key={sb.id} className="flex justify-between text-[11px]">
                              <span className="font-mono">{sb.batchNumber} (Exp {sb.expiryDate})</span>
                              <strong>{sb.quantity} packs</strong>
                            </div>
                          ))}
                        </div>
                      </div>

                      {caps.canEditInventory && (
                        <form onSubmit={handleSaveBatchEdit} className={`p-4 rounded-xl border space-y-3 ${cardCls}`}>
                          <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: accent }}>
                            {isSw ? "Hariri Taarifa za Bidhaa & Kundi" : "Edit Product & Batch Fields"}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div>
                              <label className={`block text-[10px] mb-1 ${mutedCls}`}>Brand Name</label>
                              <input type="text" value={editBatchBrand} onChange={(e) => setEditBatchBrand(e.target.value)} className={`w-full px-2.5 py-1.5 rounded-lg border ${inputCls}`} />
                            </div>
                            <div>
                              <label className={`block text-[10px] mb-1 ${mutedCls}`}>Generic Name</label>
                              <input type="text" value={editBatchGeneric} onChange={(e) => setEditBatchGeneric(e.target.value)} className={`w-full px-2.5 py-1.5 rounded-lg border ${inputCls}`} />
                            </div>
                            <div>
                              <label className={`block text-[10px] mb-1 ${mutedCls}`}>Type / Category</label>
                              {editCustomCatMode ? (
                                <div className="flex gap-1.5">
                                  <input
                                    type="text"
                                    value={editBatchCategory}
                                    onChange={(e) => setEditBatchCategory(e.target.value)}
                                    placeholder="Type custom category"
                                    autoFocus
                                    className={`flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border ${inputCls}`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditCustomCatMode(false);
                                      if (!editBatchCategory.trim()) {
                                        setEditBatchCategory(drugCategoryOptions[0] || "Essential");
                                      }
                                    }}
                                    className={`px-2 py-1.5 rounded-lg border text-[10px] font-semibold cursor-pointer ${chipCls}`}
                                  >
                                    List
                                  </button>
                                </div>
                              ) : (
                                <select
                                  value={
                                    drugCategoryOptions.some(
                                      (c) => c.toLowerCase() === editBatchCategory.trim().toLowerCase()
                                    )
                                      ? drugCategoryOptions.find(
                                        (c) => c.toLowerCase() === editBatchCategory.trim().toLowerCase()
                                      )
                                      : "__current__"
                                  }
                                  onChange={(e) => {
                                    if (e.target.value === "__custom__") {
                                      setEditCustomCatMode(true);
                                      setEditBatchCategory("");
                                    } else {
                                      setEditBatchCategory(e.target.value);
                                    }
                                  }}
                                  className={`w-full px-2.5 py-1.5 rounded-lg border ${inputCls}`}
                                >
                                  {editBatchCategory.trim() &&
                                    !drugCategoryOptions.some(
                                      (c) => c.toLowerCase() === editBatchCategory.trim().toLowerCase()
                                    ) && <option value="__current__">{editBatchCategory}</option>}
                                  {drugCategoryOptions.map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                  <option value="__custom__">+ Custom category...</option>
                                </select>
                              )}
                            </div>
                            <div>
                              <label className={`block text-[10px] mb-1 ${mutedCls}`}>Batch Number</label>
                              <input type="text" value={editBatchNumber} onChange={(e) => setEditBatchNumber(e.target.value)} className={`w-full px-2.5 py-1.5 rounded-lg border font-mono ${inputCls}`} />
                            </div>
                            <div>
                              <label className={`block text-[10px] mb-1 ${mutedCls}`}>Quantity</label>
                              <input type="number" value={editBatchQty} onChange={(e) => setEditBatchQty(e.target.value)} className={`w-full px-2.5 py-1.5 rounded-lg border ${inputCls}`} />
                            </div>
                            <div>
                              <label className={`block text-[10px] mb-1 ${mutedCls}`}>Cost / Unit</label>
                              <input type="number" value={editBatchCost} onChange={(e) => setEditBatchCost(e.target.value)} className={`w-full px-2.5 py-1.5 rounded-lg border ${inputCls}`} />
                            </div>
                            <div>
                              <label className={`block text-[10px] mb-1 ${mutedCls}`}>Sale / Unit</label>
                              <input type="number" value={editBatchPrice} onChange={(e) => setEditBatchPrice(e.target.value)} className={`w-full px-2.5 py-1.5 rounded-lg border ${inputCls}`} />
                            </div>
                            <div>
                              <label className={`block text-[10px] mb-1 ${mutedCls}`}>Low-Stock Threshold</label>
                              <input type="number" value={editBatchThreshold} onChange={(e) => setEditBatchThreshold(e.target.value)} className={`w-full px-2.5 py-1.5 rounded-lg border ${inputCls}`} />
                            </div>
                            <div>
                              <label className={`block text-[10px] mb-1 ${mutedCls}`}>Date Entry</label>
                              <input type="date" value={editBatchDateEntered} onChange={(e) => setEditBatchDateEntered(e.target.value)} className={`w-full px-2.5 py-1.5 rounded-lg border ${inputCls}`} />
                            </div>
                            <div>
                              <label className={`block text-[10px] mb-1 ${mutedCls}`}>Expiry Date</label>
                              <input type="date" value={editBatchExpiry} onChange={(e) => setEditBatchExpiry(e.target.value)} className={`w-full px-2.5 py-1.5 rounded-lg border ${inputCls}`} />
                            </div>
                            <div className="sm:col-span-2">
                              <WebpPhotoInput
                                value={editBatchImageUrl}
                                onChange={setEditBatchImageUrl}
                                label="Product Photo (480p WebP)"
                                isDark={isDark}
                                accent={accent}
                                compact
                              />
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                              <input type="checkbox" checked={editBatchRx} onChange={(e) => setEditBatchRx(e.target.checked)} />
                              <span>Prescription Required (Rx)</span>
                            </label>
                            <button
                              type="submit"
                              disabled={invBusy}
                              className="px-4 py-2 rounded-full text-white text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                              style={{ backgroundColor: accent }}
                            >
                              {invBusyKey === "edit_batch" && (
                                <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                              )}
                              <span>{invBusyKey === "edit_batch" ? "Saving..." : "Save Product Updates"}</span>
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>,
                  document.body
                );
              })()}

              <div className="space-y-2">
                {visibleBatches.map((b) => {
                  const isExpired = b.expiryDate < todayIso;
                  const isLow = !b.quarantined && b.quantity <= (b.lowStockThreshold ?? 25);
                  return (
                    <div
                      key={b.id}
                      onClick={() => openBatchInspector(b)}
                      className={`p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 text-xs cursor-pointer hover:border-blue-400 transition-colors ${chipCls}`}
                    >
                      <div className="flex items-center gap-3">
                        {b.imageUrl ? (
                          <img src={b.imageUrl} alt={b.brandName} className="w-9 h-9 rounded-xl object-cover border border-slate-300/40 shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-[#1039B9] dark:text-[#38BDF8] font-bold flex items-center justify-center shrink-0">
                            {b.brandName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{b.brandName}</span>
                            <span className="font-mono text-[10px] opacity-70">{b.batchNumber}</span>
                            {isLow && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 text-[9px] font-bold">
                                LOW &le; {b.lowStockThreshold ?? 25}
                              </span>
                            )}
                            {isExpired && (
                              <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-500 text-[9px] font-bold">
                                EXPIRED
                              </span>
                            )}
                            {b.quarantined && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 text-[9px] font-bold">
                                QUARANTINED
                              </span>
                            )}
                          </div>
                          <div className={`text-[11px] mt-0.5 ${mutedCls}`}>
                            {b.genericName} &middot; {b.category} &middot; Exp <strong>{b.expiryDate}</strong> &middot; TZS{" "}
                            {b.salePriceTzs.toLocaleString("en-US")}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <span className="font-bold tabular-nums px-2.5 py-1 rounded-lg bg-slate-500/10">
                          {b.quantity} units
                        </span>
                        {canManageStock && (
                          <>
                            <button
                              type="button"
                              disabled={invBusy}
                              onClick={() =>
                                handleManageBatch(
                                  { subAction: "adjust_qty", batchId: b.id, quantity: b.quantity + 10 },
                                  `Added +10 units to ${b.batchNumber}`,
                                  `adj_${b.id}`
                                )
                              }
                              className={`px-2.5 py-1 rounded-full border text-[10px] font-semibold inline-flex items-center gap-1 disabled:opacity-50 cursor-pointer ${chipCls}`}
                            >
                              {invBusyKey === `adj_${b.id}` && (
                                <span className="w-2.5 h-2.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                              )}
                              <span>+10</span>
                            </button>
                            <button
                              type="button"
                              disabled={invBusy}
                              onClick={() =>
                                handleManageBatch(
                                  { subAction: "toggle_quarantine", batchId: b.id },
                                  `${b.quarantined ? "Restored" : "Quarantined"} lot ${b.batchNumber}`,
                                  `quar_${b.id}`
                                )
                              }
                              className="px-2.5 py-1 rounded-full border border-rose-300/60 text-rose-500 text-[10px] font-semibold inline-flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                            >
                              {invBusyKey === `quar_${b.id}` && (
                                <span className="w-2.5 h-2.5 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
                              )}
                              <span>{b.quarantined ? "Restore" : "Quarantine"}</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {canManageStock && (
              <div className={`lg:col-span-4 rounded-[24px] border p-6 space-y-4 ${cardCls}`}>
                <h2 className="text-sm font-semibold">Add Remote Stock Lot</h2>
                <div className="space-y-3">
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                      Medicine Brand Name *
                    </label>
                    <input
                      type="text"
                      value={newBrand}
                      onChange={(e) => setNewBrand(e.target.value)}
                      placeholder="e.g. Azithromycin 500mg"
                      className={`w-full px-3.5 py-2 rounded-xl border text-xs ${inputCls}`}
                    />
                    {restockPresets.length > 0 && (
                      <div className={`mt-1.5 rounded-xl border p-1.5 space-y-1 ${isDark ? "border-slate-700 bg-slate-900/90" : "border-slate-200 bg-slate-50"}`}>
                        <div className={`px-1.5 text-[9px] font-bold uppercase tracking-wider ${mutedCls}`}>
                          Quick Restock Autofill (click to preload)
                        </div>
                        {restockPresets.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              setNewBrand(preset.brandName);
                              setNewGeneric(preset.genericName);
                              setNewCategory(preset.category || "Essential");
                              setCustomCatMode(false);
                              setNewCostPrice(String(preset.costPriceTzs || 2500));
                              setNewPrice(String(preset.salePriceTzs || 3500));
                              setNewThreshold(String(preset.lowStockThreshold ?? 25));
                              setNewRequiresRx(Boolean(preset.requiresPrescription));
                              if (preset.imageUrl) setNewImageUrl(preset.imageUrl);
                            }}
                            className={`w-full text-left px-2 py-1.5 rounded-lg text-[11px] flex items-center justify-between gap-2 transition cursor-pointer ${isDark ? "hover:bg-slate-800" : "hover:bg-white"}`}
                          >
                            <div className="min-w-0">
                              <div className="font-semibold truncate">{preset.brandName}</div>
                              <div className={`text-[10px] truncate ${mutedCls}`}>
                                {preset.genericName} · {preset.category}
                              </div>
                            </div>
                            <span className="shrink-0 font-mono text-[10px] font-semibold" style={{ color: accent }}>
                              {formatTzs(preset.salePriceTzs)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                      Units
                    </label>
                    <input
                      type="number"
                      value={newQty}
                      onChange={(e) => setNewQty(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl border text-xs ${inputCls}`}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                        Generic Name
                      </label>
                      <input type="text" value={newGeneric} onChange={(e) => setNewGeneric(e.target.value)} placeholder="Generic e.g. Azithromycin" className={`w-full px-3 py-2 rounded-xl border text-xs ${inputCls}`} />
                    </div>
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                        Type / Category
                      </label>
                      {customCatMode ? (
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                            placeholder="Custom category..."
                            autoFocus
                            className={`flex-1 min-w-0 px-3 py-2 rounded-xl border text-xs ${inputCls}`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setCustomCatMode(false);
                              if (!newCategory.trim()) {
                                setNewCategory(drugCategoryOptions[0] || "Essential");
                              }
                            }}
                            className={`px-2.5 py-2 rounded-xl border text-[10px] font-semibold cursor-pointer ${chipCls}`}
                          >
                            List
                          </button>
                        </div>
                      ) : (
                        <select
                          value={
                            drugCategoryOptions.some(
                              (c) => c.toLowerCase() === newCategory.trim().toLowerCase()
                            )
                              ? drugCategoryOptions.find(
                                (c) => c.toLowerCase() === newCategory.trim().toLowerCase()
                              )
                              : "__current__"
                          }
                          onChange={(e) => {
                            if (e.target.value === "__custom__") {
                              setCustomCatMode(true);
                              setNewCategory("");
                            } else {
                              setNewCategory(e.target.value);
                            }
                          }}
                          className={`w-full px-3 py-2 rounded-xl border text-xs ${inputCls}`}
                        >
                          {newCategory.trim() &&
                            !drugCategoryOptions.some(
                              (c) => c.toLowerCase() === newCategory.trim().toLowerCase()
                            ) && <option value="__current__">{newCategory}</option>}
                          {drugCategoryOptions.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                          <option value="__custom__">+ Custom category...</option>
                        </select>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                        Cost / Unit
                      </label>
                      <input type="number" value={newCostPrice} onChange={(e) => setNewCostPrice(e.target.value)} className={`w-full px-3 py-2 rounded-xl border text-xs ${inputCls}`} />
                    </div>
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                        Sale TZS
                      </label>
                      <input
                        type="number"
                        value={newPrice}
                        onChange={(e) => setNewPrice(e.target.value)}
                        className={`w-full px-3 py-2 rounded-xl border text-xs ${inputCls}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                        Min Threshold
                      </label>
                      <input type="number" value={newThreshold} onChange={(e) => setNewThreshold(e.target.value)} className={`w-full px-3 py-2 rounded-xl border text-xs ${inputCls}`} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                        Date Entry
                      </label>
                      <input type="date" value={newDateEntered} onChange={(e) => setNewDateEntered(e.target.value)} className={`w-full px-3 py-2 rounded-xl border text-xs ${inputCls}`} />
                    </div>
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                        Expiry Date
                      </label>
                      <input
                        type="date"
                        value={newExpiry}
                        onChange={(e) => setNewExpiry(e.target.value)}
                        className={`w-full px-3 py-2 rounded-xl border text-xs ${inputCls}`}
                      />
                    </div>
                  </div>
                  <WebpPhotoInput
                    value={newImageUrl}
                    onChange={setNewImageUrl}
                    label="Product Photo (Camera / 480p WebP)"
                    isDark={isDark}
                    accent={accent}
                  />
                  <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={newRequiresRx} onChange={(e) => setNewRequiresRx(e.target.checked)} />
                    <span>Requires Prescription (Rx)</span>
                  </label>
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                      GS1 Scan (Optional)
                    </label>
                    <input
                      type="text"
                      value={newLotGs1}
                      onChange={(e) => setNewLotGs1(e.target.value)}
                      placeholder="(01)...(17)271231(10)LOT99"
                      className={`w-full px-3 py-2 rounded-xl border font-mono text-[11px] ${inputCls}`}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={invBusy || !newBrand.trim()}
                    onClick={async () => {
                      const cleanCat = newCategory.trim() || "Essential";
                      await handleManageBatch(
                        {
                          subAction: "add_batch",
                          brandName: newBrand,
                          genericName: newGeneric.trim() || newBrand,
                          category: cleanCat,
                          quantity: Number(newQty) || 20,
                          costPriceTzs: Number(newCostPrice) || 2500,
                          salePriceTzs: Number(newPrice) || 3500,
                          lowStockThreshold: Number(newThreshold) || 25,
                          dateEntered: newDateEntered,
                          imageUrl: newImageUrl.trim() || undefined,
                          requiresPrescription: newRequiresRx,
                          expiryDate: newExpiry,
                          gs1Barcode: newLotGs1,
                        },
                        `Added remote stock batch for ${newBrand}`,
                        "add_batch"
                      );
                      setNewBrand("");
                      setNewGeneric("");
                      setCustomCatMode(false);
                      setNewImageUrl("");
                      setNewLotGs1("");
                    }}
                    className="w-full py-2.5 rounded-full text-white text-xs font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-45 cursor-pointer"
                    style={{ backgroundColor: accent }}
                  >
                    {invBusyKey === "add_batch" && (
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    )}
                    <span>{invBusyKey === "add_batch" ? "Adding Stock Lot..." : "+ Add Stock Lot"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB: REMOTE OPERATOR PROFILE EDITING & PERMITS (Owners)          */}
      {/* ================================================================ */}
      {tab === "team" && (
        <div className="space-y-4 animate-stage-pop">
          {teamNotice && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-600">
              {teamNotice}
            </div>
          )}

          {renderPendingRequestsSection()}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            <div className={`lg:col-span-7 rounded-[24px] border p-6 space-y-4 ${cardCls}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">Operators &amp; Permissions ({profiles.length})</h2>
                  <p className={`text-[11px] ${mutedCls}`}>
                    Owners can remotely update operator roles, reassign branches, or rotate unlock PINs.
                  </p>
                </div>
                <Link
                  href="/app/settings?tab=org#staff"
                  className="text-xs font-semibold hover:underline"
                  style={{ color: accent }}
                >
                  Full Org Settings &rarr;
                </Link>
              </div>

              <div className="space-y-2.5">
                {visibleProfiles.length === 0 ? (
                  <div className={`p-4 rounded-2xl border text-xs text-center ${chipCls} ${mutedCls}`}>
                    {isSw ? "Hakuna mfanyakazi anayelingana na utafutaji." : `No staff profile matches "${q}".`}
                  </div>
                ) : visibleProfiles.map((p) => {
                  const br = centres.find((c) => c.id === p.centreId);
                  return (
                    <div
                      key={p.id}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs ${chipCls}`}
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{p.displayName}</span>
                          {p.username && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-[#1039B9] dark:text-[#38BDF8] font-mono text-[10px] font-bold">
                              @{p.username}
                            </span>
                          )}
                        </div>
                        <div className={`text-[11px] ${mutedCls}`}>
                          {p.role.replace(/_/g, " ")} &middot; {br?.name || "Primary Branch"}
                        </div>
                      </div>
                      {canManageAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProfileId(p.id);
                            setEditName(p.displayName);
                            setEditUsername(p.username || "");
                            setEditRole(p.role);
                            setEditCentreId(p.centreId);
                            setEditCaps(
                              clampProfileCapabilities(
                                (p.role as WorkspaceProfileRole) || "pos_cashier",
                                p.capabilities,
                                p.isMasterAdmin
                              )
                            );
                            setEditPin("");
                          }}
                          className={`px-3 py-1.5 rounded-full border text-[11px] font-semibold cursor-pointer ${chipCls}`}
                        >
                          Edit Profile
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {canManageAdmin && editingProfileId ? (
              <form onSubmit={handleSaveOperatorEdit} className={`lg:col-span-5 rounded-[24px] border p-6 space-y-4 ${cardCls}`}>
                <h2 className="text-sm font-semibold">Edit Operator Remotely</h2>
                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                    Display Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-xs ${inputCls}`}
                  />
                </div>
                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                    Direct Login Handle (@username)
                  </label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                    placeholder="baraka.mwenge"
                    className={`w-full px-3 py-2 rounded-xl border font-mono text-xs ${inputCls}`}
                  />
                </div>
                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                    Role &amp; Access Level
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-xs ${inputCls}`}
                  >
                    <option value="superintendent_pharmacist">Superintendent Pharmacist</option>
                    <option value="pos_cashier">Counter Cashier</option>
                    <option value="pharmacy_owner">Branch Admin / Owner</option>
                    <option value="warehouse_dispatcher">Warehouse Dispatcher</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                    Assigned Branch
                  </label>
                  <select
                    value={editCentreId}
                    onChange={(e) => setEditCentreId(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-xs ${inputCls}`}
                  >
                    {centres.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                    Reset PIN (Optional, 4-6 digits)
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={editPin}
                    onChange={(e) => setEditPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="Leave blank to keep unchanged"
                    className={`w-full px-3 py-2 rounded-xl border text-xs ${inputCls}`}
                  />
                </div>

                {/* Immutable Role Guardrails + Toggleable Capabilities */}
                {(() => {
                  const rKey = (editRole as WorkspaceProfileRole) in ROLE_PERMISSION_RULES
                    ? (editRole as WorkspaceProfileRole)
                    : "pos_cashier";
                  const rule = ROLE_PERMISSION_RULES[rKey];
                  return (
                    <div className={`p-3.5 rounded-2xl border space-y-2.5 text-xs ${chipCls}`}>
                      <div>
                        <div className="font-bold text-[11px] uppercase tracking-wider" style={{ color: accent }}>
                          {isSw ? "Vibali vya Mfanyakazi & Sheria Zisizobadilika" : "Access Checkboxes & Immutable Role Rules"}
                        </div>
                        <p className={`text-[10px] mt-0.5 ${mutedCls}`}>
                          {isSw ? rule.swRuleNote : rule.ruleNote}
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        {PERMISSION_METADATA.map((pm) => {
                          const lockedOn = rule.immutableTrue.includes(pm.key);
                          const lockedOff = rule.immutableFalse.includes(pm.key);
                          const checked = lockedOn ? true : lockedOff ? false : Boolean(editCaps[pm.key]);
                          return (
                            <label key={pm.key} className="flex items-start justify-between gap-2 p-2 rounded-xl border border-slate-500/15 cursor-pointer">
                              <span className="flex items-start gap-2">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={lockedOn || lockedOff}
                                  onChange={(e) => setEditCaps((prev) => ({ ...prev, [pm.key]: e.target.checked }))}
                                  className="mt-0.5"
                                />
                                <span>
                                  <span className="font-semibold block">{isSw ? pm.swLabel : pm.label}</span>
                                  <span className={`text-[10px] ${mutedCls}`}>{isSw ? pm.swDesc : pm.desc}</span>
                                </span>
                              </span>
                              {(lockedOn || lockedOff) && (
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${lockedOn ? "bg-emerald-500/15 text-emerald-500" : "bg-slate-500/15 text-slate-500"
                                    }`}
                                >
                                  {lockedOn ? "Rule ON" : "Rule OFF"}
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={opEditBusy}
                    className="flex-1 py-2.5 rounded-full text-white text-xs font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    style={{ backgroundColor: accent }}
                  >
                    {opEditBusy && (
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    )}
                    <span>{opEditBusy ? "Saving..." : "Save Operator Changes"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingProfileId(null)}
                    className={`px-4 py-2.5 rounded-full border text-xs font-semibold cursor-pointer ${chipCls}`}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className={`lg:col-span-5 rounded-[24px] border p-6 space-y-4 ${cardCls}`}>
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold">Permits &amp; Compliance</h2>
                  <p className={`text-xs ${mutedCls}`}>
                    {account.networkUnlocked
                      ? "Operating permit verified. Full wholesale ordering & multi-branch oversight active."
                      : "Permits skipped during setup. Upload your license in Organization Settings whenever ready."}
                  </p>
                  <Link
                    href="/app/settings?tab=org#certificates"
                    className="inline-block px-4 py-2 rounded-full text-white text-xs font-semibold"
                    style={{ backgroundColor: accent }}
                  >
                    Manage Permits &amp; Add Staff &rarr;
                  </Link>
                </div>

                <div className="pt-3 border-t border-slate-500/15 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-semibold">
                      {isSw ? `Saa za Zamu za Wafanyakazi (${shiftLogs.length})` : `Staff Shift Clock-In Hours (${shiftLogs.length})`}
                    </div>
                    <button
                      type="button"
                      disabled={shiftBusy}
                      onClick={() => handleShiftClock(activeShift ? "out" : "in")}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 ${activeShift ? "bg-amber-500/15 text-amber-600" : "bg-emerald-500/15 text-emerald-600"
                        }`}
                    >
                      {shiftBusy && (
                        <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      )}
                      <span>
                        {shiftBusy
                          ? (isSw ? "Inarekodi..." : "Updating...")
                          : activeShift
                            ? isSw ? `Funga Zamu (In ${activeShift.clockInAt.slice(11, 16)})` : `Clock Out (In ${activeShift.clockInAt.slice(11, 16)})`
                            : isSw ? "+ Anza Zamu (Clock In)" : "+ Clock In Shift"}
                      </span>
                    </button>
                  </div>
                  {shiftResultMsg && (
                    <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] font-medium">
                      {shiftResultMsg}
                    </div>
                  )}
                  {shiftLogs.length === 0 ? (
                    <p className={`text-[11px] ${mutedCls}`}>
                      {isSw ? "Hakuna zamu zilizorekodiwa bado." : "Staff can clock in directly from the Counter POS tab."}
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {shiftLogs.slice(0, 6).map((sh) => (
                        <div key={sh.id} className={`p-2.5 rounded-xl border text-[11px] flex items-center justify-between gap-2 ${chipCls}`}>
                          <div>
                            <div className="font-semibold">{sh.staffName}</div>
                            <div className={mutedCls}>In {sh.clockInAt.slice(11, 16)} {sh.clockOutAt ? `-> Out ${sh.clockOutAt.slice(11, 16)}` : "(On Duty)"}</div>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sh.clockOutAt ? "bg-slate-500/15" : "bg-emerald-500/15 text-emerald-500"}`}>
                            {sh.clockOutAt ? `${sh.durationMinutes ?? 1}m` : "Live"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB: COUNTER POS + SHIFT CASH RECONCILIATION (ONLY POS)          */}
      {/* ================================================================ */}
      {tab === "operations" && (
        <div className="space-y-4 animate-stage-pop">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            <div className={`lg:col-span-7 rounded-[24px] border p-6 space-y-4 ${cardCls}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">{isSw ? "Rafu ya Dawa za Kaunta" : "Dispensary Shelf"}</h2>
                  <p className={`text-[11px] ${mutedCls}`}>
                    {isSw
                      ? `Dawa za kuisha mapema huuzwa kwanza. Zilizokwisha muda (${stockAlerts.expiredCount}) huzuiliwa.`
                      : `Earliest valid expiry dispatches first. Expired lots (${stockAlerts.expiredCount}) are blocked automatically.`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => openReport("sales")}
                    className={`text-xs font-semibold hover:underline cursor-pointer ${mutedCls}`}
                  >
                    Sales Report
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("inventory")}
                    className="text-xs font-semibold hover:underline cursor-pointer"
                    style={{ color: accent }}
                  >
                    Edit Batches &rarr;
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("receipts")}
                    className={`px-3 py-1 rounded-full border text-[11px] font-semibold cursor-pointer ${chipCls}`}
                  >
                    {isSw ? `Risiti (${sales.length})` : `Receipts Vault (${sales.length})`} &rarr;
                  </button>
                  <Link
                    href="/app/settings?tab=hardware"
                    className={`px-3 py-1 rounded-full border text-[11px] font-semibold cursor-pointer inline-flex items-center gap-1 hover:border-slate-400 transition-colors ${chipCls}`}
                  >
                    <span>{isSw ? "Mipangilio ya POS" : "POS Settings"}</span>
                    <span>&rarr;</span>
                  </Link>
                </div>
              </div>

              {savedCustomers.length > 0 && (
                <div className={`p-3 rounded-2xl border space-y-2 ${chipCls}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-bold">
                      {isSw ? "Wateja wa Kudumu (Bonyeza Kujaza Kikapu)" : "Saved Repeat Customers (1-Tap Order Load)"}
                    </span>
                    <input
                      type="search"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder={isSw ? "Tafuta jina la mteja..." : "Search patient name..."}
                      className={`px-3 py-1 rounded-full border text-[11px] focus:outline-none ${inputCls}`}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {savedCustomers
                      .filter(
                        (c) =>
                          !customerSearch.trim() ||
                          c.customerName.toLowerCase().includes(customerSearch.toLowerCase()) ||
                          (c.phone || "").includes(customerSearch)
                      )
                      .map((cust) => (
                        <button
                          key={cust.id}
                          type="button"
                          onClick={() => {
                            const nextCart: Record<string, number> = { ...cart };
                            for (const it of cust.items) {
                              const prod = productsSummary.find((p) => p.productId === it.productId);
                              if (prod && prod.validQty > 0) {
                                nextCart[it.productId] = Math.min(prod.validQty, (nextCart[it.productId] || 0) + it.qty);
                              }
                            }
                            setCart(nextCart);
                            setPosCustomerName(cust.customerName);
                            setPosCustomerPhone(cust.phone || "");
                          }}
                          className={`px-3 py-1.5 rounded-full border text-[11px] font-semibold cursor-pointer hover:border-blue-400 transition-colors ${cardCls}`}
                        >
                          {cust.customerName} &middot; {cust.items.map((i) => `${i.brandName} x${i.qty}`).join(", ")}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Dedicated POS Search + QR / Barcode Scanner Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-6 relative">
                  <input
                    type="search"
                    value={posSearch}
                    onChange={(e) => setPosSearch(e.target.value)}
                    placeholder={isSw ? "Tafuta dawa, jenarik au batch..." : "Search brand, generic, or lot..."}
                    className={`w-full px-3.5 py-2 rounded-xl border text-xs focus:outline-none ${inputCls}`}
                  />
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    processScannedCode(scanCode);
                  }}
                  className="sm:col-span-6 flex gap-1.5"
                >
                  <input
                    type="text"
                    value={scanCode}
                    onChange={(e) => setScanCode(e.target.value)}
                    placeholder="Scan GS1 QR / Barcode + Enter"
                    className={`flex-1 min-w-0 px-3 py-2 rounded-xl border font-mono text-[11px] focus:outline-none ${inputCls}`}
                  />
                  <button
                    type="button"
                    onClick={() => setScannerOpen((v) => !v)}
                    title="Open Camera QR / Barcode Scanner"
                    className={`px-3 py-2 rounded-xl border text-[11px] font-semibold shrink-0 cursor-pointer ${scannerOpen ? "text-white border-transparent" : chipCls
                      }`}
                    style={scannerOpen ? { backgroundColor: accent } : undefined}
                  >
                    {scannerOpen ? "Close Cam" : "QR / Cam"}
                  </button>
                </form>
              </div>

              {/* Inline Camera QR & Barcode Scanner */}
              {scannerOpen && (
                <div className={`rounded-2xl border p-4 space-y-3 ${chipCls}`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold">Live GS1 QR &amp; Barcode Scanner</span>
                    <button
                      type="button"
                      onClick={() => setScannerOpen(false)}
                      className="text-xs font-semibold opacity-70 hover:opacity-100 cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                  <div className="relative rounded-xl overflow-hidden bg-slate-950 aspect-video max-h-48 flex items-center justify-center">
                    <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
                    <div
                      aria-hidden="true"
                      className="absolute inset-6 border-2 border-dashed rounded-xl pointer-events-none"
                      style={{ borderColor: accent }}
                    />
                  </div>
                  {cameraError && <p className="text-[11px] text-amber-500 font-medium">{cameraError}</p>}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className={`text-[10px] uppercase font-bold ${mutedCls}`}>Quick Test Scans:</span>
                    {batches
                      .filter((b) => !b.quarantined && b.quantity > 0 && b.expiryDate >= todayIso)
                      .slice(0, 3)
                      .map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() =>
                            processScannedCode(`(01)06291041500${b.productId.replace(/\D/g, "").padStart(3, "0")}(17)271231(10)${b.batchNumber}`)
                          }
                          className={`px-2.5 py-1 rounded-full border text-[10px] font-mono cursor-pointer ${chipCls}`}
                        >
                          {b.brandName} ({b.batchNumber})
                        </button>
                      ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {visiblePosProducts.length === 0 ? (
                  <div className={`p-6 rounded-2xl border text-center text-xs ${chipCls} ${mutedCls}`}>
                    No active medicine lots matched "{posSearch || searchQuery}".
                  </div>
                ) : (
                  visiblePosProducts.map((prod) => {
                    const qtyInCart = cart[prod.productId] || 0;
                    return (
                      <div key={prod.productId} className={`p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 text-xs ${chipCls}`}>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{prod.brandName}</span>
                            <span className={`text-[11px] ${mutedCls}`}>({prod.genericName})</span>
                            {prod.requiresPrescription && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-[#1039B9] dark:text-[#38BDF8] text-[9px] font-bold">
                                Rx Required
                              </span>
                            )}
                          </div>
                          <div className={`text-[11px] mt-0.5 ${mutedCls}`}>
                            Stock: <strong>{prod.validQty}</strong> valid &middot; Lot {prod.earliestBatch || "None"} (Exp{" "}
                            {prod.earliestExpiry || "-"})
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="font-semibold tabular-nums">TZS {prod.salePriceTzs.toLocaleString("en-US")}</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => adjustCart(prod.productId, -1)}
                              disabled={qtyInCart === 0}
                              className={`w-7 h-7 rounded-full border text-xs font-bold disabled:opacity-40 cursor-pointer ${chipCls}`}
                            >
                              -
                            </button>
                            <span className="w-6 text-center font-bold tabular-nums">{qtyInCart}</span>
                            <button
                              type="button"
                              onClick={() => adjustCart(prod.productId, 1)}
                              disabled={qtyInCart >= prod.validQty}
                              className="w-7 h-7 rounded-full text-white text-xs font-bold disabled:opacity-40 cursor-pointer"
                              style={{ backgroundColor: accent }}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="lg:col-span-5 space-y-4">
              <div className={`rounded-[24px] border p-6 space-y-4 ${cardCls}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Active Basket</span>
                  <span className="text-2xl font-normal tabular-nums" style={{ fontFamily: "Outfit, Inter, sans-serif", color: accent }}>
                    TZS {cartTotalTzs.toLocaleString("en-US")}
                  </span>
                </div>

                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1.5 ${mutedCls}`}>
                    Payment Channel
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                    {(
                      [
                        { id: "mpesa", label: "M-Pesa" },
                        { id: "tigo", label: "Mixx/Tigo" },
                        { id: "airtel", label: "Airtel" },
                        { id: "halopesa", label: "Halopesa" },
                        { id: "cash", label: "Cash" },
                        { id: "card", label: "Card" },
                        { id: "bank", label: "Bank" },
                      ] as const
                    ).map((pm) => (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setPaymentMethod(pm.id)}
                        className={`py-2 rounded-xl border text-[11px] font-semibold cursor-pointer ${paymentMethod === pm.id ? "text-white border-transparent" : chipCls
                          }`}
                        style={paymentMethod === pm.id ? { backgroundColor: accent } : undefined}
                      >
                        {pm.label}
                      </button>
                    ))}
                  </div>
                </div>

                {cartRequiresRx && (
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                      Prescription Ref / Claim Token *
                    </label>
                    <input
                      type="text"
                      value={prescriptionRef}
                      onChange={(e) => setPrescriptionRef(e.target.value)}
                      placeholder="e.g. RX-DSM-2026-41"
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none ${inputCls}`}
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={posCustomerName}
                    onChange={(e) => setPosCustomerName(e.target.value)}
                    placeholder={isSw ? "Jina la Mteja (hiari)" : "Customer Name (optional)"}
                    className={`px-3 py-2 rounded-xl border text-xs ${inputCls}`}
                  />
                  <input
                    type="tel"
                    value={posCustomerPhone}
                    onChange={(e) => setPosCustomerPhone(e.target.value)}
                    placeholder="+255 7xx xxx xxx"
                    className={`px-3 py-2 rounded-xl border text-xs ${inputCls}`}
                  />
                </div>

                <label className="inline-flex items-center gap-2 text-[11px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveAsPreset}
                    onChange={(e) => setSaveAsPreset(e.target.checked)}
                  />
                  <span>{isSw ? "Hifadhi agizo hili kwa mteja wa kudumu" : "Save customer & basket for quick repeat orders"}</span>
                </label>

                {posMsg && (
                  <div
                    className={`p-3 rounded-2xl border text-xs font-medium flex items-start gap-2 ${posMsg.ok
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
                      : "bg-rose-500/10 border-rose-500/30 text-rose-500"
                      }`}
                  >
                    {posMsg.ok && <IconCheck className="w-4 h-4 shrink-0 mt-0.5" />}
                    <span>{posMsg.text}</span>
                  </div>
                )}

                {printingAnim && (
                  <div className="p-4 rounded-2xl border border-emerald-500/35 bg-emerald-500/10 text-center space-y-2 animate-stage-pop">
                    <div className="mx-auto w-28 h-1.5 rounded-full bg-slate-700/40 overflow-hidden">
                      <div className="h-full bg-emerald-500 w-2/3 animate-pulse" />
                    </div>
                    <div className="text-xs font-bold text-emerald-600 dark:text-emerald-300">
                      {isSw ? "Inachapisha Risiti..." : "Printing Thermal Receipt & Saving Vault..."}
                    </div>
                  </div>
                )}

                {latestPrintedReceipt && !printingAnim && (
                  <div className={`p-3 rounded-2xl border flex items-center justify-between gap-2 text-xs ${chipCls}`}>
                    <div>
                      <div className="font-bold">
                        {latestPrintedReceipt.receiptNumber || "RCP"} &middot; TZS {latestPrintedReceipt.totalTzs.toLocaleString("en-US")}
                      </div>
                      <div className={`text-[10px] ${mutedCls}`}>{latestPrintedReceipt.customerName || "Walk-in"}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => printSaleReceipt(latestPrintedReceipt)}
                      className="px-3 py-1.5 rounded-full text-white text-[11px] font-semibold cursor-pointer"
                      style={{ backgroundColor: accent }}
                    >
                      Print Receipt
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  disabled={posBusy || cartEntries.length === 0}
                  onClick={() => setCheckoutPreviewOpen(true)}
                  className="w-full py-3 rounded-full text-white text-xs font-semibold disabled:opacity-45 cursor-pointer min-h-[44px]"
                  style={{ backgroundColor: accent }}
                >
                  {posBusy
                    ? isSw ? "Inakamilisha Mauzo..." : "Completing Sale..."
                    : isSw ? "Kagua & Uza ->" : "Review & Sell ->"}
                </button>
              </div>

              <div className={`rounded-[24px] border p-6 space-y-3.5 ${cardCls}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">
                      {isSw ? "Zamu & Kufunga Droo" : "Shift Clock-In & Cash Drawer"}
                    </h3>
                    <p className={`text-[11px] ${mutedCls}`}>
                      Cash Sales: <strong>TZS {cashSalesTzs.toLocaleString("en-US")}</strong> &middot; Mobile:{" "}
                      <strong>TZS {mobileSalesTzs.toLocaleString("en-US")}</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={shiftBusy}
                    onClick={() => handleShiftClock(activeShift ? "out" : "in")}
                    className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 ${activeShift ? "bg-amber-500/15 text-amber-600" : "bg-emerald-500/15 text-emerald-600"
                      }`}
                  >
                    {shiftBusy && (
                      <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    )}
                    <span>
                      {shiftBusy
                        ? isSw ? "Inarekodi..." : "Updating..."
                        : activeShift
                          ? isSw ? `Funga Zamu (In ${activeShift.clockInAt.slice(11, 16)})` : `Clock Out (In ${activeShift.clockInAt.slice(11, 16)})`
                          : isSw ? "+ Anza Zamu (Clock In)" : "+ Clock In Shift"}
                    </span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    value={openingCash}
                    onChange={(e) => setOpeningCash(e.target.value)}
                    placeholder="Opening Float"
                    className={`w-full px-3 py-2 rounded-xl border text-xs ${inputCls}`}
                  />
                  <input
                    type="number"
                    value={declaredCash}
                    onChange={(e) => setDeclaredCash(e.target.value)}
                    placeholder={String((Number(openingCash) || 0) + cashSalesTzs)}
                    className={`w-full px-3 py-2 rounded-xl border text-xs ${inputCls}`}
                  />
                </div>
                {shiftResultMsg && (
                  <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] font-medium">
                    {shiftResultMsg}
                  </div>
                )}
                <button
                  type="button"
                  disabled={reconcileBusy}
                  onClick={submitShiftClose}
                  className={`w-full py-2 rounded-full border text-xs font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer ${chipCls}`}
                >
                  {reconcileBusy && (
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  )}
                  <span>{reconcileBusy ? "Reconciling..." : "Reconcile & Log Shift Drawer"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* POS Sale Summary & Receipt Review Dialog (Portaled to viewport center) */}
          {checkoutPreviewOpen &&
            typeof document !== "undefined" &&
            createPortal(
              <div
                role="dialog"
                aria-modal="true"
                aria-label={isSw ? "Uhakiki wa Mauzo na Risiti" : "Sale Summary & Receipt Review"}
                className="fixed inset-0 z-[120] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4"
                onClick={() => setCheckoutPreviewOpen(false)}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[28px] border p-6 sm:p-7 shadow-2xl animate-stage-pop ${cardCls}`}
                >
                  <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-500/15">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>
                        {isSw ? "UHAKIKI WA MAUZO & RISITI" : "SALE SUMMARY & RECEIPT REVIEW"}
                      </div>
                      <h2 className="text-xl font-bold mt-0.5">
                        {posCustomerName.trim() ? `${posCustomerName.trim()} - ` : ""}
                        TZS {cartTotalTzs.toLocaleString("en-US")}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCheckoutPreviewOpen(false)}
                      className={`px-3 py-1 rounded-full border text-xs font-semibold cursor-pointer ${chipCls}`}
                    >
                      Back &times;
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-5">
                    <div className="lg:col-span-8 space-y-3">
                      <div className={`p-4 rounded-2xl border space-y-2.5 text-xs ${chipCls}`}>
                        <div className="flex items-center justify-between font-bold text-[11px] uppercase opacity-75">
                          <span>Medicine &amp; Batch</span>
                          <span>Qty &times; Price = Subtotal</span>
                        </div>
                        {cartEntries.map(([productId, qty]) => {
                          const p = productsSummary.find((item) => item.productId === productId);
                          if (!p) return null;
                          return (
                            <div key={productId} className="flex items-center justify-between py-2 border-b border-slate-500/10">
                              <div>
                                <div className="font-bold">{p.brandName} ({p.genericName})</div>
                                <div className={`text-[10px] font-mono ${mutedCls}`}>
                                  Batch: {p.earliestBatch || "AUTO"} &middot; Exp {p.earliestExpiry || "-"}
                                </div>
                              </div>
                              <div className="text-right font-semibold tabular-nums">
                                {qty} &times; {p.salePriceTzs.toLocaleString("en-US")} ={" "}
                                <span className="font-bold">TZS {(qty * p.salePriceTzs).toLocaleString("en-US")}</span>
                              </div>
                            </div>
                          );
                        })}
                        <div className="flex items-center justify-between pt-2 text-sm font-bold">
                          <span>{isSw ? "Jumla Kuu" : "Total Payable"}</span>
                          <span style={{ color: accent }}>TZS {cartTotalTzs.toLocaleString("en-US")}</span>
                        </div>
                      </div>

                      <div className={`p-3.5 rounded-2xl border text-[11px] flex flex-wrap items-center justify-between gap-2 ${chipCls}`}>
                        <span>
                          <strong>{isSw ? "Mteja:" : "Customer:"}</strong> {posCustomerName || "Walk-in"}{" "}
                          {posCustomerPhone ? `(${posCustomerPhone})` : ""}
                        </span>
                        <span>
                          <strong>{isSw ? "Mhudumu:" : "Cashier:"}</strong> {activeProfileName || "Staff"}
                        </span>
                      </div>
                    </div>

                    <div className="lg:col-span-4 space-y-4">
                      <div className={`p-4 rounded-2xl border space-y-3 text-xs ${chipCls}`}>
                        <div className="font-bold uppercase text-[10px] tracking-wider opacity-75">
                          {isSw ? "Chagua Njia ya Malipo" : "Select Payment Means"}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                          {(
                            [
                              { id: "mpesa", label: "M-Pesa" },
                              { id: "tigo", label: "Mixx / Tigo" },
                              { id: "airtel", label: "Airtel Money" },
                              { id: "halopesa", label: "Halopesa" },
                              { id: "cash", label: "Cash" },
                              { id: "card", label: "Card" },
                              { id: "bank", label: "Bank Transfer" },
                            ] as const
                          ).map((pm) => (
                            <button
                              key={pm.id}
                              type="button"
                              onClick={() => setPaymentMethod(pm.id)}
                              className={`py-2.5 px-2 rounded-xl border text-[11px] font-bold cursor-pointer min-h-[40px] ${paymentMethod === pm.id ? "text-white border-transparent" : cardCls
                                }`}
                              style={paymentMethod === pm.id ? { backgroundColor: accent } : undefined}
                            >
                              {pm.label}
                            </button>
                          ))}
                        </div>

                        <div className={`p-3 rounded-xl border text-[10px] space-y-1.5 ${cardCls}`}>
                          <div className="font-bold flex items-center justify-between gap-2">
                            <span>
                              {hwConfig.printerTransport === "web_serial" ||
                                hwConfig.printerTransport === "web_usb" ||
                                hwConfig.printerTransport === "bluetooth"
                                ? `${hwConfig.printerName} (${hwConfig.paperWidthMm}mm)`
                                : `OS System Print Dialog (${hwConfig.paperWidthMm}mm)`}
                            </span>
                            <span
                              className={
                                hwConfig.printerTransport === "system_print"
                                  ? "text-amber-500"
                                  : hwConfig.printerTransport === "none"
                                    ? "text-rose-500"
                                    : "text-emerald-500"
                              }
                            >
                              {hwConfig.printerTransport === "system_print"
                                ? "NO USB/BT PAIRED"
                                : hwConfig.printerTransport === "none"
                                  ? "NOT CONFIGURED"
                                  : "CONNECTED"}
                            </span>
                          </div>
                          <div className={mutedCls}>
                            Scanner: {hwConfig.scannerName}
                          </div>
                          <Link
                            href="/app/settings?tab=hardware"
                            onClick={() => setCheckoutPreviewOpen(false)}
                            className="inline-block text-[10px] font-semibold underline cursor-pointer"
                            style={{ color: accent }}
                          >
                            {isSw ? "Mipangilio ya Printa & Skana ->" : "Printer & Scanner Settings ->"}
                          </Link>
                        </div>
                      </div>

                      <button
                        type="button"
                        autoFocus
                        disabled={posBusy}
                        onClick={submitFefoDispense}
                        className="w-full py-3.5 rounded-full text-white text-xs font-bold cursor-pointer min-h-[46px] shadow-lg"
                        style={{ backgroundColor: accent }}
                      >
                        {posBusy
                          ? isSw ? "Inakamilisha..." : "Processing & Printing..."
                          : isSw ? "Thibitisha & Chapisha Risiti ->" : "Confirm Sale & Print Receipt ->"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>,
              document.body
            )}
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB: DEDICATED IMMUTABLE RECEIPTS VAULT (NON-DELETABLE)          */}
      {/* ================================================================ */}
      {tab === "receipts" && (
        <div className="space-y-4 animate-stage-pop">
          <div className={`rounded-[24px] border p-6 space-y-4 ${cardCls}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">
                    {isSw ? `Kumbukumbu ya Risiti (${visibleReceipts.length})` : `Immutable Station Receipts (${visibleReceipts.length})`}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 text-[10px] font-bold">
                    Non-Deletable
                  </span>
                </div>
                <p className={`text-[11px] ${mutedCls}`}>
                  {isSw
                    ? "Tafuta kwa namba ya risiti, jina la mteja, au dawa. Bonyeza risiti kuchapisha tena."
                    : "Search by receipt number, customer name, medicine, or cashier. Click any card to inspect or reprint."}
                </p>
              </div>
              <input
                type="search"
                value={receiptSearch}
                onChange={(e) => setReceiptSearch(e.target.value)}
                placeholder={isSw ? "Tafuta risiti au mteja..." : "Search receipt #, customer name, drug..."}
                className={`w-full sm:w-72 px-4 py-2 rounded-full border text-xs focus:outline-none ${inputCls}`}
              />
            </div>

            {focusedReceipt && typeof document !== "undefined" && createPortal(
              <div
                role="dialog"
                aria-modal="true"
                aria-label={focusedReceipt.receiptNumber || "Receipt"}
                className="fixed inset-0 z-[125] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
                onClick={() => setFocusedReceipt(null)}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  className={`w-full max-w-xl max-h-[88vh] overflow-y-auto p-6 rounded-[26px] border space-y-3 ring-2 shadow-2xl animate-stage-pop ${cardCls}`}
                  style={{ borderColor: accent }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>
                        {isSw ? "RISITI HALISI (HAIWEZI KUFUTWA)" : "OFFICIAL IMMUTABLE RECEIPT FOCUS CARD"}
                      </div>
                      <h3 className="text-base font-bold">
                        {focusedReceipt.receiptNumber || `RCP-${focusedReceipt.id.slice(-6).toUpperCase()}`} &middot;{" "}
                        {focusedReceipt.customerName || (isSw ? "Mteja wa Kaunta" : "Walk-in Patient")}
                      </h3>
                      <div className={`text-[11px] ${mutedCls}`}>
                        {focusedReceipt.createdAt.slice(0, 16).replace("T", " ")} &middot; Cashier: {focusedReceipt.actorName} &middot;{" "}
                        {focusedReceipt.paymentMethod.toUpperCase()}
                        {focusedReceipt.prescriptionRef ? ` · Rx ${focusedReceipt.prescriptionRef}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => printSaleReceipt(focusedReceipt)}
                        className="px-4 py-1.5 rounded-full text-white text-xs font-semibold cursor-pointer"
                        style={{ backgroundColor: accent }}
                      >
                        {isSw ? "Chapisha Risiti" : "Reprint Thermal / PDF"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setFocusedReceipt(null)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer ${cardCls}`}
                      >
                        Close &times;
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    {(focusedReceipt.lines ?? []).map((ln, idx) => (
                      <div key={`${ln.productId}-${idx}`} className={`p-2.5 rounded-xl border flex justify-between ${chipCls}`}>
                        <span>
                          <strong>{ln.brandName}</strong> &times; {ln.qty}{" "}
                          <span className={`font-mono text-[10px] ${mutedCls}`}>(Batch {ln.batchNumber || "Auto"})</span>
                        </span>
                        <span className="font-bold tabular-nums">
                          TZS {(ln.qty * ln.unitPriceTzs).toLocaleString("en-US")}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-2 text-sm font-bold">
                      <span>Total Paid ({focusedReceipt.itemCount} packs)</span>
                      <span style={{ color: accent }}>TZS {focusedReceipt.totalTzs.toLocaleString("en-US")}</span>
                    </div>
                  </div>
                </div>
              </div>,
              document.body
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {visibleReceipts.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setFocusedReceipt(s)}
                  className={`p-4 rounded-2xl border text-left flex items-center justify-between gap-3 text-xs cursor-pointer hover:border-blue-400 transition-colors ${chipCls}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-[11px]" style={{ color: accent }}>
                        {s.receiptNumber || `RCP-${s.id.slice(-6).toUpperCase()}`}
                      </span>
                      <span className="font-bold truncate">{s.customerName || (isSw ? "Mteja wa Kaunta" : "Walk-in Patient")}</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-500/10 text-[9px] font-bold uppercase">
                        {s.paymentMethod}
                      </span>
                    </div>
                    <div className={`text-[11px] mt-0.5 truncate ${mutedCls}`}>
                      {s.itemCount} items &middot; {s.actorName} &middot; {s.createdAt.slice(0, 16).replace("T", " ")}
                    </div>
                  </div>
                  <span className="font-bold tabular-nums shrink-0">
                    TZS {s.totalTzs.toLocaleString("en-US")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB: WHOLESALE & KASRI ESCROW (WITH CALM OPERATOR ESCALATION)    */}
      {/* ================================================================ */}
      {tab === "network" && (
        <div className="space-y-4 animate-stage-pop">
          {orderNotice && (
            <div
              className={`p-4 rounded-2xl border text-xs font-semibold ${orderNotice.escalated
                ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
                }`}
            >
              {orderNotice.text}
            </div>
          )}

          {!account.networkUnlocked ? (
            <div className={`rounded-[24px] border p-8 ${cardCls}`}>
              <div className="max-w-md mx-auto text-center space-y-3 py-4">
                <div className="w-12 h-12 rounded-full bg-amber-500/15 text-amber-500 flex items-center justify-center mx-auto">
                  <IconLock className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-semibold">
                  {isSw ? "Habari! Mtandao wa Bohari Unakuja Hivi Karibuni" : "Hi there! Wholesale Network Is Coming Soon"}
                </h2>
                <p className={`text-xs leading-relaxed ${mutedCls}`}>
                  {isSw
                    ? "Unaweza kupakia leseni ya TMDA mapema katika Timu & Vibali ili uwe tayari siku tutakapofungua oda za bohari."
                    : "Direct supplier ordering and Kasri escrow settlement are currently in controlled rollout. Upload your TMDA permit in Team & Permits to get prioritized access."}
                </p>
                {canManageAdmin && (
                  <Link
                    href="/app/settings?tab=org#certificates"
                    className="inline-block px-5 py-2.5 rounded-full text-white text-xs font-semibold"
                    style={{ backgroundColor: accent }}
                  >
                    {isSw ? "Pakia Leseni ya Mapema ->" : "Prepare Operating Permit ->"}
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Live Interactive Tanzania B2B Supply Route Map & Transport Cost Explorer */}
              <div className={`rounded-[24px] border p-6 space-y-4 ${cardCls}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>
                      {isSw ? "RAMANI MUBASHARA YA WASAMBAZAJI" : "LIVE SUPPLIER CORRIDOR MAP"}
                    </div>
                    <h2 className="text-sm font-semibold mt-0.5">
                      {isSw
                        ? "Kagua njia halisi za usambazaji na makadirio ya usafiri hadi tawi lako"
                        : "Live Leaflet corridor routes & freight estimates to your active pharmacy branch"}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedMapSupplierId("all")}
                    className={`px-3.5 py-2 rounded-full border text-xs font-semibold cursor-pointer min-h-[38px] ${selectedMapSupplierId === "all" ? "text-white border-transparent" : chipCls
                      }`}
                    style={selectedMapSupplierId === "all" ? { backgroundColor: accent } : undefined}
                  >
                    {isSw ? "Njia Zote" : "All Corridors"}
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                  <div className={`lg:col-span-7 rounded-2xl border overflow-hidden min-h-[290px] ${isDark ? "border-slate-800" : "border-[#CBD5E1]"}`}>
                    <CervosMap
                      center={[activeCentre?.lat ?? -6.369, activeCentre?.lng ?? 36.2]}
                      zoom={6}
                      defaultStyle={isDark ? "dark" : "light"}
                      enableRegionJump
                      fitBoundsOnUpdate
                      selectedId={selectedMapSupplierId === "all" ? undefined : selectedMapSupplierId}
                      onMarkerClick={(m) => {
                        if (m.id && m.id !== "active-branch") {
                          setSelectedMapSupplierId(selectedMapSupplierId === m.id ? "all" : m.id);
                        }
                      }}
                      markers={[
                        {
                          id: "active-branch",
                          lat: activeCentre?.lat ?? -6.816,
                          lng: activeCentre?.lng ?? 39.2803,
                          label: activeCentre?.name || "Your Pharmacy Branch",
                          accountName: account.orgName,
                          region: activeCentre?.region || account.region,
                          kind: "branch",
                          status: "active",
                          detail: "Destination receiving counter",
                        },
                        {
                          id: "acc-afya",
                          lat: -6.7924,
                          lng: 39.2083,
                          label: "Afya Wholesale Ltd",
                          region: "Dar es Salaam",
                          kind: "supplier",
                          status: "online",
                          detail: "Freight: TZS 4,500 - 6,500 · 1-2d",
                        },
                        {
                          id: "acc-tibu",
                          lat: -6.163,
                          lng: 35.7516,
                          label: "Tibu Distributors",
                          region: "Dodoma",
                          kind: "supplier",
                          status: "online",
                          detail: "Freight: TZS 14,500 - 16,000 · 3d",
                        },
                        {
                          id: "acc-furaha",
                          lat: -3.3869,
                          lng: 36.683,
                          label: "Furaha Pharma Supply",
                          region: "Arusha",
                          kind: "supplier",
                          status: "online",
                          detail: "Freight: TZS 12,000 · 2d",
                        },
                      ]}
                      routes={[
                        {
                          id: "r-afya",
                          from: [-6.7924, 39.2083],
                          to: [activeCentre?.lat ?? -6.816, activeCentre?.lng ?? 39.2803],
                          label: "Express Coastal · TZS 4,500-6,500",
                          status: selectedMapSupplierId === "acc-afya" || selectedMapSupplierId === "all" ? "active" : "pending",
                        },
                        {
                          id: "r-tibu",
                          from: [-6.163, 35.7516],
                          to: [activeCentre?.lat ?? -6.816, activeCentre?.lng ?? 39.2803],
                          label: "Central Cold-Chain · TZS 14,500-16,000",
                          status: selectedMapSupplierId === "acc-tibu" || selectedMapSupplierId === "all" ? "delivered" : "pending",
                        },
                        {
                          id: "r-furaha",
                          from: [-3.3869, 36.683],
                          to: [activeCentre?.lat ?? -6.816, activeCentre?.lng ?? 39.2803],
                          label: "Northern Carrier · TZS 12,000",
                          status: selectedMapSupplierId === "acc-furaha" || selectedMapSupplierId === "all" ? "active" : "pending",
                        },
                      ]}
                      className="h-[290px] w-full"
                    />
                  </div>

                  <div className="lg:col-span-5 space-y-2.5 text-xs flex flex-col justify-center">
                    {[
                      { id: "acc-afya", label: "Afya Wholesale Ltd", city: "Dar es Salaam", route: "Express City & Coastal Corridor", fee: "TZS 4,500 - 6,500", lead: "1-2d" },
                      { id: "acc-tibu", label: "Tibu Distributors", city: "Dodoma", route: "Central Trunk & Cold-Chain Van", fee: "TZS 14,500 - 16,000", lead: "3d" },
                      { id: "acc-furaha", label: "Furaha Pharma Supply", city: "Arusha", route: "Northern Highland Carrier", fee: "TZS 12,000", lead: "2d" },
                    ].map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedMapSupplierId(selectedMapSupplierId === s.id ? "all" : s.id)}
                        className={`w-full p-3.5 rounded-2xl border text-left transition-all cursor-pointer min-h-[56px] ${selectedMapSupplierId === s.id ? "ring-2" : chipCls
                          }`}
                        style={selectedMapSupplierId === s.id ? { borderColor: accent } : undefined}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold">{s.label}</span>
                          <span className="font-mono text-[10px] font-bold" style={{ color: accent }}>{s.fee}</span>
                        </div>
                        <div className={`text-[11px] mt-0.5 ${mutedCls}`}>
                          {s.city} &middot; {s.route} &middot; Lead {s.lead}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Honest "Hi there! Wholesale Network Coming Soon" Preview */}
              <div className={`rounded-[24px] border p-7 ${cardCls}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                  <div className="space-y-2 max-w-xl">
                    <span className="inline-block px-3 py-1 rounded-full bg-blue-500/10 text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>
                      {isSw ? "INAKUJA HIVI KARIBUNI" : "COMING SOON TO PHARMACIES"}
                    </span>
                    <h2 className="text-xl font-bold tracking-tight" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                      {isSw
                        ? "Habari! Mtandao wa Kuagiza Dawa kwa Jumla & Kasri Escrow Unakuja Hivi Karibuni"
                        : "Hi there! Direct Wholesale Ordering & Kasri Escrow Is Coming Soon"}
                    </h2>
                    <p className={`text-xs leading-relaxed ${mutedCls}`}>
                      {isSw
                        ? "Tunakamilisha uunganishaji na wauzaji wa jumla walioidhinishwa nchini Tanzania ili uweze kuagiza dawa, kufuatilia usafiri mubashara, na kulipa kwa usalama. Mauzo ya POS, Stoo ya Dawa, Risiti, na Ripoti vyote vinafanya kazi kikamilifu sasa."
                        : "We are finalizing verified distributor onboarding and live dispatch payouts across Tanzania. While wholesale network checkout prepares to go live, your POS counter, batch expiry guard, receipts vault, staff shifts, and financial reports are 100% live."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNetworkNotifyRequested(true)}
                    className="px-5 py-3 rounded-full text-white text-xs font-semibold cursor-pointer min-h-[44px] shrink-0"
                    style={{ backgroundColor: networkNotifyRequested ? "#059669" : accent }}
                  >
                    {networkNotifyRequested
                      ? isSw ? "Umesajiliwa kwa Taarifa" : "Early Access Noted"
                      : isSw ? "Nijulishe Ikifunguka ->" : "Notify Me When Live ->"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB: EXPANDED FINANCE, P&L, SETTLEMENT & PLAN BILLING            */}
      {/* ================================================================ */}
      {tab === "billing" && canManageAdmin && (
        <div className="space-y-4 animate-stage-pop">
          {billingNotice && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-600">
              {billingNotice}
            </div>
          )}

          {/* Top Finance Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`rounded-[24px] border p-5 ${cardCls}`}>
              <div className={`text-[11px] ${mutedCls}`}>30-Day Counter Revenue</div>
              <div className="text-2xl font-normal tabular-nums mt-1" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                {formatTzs(pnlSummary.revenue)}
              </div>
              <div className="text-[11px] font-semibold text-emerald-500 mt-1">
                Gross Profit: {formatTzs(pnlSummary.grossProfit)} ({pnlSummary.grossMarginPct}%)
              </div>
            </div>
            <div className={`rounded-[24px] border p-5 ${cardCls}`}>
              <div className={`text-[11px] ${mutedCls}`}>Operating Profit (Net)</div>
              <div className="text-2xl font-normal tabular-nums mt-1" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                {formatTzs(pnlSummary.netProfit)}
              </div>
              <div className={`text-[11px] mt-1 ${mutedCls}`}>
                Total OPEX: {formatTzs(pnlSummary.opex)}
              </div>
            </div>
            <div className={`rounded-[24px] border p-5 ${cardCls}`}>
              <div className={`text-[11px] ${mutedCls}`}>Est. VAT Position (18%)</div>
              <div className="text-2xl font-normal tabular-nums mt-1" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                {formatTzs(pnlSummary.vatPayable)}
              </div>
              <div className={`text-[11px] mt-1 ${mutedCls}`}>
                Out {formatTzs(pnlSummary.outputVat)} - In {formatTzs(pnlSummary.inputVat)}
              </div>
            </div>
            <div className={`rounded-[24px] border p-5 ${cardCls}`}>
              <div className={`text-[11px] ${mutedCls}`}>Kasri Escrow Committed</div>
              <div className="text-2xl font-normal tabular-nums mt-1" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                {formatTzs(escrowHeldTzs)}
              </div>
              <div className={`text-[11px] mt-1 ${mutedCls}`}>
                Break-even:{" "}
                {pnlSummary.breakEvenDailyRevenue === null ? "N/A" : `${formatTzs(pnlSummary.breakEvenDailyRevenue)}/d`}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* P&L Waterfall + Expense Log + Add Expense */}
            <div className={`lg:col-span-7 rounded-[24px] border p-6 space-y-5 ${cardCls}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">Operating Expenses &amp; 30-Day P&amp;L Ledger</h2>
                  <p className={`text-[11px] ${mutedCls}`}>
                    Expenses recorded here flow directly into Reports P&amp;L and break-even calculations.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openReport("procurement")}
                    className={`px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer ${chipCls}`}
                  >
                    Open Full Report
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      exportCleanPdfReport({
                        orgName: account.orgName,
                        logoDataUrl: account.customization?.brandLogoUrl,
                        branchName: activeCentre?.name || account.region,
                        title: isSw ? "Taarifa ya Fedha & P&L" : "Finance & P&L Statement",
                        subtitle: isSw ? "Kumbukumbu ya siku 30" : "30-Day Finance & Operating Ledger",
                        generatedLabel: new Date().toISOString().slice(0, 10),
                        lang: isSw ? "SW" : "EN",
                        narrative: isSw
                          ? `${account.orgName} ilikusanya ${formatTzs(pnlSummary.revenue)} na kupata faida halisi ya ${formatTzs(pnlSummary.netProfit)} baada ya matumizi.`
                          : `${account.orgName} collected ${formatTzs(pnlSummary.revenue)} with a 30-day net operating profit of ${formatTzs(pnlSummary.netProfit)} after expenses.`,
                        metrics: [
                          { label: isSw ? "Mapato" : "Revenue", value: formatTzs(pnlSummary.revenue) },
                          { label: isSw ? "Faida Ghafi" : "Gross Profit", value: formatTzs(pnlSummary.grossProfit) },
                          { label: isSw ? "Matumizi" : "OPEX", value: formatTzs(pnlSummary.opex) },
                          { label: isSw ? "Faida Halisi" : "Net Profit", value: formatTzs(pnlSummary.netProfit) },
                        ],
                        tables: [
                          {
                            title: isSw ? "Daftari la Matumizi" : "Operating Expenses Ledger",
                            headers: isSw ? ["Tarehe", "Kundi", "Maelezo", "Kiasi"] : ["Date", "Category", "Description", "Amount"],
                            rows: expenses.map((e) => [
                              e.createdAt.slice(0, 10),
                              e.category,
                              e.description,
                              formatTzs(e.amountTzs),
                            ]),
                          },
                        ],
                      })
                    }
                    className="px-3 py-1.5 rounded-full text-white text-xs font-semibold cursor-pointer"
                    style={{ backgroundColor: accent }}
                  >
                    Clean PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const csv = arrayToCSV(
                        expenses.map((e) => ({
                          Date: e.createdAt.slice(0, 10),
                          Category: e.category,
                          Description: e.description,
                          AmountTZS: e.amountTzs,
                        })),
                        [
                          { key: "Date", header: "Date" },
                          { key: "Category", header: "Category" },
                          { key: "Description", header: "Description" },
                          { key: "AmountTZS", header: "Amount (TZS)" },
                        ]
                      );
                      downloadCSV(csv, "cervos-expenses-ledger.csv");
                    }}
                    className={`px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer ${chipCls}`}
                  >
                    Export CSV
                  </button>
                </div>
              </div>

              <form onSubmit={handleLogExpense} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className={`sm:col-span-4 px-3 py-2 rounded-xl border text-xs ${inputCls}`}
                >
                  <option value="Packaging & Supplies">Packaging &amp; Supplies</option>
                  <option value="Utilities & Cold Chain">Utilities &amp; Cold Chain</option>
                  <option value="Rent & Premises">Rent &amp; Premises</option>
                  <option value="Staff & Shift">Staff &amp; Shift</option>
                  <option value="Compliance & Permits">Compliance &amp; Permits</option>
                </select>
                <input
                  type="text"
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  placeholder="Expense note (e.g. LUKU meter refill)"
                  className={`sm:col-span-4 px-3 py-2 rounded-xl border text-xs ${inputCls}`}
                />
                <input
                  type="number"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="Amount TZS"
                  className={`sm:col-span-2 px-3 py-2 rounded-xl border text-xs ${inputCls}`}
                />
                <button
                  type="submit"
                  disabled={expenseBusy}
                  className="sm:col-span-2 py-2 rounded-xl text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  style={{ backgroundColor: accent }}
                >
                  {expenseBusy && (
                    <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  )}
                  <span>{expenseBusy ? "..." : "+ Log"}</span>
                </button>
              </form>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {visibleExpenses.map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() =>
                      setInspectedListing({
                        title: ex.description,
                        badge: ex.category,
                        explanation: isSw
                          ? "Gharama hii ni sehemu ya matumizi ya siku 30 yanayopunguza faida halisi."
                          : "Recorded operating bill included directly in 30-day Net Profit and daily break-even calculation.",
                        fields: [
                          { label: isSw ? "Kiasi" : "Amount", value: formatTzs(ex.amountTzs) },
                          { label: isSw ? "Tarehe" : "Logged Date", value: ex.createdAt.slice(0, 10) },
                          { label: isSw ? "Sehemu ya OPEX" : "Share of OPEX", value: `${pnlSummary.opex > 0 ? Math.round((ex.amountTzs / pnlSummary.opex) * 100) : 0}%` },
                        ],
                      })
                    }
                    className={`w-full p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs text-left cursor-pointer hover:border-blue-400 transition-colors ${chipCls}`}
                  >
                    <div>
                      <div className="font-semibold">{ex.description}</div>
                      <div className={`text-[10px] ${mutedCls}`}>
                        {ex.category} &middot; {ex.createdAt.slice(0, 10)}
                      </div>
                    </div>
                    <span className="font-bold text-amber-600 tabular-nums shrink-0">{formatTzs(ex.amountTzs)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Payout Channels & Subscription Tiers */}
            <div className="lg:col-span-5 space-y-4">
              <form onSubmit={handleSavePaymentSettings} className={`rounded-[24px] border p-6 space-y-3 ${cardCls}`}>
                <div>
                  <h2 className="text-sm font-semibold">Mobile Money &amp; Bank Settlement</h2>
                  <p className={`text-[11px] ${mutedCls}`}>Destinations for daily counter &amp; Kasri escrow payouts.</p>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className={`block text-[10px] font-bold uppercase mb-1 ${mutedCls}`}>M-Pesa Paybill</label>
                    <input
                      type="text"
                      value={mpesaPaybill}
                      onChange={(e) => setMpesaPaybill(e.target.value)}
                      placeholder="e.g. 5582901"
                      className={`w-full px-3 py-2 rounded-xl border font-mono text-xs ${inputCls}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] font-bold uppercase mb-1 ${mutedCls}`}>Tigo Lipa</label>
                    <input
                      type="text"
                      value={tigoLipaNumber}
                      onChange={(e) => setTigoLipaNumber(e.target.value)}
                      placeholder="e.g. 8104421"
                      className={`w-full px-3 py-2 rounded-xl border font-mono text-xs ${inputCls}`}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className={`block text-[10px] font-bold uppercase mb-1 ${mutedCls}`}>Settlement Bank</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. CRDB Bank Tanzania"
                      className={`w-full px-3 py-2 rounded-xl border text-xs ${inputCls}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] font-bold uppercase mb-1 ${mutedCls}`}>Account Number</label>
                    <input
                      type="text"
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      placeholder="e.g. 0152 0482 11900"
                      className={`w-full px-3 py-2 rounded-xl border font-mono text-xs ${inputCls}`}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <select
                    value={settlementCycle}
                    onChange={(e) => setSettlementCycle(e.target.value as "daily" | "instant" | "weekly")}
                    className={`px-3 py-2 rounded-xl border text-xs ${inputCls}`}
                  >
                    <option value="instant">Instant Payout</option>
                    <option value="daily">Daily Batch (18:00)</option>
                    <option value="weekly">Weekly Summary</option>
                  </select>
                  <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={vatRegistered}
                      onChange={(e) => setVatRegistered(e.target.checked)}
                    />
                    TRA VAT Registered
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={settlementBusy}
                  className="w-full py-2.5 rounded-full text-white text-xs font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  style={{ backgroundColor: accent }}
                >
                  {settlementBusy && (
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  )}
                  <span>{settlementBusy ? "Saving..." : "Save Settlement Channels"}</span>
                </button>
              </form>

              <div className={`rounded-[24px] border p-6 space-y-3 ${cardCls}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className={`text-[10px] uppercase tracking-wider font-bold ${mutedCls}`}>Current Plan</div>
                    <h3 className="text-sm font-bold mt-0.5">{account.subscriptionPlan}</h3>
                    {typeof account.subscriptionDaysLeft === "number" && (
                      <div className={`text-[11px] mt-0.5 ${account.subscriptionDaysLeft <= 5 ? "text-amber-500 font-semibold" : mutedCls}`}>
                        {account.subscriptionInGraceDay
                          ? "Final grace day — renew tonight to keep counters & evening SMS running tomorrow"
                          : `${account.subscriptionDaysLeft} day${account.subscriptionDaysLeft === 1 ? "" : "s"} remaining`}
                      </div>
                    )}
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-bold ${account.subscriptionActive ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-600"
                      }`}
                  >
                    {account.subscriptionActive ? "Paid & Active" : "Trial Active"}
                  </span>
                </div>
                <div className="space-y-2">
                  {COMMERCIAL_PLAN_CATALOG.filter((p) => p.audience === "pharmacy").map((plan) => {
                    const isCurrent = account.subscriptionPlan.toLowerCase() === plan.name.toLowerCase();
                    const curCatalog = COMMERCIAL_PLAN_CATALOG.find(
                      (c) => c.name.toLowerCase() === account.subscriptionPlan.toLowerCase()
                    );
                    const isUpgrade = Boolean(curCatalog && plan.priceMonthlyTzs > curCatalog.priceMonthlyTzs);
                    return (
                      <div key={plan.id} className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-2 ${chipCls}`}>
                        <div>
                          <div className="font-semibold flex items-center gap-1.5">
                            <span>{plan.name}</span>
                            {isCurrent && account.subscriptionActive && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-500">
                                Current
                              </span>
                            )}
                          </div>
                          <div className={`text-[10px] ${mutedCls}`}>
                            Up to {plan.maxBranches} branch &middot; {plan.maxOperators} operators &middot;{" "}
                            {formatTzs(plan.priceMonthlyTzs)}/mo
                          </div>
                        </div>
                        <Link
                          href={`/app/billing?plan=${encodeURIComponent(plan.name)}`}
                          className="px-3 py-1.5 rounded-full text-white text-[11px] font-semibold cursor-pointer shrink-0"
                          style={{ backgroundColor: accent }}
                        >
                          {isCurrent && account.subscriptionActive
                            ? "Renew"
                            : isUpgrade
                              ? "Upgrade ->"
                              : "Select ->"}
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* OVERVIEW BENTO: ALL-BRANCHES ORG HUB OR ACTIVE BRANCH CONSOLE    */}
      {/* ================================================================ */}
      {tab === "overview" && (
        <>
          <StationChecklist
            profileId={activeProfileId || ""}
            orgName={account.orgName}
            branchName={activeCentre?.name || account.region}
            isDark={isDark}
            isSw={isSw}
            accent={accent}
            hasActiveShift={Boolean(activeShift)}
            batchCount={batches.length}
            saleCount={sales.length}
            onJumpTab={(nextTab) => setTab(nextTab)}
            onStartTour={() => setTourOpen(true)}
          />
          {/* Home Launch Shift Attendance Check (Immediate Visibility on App Home + Auto Clock-Out Alert) */}
          {autoClockOutNotice && (
            <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center justify-between gap-2 mb-4">
              <span>{autoClockOutNotice}</span>
              <button
                type="button"
                onClick={() => setAutoClockOutNotice(null)}
                className="text-xs underline cursor-pointer shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {!shiftPromptDismissed && (
            <div data-tour="shift-launch-card" className={`rounded-[22px] border p-4 sm:p-5 mb-4 flex flex-wrap items-center justify-between gap-3 ${cardCls}`}>
              <div className="space-y-0.5">
                <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>
                  {activeShift
                    ? isSw ? "ZAMU INAENDELEA" : "ACTIVE SHIFT LOGGED"
                    : isSw ? "UKAGUZI WA ZAMU KWENYE UZINDUZI" : "LAUNCH SHIFT ATTENDANCE CHECK"}
                </div>
                <div className="text-sm font-semibold">
                  {activeShift
                    ? isSw
                      ? `Uko zamu katika tawi la ${activeCentre?.name || account.orgName} tangu saa ${activeShift.clockInAt.slice(11, 16)}.`
                      : `You are clocked in at ${activeCentre?.name || account.orgName} since ${activeShift.clockInAt.slice(11, 16)}.`
                    : isSw
                      ? `Je, uko zamu sasa hivi kwenye tawi la ${activeCentre?.name || account.orgName}?`
                      : `Are you on shift right now at ${activeCentre?.name || account.orgName}?`}
                </div>
                <p className={`text-[11px] ${mutedCls}`}>
                  {activeShift
                    ? isSw
                      ? "Ukitoka nje ya programu kwa zaidi ya saa 4 bila shughuli, zamu itafungwa kiotomatiki."
                      : "Staying away from the app for over 4 hours automatically clocks out your shift."
                    : isSw
                      ? "Anza zamu kabla ya kuuza kaunta ili kuhakiki muda wa kazi na droo ya fedha."
                      : "Clock in right here on Home before counter sales so shift hours & cash drawer stay accurate."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {activeShift ? (
                  <button
                    type="button"
                    disabled={shiftBusy}
                    onClick={() => handleShiftClock("out")}
                    className="px-4 py-2 rounded-full border border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {shiftBusy && <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />}
                    <span>{shiftBusy ? "Updating..." : isSw ? "Maliza Zamu (Clock Out)" : "Clock Out Now"}</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={shiftBusy}
                      onClick={() => handleShiftClock("in")}
                      className="px-4 py-2 rounded-full text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      style={{ backgroundColor: accent }}
                    >
                      {shiftBusy && <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />}
                      <span>{shiftBusy ? "Clocking In..." : isSw ? "Ndiyo, Anza Zamu (Clock In)" : "Yes, Clock In Now"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShiftPromptDismissed(true)}
                      className={`px-3.5 py-2 rounded-full border text-xs font-semibold cursor-pointer ${chipCls}`}
                    >
                      {isSw ? "Sipo Zamu" : "Not on Shift"}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {canManageAdmin && orgScope === "all" && (
            <div className="space-y-6 animate-stage-pop">
              {/* TOP ROW: Simple Greeting + Neat 2x2 Analytics Cubes (Left) + Thin Action Trail (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                <div className="lg:col-span-6 flex flex-col justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: accent }}>
                      {account.orgName}
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-normal tracking-tight mt-0.5" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                      {isSw ? `Karibu, ${activeProfileName || account.fullName}` : `Hi, ${activeProfileName || account.fullName}`}
                    </h2>
                  </div>

                  {/* Neat 2x2 Plain-Language Cubes */}
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => openReport("sales")} className={`rounded-[22px] border p-4 text-left cursor-pointer hover:-translate-y-0.5 transition-all min-h-[100px] ${cardCls}`}>
                      <div className={`text-xs font-medium ${mutedCls}`}>{isSw ? "Mauzo Yote" : "Total Sales"}</div>
                      <div className="text-lg sm:text-xl font-bold tabular-nums mt-1.5" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                        {formatTzs(pnlSummary.revenue)}
                      </div>
                      <div className="text-[11px] font-semibold text-emerald-500 mt-1">
                        {sales.length} {isSw ? "risiti" : "sales"}
                      </div>
                    </button>

                    <button type="button" onClick={() => setTab("billing")} className={`rounded-[22px] border p-4 text-left cursor-pointer hover:-translate-y-0.5 transition-all min-h-[100px] ${cardCls}`}>
                      <div className={`text-xs font-medium ${mutedCls}`}>{isSw ? "Faida Halisi" : "Net Profit"}</div>
                      <div className="text-lg sm:text-xl font-bold tabular-nums mt-1.5" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                        {formatTzs(pnlSummary.netProfit)}
                      </div>
                      <div className={`text-[11px] mt-1 ${mutedCls}`}>
                        {pnlSummary.grossMarginPct}% {isSw ? "faida" : "margin"}
                      </div>
                    </button>

                    <button type="button" onClick={() => openReport("stock")} className={`rounded-[22px] border p-4 text-left cursor-pointer hover:-translate-y-0.5 transition-all min-h-[100px] ${cardCls}`}>
                      <div className={`text-xs font-medium ${mutedCls}`}>{isSw ? "Thamani ya Stoo" : "Stock Value"}</div>
                      <div className="text-lg sm:text-xl font-bold tabular-nums mt-1.5" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                        {formatTzs(inventoryValuation(batches).atRetail)}
                      </div>
                      <div className="text-[11px] text-amber-500 font-semibold mt-1">
                        {stockAlerts.nearExpiryCount} {isSw ? "zinaisha karibu" : "expiring soon"}
                      </div>
                    </button>

                    <button type="button" onClick={() => setTab("network")} className={`rounded-[22px] border p-4 text-left cursor-pointer hover:-translate-y-0.5 transition-all min-h-[100px] ${cardCls}`}>
                      <div className={`text-xs font-medium ${mutedCls}`}>{isSw ? "Matawi & Mtandao" : "Branch Fleet"}</div>
                      <div className="text-lg sm:text-xl font-bold tabular-nums mt-1.5" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                        {centres.length} {isSw ? "matawi" : "branches"}
                      </div>
                      <div className={`text-[11px] mt-1 ${mutedCls}`}>
                        {profiles.length} {isSw ? "wahudumu" : "staff"}
                      </div>
                    </button>
                  </div>
                </div>

                {/* Right: Thin Action Trail (Zero Branch Chat on Owner General Hub) */}
                <div className={`lg:col-span-6 rounded-[24px] border p-5 flex flex-col justify-between gap-3 ${cardCls}`}>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">
                      {isSw ? "Kazi Zinazohitaji Hatua" : "Needs Attention"}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 text-[10px] font-bold">
                      {pendingJoinRequests.length + hqMessages.filter((m) => !m.acknowledged).length}
                    </span>
                  </div>

                  {selectedTrailItem && typeof document !== "undefined" && createPortal(
                    <div
                      role="dialog"
                      aria-modal="true"
                      className="fixed inset-0 z-[125] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
                      onClick={() => setSelectedTrailItem(null)}
                    >
                      <div onClick={(e) => e.stopPropagation()} className={`w-full max-w-lg max-h-[88vh] overflow-y-auto p-6 rounded-[26px] border space-y-3 ring-2 shadow-2xl animate-stage-pop text-xs ${cardCls}`} style={{ borderColor: accent }}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>
                              {selectedTrailItem.kind === "join"
                                ? isSw ? "OMBI LA KUJIUNGA" : "STAFF REQUEST"
                                : selectedTrailItem.kind === "hq"
                                  ? "HQ NOTICE"
                                  : selectedTrailItem.kind === "escrow"
                                    ? "ORDER HELD"
                                    : selectedTrailItem.log.category}
                            </div>
                            <div className="font-bold text-sm mt-0.5">
                              {selectedTrailItem.kind === "join"
                                ? `${selectedTrailItem.req.requesterFullName} (@${selectedTrailItem.req.requesterUsername})`
                                : selectedTrailItem.kind === "hq"
                                  ? isSw ? selectedTrailItem.msg.swTitle : selectedTrailItem.msg.title
                                  : selectedTrailItem.kind === "escrow"
                                    ? `${selectedTrailItem.order.orderReference} · ${selectedTrailItem.order.supplierName}`
                                    : selectedTrailItem.log.action}
                            </div>
                          </div>
                          <button type="button" onClick={() => setSelectedTrailItem(null)} className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold cursor-pointer ${cardCls}`}>
                            &times;
                          </button>
                        </div>

                        {selectedTrailItem.kind === "join" && (
                          <div className="space-y-2.5">
                            <div className={`text-[11px] ${mutedCls}`}>
                              {selectedTrailItem.req.requesterRegion}
                              {selectedTrailItem.req.requestedRoleLabel ? ` · ${selectedTrailItem.req.requestedRoleLabel}` : ""}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <select value={allocCentreId} onChange={(e) => setAllocCentreId(e.target.value)} className={`px-2.5 py-2 rounded-xl border text-xs ${inputCls}`}>
                                {centres.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                              <select
                                value={allocRole}
                                onChange={(e) => {
                                  const nextRole = e.target.value as WorkspaceProfileRole;
                                  setAllocRole(nextRole);
                                  setAllocCaps(clampProfileCapabilities(nextRole));
                                }}
                                className={`px-2.5 py-2 rounded-xl border text-xs ${inputCls}`}
                              >
                                <option value="superintendent_pharmacist">Pharmacist</option>
                                <option value="pos_cashier">Cashier</option>
                                <option value="warehouse_dispatcher">Dispatcher</option>
                                <option value="pharmacy_owner">Branch Admin</option>
                              </select>
                              <input type="text" maxLength={6} value={allocPin} onChange={(e) => setAllocPin(e.target.value.replace(/\D/g, ""))} placeholder="PIN" className={`px-2.5 py-2 rounded-xl border font-mono text-xs ${inputCls}`} />
                            </div>
                            {(() => {
                              const rKey = (allocRole as WorkspaceProfileRole) in ROLE_PERMISSION_RULES ? (allocRole as WorkspaceProfileRole) : "pos_cashier";
                              const rule = ROLE_PERMISSION_RULES[rKey];
                              return (
                                <div className="flex flex-wrap gap-1.5">
                                  {PERMISSION_METADATA.map((pm) => {
                                    const lOn = rule.immutableTrue.includes(pm.key);
                                    const lOff = rule.immutableFalse.includes(pm.key);
                                    const val = lOn ? true : lOff ? false : Boolean(allocCaps[pm.key]);
                                    return (
                                      <label key={pm.key} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] cursor-pointer ${cardCls}`}>
                                        <input
                                          type="checkbox"
                                          checked={val}
                                          disabled={lOn || lOff}
                                          onChange={(e) => setAllocCaps((prev) => ({ ...prev, [pm.key]: e.target.checked }))}
                                        />
                                        <span>{isSw ? pm.swLabel : pm.label}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => handleReviewJoinRequest(selectedTrailItem.req.id, "decline")} className="px-3.5 py-2 rounded-full border border-rose-500/40 text-rose-500 text-xs font-semibold cursor-pointer min-h-[40px]">
                                Decline
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await handleReviewJoinRequest(selectedTrailItem.req.id, "approve");
                                  setSelectedTrailItem(null);
                                }}
                                className="px-4 py-2 rounded-full text-white text-xs font-semibold cursor-pointer min-h-[40px]"
                                style={{ backgroundColor: accent }}
                              >
                                Approve &rarr;
                              </button>
                            </div>
                          </div>
                        )}

                        {selectedTrailItem.kind === "hq" && (
                          <div className="space-y-2.5">
                            <p className={`text-xs leading-relaxed ${mutedCls}`}>
                              {isSw ? selectedTrailItem.msg.swBody : selectedTrailItem.msg.body}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              {selectedTrailItem.msg.ctaTarget && selectedTrailItem.msg.ctaTarget !== "download" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const t = selectedTrailItem.msg.ctaTarget;
                                    setSelectedTrailItem(null);
                                    if (t === "reports") openReport("brief");
                                    else if (t === "billing" || t === "network" || t === "team") setTab(t);
                                  }}
                                  className="px-3.5 py-2 rounded-full text-white text-xs font-semibold cursor-pointer"
                                  style={{ backgroundColor: accent }}
                                >
                                  {selectedTrailItem.msg.ctaLabel} &rarr;
                                </button>
                              )}
                              <button type="button" onClick={() => handleAckHqMessage(selectedTrailItem.msg.id)} className={`px-3.5 py-2 rounded-full border text-xs font-semibold cursor-pointer ${cardCls}`}>
                                {isSw ? "Sawa" : "Done"}
                              </button>
                            </div>
                          </div>
                        )}

                        {selectedTrailItem.kind === "escrow" && (
                          <div className="flex items-center justify-between gap-2">
                            <span className={mutedCls}>
                              {selectedTrailItem.order.productName} &middot; {formatTzs(selectedTrailItem.order.totalTzs)}
                            </span>
                            <button type="button" onClick={() => setTab("network")} className="px-3.5 py-2 rounded-full text-white text-xs font-semibold cursor-pointer" style={{ backgroundColor: accent }}>
                              Open Orders &rarr;
                            </button>
                          </div>
                        )}

                        {selectedTrailItem.kind === "audit" && (
                          <div className="flex items-center justify-between gap-2">
                            <span className={mutedCls}>{selectedTrailItem.log.actor} &middot; {selectedTrailItem.log.createdAt.slice(0, 16).replace("T", " ")}</span>
                            <button type="button" onClick={() => openReport("brief")} className="px-3.5 py-2 rounded-full text-white text-xs font-semibold cursor-pointer" style={{ backgroundColor: accent }}>
                              View Report &rarr;
                            </button>
                          </div>
                        )}
                      </div>
                    </div>,
                    document.body
                  )}

                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 text-xs">
                    {pendingJoinRequests.map((rq) => (
                      <button
                        key={rq.id}
                        type="button"
                        onClick={() => setSelectedTrailItem({ kind: "join", req: rq })}
                        className={`w-full px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-2 text-left cursor-pointer hover:border-amber-400 transition-colors min-h-[42px] ${chipCls}`}
                      >
                        <span className="truncate font-semibold">
                          <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-2" />
                          @{rq.requesterUsername} &middot; {rq.requesterFullName}
                        </span>
                        <span className="text-[11px] font-bold text-amber-600 shrink-0">Review &rarr;</span>
                      </button>
                    ))}
                    {hqMessages.filter((m) => !m.acknowledged).slice(0, 3).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedTrailItem({ kind: "hq", msg: m })}
                        className={`w-full px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-2 text-left cursor-pointer hover:border-blue-400 transition-colors min-h-[42px] ${chipCls}`}
                      >
                        <span className="truncate font-medium">
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-[#1039B9] dark:text-[#38BDF8] font-mono text-[9px] font-bold mr-2">
                            HQ
                          </span>
                          {isSw ? m.swTitle : m.title}
                        </span>
                        <span className="text-[10px] opacity-70 shrink-0">{m.createdAt.slice(5, 10)}</span>
                      </button>
                    ))}
                    {filteredLogs.slice(0, 4).map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => setSelectedTrailItem({ kind: "audit", log: entry })}
                        className={`w-full px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-2 text-left cursor-pointer hover:border-blue-400 transition-colors min-h-[42px] ${chipCls}`}
                      >
                        <span className="truncate">
                          <span className="font-mono text-[9px] font-bold opacity-70 mr-2">{entry.category}</span>
                          {entry.action}
                        </span>
                        <span className="font-mono text-[10px] opacity-65 shrink-0">{entry.createdAt.slice(11, 16)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* BELOW: Clean Branch Cards + "+ Add Branch" Slot */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">
                    {isSw ? "Matawi Yako" : "Your Pharmacies"}
                  </h2>
                  <button type="button" onClick={() => openReport("people")} className="text-xs font-semibold hover:underline cursor-pointer" style={{ color: accent }}>
                    {isSw ? "Linganisha Matawi ->" : "Compare Side by Side ->"}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(() => {
                    const compList =
                      orgBranchComparison.length > 0
                        ? orgBranchComparison
                        : branchComparison(sales, batches, centres);
                    return centres.map((ctr) => {
                      const b = compList.find((x) => x.centreId === ctr.id) ?? {
                        centreId: ctr.id,
                        name: ctr.name,
                        revenue: 0,
                        profit: 0,
                        tx: 0,
                        marginPct: 0,
                        stockAtCost: 0,
                        turnover: 0,
                      };
                      const staffCount = profiles.filter((p) => p.centreId === ctr.id).length;
                      const isPaused = ctr.status === "paused";
                      const isArchived = ctr.status === "archived";
                      const isExcluded = Boolean(ctr.excludedFromRollup);
                      return (
                        <div
                          key={ctr.id}
                          className={`rounded-[24px] border p-5 flex flex-col justify-between gap-4 hover:-translate-y-0.5 transition-all ${cardCls} ${
                            isArchived ? "opacity-70" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-base font-bold flex flex-wrap items-center gap-1.5">
                                <span>{ctr.name}</span>
                                {isPaused && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-300 text-[9px] uppercase">
                                    {isSw ? "Imesitishwa" : "Paused"}
                                  </span>
                                )}
                                {isArchived && (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-500 text-[9px] uppercase">
                                    {isSw ? "Kumbukumbu" : "Archived"}
                                  </span>
                                )}
                                {isExcluded && (
                                  <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-600 dark:text-purple-300 text-[9px] uppercase">
                                    {isSw ? "Imetengwa" : "Excluded"}
                                  </span>
                                )}
                              </div>
                              <div className={`text-xs mt-0.5 ${mutedCls}`}>
                                {ctr.region || account.region} &middot; {staffCount} {isSw ? "wahudumu" : "staff"}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold tabular-nums">{formatTzs(b.revenue)}</div>
                              <div className="text-[10px] text-emerald-500 font-semibold">{b.turnover}x turn</div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2.5 text-xs">
                            <div className={`p-2.5 rounded-xl border ${chipCls}`}>
                              <div className={`text-[10px] ${mutedCls}`}>{isSw ? "Faida" : "Margin"}</div>
                              <div className="font-bold text-emerald-500 mt-0.5">{b.marginPct}%</div>
                            </div>
                            <div className={`p-2.5 rounded-xl border ${chipCls}`}>
                              <div className={`text-[10px] ${mutedCls}`}>{isSw ? "Stoo" : "Stock"}</div>
                              <div className="font-bold tabular-nums mt-0.5">{formatTzs(b.stockAtCost)}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                if (onSwitchCentre && ctr.id !== activeCentre?.id) {
                                  await onSwitchCentre(ctr.id);
                                }
                                onSetOrgScope?.("branch");
                              }}
                              className="flex-1 py-2.5 rounded-full text-white text-xs font-semibold cursor-pointer min-h-[44px]"
                              style={{ backgroundColor: accent }}
                            >
                              {isSw ? `Ingia ${ctr.name}` : `Open ${ctr.name}`} &rarr;
                            </button>
                            <button
                              type="button"
                              onClick={() => openReport("people")}
                              className={`px-3.5 py-2.5 rounded-full border text-xs font-semibold cursor-pointer min-h-[44px] ${chipCls}`}
                            >
                              {isSw ? "Ripoti" : "Reports"}
                            </button>
                          </div>

                          {canManageAdmin && (
                            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-500/15">
                              <button
                                type="button"
                                disabled={branchBusy}
                                onClick={() =>
                                  void handleManageCentre(ctr.id, isPaused || isArchived ? "resume" : "pause")
                                }
                                className={`px-2.5 py-1 rounded-full border text-[10px] font-semibold cursor-pointer ${chipCls}`}
                              >
                                {isPaused || isArchived ? (isSw ? "Endelea" : "Resume") : (isSw ? "Sitisha" : "Pause")}
                              </button>
                              <button
                                type="button"
                                disabled={branchBusy}
                                onClick={() => void handleManageCentre(ctr.id, "toggle_exclude")}
                                className={`px-2.5 py-1 rounded-full border text-[10px] font-semibold cursor-pointer ${chipCls}`}
                              >
                                {isExcluded ? (isSw ? "Jumuisha" : "Include") : (isSw ? "Tenga" : "Exclude")}
                              </button>
                              <button
                                type="button"
                                disabled={branchBusy}
                                onClick={() =>
                                  void handleManageCentre(ctr.id, isArchived ? "restore" : "archive")
                                }
                                className={`px-2.5 py-1 rounded-full border text-[10px] font-semibold cursor-pointer ${chipCls}`}
                              >
                                {isArchived ? (isSw ? "Rejesha" : "Restore") : (isSw ? "Hifadhi" : "Archive")}
                              </button>
                              {!ctr.isPrimary && centres.length > 1 && (
                                <button
                                  type="button"
                                  disabled={branchBusy}
                                  onClick={() => void handleManageCentre(ctr.id, "delete")}
                                  className="px-2.5 py-1 rounded-full border border-rose-500/40 text-rose-500 text-[10px] font-semibold cursor-pointer"
                                >
                                  {isSw ? "Futa" : "Delete"}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}

                  {/* + Add New Branch Card Slot */}
                  <button
                    type="button"
                    onClick={() => setAddBranchOpen(true)}
                    className={`rounded-[24px] border-2 border-dashed p-6 flex flex-col items-center justify-center text-center gap-2 min-h-[190px] cursor-pointer hover:border-blue-500 transition-colors ${isDark ? "border-slate-700 bg-[#0D131D]/60 text-slate-200" : "border-slate-300 bg-white/70 text-[#111317]"}`}
                  >
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-xl font-bold text-white" style={{ backgroundColor: accent }}>
                      +
                    </div>
                    <div className="font-bold text-sm">{isSw ? "Ongeza Tawi Jipya" : "Add Branch"}</div>
                    <span className={`text-xs ${mutedCls}`}>
                      {isSw ? "Sajili duka jipya & wahudumu" : "New location & assign team"}
                    </span>
                  </button>
                </div>
              </div >

              {/* Friendly Guided New Branch Setup Modal */}
              {
                addBranchOpen && (
                  <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setAddBranchOpen(false)}>
                    <form
                      onSubmit={handleAddBranch}
                      onClick={(e) => e.stopPropagation()}
                      className={`w-full max-w-lg rounded-[28px] border p-6 sm:p-7 space-y-4 shadow-2xl animate-stage-pop ${cardCls}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>
                            {isSw ? "USAJILI WA TAWI JIPYA" : "FRIENDLY BRANCH SETUP"}
                          </div>
                          <h3 className="text-lg font-bold mt-0.5">{isSw ? "Ongeza Tawi Kwenye Mtandao Wako" : "Launch a New Pharmacy Branch"}</h3>
                        </div>
                        <button type="button" onClick={() => setAddBranchOpen(false)} className={`px-3 py-1 rounded-full border text-xs font-semibold cursor-pointer ${chipCls}`}>
                          &times;
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className={`block text-[10px] font-bold uppercase mb-1 ${mutedCls}`}>Branch Name *</label>
                          <input type="text" required value={branchNameInput} onChange={(e) => setBranchNameInput(e.target.value)} placeholder="e.g. Sinza Corner Dispensary" className={`w-full px-3 py-2.5 rounded-xl border ${inputCls}`} />
                        </div>
                        <div>
                          <label className={`block text-[10px] font-bold uppercase mb-1 ${mutedCls}`}>Region / City *</label>
                          <input type="text" required value={branchRegionInput} onChange={(e) => setBranchRegionInput(e.target.value)} placeholder="Dar es Salaam" className={`w-full px-3 py-2.5 rounded-xl border ${inputCls}`} />
                        </div>
                        <div>
                          <label className={`block text-[10px] font-bold uppercase mb-1 ${mutedCls}`}>Street Address *</label>
                          <input type="text" required value={branchAddrInput} onChange={(e) => setBranchAddrInput(e.target.value)} placeholder="Plot 14, Shekilango Rd" className={`w-full px-3 py-2.5 rounded-xl border ${inputCls}`} />
                        </div>
                        <div>
                          <label className={`block text-[10px] font-bold uppercase mb-1 ${mutedCls}`}>Station Phone</label>
                          <input type="tel" value={branchPhoneInput} onChange={(e) => setBranchPhoneInput(e.target.value)} placeholder="+255 712 000 000" className={`w-full px-3 py-2.5 rounded-xl border ${inputCls}`} />
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-bold uppercase ${mutedCls}`}>
                            {isSw ? "Bonyeza Ramani Kuweka Mahali" : "Tap Live Map to Pin Branch GPS"} ({branchLat.toFixed(4)}, {branchLng.toFixed(4)})
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (typeof navigator !== "undefined" && navigator.geolocation) {
                                navigator.geolocation.getCurrentPosition((pos) => {
                                  setBranchLat(Number(pos.coords.latitude.toFixed(5)));
                                  setBranchLng(Number(pos.coords.longitude.toFixed(5)));
                                });
                              }
                            }}
                            className={`px-2.5 py-1 rounded-full border text-[10px] font-semibold cursor-pointer ${chipCls}`}
                          >
                            {isSw ? "Tumia GPS Yangu" : "Use My GPS"}
                          </button>
                        </div>
                        <div className="rounded-2xl border overflow-hidden border-slate-500/25 h-36">
                          <CervosMap
                            center={[branchLat, branchLng]}
                            zoom={12}
                            defaultStyle={isDark ? "dark" : "light"}
                            fitBoundsOnUpdate={false}
                            showControls={false}
                            onMapClick={(loc) => {
                              setBranchLat(Number(loc.lat.toFixed(5)));
                              setBranchLng(Number(loc.lng.toFixed(5)));
                            }}
                            markers={[
                              {
                                id: "new-branch-pin",
                                lat: branchLat,
                                lng: branchLng,
                                label: branchNameInput || "New Branch Location",
                                region: branchRegionInput,
                                kind: "branch",
                                status: "active",
                              },
                            ]}
                            className="h-36 w-full"
                          />
                        </div>
                      </div>

                      <div className={`p-3.5 rounded-2xl border space-y-2 text-xs ${chipCls}`}>
                        <div className="font-bold text-[11px]">
                          {isSw ? "Hamisha Wafanyakazi Waliopo (Hiari)" : "Assign / Shift Existing Staff to This Branch (Optional)"}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {profiles
                            .filter((p) => !p.isMasterAdmin)
                            .map((p) => {
                              const checked = branchAssignIds.includes(p.id);
                              return (
                                <label key={p.id} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] cursor-pointer ${cardCls}`}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) =>
                                      setBranchAssignIds((prev) =>
                                        e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)
                                      )
                                    }
                                  />
                                  <span>{p.displayName}</span>
                                </label>
                              );
                            })}
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button type="button" onClick={() => setAddBranchOpen(false)} className={`px-4 py-2.5 rounded-full border text-xs font-semibold cursor-pointer ${chipCls}`}>
                          Cancel
                        </button>
                        <button type="submit" disabled={branchBusy} className="px-5 py-2.5 rounded-full text-white text-xs font-semibold cursor-pointer" style={{ backgroundColor: accent }}>
                          {branchBusy ? "Creating..." : "Create Branch & Sync ->"}
                        </button>
                      </div>
                    </form>
                  </div>
                )
              }

              {
                hqUpdates.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {hqUpdates.map((u) => (
                      <div key={u.id} className={`p-4 rounded-2xl border flex flex-col justify-between gap-2 text-xs ${cardCls}`}>
                        <div className="space-y-1">
                          <span className="px-2 py-0.5 rounded bg-blue-500/10 text-[#1039B9] dark:text-[#38BDF8] text-[9px] font-bold">
                            {u.tag}
                          </span>
                          <div className="font-bold leading-snug">{isSw ? u.swTitle : u.title}</div>
                          <p className={`text-[11px] ${mutedCls}`}>{isSw ? u.swSummary : u.summary}</p>
                        </div>
                        {u.ctaTarget === "download" ? (
                          <Link href="/app/download" className="text-[11px] font-semibold hover:underline" style={{ color: accent }}>
                            {u.ctaLabel} &rarr;
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              u.ctaTarget === "reports"
                                ? openReport("brief")
                                : u.ctaTarget === "billing"
                                  ? setTab("billing")
                                  : setTab("network")
                            }
                            className="text-left text-[11px] font-semibold hover:underline cursor-pointer"
                            style={{ color: accent }}
                          >
                            {u.ctaLabel} &rarr;
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )
              }
            </div >
          )
          }

          {
            (!canManageAdmin || orgScope === "branch") && (
              <>
                {layoutType === "focus" && (
                  <div className={`rounded-2xl border p-3.5 mb-4 flex flex-wrap items-center justify-between gap-2.5 ${cardCls}`}>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: accent }} />
                      <span className="text-xs font-bold uppercase tracking-wider">
                        {isSw ? "Hali ya Kazi Moja kwa Moja (Focus Layout)" : "Counter Focus Strip"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setTab("operations")}
                        className="px-3.5 py-1.5 rounded-full text-white text-xs font-semibold cursor-pointer"
                        style={{ backgroundColor: accent }}
                      >
                        {isSw ? "Fungua Kaunta ya POS" : "Launch Counter POS"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setTab("inventory")}
                        className={`px-3.5 py-1.5 rounded-full border text-xs font-semibold cursor-pointer ${chipCls}`}
                      >
                        {isSw ? "Stoo & Makundi" : "Stock & Batches"}
                      </button>
                      <button
                        type="button"
                        onClick={() => openReport("sales")}
                        className={`px-3.5 py-1.5 rounded-full border text-xs font-semibold cursor-pointer ${chipCls}`}
                      >
                        {isSw ? "Ripoti ya Siku" : "Shift Totals"}
                      </button>
                    </div>
                  </div>
                )}

                {layoutType === "executive" && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                    <div className={`rounded-2xl border p-4 ${cardCls}`} style={{ borderTopColor: accent, borderTopWidth: "3px" }}>
                      <div className={`text-[10px] font-bold uppercase tracking-wider ${mutedCls}`}>{isSw ? "Mauzo (Siku 30)" : "30-Day Gross Sales"}</div>
                      <div className="text-xl font-bold tabular-nums mt-1">{formatTzs(grossSalesTzs)}</div>
                      <div className={`text-[11px] mt-0.5 ${mutedCls}`}>{sales.length} receipts</div>
                    </div>
                    <div className={`rounded-2xl border p-4 ${cardCls}`}>
                      <div className={`text-[10px] font-bold uppercase tracking-wider ${mutedCls}`}>{isSw ? "Faida Halisi" : "Net Profit & Margin"}</div>
                      <div className="text-xl font-bold tabular-nums mt-1 text-emerald-600 dark:text-emerald-400">{formatTzs(pnlSummary.netProfit)}</div>
                      <div className={`text-[11px] mt-0.5 ${mutedCls}`}>{pnlSummary.grossMarginPct}% gross margin</div>
                    </div>
                    <div className={`rounded-2xl border p-4 ${cardCls}`}>
                      <div className={`text-[10px] font-bold uppercase tracking-wider ${mutedCls}`}>Kasri Escrow Held</div>
                      <div className="text-xl font-bold tabular-nums mt-1">{formatTzs(escrowHeldTzs)}</div>
                      <div className={`text-[11px] mt-0.5 ${mutedCls}`}>{wholesaleOrders.filter((o) => o.escrowStatus === "escrow_held").length} orders awaiting delivery</div>
                    </div>
                    <div className={`rounded-2xl border p-4 ${cardCls}`}>
                      <div className={`text-[10px] font-bold uppercase tracking-wider ${mutedCls}`}>{isSw ? "Usalama wa Rafu" : "Expiry Watch"}</div>
                      <div className="text-xl font-bold tabular-nums mt-1">{validLotsCount} lots</div>
                      <div className="text-[11px] mt-0.5 text-amber-600">{stockAlerts.nearExpiryCount} expiring &middot; {stockAlerts.expiredCount} expired</div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch animate-stage-pop">
                  {layoutType === "balanced" && (
                    <div
                      className={`lg:col-span-4 min-h-[400px] rounded-[24px] border p-6 flex flex-col justify-between gap-4 relative overflow-hidden transition-all duration-300 ${isDark
                        ? "border-slate-800 bg-[#0D111A] text-white"
                        : "border-[#DCE3EC] bg-[#DFE6F0] text-[#111317] shadow-[0_8px_28px_rgba(15,23,42,0.04)]"
                        }`}
                    >
                      {/* Edge-to-Edge Full-Bleed Morphing Spotlight (No card-in-card border) */}
                      <StationSpotlightMedia
                        brandLogoUrl={account.customization?.brandLogoUrl}
                        orgName={account.orgName}
                        centreName={activeCentre?.name || account.orgName}
                        profileName={activeProfileName || account.fullName}
                        address={activeCentre?.address}
                        region={activeCentre?.region || account.region}
                        lat={activeCentre?.lat}
                        lng={activeCentre?.lng}
                        todaySalesTzs={todaySalesTzs}
                        validLotsCount={validLotsCount}
                        nearExpiryCount={stockAlerts.nearExpiryCount}
                        escrowHeldTzs={escrowHeldTzs}
                        accent={accent}
                        isDark={isDark}
                        isSw={isSw}
                      />

                      <div className="flex items-center justify-between relative z-20">
                        <span
                          className={`px-3 py-1 rounded-full text-[11px] font-semibold backdrop-blur-md ${isDark ? "bg-slate-900/75 text-white border border-slate-700" : "bg-white/85 text-[#111317]"
                            }`}
                        >
                          {spotlightState.eyebrow}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold shadow-xs ${spotlightState.badgeTone}`}>
                          {spotlightState.badge}
                        </span>
                      </div>

                      <div className="space-y-3 relative z-20 pt-36">
                        <div>
                          <div className="text-sm font-semibold">{spotlightState.title}</div>
                          <div className={`text-[11px] mt-0.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                            {spotlightState.desc}
                          </div>
                        </div>

                        {spotlightState.href ? (
                          <Link
                            href={spotlightState.href}
                            className="mx-auto flex items-center gap-3 pl-5 pr-1.5 py-1.5 rounded-full bg-white text-[#111317] hover:bg-slate-50 text-xs font-semibold shadow-sm w-fit"
                          >
                            <span>{spotlightState.ctaLabel}</span>
                            <span className="w-7 h-7 rounded-full bg-[#111317] text-white flex items-center justify-center text-xs">
                              &#8599;
                            </span>
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={spotlightState.onClick}
                            className="mx-auto flex items-center gap-3 pl-5 pr-1.5 py-1.5 rounded-full bg-white text-[#111317] hover:bg-slate-50 text-xs font-semibold shadow-sm cursor-pointer"
                          >
                            <span>{spotlightState.ctaLabel}</span>
                            <span className="w-7 h-7 rounded-full bg-[#111317] text-white flex items-center justify-center text-xs">
                              &#8599;
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className={`${layoutType === "balanced" ? "lg:col-span-8" : "lg:col-span-12"} flex flex-col gap-4`}>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      {/* Clickable Dispense Activity Card -> Opens Deep Sales & Heatmap Report */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => openReport("sales")}
                        onKeyDown={(e) => e.key === "Enter" && openReport("sales")}
                        className={`md:col-span-5 rounded-[24px] border p-5 flex flex-col justify-between gap-4 cursor-pointer text-left ${cardCls}`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-[14px] font-medium">{isSw ? "Shughuli & Utabiri" : "Dispense Activity"}</div>
                            <div className={`text-[11px] mt-0.5 ${mutedCls}`}>{isSw ? "Fungua ripoti ya mauzo" : "Sales, heatmap & 7d forecast"}</div>
                          </div>
                          <span className={`w-7 h-7 rounded-full border flex items-center justify-center text-[11px] ${chipCls}`}>
                            &#8599;
                          </span>
                        </div>

                        <div className="flex items-baseline justify-between gap-2">
                          <div className="text-3xl font-normal tracking-tight tabular-nums" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                            {sales.length}
                            <span className={`text-lg ml-1 ${mutedCls}`}>{isSw ? "mauzo" : "sales"}</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTab("operations");
                            }}
                            className="text-[11px] font-semibold hover:underline cursor-pointer"
                            style={{ color: accent }}
                          >
                            Open POS &rarr;
                          </button>
                        </div>

                        <div className="grid grid-cols-7 gap-1.5 items-end h-28 pt-5">
                          {weekActivity.map((col, idx) => (
                            <div
                              key={col.day}
                              onMouseEnter={() => setHoveredWeekIdx(idx)}
                              onMouseLeave={() => setHoveredWeekIdx(null)}
                              className="group flex flex-col items-center gap-1.5 h-full justify-end relative"
                            >
                              {(col.highlight || hoveredWeekIdx === idx) && (
                                <span className="px-2 py-0.5 rounded-full bg-[#E2F575] text-[#111317] text-[9px] font-bold whitespace-nowrap shadow-2xs">
                                  {col.badge}
                                </span>
                              )}
                              <div
                                className="w-full rounded-[10px] transition-all duration-300"
                                style={{
                                  height: `${col.heightPct}%`,
                                  backgroundColor:
                                    hoveredWeekIdx === idx
                                      ? accent
                                      : col.highlight
                                        ? "#E2F575"
                                        : isDark
                                          ? "rgba(148, 163, 184, 0.16)"
                                          : "#F1F3F5",
                                }}
                              />
                              <span className={`text-[10px] ${mutedCls}`}>{col.day}</span>
                            </div>
                          ))}
                        </div>
                        {hoveredWeekIdx !== null && weekActivity[hoveredWeekIdx] && (
                          <div className={`text-[11px] px-3 py-1.5 rounded-xl border mt-1 ${chipCls}`}>
                            <strong>{weekActivity[hoveredWeekIdx].day}:</strong> {weekActivity[hoveredWeekIdx].count}{" "}
                            {isSw ? "pakiti" : "packs"} &middot; {weekActivity[hoveredWeekIdx].txCount} tx &middot;{" "}
                            {formatTzs(weekActivity[hoveredWeekIdx].revenueTzs)}
                          </div>
                        )}
                      </div>

                      {/* Clickable Settlement -> Billing & P&L / Kasri Card */}
                      <div className={`md:col-span-7 rounded-[24px] border p-5 grid grid-cols-1 sm:grid-cols-12 gap-4 relative ${cardCls}`}>
                        <button
                          type="button"
                          onClick={() => (canManageAdmin ? setTab("billing") : openReport("sales"))}
                          className="sm:col-span-7 flex flex-col justify-between gap-4 text-left cursor-pointer"
                        >
                          <div>
                            <div className="text-[14px] font-medium">{isSw ? "Fedha, P&L & Malipo" : "Counter Settlement & P&L"}</div>
                            <div className={`text-[11px] mt-2 ${mutedCls}`}>{isSw ? "Mauzo ya siku 30" : "30-day revenue (Click for P&L)"}</div>
                            <div className="text-2xl sm:text-[26px] font-normal tracking-tight tabular-nums mt-0.5" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                              {formatTzs(grossSalesTzs)}
                            </div>
                            <div className="text-[11px] font-medium text-emerald-500 mt-0.5">
                              Net Profit: {formatTzs(pnlSummary.netProfit)} ({pnlSummary.grossMarginPct}% GM)
                            </div>
                          </div>

                          <div className="space-y-2.5 w-full">
                            <div className="flex items-center gap-2.5 text-[11px]">
                              <span className={`w-16 shrink-0 ${mutedCls}`}>Mobile</span>
                              <div className={`flex-1 h-7 rounded-xl overflow-hidden flex items-center px-3 ${isDark ? "bg-slate-800" : "bg-[#F3F4F6]"}`}>
                                <span className="font-semibold text-[11px]">{mobileSharePct}%</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2.5 text-[11px]">
                              <span className={`w-16 shrink-0 ${mutedCls}`}>Cash</span>
                              <div className={`w-28 h-7 rounded-xl flex items-center px-3 ${isDark ? "bg-slate-800/70" : "bg-[#F3F4F6]"}`}>
                                <span className="font-semibold text-[11px]">{cashSharePct}%</span>
                              </div>
                            </div>
                          </div>
                        </button>

                        <div className="sm:col-span-5 relative flex">
                          <button
                            type="button"
                            onClick={() => setTab("network")}
                            aria-label="Inspect Kasri escrow orders"
                            className={`hidden sm:flex absolute -left-5 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full border items-center justify-center text-xs shadow-md cursor-pointer transition-transform hover:scale-110 ${isDark ? "bg-slate-900 border-slate-700 text-white" : "bg-white border-[#EAECF0] text-[#111317]"
                              }`}
                          >
                            &#8599;
                          </button>
                          <button
                            type="button"
                            onClick={() => setTab("network")}
                            className={`w-full rounded-[20px] p-5 flex flex-col justify-between min-h-[180px] text-left cursor-pointer transition-transform hover:scale-[1.01] ${isDark ? "bg-[#152E23] text-emerald-50" : "bg-[#D5E4D6] text-[#111317]"
                              }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="text-[10px] font-semibold opacity-75">Kasri&#8482; Escrow</span>
                              <span className="text-xs font-extrabold tracking-tight">KASRI</span>
                            </div>
                            <div className="text-xl sm:text-2xl font-normal tracking-tight tabular-nums my-2" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                              TZS {escrowHeldTzs.toLocaleString("en-US")}
                            </div>
                            <div className="flex items-center justify-between w-full text-[10px] font-mono opacity-80">
                              <span>{wholesaleOrders.filter((o) => o.escrowStatus === "escrow_held").length} Held</span>
                              <span>Deliveries &rarr;</span>
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      {/* Clickable Shelf & Batch Guard Card -> Opens Expiry Write-Off Risk Subpage */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => openReport("stock")}
                        onKeyDown={(e) => e.key === "Enter" && openReport("stock")}
                        className={`md:col-span-7 rounded-[24px] border p-5 flex flex-col justify-between gap-4 cursor-pointer text-left ${cardCls}`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-[14px] font-medium">{isSw ? "Usalama wa Rafu" : "Shelf & Expiry Risk"}</div>
                            <div className={`text-[11px] mt-1 ${mutedCls}`}>{isSw ? "Utabiri wa hasara za muda" : "Expiry & stock health report"}</div>
                            <div className="text-2xl font-normal tracking-tight tabular-nums mt-0.5" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                              {productsSummary.length} {isSw ? "bidhaa" : "items"}
                            </div>
                            <div className="text-[11px] font-medium text-amber-600 mt-0.5">
                              {stockAlerts.nearExpiryCount} expiring &le; 30d &middot; {stockAlerts.expiredCount} blocked
                            </div>
                          </div>

                          <div className="flex flex-col gap-1.5 items-end">
                            <span className={`w-7 h-7 rounded-full border flex items-center justify-center text-[11px] mb-1 ${chipCls}`}>
                              &#8599;
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTab("inventory");
                              }}
                              className={`px-3 py-1 rounded-xl border text-[11px] font-semibold cursor-pointer ${chipCls}`}
                            >
                              Edit <strong>{validLotsCount}</strong> Lots &rarr;
                            </button>
                            <div className={`px-3 py-1 rounded-xl border text-[11px] ${chipCls}`}>
                              <strong>{stockAlerts.lowStockCount}</strong> Low Stock
                            </div>
                          </div>
                        </div>

                        <div className="relative h-28 w-full pt-1">
                          <svg viewBox="0 0 360 88" className="w-full h-full overflow-visible" aria-hidden="true">
                            <defs>
                              <linearGradient id="pharmaSplineFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={accent} stopOpacity="0.26" />
                                <stop offset="100%" stopColor={accent} stopOpacity="0.0" />
                              </linearGradient>
                            </defs>
                            <path d={fefoChart.areaD} fill="url(#pharmaSplineFill)" />
                            <path
                              d={fefoChart.lineD}
                              fill="none"
                              stroke={accent}
                              strokeWidth="2"
                            />
                            {fefoChart.nodes.map((pt) => (
                              <g key={pt.key}>
                                <circle
                                  cx={pt.x}
                                  cy={pt.y}
                                  r={hoveredRiskNode === pt.idx ? 6.5 : 4.5}
                                  fill={
                                    hoveredRiskNode === pt.idx
                                      ? accent
                                      : pt.key === "blocked" && pt.count > 0
                                        ? "#DC2626"
                                        : pt.key === "fefo" && pt.count > 0
                                          ? "#D97706"
                                          : isDark
                                            ? "#E2E8F0"
                                            : "#111317"
                                  }
                                  stroke="#FFFFFF"
                                  strokeWidth="1.5"
                                  className="cursor-pointer"
                                  onMouseEnter={(e) => {
                                    e.stopPropagation();
                                    setHoveredRiskNode(pt.idx);
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setHoveredRiskNode(pt.idx);
                                  }}
                                  onMouseLeave={() => setHoveredRiskNode(null)}
                                />
                                <text
                                  x={pt.x}
                                  y={86}
                                  textAnchor="middle"
                                  fontSize="8.5"
                                  fill={isDark ? "#94A3B8" : "#64748B"}
                                >
                                  {pt.label.split(" ")[0]} ({pt.count})
                                </text>
                              </g>
                            ))}
                          </svg>
                        </div>
                        {(() => {
                          const activeBucket =
                            hoveredRiskNode !== null ? fefoChart.nodes[hoveredRiskNode] : null;
                          if (!activeBucket) {
                            return (
                              <div className={`text-[11px] px-3 py-1.5 rounded-xl border flex items-center justify-between gap-2 ${chipCls}`}>
                                <span>
                                  {fefoChart.hasAnyStock
                                    ? isSw
                                      ? `Makundi ${validLotsCount} salama · ${stockAlerts.nearExpiryCount} yanakaribia kuisha <=30d`
                                      : `${validLotsCount} active lots · ${fefoChart.nodes[2].units.toLocaleString("en-US")} units expiring within 30d`
                                    : isSw
                                      ? "Hakuna mzigo rafuni bado. Ingiza makundi kuona mchoro halisi wa muda."
                                      : "No batches in stock yet. Receive batches to plot live expiry timeline."}
                                </span>
                              </div>
                            );
                          }
                          return (
                            <div className={`text-[11px] px-3 py-1.5 rounded-xl border ${chipCls}`}>
                              <strong>{activeBucket.label}:</strong> {activeBucket.count}{" "}
                              {isSw ? "makundi" : "batches"} &middot;{" "}
                              {activeBucket.units.toLocaleString("en-US")}{" "}
                              {isSw ? "vipimo" : "units"} &middot;{" "}
                              {formatTzs(activeBucket.valueTzs)}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Clickable Inventory Mix Card -> Opens Product Margin Intelligence */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => openReport("products")}
                        onKeyDown={(e) => e.key === "Enter" && openReport("products")}
                        className={`md:col-span-5 rounded-[24px] border p-5 flex flex-col justify-between gap-4 cursor-pointer text-left ${cardCls}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[14px] font-medium block">{isSw ? "Mchanganuo wa Faida" : "Product Mix & Margins"}</span>
                            <span className={`text-[10px] ${mutedCls}`}>{isSw ? "Fungua jedwali la faida" : "Product margins & cover"}</span>
                          </div>
                          <span className={`w-7 h-7 rounded-full border flex items-center justify-center text-[11px] ${chipCls}`}>
                            &#8599;
                          </span>
                        </div>

                        <div className="relative h-28 flex items-center justify-center group">
                          <div
                            className="w-24 h-24 rounded-full flex items-center justify-center text-xl font-normal transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
                            style={{
                              fontFamily: "Outfit, Inter, sans-serif",
                              background: isDark
                                ? "radial-gradient(circle at 30% 30%, rgba(56,189,248,0.38), rgba(14,116,144,0.22))"
                                : "radial-gradient(circle at 30% 30%, #B8E7EE, #7BCAD8)",
                              color: isDark ? "#E0F2FE" : "#111317",
                            }}
                          >
                            {categoryMix.rxPct}%
                          </div>
                          <div
                            className="w-12 h-12 rounded-full flex items-center justify-center text-xs font-medium -ml-3 -mt-12 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-1 group-hover:-translate-y-1"
                            style={{
                              background: isDark
                                ? "radial-gradient(circle at 30% 30%, rgba(96,165,250,0.4), rgba(37,99,235,0.22))"
                                : "radial-gradient(circle at 30% 30%, #DCEBFD, #B9D8FB)",
                              color: isDark ? "#EFF6FF" : "#111317",
                            }}
                          >
                            {categoryMix.otcPct}%
                          </div>
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-medium -ml-16 mt-16 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-x-1 group-hover:translate-y-1"
                            style={{
                              background: isDark
                                ? "radial-gradient(circle at 30% 30%, rgba(110,231,183,0.4), rgba(5,150,105,0.22))"
                                : "radial-gradient(circle at 30% 30%, #D9F5EC, #B7E9D9)",
                              color: isDark ? "#ECFDF5" : "#111317",
                            }}
                          >
                            {categoryMix.carePct}%
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center pt-1">
                          <div>
                            <div className="text-base font-medium tabular-nums">{categoryMix.rxUnits}</div>
                            <div className={`text-[10px] ${mutedCls}`}>Rx Units</div>
                          </div>
                          <div>
                            <div className="text-base font-medium tabular-nums">{categoryMix.otcUnits}</div>
                            <div className={`text-[10px] ${mutedCls}`}>OTC</div>
                          </div>
                          <div>
                            <div className="text-base font-medium tabular-nums">{categoryMix.rehydUnits}</div>
                            <div className={`text-[10px] ${mutedCls}`}>Care/ORS</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Live Audit Trail + Clickable Centres & Operators Roster */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  <section className={`lg:col-span-7 rounded-[24px] border overflow-hidden ${cardCls}`}>
                    <div
                      className={`px-6 py-4 border-b flex items-center justify-between ${isDark ? "border-slate-800" : "border-[#EAECF0]"
                        }`}
                    >
                      <div>
                        <h2 className="text-sm font-medium">{isSw ? "Kumbukumbu za Matukio" : "Audit Trail"}</h2>
                        <p className={`text-[11px] ${mutedCls}`}>Recent major workspace actions</p>
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-wider font-semibold" style={{ color: accent }}>
                        {filteredLogs.length} events
                      </span>
                    </div>

                    <div className={`divide-y ${isDark ? "divide-slate-800/80" : "divide-slate-100"}`}>
                      {filteredLogs.length === 0 ? (
                        <div className={`p-6 text-xs text-center ${mutedCls}`}>No matching audit events found.</div>
                      ) : (
                        filteredLogs.slice(0, 6).map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() =>
                              setInspectedListing({
                                title: entry.action,
                                badge: entry.category,
                                explanation: isSw
                                  ? `Tukio hili lilirekodiwa moja kwa moja na ${entry.actor} na haliwezi kufutwa.`
                                  : `Immutable audit record logged by ${entry.actor}.`,
                                fields: [
                                  { label: "Actor", value: entry.actor },
                                  { label: "Category", value: entry.category },
                                  { label: "Timestamp", value: entry.createdAt.slice(0, 19).replace("T", " ") },
                                ],
                              })
                            }
                            className="w-full px-6 py-3 flex items-start justify-between gap-3 text-xs text-left hover:bg-slate-500/5 cursor-pointer transition-colors"
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <span
                                className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold shrink-0 mt-0.5 ${isDark ? "bg-slate-800 text-[#38BDF8]" : "bg-[#F3F4F6] text-[#111317]"
                                  }`}
                              >
                                {entry.category}
                              </span>
                              <div className="min-w-0">
                                <div className="font-medium truncate">{entry.action}</div>
                                <div className={`text-[11px] ${mutedCls}`}>{entry.actor}</div>
                              </div>
                            </div>
                            <span className={`font-mono text-[10px] shrink-0 pt-0.5 ${mutedCls}`}>
                              {entry.createdAt.slice(11, 16)}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </section>

                  <section className={`lg:col-span-5 rounded-[24px] border p-6 space-y-3.5 ${cardCls}`}>
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-medium">{isSw ? "Vituo & Timu" : "Centres & Operators"}</h2>
                      <button
                        type="button"
                        onClick={() => setTab("team")}
                        className="text-xs font-semibold hover:underline cursor-pointer"
                        style={{ color: accent }}
                      >
                        Edit Team &rarr;
                      </button>
                    </div>

                    <div className="space-y-2">
                      {centres.map((c) => {
                        const isActive = c.id === activeCentre?.id;
                        const isPaused = c.status === "paused";
                        const isArchived = c.status === "archived";
                        const isExcluded = Boolean(c.excludedFromRollup);
                        return (
                          <div key={c.id} className={`p-3.5 rounded-2xl border text-xs space-y-2 ${chipCls}`}>
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <div className="font-semibold flex flex-wrap items-center gap-1.5">
                                  <span>{c.name}</span>
                                  {isPaused && (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-300 text-[9px] uppercase">
                                      Paused
                                    </span>
                                  )}
                                  {isArchived && (
                                    <span className="px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-500 text-[9px] uppercase">
                                      Archived
                                    </span>
                                  )}
                                  {isExcluded && (
                                    <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-600 dark:text-purple-300 text-[9px] uppercase">
                                      Excluded
                                    </span>
                                  )}
                                </div>
                                <div className={`text-[11px] ${mutedCls}`}>
                                  {c.address} &middot; {c.region}
                                </div>
                              </div>
                              {isActive ? (
                                <span className="px-2.5 py-0.5 rounded-full bg-[#E2F575] text-[#111317] text-[10px] font-bold">
                                  Synced
                                </span>
                              ) : canManageAdmin && onSwitchCentre ? (
                                <button
                                  type="button"
                                  onClick={() => onSwitchCentre(c.id)}
                                  className="px-2.5 py-1 rounded-full border text-[10px] font-semibold cursor-pointer hover:opacity-80"
                                  style={{ borderColor: accent, color: accent }}
                                >
                                  Inspect &rarr;
                                </button>
                              ) : null}
                            </div>
                            {canManageAdmin && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                <button
                                  type="button"
                                  disabled={branchBusy}
                                  onClick={() =>
                                    void handleManageCentre(c.id, isPaused || isArchived ? "resume" : "pause")
                                  }
                                  className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold cursor-pointer ${cardCls}`}
                                >
                                  {isPaused || isArchived ? "Resume" : "Pause"}
                                </button>
                                <button
                                  type="button"
                                  disabled={branchBusy}
                                  onClick={() => void handleManageCentre(c.id, "toggle_exclude")}
                                  className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold cursor-pointer ${cardCls}`}
                                >
                                  {isExcluded ? "Include" : "Exclude"}
                                </button>
                                <button
                                  type="button"
                                  disabled={branchBusy}
                                  onClick={() =>
                                    void handleManageCentre(c.id, isArchived ? "restore" : "archive")
                                  }
                                  className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold cursor-pointer ${cardCls}`}
                                >
                                  {isArchived ? "Restore" : "Archive"}
                                </button>
                                {!c.isPrimary && centres.length > 1 && (
                                  <button
                                    type="button"
                                    disabled={branchBusy}
                                    onClick={() => void handleManageCentre(c.id, "delete")}
                                    className="px-2 py-0.5 rounded-full border border-rose-500/40 text-rose-500 text-[10px] font-semibold cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className={`pt-2 border-t text-[11px] flex items-center justify-between ${isDark ? "border-slate-800" : "border-slate-100"} ${mutedCls}`}>
                      <button
                        type="button"
                        onClick={() => openReport("people")}
                        className="hover:underline cursor-pointer"
                      >
                        {profiles.filter((p) => !activeCentre?.id || p.centreId === activeCentre.id).length} staff &middot; View League &rarr;
                      </button>
                      <button type="button" data-tour="branch-chat-cta" onClick={onOpenChat} className="font-semibold hover:underline cursor-pointer" style={{ color: accent }}>
                        Open Branch Chat &rarr;
                      </button>
                    </div>
                  </section>
                </div>
              </>
            )
          }
        </>
      )}

      {/* Clean Listing Focus Card Inspector Modal (Expenses, Audit Events, etc.) */}
      {
        inspectedListing && (
          <div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setInspectedListing(null)}>
            <div onClick={(e) => e.stopPropagation()} className={`w-full max-w-md rounded-[26px] border p-6 space-y-4 shadow-2xl animate-stage-pop ${cardCls}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-[#1039B9] dark:text-[#38BDF8] font-mono text-[10px] font-bold">
                    {inspectedListing.badge}
                  </span>
                  <h3 className="text-base font-bold mt-1.5">{inspectedListing.title}</h3>
                </div>
                <button type="button" onClick={() => setInspectedListing(null)} className={`px-3 py-1 rounded-full border text-xs font-semibold cursor-pointer ${chipCls}`}>
                  &times;
                </button>
              </div>
              <p className={`text-xs leading-relaxed ${mutedCls}`}>{inspectedListing.explanation}</p>
              <div className="space-y-2 text-xs">
                {inspectedListing.fields.map((f) => (
                  <div key={f.label} className={`p-3 rounded-xl border flex justify-between ${chipCls}`}>
                    <span className={mutedCls}>{f.label}</span>
                    <span className="font-bold">{f.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      }
      <WorkspaceTour
        open={tourOpen}
        onClose={(markDone) => {
          setTourOpen(false);
          if (markDone && typeof window !== "undefined" && activeProfileId) {
            try {
              window.localStorage.setItem(`cervos-tour-done-${activeProfileId}`, "1");
            } catch {
              // Ignore
            }
          }
        }}
        orgName={account.orgName}
        branchName={activeCentre?.name || account.region}
        isDark={isDark}
        isSw={isSw}
        accent={accent}
        onJumpTab={(nextTab) => setTab(nextTab)}
      />
    </div >
  );
}
