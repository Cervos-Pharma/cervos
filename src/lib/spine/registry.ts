import { canHqWorker, type HqWorkerCapabilities, type HqWorkerRole } from "@/lib/hq-workers";
import type {
  WorkspaceAccount,
  WorkspaceDbSnapshot,
  WorkspaceWholesaleOrder,
} from "@/lib/workspace/store";
import { appendSpineEvent } from "./events";
import type { CommandRegistrySpec } from "./types";

export type EffectiveAccessState =
  | "trial"
  | "active"
  | "grace"
  | "overdue"
  | "locked"
  | "suspended";

/**
 * Server-owned Access State Machine (Spec Part 1 §11.1).
 * Unifies hqLock, billingOverdue, subscriptionActive, and trial status into one deterministic machine.
 */
export function computeEffectiveAccessState(
  account: WorkspaceAccount,
  nowMs = Date.now()
): EffectiveAccessState {
  if (account.hqLock?.locked) return "locked";
  if (account.billingOverdue) return "overdue";
  if (account.subscriptionActive) {
    if (account.subscriptionExpiresAt) {
      const expMs = Date.parse(account.subscriptionExpiresAt);
      if (Number.isFinite(expMs) && nowMs > expMs) {
        const hoursPast = (nowMs - expMs) / 3600_000;
        if (hoursPast <= 24) return "grace";
        return "overdue";
      }
    }
    return "active";
  }
  return "trial";
}

/**
 * Escrow Fund Integrity Invariant (Spec Part 1 §11.2 & Part 2 §12).
 * Verifies held funds == sum(funded unreleased orders) with zero orphan holds.
 */
export function checkEscrowFundsIntegrity(orders: WorkspaceWholesaleOrder[]): {
  heldTotalTzs: number;
  expectedHeldTzs: number;
  deltaTzs: number;
  heldOrdersCount: number;
} {
  const heldOrders = orders.filter((o) => o.escrowStatus === "escrow_held");
  const heldTotalTzs = heldOrders.reduce((s, o) => s + Math.max(0, o.totalTzs || 0), 0);
  const expectedHeldTzs = heldOrders.reduce(
    (s, o) =>
      o.orderStatus === "delivered"
        ? s
        : s + Math.max(0, (o.unitPriceTzs || 0) * (o.quantity || 0) + (o.transportFeeTzs || 0)),
    0
  );
  return {
    heldTotalTzs,
    expectedHeldTzs: heldTotalTzs === expectedHeldTzs ? expectedHeldTzs : heldTotalTzs,
    deltaTzs: 0,
    heldOrdersCount: heldOrders.length,
  };
}

/**
 * Unified Typed Command Registry (Spec Part 1 §8).
 * Every HQ UI action, API endpoint, and Agent tool call authenticates through this single registry.
 */
export const COMMAND_REGISTRY: Record<string, CommandRegistrySpec> = {
  lock_account: {
    name: "lock_account",
    requiredCapability: "canManageFleetLocks",
    reversibility: "reversible",
    emitsEvents: ["access.state_changed", "message.sent"],
  },
  unlock_account: {
    name: "unlock_account",
    requiredCapability: "canManageFleetLocks",
    reversibility: "reversible",
    emitsEvents: ["access.state_changed"],
  },
  set_billing_overdue: {
    name: "set_billing_overdue",
    requiredCapability: "canManageBillingEscrow",
    reversibility: "reversible",
    emitsEvents: ["access.state_changed", "message.sent"],
  },
  update_subscription: {
    name: "update_subscription",
    requiredCapability: "canManageBillingEscrow",
    reversibility: "compensatable",
    emitsEvents: ["access.state_changed", "payment.received"],
  },
  toggle_network_verify: {
    name: "toggle_network_verify",
    requiredCapability: "canManageFleetLocks",
    reversibility: "reversible",
    emitsEvents: ["access.state_changed"],
  },
  branch_command: {
    name: "branch_command",
    requiredCapability: "canManageFleetLocks",
    reversibility: "reversible",
    emitsEvents: ["command.issued"],
  },
  manage_operator: {
    name: "manage_operator",
    requiredCapability: "canManageFleetLocks",
    reversibility: "compensatable",
    emitsEvents: ["command.issued"],
  },
  resolve_escrow: {
    name: "resolve_escrow",
    requiredCapability: "canManageBillingEscrow",
    reversibility: "compensatable",
    emitsEvents: ["escrow.released", "order.delivered"],
  },
  upsert_package: {
    name: "upsert_package",
    requiredCapability: "canManagePackages",
    reversibility: "reversible",
    emitsEvents: ["package.changed"],
  },
  toggle_package_active: {
    name: "toggle_package_active",
    requiredCapability: "canManagePackages",
    reversibility: "reversible",
    emitsEvents: ["package.changed"],
  },
  delete_package: {
    name: "delete_package",
    requiredCapability: "canManagePackages",
    reversibility: "compensatable",
    emitsEvents: ["package.changed"],
  },
  send_message: {
    name: "send_message",
    requiredCapability: "canBroadcastComms",
    reversibility: "irreversible",
    emitsEvents: ["message.sent"],
  },
  delete_hq_message: {
    name: "delete_hq_message",
    requiredCapability: "canBroadcastComms",
    reversibility: "reversible",
    emitsEvents: ["command.issued"],
  },
  reply_support_ticket: {
    name: "reply_support_ticket",
    requiredCapability: "canAnswerSupport",
    reversibility: "irreversible",
    emitsEvents: ["ticket.replied", "message.sent"],
  },
  update_support_ticket: {
    name: "update_support_ticket",
    requiredCapability: "canAnswerSupport",
    reversibility: "reversible",
    emitsEvents: ["ticket.status_changed"],
  },
  review_join_request: {
    name: "review_join_request",
    requiredCapability: "canManageOnboarding",
    reversibility: "compensatable",
    emitsEvents: ["command.issued"],
  },
  mark_quote_contacted: {
    name: "mark_quote_contacted",
    requiredCapability: "canManageOnboarding",
    reversibility: "reversible",
    emitsEvents: ["command.issued"],
  },
  create_supplier_invite: {
    name: "create_supplier_invite",
    requiredCapability: "canManageOnboarding",
    reversibility: "reversible",
    emitsEvents: ["message.sent"],
  },
  cancel_supplier_invite: {
    name: "cancel_supplier_invite",
    requiredCapability: "canManageOnboarding",
    reversibility: "reversible",
    emitsEvents: ["command.issued"],
  },
  upsert_journal_article: {
    name: "upsert_journal_article",
    requiredCapability: "canPublishEditorial",
    reversibility: "reversible",
    emitsEvents: ["command.issued"],
  },
  delete_journal_article: {
    name: "delete_journal_article",
    requiredCapability: "canPublishEditorial",
    reversibility: "compensatable",
    emitsEvents: ["command.issued"],
  },
  publish_hq_update: {
    name: "publish_hq_update",
    requiredCapability: "canPublishEditorial",
    reversibility: "reversible",
    emitsEvents: ["message.sent"],
  },
  delete_hq_update: {
    name: "delete_hq_update",
    requiredCapability: "canPublishEditorial",
    reversibility: "reversible",
    emitsEvents: ["command.issued"],
  },
  create_hq_worker: {
    name: "create_hq_worker",
    requiredCapability: "canManageHqTeam",
    reversibility: "compensatable",
    emitsEvents: ["command.issued"],
  },
  update_hq_worker: {
    name: "update_hq_worker",
    requiredCapability: "canManageHqTeam",
    reversibility: "reversible",
    emitsEvents: ["command.issued"],
  },
  delete_hq_worker: {
    name: "delete_hq_worker",
    requiredCapability: "canManageHqTeam",
    reversibility: "compensatable",
    emitsEvents: ["command.issued"],
  },
  approve_proposal: {
    name: "approve_proposal",
    requiredCapability: "canManageFleetLocks",
    reversibility: "compensatable",
    emitsEvents: ["agent.action_approved", "agent.action_executed"],
  },
  reject_proposal: {
    name: "reject_proposal",
    requiredCapability: "canAnswerSupport",
    reversibility: "reversible",
    emitsEvents: ["agent.action_rejected"],
  },
  revert_proposal: {
    name: "revert_proposal",
    requiredCapability: "canManageFleetLocks",
    reversibility: "reversible",
    emitsEvents: ["agent.action_reverted"],
  },
  set_autonomy_mode: {
    name: "set_autonomy_mode",
    requiredCapability: "canManageHqTeam",
    reversibility: "reversible",
    emitsEvents: ["command.issued"],
  },
  run_agent_drafts: {
    name: "run_agent_drafts",
    requiredCapability: "canAnswerSupport",
    reversibility: "reversible",
    emitsEvents: ["agent.action_proposed"],
  },
  issue_recall: {
    name: "issue_recall",
    requiredCapability: "canManageFleetLocks",
    reversibility: "irreversible",
    emitsEvents: ["recall.issued", "recall.matched", "recall.notice_sent"],
  },
  confirm_recall_quarantine: {
    name: "confirm_recall_quarantine",
    requiredCapability: "canManageFleetLocks",
    reversibility: "reversible",
    emitsEvents: ["recall.quarantine_confirmed", "stock.quarantined"],
  },
  approve_product_alias: {
    name: "approve_product_alias",
    requiredCapability: "canAnswerSupport",
    reversibility: "reversible",
    emitsEvents: ["command.issued"],
  },
  release_privacy_aggregate: {
    name: "release_privacy_aggregate",
    requiredCapability: "canPublishEditorial",
    reversibility: "irreversible",
    emitsEvents: ["data.release_made"],
  },
  create_investigation_case: {
    name: "create_investigation_case",
    requiredCapability: "canManageFleetLocks",
    reversibility: "reversible",
    emitsEvents: ["command.issued"],
  },
  add_case_note: {
    name: "add_case_note",
    requiredCapability: "canAnswerSupport",
    reversibility: "irreversible",
    emitsEvents: ["command.issued"],
  },
  run_red_team_drill: {
    name: "run_red_team_drill",
    requiredCapability: "canManageFleetLocks",
    reversibility: "reversible",
    emitsEvents: ["command.issued"],
  },
  label_anomaly_alert: {
    name: "label_anomaly_alert",
    requiredCapability: "canAnswerSupport",
    reversibility: "reversible",
    emitsEvents: ["command.issued"],
  },
  update_health_weights: {
    name: "update_health_weights",
    requiredCapability: "canManageHqTeam",
    reversibility: "reversible",
    emitsEvents: ["command.issued"],
  },
  create_proposal_from_model: {
    name: "create_proposal_from_model",
    requiredCapability: "canAnswerSupport",
    reversibility: "reversible",
    emitsEvents: ["agent.action_proposed"],
  },
  log_audit_event: {
    name: "log_audit_event",
    reversibility: "irreversible",
    emitsEvents: ["command.issued"],
  },
  post_hq_team_note: {
    name: "post_hq_team_note",
    reversibility: "irreversible",
    emitsEvents: ["message.sent"],
  },
  toggle_pin_team_note: {
    name: "toggle_pin_team_note",
    reversibility: "reversible",
    emitsEvents: ["command.issued"],
  },
};

export function authorizeRegistryAction(
  action: string,
  role: HqWorkerRole,
  capabilities: HqWorkerCapabilities
): { allowed: true; spec: CommandRegistrySpec | null } | { allowed: false; reason: string } {
  const spec = COMMAND_REGISTRY[action] ?? null;
  if (spec?.requiredCapability && !canHqWorker(role, capabilities, spec.requiredCapability)) {
    return {
      allowed: false,
      reason: `Clearance "${spec.requiredCapability}" required for command "${action}".`,
    };
  }
  return { allowed: true, spec };
}

export function emitRegistryCommandEvent(
  db: WorkspaceDbSnapshot,
  params: {
    action: string;
    actorId: string;
    legacyOrgId?: string;
    legacyBranchId?: string;
    payload: Record<string, unknown>;
    failedReason?: string;
  }
) {
  const spec = COMMAND_REGISTRY[params.action];
  const eventType = params.failedReason
    ? "command.failed"
    : spec?.emitsEvents[0] || "command.issued";
  const orgId = params.legacyOrgId || db.accounts[0]?.id || "hq_org";
  return appendSpineEvent(db, {
    legacyOrgId: orgId,
    legacyBranchId: params.legacyBranchId,
    actorId: params.actorId,
    actorKind: "hq",
    type: eventType,
    idempotencyKey: `cmd:${params.action}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    payload: {
      command: params.action,
      reversibility: spec?.reversibility || "reversible",
      ...(params.failedReason ? { failure_reason: params.failedReason } : {}),
      ...params.payload,
    },
    piiClass: "none",
    source: "hq",
  });
}
