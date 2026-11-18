/**
 * @route GET /api/hq/export/payments
 * @access HQ session with canManageBillingEscrow required
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { arrayToCSV } from "@/lib/export";
import { authorizeHqExport } from "@/lib/spine/export-auth";

export async function GET() {
  const auth = await authorizeHqExport("canManageBillingEscrow");
  if (!auth.ok) return auth.response;

  let rows: Record<string, unknown>[] = [];
  try {
    const supabase = await createServiceClient();
    const { data: payments, error } = await supabase
      .from("billing_payments")
      .select("id, account_id, amount_tzs, reference, note, status, created_at, accounts(name), hq_admins(name)")
      .order("created_at", { ascending: false });
    if (!error && payments && payments.length > 0) {
      rows = payments.map((p: Record<string, unknown>) => ({
        ...p,
        account_name: (p.accounts as { name?: string } | null)?.name ?? "-",
        recorded_by: (p.hq_admins as { name?: string } | null)?.name ?? "-",
        accounts: undefined,
        hq_admins: undefined,
      }));
    }
  } catch {
    // Fallback cleanly to Spine/workspace ledger
  }

  if (rows.length === 0) {
    const subs = (auth.db.pendingSubscriptions ?? []).map((p) => {
      const org = auth.db.accounts.find((a) => a.id === p.accountId);
      return {
        id: p.reference,
        created_at: p.createdAt,
        account_name: org?.orgName ?? p.accountId,
        amount_tzs: p.amountTzs,
        reference: p.reference,
        status: p.status,
        note: `${p.planName} (${p.billingCycle})`,
        recorded_by: "Payme / Workspace",
      };
    });
    const escrow = (auth.db.wholesaleOrders ?? []).map((o) => {
      const org = auth.db.accounts.find((a) => a.id === o.accountId);
      return {
        id: o.id,
        created_at: o.createdAt,
        account_name: org?.orgName ?? o.accountId,
        amount_tzs: o.totalTzs,
        reference: o.orderReference,
        status: o.escrowStatus,
        note: `Kasri PO: ${o.productName} x${o.quantity}`,
        recorded_by: o.supplierName,
      };
    });
    rows = [...subs, ...escrow];
  }

  const cols = [
    { key: "id", header: "ID" },
    { key: "created_at", header: "Date" },
    { key: "account_name", header: "Account" },
    { key: "amount_tzs", header: "Amount (TZS)" },
    { key: "reference", header: "Reference" },
    { key: "status", header: "Status" },
    { key: "note", header: "Note" },
    { key: "recorded_by", header: "Recorded By" },
  ];

  const csv = arrayToCSV(rows, cols);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="payments-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
