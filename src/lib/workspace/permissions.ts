export type WorkspaceProfileRole =
  | "pharmacy_owner"
  | "superintendent_pharmacist"
  | "pos_cashier"
  | "supplier_admin"
  | "warehouse_dispatcher"
  | "hospital_pharmacist"
  | "policy_researcher"
  | "investor_partner";

export interface ProfileCapabilities {
  canSellPos: boolean;
  canViewOwnReports: boolean;
  canViewOrgReports: boolean;
  canEditInventory: boolean;
  canManageWholesale: boolean;
  canViewFinance: boolean;
  canManageTeam: boolean;
  canExportReports: boolean;
}

export const PERMISSION_METADATA: Array<{
  key: keyof ProfileCapabilities;
  label: string;
  swLabel: string;
  desc: string;
  swDesc: string;
}> = [
  {
    key: "canSellPos",
    label: "Counter POS & Receipts",
    swLabel: "Kaunta ya POS & Risiti",
    desc: "Issue patient receipts with FEFO enforcement",
    swDesc: "Uza dawa na kutoa risiti kwa mpangilio wa FEFO",
  },
  {
    key: "canViewOwnReports",
    label: "Personal Shift Report",
    swLabel: "Ripoti Yangu Binafsi",
    desc: "View own receipts, basket average & daily count",
    swDesc: "Ona mauzo na utendaji wako binafsi wa zamu",
  },
  {
    key: "canViewOrgReports",
    label: "Organization Analytics",
    swLabel: "Takwimu za Shirika Zima",
    desc: "Compare branches, staff league & shop-wide forecasts",
    swDesc: "Linganisha matawi, timu na utabiri wa duka zima",
  },
  {
    key: "canEditInventory",
    label: "Inventory & Batch Guard",
    swLabel: "Hifadhi & Marekebisho ya Stoo",
    desc: "Add lots, adjust shelf counts & quarantine batches",
    swDesc: "Ongeza au rekebisha stoo na kuweka dawa karantini",
  },
  {
    key: "canManageWholesale",
    label: "B2B Wholesale & Escrow",
    swLabel: "Oda za Jumla & Kasri Escrow",
    desc: "Place wholesale POs directly without owner approval",
    swDesc: "Agiza stoo moja kwa moja kutoka kwa wasambazaji",
  },
  {
    key: "canViewFinance",
    label: "Finance, P&L & Expenses",
    swLabel: "Fedha, Faida Halisi & Matumizi",
    desc: "View gross/net margin, expenses & settlement settings",
    swDesc: "Angalia faida halisi, matumizi na malipo ya benki",
  },
  {
    key: "canManageTeam",
    label: "Team Permits & PINs",
    swLabel: "Timu, Vibali & PIN",
    desc: "Approve lounge joiners & edit operator access",
    swDesc: "Idhinisha wafanyakazi na kubadilisha vibali",
  },
  {
    key: "canExportReports",
    label: "Clean PDF & CSV Export",
    swLabel: "Pakua Ripoti (PDF & CSV)",
    desc: "Print or download bilingual summary statements",
    swDesc: "Chapisha au pakua ripoti safi za PDF na CSV",
  },
];

export const ROLE_PERMISSION_RULES: Record<
  WorkspaceProfileRole,
  {
    defaults: ProfileCapabilities;
    immutableTrue: Array<keyof ProfileCapabilities>;
    immutableFalse: Array<keyof ProfileCapabilities>;
    ruleNote: string;
    swRuleNote: string;
  }
> = {
  pharmacy_owner: {
    defaults: {
      canSellPos: true,
      canViewOwnReports: true,
      canViewOrgReports: true,
      canEditInventory: true,
      canManageWholesale: true,
      canViewFinance: true,
      canManageTeam: true,
      canExportReports: true,
    },
    immutableTrue: ["canViewOwnReports", "canViewOrgReports", "canViewFinance", "canManageTeam", "canExportReports"],
    immutableFalse: [],
    ruleNote: "Owner keeps finance, organization analytics, team permits, and audit governance permanently locked ON.",
    swRuleNote: "Mmiliki huhifadhi mamlaka kamili ya fedha, timu, na ukaguzi bila kuondolewa.",
  },
  supplier_admin: {
    defaults: {
      canSellPos: false,
      canViewOwnReports: true,
      canViewOrgReports: true,
      canEditInventory: true,
      canManageWholesale: true,
      canViewFinance: true,
      canManageTeam: true,
      canExportReports: true,
    },
    immutableTrue: ["canViewOwnReports", "canViewOrgReports", "canViewFinance", "canManageTeam", "canExportReports"],
    immutableFalse: [],
    ruleNote: "Supplier Admin keeps wholesale ledger, finance, and team governance locked ON.",
    swRuleNote: "Msimamizi wa Bohari huhifadhi fedha, maagizo na usimamizi wa timu.",
  },
  superintendent_pharmacist: {
    defaults: {
      canSellPos: true,
      canViewOwnReports: true,
      canViewOrgReports: true,
      canEditInventory: true,
      canManageWholesale: true,
      canViewFinance: false,
      canManageTeam: false,
      canExportReports: true,
    },
    immutableTrue: ["canViewOwnReports", "canEditInventory"],
    immutableFalse: ["canManageTeam"],
    ruleNote: "Pharmacist keeps personal shift report & FEFO stock guard; cannot alter team permits.",
    swRuleNote: "Mfamasia mkuu huhifadhi ripoti binafsi na ulinzi wa stoo (FEFO); hawezi kudhibiti timu.",
  },
  pos_cashier: {
    defaults: {
      canSellPos: true,
      canViewOwnReports: true,
      canViewOrgReports: false,
      canEditInventory: false,
      canManageWholesale: false,
      canViewFinance: false,
      canManageTeam: false,
      canExportReports: true,
    },
    immutableTrue: ["canSellPos", "canViewOwnReports"],
    immutableFalse: ["canEditInventory", "canManageWholesale", "canViewFinance", "canManageTeam"],
    ruleNote: "Counter guardrail: always sees POS & own shift report; blocked from batch overrides, B2B escrow, P&L & team permits.",
    swRuleNote: "Sheria ya kaunta: huona POS na ripoti yake tu; hawezi kubadili stoo, B2B au fedha za shirika.",
  },
  warehouse_dispatcher: {
    defaults: {
      canSellPos: false,
      canViewOwnReports: true,
      canViewOrgReports: false,
      canEditInventory: true,
      canManageWholesale: true,
      canViewFinance: false,
      canManageTeam: false,
      canExportReports: true,
    },
    immutableTrue: ["canViewOwnReports"],
    immutableFalse: ["canViewFinance", "canManageTeam"],
    ruleNote: "Dispatcher keeps stock intake & personal shift report; finance P&L and team permits stay locked.",
    swRuleNote: "Mpanga stoo huona stoo na ripoti yake; fedha na timu vimefungwa.",
  },
  hospital_pharmacist: {
    defaults: {
      canSellPos: true,
      canViewOwnReports: true,
      canViewOrgReports: true,
      canEditInventory: true,
      canManageWholesale: true,
      canViewFinance: false,
      canManageTeam: false,
      canExportReports: true,
    },
    immutableTrue: ["canViewOwnReports", "canEditInventory"],
    immutableFalse: ["canManageTeam"],
    ruleNote: "Clinical pharmacist maintains FEFO ward stock; team governance remains owner-only.",
    swRuleNote: "Mfamasia wa kliniki hudhibiti FEFO; vibali vya timu ni vya mmiliki pekee.",
  },
  policy_researcher: {
    defaults: {
      canSellPos: false,
      canViewOwnReports: true,
      canViewOrgReports: true,
      canEditInventory: false,
      canManageWholesale: false,
      canViewFinance: false,
      canManageTeam: false,
      canExportReports: true,
    },
    immutableTrue: ["canViewOwnReports", "canExportReports"],
    immutableFalse: ["canSellPos", "canEditInventory", "canManageWholesale", "canManageTeam"],
    ruleNote: "Research profile keeps analytics & export access; transactional writes stay locked.",
    swRuleNote: "Mtafiti huona uchambuzi pekee bila kubadilisha mauzo wala stoo.",
  },
  investor_partner: {
    defaults: {
      canSellPos: false,
      canViewOwnReports: true,
      canViewOrgReports: true,
      canEditInventory: false,
      canManageWholesale: false,
      canViewFinance: true,
      canManageTeam: false,
      canExportReports: true,
    },
    immutableTrue: ["canViewOwnReports", "canViewOrgReports", "canExportReports"],
    immutableFalse: ["canSellPos", "canEditInventory", "canManageWholesale", "canManageTeam"],
    ruleNote: "Partner keeps organization metrics & finance views; counter & batch writes remain locked.",
    swRuleNote: "Mbia huona takwimu na fedha za shirika; hawezi kuuza wala kubadili stoo.",
  },
};

export function clampProfileCapabilities(
  role: WorkspaceProfileRole,
  requested?: Partial<ProfileCapabilities> | null,
  isMasterAdmin?: boolean
): ProfileCapabilities {
  const effectiveRole: WorkspaceProfileRole = isMasterAdmin ? "pharmacy_owner" : role;
  const rules = ROLE_PERMISSION_RULES[effectiveRole] ?? ROLE_PERMISSION_RULES.pos_cashier;
  const merged: ProfileCapabilities = { ...rules.defaults };
  if (requested) {
    (Object.keys(rules.defaults) as Array<keyof ProfileCapabilities>).forEach((k) => {
      if (typeof requested[k] === "boolean") {
        merged[k] = requested[k] as boolean;
      }
    });
  }
  for (const k of rules.immutableTrue) merged[k] = true;
  for (const k of rules.immutableFalse) merged[k] = false;
  return merged;
}
