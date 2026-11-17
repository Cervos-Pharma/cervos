export interface ShiftReconciliationInput {
  openingCashTzs: number;
  cashSalesTzs: number;
  cashRefundsTzs?: number;
  mobileMoneySalesTzs?: number;
  declaredCashTzs: number;
}

export interface ShiftReconciliationResult {
  openingCashTzs: number;
  cashSalesTzs: number;
  cashRefundsTzs: number;
  mobileMoneySalesTzs: number;
  expectedCashTzs: number;
  declaredCashTzs: number;
  varianceTzs: number;
  status: "balanced" | "shortage" | "overage";
}

export function reconcileCashShift(
  input: ShiftReconciliationInput
): ShiftReconciliationResult {
  const openingCashTzs = Math.max(0, Math.round(input.openingCashTzs || 0));
  const cashSalesTzs = Math.max(0, Math.round(input.cashSalesTzs || 0));
  const cashRefundsTzs = Math.max(0, Math.round(input.cashRefundsTzs || 0));
  const mobileMoneySalesTzs = Math.max(0, Math.round(input.mobileMoneySalesTzs || 0));
  const declaredCashTzs = Math.max(0, Math.round(input.declaredCashTzs || 0));

  const expectedCashTzs = Math.max(0, openingCashTzs + cashSalesTzs - cashRefundsTzs);
  const varianceTzs = declaredCashTzs - expectedCashTzs;

  let status: "balanced" | "shortage" | "overage" = "balanced";
  if (varianceTzs < 0) status = "shortage";
  else if (varianceTzs > 0) status = "overage";

  return {
    openingCashTzs,
    cashSalesTzs,
    cashRefundsTzs,
    mobileMoneySalesTzs,
    expectedCashTzs,
    declaredCashTzs,
    varianceTzs,
    status,
  };
}

