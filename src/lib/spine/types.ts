import type { HqWorkerCapabilities } from "@/lib/hq-workers";
import type {
  HqAutonomyMode,
  HqDecisionProposal,
  HqHealthWeights,
  HqInvestigationCase,
  HqPrivacyReleaseRecord,
  HqProductAliasRecord,
  HqRecallRecord,
  HqSpineEventItem,
} from "@/components/hq/types";

export interface LegacyIdMapEntry {
  legacyId: string;
  entityType: "org" | "branch" | "person" | "lot" | "sale" | "order" | "ticket";
  id: string;
  source: "workspace_db" | "relational" | "desktop" | "mobile";
  createdAt: string;
}

export interface ProductMasterRecord {
  id: string;
  inn: string;
  strength: string;
  form: string;
  route: string;
  atcCode: string;
  controlledClass: "none" | "schedule_ii" | "controlled";
  barcodes: string[];
}

export interface GlobalLotRecord {
  id: string;
  masterId: string;
  manufacturerName: string;
  batchNumber: string;
  expiryDate: string;
  firstSeenEvent: string;
}

export interface BranchStockHoldingRecord {
  branchId: string;
  lotId: string;
  orgId: string;
  qty: number;
  avgCostTzs: number;
  quarantined: boolean;
  lastEventSeq: number;
}

export interface SpineEdgeRecord {
  srcType: string;
  srcId: string;
  rel:
    | "HOLDS"
    | "SOLD_FROM"
    | "SUPPLIED_BY"
    | "INSTANCE_OF"
    | "FUNDED_BY"
    | "TARGETS"
    | "MEMBER_OF";
  dstType: string;
  dstId: string;
  validFrom: string;
  validTo?: string | null;
  sourceEvent: string;
}

export interface SpineEventEnvelope extends HqSpineEventItem {
  schemaVersion: number;
  occurredAt: string;
  deviceId?: string;
  actorId?: string;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string;
  payload: Record<string, unknown>;
  prevHash: string;
}

export interface CommandRegistrySpec {
  name: string;
  requiredCapability?: keyof HqWorkerCapabilities;
  reversibility: "reversible" | "compensatable" | "irreversible";
  emitsEvents: string[];
}

export interface WorkspaceSpineStore {
  canonicalVersion?: number;
  globalSeqCounter: number;
  backfilledAt?: string;
  legacyIdMap: LegacyIdMapEntry[];
  productMaster: ProductMasterRecord[];
  productAliases: HqProductAliasRecord[];
  lots: GlobalLotRecord[];
  stockHoldings: BranchStockHoldingRecord[];
  edges: SpineEdgeRecord[];
  events: SpineEventEnvelope[];
  proposals: HqDecisionProposal[];
  autonomyConfig: Record<string, HqAutonomyMode>;
  recalls: HqRecallRecord[];
  privacyReleases: HqPrivacyReleaseRecord[];
  privacyBudgets: Record<string, number>;
  cases: HqInvestigationCase[];
  healthWeights?: HqHealthWeights;
  anomalyVerdicts?: Record<string, "real" | "false_alarm" | "known">;
  lastRedTeamAudit?: {
    runAt: string;
    passedChecks: number;
    totalChecks: number;
    details: string[];
  };
}
