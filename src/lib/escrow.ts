/**
 * @file lib/escrow.ts
 * @description Marketplace escrow settlement.
 *   1. On buyer Payme payment completion (`settleOrderPayout`), funds are held safely
 *      in `escrow_held` status inside `disbursements` until delivery/GRN confirmation.
 *   2. Once delivery/GRN completes (`releaseOrderEscrowPayout`), funds are released
 *      to the supplier's Payme payout wallet via `initiateDisbursement`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

interface PayableOrder {
  id: string;
  order_reference: string;
  seller_id: string;
  buyer_branch_id: string;
}

export async function settleOrderPayout(args: {
  service: SupabaseClient;
  payment: { id: string; reference: string; amount_tzs: number; account_id: string };
  order: PayableOrder;
}): Promise<{ ok: boolean; message: string }> {
  const { service, payment, order } = args;

  const { data: existingDisbursement } = await service
    .from("disbursements")
    .select("id, status")
    .eq("order_id", order.id)
    .maybeSingle();

  if (existingDisbursement) {
    return {
      ok: true,
      message: `Order escrow already recorded (${existingDisbursement.status}).`,
    };
  }

  const [
    { data: sellerAcct, error: sellerError },
    { data: sellerSettings },
  ] = await Promise.all([
    service
      .from("accounts")
      .select("id, name, payme_wallet_number, phone, email")
      .eq("id", order.seller_id)
      .single(),
    service
      .from("payment_settings")
      .select("payme_wallet_number")
      .eq("account_id", order.seller_id)
      .maybeSingle(),
  ]);

  if (sellerError || !sellerAcct) {
    return { ok: false, message: `Supplier ${order.seller_id} not found.` };
  }

  const walletNumber =
    (sellerAcct.payme_wallet_number ?? "").trim() ||
    (sellerSettings as { payme_wallet_number?: string | null } | null)?.payme_wallet_number?.trim() ||
    "";

  const disbursementRef = `DIS-${Date.now().toString(36).toUpperCase()}-${order.seller_id.slice(0, 4).toUpperCase()}`;
  const feeTzs = 0;
  const amountTzs = Math.round(Number(payment.amount_tzs) || 0);

  const { error: dispInsertError } = await service.from("disbursements").insert({
    payment_id: payment.id,
    order_id: order.id,
    account_id: payment.account_id,
    supplier_id: order.seller_id,
    reference: disbursementRef,
    amount_tzs: amountTzs,
    fee_tzs: feeTzs,
    net_amount_tzs: amountTzs - feeTzs,
    msisdn: walletNumber || null,
    channel: walletNumber ? "CASHIN" : null,
    status: walletNumber ? "escrow_held" : "pending",
    failure_reason: walletNumber ? null : "Supplier payout wallet not configured",
  });

  if (dispInsertError) return { ok: false, message: dispInsertError.message };

  await service.from("notifications").insert([
    {
      account_id: order.seller_id,
      kind: "payment",
      title: walletNumber
        ? "Order paid — held in escrow until delivery"
        : "Order paid — add your payout wallet",
      body: walletNumber
        ? `Order ${order.order_reference} payment (TZS ${amountTzs.toLocaleString("en-US")}) is held in Cervos Escrow and releases automatically upon delivery/GRN confirmation.`
        : `Order ${order.order_reference} is paid in escrow. Add your Payme wallet in Payment Settings to unlock release upon delivery.`,
      route: "/supplier/orders",
      read: false,
    },
    {
      account_id: payment.account_id,
      kind: "order",
      title: "Order confirmed in escrow",
      body: `Order ${order.order_reference} payment (TZS ${amountTzs.toLocaleString("en-US")}) is secured in escrow until delivery confirmation.`,
      route: "/dashboard/orders",
      read: false,
    },
  ]);

  return {
    ok: true,
    message: walletNumber
      ? "Order confirmed; funds held in escrow pending delivery."
      : "Order confirmed; supplier wallet needed before escrow release.",
  };
}

/**
 * Releases a previously held escrow disbursement to the supplier's Payme wallet
 * once delivery / POS GRN intake is confirmed.
 */
export async function releaseOrderEscrowPayout(args: {
  service: SupabaseClient;
  orderId: string;
}): Promise<{ ok: boolean; message: string }> {
  const { service, orderId } = args;

  const { data: held } = await service
    .from("disbursements")
    .select("id, reference, amount_tzs, net_amount_tzs, msisdn, status, supplier_id, account_id")
    .eq("order_id", orderId)
    .in("status", ["escrow_held", "pending"])
    .maybeSingle();

  if (!held) {
    return { ok: true, message: "No unreleased escrow record for this order." };
  }

  let walletNumber = (held.msisdn ?? "").trim();
  if (!walletNumber) {
    const [{ data: acct }, { data: settings }] = await Promise.all([
      service
        .from("accounts")
        .select("payme_wallet_number")
        .eq("id", held.supplier_id)
        .maybeSingle(),
      service
        .from("payment_settings")
        .select("payme_wallet_number")
        .eq("account_id", held.supplier_id)
        .maybeSingle(),
    ]);
    walletNumber =
      (acct?.payme_wallet_number ?? "").trim() ||
      (settings as { payme_wallet_number?: string | null } | null)?.payme_wallet_number?.trim() ||
      "";
  }

  if (!walletNumber) {
    await service
      .from("disbursements")
      .update({ status: "pending", failure_reason: "Supplier payout wallet not configured at delivery" })
      .eq("id", held.id);
    return { ok: false, message: "Supplier payout wallet not configured." };
  }

  const releaseAmount = Math.round(Number(held.net_amount_tzs ?? held.amount_tzs) || 0);
  const { initiateDisbursement } = await import("@/lib/payme");
  const { data: paymeData, error: paymeError } = await initiateDisbursement({
    amount: releaseAmount,
    msisdn: walletNumber,
    channel: "CASHIN",
    reference: held.reference,
  });

  if (paymeError) {
    await service
      .from("disbursements")
      .update({ status: "failed", failure_reason: paymeError })
      .eq("id", held.id);
    return { ok: false, message: paymeError };
  }

  await service
    .from("disbursements")
    .update({
      msisdn: walletNumber,
      channel: "CASHIN",
      provider_transaction_id: paymeData?.transaction_id || null,
      status: paymeData?.payment_status === "COMPLETED" ? "completed" : "processing",
      completed_at: paymeData?.payment_status === "COMPLETED" ? new Date().toISOString() : null,
      failure_reason: null,
    })
    .eq("id", held.id);

  return { ok: true, message: "Escrow payout released to supplier." };
}
