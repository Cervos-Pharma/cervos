/**
 * @route /supplier
 * @access Authenticated supplier accounts only. Pharmacy accounts are redirected to /dashboard.
 * @description Supplier portal home dashboard. Shows KPIs (quote stats, order stats),
 *   recent activity, and quick-access cards to catalog/orders/analytics.
 *
 * @data getSupplierDashboardData() — live accounts, quote_requests, and orders rows.
 *
 * Note: `account?.type !== "supplier"` also handles the null account case —
 * null?.type is undefined which !== "supplier", so the redirect fires safely.
 */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SupplierSidebar from "@/components/SupplierSidebar";
import Link from "next/link";
import { getSupplierDashboardData } from "@/lib/actions/supplier";
import { getT } from "@/lib/i18n/server";
import MobileMenuButton from "@/components/MobileMenuButton";
import MapClientWrapper from "@/components/MapClientWrapper";

export default async function SupplierDashboard() {
  const t = await getT();
  const dashboard = await getSupplierDashboardData();
  if (!dashboard) redirect("/dashboard");

  const {
    account,
    quotes,
    pendingOrders,
    deliveredCount,
    dispatchNodes,
    dispatchRoutes,
  } = dashboard;
  const pendingCount = quotes.filter((q) => q.status === "pending").length;
  const connectedBuyerCount = dispatchNodes.filter((n) => n.kind === "branch").length;

  return (
    <div className="flex min-h-screen bg-surface">
      <SupplierSidebar accountName={account?.name} />

      <div className="lg:ml-64 flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="bg-surface-base/95 backdrop-blur-md fixed top-0 right-0 h-16 border-b border-outline-variant flex items-center px-5 sm:px-8 lg:w-[calc(100%-16rem)] w-full z-10 justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <MobileMenuButton />
            <h1 className="font-headline-md text-lg sm:text-xl font-semibold text-ink-deep truncate">
              {t("sup.dashboard.title")}
            </h1>
          </div>
          <Link
            href="/supplier/quote"
            className="bg-primary text-on-primary px-4 py-2 rounded-lg text-xs font-semibold hover:bg-primary-variant transition-colors flex items-center gap-1.5 shrink-0"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>{t("sup.dashboard.new_quote")}</span>
          </Link>
        </header>

        <main className="flex-grow min-w-0 pt-24 pb-16 px-4 sm:px-8 max-w-container-max mx-auto w-full space-y-6">
          {/* KPI strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { labelKey: "sup.dashboard.kpi.open_quotes", value: pendingCount, icon: "request_quote", colour: "text-primary", bg: "bg-primary/8" },
              { labelKey: "sup.dashboard.kpi.total_requests", value: quotes.length, icon: "receipt_long", colour: "text-secondary", bg: "bg-secondary/10" },
              { labelKey: "sup.dashboard.kpi.pending_orders", value: pendingOrders, icon: "pending_actions", colour: "text-amber-700", bg: "bg-amber-50" },
              { labelKey: "sup.dashboard.kpi.delivered", value: deliveredCount, icon: "local_shipping", colour: "text-tertiary", bg: "bg-tertiary/10" },
            ].map((kpi) => (
              <div key={kpi.labelKey} className="bg-surface-base border border-outline-variant rounded-xl p-5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-xs font-medium text-on-surface-variant block truncate">
                    {t(kpi.labelKey)}
                  </span>
                  <div className={`font-headline-lg text-2xl sm:text-3xl font-bold mt-1.5 tabular-nums ${kpi.colour}`}>
                    {kpi.value}
                  </div>
                </div>
                <div className={`w-9 h-9 rounded-lg ${kpi.bg} ${kpi.colour} flex items-center justify-center shrink-0`}>
                  <span className="material-symbols-outlined text-[18px]">{kpi.icon}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Live Buyer Network & Order Dispatch Map */}
          <div className="bg-surface-base border border-outline-variant rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-outline-variant flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-headline-md text-base font-semibold text-ink-deep">
                  Live Buyer Network & Order Dispatch Map
                </h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {connectedBuyerCount} connected pharmacy branch{connectedBuyerCount !== 1 ? "es" : ""} · {dispatchRoutes.length} active B2B corridor{dispatchRoutes.length !== 1 ? "s" : ""}
                </p>
              </div>
              <Link
                href="/supplier/connections"
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <span>Manage connections</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            </div>
            <div className="h-[340px] w-full">
              <MapClientWrapper
                center={dispatchNodes[0] ? [dispatchNodes[0].lat, dispatchNodes[0].lng] : [-6.369, 34.8888]}
                zoom={6}
                markers={dispatchNodes}
                routes={dispatchRoutes}
                enableRegionJump
                className="h-full w-full"
              />
            </div>
          </div>

          {/* Quote requests table */}
          <div className="bg-surface-base border border-outline-variant rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center gap-3">
              <h2 className="font-headline-md text-base font-semibold text-ink-deep">
                {t("sup.dashboard.recent_quotes")}
              </h2>
              <Link href="/supplier/quote-answers" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                <span>All responses</span>
                <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
              </Link>
            </div>

            {quotes.length === 0 ? (
              <div className="p-12 text-center">
                <span className="material-symbols-outlined text-[40px] text-on-surface-variant/30 mb-3 block">
                  request_quote
                </span>
                <p className="text-sm text-on-surface-variant mb-4">
                  {t("sup.dashboard.no_quotes")}
                </p>
                <Link
                  href="/supplier/quote"
                  className="inline-flex items-center gap-2 bg-primary text-on-primary text-xs font-semibold px-5 py-2.5 rounded-lg hover:bg-primary-variant transition-colors"
                >
                  {t("sup.dashboard.submit_first")}
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-container-low/70">
                    <tr>
                      {["sup.dashboard.col.company", "sup.dashboard.col.contact", "sup.dashboard.col.status", "sup.dashboard.col.date", "sup.dashboard.col.actions"].map((h) => (
                        <th
                          key={h}
                          className="text-left px-6 py-3 font-semibold text-on-surface-variant text-[11px] uppercase tracking-wider"
                        >
                          {t(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {quotes.map((q) => (
                      <tr key={q.id} className="hover:bg-surface-container-low/40 transition-colors">
                        <td className="px-6 py-3.5 text-sm font-medium text-ink-deep">
                          {q.company_name}
                        </td>
                        <td className="px-6 py-3.5">
                          <p className="text-sm text-ink-deep">{q.contact_name}</p>
                          <p className="text-xs text-on-surface-variant">{q.email}</p>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${q.status === "contacted"
                            ? "bg-secondary/10 text-secondary"
                            : "bg-amber-50 text-amber-700"
                            }`}>
                            {q.status}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-xs text-on-surface-variant tabular-nums">
                          {new Date(q.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-3.5">
                          <Link
                            href="/supplier/quote-answers"
                            className="text-primary font-semibold hover:underline text-xs"
                          >
                            {t("sup.dashboard.view")}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
