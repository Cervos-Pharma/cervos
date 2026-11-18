/**
 * @route GET /api/hq/export/tickets
 * @access HQ session with canAnswerSupport required
 */
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { arrayToCSV } from "@/lib/export";
import { authorizeHqExport } from "@/lib/spine/export-auth";

export async function GET() {
  const auth = await authorizeHqExport("canAnswerSupport");
  if (!auth.ok) return auth.response;

  let rows: Record<string, unknown>[] = [];
  try {
    const supabase = await createServiceClient();
    const { data: tickets, error } = await supabase
      .from("support_tickets")
      .select("id, subject, message, category, status, source, contact_email, internal_note, created_at, updated_at, accounts(name)")
      .order("created_at", { ascending: false });
    if (!error && tickets && tickets.length > 0) {
      rows = tickets.map((t: Record<string, unknown>) => ({
        ...t,
        account_name: (t.accounts as { name?: string } | null)?.name ?? "-",
        accounts: undefined,
      }));
    }
  } catch {
    // Fallback cleanly to workspace support tickets
  }

  if (rows.length === 0) {
    rows = (auth.db.supportTickets ?? []).map((t) => ({
      id: t.ticketRef,
      created_at: t.createdAt,
      subject: t.subject,
      category: t.category,
      status: t.status,
      source: t.source,
      contact_email: t.contactEmail,
      account_name: t.orgName ?? "-",
      message: t.message,
      internal_note: t.internalNote ?? "",
      updated_at: t.updatedAt,
    }));
  }

  const cols = [
    { key: "id", header: "ID" },
    { key: "created_at", header: "Created" },
    { key: "subject", header: "Subject" },
    { key: "category", header: "Category" },
    { key: "status", header: "Status" },
    { key: "source", header: "Source" },
    { key: "contact_email", header: "Contact Email" },
    { key: "account_name", header: "Account" },
    { key: "message", header: "Message" },
    { key: "internal_note", header: "Internal Note" },
    { key: "updated_at", header: "Last Updated" },
  ];

  const csv = arrayToCSV(rows, cols);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="support-tickets-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
