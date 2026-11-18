/**
 * @route GET /api/hq/export/accounts
 * @access HQ session with canManageFleetLocks required
 * @description Returns all accounts as CSV from Supabase or Spine projections
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { arrayToCSV } from "@/lib/export";
import { authorizeHqExport } from "@/lib/spine/export-auth";
import { computeEffectiveAccessState } from "@/lib/spine";

export async function GET() {
  const auth = await authorizeHqExport("canManageFleetLocks");
  if (!auth.ok) return auth.response;

  let rows: Record<string, unknown>[] = [];
  try {
    const supabase = await createServiceClient();
    const { data: accounts, error } = await supabase
      .from("accounts")
      .select("id, name, type, subscription_status, billing_status, created_at, suspended_at, subscription_plan, download_enabled")
      .order("created_at", { ascending: false });
    if (!error && accounts && accounts.length > 0) {
      rows = accounts as Record<string, unknown>[];
    }
  } catch {
    // Fallback cleanly to Spine projections
  }

  if (rows.length === 0) {
    rows = auth.db.accounts.map((a) => ({
      id: a.id,
      name: a.orgName,
      type: a.roleType,
      subscription_status: computeEffectiveAccessState(a),
      billing_status: a.billingOverdue ? "overdue" : a.subscriptionActive ? "paid" : "trial",
      download_enabled: a.onboardingDone,
      created_at: a.createdAt,
      suspended_at: a.hqLock?.locked ? a.hqLock.lockedAt : "",
    }));
  }

  const cols = [
    { key: "id", header: "ID" },
    { key: "name", header: "Account Name" },
    { key: "type", header: "Type" },
    { key: "subscription_status", header: "Subscription Status" },
    { key: "billing_status", header: "Billing Status" },
    { key: "download_enabled", header: "Downloads Enabled" },
    { key: "created_at", header: "Created" },
    { key: "suspended_at", header: "Suspended At" },
  ];

  const csv = arrayToCSV(rows, cols);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="accounts-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
