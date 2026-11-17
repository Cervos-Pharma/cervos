/**
 * @route GET /supplier/analytics/export
 * @access Authenticated supplier accounts only.
 * @description Streams the 12-month analytics data as a CSV download.
 *   Authenticated via the session cookie — no query params needed.
 *   Used by the "Export CSV" button in SupplierAnalyticsChart.
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupplierAnalytics } from "@/lib/actions/supplier";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("id, type")
    .eq("auth_user_id", user.id)
    .single();

  if (account?.type !== "supplier") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const analytics = await getSupplierAnalytics();

  const header = "Month,Quote Requests,Confirmed Orders,Conversion Rate (%),Revenue (TZS)\n";
  const rows = analytics.monthly
    .map((m) => {
      const conv = m.quoteRequests > 0 ? ((m.confirmed / m.quoteRequests) * 100).toFixed(1) : "0.0";
      return `${m.month},${m.quoteRequests},${m.confirmed},${conv},${m.revenue}`;
    })
    .join("\n");

  const csv = header + rows;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="cervos-analytics-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
