import type { NextRequest } from "next/server";
import { checkIpRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { noStoreJson } from "@/lib/workspace/cookies";
import { getWorkspaceDb, searchPublicOrganizations, warmDbFromSupabase } from "@/lib/workspace/store";

export async function GET(request: NextRequest) {
  const rl = checkIpRateLimit(request, "workspace-orgs", 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  // Warm DB from Supabase so search returns real accounts (not just demo seed)
  await warmDbFromSupabase();

  const sp = request.nextUrl.searchParams;
  const db = getWorkspaceDb();
  const orgs = searchPublicOrganizations(db, {
    q: sp.get("q") ?? "",
    region: sp.get("region") ?? "",
    roleType: sp.get("roleType") ?? "",
    preferredRegion: sp.get("preferredRegion") ?? "",
  });
  return noStoreJson({ organizations: orgs.slice(0, 20) });
}
