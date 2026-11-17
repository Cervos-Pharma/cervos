/**
 * @file hq/HQOverviewInner.tsx
 * @description Server component — HQ Live Command Console overview.
 * Rendered by `app/hq/page.tsx` when a valid `hq_sess` cookie is present.
 * Fetches live network totals, active alerts, and geo-located nodes so
 * HQ operators get an immediate pulse + Tanzania command map alongside
 * quick access to all 13 HQ modules.
 */
import Link from "next/link";
import HQSidebarServer from "@/components/HQSidebarServer";
import MapClientWrapper from "@/components/MapClientWrapper";
import type { MarkerData } from "@/components/CervosMap";
import { getIntelligenceOverview, getHQAlerts } from "@/lib/actions/hq";
import { createServiceClient } from "@/lib/supabase/server";

type BranchMapRow = {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  subscription_status: string;
  unlock_requested_at: string | null;
  last_synced_at: string | null;
  accounts: { id: string; name: string; type: string } | null;
};

const HQ_DIRECTORY_GROUPS = [
  {
    group: "Operations & Network",
    items: [
      { label: "Network Map", href: "/hq/network", icon: "public" },
      { label: "Intelligence", href: "/hq/intelligence", icon: "insights" },
      { label: "Alerts", href: "/hq/alerts", icon: "notifications" },
      { label: "Downloads", href: "/hq/downloads", icon: "download" },
    ],
  },
  {
    group: "Commercial & Supply",
    items: [
      { label: "Accounts", href: "/hq/accounts", icon: "group" },
      { label: "Billing & Plans", href: "/hq/billing", icon: "payments" },
      { label: "Quote Requests", href: "/hq/quotes", icon: "request_quote" },
      { label: "Supplier Invites", href: "/hq/invites", icon: "mail" },
    ],
  },
  {
    group: "Governance & Comms",
    items: [
      { label: "Support", href: "/hq/support", icon: "support_agent" },
      { label: "Broadcast Messages", href: "/hq/messages", icon: "campaign" },
      { label: "News", href: "/hq/news", icon: "newspaper" },
      { label: "HQ Team", href: "/hq/team", icon: "badge" },
      { label: "Audit Log", href: "/hq/audit", icon: "shield" },
    ],
  },
] as const;

export default async function HQOverviewInner() {
  const supabase = await createServiceClient();

  const [overviewRes, alertsRes, branchesRes] = await Promise.all([
    getIntelligenceOverview(30),
    getHQAlerts(),
    supabase
      .from("branches")
      .select("id, name, lat, lng, subscription_status, unlock_requested_at, last_synced_at, accounts(id, name, type)")
      .not("lat", "is", null)
      .not("lng", "is", null),
  ]);

  const totals = overviewRes.data?.totals;
  const period = overviewRes.data?.period;
  const alerts = alertsRes.data ?? [];
  const criticalCount = alerts.filter((a) => a.severity === "critical").length;

  const branchRows = (branchesRes.data ?? []) as unknown as BranchMapRow[];
  const unlockRequests = branchRows.filter((b) => Boolean(b.unlock_requested_at)).length;

  const markers: MarkerData[] = branchRows
    .filter((b) => typeof b.lat === "number" && typeof b.lng === "number")
    .map((b) => ({
      id: b.id,
      lat: b.lat as number,
      lng: b.lng as number,
      label: b.name,
      accountName: b.accounts?.name,
      kind: b.accounts?.type === "supplier" ? "supplier" : "branch",
      status:
        b.subscription_status === "grace"
          ? "grace"
          : b.subscription_status === "locked" || b.subscription_status === "offline"
          ? "offline"
          : "online",
      detail: b.unlock_requested_at ? "Unlock requested" : undefined,
      lastSync: b.last_synced_at
        ? new Date(b.last_synced_at).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
          })
        : undefined,
    }));

  const activeBranchCount = totals
    ? Math.max(0, totals.branches - totals.lockedBranches)
    : branchRows.filter((b) => b.subscription_status === "active" || b.subscription_status === "trial").length;

  return (
    <div className="flex min-h-screen bg-surface-container-lowest">
      <HQSidebarServer />
      <main className="flex-1 min-w-0 lg:ml-64 px-4 sm:px-6 lg:px-8 pt-16 lg:pt-8 pb-10">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-outline-variant">
            <div>
              <p className="font-label-md text-[11px] font-semibold text-primary uppercase tracking-wider mb-1">
                HQ Command Console
              </p>
              <h1 className="font-headline-lg text-2xl font-bold text-ink-deep tracking-tight">
                National Network Overview
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href="/hq/alerts"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-outline-variant bg-surface-base text-xs font-medium text-ink-deep hover:border-primary/40 hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-[16px] text-amber-600">
                  notifications_active
                </span>
                {alerts.length} Active Alert{alerts.length !== 1 ? "s" : ""}
              </Link>
              <Link
                href="/hq/network"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary/95 transition-colors shadow-xs"
              >
                <span className="material-symbols-outlined text-[16px]">public</span>
                Full Network Map
              </Link>
            </div>
          </div>

          {/* Live Network Pulse Strip */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            {[
              {
                label: "Active Pharmacies",
                value: totals ? totals.pharmacies.toLocaleString() : "—",
                sub: totals ? `${totals.accounts} total accounts` : "Live directory",
                icon: "local_pharmacy",
                tone: "text-primary",
                badgeBg: "bg-primary/10 text-primary",
              },
              {
                label: "Verified Suppliers",
                value: totals ? totals.suppliers.toLocaleString() : "—",
                sub: `${period?.quoteRequests ?? 0} RFQs (30d)`,
                icon: "local_shipping",
                tone: "text-teal-700",
                badgeBg: "bg-teal-50 text-teal-700",
              },
              {
                label: "Online Branches",
                value: totals ? `${activeBranchCount} / ${totals.branches}` : `${branchRows.length}`,
                sub: `${unlockRequests} unlock request${unlockRequests !== 1 ? "s" : ""}`,
                icon: "storefront",
                tone: "text-secondary",
                badgeBg: "bg-secondary/10 text-secondary",
              },
              {
                label: "Open Alerts",
                value: alerts.length.toLocaleString(),
                sub: `${criticalCount} critical · ${period?.openSupportTickets ?? 0} tickets`,
                icon: "warning",
                tone: criticalCount > 0 ? "text-error" : "text-ink-deep",
                badgeBg: criticalCount > 0 ? "bg-red-50 text-error" : "bg-surface-container-low text-on-surface-variant",
              },
              {
                label: "30-Day Network GMV",
                value: `TZS ${Math.round(period?.salesRevenue ?? 0).toLocaleString()}`,
                sub: `${(period?.sales ?? 0).toLocaleString()} synced sales`,
                icon: "payments",
                tone: "text-ink-deep",
                badgeBg: "bg-surface-container-low text-ink-deep",
              },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="bg-surface-base border border-outline-variant rounded-xl p-4 shadow-xs flex flex-col justify-between"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-label-md text-[11px] font-medium text-on-surface-variant uppercase tracking-wider">
                    {kpi.label}
                  </p>
                  <span className={`w-7 h-7 rounded-lg inline-flex items-center justify-center shrink-0 ${kpi.badgeBg}`}>
                    <span className="material-symbols-outlined text-[16px]">{kpi.icon}</span>
                  </span>
                </div>
                <p className={`font-headline-lg text-2xl font-bold mt-2.5 tabular-nums tracking-tight ${kpi.tone}`}>
                  {kpi.value}
                </p>
                <p className="font-body-sm text-xs text-on-surface-variant mt-1 truncate">{kpi.sub}</p>
              </div>
            ))}
          </div>

          {/* Embedded Live National Command Map + Escalated Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            <div className="lg:col-span-8 bg-surface-base border border-outline-variant rounded-xl overflow-hidden shadow-xs flex flex-col">
              <div className="px-5 py-4 border-b border-outline-variant flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-headline-md text-base font-semibold text-ink-deep">
                    Live National Command Map
                  </h2>
                  <p className="font-body-sm text-xs text-on-surface-variant">
                    {markers.length} geo-located pharmacy branch &amp; supplier nodes across Tanzania
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary" /> Branch
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-teal-600" /> Supplier
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-error" /> Offline
                  </span>
                </div>
              </div>
              <div className="h-[340px] lg:flex-1 lg:min-h-[340px] w-full">
                <MapClientWrapper
                  center={[-6.369, 34.8888]}
                  zoom={6}
                  markers={markers}
                  enableRegionJump
                  className="h-full w-full"
                />
              </div>
            </div>

            <div className="lg:col-span-4 bg-surface-base border border-outline-variant rounded-xl shadow-xs flex flex-col">
              <div className="px-5 py-4 border-b border-outline-variant flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-headline-md text-base font-semibold text-ink-deep">
                    Active Escalated Alerts
                  </h2>
                  <p className="font-body-sm text-xs text-on-surface-variant">
                    Priority incidents &amp; compliance queue
                  </p>
                </div>
                <Link
                  href="/hq/alerts"
                  className="text-xs font-semibold text-primary hover:underline shrink-0"
                >
                  View all
                </Link>
              </div>

              <div className="p-4 flex-1 flex flex-col gap-3">
                {alerts.length > 0 ? (
                  alerts.slice(0, 4).map((alert) => (
                    <Link
                      key={alert.id}
                      href={alert.route}
                      className={`p-3.5 rounded-lg border transition-colors hover:border-primary/40 ${
                        alert.severity === "critical"
                          ? "bg-red-50/70 border-red-200"
                          : alert.severity === "warning"
                          ? "bg-amber-50/70 border-amber-200"
                          : "bg-surface-container-low/70 border-outline-variant"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-label-md text-[11px] font-semibold uppercase tracking-wider text-ink-deep">
                          {alert.title}
                        </span>
                        <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface-base border border-outline-variant text-ink-deep tabular-nums">
                          {alert.count}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
                        {alert.description}
                      </p>
                    </Link>
                  ))
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center py-10 px-4">
                    <span className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 inline-flex items-center justify-center mb-2.5">
                      <span className="material-symbols-outlined text-[20px]">check_circle</span>
                    </span>
                    <p className="text-sm font-semibold text-ink-deep">All clear</p>
                    <p className="text-xs text-on-surface-variant mt-1">
                      No escalated alerts or compliance blockers right now.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Console Directory */}
          <div className="bg-surface-base border border-outline-variant rounded-xl p-6 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-5 border-b border-outline-variant">
              <div>
                <h2 className="font-headline-md text-base font-semibold text-ink-deep">
                  HQ Console Directory
                </h2>
                <p className="font-body-sm text-xs text-on-surface-variant">
                  Direct navigation across operations, commercial workflows, and governance
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {HQ_DIRECTORY_GROUPS.map((section) => (
                <div key={section.group} className="space-y-2.5">
                  <p className="font-label-md text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider px-2">
                    {section.group}
                  </p>
                  <div className="space-y-1">
                    {section.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg text-sm text-ink-deep hover:bg-surface-container-low hover:text-primary transition-colors group"
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <span className="material-symbols-outlined text-[18px] text-on-surface-variant group-hover:text-primary transition-colors shrink-0">
                            {item.icon}
                          </span>
                          <span className="font-medium truncate">{item.label}</span>
                        </span>
                        <span className="material-symbols-outlined text-[16px] text-on-surface-variant/60 group-hover:text-primary transition-colors shrink-0">
                          chevron_right
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="font-body-sm text-xs text-on-surface-variant text-right">
            Session authenticated for 8 hours via HMAC cookie (`hq_sess`).
          </p>
        </div>
      </main>
    </div>
  );
}
