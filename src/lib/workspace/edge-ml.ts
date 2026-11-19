/**
 * Re-exports shared on-device Edge ML models from `@cervos/core`
 * so Web, Desktop, and Expo Mobile share one canonical implementation.
 */
export {
  holtLinearForecast,
  linearTrendRegression,
  detectSalesAnomalies,
  mineBasketAffinities,
  classifyReorderUrgency,
  computeSafetyStockRecommendations,
  classifyAbcXyzMatrix,
  predictCounterStaffingWindows,
  type HoltPoint,
  type LinearTrendSummary,
  type SalesAnomaly,
  type BasketAffinity,
  type ReorderUrgencyItem,
  type SafetyStockRecommendation,
  type AbcXyzCell,
  type StaffingWindowPrediction,
} from "@cervos/core";
