import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkIpRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import {
  getWorkspaceDb,
  isAccountAccessLocked,
  warmDbFromSupabase,
} from "@/lib/workspace/store";

export const dynamic = "force-dynamic";

const REGION_COORDS: Record<string, { lat: number; lng: number }> = {
  "dar es salaam": { lat: -6.816, lng: 39.2803 },
  dodoma: { lat: -6.163, lng: 35.7516 },
  arusha: { lat: -3.3869, lng: 36.683 },
  mwanza: { lat: -2.5164, lng: 32.9175 },
  zanzibar: { lat: -6.1659, lng: 39.2026 },
  tanga: { lat: -5.0667, lng: 39.1 },
  mbeya: { lat: -8.9094, lng: 33.4608 },
  morogoro: { lat: -6.8278, lng: 37.6591 },
};

function resolveRegionCoords(region: string | undefined, idx: number): { lat: number; lng: number } {
  const key = (region ?? "").trim().toLowerCase();
  const base =
    Object.entries(REGION_COORDS).find(([name]) => key.includes(name))?.[1] ??
    REGION_COORDS["dar es salaam"];
  // Slight deterministic spread so stations in the same city stay visible on the globe
  const angle = (idx * 2.39996) % (Math.PI * 2);
  const spread = idx === 0 ? 0 : 0.035;
  return {
    lat: Number((base.lat + Math.sin(angle) * spread).toFixed(4)),
    lng: Number((base.lng + Math.cos(angle) * spread).toFixed(4)),
  };
}

export async function GET(request: NextRequest) {
  // Public endpoint for landing network telemetry & downloads.
  const rl = checkIpRateLimit(request, "public-stats", 30, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  try {
    await warmDbFromSupabase(true);
    const db = getWorkspaceDb();

    const activeAccounts = db.accounts.filter((a) => !a.hqLock?.locked);
    const accountMap = new Map(activeAccounts.map((a) => [a.id, a]));
    const wsPharmacies = activeAccounts.filter(
      (a) => a.roleType === "pharmacy" || a.roleType === "dispensary"
    ).length;
    const wsSuppliers = activeAccounts.filter((a) => a.roleType === "supplier").length;

    const activeCentres = db.centres.filter(
      (c) => c.status !== "archived" && accountMap.has(c.accountId)
    );
    const wsBranches = activeCentres.length;
    const wsMarkers = activeCentres.slice(0, 50).map((c, idx) => {
      const acct = accountMap.get(c.accountId);
      const hasCoords = typeof c.lat === "number" && typeof c.lng === "number" && (c.lat !== 0 || c.lng !== 0);
      const coords = hasCoords ? { lat: c.lat as number, lng: c.lng as number } : resolveRegionCoords(c.region || acct?.region, idx);
      const locked = acct ? isAccountAccessLocked(acct).locked : false;
      return {
        lat: coords.lat,
        lng: coords.lng,
        label: c.name,
        status: (locked ? "grace" : "online") as "online" | "grace" | "offline",
      };
    });

    let relPharmacies = 0;
    let relSuppliers = 0;
    let relBranches = 0;
    let downloads = 0;
    let relMarkers: Array<{ lat: number; lng: number; label: string; status: "online" | "grace" | "offline" }> = [];

    try {
      const supabase = await createServiceClient();
      const [pharmacyRes, supplierRes, branchRes, mapRes, releasesRes] = await Promise.all([
        supabase
          .from("accounts")
          .select("id", { count: "exact", head: true })
          .eq("type", "pharmacy")
          .neq("status", "suspended"),
        supabase
          .from("accounts")
          .select("id", { count: "exact", head: true })
          .eq("type", "supplier")
          .neq("status", "suspended"),
        supabase
          .from("branches")
          .select("id", { count: "exact", head: true })
          .neq("subscription_status", "locked"),
        supabase
          .from("branches")
          .select("name, lat, lng, subscription_status")
          .not("lat", "is", null)
          .not("lng", "is", null)
          .limit(50),
        supabase.from("app_releases").select("download_count"),
      ]);

      relPharmacies = pharmacyRes.count ?? 0;
      relSuppliers = supplierRes.count ?? 0;
      relBranches = branchRes.count ?? 0;
      downloads = (releasesRes.data ?? []).reduce(
        (sum, r) => sum + (r.download_count ?? 0),
        0
      );
      relMarkers = (mapRes.data ?? [])
        .filter((b) => typeof b.lat === "number" && typeof b.lng === "number")
        .map((b) => ({
          lat: b.lat as number,
          lng: b.lng as number,
          label: b.name,
          status: (b.subscription_status === "active" ? "online" : "grace") as "online" | "grace" | "offline",
        }));
    } catch {
      // Relational tables optional when running against workspace_db
    }

    const pharmacies = Math.max(wsPharmacies, relPharmacies);
    const suppliers = Math.max(wsSuppliers, relSuppliers);
    const branches = Math.max(wsBranches, relBranches);
    const markers = wsMarkers.length > 0 ? wsMarkers : relMarkers;

    return NextResponse.json(
      {
        pharmacies,
        suppliers,
        branches,
        downloads,
        markers,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch {
    return NextResponse.json(
      { pharmacies: 0, suppliers: 0, branches: 0, downloads: 0, markers: [], error: "Stats temporarily unavailable" },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
