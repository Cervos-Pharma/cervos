"use server";

import { createClient } from "@/lib/supabase/server";

export interface Branch {
  id: string;
  account_id: string;
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  subscription_status?: string | null;
  trial_ends_at?: string | null;
  grace_ends_at?: string | null;
  created_at?: string;
  pos_activated_at?: string | null;
}

export interface CreateBranchInput {
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
}

export interface UpdateBranchInput {
  name?: string;
  address?: string;
  lat?: number;
  lng?: number;
}

export async function getBranches(accountId: string): Promise<Branch[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("branches")
    .select(
      "id, account_id, name, address, lat, lng, subscription_status, trial_ends_at, grace_ends_at, created_at, pos_activated_at"
    )
    .eq("account_id", accountId)
    .order("name");

  return (data ?? []) as Branch[];
}

/**
 * Releases a branch's POS device claim from the web dashboard — for when
 * the device itself is lost, broken, or otherwise unreachable, so the
 * owner isn't stuck waiting for that device to unlink itself (see
 * unlinkDevice() in cervos-desktop/src/lib/sync.ts for the device-side
 * equivalent, which is preferred when the device is actually available).
 */
export async function deactivatePosForBranch(
  accountId: string,
  branchId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!account || account.id !== accountId) return { error: "Not authorized for this account." };

  const { error } = await supabase
    .from("branches")
    .update({ pos_activated_at: null })
    .eq("id", branchId)
    .eq("account_id", accountId);

  return { error: error?.message ?? null };
}

export async function createBranch(
  accountId: string,
  input: CreateBranchInput
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { data: account } = await supabase
    .from("accounts")
    .select("subscription_plan")
    .eq("id", accountId)
    .single();

  if (!account) return { error: "Account not found." };

  let maxBranches = 1;

  if (account.subscription_plan) {
    const { data: plan } = await supabase
      .from("subscription_plans")
      .select("max_branches")
      .eq("id", account.subscription_plan)
      .maybeSingle();

    if (plan && typeof plan.max_branches === "number" && plan.max_branches > 0) {
      maxBranches = plan.max_branches;
    }
  }

  const { count } = await supabase
    .from("branches")
    .select("*", { count: "exact", head: true })
    .eq("account_id", accountId);

  if (count !== null && count >= maxBranches) {
    return { error: "Branch limit reached. Upgrade your plan to add more branches." };
  }

  const { error } = await supabase.from("branches").insert({
    account_id: accountId,
    name: input.name,
    address: input.address ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
  });

  if (error) return { error: error.message };
  return { error: null };
}

export async function updateBranch(
  id: string,
  accountId: string,
  input: UpdateBranchInput
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("branches")
    .select("id")
    .eq("id", id)
    .eq("account_id", accountId)
    .single();

  if (!existing) return { error: "Branch not found or access denied." };

  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.address !== undefined) updates.address = input.address;
  if (input.lat !== undefined) updates.lat = input.lat;
  if (input.lng !== undefined) updates.lng = input.lng;

  const { error } = await supabase
    .from("branches")
    .update(updates)
    .eq("id", id);

  if (error) return { error: error.message };
  return { error: null };
}

export async function deleteBranch(
  id: string,
  accountId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("branches")
    .select("id")
    .eq("id", id)
    .eq("account_id", accountId)
    .single();

  if (!existing) return { error: "Branch not found or access denied." };

  const { data: operators } = await supabase
    .from("operators")
    .select("id")
    .eq("branch_id", id)
    .limit(1);

  if (operators && operators.length > 0) {
    return { error: "Cannot delete branch with operators. Reassign operators first." };
  }

  const { data: sales } = await supabase
    .from("sales")
    .select("id")
    .eq("branch_id", id)
    .limit(1);

  if (sales && sales.length > 0) {
    return { error: "Cannot delete branch with sales records." };
  }

  const { error } = await supabase.from("branches").delete().eq("id", id);
  if (error) return { error: error.message };
  return { error: null };
}
