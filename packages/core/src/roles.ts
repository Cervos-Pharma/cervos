export type StakeholderGroup =
  | "patient"
  | "business_owner"
  | "business_operator"
  | "regulator"
  | "researcher"
  | "hospital"
  | "supplier"
  | "prescriber"
  | "hq";

export type CervosRole =
  | "patient"
  | "pharmacy_owner"
  | "branch_manager"
  | "superintendent_pharmacist"
  | "pharmaceutical_tech"
  | "pos_cashier"
  | "inventory_clerk"
  | "regulator_tmda"
  | "policy_researcher"
  | "hospital_pharmacist"
  | "supplier_admin"
  | "sales_account_mgr"
  | "warehouse_dispatcher"
  | "physician_prescriber"
  | "hq_super_admin"
  | "hq_finance"
  | "hq_support";

export interface RolePermissions {
  stakeholder: StakeholderGroup;
  canonicalRole: CervosRole;
  canDispenseControlled: boolean;
  canApproveRx: boolean;
  canOverrideDiscount: boolean;
  canCloseShift: boolean;
  canViewCostMargins: boolean;
  canEditSettings: boolean;
  canExportData: boolean;
  canManageBranches: boolean;
  canBroadcastRecall: boolean;
  canIssueClaimToken: boolean;
  canRequestHospitalTransfer: boolean;
  canAccessResearchTelemetry: boolean;
}

export interface StakeholderLensSpec {
  order: number;
  group: Exclude<StakeholderGroup, "hq">;
  label: string;
  defaultRoute: string;
  roles: CervosRole[];
  summary: string;
  guardrail: string;
}

export const STAKEHOLDER_LENS_CATALOG: readonly StakeholderLensSpec[] = [
  {
    order: 1,
    group: "patient",
    label: "Patient",
    defaultRoute: "/ecosystem?lens=patient",
    roles: ["patient"],
    summary: "Find verified in-stock medicines nearby and redeem prescriptions with claim tokens.",
    guardrail: "Never exposes wholesale cost margins or internal branch cash drawers.",
  },
  {
    order: 2,
    group: "business_owner",
    label: "Business Owner",
    defaultRoute: "/dashboard",
    roles: ["pharmacy_owner", "branch_manager"],
    summary: "Multi-branch P&L, shift cash accountability, PayMe billing, and team provisioning.",
    guardrail: "Enforces tenant-scoped ownership across all linked branches and billing payments.",
  },
  {
    order: 3,
    group: "business_operator",
    label: "Business Operator",
    defaultRoute: "/branch",
    roles: [
      "superintendent_pharmacist",
      "pharmaceutical_tech",
      "pos_cashier",
      "inventory_clerk",
    ],
    summary: "Fast FEFO POS dispensing, 1-second PIN lock, blind shift close, and GRN intake.",
    guardrail: "Operator PIN lock never disconnects the terminal's background cloud sync session.",
  },
  {
    order: 4,
    group: "regulator",
    label: "Regulator (TMDA)",
    defaultRoute: "/hq",
    roles: ["regulator_tmda"],
    summary: "Permit verification, Schedule IV custody ledger, and nationwide batch recall quarantine.",
    guardrail: "Every recall broadcast and compliance override writes an immutable audit trail entry.",
  },
  {
    order: 5,
    group: "researcher",
    label: "Researcher",
    defaultRoute: "/ecosystem?lens=researcher",
    roles: ["policy_researcher"],
    summary: "Anonymized ATC/INN velocity telemetry, WHO AWaRe stewardship, and ML demand tensors.",
    guardrail: "Strict de-identification: aggregates exclude patient PII and commercial branch margins.",
  },
  {
    order: 6,
    group: "hospital",
    label: "Hospital",
    defaultRoute: "/ecosystem?lens=hospital",
    roles: ["hospital_pharmacist"],
    summary: "Inpatient/outpatient stockout radar, inter-facility emergency transfers, and tender POs.",
    guardrail: "Priority emergency lot matching verifies remaining shelf life >= 60 days by default.",
  },
  {
    order: 7,
    group: "supplier",
    label: "Supplier",
    defaultRoute: "/supplier",
    roles: ["supplier_admin", "sales_account_mgr", "warehouse_dispatcher"],
    summary: "Catalog publishing, RFQ tender bids, batch/expiry ASN dispatch, and escrow release.",
    guardrail: "Stock decrements inside ACID transactions; escrow releases only upon confirmed GRN.",
  },
  {
    order: 8,
    group: "prescriber",
    label: "Prescriber",
    defaultRoute: "/ecosystem?lens=prescriber",
    roles: ["physician_prescriber"],
    summary: "MCT-licensed e-Rx origination with claim_token and live nearby pharmacy stock check.",
    guardrail: "Schedule IV orders generate single-use cryptographic claim tokens tied to prescriber ID.",
  },
] as const;

const LEGACY_ROLE_MAP: Record<string, CervosRole> = {
  admin: "pharmacy_owner",
  pharmacy: "pharmacy_owner",
  pharmacy_owner: "pharmacy_owner",
  PHARMACY_OWNER: "pharmacy_owner",
  branch_manager: "branch_manager",
  pharmacist_in_charge: "superintendent_pharmacist",
  PHARMACIST_IN_CHARGE: "superintendent_pharmacist",
  superintendent_pharmacist: "superintendent_pharmacist",
  pharmacy_tech: "pharmaceutical_tech",
  PHARMACY_TECH: "pharmaceutical_tech",
  pharmaceutical_tech: "pharmaceutical_tech",
  operator: "pos_cashier",
  pos_cashier: "pos_cashier",
  inventory_clerk: "inventory_clerk",
  supplier: "supplier_admin",
  SUPPLIER: "supplier_admin",
  supplier_admin: "supplier_admin",
  sales_account_mgr: "sales_account_mgr",
  warehouse_dispatcher: "warehouse_dispatcher",
  physician: "physician_prescriber",
  PHYSICIAN: "physician_prescriber",
  physician_prescriber: "physician_prescriber",
  patient: "patient",
  PATIENT: "patient",
  hospital_pharmacist: "hospital_pharmacist",
  regulator_tmda: "regulator_tmda",
  policy_researcher: "policy_researcher",
  POLICY_RESEARCHER: "policy_researcher",
  hq_admin: "hq_super_admin",
  HQ_ADMIN: "hq_super_admin",
  hq_super_admin: "hq_super_admin",
  hq_finance: "hq_finance",
  hq_support: "hq_support",
};

export function normalizeCervosRole(rawRole: string | null | undefined): CervosRole {
  if (!rawRole) return "pos_cashier";
  const trimmed = rawRole.trim();
  return LEGACY_ROLE_MAP[trimmed] ?? LEGACY_ROLE_MAP[trimmed.toLowerCase()] ?? "pos_cashier";
}

export function resolvePermissions(rawRole: string | null | undefined): RolePermissions {
  const canonicalRole = normalizeCervosRole(rawRole);

  switch (canonicalRole) {
    case "pharmacy_owner":
      return {
        stakeholder: "business_owner",
        canonicalRole,
        canDispenseControlled: true,
        canApproveRx: true,
        canOverrideDiscount: true,
        canCloseShift: true,
        canViewCostMargins: true,
        canEditSettings: true,
        canExportData: true,
        canManageBranches: true,
        canBroadcastRecall: false,
        canIssueClaimToken: false,
        canRequestHospitalTransfer: false,
        canAccessResearchTelemetry: false,
      };
    case "branch_manager":
      return {
        stakeholder: "business_owner",
        canonicalRole,
        canDispenseControlled: true,
        canApproveRx: true,
        canOverrideDiscount: true,
        canCloseShift: true,
        canViewCostMargins: true,
        canEditSettings: true,
        canExportData: true,
        canManageBranches: false,
        canBroadcastRecall: false,
        canIssueClaimToken: false,
        canRequestHospitalTransfer: false,
        canAccessResearchTelemetry: false,
      };
    case "superintendent_pharmacist":
      return {
        stakeholder: "business_operator",
        canonicalRole,
        canDispenseControlled: true,
        canApproveRx: true,
        canOverrideDiscount: true,
        canCloseShift: true,
        canViewCostMargins: true,
        canEditSettings: false,
        canExportData: true,
        canManageBranches: false,
        canBroadcastRecall: false,
        canIssueClaimToken: false,
        canRequestHospitalTransfer: false,
        canAccessResearchTelemetry: false,
      };
    case "pharmaceutical_tech":
      return {
        stakeholder: "business_operator",
        canonicalRole,
        canDispenseControlled: false,
        canApproveRx: true,
        canOverrideDiscount: false,
        canCloseShift: true,
        canViewCostMargins: false,
        canEditSettings: false,
        canExportData: false,
        canManageBranches: false,
        canBroadcastRecall: false,
        canIssueClaimToken: false,
        canRequestHospitalTransfer: false,
        canAccessResearchTelemetry: false,
      };
    case "pos_cashier":
      return {
        stakeholder: "business_operator",
        canonicalRole,
        canDispenseControlled: false,
        canApproveRx: false,
        canOverrideDiscount: false,
        canCloseShift: true,
        canViewCostMargins: false,
        canEditSettings: false,
        canExportData: false,
        canManageBranches: false,
        canBroadcastRecall: false,
        canIssueClaimToken: false,
        canRequestHospitalTransfer: false,
        canAccessResearchTelemetry: false,
      };
    case "inventory_clerk":
      return {
        stakeholder: "business_operator",
        canonicalRole,
        canDispenseControlled: false,
        canApproveRx: false,
        canOverrideDiscount: false,
        canCloseShift: false,
        canViewCostMargins: true,
        canEditSettings: false,
        canExportData: false,
        canManageBranches: false,
        canBroadcastRecall: false,
        canIssueClaimToken: false,
        canRequestHospitalTransfer: false,
        canAccessResearchTelemetry: false,
      };
    case "regulator_tmda":
      return {
        stakeholder: "regulator",
        canonicalRole,
        canDispenseControlled: false,
        canApproveRx: false,
        canOverrideDiscount: false,
        canCloseShift: false,
        canViewCostMargins: false,
        canEditSettings: false,
        canExportData: true,
        canManageBranches: false,
        canBroadcastRecall: true,
        canIssueClaimToken: false,
        canRequestHospitalTransfer: false,
        canAccessResearchTelemetry: true,
      };
    case "policy_researcher":
      return {
        stakeholder: "researcher",
        canonicalRole,
        canDispenseControlled: false,
        canApproveRx: false,
        canOverrideDiscount: false,
        canCloseShift: false,
        canViewCostMargins: false,
        canEditSettings: false,
        canExportData: true,
        canManageBranches: false,
        canBroadcastRecall: false,
        canIssueClaimToken: false,
        canRequestHospitalTransfer: false,
        canAccessResearchTelemetry: true,
      };
    case "hospital_pharmacist":
      return {
        stakeholder: "hospital",
        canonicalRole,
        canDispenseControlled: true,
        canApproveRx: true,
        canOverrideDiscount: true,
        canCloseShift: true,
        canViewCostMargins: true,
        canEditSettings: true,
        canExportData: true,
        canManageBranches: true,
        canBroadcastRecall: false,
        canIssueClaimToken: true,
        canRequestHospitalTransfer: true,
        canAccessResearchTelemetry: true,
      };
    case "supplier_admin":
    case "sales_account_mgr":
    case "warehouse_dispatcher":
      return {
        stakeholder: "supplier",
        canonicalRole,
        canDispenseControlled: false,
        canApproveRx: false,
        canOverrideDiscount: canonicalRole === "supplier_admin",
        canCloseShift: false,
        canViewCostMargins: canonicalRole !== "warehouse_dispatcher",
        canEditSettings: canonicalRole === "supplier_admin",
        canExportData: canonicalRole === "supplier_admin",
        canManageBranches: false,
        canBroadcastRecall: false,
        canIssueClaimToken: false,
        canRequestHospitalTransfer: false,
        canAccessResearchTelemetry: false,
      };
    case "physician_prescriber":
      return {
        stakeholder: "prescriber",
        canonicalRole,
        canDispenseControlled: false,
        canApproveRx: false,
        canOverrideDiscount: false,
        canCloseShift: false,
        canViewCostMargins: false,
        canEditSettings: false,
        canExportData: false,
        canManageBranches: false,
        canBroadcastRecall: false,
        canIssueClaimToken: true,
        canRequestHospitalTransfer: false,
        canAccessResearchTelemetry: true,
      };
    case "patient":
      return {
        stakeholder: "patient",
        canonicalRole,
        canDispenseControlled: false,
        canApproveRx: false,
        canOverrideDiscount: false,
        canCloseShift: false,
        canViewCostMargins: false,
        canEditSettings: false,
        canExportData: false,
        canManageBranches: false,
        canBroadcastRecall: false,
        canIssueClaimToken: false,
        canRequestHospitalTransfer: false,
        canAccessResearchTelemetry: false,
      };
    case "hq_super_admin":
    case "hq_finance":
    case "hq_support":
      return {
        stakeholder: "hq",
        canonicalRole,
        canDispenseControlled: false,
        canApproveRx: false,
        canOverrideDiscount: false,
        canCloseShift: false,
        canViewCostMargins: canonicalRole !== "hq_support",
        canEditSettings: canonicalRole === "hq_super_admin",
        canExportData: true,
        canManageBranches: canonicalRole !== "hq_support",
        canBroadcastRecall: canonicalRole === "hq_super_admin",
        canIssueClaimToken: false,
        canRequestHospitalTransfer: false,
        canAccessResearchTelemetry: true,
      };
  }
}

export interface CommercialTierSpec {
  id: string;
  audience: "pharmacy" | "supplier" | "hospital";
  name: string;
  priceMonthlyTzs: number;
  priceAnnualTzs: number;
  maxBranches: number | null;
  maxOperators: number | null;
  maxSuppliers: number | null;
  maxConnectedPharmacies: number | null;
  features: readonly string[];
}

export const COMMERCIAL_PLAN_CATALOG: readonly CommercialTierSpec[] = [
  {
    id: "payg",
    audience: "pharmacy",
    name: "PAYG / ADDO Micro",
    priceMonthlyTzs: 10000,
    priceAnnualTzs: 100000,
    maxBranches: 1,
    maxOperators: 2,
    maxSuppliers: 2,
    maxConnectedPharmacies: null,
    features: ["Offline SQLite POS", "FEFO Expiry Alerts", "Bilingual EN/SW Labels"],
  },
  {
    id: "community_standard",
    audience: "pharmacy",
    name: "Community Standard",
    priceMonthlyTzs: 45000,
    priceAnnualTzs: 450000,
    maxBranches: 1,
    maxOperators: 6,
    maxSuppliers: 10,
    maxConnectedPharmacies: null,
    features: ["Blind Shift Close", "B2B Marketplace + GRN", "Schedule IV Rx PIN Override"],
  },
  {
    id: "chain_growth",
    audience: "pharmacy",
    name: "Chain Growth",
    priceMonthlyTzs: 140000,
    priceAnnualTzs: 1400000,
    maxBranches: 10,
    maxOperators: 50,
    maxSuppliers: 30,
    maxConnectedPharmacies: null,
    features: ["Inter-Branch Stock Transfers", "EWMA Draft PO Intelligence", "Central Owner Analytics"],
  },
  {
    id: "hospital_enterprise",
    audience: "hospital",
    name: "Hospital & Institutional",
    priceMonthlyTzs: 320000,
    priceAnnualTzs: 3200000,
    maxBranches: null,
    maxOperators: null,
    maxSuppliers: null,
    maxConnectedPharmacies: null,
    features: ["Stockout Radar", "Inter-Facility Surplus Transfer", "Prescriber claim_token + TMDA Vault"],
  },
  {
    id: "supplier_starter",
    audience: "supplier",
    name: "Verified Catalog Starter",
    priceMonthlyTzs: 60000,
    priceAnnualTzs: 600000,
    maxBranches: 1,
    maxOperators: 3,
    maxSuppliers: null,
    maxConnectedPharmacies: 15,
    features: ["Verified Catalog", "B2B Order Fulfilment", "PayMe Escrow Settlement"],
  },
  {
    id: "wholesale_growth",
    audience: "supplier",
    name: "Wholesale Growth",
    priceMonthlyTzs: 180000,
    priceAnnualTzs: 1800000,
    maxBranches: 5,
    maxOperators: 15,
    maxSuppliers: null,
    maxConnectedPharmacies: 150,
    features: ["RFQ Tender Bidding", "Lot/Expiry ASN Dispatch", "Multi-Warehouse Inventory"],
  },
  {
    id: "enterprise_importer",
    audience: "supplier",
    name: "Enterprise Importer / Manufacturer",
    priceMonthlyTzs: 450000,
    priceAnnualTzs: 4500000,
    maxBranches: null,
    maxOperators: null,
    maxSuppliers: null,
    maxConnectedPharmacies: null,
    features: ["Regional Stockout Heatmaps", "Recall Broadcast Hooks", "Chain Contract Pricing"],
  },
] as const;

