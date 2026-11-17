"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatTzs } from "@cervos/core";
import { IconShield } from "@/components/LandingIcons";
import { useWorkspaceTheme } from "@/lib/workspace/theme";
import HQFleetSection from "./HQFleetSection";
import HQEventExplorer from "./HQEventExplorer";
import HQMessageComposer from "./HQMessageComposer";
import HQLoungeAndUpdates from "./HQLoungeAndUpdates";
import type { HqFleetPayload, HqTab } from "./types";

interface HQConsoleClientProps {
  gateSlug?: string;
  initialOperator: string;
  mockMode: boolean;
}

export default function HQConsoleClient({
  gateSlug,
  initialOperator,
  mockMode,
}: HQConsoleClientProps) {
  const router = useRouter();
  const { isDark, toggleTheme } = useWorkspaceTheme();

  const [data, setData] = useState<HqFleetPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<HqTab>("fleet");
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [eventOrgFilter, setEventOrgFilter] = useState("ALL");
  const [composerOrgId, setComposerOrgId] = useState("ALL");
  const [banner, setBanner] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const loadFleet = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ops-v9k4m/dispatch?scope=fleet", {
        cache: "no-store",
        headers: gateSlug ? { "X-Ops-Gate": gateSlug } : undefined,
      });
      if (res.status === 401 || res.status === 403) {
        router.refresh();
        return;
      }
      const json = (await res.json()) as HqFleetPayload & { error?: string };
      if (!res.ok) {
        setBanner({ type: "err", text: json.error || "Failed to load telemetry state." });
        return;
      }
      setData(json);
      setSelectedOrgId((prev) => prev || json.accounts[0]?.id || "");
    } catch {
      setBanner({ type: "err", text: "Network error loading telemetry state." });
    } finally {
      setLoading(false);
    }
  }, [gateSlug, router]);

  useEffect(() => {
    void loadFleet();
  }, [loadFleet]);

  const runAction = async (
    payload: Record<string, unknown>,
    successMessage: string
  ): Promise<boolean> => {
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch("/api/ops-v9k4m/dispatch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(gateSlug ? { "X-Ops-Gate": gateSlug } : {}),
        },
        body: JSON.stringify(payload),
      });
      const out = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !out.ok) {
        setBanner({ type: "err", text: out.error || "Command rejected." });
        return false;
      }
      setBanner({ type: "ok", text: successMessage });
      await loadFleet();
      return true;
    } catch {
      setBanner({ type: "err", text: "Network error dispatching command." });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    await fetch("/api/ops-v9k4m/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    router.refresh();
  };

  const pageCls = isDark
    ? "bg-[#090C12] text-slate-100"
    : "bg-[#F8FAFC] text-[#111317]";
  const cardCls = isDark
    ? "bg-[#11161F] border-slate-800 text-slate-100"
    : "bg-white border-[#EAECF0] text-[#111317]";
  const chipCls = isDark
    ? "bg-[#171D28] border-slate-800 text-slate-200"
    : "bg-[#F8FAFC] border-[#EAECF0] text-[#111317]";
  const mutedCls = isDark ? "text-slate-400" : "text-[#64748B]";

  if (loading && !data) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 ${pageCls}`}>
        <div className="text-sm font-semibold animate-pulse">
          Loading Cervos HQ Fleet Console...
        </div>
      </div>
    );
  }

  const summary = data?.fleetSummary;
  const env = data?.notificationEnv;

  const tabs: Array<{ key: HqTab; label: string; badge?: number }> = [
    { key: "fleet", label: "Fleet & Locks", badge: summary?.totalOrgs },
    { key: "events", label: "Event & Audit Explorer", badge: data?.auditLogs.length },
    { key: "composer", label: "HQ Message Composer", badge: summary?.unreadHqMessages },
    { key: "lounge", label: "Lounge & Updates", badge: summary?.pendingJoinRequests },
  ];

  return (
    <div className={`min-h-screen px-4 py-6 sm:px-8 ${pageCls}`}>
      <div className="max-w-[1440px] mx-auto space-y-6">
        {/* Top HQ Command Header */}
        <header className={`rounded-[24px] border p-5 flex flex-wrap items-center justify-between gap-4 ${cardCls}`}>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-[#1039B9] dark:text-[#38BDF8] text-[10px] font-bold uppercase tracking-widest">
                <IconShield className="w-3.5 h-3.5" />
                CV-OPS Telemetry Node v9
              </span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono uppercase font-bold">
                {env?.mode || (mockMode ? "mock" : "production")} mode
              </span>
              <span className={`px-2.5 py-1 rounded-full border text-[10px] font-mono ${chipCls}`}>
                Operator: {data?.operator || initialOperator}
              </span>
            </div>
            <h1
              className="text-2xl sm:text-3xl font-normal tracking-tight"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              Multi-Organization Governance &amp; Operational Telemetry
            </h1>
            <p className={`text-xs ${mutedCls}`}>
              Grace window: {env?.trialGraceDays ?? 15}d &middot; Webhook:{" "}
              {env?.exceptionWebhookConfigured ? "Configured" : "Local Log"} &middot; Exception Email:{" "}
              {env?.exceptionEmailMasked || "Not configured"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className={`px-3.5 py-2 rounded-full border text-xs font-semibold cursor-pointer ${chipCls}`}
            >
              {isDark ? "Light Mode" : "Dark Mode"}
            </button>
            <button
              type="button"
              onClick={() => void loadFleet()}
              disabled={loading || busy}
              className={`px-3.5 py-2 rounded-full border text-xs font-semibold cursor-pointer ${chipCls}`}
            >
              {loading ? "Syncing..." : "Refresh Fleet"}
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="px-3.5 py-2 rounded-full border border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300 text-xs font-semibold cursor-pointer"
            >
              Lock Ops Session
            </button>
          </div>
        </header>

        {/* Action Feedback Banner */}
        {banner && (
          <div
            className={`rounded-2xl border px-4 py-3 text-xs font-semibold flex items-center justify-between gap-2 ${
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

        {/* Fleet KPI Strip */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className={`rounded-2xl border p-4 ${cardCls}`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${mutedCls}`}>
                Organizations
              </div>
              <div className="text-2xl font-bold tabular-nums mt-1">{summary.totalOrgs}</div>
              <div className={`text-[11px] mt-0.5 ${mutedCls}`}>
                {summary.activeOrgs} active &middot; {summary.trialOrgs} trial
              </div>
            </div>

            <div className={`rounded-2xl border p-4 ${cardCls}`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${mutedCls}`}>
                Locks &amp; Overdue
              </div>
              <div
                className={`text-2xl font-bold tabular-nums mt-1 ${
                  summary.lockedOrgs > 0 ? "text-red-600 dark:text-red-400" : ""
                }`}
              >
                {summary.lockedOrgs}
              </div>
              <div className={`text-[11px] mt-0.5 ${mutedCls}`}>
                {summary.hqLockedOrgs} HQ &middot; {summary.billingOverdueOrgs} billing
              </div>
            </div>

            <div className={`rounded-2xl border p-4 ${cardCls}`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${mutedCls}`}>
                Branches &amp; Staff
              </div>
              <div className="text-2xl font-bold tabular-nums mt-1">
                {summary.totalBranches} / {summary.totalOperators}
              </div>
              <div className={`text-[11px] mt-0.5 ${mutedCls}`}>
                {summary.verifiedOrgs} verified orgs
              </div>
            </div>

            <div className={`rounded-2xl border p-4 ${cardCls}`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${mutedCls}`}>
                Fleet POS Revenue
              </div>
              <div className="text-xl font-bold tabular-nums mt-1 truncate">
                {formatTzs(summary.totalSalesRevenueTzs)}
              </div>
              <div className={`text-[11px] mt-0.5 ${mutedCls}`}>
                {summary.totalSalesCount} synced receipts
              </div>
            </div>

            <div className={`rounded-2xl border p-4 ${cardCls}`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${mutedCls}`}>
                Stock Cost &amp; FEFO
              </div>
              <div className="text-xl font-bold tabular-nums mt-1 truncate">
                {formatTzs(summary.totalStockCostTzs)}
              </div>
              <div className={`text-[11px] mt-0.5 ${mutedCls}`}>
                {summary.expiredBatches} expired &middot; {summary.nearExpiryBatches} near
              </div>
            </div>

            <div className={`rounded-2xl border p-4 ${cardCls}`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${mutedCls}`}>
                Pending Queues
              </div>
              <div className="text-2xl font-bold tabular-nums mt-1">
                {summary.pendingJoinRequests} / {summary.unreadHqMessages}
              </div>
              <div className={`text-[11px] mt-0.5 ${mutedCls}`}>
                joins pending / HQ unread
              </div>
            </div>
          </div>
        )}

        {/* Primary Tab Switcher */}
        <nav className={`rounded-2xl border p-1.5 flex flex-wrap gap-1.5 ${cardCls}`}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === tab.key
                  ? "bg-[#1039B9] text-white shadow-xs"
                  : `${mutedCls} hover:text-current`
              }`}
            >
              <span>{tab.label}</span>
              {typeof tab.badge === "number" && (
                <span
                  className={`px-1.5 py-0.5 rounded-full font-mono text-[10px] ${
                    activeTab === tab.key
                      ? "bg-white/20 text-white"
                      : "bg-slate-500/15 text-current"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Tab Views */}
        {data && activeTab === "fleet" && (
          <HQFleetSection
            accounts={data.accounts}
            auditLogs={data.auditLogs}
            selectedOrgId={selectedOrgId}
            onSelectOrg={setSelectedOrgId}
            onRunAction={runAction}
            onJumpToComposer={(accountId) => {
              setComposerOrgId(accountId);
              setActiveTab("composer");
            }}
            onJumpToOrgEvents={(accountId) => {
              setEventOrgFilter(accountId);
              setActiveTab("events");
            }}
            isDark={isDark}
            busy={busy}
          />
        )}

        {data && activeTab === "events" && (
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

        {data && activeTab === "composer" && (
          <HQMessageComposer
            accounts={data.accounts}
            hqMessages={data.hqMessages}
            defaultAccountId={composerOrgId}
            operatorName={data.operator || initialOperator}
            onRunAction={runAction}
            isDark={isDark}
            busy={busy}
          />
        )}

        {data && activeTab === "lounge" && (
          <HQLoungeAndUpdates
            joinRequests={data.joinRequests}
            accounts={data.accounts}
            hqUpdates={data.hqUpdates}
            onRunAction={runAction}
            isDark={isDark}
            busy={busy}
          />
        )}
      </div>
    </div>
  );
}
