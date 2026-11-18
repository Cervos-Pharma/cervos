"use client";

import { useMemo, useState } from "react";
import { formatTzs } from "@cervos/core";
import CervosMap from "@/components/MapClientWrapper";
import type { MarkerData } from "@/components/CervosMap";
import { hqSurfaceTokens } from "./hqSurface";
import type {
  HqAuditEvent,
  HqFleetAccount,
  HqFleetSummary,
  HqPeakTelemetry,
  HqPromiseMetric,
  HqSpineTelemetry,
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
  spine?: HqSpineTelemetry;
  promiseBoard?: HqPromiseMetric[];
  timelineFilter?: string;
  onSwitchTab: (tab: HqTab) => void;
  onSelectOrg: (accountId: string) => void;
  isDark: boolean;
}

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

const SPATIAL_HUBS = [
  { id: "mwanza", name: "Mwanza Lake", x: 165, y: 105, dotColor: "#06B6D4" },
  { id: "arusha", name: "Arusha North", x: 380, y: 95, dotColor: "#10B981" },
  { id: "dodoma", name: "Dodoma Core", x: 285, y: 215, dotColor: "#6366F1" },
  { id: "dar", name: "Dar es Salaam", x: 455, y: 265, dotColor: "#1039B9" },
  { id: "mbeya", name: "Mbeya South", x: 185, y: 315, dotColor: "#F59E0B" },
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
  spine,
  promiseBoard = [],
  timelineFilter = "all",
  onSwitchTab,
  onSelectOrg,
  isDark,
}: HQOverviewSectionProps) {
  const t = hqSurfaceTokens(isDark);
  const [stageMode, setStageMode] = useState<"spatial" | "topology">("spatial");
  const [mapSurface, setMapSurface] = useState<"arcs" | "leaflet">("arcs");
  const [activePromiseId, setActivePromiseId] = useState<string | null>(promiseBoard[0]?.id ?? null);
  const [topoFilter, setTopoFilter] = useState("");
  const [topoMetric, setTopoMetric] = useState<"throughput" | "events" | "expiry">("throughput");
  const [topoZoom, setTopoZoom] = useState(100);

  const selectedPromise = useMemo(
    () => promiseBoard.find((p) => p.id === activePromiseId) ?? promiseBoard[0] ?? null,
    [promiseBoard, activePromiseId]
  );

  const escrowHeldOrders = useMemo(
    () => wholesaleOrders.filter((o) => o.escrowStatus === "escrow_held"),
    [wholesaleOrders]
  );
  const heldValueTzs = useMemo(
    () => escrowHeldOrders.reduce((sum, o) => sum + o.totalTzs, 0),
    [escrowHeldOrders]
  );
  const openTickets = useMemo(
    () => supportTickets.filter((tk) => tk.status !== "resolved"),
    [supportTickets]
  );

  const branchMarkers = useMemo(() => {
    let branchSeed = 0;
    return accounts.flatMap((acc) =>
      acc.centres.map((ctr): MarkerData & { accountId: string } => {
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
          status: acc.accessLock.locked ? "locked" : acc.subscriptionActive ? "active" : "trial",
          detail: `${ctr.staffCount} staff · ${acc.subscriptionPlan}`,
        };
      })
    );
  }, [accounts]);

  const regionalBreakdown = useMemo(() => {
    if (peakTelemetry?.regionDemand && peakTelemetry.regionDemand.length > 0) {
      return peakTelemetry.regionDemand.slice(0, 6);
    }
    return [
      {
        region: "Dar es Salaam",
        orgsCount: accounts.length,
        branchesCount: summary.totalBranches,
        revenue30dTzs: summary.totalSalesRevenueTzs,
        lowStockCount: summary.nearExpiryBatches,
        expiryExposureTzs: 0,
      },
    ];
  }, [peakTelemetry, accounts.length, summary]);

  const hubTelemetry = useMemo(() => {
    return SPATIAL_HUBS.map((hub) => {
      const match = regionalBreakdown.find((r) => r.region.toLowerCase().includes(hub.id));
      return {
        ...hub,
        revenue: match?.revenue30dTzs ?? 0,
        branches: match?.branchesCount ?? 0,
        orgs: match?.orgsCount ?? 0,
      };
    });
  }, [regionalBreakdown]);

  // 14-bar multi-segment bar profile (supp.jpg left column)
  const dailyFlowBars = useMemo(() => {
    const base = Math.max(10, Math.round(summary.totalSalesRevenueTzs / 140000));
    return Array.from({ length: 14 }).map((_, i) => {
      const eventMatch = (spine?.recentEvents ?? []).filter((e) => e.globalSeq % 14 === i).length;
      const posH = Math.min(92, 26 + ((i * 19 + base) % 54) + eventMatch * 4);
      const kasriH = Math.min(48, 12 + ((i * 11 + escrowHeldOrders.length * 7) % 30));
      return { idx: i, posH, kasriH };
    });
  }, [summary.totalSalesRevenueTzs, spine?.recentEvents, escrowHeldOrders.length]);

  const filteredEvents = useMemo(() => {
    const list = spine?.recentEvents ?? [];
    if (timelineFilter === "all") return list;
    return list.filter((e) => e.type.startsWith(timelineFilter));
  }, [spine?.recentEvents, timelineFilter]);

  const statusToneCls = (status: HqPromiseMetric["status"]) => {
    if (status === "alert") return "border-rose-500/35 bg-rose-500/8 text-rose-700 dark:text-rose-300";
    if (status === "warning") return "border-amber-500/35 bg-amber-500/8 text-amber-800 dark:text-amber-300";
    return "border-emerald-500/30 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300";
  };

  return (
    <div className="space-y-5">
      {/* PROMISE BOARD HEADER + VIEW MODE SWITCHER */}
      <section className={`p-5 space-y-4 ${t.panelCls}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#1039B9] dark:text-sky-400">
                CERVOS PROMISE BOARD &middot; EVENT SPINE PROJECTIONS
              </span>
              {spine && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    spine.chainVerified
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-rose-500/15 text-rose-600"
                  }`}
                >
                  {spine.chainVerified ? `HASH VERIFIED · SEQ #${spine.globalSeqHead}` : "CHAIN MISMATCH"}
                </span>
              )}
            </div>
            <h2
              className="text-xl font-semibold tracking-tight mt-0.5"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              Operational Guarantees &amp; Fleet Telemetry
            </h2>
          </div>

          {/* supp.jpg Spatial Map vs res.jpg Node Topology Toggle */}
          <div className={`inline-flex rounded-full p-1 gap-1 ${t.wellCls}`}>
            <button
              type="button"
              onClick={() => setStageMode("spatial")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                stageMode === "spatial" ? t.primaryBtnCls : t.mutedCls
              }`}
            >
              Spatial Arc Map
            </button>
            <button
              type="button"
              onClick={() => setStageMode("topology")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                stageMode === "topology" ? t.primaryBtnCls : t.mutedCls
              }`}
            >
              Event Spine Topology
            </button>
          </div>
        </div>

        {/* 7-Card Promise Board Strip */}
        {promiseBoard.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2.5">
            {promiseBoard.map((pm) => {
              const isSelected = selectedPromise?.id === pm.id;
              return (
                <button
                  key={pm.id}
                  type="button"
                  onClick={() => setActivePromiseId(isSelected ? null : pm.id)}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    isSelected
                      ? "border-[#1039B9] ring-2 ring-[#1039B9]/15 bg-[#F4F7FF] dark:bg-[#151D2C]"
                      : `${t.wellCls} hover:border-[#1039B9]/40`
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className={`px-1.5 py-0.5 rounded-full border text-[9px] font-bold uppercase ${statusToneCls(pm.status)}`}>
                      {pm.status}
                    </span>
                    <span className={`text-[9px] font-mono ${t.mutedCls}`}>Why?</span>
                  </div>
                  <div className="text-[11px] font-semibold leading-tight">{pm.promise}</div>
                  <div>
                    <div className="text-base font-bold font-mono tabular-nums">{pm.primaryValue}</div>
                    <div className={`text-[10px] truncate ${t.mutedCls}`}>
                      {pm.primaryLabel} ({pm.targetLabel})
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Provenance Drawer ("Why this number?") */}
        {selectedPromise && (
          <div className={`p-4 rounded-2xl border flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${t.wellCls}`}>
            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-[#1039B9] dark:text-sky-400">
                  PROVENANCE &middot; {selectedPromise.promise}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${t.pillCls}`}>
                  {selectedPromise.provenance.projectionVersion}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${t.pillCls}`}>
                  Events {selectedPromise.provenance.firstSeq}..{selectedPromise.provenance.lastSeq} ({selectedPromise.provenance.eventCount})
                </span>
              </div>
              <div className="flex flex-wrap gap-3 text-xs">
                {selectedPromise.subMetrics.map((sm) => (
                  <div key={sm.label} className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${sm.ok ? "bg-emerald-500" : "bg-amber-500"}`} />
                    <span className={t.mutedCls}>{sm.label}:</span>
                    <strong className="font-mono">{sm.value}</strong>
                    <span className={`text-[10px] ${t.mutedCls}`}>({sm.target})</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="text-[10px] font-mono shrink-0 space-y-1">
              <div className={t.mutedCls}>Chain Head SHA-256</div>
              <div className="font-semibold">{selectedPromise.provenance.chainHeadHash}</div>
            </div>
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* MODE A: supp.jpg INSPIRED 3-ZONE SPATIAL ARC MAP & PERIMETER METRICS  */}
      {/* ===================================================================== */}
      {stageMode === "spatial" ? (
        <section className={`p-5 sm:p-6 grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch ${t.panelCls}`}>
          {/* Zone 1 (Left 4 cols): Hero Counter, 14-Bar Velocity Chart, Regional Breakdown, Bottom Escrow Card */}
          <div className="xl:col-span-4 flex flex-col justify-between gap-4">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-semibold ${t.mutedCls}`}>General Fleet Telemetry</span>
                  <button
                    type="button"
                    onClick={() => onSwitchTab("fleet")}
                    className="text-[11px] font-bold text-[#1039B9] dark:text-sky-400 hover:underline cursor-pointer"
                  >
                    DETAIL &gt;
                  </button>
                </div>
                <div
                  className="text-3xl sm:text-4xl font-bold tracking-tight tabular-nums mt-1"
                  style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                >
                  {formatTzs(summary.totalSalesRevenueTzs)}
                </div>
                <div className={`text-xs mt-0.5 ${t.mutedCls}`}>
                  {summary.totalSalesCount} counter receipts &middot; {summary.activeOrgs} active orgs
                </div>
              </div>

              {/* Monthly Recurring + 14-Bar Multi-Segment Vertical Chart (supp.jpg left middle) */}
              <div className={`p-4 space-y-3 ${t.wellCls}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <div className={`text-[11px] font-semibold ${t.mutedCls}`}>Monthly Recurring</div>
                    <div className="text-lg font-bold tabular-nums">
                      {formatTzs(peakTelemetry?.monthlyRecurringRevenueTzs ?? summary.activeOrgs * 45000)}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                    {spine?.mappedProductSharePct ?? 0}% G-ID Mapped
                  </span>
                </div>

                {/* 14-bar comparative columns */}
                <div className="h-20 flex items-end gap-1.5 pt-2">
                  {dailyFlowBars.map((bar) => (
                    <div key={bar.idx} className="flex-1 flex flex-col items-center justify-end gap-0.5 h-full">
                      <div
                        className="w-full rounded-t-sm bg-rose-400/80 dark:bg-rose-400/70 transition-all"
                        style={{ height: `${bar.kasriH}%` }}
                      />
                      <div
                        className="w-full rounded-b-sm bg-[#1039B9] dark:bg-sky-400 transition-all"
                        style={{ height: `${bar.posH}%` }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Dot-Coded Regional Breakdown */}
              <div className="space-y-1.5">
                {regionalBreakdown.map((row, idx) => {
                  const dotColors = ["#1039B9", "#06B6D4", "#10B981", "#8B5CF6", "#F59E0B", "#EC4899"];
                  return (
                    <div
                      key={row.region}
                      className="flex items-center justify-between text-xs py-1 px-1 rounded-lg hover:bg-slate-500/5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: dotColors[idx % dotColors.length] }}
                        />
                        <span className="font-medium truncate">{row.region}</span>
                      </div>
                      <div className="flex items-center gap-4 tabular-nums shrink-0">
                        <span className={`font-mono text-[11px] ${t.mutedCls}`}>
                          {row.orgsCount}/{row.branchesCount}
                        </span>
                        <span className="font-semibold">{formatTzs(row.revenue30dTzs, { compact: true })}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Floating Summary Card (supp.jpg bottom-left) */}
            <div className={`p-4 flex items-center justify-between gap-3 rounded-2xl ${t.glassHudCls}`}>
              <div>
                <div className={`text-[11px] font-semibold ${t.mutedCls}`}>Kasri Escrow Held</div>
                <div className="text-lg font-bold tabular-nums">{formatTzs(heldValueTzs)}</div>
                <div className={`text-[10px] ${t.mutedCls}`}>
                  {escrowHeldOrders.length} active POs &middot; Invariant Delta{" "}
                  {spine?.escrowInvariantDeltaTzs ?? 0} TZS
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSwitchTab("finance")}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${t.primaryBtnCls}`}
              >
                Escrow Board
              </button>
            </div>
          </div>

          {/* Zone 2 (Center 6 cols): Spatial Arc Network Canvas OR Live Leaflet Map */}
          <div className={`xl:col-span-6 relative rounded-2xl overflow-hidden min-h-[460px] flex flex-col justify-between ${t.wellCls}`}>
            {/* Floating Mode Controls Top Right */}
            <div className="relative z-10 flex items-center justify-between p-3.5">
              <div className={`px-3 py-1.5 rounded-full text-[11px] font-semibold ${t.glassHudCls}`}>
                {branchMarkers.length} branches across {accounts.length} orgs
              </div>
              <div className={`p-1 rounded-full flex items-center gap-1 ${t.glassHudCls}`}>
                <button
                  type="button"
                  onClick={() => setMapSurface("arcs")}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold cursor-pointer ${
                    mapSurface === "arcs" ? t.primaryBtnCls : t.mutedCls
                  }`}
                >
                  Arc View
                </button>
                <button
                  type="button"
                  onClick={() => setMapSurface("leaflet")}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold cursor-pointer ${
                    mapSurface === "leaflet" ? t.primaryBtnCls : t.mutedCls
                  }`}
                >
                  Street Map
                </button>
              </div>
            </div>

            {mapSurface === "leaflet" ? (
              <div className="flex-1 min-h-[410px] px-2 pb-2">
                <div className="h-[410px] rounded-xl overflow-hidden">
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
            ) : (
              <div className="relative flex-1 min-h-[410px] flex items-center justify-center p-2">
                {/* SVG Concentric Radar Rings + Curved Regional Supply Arcs (supp.jpg center) */}
                <svg viewBox="0 0 600 400" className="w-full h-full max-h-[420px]">
                  <defs>
                    <radialGradient id="cervosHalo" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor={isDark ? "#1039B9" : "#38BDF8"} stopOpacity="0.12" />
                      <stop offset="100%" stopColor="transparent" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  <circle cx="300" cy="200" r="185" fill="url(#cervosHalo)" />
                  <circle
                    cx="300"
                    cy="200"
                    r="165"
                    fill="none"
                    stroke={isDark ? "rgba(148,163,184,0.16)" : "rgba(15,23,42,0.08)"}
                    strokeDasharray="3 5"
                  />
                  <circle
                    cx="300"
                    cy="200"
                    r="112"
                    fill="none"
                    stroke={isDark ? "rgba(148,163,184,0.2)" : "rgba(15,23,42,0.1)"}
                  />

                  {/* Curved Bezier Supply & Sync Arcs into Dar Hub */}
                  {[
                    "M 165 105 Q 305 145 455 265",
                    "M 380 95 Q 435 165 455 265",
                    "M 285 215 Q 375 210 455 265",
                    "M 185 315 Q 320 325 455 265",
                    "M 165 105 Q 275 80 380 95",
                  ].map((d, i) => (
                    <path
                      key={i}
                      d={d}
                      fill="none"
                      stroke={isDark ? "#38BDF8" : "#3730A3"}
                      strokeWidth="2.2"
                      strokeOpacity="0.72"
                    />
                  ))}

                  {/* Hexagonal cluster accents around hubs */}
                  {hubTelemetry.map((hub) => (
                    <g key={hub.id}>
                      <circle cx={hub.x} cy={hub.y} r="13" fill={hub.dotColor} fillOpacity="0.18" />
                      <circle cx={hub.x} cy={hub.y} r="5.5" fill={hub.dotColor} />
                    </g>
                  ))}
                </svg>

                {/* Floating White Callout Badges (supp.jpg style) */}
                {hubTelemetry.map((hub) => {
                  const leftPct = Math.min(78, Math.max(4, (hub.x / 600) * 100 - 12));
                  const topPct = Math.min(82, Math.max(8, (hub.y / 400) * 100 - 14));
                  return (
                    <button
                      key={hub.id}
                      type="button"
                      onClick={() => onSwitchTab("fleet")}
                      style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                      className={`absolute px-2.5 py-1.5 rounded-xl flex items-center gap-2 text-left transition-transform hover:scale-105 cursor-pointer ${t.glassHudCls}`}
                    >
                      <span
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                        style={{ backgroundColor: hub.dotColor }}
                      >
                        {hub.branches}
                      </span>
                      <div className="leading-tight">
                        <div className={`text-[10px] font-semibold ${t.mutedCls}`}>{hub.name}</div>
                        <div className="text-xs font-bold tabular-nums">
                          {formatTzs(hub.revenue, { compact: true })}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Zone 3 (Right 2 cols): Clean Vertical KPI Stack (supp.jpg right column) */}
          <div className="xl:col-span-2 flex flex-col justify-between gap-4 py-1">
            <div className="space-y-5 xl:text-right">
              <div>
                <div className={`text-xs font-medium ${t.mutedCls}`}>Active Organizations</div>
                <div className="text-2xl font-bold tabular-nums mt-0.5">{summary.totalOrgs}</div>
              </div>
              <div>
                <div className={`text-xs font-medium ${t.mutedCls}`}>Live Branches</div>
                <div className="text-2xl font-bold tabular-nums mt-0.5">{summary.totalBranches}</div>
              </div>
              <div>
                <div className={`text-xs font-medium ${t.mutedCls}`}>ProductMaster Share</div>
                <div className="text-2xl font-bold tabular-nums mt-0.5 text-emerald-600 dark:text-emerald-400">
                  {spine?.mappedProductSharePct ?? 0}%
                </div>
              </div>
              <div>
                <div className={`text-xs font-medium ${t.mutedCls}`}>Audit Chain Integrity</div>
                <div className="text-2xl font-bold tabular-nums mt-0.5 text-[#1039B9] dark:text-sky-400">
                  {spine?.chainVerified ? "100%" : "CHECK"}
                </div>
              </div>
            </div>

            <div className={`p-3 rounded-2xl text-xs space-y-2 ${t.wellCls}`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${t.mutedCls}`}>
                Live Queues
              </div>
              <button
                type="button"
                onClick={() => onSwitchTab("support")}
                className="w-full flex items-center justify-between hover:underline cursor-pointer"
              >
                <span>Open Tickets</span>
                <strong className="font-mono text-rose-600 dark:text-rose-400">{openTickets.length}</strong>
              </button>
              <button
                type="button"
                onClick={() => onSwitchTab("decisions")}
                className="w-full flex items-center justify-between hover:underline cursor-pointer"
              >
                <span>Proposals</span>
                <strong className="font-mono text-[#1039B9] dark:text-sky-400">Go &gt;</strong>
              </button>
            </div>
          </div>
        </section>
      ) : (
        /* ===================================================================== */
        /* MODE B: res.jpg INSPIRED NODE FLOW TOPOLOGY + BOTTOM 2-COL SPLIT DOCK */
        /* ===================================================================== */
        <div className="space-y-5">
          <section className={`p-5 space-y-4 ${t.panelCls}`}>
            {/* Floating Filter + Metric Bar (res.jpg canvas top) */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={topoFilter}
                  onChange={(e) => setTopoFilter(e.target.value)}
                  placeholder="Quick search nodes..."
                  className={`h-9 px-3.5 rounded-full text-xs w-48 ${t.inputCls}`}
                />
                <select
                  value={topoMetric}
                  onChange={(e) => setTopoMetric(e.target.value as typeof topoMetric)}
                  className={`h-9 px-3 rounded-full text-xs ${t.inputCls}`}
                >
                  <option value="throughput">Metric: TZS Throughput</option>
                  <option value="events">Metric: Event Spine Rate</option>
                  <option value="expiry">Metric: Expiry Exposure</option>
                </select>
                {(topoFilter || topoZoom !== 100) && (
                  <button
                    type="button"
                    onClick={() => {
                      setTopoFilter("");
                      setTopoZoom(100);
                    }}
                    className={`h-9 px-3 rounded-full text-xs font-semibold cursor-pointer ${t.pillCls}`}
                  >
                    Reset
                  </button>
                )}
              </div>

              <div className={`px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-mono ${t.wellCls}`}>
                <button
                  type="button"
                  onClick={() => setTopoZoom((z) => Math.max(75, z - 15))}
                  className="px-1.5 font-bold cursor-pointer"
                >
                  -
                </button>
                <span>Zoom {topoZoom}%</span>
                <button
                  type="button"
                  onClick={() => setTopoZoom((z) => Math.min(130, z + 15))}
                  className="px-1.5 font-bold cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {/* Node Topology Stage */}
            <div
              className={`relative p-5 rounded-2xl overflow-x-auto ${t.wellCls}`}
              style={{ transform: `scale(${topoZoom / 100})`, transformOrigin: "top center" }}
            >
              <div className="min-w-[820px] grid grid-cols-12 gap-4 items-center">
                {/* Left Cluster: Regional Dispensary Tills */}
                <div className={`col-span-4 p-4 rounded-2xl space-y-2.5 ${t.glassHudCls}`}>
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg bg-[#1039B9] text-white text-[11px] font-bold">
                      Regional Pharmacy Tills
                    </span>
                    <span className={`text-[10px] font-mono ${t.mutedCls}`}>
                      {accounts.length} orgs
                    </span>
                  </div>
                  {regionalBreakdown.slice(0, 3).map((row) => (
                    <button
                      key={row.region}
                      type="button"
                      onClick={() => onSwitchTab("fleet")}
                      className={`w-full p-2.5 rounded-xl flex items-center justify-between text-xs border transition-colors hover:border-[#1039B9] cursor-pointer ${t.wellCls}`}
                    >
                      <span className="font-semibold">{row.region}</span>
                      <span className="font-mono text-[#1039B9] dark:text-sky-400">
                        {topoMetric === "expiry"
                          ? formatTzs(row.expiryExposureTzs, { compact: true })
                          : topoMetric === "events"
                            ? `${row.branchesCount} branches`
                            : formatTzs(row.revenue30dTzs, { compact: true })}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Center Connector + Shielded Event Spine Core */}
                <div className="col-span-4 flex flex-col items-center justify-center gap-3 text-center">
                  <div className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full ${t.pillCls}`}>
                    {filteredEvents.length} live events &middot; idempotent push
                  </div>
                  <div className="w-full h-0.5 bg-gradient-to-r from-[#1039B9]/40 via-[#38BDF8] to-emerald-500/50 rounded-full" />
                  <button
                    type="button"
                    onClick={() => onSwitchTab("decisions")}
                    className="w-24 h-24 rounded-3xl bg-[#1039B9] text-white shadow-lg flex flex-col items-center justify-center p-2 hover:scale-105 transition-transform cursor-pointer"
                  >
                    <span className="text-[10px] uppercase tracking-wider opacity-80">Spine</span>
                    <span className="text-lg font-bold font-mono">
                      #{spine?.globalSeqHead ?? 0}
                    </span>
                    <span className="text-[9px] opacity-80">Registry</span>
                  </button>
                  <div className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full ${t.pillCls}`}>
                    Lag: {spine?.projectionLagSeq ?? 0} &middot; Deterministic
                  </div>
                </div>

                {/* Right Cluster: Derived Projections & Gateways */}
                <div className="col-span-4 space-y-2.5">
                  {[
                    {
                      title: "Kasri Escrow Machine",
                      stat: `${escrowHeldOrders.length} held · ${formatTzs(heldValueTzs, { compact: true })}`,
                      tab: "finance" as HqTab,
                      tone: "bg-emerald-600",
                    },
                    {
                      title: "ProductMaster & Lot Graph",
                      stat: `${spine?.mappedProductSharePct ?? 0}% mapped · TMDA ready`,
                      tab: "cases" as HqTab,
                      tone: "bg-[#1039B9]",
                    },
                    {
                      title: "Privacy Output Gateway",
                      stat: "k >= 5 · <=50% dominance",
                      tab: "cases" as HqTab,
                      tone: "bg-amber-600",
                    },
                  ].map((node) => (
                    <button
                      key={node.title}
                      type="button"
                      onClick={() => onSwitchTab(node.tab)}
                      className={`w-full p-3 rounded-2xl flex items-center justify-between gap-2 text-left transition-transform hover:-translate-y-0.5 cursor-pointer ${t.glassHudCls}`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">{node.title}</div>
                        <div className={`text-[10px] font-mono ${t.mutedCls}`}>{node.stat}</div>
                      </div>
                      <span className={`px-2 py-1 rounded-lg text-white text-[10px] font-bold shrink-0 ${node.tone}`}>
                        Open
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Bottom 2-Column Split Dock (res.jpg bottom half) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
            {/* Bottom-Left: Spine Throughput & Alert Callout */}
            <section className={`xl:col-span-5 p-5 flex flex-col justify-between gap-4 ${t.panelCls}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">Event Spine Throughput</h3>
                  <p className={`text-[11px] ${t.mutedCls}`}>
                    Stacked Sales, Stock Deltas &amp; Commands ({filteredEvents.length} events in window)
                  </p>
                </div>
                <div className={`px-3 py-1.5 rounded-xl text-xs ${t.glassHudCls}`}>
                  <span className="font-bold">{openTickets.length}</span>{" "}
                  <span className={t.mutedCls}>Alerts</span>
                </div>
              </div>

              <div className="h-36 flex items-end gap-2 pt-3">
                {dailyFlowBars.slice(0, 10).map((b) => (
                  <div key={b.idx} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end">
                    <div className="w-full rounded-t bg-amber-400/85" style={{ height: `${Math.round(b.kasriH * 0.6)}%` }} />
                    <div className="w-full rounded-b bg-[#1039B9] dark:bg-sky-400" style={{ height: `${b.posH}%` }} />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono">
                <span>Audit Logs: {auditLogs.length}</span>
                <button
                  type="button"
                  onClick={() => onSwitchTab("comms")}
                  className="text-[#1039B9] dark:text-sky-400 font-semibold hover:underline cursor-pointer"
                >
                  Open Event Stream &gt;
                </button>
              </div>
            </section>

            {/* Bottom-Right: Organization Health & Access State Machine Overview */}
            <section className={`xl:col-span-7 overflow-hidden ${t.panelCls}`}>
              <div className={`px-5 py-3.5 border-b ${t.subtleBorderCls} flex items-center justify-between`}>
                <div>
                  <h3 className="text-sm font-semibold">Organization Health &amp; Access Overview</h3>
                  <p className={`text-[11px] ${t.mutedCls}`}>
                    Server state machine (`trial -&gt; active -&gt; grace -&gt; overdue -&gt; locked`) + 30d health index.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSwitchTab("fleet")}
                  className="text-xs font-semibold text-[#1039B9] dark:text-sky-400 hover:underline cursor-pointer"
                >
                  Fleet Directory &gt;
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className={`border-b ${t.subtleBorderCls} text-[10px] uppercase tracking-wider ${t.mutedCls}`}>
                      <th className="py-2.5 px-4 font-semibold">Organization</th>
                      <th className="py-2.5 px-3 font-semibold">Region</th>
                      <th className="py-2.5 px-3 font-semibold">State</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Health</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Churn Risk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-500/10 tabular-nums">
                    {(spine?.orgHealthScores ?? []).slice(0, 6).map((oh) => (
                      <tr
                        key={oh.accountId}
                        onClick={() => {
                          onSelectOrg(oh.accountId);
                          onSwitchTab("fleet");
                        }}
                        className="hover:bg-slate-500/5 cursor-pointer"
                      >
                        <td className="py-2.5 px-4 font-semibold">{oh.orgName}</td>
                        <td className={`py-2.5 px-3 ${t.mutedCls}`}>{oh.region}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              oh.accessState === "active"
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                : oh.accessState === "trial" || oh.accessState === "grace"
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                  : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                            }`}
                          >
                            {oh.accessState}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">{oh.score}/100</td>
                        <td className="py-2.5 px-4 text-right font-mono">
                          {oh.churnRisk30dPct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
