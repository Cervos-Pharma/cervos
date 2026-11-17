import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { noStoreJson } from "@/lib/workspace/cookies";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return noStoreJson({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId");

  if (!branchId) {
    return noStoreJson({ error: "branchId is required" }, { status: 400 });
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!account) {
    return noStoreJson({ error: "Access denied" }, { status: 403 });
  }

  const { data: branch } = await supabase
    .from("branches")
    .select("id, account_id")
    .eq("id", branchId)
    .maybeSingle();

  if (!branch || branch.account_id !== account.id) {
    return noStoreJson({ error: "Access denied" }, { status: 403 });
  }

  const { data: operators } = await supabase
    .from("operators")
    .select("id, name, role, branch_id")
    .eq("branch_id", branchId)
    .order("name");

  return noStoreJson({ operators: operators ?? [] });
}
