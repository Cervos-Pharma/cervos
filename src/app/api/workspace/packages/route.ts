import { noStoreJson } from "@/lib/workspace/cookies";
import {
  getWorkspaceDb,
  getWorkspacePackages,
  MIN_BRANCH_PRICE_TZS,
  warmDbFromSupabase,
} from "@/lib/workspace/store";

export const dynamic = "force-dynamic";

export async function GET() {
  await warmDbFromSupabase();
  const db = getWorkspaceDb();
  const packages = getWorkspacePackages(db).filter((p) => p.active);
  return noStoreJson({
    minBranchPriceTzs: MIN_BRANCH_PRICE_TZS,
    includedPerBranch: { admins: 1, operators: 1 },
    packages,
  });
}
