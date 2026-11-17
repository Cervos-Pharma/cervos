/**
 * @route /dashboard
 * @access Authenticated pharmacy accounts only. Suppliers are redirected to /supplier.
 * @description Main pharmacy dashboard. Uses the getPharmacyDashboardData() server
 *   action for all data fetching. Renders:
 *   - KPI strip (branches online, trial ends, expiring batches, billing status)
 *   - Leaflet network map with branch markers
 *   - Branch list with subscription status
 *   - Expiring batches table (FEFO sorted)
 *
 * @data Reads: accounts, branches, batches (joined with products) — via server action.
 */
import { redirect } from "next/navigation";
import { getPharmacyDashboardData } from "@/lib/actions/pharmacy";
import PharmacySidebar from "@/components/PharmacySidebar";
import Link from "next/link";
import CervosMap from "@/components/MapClientWrapper";
import { getT } from "@/lib/i18n/server";
import MobileMenuButton from "@/components/MobileMenuButton";

export default async function DashboardPage() {
  const t = await getT();

  const data = await getPharmacyDashboardData();
  if (!data) redirect("/auth?next=/dashboard");

  const { account, branches, expiringBatches } = data;

  if (account.type === "supplier") redirect("/supplier");

  const activeBranches = branches.filter((b) => b.subscription_status === "active");
  const graceBranches = branches.filter((b) => b.subscription_status === "grace");

  const mapMarkers = branches
    .filter((b) => b.lat != null && b.lng != null)
    .map((b) => ({
      lat: b.lat as number,
      lng: b.lng as number,
      label: b.name,
      status: b.subscription_status as "online" | "offline" | "grace",
    }));

  const firstBranch = branches[0];

  return (
    <div className="flex min-h-screen bg-surface">
      <PharmacySidebar
        branchName={firstBranch?.name}
        accountName={account?.name}
      />

      <div className="lg:ml-64 flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="bg-surface-base/95 backdrop-blur-md fixed top-0 right-0 h-16 border-b border-outline-variant flex items-center px-5 sm:px-8 lg:w-[calc(100%-16rem)] w-full z-10 gap-4">
          <MobileMenuButton />
          <div className="ml-auto flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-medium text-on-surface-variant">
              <span className="w-2 h-2 rounded-full bg-secondary" />
              {t(activeBranches.length === 1 ? "dash.branches.active" : "dash.branches.active.p").replace("{n}", String(activeBranches.length))}
            </div>
            <Link
              href="/download"
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg transition-colors bg-primary text-on-primary hover:bg-primary-variant"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>{t("portal.download")}</span>
            </Link>
          </div>
        </header>

        <main className="flex-grow pt-24 pb-20 px-4 sm:px-8 max-w-container-max mx-auto w-full space-y-6">
          {/* Greeting */}
          <div>
            <h1 className="font-headline-lg text-2xl sm:text-3xl font-semibold text-ink-deep">
              {t("dash.greeting")}{" "}
              <span className="text-primary">{account.name ?? "Pharmacy"}</span>
            </h1>
            <p className="text-sm text-on-surface-variant mt-1">
              {t("dash.subtitle")}
            </p>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                labelKey: "dash.kpi.active",
                value: activeBranches.length,
                icon: "store",
                colour: "text-primary",
                bg: "bg-primary/8",
              },
              {
                labelKey: "dash.kpi.grace",
                value: graceBranches.length,
                icon: "warning",
                colour: "text-amber-700",
                bg: "bg-amber-50",
              },
              {
                labelKey: "dash.kpi.expiring",
                value: expiringBatches.length,
                icon: "timer",
                colour: "text-error",
                bg: "bg-error-container/50",
              },
              {
                labelKey: "dash.kpi.billing",
                value:
                  account.billing_status === "active"
                    ? t("dash.kpi.billing.active")
                    : t("dash.kpi.billing.inactive"),
                icon: "credit_card",
                colour:
                  account.billing_status === "active"
                    ? "text-secondary"
                    : "text-error",
                bg:
                  account.billing_status === "active"
                    ? "bg-secondary/10"
                    : "bg-error-container/50",
              },
            ].map((kpi) => (
              <div
                key={kpi.labelKey}
                className="bg-surface-base border border-outline-variant rounded-xl p-5 flex items-start justify-between gap-3"
              >
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

          {/* Two-column layout: 8 cols Map + 4 cols Branches */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Branch map */}
            <div className="lg:col-span-8 bg-surface-base border border-outline-variant rounded-xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center">
                <h2 className="font-headline-md text-base font-semibold text-ink-deep">
                  {t("dash.networkmap")}
                </h2>
                <span className="font-mono text-[11px] font-medium text-on-surface-variant uppercase tracking-wider">
                  {t(branches.length === 1 ? "dash.branch.count" : "dash.branch.count.p").replace("{n}", String(branches.length))}
                </span>
              </div>
              <div className="relative h-80">
                <CervosMap
                  center={mapMarkers.length > 0 ? [mapMarkers[0].lat, mapMarkers[0].lng] : [-6.816, 39.2803]}
                  zoom={mapMarkers.length > 0 ? 12 : 11}
                  markers={mapMarkers}
                  className="h-80 w-full"
                />
                {mapMarkers.length === 0 && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface/80 backdrop-blur-[1px]">
                    <div className="pointer-events-auto max-w-sm rounded-xl border border-outline-variant bg-surface-base p-5 text-center shadow-lg">
                      <span className="material-symbols-outlined text-4xl text-primary">location_on</span>
                      <p className="mt-2 font-semibold text-sm text-ink-deep">Your branches do not have saved locations yet.</p>
                      <p className="mt-1 text-xs text-on-surface-variant">Set each branch on the map or use its device location to display it here.</p>
                      <Link href="/dashboard/branches" className="mt-3 inline-flex rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-on-primary hover:bg-primary-variant">
                        Set branch locations
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Branch list */}
            <div className="lg:col-span-4 bg-surface-base border border-outline-variant rounded-xl flex flex-col overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between">
                <h2 className="font-headline-md text-base font-semibold text-ink-deep">
                  {t("dash.branches")}
                </h2>
                <Link href="/dashboard/branches" className="text-xs font-semibold text-primary hover:underline">
                  Manage
                </Link>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-outline-variant max-h-80">
                {branches.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-sm text-on-surface-variant">
                      {t("dash.nobranches")}
                    </p>
                  </div>
                ) : (
                  branches.map((b) => {
                    const pillClass =
                      b.subscription_status === "active"
                        ? "bg-secondary/10 text-secondary"
                        : b.subscription_status === "grace"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-error-container/60 text-error";
                    return (
                      <Link
                        href="/dashboard/branches"
                        key={b.id}
                        className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-surface-container-low/50 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink-deep truncate">
                            {b.name}
                          </p>
                          {b.last_synced_at && (
                            <p className="text-[11px] text-on-surface-variant mt-0.5 tabular-nums">
                              Synced {new Date(b.last_synced_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize shrink-0 ${pillClass}`}>
                          {b.subscription_status}
                        </span>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>

            {/* Expiring batches */}
            <div className="lg:col-span-12 bg-surface-base border border-outline-variant rounded-xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center">
                <h2 className="font-headline-md text-base font-semibold text-ink-deep">
                  {t("dash.expiring.title")}
                </h2>
                <Link
                  href="/dashboard/inventory"
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  <span>{t("dash.viewall")}</span>
                  <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                </Link>
              </div>
              <div>
                {expiringBatches.length === 0 ? (
                  <div className="p-8 text-center">
                    <span className="material-symbols-outlined text-[40px] text-secondary/40 mb-2 block">
                      check_circle
                    </span>
                    <p className="font-body-md text-body-md text-on-surface-variant">
                      {t("dash.noexpiring")}
                    </p>
                  </div>
                ) : (
                  <>
                  {/* Desktop table (lg+) — card list below for phones */}
                  <table className="hidden lg:table w-full">
                    <thead className="bg-surface-container-low">
                      <tr>
                        {["dash.col.product", "dash.col.branch", "dash.col.qty", "dash.col.expiry", "dash.col.daysleft"].map(
                          (h) => (
                            <th
                              key={h}
                              className="text-left px-6 py-3 font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider"
                            >
                              {t(h)}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/30">
                      {expiringBatches.map((batch) => {
                        const expiry = new Date(batch.expiry_date);
                        const daysLeft = Math.ceil(
                          (expiry.getTime() - Date.now()) / 86400000
                        );
                        const product = Array.isArray(batch.products)
                          ? batch.products[0]
                          : batch.products;
                        const branch = Array.isArray(batch.branches)
                          ? batch.branches[0]
                          : batch.branches;
                        return (
                          <tr
                            key={batch.id}
                            className="hover:bg-surface-container-low/30 transition-colors"
                          >
                            <td className="px-6 py-4">
                              <div>
                                <p className="font-body-md text-body-md text-ink-deep">
                                  {product?.generic_name ?? "—"}
                                </p>
                                {product?.brand_name && (
                                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                                    {product.brand_name}
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 font-body-sm text-body-sm text-on-surface-variant">
                              {branch?.name ?? "—"}
                            </td>
                            <td className="px-6 py-4 font-body-md text-body-md">
                              {batch.quantity}
                            </td>
                            <td className="px-6 py-4 font-body-sm text-body-sm">
                              {expiry.toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded text-xs font-label-md ${
                                  daysLeft <= 7
                                    ? "bg-error-container text-error"
                                    : daysLeft <= 14
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-surface-container text-on-surface-variant"
                                }`}
                              >
                                {t("dash.days").replace("{n}", String(daysLeft))}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Mobile card list (< lg) */}
                  <ul className="lg:hidden divide-y divide-outline-variant/40">
                    {expiringBatches.map((batch) => {
                      const expiry = new Date(batch.expiry_date);
                      const daysLeft = Math.ceil(
                        (expiry.getTime() - Date.now()) / 86400000
                      );
                      const product = Array.isArray(batch.products)
                        ? batch.products[0]
                        : batch.products;
                      const branch = Array.isArray(batch.branches)
                        ? batch.branches[0]
                        : batch.branches;
                      return (
                        <li key={batch.id} className="px-4 py-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-body-md text-sm text-ink-deep truncate">
                              {product?.generic_name ?? "—"}
                            </p>
                            <p className="text-xs text-on-surface-variant truncate">
                              {branch?.name ?? "—"} · {batch.quantity} · {expiry.toLocaleDateString()}
                            </p>
                          </div>
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded text-xs font-label-md shrink-0 ${
                              daysLeft <= 7
                                ? "bg-error-container text-error"
                                : daysLeft <= 14
                                ? "bg-amber-50 text-amber-700"
                                : "bg-surface-container text-on-surface-variant"
                            }`}
                          >
                            {t("dash.days").replace("{n}", String(daysLeft))}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  </>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
