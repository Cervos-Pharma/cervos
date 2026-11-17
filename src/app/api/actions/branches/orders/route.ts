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
  const accountId = searchParams.get("accountId");

  if (!accountId) {
    return noStoreJson({ error: "accountId is required" }, { status: 400 });
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!account || account.id !== accountId) {
    return noStoreJson({ error: "Access denied" }, { status: 403 });
  }

  const { data: orders } = await supabase
    .from("orders")
    .select("id, total, created_at")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(10);

  return noStoreJson({ orders: orders ?? [] });
}
