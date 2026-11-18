"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatTzs } from "@cervos/core";
import { HQ_ROLE_METADATA } from "@/lib/hq-workers";
import { CERVOS_HQ_ASSETS, hqSurfaceTokens } from "./hqSurface";
import HQOverviewSection from "./HQOverviewSection";
import HQSupportDeskSection from "./HQSupportDeskSection";
import HQTeamSection from "./HQTeamSection";
import HQFleetSection from "./HQFleetSection";
import HQPackagesSection from "./HQPackagesSection";
import HQFinanceSection from "./HQFinanceSection";
import HQEventExplorer from "./HQEventExplorer";
import HQMessageComposer from "./HQMessageComposer";
import HQLoungeAndUpdates from "./HQLoungeAndUpdates";
import HQJournalSection from "./HQJournalSection";
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

  const t = hqSurfaceTokens(isDark);

  if (loading && !data) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-4 p-6 ${t.canvasCls}`}>
        <div className={`w-16 h-16 rounded-2xl p-2 flex items-center justify-center ${t.panelCls}`}>
          <img
            src={
              isDark
                ? CERVOS_HQ_ASSETS.companyLogoCircularDark
                : CERVOS_HQ_ASSETS.companyLogoCircular
            }
            alt="Cervos HQ"
            className="w-full h-full object-contain rounded-xl"
          />
        </div>
        <div className="inline-flex items-center gap-2 text-sm font-semibold">
          <span className="w-4 h-4 rounded-full border-2 border-[#1039B9] dark:border-sky-400 border-t-transparent animate-spin" />
          <span>Synchronizing Cervos HQ Command...</span>
        </div>
      </div>
    );
  }

  const summary = data?.fleetSummary;
  const env = data?.notificationEnv;
  const worker = data?.currentWorker;
  const roleMeta = worker ? HQ_ROLE_METADATA[worker.role] : HQ_ROLE_METADATA.hq_master;

  const heldOrdersCount =
    data?.wholesaleOrders.filter((o) => o.escrowStatus === "escrow_held").length ?? 0;

  const navItems: Array<{ key: HqTab; label: string; sub: string; badge?: number; urgent?: boolean }> = [
    { key: "overview", label: "Overview & Map", sub: "Peak telemetry, CSV, assets" },
    {
      key: "support",
      label: "Support Desk",
      sub: "Tickets & response queue",
      badge: summary?.openSupportTickets ?? 0,
      urgent: (summary?.urgentSupportTickets ?? 0) > 0,
    },
    {
      key: "team",
      label: "HQ Team & Shifts",
      sub: "Worker onboarding & notes",
      badge: (data?.hqWorkers?.length ?? 0) || undefined,
    },
    { key: "fleet", label: "Orgs & Branches", sub: "Quota, locks, Kasri Payouts", badge: summary?.totalOrgs },
    { key: "packages", label: "Packages & Prices", sub: "Plans & 5,000 TZS floor", badge: data?.packages.length },
    { key: "finance", label: "Wholesale & Escrow", sub: "Kasri PO holds & settlement", badge: heldOrdersCount },
    {
      key: "onboarding",
      label: "Onboarding & Quotes",
      sub: "Joins, quotes, invites, news",
      badge: (summary?.pendingJoinRequests ?? 0) + (data?.quoteRequests.length ?? 0),
    },
    { key: "journal", label: "Dispatch Journal", sub: "Write essays & WebP covers", badge: data?.journalArticles?.length },
    { key: "comms", label: "Comms & Audit", sub: "SMS, broadcasts, event log", badge: summary?.unreadHqMessages },
  ];

  return (
    <div className={`min-h-screen ${t.canvasCls}`}>
      <div className="max-w-[1540px] mx-auto px-4 sm:px-6 py-5 flex flex-col lg:flex-row gap-6 items-start">
        {/* Claymorphic Command Navigation Rail */}
        <aside className={`w-full lg:w-72 shrink-0 p-4 sm:p-5 space-y-4 lg:sticky lg:top-5 ${t.panelCls}`}>
          {/* Brand Logo Lockup */}
          <div className={`flex items-center justify-between gap-2 pb-3 border-b ${t.subtleBorderCls}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-10 h-10 rounded-xl p-1 shrink-0 ${t.pillCls}`}>
                <img
                  src={
                    isDark
                      ? CERVOS_HQ_ASSETS.companyLogoCircularDark
                      : CERVOS_HQ_ASSETS.companyLogoCircular
                  }
                  alt="Cervos Emblem"
                  className="w-full h-full object-contain rounded-lg"
                />
              </div>
              <div className="min-w-0">
                <img
                  src={CERVOS_HQ_ASSETS.companyLogoTransparent}
                  alt="Cervos"
                  className={`h-4 w-auto object-contain ${isDark ? "brightness-0 invert" : ""}`}
                />
                <div className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 truncate ${t.mutedCls}`}>
                  Operations HQ
                </div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono uppercase font-bold shrink-0">
              {env?.mode || (mockMode ? "mock" : "live")}
            </span>
          </div>

          {/* Signed-in Operator Role Well */}
          <div className={`p-3 space-y-1 ${t.wellCls}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold truncate">
                {data?.operator || initialOperator}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#1039B9] text-white font-mono text-[9px] font-bold shrink-0">
                {roleMeta.shortTag}
              </span>
            </div>
            <div className={`text-[10px] truncate ${t.mutedCls}`}>
              {worker?.title || roleMeta.defaultTitle}
            </div>
          </div>

          <nav className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-2">
            {navItems.map((item) => {
              const active = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key)}
                  className={`w-full text-left rounded-2xl px-3.5 py-2.5 transition-all flex items-center justify-between gap-2 cursor-pointer ${
                    active ? t.primaryBtnCls : `${t.pillCls} hover:scale-[1.01]`
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{item.label}</div>
                    <div className={`text-[10px] truncate hidden lg:block ${active ? "text-blue-100" : t.mutedCls}`}>
                      {item.sub}
                    </div>
                  </div>
                  {typeof item.badge === "number" && item.badge > 0 && (
                    <span
                      className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold shrink-0 ${
                        active
                          ? "bg-white/25 text-white"
                          : item.urgent
                            ? "bg-rose-500 text-white"
                            : "bg-[#1039B9]/12 text-[#1039B9] dark:text-sky-300"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className={`pt-3 border-t ${t.subtleBorderCls} space-y-2.5`}>
            <div className={`text-[10px] font-mono leading-relaxed ${t.mutedCls}`}>
              Grace: {env?.trialGraceDays ?? 15}d &middot; Webhook:{" "}
              {env?.exceptionWebhookConfigured ? "Active" : "Local Log"}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void loadFleet()}
                disabled={loading || busy}
                className={`flex-1 h-9 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer ${t.pillCls}`}
              >
                {loading && (
                  <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                )}
                <span>{loading ? "Syncing..." : "Refresh"}</span>
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                className={`h-9 px-3 rounded-xl text-xs font-semibold cursor-pointer ${t.pillCls}`}
              >
                {isDark ? "Light" : "Dark"}
              </button>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full h-9 rounded-xl border border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs font-semibold cursor-pointer hover:bg-rose-500/18 transition-colors"
            >
              Lock Ops Session
            </button>
          </div>
        </aside>

        {/* Main Workspace Canvas */}
        <main className="flex-1 min-w-0 w-full space-y-5">
          {/* Tactile Neumorphic 4-Column Executive KPI Strip */}
          {summary && (
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <div className={`p-4 space-y-1.5 ${t.panelCls}`}>
                <div className={`text-[10px] font-bold uppercase tracking-wider ${t.mutedCls}`}>
                  Organizations &amp; Access
                </div>
                <div className={`px-3 py-2 flex items-baseline justify-between ${t.wellCls}`}>
                  <span className="text-2xl font-bold tabular-nums">{summary.totalOrgs}</span>
                  <span className={`text-[11px] font-semibold ${summary.lockedOrgs > 0 ? "text-rose-500" : t.mutedCls}`}>
                    {summary.lockedOrgs} locked
                  </span>
                </div>
                <div className={`text-[11px] ${t.mutedCls}`}>
                  {summary.activeOrgs} paid &middot; {summary.trialOrgs} trial &middot; {summary.verifiedOrgs} verified
                </div>
              </div>

              <div className={`p-4 space-y-1.5 ${t.panelCls}`}>
                <div className={`text-[10px] font-bold uppercase tracking-wider ${t.mutedCls}`}>
                  Support &amp; HQ Team
                </div>
                <div className={`px-3 py-2 flex items-baseline justify-between ${t.wellCls}`}>
                  <span className="text-2xl font-bold tabular-nums">
                    {summary.openSupportTickets ?? 0}
                  </span>
                  <span className={`text-[11px] font-semibold ${(summary.urgentSupportTickets ?? 0) > 0 ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                    open tickets
                  </span>
                </div>
                <div className={`text-[11px] ${t.mutedCls}`}>
                  {summary.activeHqWorkers ?? 0} active HQ staff &middot; {summary.invitedHqWorkers ?? 0} invited
                </div>
              </div>

              <div className={`p-4 space-y-1.5 ${t.panelCls}`}>
                <div className={`text-[10px] font-bold uppercase tracking-wider ${t.mutedCls}`}>
                  Fleet POS Volume
                </div>
                <div className={`px-3 py-2 ${t.wellCls}`}>
                  <div className="text-xl font-bold tabular-nums truncate">
                    {formatTzs(summary.totalSalesRevenueTzs)}
                  </div>
                </div>
                <div className={`text-[11px] ${t.mutedCls}`}>
                  {summary.totalSalesCount} counter receipts &middot; {summary.totalBranches} branches
                </div>
              </div>

              <div className={`p-4 space-y-1.5 ${t.panelCls}`}>
                <div className={`text-[10px] font-bold uppercase tracking-wider ${t.mutedCls}`}>
                  Inventory Value &amp; Expiry
                </div>
                <div className={`px-3 py-2 ${t.wellCls}`}>
                  <div className="text-xl font-bold tabular-nums truncate">
                    {formatTzs(summary.totalStockCostTzs)}
                  </div>
                </div>
                <div className={`text-[11px] ${t.mutedCls}`}>
                  {summary.expiredBatches} expired &middot; {summary.nearExpiryBatches} near expiry
                </div>
              </div>
            </div>
          )}

          {/* Action Feedback Toast */}
          {banner && (
            <div
              className={`rounded-2xl border px-4 py-3 text-xs font-semibold flex items-center justify-between gap-2 ${
                banner.type === "ok"
                  ? "border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                  : "border-rose-500/35 bg-rose-500/12 text-rose-700 dark:text-rose-300"
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

          {/* Active Workspace Views */}
          {data && summary && activeTab === "overview" && (
            <HQOverviewSection
              summary={summary}
              peakTelemetry={data.peakTelemetry}
              accounts={data.accounts}
              wholesaleOrders={data.wholesaleOrders}
              auditLogs={data.auditLogs}
              supportTickets={data.supportTickets ?? []}
              hqTeamNotes={data.hqTeamNotes ?? []}
              onSwitchTab={setActiveTab}
              onSelectOrg={setSelectedOrgId}
              isDark={isDark}
            />
          )}

          {data && activeTab === "support" && (
            <HQSupportDeskSection
              tickets={data.supportTickets ?? []}
              workers={data.hqWorkers ?? []}
              accounts={data.accounts}
              currentWorker={data.currentWorker}
              onRunAction={runAction}
              onJumpToOrg={(accountId) => {
                setSelectedOrgId(accountId);
                setActiveTab("fleet");
              }}
              isDark={isDark}
              busy={busy}
            />
          )}

          {data && activeTab === "team" && (
            <HQTeamSection
              gateSlug={gateSlug}
              workers={data.hqWorkers ?? []}
              notes={data.hqTeamNotes ?? []}
              currentWorker={data.currentWorker}
              onRunAction={runAction}
              onRefresh={loadFleet}
              isDark={isDark}
              busy={busy}
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

          {data && activeTab === "journal" && (
            <HQJournalSection
              articles={data.journalArticles ?? []}
              operatorName={data.operator || initialOperator}
              onRunAction={runAction}
              isDark={isDark}
              busy={busy}
            />
          )}

          {data && activeTab === "comms" && (
            <div className="space-y-4">
              <div className={`inline-flex rounded-2xl p-1.5 gap-1.5 ${t.wellCls}`}>
                <button
                  type="button"
                  onClick={() => setCommsView("messages")}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                    commsView === "messages" ? t.primaryBtnCls : t.mutedCls
                  }`}
                >
                  Broadcasts &amp; Textify SMS ({data.hqMessages.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCommsView("events")}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                    commsView === "events" ? t.primaryBtnCls : t.mutedCls
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
