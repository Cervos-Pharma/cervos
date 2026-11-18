"use client";

import { formatTzs } from "@cervos/core";
import CervosMap from "@/components/MapClientWrapper";
import type { MarkerData } from "@/components/CervosMap";
import { CERVOS_HQ_ASSETS, hqSurfaceTokens } from "./hqSurface";
import type {
  HqAuditEvent,
  HqFleetAccount,
  HqFleetSummary,
  HqPeakTelemetry,
  HqSupportTicketRecord,
  HqTab,
  HqTeamNoteItem,
  HqWholesaleOrderRecord,
} from "./types";

interface HQOverviewSectionProps {
  summary: HqFleetSummary;
  peakTelemetry?: HqPeakTelemetry;
  accounts: HqFleetAccount[];
  wholesaleOrders: HqWholesaleOrderRecord[];
  auditLogs: HqAuditEvent[];
  supportTickets?: HqSupportTicketRecord[];
  hqTeamNotes?: HqTeamNoteItem[];
  onSwitchTab: (tab: HqTab) => void;
  onSelectOrg: (accountId: string) => void;
  isDark: boolean;
}

const EXPORT_FEEDS = [
  { label: "Accounts CSV", href: "/api/hq/export/accounts" },
  { label: "Branches CSV", href: "/api/hq/export/branches" },
  { label: "Payments CSV", href: "/api/hq/export/payments" },
  { label: "Quotes CSV", href: "/api/hq/export/quotes" },
  { label: "Tickets CSV", href: "/api/hq/export/tickets" },
  { label: "Updates CSV", href: "/api/hq/export/news" },
];

const REGION_COORDS: Array<[string, number, number]> = [
  ["dar", -6.7924, 39.2083],
  ["arusha", -3.3869, 36.683],
  ["mwanza", -2.5164, 32.9175],
  ["dodoma", -6.163, 35.7516],
  ["mbeya", -8.9094, 33.4608],
  ["zanzibar", -6.1659, 39.2026],
  ["unguja", -6.1659, 39.2026],
  ["morogoro", -6.8278, 37.6591],
  ["tanga", -5.0689, 39.0987],
  ["moshi", -3.3349, 37.3404],
  ["kilimanjaro", -3.3349, 37.3404],
  ["iringa", -7.77, 35.69],
  ["tabora", -5.0162, 32.8266],
  ["kigoma", -4.8769, 29.6267],
  ["mtwara", -10.2676, 40.1836],
  ["kahama", -3.8375, 32.6],
  ["geita", -2.8725, 32.2325],
];

function resolveRegionCoords(region: string, seedIdx: number): { lat: number; lng: number } {
  const lower = (region || "").toLowerCase();
  const match = REGION_COORDS.find(([key]) => lower.includes(key));
  const baseLat = match ? match[1] : -6.7924;
  const baseLng = match ? match[2] : 39.2083;
  const angle = (seedIdx * 137.5 * Math.PI) / 180;
  const offset = match ? 0.012 : 0.03;
  return {
    lat: Number((baseLat + Math.cos(angle) * offset).toFixed(4)),
    lng: Number((baseLng + Math.sin(angle) * offset).toFixed(4)),
  };
}

export default function HQOverviewSection({
  summary,
  peakTelemetry,
  accounts,
  wholesaleOrders,
  auditLogs,
  supportTickets = [],
  hqTeamNotes = [],
  onSwitchTab,
  onSelectOrg,
  isDark,
}: HQOverviewSectionProps) {
  const t = hqSurfaceTokens(isDark);

  let branchSeed = 0;
  const branchMarkers: Array<MarkerData & { accountId: string }> = accounts.flatMap((acc) =>
    acc.centres.map((ctr) => {
      branchSeed += 1;
      const hasExact =
        typeof ctr.lat === "number" &&
        typeof ctr.lng === "number" &&
        Number.isFinite(ctr.lat) &&
        Number.isFinite(ctr.lng);
      const fallback = resolveRegionCoords(ctr.region || acc.region || "Dar es Salaam", branchSeed);
      return {
        id: ctr.id,
        accountId: acc.id,
        lat: hasExact ? ctr.lat! : fallback.lat,
        lng: hasExact ? ctr.lng! : fallback.lng,
        label: ctr.name,
        accountName: acc.orgName,
        region: ctr.region || acc.region,
        revenue:
          acc.centresCount > 0 ? Math.round(acc.salesRevenueTzs / acc.centresCount) : acc.salesRevenueTzs,
        status: acc.accessLock.locked
          ? "locked"
          : acc.subscriptionActive
            ? "active"
            : "trial",
        detail: `${ctr.staffCount} staff · ${acc.subscriptionPlan}`,
      };
    })
  );

  const escrowHeldOrders = wholesaleOrders.filter((o) => o.escrowStatus === "escrow_held");
  const heldValueTzs = escrowHeldOrders.reduce((sum, o) => sum + o.totalTzs, 0);
  const openTickets = supportTickets.filter((tk) => tk.status !== "resolved");

  const alerts: Array<{
    title: string;
    detail: string;
    tone: "red" | "amber" | "blue";
    tab: HqTab;
    accountId?: string;
  }> = [];

  if (openTickets.length > 0) {
    alerts.push({
      title: `${openTickets.length} live support ticket${openTickets.length === 1 ? "" : "s"} awaiting response`,
      detail: `${summary.urgentSupportTickets ?? 0} high/urgent priority. Reply in Support Desk.`,
      tone: (summary.urgentSupportTickets ?? 0) > 0 ? "red" : "blue",
      tab: "support",
    });
  }
  if (summary.lockedOrgs > 0) {
    alerts.push({
      title: `${summary.lockedOrgs} organization workspace locked`,
      detail: `${summary.hqLockedOrgs} HQ override, ${summary.billingOverdueOrgs} billing overdue`,
      tone: "red",
      tab: "fleet",
    });
  }
  if (summary.expiredBatches > 0 || summary.nearExpiryBatches > 0) {
    alerts.push({
      title: `FEFO Watch: ${summary.expiredBatches} expired, ${summary.nearExpiryBatches} near expiry`,
      detail: "Inspect affected pharmacy branches and trigger compliance notices.",
      tone: "amber",
      tab: "fleet",
    });
  }
  if (escrowHeldOrders.length > 0) {
    alerts.push({
      title: `${escrowHeldOrders.length} wholesale orders awaiting Kasri settlement`,
      detail: `Total held in escrow: ${formatTzs(heldValueTzs)}`,
      tone: "blue",
      tab: "finance",
    });
  }
  if (summary.pendingJoinRequests > 0) {
    alerts.push({
      title: `${summary.pendingJoinRequests} operator join requests pending approval`,
      detail: "Allocate branch and counter PIN in Onboarding.",
      tone: "blue",
      tab: "onboarding",
    });
  }

  return (
    <div className="space-y-6">
      {/* Branded Cervos Hardware & Field Operations Showcase */}
      <section className={`p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center ${t.panelCls}`}>
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center gap-3">
            <img
              src={CERVOS_HQ_ASSETS.productLogoTransparent}
              alt="Cervos Product Emblem"
              className={`h-6 w-auto object-contain ${isDark ? "brightness-0 invert" : ""}`}
            />
            <span className="px-2.5 py-0.5 rounded-full bg-[#1039B9]/12 text-[#1039B9] dark:text-sky-300 text-[10px] font-bold uppercase tracking-widest">
              Sovereign Network View
            </span>
          </div>
          <h2
            className="text-xl font-semibold tracking-tight"
            style={{ fontFamily: "Outfit, Inter, sans-serif" }}
          >
            East Africa Pharmacy Fleet &amp; Telemetry
          </h2>
          <p className={`text-xs leading-relaxed ${t.mutedCls}`}>
            Coordinate counter dispensaries, Kasri escrow settlements, customer support tickets, and internal HQ shift handoffs from one claymorphic control surface.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => onSwitchTab("support")}
              className={`px-4 py-2 rounded-full text-xs font-semibold cursor-pointer ${t.primaryBtnCls}`}
            >
              Open Support Desk ({openTickets.length})
            </button>
            <button
              type="button"
              onClick={() => onSwitchTab("team")}
              className={`px-4 py-2 rounded-full text-xs font-semibold cursor-pointer ${t.pillCls}`}
            >
              HQ Shift Feed ({hqTeamNotes.length})
            </button>
          </div>
        </div>

        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { src: CERVOS_HQ_ASSETS.hardwareDesktop, label: "Desktop POS", tab: "fleet" as HqTab },
            { src: CERVOS_HQ_ASSETS.hardwareTablet, label: "Tablet Dispatch", tab: "support" as HqTab },
            { src: CERVOS_HQ_ASSETS.peopleDelivery, label: "Supply Chain", tab: "finance" as HqTab },
            { src: CERVOS_HQ_ASSETS.counterStation, label: "Dispensaries", tab: "journal" as HqTab },
          ].map((tile) => (
            <button
              key={tile.label}
              type="button"
              onClick={() => onSwitchTab(tile.tab)}
              className={`p-2 text-left transition-transform hover:-translate-y-0.5 cursor-pointer ${t.wellCls}`}
            >
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden">
                <img
                  src={tile.src}
                  alt={tile.label}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent flex items-end p-2">
                  <span className="text-[11px] font-semibold text-white">{tile.label}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Priority Operational Attention Strip */}
      <section className={`p-5 space-y-3.5 ${t.panelCls}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2
              className="text-base font-semibold tracking-tight"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              Operational Attention Queue
            </h2>
            <p className={`text-xs ${t.mutedCls}`}>
              Live support tickets, access locks, FEFO expiry exposure, pending join approvals, and Kasri escrow holds.
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-mono ${t.wellCls} ${t.mutedCls}`}>
            {alerts.length === 0 ? "All clear" : `${alerts.length} active signals`}
          </span>
        </div>

        {alerts.length === 0 ? (
          <div className={`px-4 py-3 text-xs ${t.wellCls}`}>
            All fleet organizations, support queues, FEFO stock batches, and Kasri settlements are operating within normal bounds.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {alerts.map((item) => {
              const toneCls =
                item.tone === "red"
                  ? "border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                  : item.tone === "amber"
                    ? "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                    : "border-blue-500/35 bg-blue-500/10 text-[#1039B9] dark:text-sky-300";
              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => {
                    if (item.accountId) onSelectOrg(item.accountId);
                    onSwitchTab(item.tab);
                  }}
                  className={`rounded-2xl border p-3.5 text-left transition-transform hover:-translate-y-0.5 cursor-pointer ${toneCls}`}
                >
                  <div className="text-xs font-bold">{item.title}</div>
                  <div className="text-[11px] opacity-85 mt-0.5">{item.detail}</div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Live Branch Map */}
        <section className={`xl:col-span-7 p-5 space-y-3.5 ${t.panelCls}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">Live East Africa Branch Map</h3>
              <p className={`text-xs ${t.mutedCls}`}>
                {branchMarkers.length} branches mapped across {accounts.length} organizations. Tap any pin to inspect org.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSwitchTab("fleet")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${t.primaryBtnCls}`}
            >
              Inspect Fleet
            </button>
          </div>
          <div className={`p-1.5 ${t.wellCls}`}>
            <div className="h-[460px] rounded-xl overflow-hidden">
              <CervosMap
                markers={branchMarkers}
                defaultStyle={isDark ? "dark" : "light"}
                showControls
                enableRegionJump
                onMarkerClick={(m) => {
                  const match = branchMarkers.find((bm) => bm.id === m.id);
                  if (match) {
                    onSelectOrg(match.accountId);
                    onSwitchTab("fleet");
                  }
                }}
              />
            </div>
          </div>
        </section>

        {/* CSV Exports & Recent Activity */}
        <div className="xl:col-span-5 space-y-5">
          <section className={`p-5 space-y-3 ${t.panelCls}`}>
            <div>
              <h3 className="text-sm font-semibold">Compliance &amp; Finance Exports</h3>
              <p className={`text-xs ${t.mutedCls}`}>
                Download live CSV ledgers directly from Supabase backend tables.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {EXPORT_FEEDS.map((exp) => (
                <a
                  key={exp.href}
                  href={exp.href}
                  download
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold text-center transition-transform hover:-translate-y-0.5 ${t.pillCls}`}
                >
                  {exp.label}
                </a>
              ))}
            </div>
          </section>

          <section className={`p-5 space-y-3 ${t.panelCls}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Latest Fleet Audit Feed</h3>
              <button
                type="button"
                onClick={() => onSwitchTab("comms")}
                className="text-xs font-semibold text-[#1039B9] dark:text-sky-400 hover:underline cursor-pointer"
              >
                Open Audit Log
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {auditLogs.slice(0, 8).map((ev) => (
                <div
                  key={ev.id}
                  className={`px-3.5 py-2.5 text-xs flex items-center justify-between gap-2 ${t.wellCls}`}
                >
                  <div className="min-w-0 truncate">
                    <span className="font-mono text-[10px] font-bold mr-2 opacity-75">
                      {ev.category}
                    </span>
                    <span className="font-semibold mr-1">{ev.orgName}:</span>
                    <span>{ev.action}</span>
                  </div>
                  <span className={`font-mono text-[10px] shrink-0 ${t.mutedCls}`}>
                    {ev.createdAt.slice(11, 16)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Peak HQ Data Intelligence: MRR, Regional Velocity & Top Dispensed Medicines */}
      {peakTelemetry && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <section className={`lg:col-span-7 overflow-hidden ${t.panelCls}`}>
            <div className={`px-5 py-4 border-b ${t.subtleBorderCls} flex flex-wrap items-center justify-between gap-2`}>
              <div>
                <h3 className="text-sm font-semibold">Regional Demand &amp; Expiry Recovery</h3>
                <p className={`text-[11px] ${t.mutedCls}`}>
                  Live sales velocity, stockout exposure, and capital near expiry across regions.
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs tabular-nums">
                <div className={`px-3 py-1 rounded-full ${t.wellCls}`}>
                  <span className={t.mutedCls}>Est. MRR: </span>
                  <strong className="text-emerald-600 dark:text-emerald-400">
                    {formatTzs(peakTelemetry.monthlyRecurringRevenueTzs)}
                  </strong>
                </div>
                <div className={`px-3 py-1 rounded-full ${t.wellCls}`}>
                  <span className={t.mutedCls}>At Expiry Risk: </span>
                  <strong className="text-amber-600 dark:text-amber-400">
                    {formatTzs(peakTelemetry.expiryExposureTzs)}
                  </strong>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className={`border-b ${t.subtleBorderCls} text-[10px] uppercase tracking-wider ${t.mutedCls}`}>
                    <th className="py-2.5 px-4 font-semibold">Region</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Orgs / Branches</th>
                    <th className="py-2.5 px-3 font-semibold text-right">30d Sales</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Low Stock</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Expiry Exposure</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-500/10 tabular-nums">
                  {peakTelemetry.regionDemand.map((row) => (
                    <tr key={row.region}>
                      <td className="py-2.5 px-4 font-semibold">{row.region}</td>
                      <td className="py-2.5 px-3 text-right">{row.orgsCount} / {row.branchesCount}</td>
                      <td className="py-2.5 px-3 text-right font-semibold">{formatTzs(row.revenue30dTzs)}</td>
                      <td className="py-2.5 px-3 text-right">{row.lowStockCount}</td>
                      <td className="py-2.5 px-4 text-right text-amber-600 dark:text-amber-300">
                        {formatTzs(row.expiryExposureTzs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={`lg:col-span-5 overflow-hidden ${t.panelCls}`}>
            <div className={`px-5 py-4 border-b ${t.subtleBorderCls}`}>
              <h3 className="text-sm font-semibold">Top Dispensed Products (Fleet)</h3>
              <p className={`text-[11px] ${t.mutedCls}`}>Aggregated unit demand across active dispensaries.</p>
            </div>
            {peakTelemetry.topDispensedProducts.length === 0 ? (
              <div className={`p-5 text-xs ${t.mutedCls}`}>No sales lines recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className={`border-b ${t.subtleBorderCls} text-[10px] uppercase tracking-wider ${t.mutedCls}`}>
                      <th className="py-2.5 px-4 font-semibold">Medicine</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Units</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-500/10 tabular-nums">
                    {peakTelemetry.topDispensedProducts.map((p) => (
                      <tr key={p.brandName}>
                        <td className="py-2.5 px-4">
                          <div className="font-semibold">{p.brandName}</div>
                          <div className={`text-[10px] ${t.mutedCls}`}>{p.genericName}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">{p.unitsSold}</td>
                        <td className="py-2.5 px-4 text-right font-semibold">{formatTzs(p.revenueTzs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
