"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconShield } from "@/components/LandingIcons";
import { formatTzs } from "@cervos/core";
import HQOverviewSection from "./HQOverviewSection";
import HQFleetSection from "./HQFleetSection";
import HQPackagesSection from "./HQPackagesSection";
import HQFinanceSection from "./HQFinanceSection";
import HQEventExplorer from "./HQEventExplorer";
import HQMessageComposer from "./HQMessageComposer";
import HQLoungeAndUpdates from "./HQLoungeAndUpdates";
import type { HqFleetPayload, HqTab } from "./types";

interface HQConsoleClientProps {
  gateSlug: string;
  initialOperator: string;
  mockMode: boolean;
}

export default function HQConsoleClient({
  gateSlug,
  initialOperator,
  mockMode,
}: HQConsoleClientProps) {
  const router = useRouter();
  const [data, setData] = useState<HqFleetPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<HqTab>("overview");
  const [commsView, setCommsView] = useState<"messages" | "events">("messages");
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [eventOrgFilter, setEventOrgFilter] = useState("ALL");
  const [composerOrgId, setComposerOrgId] = useState("");
  const [banner, setBanner] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("cv-ops-theme");
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    setIsDark(saved ? saved === "dark" : prefersDark);
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      window.localStorage.setItem("cv-ops-theme", next ? "dark" : "light");
      return next;
    });
  };

  const loadFleet = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ops-v9k4m/dispatch?scope=fleet", {
        cache: "no-store",
        headers: { "X-Ops-Gate": gateSlug },
      });
      if (res.status === 401 || res.status === 403) {
        router.refresh();
        return;
      }
      const json = (await res.json()) as HqFleetPayload;
      setData(json);
      setSelectedOrgId((prev) => prev || json.accounts[0]?.id || "");
    } catch {
      setBanner({ type: "err", text: "Unable to load HQ telemetry stream." });
    } finally {
      setLoading(false);
    }
  }, [gateSlug, router]);

  useEffect(() => {
    void loadFleet();
  }, [loadFleet]);

  const runAction = useCallback(
    async (payload: Record<string, unknown>, successMessage: string): Promise<boolean> => {
      setBusy(true);
      setBanner(null);
      try {
        const res = await fetch("/api/ops-v9k4m/dispatch", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Ops-Gate": gateSlug },
          body: JSON.stringify(payload),
        });
        const json = (await res.json()) as { error?: string };
        if (!res.ok) {
          setBanner({ type: "err", text: json.error || "Ops command rejected." });
          return false;
        }
        setBanner({ type: "ok", text: successMessage });
        await loadFleet();
        return true;
      } catch {
        setBanner({ type: "err", text: "Network failure dispatching ops command." });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [gateSlug, loadFleet]
  );

  const handleSignOut = async () => {
    await fetch("/api/ops-v9k4m/session", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Ops-Gate": gateSlug },
      body: JSON.stringify({ action: "logout", gateSlug }),
    });
    router.refresh();
  };

  const pageCls = isDark
    ? "bg-[#090D14] text-slate-100"
    : "bg-[#F4F6F9] text-slate-900";
  const surfaceCls = isDark
    ? "bg-[#11161F] border-slate-800 text-slate-100"
    : "bg-white border-slate-200 text-slate-900";
  const chipCls = isDark
    ? "bg-[#171D28] border-slate-800 text-slate-200"
    : "bg-slate-50 border-slate-200 text-slate-700";
  const mutedCls = isDark ? "text-slate-400" : "text-slate-500";

  if (loading && !data) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 ${pageCls}`}>
        <div className="text-sm font-semibold animate-pulse">Loading Cervos HQ Command...</div>
      </div>
    );
  }

  const summary = data?.fleetSummary;
  const env = data?.notificationEnv;

  const heldOrdersCount =
    data?.wholesaleOrders.filter((o) => o.escrowStatus === "escrow_held").length ?? 0;

  const navItems: Array<{ key: HqTab; label: string; sub: string; badge?: number }> = [
    { key: "overview", label: "Overview & Map", sub: "Alerts, CSV, geo fleet" },
    { key: "fleet", label: "Orgs & Branches", sub: "Locks, commands, PINs", badge: summary?.totalOrgs },
    { key: "packages", label: "Packages & Prices", sub: "Plans & 5,000 TZS floor", badge: data?.packages.length },
    { key: "finance", label: "Wholesale & Escrow", sub: "Kasri PO holds & settlement", badge: heldOrdersCount },
    { key: "onboarding", label: "Onboarding & Quotes", sub: "Joins, quotes, invites, news", badge: (summary?.pendingJoinRequests ?? 0) + (data?.quoteRequests.length ?? 0) },
    { key: "comms", label: "Comms & Audit", sub: "SMS, broadcasts, event log", badge: summary?.unreadHqMessages },
  ];

  return (
    <div className={`min-h-screen ${pageCls}`}>
      <div className="max-w-[1520px] mx-auto px-4 sm:px-6 py-5 flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Navigation Rail */}
        <aside className={`w-full lg:w-64 shrink-0 rounded-2xl border p-4 space-y-4 lg:sticky lg:top-5 ${surfaceCls}`}>
          <div className="space-y-1.5 pb-3 border-b border-slate-500/15">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#1039B9] dark:text-sky-400">
                <IconShield className="w-3.5 h-3.5" />
                Cervos HQ
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono uppercase font-bold">
                {env?.mode || (mockMode ? "mock" : "live")}
              </span>
            </div>
            <h1
              className="text-base font-semibold tracking-tight"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              Operations Terminal
            </h1>
            <div className={`text-[11px] font-mono truncate ${mutedCls}`}>
              Op: {data?.operator || initialOperator}
            </div>
          </div>

          <nav className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-1.5">
            {navItems.map((item) => {
              const active = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key)}
                  className={`w-full text-left rounded-xl px-3 py-2.5 transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                    active
                      ? "bg-[#1039B9] text-white"
                      : `hover:bg-slate-500/10 ${mutedCls} hover:text-current`
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{item.label}</div>
                    <div className={`text-[10px] truncate hidden lg:block ${active ? "text-blue-100" : mutedCls}`}>
                      {item.sub}
                    </div>
                  </div>
                  {typeof item.badge === "number" && item.badge > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full font-mono text-[10px] shrink-0 ${
                        active ? "bg-white/20 text-white" : "bg-slate-500/15 text-current"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="pt-3 border-t border-slate-500/15 space-y-2">
            <div className={`text-[10px] font-mono leading-relaxed ${mutedCls}`}>
              Grace: {env?.trialGraceDays ?? 15}d &middot; Webhook:{" "}
              {env?.exceptionWebhookConfigured ? "Active" : "Local Log"}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => void loadFleet()}
                disabled={loading || busy}
                className={`flex-1 h-8 rounded-lg border text-xs font-semibold cursor-pointer ${chipCls}`}
              >
                {loading ? "Syncing..." : "Refresh"}
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                className={`h-8 px-2.5 rounded-lg border text-xs font-semibold cursor-pointer ${chipCls}`}
              >
                {isDark ? "Light" : "Dark"}
              </button>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full h-8 rounded-lg border border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300 text-xs font-semibold cursor-pointer"
            >
              Lock Ops Session
            </button>
          </div>
        </aside>

        {/* Main Workspace Canvas */}
        <main className="flex-1 min-w-0 w-full space-y-5">
          {/* Compact 4-Column Executive KPI Header */}
          {summary && (
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <div className={`rounded-2xl border p-4 ${surfaceCls}`}>
                <div className={`text-[10px] font-bold uppercase tracking-wider ${mutedCls}`}>
                  Organizations &amp; Access
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-2xl font-bold tabular-nums">{summary.totalOrgs}</span>
                  <span className={`text-[11px] font-semibold ${summary.lockedOrgs > 0 ? "text-red-500" : mutedCls}`}>
                    {summary.lockedOrgs} locked
                  </span>
                </div>
                <div className={`text-[11px] mt-0.5 ${mutedCls}`}>
                  {summary.activeOrgs} paid &middot; {summary.trialOrgs} trial &middot; {summary.verifiedOrgs} verified
                </div>
              </div>

              <div className={`rounded-2xl border p-4 ${surfaceCls}`}>
                <div className={`text-[10px] font-bold uppercase tracking-wider ${mutedCls}`}>
                  Branches &amp; Operators
                </div>
                <div className="text-2xl font-bold tabular-nums mt-1">
                  {summary.totalBranches} <span className={`text-sm font-normal ${mutedCls}`}>branches</span>
                </div>
                <div className={`text-[11px] mt-0.5 ${mutedCls}`}>
                  {summary.totalOperators} active operators synced
                </div>
              </div>

              <div className={`rounded-2xl border p-4 ${surfaceCls}`}>
                <div className={`text-[10px] font-bold uppercase tracking-wider ${mutedCls}`}>
                  Fleet POS Volume
                </div>
                <div className="text-xl font-bold tabular-nums mt-1 truncate">
                  {formatTzs(summary.totalSalesRevenueTzs)}
                </div>
                <div className={`text-[11px] mt-0.5 ${mutedCls}`}>
                  {summary.totalSalesCount} counter receipts
                </div>
              </div>

              <div className={`rounded-2xl border p-4 ${surfaceCls}`}>
                <div className={`text-[10px] font-bold uppercase tracking-wider ${mutedCls}`}>
                  Inventory Value &amp; Expiry
                </div>
                <div className="text-xl font-bold tabular-nums mt-1 truncate">
                  {formatTzs(summary.totalStockCostTzs)}
                </div>
                <div className={`text-[11px] mt-0.5 ${mutedCls}`}>
                  {summary.expiredBatches} expired &middot; {summary.nearExpiryBatches} near
                </div>
              </div>
            </div>
          )}

          {/* Action Banner */}
          {banner && (
            <div
              className={`rounded-xl border px-4 py-3 text-xs font-semibold flex items-center justify-between gap-2 ${
                banner.type === "ok"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
              }`}
            >
              <span>{banner.text}</span>
              <button
                type="button"
                onClick={() => setBanner(null)}
                className="text-xs opacity-75 hover:opacity-100 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Active Workspace View */}
          {data && summary && activeTab === "overview" && (
            <HQOverviewSection
              summary={summary}
              accounts={data.accounts}
              wholesaleOrders={data.wholesaleOrders}
              auditLogs={data.auditLogs}
              onSwitchTab={setActiveTab}
              onSelectOrg={setSelectedOrgId}
              isDark={isDark}
            />
          )}

          {data && activeTab === "fleet" && (
            <HQFleetSection
              accounts={data.accounts}
              auditLogs={data.auditLogs}
              packages={data.packages}
              selectedOrgId={selectedOrgId}
              onSelectOrg={setSelectedOrgId}
              onRunAction={runAction}
              onJumpToComposer={(accountId) => {
                setComposerOrgId(accountId);
                setCommsView("messages");
                setActiveTab("comms");
              }}
              onJumpToOrgEvents={(accountId) => {
                setEventOrgFilter(accountId);
                setCommsView("events");
                setActiveTab("comms");
              }}
              isDark={isDark}
              busy={busy}
            />
          )}

          {data && activeTab === "packages" && (
            <HQPackagesSection
              packages={data.packages}
              minBranchPriceTzs={data.minBranchPriceTzs}
              onRunAction={runAction}
              isDark={isDark}
              busy={busy}
            />
          )}

          {data && activeTab === "finance" && (
            <HQFinanceSection
              wholesaleOrders={data.wholesaleOrders}
              accounts={data.accounts}
              packages={data.packages}
              onRunAction={runAction}
              isDark={isDark}
              busy={busy}
            />
          )}

          {data && activeTab === "onboarding" && (
            <HQLoungeAndUpdates
              joinRequests={data.joinRequests}
              accounts={data.accounts}
              hqUpdates={data.hqUpdates}
              quoteRequests={data.quoteRequests}
              supplierInvites={data.supplierInvites}
              onRunAction={runAction}
              isDark={isDark}
              busy={busy}
            />
          )}

          {data && activeTab === "comms" && (
            <div className="space-y-4">
              <div className={`inline-flex rounded-xl border p-1 gap-1 ${surfaceCls}`}>
                <button
                  type="button"
                  onClick={() => setCommsView("messages")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    commsView === "messages" ? "bg-[#1039B9] text-white" : mutedCls
                  }`}
                >
                  Broadcasts &amp; Textify SMS ({data.hqMessages.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCommsView("events")}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    commsView === "events" ? "bg-[#1039B9] text-white" : mutedCls
                  }`}
                >
                  Audit Event Explorer ({data.auditLogs.length})
                </button>
              </div>

              {commsView === "messages" ? (
                <HQMessageComposer
                  accounts={data.accounts}
                  hqMessages={data.hqMessages}
                  defaultAccountId={composerOrgId}
                  operatorName={data.operator || initialOperator}
                  onRunAction={runAction}
                  isDark={isDark}
                  busy={busy}
                />
              ) : (
                <HQEventExplorer
                  auditLogs={data.auditLogs}
                  categoryCounts={data.auditCategoryCounts}
                  accounts={data.accounts}
                  orgFilter={eventOrgFilter}
                  onOrgFilterChange={setEventOrgFilter}
                  onRunAction={runAction}
                  isDark={isDark}
                  busy={busy}
                />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
