/**
 * @file scripts/clean-db.mjs
 * @description Resets the local workspace persistence file to an empty, clean slate
 * ready for fresh production signups with zero demo organizations or transactions.
 *
 * Usage: node scripts/clean-db.mjs
 */
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dbPath = join(process.cwd(), ".local-workspace-db.json");
const emptySnapshot = {
  accounts: [],
  centres: [],
  profiles: [],
  passkeys: [],
  auditLogs: [],
  batches: [],
  sales: [],
  wholesaleOrders: [],
  branchMessages: [],
  expenses: [],
  paymentSettings: {},
  joinRequests: [],
  hqUpdates: [],
  hqMessages: [],
  savedCustomers: [],
  shiftLogs: [],
  notifications: [],
};

if (existsSync(dbPath)) {
  unlinkSync(dbPath);
}
writeFileSync(dbPath, JSON.stringify(emptySnapshot, null, 2), "utf8");
console.log("[clean-db] Reset .local-workspace-db.json to a clean empty database.");
