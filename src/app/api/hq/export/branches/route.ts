/**
 * @route GET /api/hq/export/branches
 * @access HQ session with canManageFleetLocks required
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
    const { data: branches, error } = await supabase
      .from("branches")
      .select("id, name, subscription_status, trial_ends_at, grace_ends_at, last_synced_at, lat, lng, created_at, accounts(name)")
      .order("created_at", { ascending: false });
    if (!error && branches && branches.length > 0) {
      rows = branches.map((b: Record<string, unknown>) => ({
        ...b,
        account_name: (b.accounts as { name?: string } | null)?.name ?? "-",
        accounts: undefined,
      }));
    }
  } catch {
    // Fallback cleanly to Spine projections
  }

  if (rows.length === 0) {
    rows = auth.db.centres.map((c) => {
      const org = auth.db.accounts.find((a) => a.id === c.accountId);
      return {
        id: c.id,
        name: c.name,
        account_name: org?.orgName ?? c.accountId,
        subscription_status: org ? computeEffectiveAccessState(org) : "trial",
        lat: c.lat ?? "",
        lng: c.lng ?? "",
        last_synced_at: c.createdAt,
        trial_ends_at: org?.trialEndsAt ?? "",
        grace_ends_at: "",
        created_at: c.createdAt,
      };
    });
  }

  const cols = [
    { key: "id", header: "ID" },
    { key: "name", header: "Branch Name" },
    { key: "account_name", header: "Account" },
    { key: "subscription_status", header: "Status" },
    { key: "lat", header: "Latitude" },
    { key: "lng", header: "Longitude" },
    { key: "last_synced_at", header: "Last Synced" },
    { key: "trial_ends_at", header: "Trial Ends" },
    { key: "grace_ends_at", header: "Grace Ends" },
    { key: "created_at", header: "Created" },
  ];

  const csv = arrayToCSV(rows, cols);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="branches-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
