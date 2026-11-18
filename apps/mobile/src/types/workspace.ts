import type { ProfileCapabilities, WorkspaceProfileRole } from "@/utils/permissions";

export type AppLang = "EN" | "SW";

export interface WorkspaceCentre {
  id: string;
  name: string;
  region: string;
  address: string;
  phone?: string;
  lat?: number;
  lng?: number;
  isPrimary?: boolean;
}

export interface WorkspaceProfileSummary {
  id: string;
  centreId: string;
  username?: string;
  displayName: string;
  role: WorkspaceProfileRole | string;
  isMasterAdmin: boolean;
  capabilities?: Partial<ProfileCapabilities>;
  profilePrefs?: {
    fontScale?: "compact" | "standard" | "large";
    themePref?: "light" | "dark" | "system";
    preferredLang?: AppLang;
  };
}

export interface WorkspaceBatch {
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

export interface WorkspaceSale {
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
  lines?: WorkspaceSaleLine[];
  createdAt: string;
}

export interface SavedCustomerPreset {
  id: string;
  centreId: string;
  customerName: string;
  phone?: string;
  note?: string;
  items: Array<{ productId: string; brandName: string; qty: number }>;
  createdAt: string;
}

export interface WorkspaceShiftLog {
  id: string;
  centreId: string;
  profileId: string;
  staffName: string;
  role: string;
  clockInAt: string;
  clockOutAt?: string;
  durationMinutes?: number;
}

export type BranchChatReactionKind = "check" | "thumbs_up" | "heart";

export interface BranchChatMessage {
  id: string;
  centreId: string;
  senderProfileId: string;
  senderName: string;
  senderRole: string;
  body: string;
  replyTo?: { id: string; senderName: string; body: string };
  mentions?: string[];
  reactions?: Array<{
    kind: BranchChatReactionKind;
    profileId: string;
    name: string;
  }>;
  attachment?: {
    kind: "wholesale_request" | "batch" | "sale" | "order";
    refId: string;
    catalogId?: string;
    quantity?: number;
    amountTzs?: number;
    title: string;
    subtitle: string;
    approvalStatus?: "pending" | "approved" | "declined";
  };
  createdAt: string;
}

export interface WorkspaceWholesaleOrder {
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

export interface WorkspaceCatalogItem {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierCity?: string;
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

export interface WorkspaceExpense {
  id: string;
  centreId: string;
  category: string;
  description: string;
  amountTzs: number;
  createdAt: string;
}

export interface WorkspaceHqMessage {
  id: string;
  title: string;
  swTitle: string;
  body: string;
  swBody: string;
  severity: "info" | "action" | "critical";
  ctaLabel?: string;
  acknowledged?: boolean;
  senderName: string;
  createdAt: string;
}

export interface WorkspaceJoinRequest {
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
  allocatedCentreName?: string;
  allocatedRole?: string;
  allocatedPinPreview?: string;
  createdAt: string;
}

export interface WorkspaceStateResponse {
  authenticated: boolean;
  loungeOnly?: boolean;
  account: {
    id: string;
    email: string;
    fullName: string;
    roleType: string;
    orgName: string;
    region: string;
    lang: AppLang;
    onboardingDone: boolean;
    verificationStatus: "skipped" | "verified";
    networkUnlocked: boolean;
    subscriptionActive: boolean;
    subscriptionPlan: string;
    subscriptionExpiresAt?: string;
    subscriptionDaysLeft?: number | null;
    subscriptionInGraceDay?: boolean;
    billingOverdue?: boolean;
    trialEndsAt?: string;
    requireSecurityEveryTime?: boolean;
    securityQuestion?: string;
    customCategories?: string[];
    accessLock?: { locked: boolean; source: "hq" | "billing" | null; reason: string };
    customization?: {
      brandLogoUrl?: string;
      brandAccent?: string;
      fontScale?: "compact" | "standard" | "large";
      layoutType?: "balanced" | "focus" | "executive";
      themePref?: "light" | "dark" | "system";
    };
  };
  centres: WorkspaceCentre[];
  profiles: WorkspaceProfileSummary[];
  activeCentreId: string | null;
  activeProfile: WorkspaceProfileSummary | null;
  batches?: WorkspaceBatch[];
  sales?: WorkspaceSale[];
  savedCustomers?: SavedCustomerPreset[];
  shiftLogs?: WorkspaceShiftLog[];
  branchMessages?: BranchChatMessage[];
  wholesaleOrders?: WorkspaceWholesaleOrder[];
  supplierCatalog?: WorkspaceCatalogItem[];
  expenses?: WorkspaceExpense[];
  hqMessages?: WorkspaceHqMessage[];
  joinRequests?: WorkspaceJoinRequest[];
  stockAlerts?: { nearExpiryCount: number; expiredCount: number; lowStockCount: number };
  pendingSubscription?: {
    reference: string;
    planName: string;
    amountTzs: number;
    status: string;
  } | null;
}

export const DEFAULT_DRUG_CATEGORIES = [
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
