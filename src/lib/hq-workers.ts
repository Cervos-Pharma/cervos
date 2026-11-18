/**
 * @file lib/hq-workers.ts
 * @description Role-based access control (RBAC) and onboarding metadata for internal
 * Cervos HQ operators (`hq_master`, `support_specialist`, `finance_controller`,
 * `compliance_auditor`, `editorial_growth`). Pure client- & server-safe helpers.
 */

export type HqWorkerRole =
  | "hq_master"
  | "support_specialist"
  | "finance_controller"
  | "compliance_auditor"
  | "editorial_growth";

export interface HqWorkerCapabilities {
  canManageHqTeam: boolean;
  canAnswerSupport: boolean;
  canManageFleetLocks: boolean;
  canManageBillingEscrow: boolean;
  canManagePackages: boolean;
  canManageOnboarding: boolean;
  canPublishEditorial: boolean;
  canBroadcastComms: boolean;
}

export interface HqWorkerRoleMeta {
  role: HqWorkerRole;
  label: string;
  shortTag: string;
  summary: string;
  defaultTitle: string;
}

export const HQ_ROLE_METADATA: Record<HqWorkerRole, HqWorkerRoleMeta> = {
  hq_master: {
    role: "hq_master",
    label: "HQ Master",
    shortTag: "MASTER",
    defaultTitle: "Sovereign Operations Master",
    summary: "Full platform sovereignty: onboard HQ workers, configure pricing floors, release escrow, and lock workspaces.",
  },
  support_specialist: {
    role: "support_specialist",
    label: "Support Specialist",
    shortTag: "SUPPORT",
    defaultTitle: "Customer Support & Onboarding Specialist",
    summary: "Answers live support tickets, approves Welcome Lounge staff joins, handles quotes, and messages pharmacies.",
  },
  finance_controller: {
    role: "finance_controller",
    label: "Finance & Escrow",
    shortTag: "FINANCE",
    defaultTitle: "Kasri Settlement & Billing Controller",
    summary: "Oversees Kasri wholesale escrow releases, subscription grace/billing states, quotes, and financial exports.",
  },
  compliance_auditor: {
    role: "compliance_auditor",
    label: "Compliance Auditor",
    shortTag: "COMPLIANCE",
    defaultTitle: "TMDA & FEFO Compliance Inspector",
    summary: "Monitors FEFO expiry exposure, enforces regulatory locks, logs audit notes, and publishes compliance alerts.",
  },
  editorial_growth: {
    role: "editorial_growth",
    label: "Journal & Growth",
    shortTag: "EDITORIAL",
    defaultTitle: "The Dispatch Editor & Network Growth",
    summary: "Authors bilingual Dispatch Journal stories, product releases, and partner outreach.",
  },
};

const ALL_CAPABILITIES_TRUE: HqWorkerCapabilities = {
  canManageHqTeam: true,
  canAnswerSupport: true,
  canManageFleetLocks: true,
  canManageBillingEscrow: true,
  canManagePackages: true,
  canManageOnboarding: true,
  canPublishEditorial: true,
  canBroadcastComms: true,
};

export const HQ_ROLE_DEFAULT_CAPS: Record<HqWorkerRole, HqWorkerCapabilities> = {
  hq_master: { ...ALL_CAPABILITIES_TRUE },
  support_specialist: {
    canManageHqTeam: false,
    canAnswerSupport: true,
    canManageFleetLocks: false,
    canManageBillingEscrow: false,
    canManagePackages: false,
    canManageOnboarding: true,
    canPublishEditorial: false,
    canBroadcastComms: true,
  },
  finance_controller: {
    canManageHqTeam: false,
    canAnswerSupport: true,
    canManageFleetLocks: false,
    canManageBillingEscrow: true,
    canManagePackages: true,
    canManageOnboarding: true,
    canPublishEditorial: false,
    canBroadcastComms: false,
  },
  compliance_auditor: {
    canManageHqTeam: false,
    canAnswerSupport: true,
    canManageFleetLocks: true,
    canManageBillingEscrow: false,
    canManagePackages: false,
    canManageOnboarding: false,
    canPublishEditorial: true,
    canBroadcastComms: true,
  },
  editorial_growth: {
    canManageHqTeam: false,
    canAnswerSupport: false,
    canManageFleetLocks: false,
    canManageBillingEscrow: false,
    canManagePackages: false,
    canManageOnboarding: true,
    canPublishEditorial: true,
    canBroadcastComms: true,
  },
};

export function sanitizeHqRole(raw: unknown): HqWorkerRole {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (
    s === "hq_master" ||
    s === "support_specialist" ||
    s === "finance_controller" ||
    s === "compliance_auditor" ||
    s === "editorial_growth"
  ) {
    return s;
  }
  // Backwards compatibility for legacy token role string "ops_admin"
  if (s === "ops_admin") return "hq_master";
  return "support_specialist";
}

export function clampHqCapabilities(
  role: HqWorkerRole,
  override?: Partial<HqWorkerCapabilities> | null
): HqWorkerCapabilities {
  if (role === "hq_master") {
    return { ...ALL_CAPABILITIES_TRUE };
  }
  const base = HQ_ROLE_DEFAULT_CAPS[role];
  if (!override || typeof override !== "object") {
    return { ...base };
  }
  return {
    canManageHqTeam: false, // Only hq_master manages HQ worker onboarding & access
    canAnswerSupport: typeof override.canAnswerSupport === "boolean" ? override.canAnswerSupport : base.canAnswerSupport,
    canManageFleetLocks: typeof override.canManageFleetLocks === "boolean" ? override.canManageFleetLocks : base.canManageFleetLocks,
    canManageBillingEscrow: typeof override.canManageBillingEscrow === "boolean" ? override.canManageBillingEscrow : base.canManageBillingEscrow,
    canManagePackages: typeof override.canManagePackages === "boolean" ? override.canManagePackages : base.canManagePackages,
    canManageOnboarding: typeof override.canManageOnboarding === "boolean" ? override.canManageOnboarding : base.canManageOnboarding,
    canPublishEditorial: typeof override.canPublishEditorial === "boolean" ? override.canPublishEditorial : base.canPublishEditorial,
    canBroadcastComms: typeof override.canBroadcastComms === "boolean" ? override.canBroadcastComms : base.canBroadcastComms,
  };
}

export function canHqWorker(
  role: HqWorkerRole,
  caps: HqWorkerCapabilities | undefined,
  permission: keyof HqWorkerCapabilities
): boolean {
  if (role === "hq_master") return true;
  if (!caps) return HQ_ROLE_DEFAULT_CAPS[role][permission];
  return Boolean(caps[permission]);
}
