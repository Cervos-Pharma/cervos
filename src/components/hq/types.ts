export type AuditCategory =
  | "AUTH"
  | "SETUP"
  | "SECURITY"
  | "POS"
  | "COMPLIANCE"
  | "BILLING";

export type HqTab =
  | "overview"
  | "fleet"
  | "packages"
  | "finance"
  | "onboarding"
  | "journal"
  | "comms";

export interface HqPackageRecord {
  id: string;
  audience: "pharmacy" | "hospital" | "supplier";
  name: string;
  priceMonthlyTzs: number;
  priceAnnualTzs: number;
  pricePerBranchMonthlyTzs: number;
  includedAdminsPerBranch: number;
  includedOperatorsPerBranch: number;
  extraOperatorMonthlyTzs: number;
  maxBranches: number | null;
  maxOperators: number | null;
  maxSuppliers: number | null;
  maxConnectedPharmacies: number | null;
  features: string[];
  active: boolean;
}

export interface HqWholesaleOrderRecord {
  id: string;
  accountId: string;
  orgName: string;
  orderReference: string;
  supplierName: string;
  productName: string;
  quantity: number;
  totalTzs: number;
  escrowStatus: "escrow_held" | "released" | "cancelled";
  orderStatus: "pending" | "in_transit" | "delivered";
  createdAt: string;
}

export interface HqQuoteRequestRecord {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  planName: string;
  locations: number;
  status: string;
  createdAt: string;
}

export interface HqSupplierInviteRecord {
  id: string;
  email: string;
  companyName: string;
  status: string;
  createdAt: string;
}

export interface HqFleetCentre {
  id: string;
  name: string;
  region: string;
  address: string;
  phone: string;
  lat?: number;
  lng?: number;
  isPrimary: boolean;
  staffCount: number;
  createdAt: string;
}

export interface HqFleetProfile {
  id: string;
  centreId: string;
  username?: string;
  displayName: string;
  role: string;
  isMasterAdmin: boolean;
}

export interface HqFleetAccount {
  id: string;
  username?: string;
  email: string;
  fullName: string;
  roleType: string;
  customRoleLabel?: string;
  orgName: string;
  region: string;
  lang: "EN" | "SW";
  onboardingDone: boolean;
  verificationStatus: "skipped" | "verified";
  networkUnlocked: boolean;
  subscriptionActive: boolean;
  subscriptionPlan: string;
  billingOverdue: boolean;
  trialEndsAt?: string;
  hqLock?: {
    locked: boolean;
    reason: string;
    lockedBy: string;
    lockedAt: string;
  };
  accessLock: {
    locked: boolean;
    source: "hq" | "billing" | null;
    reason: string;
  };
  certificates: Array<{
    id: string;
    docType: string;
    licenseNumber: string;
    fileName: string;
    uploadedAt: string;
  }>;
  createdAt: string;
  trustGeneration: number;
  centresCount: number;
  centres: HqFleetCentre[];
  profilesCount: number;
  profiles: HqFleetProfile[];
  salesCount: number;
  salesRevenueTzs: number;
  sales30dTzs: number;
  batchesCount: number;
  stockUnitsTotal: number;
  stockValueAtCostTzs: number;
  nearExpiryCount: number;
  expiredCount: number;
  lowStockCount: number;
  quarantinedCount: number;
  wholesaleOrdersCount: number;
  wholesaleVolumeTzs: number;
  escrowHeldCount: number;
  expensesTotalTzs: number;
  auditEventsCount: number;
  lastActivityAt: string;
  pendingJoinRequestsCount: number;
  unacknowledgedHqMessagesCount: number;
  planMaxBranches?: number | null;
  planMaxOperators?: number | null;
  subscriptionDaysLeft?: number | null;
  expiryExposureTzs?: number;
  estimatedMonthlyFeeTzs?: number;
}

export interface HqAuditEvent {
  id: string;
  accountId: string;
  orgName: string;
  region: string;
  actor: string;
  category: AuditCategory;
  action: string;
  createdAt: string;
}

export interface HqMessageRecord {
  id: string;
  accountId: string;
  orgName: string;
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

export interface HqJoinRequestRecord {
  id: string;
  targetAccountId: string;
  targetOrgName: string;
  requesterFullName: string;
  requesterUsername: string;
  requesterEmail: string;
  requesterSex: string;
  requesterLang: "EN" | "SW";
  requesterRegion: string;
  requestedRoleLabel?: string;
  note?: string;
  status: "pending" | "approved" | "declined" | "accepted";
  allocatedCentreId?: string;
  allocatedCentreName?: string;
  allocatedRole?: string;
  allocatedPinPreview?: string;
  declineReason?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface HqUpdateRecord {
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

export interface HqFleetSummary {
  totalOrgs: number;
  activeOrgs: number;
  trialOrgs: number;
  lockedOrgs: number;
  hqLockedOrgs: number;
  billingOverdueOrgs: number;
  verifiedOrgs: number;
  totalBranches: number;
  totalOperators: number;
  totalSalesCount: number;
  totalSalesRevenueTzs: number;
  totalStockCostTzs: number;
  nearExpiryBatches: number;
  expiredBatches: number;
  pendingJoinRequests: number;
  unreadHqMessages: number;
}

export interface HqJournalArticleRecord {
  id: string;
  slug: string;
  topic: "field" | "craft" | "supply";
  titleEn: string;
  titleSw: string;
  deckEn: string;
  deckSw: string;
  quoteEn: string;
  quoteSw: string;
  paragraphsEn: string[];
  paragraphsSw: string[];
  author: string;
  authorRoleEn: string;
  authorRoleSw: string;
  image: string;
  status: "draft" | "published";
  publishedAt: string;
  updatedAt: string;
}

export interface HqPeakTelemetry {
  monthlyRecurringRevenueTzs: number;
  expiryExposureTzs: number;
  regionDemand: Array<{
    region: string;
    orgsCount: number;
    branchesCount: number;
    revenue30dTzs: number;
    lowStockCount: number;
    expiryExposureTzs: number;
  }>;
  topDispensedProducts: Array<{
    brandName: string;
    genericName: string;
    unitsSold: number;
    revenueTzs: number;
  }>;
}

export interface HqNotificationEnv {
  hqEndpointConfigured: boolean;
  exceptionWebhookConfigured: boolean;
  exceptionEmailConfigured: boolean;
  exceptionEmailMasked: string | null;
  trialGraceDays: number;
  mode: "production" | "staging" | "mock";
}

export interface HqFleetPayload {
  scope: "fleet";
  operator: string;
  minBranchPriceTzs: number;
  fleetSummary: HqFleetSummary;
  peakTelemetry?: HqPeakTelemetry;
  accounts: HqFleetAccount[];
  packages: HqPackageRecord[];
  wholesaleOrders: HqWholesaleOrderRecord[];
  quoteRequests: HqQuoteRequestRecord[];
  supplierInvites: HqSupplierInviteRecord[];
  auditLogs: HqAuditEvent[];
  auditCategoryCounts: Record<AuditCategory, number>;
  hqMessages: HqMessageRecord[];
  joinRequests: HqJoinRequestRecord[];
  hqUpdates: HqUpdateRecord[];
  journalArticles?: HqJournalArticleRecord[];
  notificationEnv: HqNotificationEnv;
}
