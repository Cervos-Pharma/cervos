/**
 * @route GET /api/hq/export/quotes
 * @access HQ session with canManageOnboarding required
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { arrayToCSV } from "@/lib/export";
import { authorizeHqExport } from "@/lib/spine/export-auth";

export async function GET() {
  const auth = await authorizeHqExport("canManageOnboarding");
  if (!auth.ok) return auth.response;

  let rows: Record<string, unknown>[] = [];
  try {
    const supabase = await createServiceClient();
    const { data: quotes, error } = await supabase
      .from("quote_requests")
      .select("id, company_name, contact_name, email, phone, message, status, created_at, expected_branches, current_supplier, annual_volume")
      .order("created_at", { ascending: false });
    if (!error && quotes && quotes.length > 0) {
      rows = quotes as Record<string, unknown>[];
    }
  } catch {
    // Fallback cleanly to Welcome Lounge join requests
  }

  if (rows.length === 0) {
    rows = (auth.db.joinRequests ?? []).map((r) => ({
      id: r.id,
      created_at: r.createdAt,
      company_name: r.targetOrgName,
      contact_name: r.requesterFullName,
      email: r.requesterEmail,
      phone: "",
      status: r.status,
      expected_branches: 1,
      current_supplier: "",
      annual_volume: "",
      message: r.note ?? r.requestedRoleLabel ?? "",
    }));
  }

  const cols = [
    { key: "id", header: "ID" },
    { key: "created_at", header: "Created" },
    { key: "company_name", header: "Company" },
    { key: "contact_name", header: "Contact" },
    { key: "email", header: "Email" },
    { key: "phone", header: "Phone" },
    { key: "status", header: "Status" },
    { key: "expected_branches", header: "Expected Branches" },
    { key: "current_supplier", header: "Current Supplier" },
    { key: "annual_volume", header: "Annual Volume" },
    { key: "message", header: "Message" },
  ];

  const csv = arrayToCSV(rows, cols);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="quote-requests-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
