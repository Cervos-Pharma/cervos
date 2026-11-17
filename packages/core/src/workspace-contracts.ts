import type { WorkspaceProfileRole } from "./workspace-roles-compat";

export type WorkspaceLang = "EN" | "SW";

export type WorkspaceSex = "female" | "male" | "prefer_not_to_say";

export type WorkspaceOrgRoleType =
  | "pharmacy"
  | "supplier"
  | "dispensary"
  | "researcher"
  | "investor"
  | "other";

export type WorkspaceGateStage = "security" | "centre" | "profile";

export interface SignupGeoContext {
  region: string;
  lat?: number;
  lng?: number;
  source: "gps" | "manual";
  snappedAt?: string;
}

export interface WorkspaceAuthSignInPayload {
  action: "signin";
  identifier: string;
  password?: string;
  pin?: string;
  clientMode?: "cookie" | "bearer";
}

export interface WorkspaceAuthSignUpPayload {
  action: "signup";
  fullName: string;
  username?: string;
  email: string;
  sex: WorkspaceSex;
  signupGeo?: SignupGeoContext;
  orgName: string;
  region: string;
  role: WorkspaceOrgRoleType;
  customRole?: string;
  lang: WorkspaceLang;
  password: string;
  confirmPassword: string;
  clientMode?: "cookie" | "bearer";
}

export interface WorkspaceAuthRequestJoinPayload {
  action: "request_join";
  targetAccountId: string;
  fullName: string;
  username?: string;
  email: string;
  sex: WorkspaceSex;
  lang: WorkspaceLang;
  region: string;
  signupGeo?: Omit<SignupGeoContext, "region">;
  requestedRoleLabel?: string;
  note?: string;
  password: string;
  confirmPassword: string;
  clientMode?: "cookie" | "bearer";
}

export interface WorkspaceAuthResponse {
  ok: boolean;
  username?: string;
  role?: WorkspaceProfileRole | string;
  browserTrusted?: boolean;
  redirectTo?: string;
  error?: string;
  /** Present when clientMode === "bearer" for React Native / native clients */
  tokens?: {
    accountToken: string;
    profileToken?: string;
    trustToken?: string;
    expiresInSec: number;
  };
}

export interface DirectoryOrganizationSummary {
  id: string;
  orgName: string;
  roleType: WorkspaceOrgRoleType | string;
  region: string;
  networkUnlocked?: boolean;
  centres: Array<{ id: string; name: string; region?: string }>;
}

export interface LoungeJoinRequestSummary {
  id: string;
  targetAccountId: string;
  targetOrgName: string;
  requesterFullName: string;
  requesterUsername: string;
  requesterEmail: string;
  requesterSex: WorkspaceSex | string;
  requesterLang: WorkspaceLang;
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

export type MobileSyncEntityKind =
  | "pos_sale"
  | "batch_adjustment"
  | "shift_clock"
  | "grn_receipt"
  | "hq_ack";

export interface MobileSyncQueueEntry {
  id: string;
  idempotencyKey: string;
  entity: MobileSyncEntityKind;
  centreId: string;
  profileId: string;
  payloadJson: string;
  createdAt: string;
  attempts: number;
  lastError?: string | null;
  status: "queued" | "syncing" | "failed" | "synced";
}

export interface EscPosReceiptLine {
  name: string;
  qty: number;
  unitPriceTzs: number;
  lineTotalTzs: number;
  batchNumber?: string;
  expiryDate?: string;
}

export interface EscPosReceiptPayload {
  receiptNumber: string;
  orgName: string;
  branchName: string;
  branchPhone?: string;
  cashierName: string;
  paymentMethod: "cash" | "mpesa" | "tigo" | "halopesa" | "card";
  createdAtIso: string;
  items: EscPosReceiptLine[];
  subtotalTzs: number;
  taxTzs: number;
  discountTzs: number;
  totalTzs: number;
  tenderTzs: number;
  changeDueTzs: number;
  paperWidthMm: 58 | 80;
  lang: WorkspaceLang;
}
