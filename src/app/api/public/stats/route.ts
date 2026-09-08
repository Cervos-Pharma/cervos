import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createServiceClient();

    const [pharmacyRes, supplierRes, branchRes, mapRes] = await Promise.all([
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
    ]);

    const pharmacies = pharmacyRes.count ?? 0;
    const suppliers = supplierRes.count ?? 0;
    const branches = branchRes.count ?? 0;

    const markers = (mapRes.data ?? [])
      .filter((b) => typeof b.lat === "number" && typeof b.lng === "number")
      .map((b) => ({
        lat: b.lat as number,
        lng: b.lng as number,
        label: b.name,
        status: (b.subscription_status === "active" ? "online" : "grace") as "online" | "grace" | "offline",
      }));

    return NextResponse.json({
      pharmacies,
      suppliers,
      branches,
      markers,
    });
  } catch (err: any) {
    return NextResponse.json(
      { pharmacies: 0, suppliers: 0, branches: 0, markers: [], error: err?.message },
      { status: 500 }
    );
  }
}
