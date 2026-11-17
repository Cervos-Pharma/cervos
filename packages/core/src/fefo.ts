export interface FefoBatchInput {
  id: string;
  batchNumber: string;
  quantity: number;
  expiryDate: string | null;
  createdAt?: string | null;
  quarantined?: boolean;
}

export interface FefoAllocationOptions {
  referenceDate?: string;
  requiresPrescription?: boolean;
  isControlled?: boolean;
  prescriptionRef?: string | null;
  claimToken?: string | null;
  pharmacistLicenseNo?: string | null;
}

export interface FefoBatchAllocation {
  batchId: string;
  batchNumber: string;
  quantityAllocated: number;
  remainingAfterAllocation: number;
  expiryDate: string | null;
}

export interface FefoAllocationResult {
  ok: boolean;
  error?: string;
  allocations: FefoBatchAllocation[];
  totalAllocated: number;
  excludedExpiredCount: number;
  excludedQuarantinedCount: number;
}

function toIsoDay(dateValue: string | null | undefined): string | null {
  if (!dateValue) return null;
  const trimmed = dateValue.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

/**
 * First-Expired-First-Out (FEFO) multi-batch allocator with clinical safety gates:
 * - Blocks expired batches (`expiryDate < referenceDate`)
 * - Blocks recalled/quarantined batches
 * - Splits cart demand cleanly across earliest-expiring batches
 * - Enforces Rx and Schedule IV controlled-substance authorization
 */
export function allocateFefoBatches(
  batches: readonly FefoBatchInput[],
  requestedQty: number,
  options: FefoAllocationOptions = {}
): FefoAllocationResult {
  const refDay = toIsoDay(options.referenceDate) ?? new Date().toISOString().slice(0, 10);

  if (!Number.isFinite(requestedQty) || requestedQty <= 0) {
    return {
      ok: false,
      error: "Requested quantity must be positive.",
      allocations: [],
      totalAllocated: 0,
      excludedExpiredCount: 0,
      excludedQuarantinedCount: 0,
    };
  }

  if (options.isControlled) {
    const hasRx = Boolean(options.prescriptionRef?.trim() || options.claimToken?.trim());
    const hasLicense = Boolean(options.pharmacistLicenseNo?.trim());
    if (!hasRx || !hasLicense) {
      return {
        ok: false,
        error:
          "Controlled (Schedule IV) dispense requires both a valid prescription/claim token and a licensed pharmacist override.",
        allocations: [],
        totalAllocated: 0,
        excludedExpiredCount: 0,
        excludedQuarantinedCount: 0,
      };
    }
  } else if (options.requiresPrescription) {
    const hasRx = Boolean(options.prescriptionRef?.trim() || options.claimToken?.trim());
    if (!hasRx) {
      return {
        ok: false,
        error: "Prescription-only item requires a prescription reference or claim token.",
        allocations: [],
        totalAllocated: 0,
        excludedExpiredCount: 0,
        excludedQuarantinedCount: 0,
      };
    }
  }

  let excludedExpiredCount = 0;
  let excludedQuarantinedCount = 0;

  const eligible = batches
    .filter((batch) => {
      if (batch.quarantined) {
        excludedQuarantinedCount += 1;
        return false;
      }
      if (!Number.isFinite(batch.quantity) || batch.quantity <= 0) {
        return false;
      }
      const expDay = toIsoDay(batch.expiryDate);
      if (expDay && expDay < refDay) {
        excludedExpiredCount += 1;
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      const expA = toIsoDay(a.expiryDate) ?? "9999-12-31";
      const expB = toIsoDay(b.expiryDate) ?? "9999-12-31";
      if (expA !== expB) return expA.localeCompare(expB);
      return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
    });

  const allocations: FefoBatchAllocation[] = [];
  let remainingNeed = requestedQty;

  for (const batch of eligible) {
    if (remainingNeed <= 0) break;
    const take = Math.min(batch.quantity, remainingNeed);
    allocations.push({
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      quantityAllocated: take,
      remainingAfterAllocation: batch.quantity - take,
      expiryDate: toIsoDay(batch.expiryDate),
    });
    remainingNeed -= take;
  }

  const totalAllocated = requestedQty - remainingNeed;
  if (totalAllocated < requestedQty) {
    return {
      ok: false,
      error: `Insufficient non-expired stock: requested ${requestedQty}, available ${totalAllocated}.`,
      allocations,
      totalAllocated,
      excludedExpiredCount,
      excludedQuarantinedCount,
    };
  }

  return {
    ok: true,
    allocations,
    totalAllocated,
    excludedExpiredCount,
    excludedQuarantinedCount,
  };
}

