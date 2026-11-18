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

export interface RolePermissionRule {
  defaults: ProfileCapabilities;
  immutableTrue: Array<keyof ProfileCapabilities>;
  immutableFalse: Array<keyof ProfileCapabilities>;
}

export const ROLE_PERMISSION_RULES: Record<WorkspaceProfileRole, RolePermissionRule> = {
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
    immutableTrue: [
      "canViewOwnReports",
      "canViewOrgReports",
      "canViewFinance",
      "canManageTeam",
      "canExportReports",
    ],
    immutableFalse: [],
  },
  supplier_admin: {
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
    immutableTrue: [
      "canViewOwnReports",
      "canViewOrgReports",
      "canViewFinance",
      "canManageTeam",
      "canExportReports",
    ],
    immutableFalse: [],
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
