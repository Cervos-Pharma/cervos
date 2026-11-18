"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatTzs } from "@cervos/core";
import { canHqWorker, HQ_ROLE_METADATA, type HqWorkerCapabilities } from "@/lib/hq-workers";
import { CERVOS_HQ_ASSETS, hqSurfaceTokens } from "./hqSurface";
import HQOverviewSection from "./HQOverviewSection";
import HQDecisionInboxSection from "./HQDecisionInboxSection";
import HQIntelligenceTwinSection from "./HQIntelligenceTwinSection";
import HQCaseAndPrivacySection from "./HQCaseAndPrivacySection";
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

function RailNavSvg({ tab }: { tab: HqTab }) {
  const cls = "w-4 h-4 shrink-0";
  switch (tab) {
    case "overview":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.85}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6Zm0 9.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25Zm9.75-9.75A2.25 2.25 0 0 1 15.75 3.75H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6Zm0 9.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
        </svg>
      );
    case "decisions":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.85}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      );
    case "intelligence":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.85}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5" />
        </svg>
      );
    case "cases":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.85}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
        </svg>
      );
    case "support":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.85}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
        </svg>
      );
    case "fleet":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.85}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
        </svg>
      );
    case "finance":
    case "packages":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.85}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
        </svg>
      );
    case "team":
    case "onboarding":
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.85}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
        </svg>
      );
    default:
      return (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.85}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
      );
  }
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
  const [railExpanded, setRailExpanded] = useState(true);
  const [quickSearch, setQuickSearch] = useState("");
  const [timelineFilter, setTimelineFilter] = useState("all");
  const [bellOpen, setBellOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Light-first architectural porcelain matches supp.jpg & res.jpg unless user explicitly sets dark
    const savedTheme = window.localStorage.getItem("cv-ops-theme");
    setIsDark(savedTheme === "dark");
    const savedRail = window.localStorage.getItem("cv-ops-rail-expanded");
    if (savedRail !== null) {
      setRailExpanded(savedRail === "1");
    }

    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      window.localStorage.setItem("cv-ops-theme", next ? "dark" : "light");
      return next;
    });
  };

  const toggleRail = () => {
    setRailExpanded((prev) => {
      const next = !prev;
      window.localStorage.setItem("cv-ops-rail-expanded", next ? "1" : "0");
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
        const json = (await res.json()) as { error?: string; oneTimePin?: string; eventId?: string };
        if (!res.ok) {
          setBanner({ type: "err", text: json.error || "Ops command rejected." });
          return false;
        }
        const pinNote = json.oneTimePin ? ` · One-time PIN: ${json.oneTimePin}` : "";
        setBanner({ type: "ok", text: `${successMessage}${pinNote}` });
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

  const summary = data?.fleetSummary;
  const env = data?.notificationEnv;
  const worker = data?.currentWorker;
  const roleMeta = worker ? HQ_ROLE_METADATA[worker.role] : HQ_ROLE_METADATA.hq_master;
  const heldOrdersCount = data?.wholesaleOrders.filter((o) => o.escrowStatus === "escrow_held").length ?? 0;
  const pendingProposalsCount = (data?.proposals ?? []).filter((p) => p.status === "proposed").length;

  const searchMatches = useMemo(() => {
    const q = quickSearch.trim().toLowerCase();
    if (!q || !data) return [];
    return data.accounts
      .filter(
        (a) =>
          a.orgName.toLowerCase().includes(q) ||
          a.region.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [quickSearch, data]);

  const navItems: Array<{
    key: HqTab;
    label: string;
    sub: string;
    badge?: number;
    urgent?: boolean;
    requiredCap?: keyof HqWorkerCapabilities;
  }> = [
    { key: "overview", label: "Promise Board", sub: "Spatial map & spine" },
    {
      key: "decisions",
      label: "Decision Inbox",
      sub: "Proposals & agents",
      badge: pendingProposalsCount || undefined,
    },
    { key: "intelligence", label: "Models & Twin", sub: "Gates, scorecards, what-if" },
    {
      key: "cases",
      label: "Recalls & Privacy",
      sub: "Lineage, cases, k>=5 gate",
      badge: (data?.recalls ?? []).filter((r) => r.state !== "closed").length || undefined,
    },
    {
      key: "support",
      label: "Support Desk",
      sub: "Tickets & queue",
      badge: summary?.openSupportTickets ?? 0,
      urgent: (summary?.urgentSupportTickets ?? 0) > 0,
      requiredCap: "canAnswerSupport",
    },
    {
      key: "fleet",
      label: "Orgs & Branches",
      sub: "Access state & Kasri",
      badge: summary?.totalOrgs,
      requiredCap: "canManageFleetLocks",
    },
    {
      key: "finance",
      label: "Escrow & Billing",
      sub: "Kasri ledger & holds",
      badge: heldOrdersCount || undefined,
      requiredCap: "canManageBillingEscrow",
    },
    {
      key: "packages",
      label: "Packages & Prices",
      sub: "Plans & 5,000 floor",
      badge: data?.packages.length,
      requiredCap: "canManagePackages",
    },
    {
      key: "team",
      label: "HQ Team & Shifts",
      sub: "Workers & handoff notes",
      badge: (data?.hqWorkers?.length ?? 0) || undefined,
    },
    {
      key: "onboarding",
      label: "Onboarding & Quotes",
      sub: "Joins, invites, news",
      badge: (summary?.pendingJoinRequests ?? 0) + (data?.quoteRequests.length ?? 0),
      requiredCap: "canManageOnboarding",
    },
    {
      key: "journal",
      label: "Dispatch Journal",
      sub: "Essays & covers",
      badge: data?.journalArticles?.length,
      requiredCap: "canPublishEditorial",
    },
    {
      key: "comms",
      label: "Comms & Audit",
      sub: "SMS & event stream",
      badge: summary?.unreadHqMessages,
      requiredCap: "canBroadcastComms",
    },
  ];

  if (loading && !data) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-4 p-6 ${t.canvasCls}`}>
        <div className={`w-16 h-16 rounded-2xl p-2 flex items-center justify-center ${t.panelCls}`}>
          <img
            src={isDark ? CERVOS_HQ_ASSETS.companyLogoCircularDark : CERVOS_HQ_ASSETS.companyLogoCircular}
            alt="Cervos HQ"
            className="w-full h-full object-contain rounded-xl"
          />
        </div>
        <div className="inline-flex items-center gap-2 text-sm font-semibold">
          <span className="w-4 h-4 rounded-full border-2 border-[#1039B9] dark:border-sky-400 border-t-transparent animate-spin" />
          <span>Loading Cervos HQ Spine...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${t.canvasCls}`}>
      {/* COMPACT FULL-BLEED SINGLE-ROW COMMAND BAR */}
      <header className={`sticky top-0 z-30 border-b backdrop-blur-md ${isDark ? "bg-[#090C12]/92 border-slate-800" : "bg-white/92 border-[#E2E8F0]"}`}>
        <div className="max-w-[1920px] w-full mx-auto px-3 sm:px-6 h-[52px] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={toggleRail}
              aria-label="Toggle navigation rail"
              className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer shrink-0 ${t.pillCls}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
              </svg>
            </button>
            <img
              src={isDark ? CERVOS_HQ_ASSETS.companyLogoCircularDark : CERVOS_HQ_ASSETS.companyLogoCircular}
              alt="Cervos Emblem"
              className="w-7 h-7 rounded-full object-contain shrink-0"
            />
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-bold tracking-tight truncate" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                Cervos HQ
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono uppercase font-bold shrink-0">
                {env?.mode || (mockMode ? "mock" : "live")}
              </span>
              {data?.spine && (
                <button
                  type="button"
                  onClick={() => setActiveTab("comms")}
                  className={`hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono cursor-pointer ${t.wellCls}`}
                >
                  <span>Spine #{data.spine.globalSeqHead}</span>
                  <span>&middot;</span>
                  <span className={data.spine.chainVerified ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-rose-500 font-bold"}>
                    {data.spine.chainVerified ? "Verified" : "Check"}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Clickable Live Fleet Telemetry Strip (replaces bulky repeated top cards) */}
          {summary && (
            <div className="hidden xl:flex items-center gap-1.5 text-[11px] font-mono">
              <button
                type="button"
                onClick={() => setActiveTab("fleet")}
                className={`px-2.5 py-1 rounded-full cursor-pointer transition-colors hover:border-[#1039B9]/50 ${t.wellCls}`}
              >
                <span className={t.mutedCls}>Orgs </span>
                <strong>{summary.totalOrgs}</strong>
                {summary.lockedOrgs > 0 && <span className="text-rose-500"> ({summary.lockedOrgs} lock)</span>}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("decisions")}
                className={`px-2.5 py-1 rounded-full cursor-pointer transition-colors hover:border-[#1039B9]/50 ${t.wellCls}`}
              >
                <span className={t.mutedCls}>Queue </span>
                <strong className="text-[#1039B9] dark:text-sky-400">{pendingProposalsCount}</strong>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("support")}
                className={`px-2.5 py-1 rounded-full cursor-pointer transition-colors hover:border-[#1039B9]/50 ${t.wellCls}`}
              >
                <span className={t.mutedCls}>Tickets </span>
                <strong className={(summary.openSupportTickets ?? 0) > 0 ? "text-rose-500" : ""}>
                  {summary.openSupportTickets ?? 0}
                </strong>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("finance")}
                className={`px-2.5 py-1 rounded-full cursor-pointer transition-colors hover:border-[#1039B9]/50 ${t.wellCls}`}
              >
                <span className={t.mutedCls}>POS </span>
                <strong>{formatTzs(summary.totalSalesRevenueTzs, { compact: true })}</strong>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("intelligence")}
                className={`px-2.5 py-1 rounded-full cursor-pointer transition-colors hover:border-[#1039B9]/50 ${t.wellCls}`}
              >
                <span className={t.mutedCls}>Near Exp </span>
                <strong className={summary.nearExpiryBatches > 0 ? "text-amber-600 dark:text-amber-400" : ""}>
                  {summary.nearExpiryBatches}
                </strong>
              </button>
            </div>
          )}

          {/* Search + Exports + Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="relative hidden md:block">
              <input
                ref={searchInputRef}
                type="search"
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                placeholder="Jump to org (/)..."
                className={`w-44 lg:w-52 h-8 px-3 rounded-full text-xs ${t.inputCls}`}
              />
              {searchMatches.length > 0 && (
                <div className={`absolute right-0 mt-1.5 w-64 rounded-2xl p-2 z-50 space-y-1 ${t.glassHudCls}`}>
                  {searchMatches.map((org) => (
                    <button
                      key={org.id}
                      type="button"
                      onClick={() => {
                        setSelectedOrgId(org.id);
                        setActiveTab("fleet");
                        setQuickSearch("");
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-[#1039B9]/10 flex items-center justify-between cursor-pointer"
                    >
                      <span className="font-semibold truncate">{org.orgName}</span>
                      <span className={`text-[10px] ${t.mutedCls}`}>{org.region}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <a
              href="/api/hq/export/accounts"
              download
              className={`hidden 2xl:inline-flex h-8 items-center px-2.5 rounded-full text-[11px] font-semibold ${t.pillCls}`}
            >
              Orgs CSV
            </a>
            <a
              href="/api/hq/export/payments"
              download
              className={`hidden 2xl:inline-flex h-8 items-center px-2.5 rounded-full text-[11px] font-semibold ${t.pillCls}`}
            >
              Pay CSV
            </a>

            <div className="relative">
              <button
                type="button"
                onClick={() => setBellOpen((o) => !o)}
                className={`relative w-8 h-8 rounded-full flex items-center justify-center cursor-pointer ${t.pillCls}`}
                aria-label="HQ Alerts"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.85}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                </svg>
                {((summary?.openSupportTickets ?? 0) > 0 || pendingProposalsCount > 0) && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500" />
                )}
              </button>
              {bellOpen && (
                <div className={`absolute right-0 mt-2 w-72 rounded-2xl p-3 space-y-1.5 z-50 text-xs ${t.glassHudCls}`}>
                  <div className="font-bold uppercase tracking-wider text-[10px] pb-1">HQ Live Queues</div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("support");
                      setBellOpen(false);
                    }}
                    className="w-full flex justify-between py-1 px-2 rounded-lg hover:bg-slate-500/10 cursor-pointer"
                  >
                    <span>Open Support Tickets</span>
                    <strong>{summary?.openSupportTickets ?? 0}</strong>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("decisions");
                      setBellOpen(false);
                    }}
                    className="w-full flex justify-between py-1 px-2 rounded-lg hover:bg-slate-500/10 cursor-pointer"
                  >
                    <span>Pending Decision Proposals</span>
                    <strong>{pendingProposalsCount}</strong>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("finance");
                      setBellOpen(false);
                    }}
                    className="w-full flex justify-between py-1 px-2 rounded-lg hover:bg-slate-500/10 cursor-pointer"
                  >
                    <span>Kasri Escrow Held</span>
                    <strong>{heldOrdersCount}</strong>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("onboarding");
                      setBellOpen(false);
                    }}
                    className="w-full flex justify-between py-1 px-2 rounded-lg hover:bg-slate-500/10 cursor-pointer"
                  >
                    <span>Pending Join Requests</span>
                    <strong>{summary?.pendingJoinRequests ?? 0}</strong>
                  </button>
                  <div className={`pt-2 mt-1 border-t text-[10px] font-mono flex items-center justify-between ${t.subtleBorderCls} ${t.mutedCls}`}>
                    <span>{data?.operator || initialOperator} &middot; {roleMeta.shortTag}</span>
                    <a href="/api/hq/export/accounts" download className="underline">CSV</a>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className={`h-8 px-2.5 rounded-full text-[11px] font-semibold cursor-pointer ${t.pillCls}`}
            >
              {isDark ? "Light" : "Dark"}
            </button>

            <button
              type="button"
              onClick={() => void loadFleet()}
              disabled={loading || busy}
              className={`hidden sm:inline-flex h-8 px-2.5 rounded-full text-[11px] font-semibold items-center gap-1 cursor-pointer ${t.pillCls}`}
            >
              {loading && <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />}
              <span>{loading ? "Sync" : "Sync"}</span>
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="h-8 px-2.5 rounded-full border border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-300 text-[11px] font-semibold cursor-pointer"
            >
              Lock
            </button>
          </div>
        </div>
      </header>

      {/* BODY: ADAPTIVE HORIZONTAL BAR ON MOBILE + SLIM STICKY RAIL ON DESKTOP */}
      <div className="max-w-[1920px] w-full mx-auto px-3 sm:px-6 py-3 flex flex-col lg:flex-row gap-4 items-start">
        <aside
          className={`w-full shrink-0 transition-[width] duration-200 ${
            railExpanded ? "lg:w-52" : "lg:w-14"
          } lg:sticky lg:top-[64px]`}
        >
          <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-1 lg:pb-0 no-scrollbar">
            {navItems.map((item) => {
              const active = activeTab === item.key;
              const lockedByRole =
                Boolean(item.requiredCap && worker) &&
                !canHqWorker(worker!.role, worker!.capabilities, item.requiredCap!);

              return (
                <button
                  key={item.key}
                  type="button"
                  title={lockedByRole ? `${item.label} (read-only)` : item.label}
                  onClick={() => setActiveTab(item.key)}
                  className={`relative shrink-0 lg:w-full text-left rounded-xl px-2.5 py-2 transition-all flex items-center justify-between gap-2 cursor-pointer ${
                    active
                      ? t.primaryBtnCls
                      : "hover:bg-slate-500/10 text-current"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <RailNavSvg tab={item.key} />
                    {railExpanded && (
                      <div className="min-w-0">
                        <div className="text-xs font-semibold whitespace-nowrap lg:truncate">{item.label}</div>
                      </div>
                    )}
                  </div>
                  {railExpanded && typeof item.badge === "number" && item.badge > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full font-mono text-[10px] font-bold shrink-0 ${
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
        </aside>

        {/* Full-Bleed Open Workspace Canvas — Zero Repeated KPI Cards */}
        <main className="flex-1 min-w-0 w-full space-y-3">
          {banner && (
            <div
              className={`rounded-xl border px-4 py-2.5 text-xs font-semibold flex items-center justify-between gap-2 ${
                banner.type === "ok"
                  ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-300"
              }`}
            >
              <span>{banner.text}</span>
              <button
                type="button"
                onClick={() => setBanner(null)}
                className="text-xs underline cursor-pointer shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {data && summary && activeTab === "overview" && (
            <HQOverviewSection
              summary={summary}
              peakTelemetry={data.peakTelemetry}
              accounts={data.accounts}
              wholesaleOrders={data.wholesaleOrders}
              auditLogs={data.auditLogs}
              supportTickets={data.supportTickets ?? []}
              hqTeamNotes={data.hqTeamNotes ?? []}
              spine={data.spine}
              promiseBoard={data.promiseBoard}
              timelineFilter={timelineFilter}
              onTimelineFilterChange={setTimelineFilter}
              onSwitchTab={setActiveTab}
              onSelectOrg={setSelectedOrgId}
              isDark={isDark}
            />
          )}

          {data && activeTab === "decisions" && (
            <HQDecisionInboxSection
              proposals={data.proposals ?? []}
              autonomyConfig={data.autonomyConfig ?? {}}
              agents={data.agents ?? []}
              onRunAction={runAction}
              isDark={isDark}
              busy={busy}
            />
          )}

          {data && activeTab === "intelligence" && (
            <HQIntelligenceTwinSection
              gates={data.readinessGates ?? []}
              scorecards={data.modelScorecards ?? []}
              accounts={data.accounts}
              peakTelemetry={data.peakTelemetry}
              intelligenceDetail={data.intelligenceDetail}
              onRunAction={runAction}
              onSwitchTab={setActiveTab}
              onSelectOrg={setSelectedOrgId}
              isDark={isDark}
              busy={busy}
            />
          )}

          {data && activeTab === "cases" && (
            <HQCaseAndPrivacySection
              recalls={data.recalls ?? []}
              cases={data.cases ?? []}
              privacyReleases={data.privacyReleases ?? []}
              productAliases={data.spine?.productAliases ?? []}
              mappedProductSharePct={data.spine?.mappedProductSharePct ?? 0}
              onRunAction={runAction}
              isDark={isDark}
              busy={busy}
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
