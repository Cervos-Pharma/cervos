import { z } from "zod";

export const StockMovementReasonSchema = z.enum([
  "grn_intake",
  "pos_sale",
  "pos_return",
  "adjustment",
  "expiry_writeoff",
  "recall_quarantine",
  "hospital_transfer_out",
  "hospital_transfer_in",
]);

export type StockMovementReason = z.infer<typeof StockMovementReasonSchema>;

export const StockMovementSchema = z.object({
  id: z.string().min(1),
  idempotencyKey: z.string().min(1),
  branchId: z.string().min(1),
  productId: z.string().min(1),
  batchId: z.string().min(1),
  deltaQty: z.number().int(),
  reason: StockMovementReasonSchema,
  unitCostTzs: z.number().int().nonnegative().nullable(),
  unitSaleTzs: z.number().int().nonnegative().nullable(),
  actorOperatorId: z.string().min(1).nullable(),
  deviceId: z.string().min(1).nullable(),
  referenceId: z.string().min(1).nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().min(1),
});

export type StockMovement = z.infer<typeof StockMovementSchema>;

export const WhoAwareClassSchema = z.enum(["Access", "Watch", "Reserve", "Non-Antibiotic"]);
export type WhoAwareClass = z.infer<typeof WhoAwareClassSchema>;

export const MasterDrugItemSchema = z.object({
  id: z.string().min(1),
  innName: z.string().min(1),
  brandName: z.string().min(1),
  atcCode: z.string().min(1),
  dosageForm: z.string().min(1),
  strength: z.string().min(1),
  whoAwareClass: WhoAwareClassSchema,
  requiresPrescription: z.boolean(),
  isControlled: z.boolean(),
  storageTempC: z.enum(["15-25C", "2-8C", "VAULT"]),
  tmdaRegistrationNo: z.string().nullable(),
});

export type MasterDrugItem = z.infer<typeof MasterDrugItemSchema>;

export const PrescriptionClaimSchema = z.object({
  id: z.string().min(1),
  claimToken: z.string().min(6),
  prescriberId: z.string().min(1),
  prescriberLicenseNo: z.string().min(1),
  patientInitials: z.string().min(1),
  productId: z.string().min(1),
  innName: z.string().min(1),
  prescribedQty: z.number().int().positive(),
  isControlled: z.boolean(),
  status: z.enum(["issued", "reserved", "dispensed", "expired", "revoked"]),
  claimedByBranchId: z.string().nullable(),
  dispensedByPharmacistLicenseNo: z.string().nullable(),
  expiresAt: z.string().min(1),
  createdAt: z.string().min(1),
});

export type PrescriptionClaim = z.infer<typeof PrescriptionClaimSchema>;

export const HospitalStockAlertSchema = z.object({
  id: z.string().min(1),
  hospitalId: z.string().min(1),
  hospitalName: z.string().min(1),
  region: z.string().min(1),
  productId: z.string().min(1),
  innName: z.string().min(1),
  currentQty: z.number().int().nonnegative(),
  neededQty: z.number().int().positive(),
  urgency: z.enum(["routine", "urgent", "life_critical"]),
  status: z.enum(["open", "matched", "in_transit", "fulfilled", "cancelled"]),
  createdAt: z.string().min(1),
});

export type HospitalStockAlert = z.infer<typeof HospitalStockAlertSchema>;

export const RegulatoryRecallSchema = z.object({
  id: z.string().min(1),
  recallCode: z.string().min(1),
  tmdaNoticeRef: z.string().min(1),
  innName: z.string().min(1),
  batchNumber: z.string().min(1),
  severity: z.enum(["class_i_critical", "class_ii_moderate", "class_iii_advisory"]),
  reason: z.string().min(1),
  issuedByRegulatorId: z.string().min(1),
  status: z.enum(["active", "resolved"]),
  createdAt: z.string().min(1),
});

export type RegulatoryRecall = z.infer<typeof RegulatoryRecallSchema>;

