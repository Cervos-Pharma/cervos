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
    immutableTrue: ["canViewOwnReports"],
    immutableFalse: [],
    ruleNote: "Personal shift performance stays visible; owner sets inventory and all other permissions freely.",
    swRuleNote: "Utendaji binafsi unaonekana daima; mmiliki hupanga haki za stoo na vibali vingine apendavyo.",
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
    immutableTrue: ["canViewOwnReports"],
    immutableFalse: [],
    ruleNote: "Personal shift performance stays ON; sensitive inventory & other permissions are configured by owner.",
    swRuleNote: "Ripoti binafsi hubaki wazi; stoo na haki zingine nyeti hupangwa na mmiliki apendavyo.",
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
    immutableFalse: [],
    ruleNote: "Personal shift report stays ON; owner configures inventory and operational controls as needed.",
    swRuleNote: "Ripoti binafsi hubaki wazi; mmiliki hupanga ruhusa za stoo na kazi zingine apendavyo.",
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
    immutableTrue: ["canViewOwnReports"],
    immutableFalse: [],
    ruleNote: "Personal shift report stays ON; owner decides access to inventory, finance, and team governance.",
    swRuleNote: "Ripoti binafsi hubaki wazi; mmiliki huamua nani aone stoo, fedha, au timu.",
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
    immutableTrue: ["canViewOwnReports"],
    immutableFalse: [],
    ruleNote: "Personal activity view stays ON; owner decides inventory and all other permissions.",
    swRuleNote: "Kumbukumbu binafsi hubaki wazi; mmiliki hupanga stoo na vibali vingine.",
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
    immutableTrue: ["canViewOwnReports"],
    immutableFalse: [],
    ruleNote: "Personal performance view stays ON; owner controls inventory and operational permissions.",
    swRuleNote: "Ripoti binafsi hubaki wazi; mmiliki huamua ruhusa za stoo na shughuli zingine.",
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
