/**
 * Shared profile role union aligned with src/lib/workspace/permissions.ts
 * for cross-runtime imports (Next.js web, Tauri desktop, Expo React Native).
 */
export type WorkspaceProfileRole =
  | "pharmacy_owner"
  | "superintendent_pharmacist"
  | "pos_cashier"
  | "supplier_admin"
  | "warehouse_dispatcher"
  | "hospital_pharmacist"
  | "policy_researcher"
  | "investor_partner";
