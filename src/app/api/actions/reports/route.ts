import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { getSalesReport } from "@/lib/actions/reports";
import { noStoreJson } from "@/lib/workspace/cookies";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return noStoreJson({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const branchId = searchParams.get("branchId") ?? undefined;

  if (!accountId || !dateFrom || !dateTo) {
    return noStoreJson(
      { error: "accountId, dateFrom, and dateTo are required" },
      { status: 400 }
    );
  }

  const service = await createServiceClient();
  const { data: account } = await service
    .from("accounts")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!account || account.id !== accountId) {
    return noStoreJson({ error: "Access denied" }, { status: 403 });
  }

  const report = await getSalesReport(accountId, dateFrom, dateTo, branchId);
  return noStoreJson(report);
}
