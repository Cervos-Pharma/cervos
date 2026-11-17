/**
 * @route /hq/network
 * @access HQ session required (HMAC cookie `hq_sess`)
 * @description Live pharmacy branch map for HQ — all branches with real
 *   coordinates, coloured by subscription status. Includes searchable sidebar
 *   list, branch detail panel, sync status, and CSV export.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import HQSidebarServer from "@/components/HQSidebarServer";
import CervosMap from "@/components/MapClientWrapper";
import { HQ_COOKIE_NAME, isValidHQToken } from "@/lib/hq-auth";
import NetworkMapClient from "./NetworkMapClient";

export type BranchRow = {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  subscription_status: string;
  trial_ends_at: string | null;
  grace_ends_at: string | null;
  last_synced_at: string | null;
  accounts: { name: string; id: string } | null;
};

export default async function HQNetworkPage() {
  const cookieStore = await cookies();
  if (!isValidHQToken(cookieStore.get(HQ_COOKIE_NAME)?.value)) redirect("/hq");

  const { createServiceClient } = await import("@/lib/supabase/server");
  const supabase = await createServiceClient();

  const { data: branches } = await supabase
    .from("branches")
    .select("id, name, lat, lng, subscription_status, trial_ends_at, grace_ends_at, last_synced_at, accounts(id, name)")
    .not("lat", "is", null)
    .not("lng", "is", null);

  const branchList: BranchRow[] = (branches ?? []) as unknown as BranchRow[];

  return (
    <div className="flex min-h-screen bg-surface-container-lowest">
      <HQSidebarServer />
      <main className="flex-1 min-w-0 lg:ml-64 flex flex-col p-8 pt-12">
        <NetworkMapClient branches={branchList} />
      </main>
    </div>
  );
}
