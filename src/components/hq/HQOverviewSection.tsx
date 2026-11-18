"use client";

import dynamic from "next/dynamic";
import { formatTzs } from "@cervos/core";
import type {
  HqAuditEvent,
  HqFleetAccount,
  HqFleetSummary,
  HqTab,
  HqWholesaleOrderRecord,
} from "./types";

const BranchMap = dynamic(() => import("./BranchMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[340px] flex items-center justify-center text-xs text-slate-500">
      Loading East Africa fleet map...
    </div>
  ),
});

interface HQOverviewSectionProps {
  summary: HqFleetSummary;
  accounts: HqFleetAccount[];
  wholesaleOrders: HqWholesaleOrderRecord[];
  auditLogs: HqAuditEvent[];
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

export default function HQOverviewSection({
  summary,
  accounts,
  wholesaleOrders,
  auditLogs,
  onSwitchTab,
  onSelectOrg,
  isDark,
}: HQOverviewSectionProps) {
  const cardCls = isDark
    ? "bg-[#11161F] border-slate-800 text-slate-100"
    : "bg-white border-slate-200 text-slate-900";
  const subCls = isDark
    ? "bg-[#171D28] border-slate-800 text-slate-200"
    : "bg-slate-50 border-slate-200 text-slate-800";
  const mutedCls = isDark ? "text-slate-400" : "text-slate-500";

  const branchLocations = accounts.flatMap((acc) =>
    acc.centres.map((ctr) => ({
      branchId: ctr.id,
      branchName: ctr.name,
      accountName: acc.orgName,
      lat: typeof ctr.lat === "number" ? ctr.lat : null,
      lng: typeof ctr.lng === "number" ? ctr.lng : null,
      revenue: acc.centresCount > 0 ? Math.round(acc.salesRevenueTzs / acc.centresCount) : acc.salesRevenueTzs,
      status: acc.accessLock.locked
        ? "locked"
        : acc.subscriptionActive
          ? "active"
          : "trial",
    }))
  );

  const escrowHeldOrders = wholesaleOrders.filter((o) => o.escrowStatus === "escrow_held");
  const heldValueTzs = escrowHeldOrders.reduce((sum, o) => sum + o.totalTzs, 0);

  const alerts: Array<{
    title: string;
    detail: string;
    tone: "red" | "amber" | "blue";
    tab: HqTab;
    accountId?: string;
  }> = [];

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
      {/* Priority Operational Attention Strip */}
      <section className={`rounded-2xl border p-5 space-y-3 ${cardCls}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2
              className="text-base font-semibold tracking-tight"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              Operational Attention Queue
            </h2>
            <p className={`text-xs ${mutedCls}`}>
              Live locks, FEFO expiry exposure, pending join approvals, and Kasri escrow holds.
            </p>
          </div>
          <span className={`text-xs font-mono ${mutedCls}`}>
            {alerts.length === 0 ? "All clear" : `${alerts.length} active signals`}
          </span>
        </div>

        {alerts.length === 0 ? (
          <div className={`rounded-xl border px-4 py-3 text-xs ${subCls}`}>
            All fleet organizations, FEFO stock batches, and Kasri settlements are operating within normal bounds.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {alerts.map((item) => {
              const toneCls =
                item.tone === "red"
                  ? "border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300"
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
                  className={`rounded-xl border p-3.5 text-left transition-opacity hover:opacity-90 cursor-pointer ${toneCls}`}
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
        <section className={`xl:col-span-7 rounded-2xl border p-5 space-y-3 ${cardCls}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">Live East Africa Branch Map</h3>
              <p className={`text-xs ${mutedCls}`}>
                {branchLocations.length} total branches mapped across {accounts.length} organizations.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSwitchTab("fleet")}
              className="px-3 py-1.5 rounded-lg bg-[#1039B9] text-white text-xs font-semibold hover:bg-[#0d2e94] cursor-pointer"
            >
              Inspect Fleet
            </button>
          </div>
          <div className="rounded-xl overflow-hidden border border-slate-500/20">
            <BranchMap branches={branchLocations} />
          </div>
        </section>

        {/* CSV Exports & Recent Activity */}
        <div className="xl:col-span-5 space-y-5">
          <section className={`rounded-2xl border p-5 space-y-3 ${cardCls}`}>
            <div>
              <h3 className="text-sm font-semibold">Compliance &amp; Finance Exports</h3>
              <p className={`text-xs ${mutedCls}`}>
                Download live CSV ledgers directly from Supabase backend tables.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {EXPORT_FEEDS.map((exp) => (
                <a
                  key={exp.href}
                  href={exp.href}
                  download
                  className={`px-3 py-2 rounded-xl border text-xs font-semibold text-center transition-colors hover:border-[#1039B9] ${subCls}`}
                >
                  {exp.label}
                </a>
              ))}
            </div>
          </section>

          <section className={`rounded-2xl border p-5 space-y-3 ${cardCls}`}>
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
                  className={`rounded-xl border px-3 py-2 text-xs flex items-center justify-between gap-2 ${subCls}`}
                >
                  <div className="min-w-0 truncate">
                    <span className="font-mono text-[10px] font-bold mr-2 opacity-75">
                      {ev.category}
                    </span>
                    <span className="font-semibold mr-1">{ev.orgName}:</span>
                    <span>{ev.action}</span>
                  </div>
                  <span className={`font-mono text-[10px] shrink-0 ${mutedCls}`}>
                    {ev.createdAt.slice(11, 16)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
