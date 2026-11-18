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
  onTimelineFilterChange?: (next: string) => void;
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

const PROMISE_BACKING_TAB: Record<string, HqTab> = {
  zero_expired_dispensed: "cases",
  never_stops_offline: "intelligence",
  balanced_tills: "intelligence",
  safe_kasri_restocking: "finance",
  patient_privacy: "cases",
  durable_adoption: "fleet",
  audit_integrity: "comms",
};

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
  onTimelineFilterChange,
  onSwitchTab,
  onSelectOrg,
  isDark,
}: HQOverviewSectionProps) {
  const t = hqSurfaceTokens(isDark);
  const [stageMode, setStageMode] = useState<"leaflet" | "arcs" | "topology">("leaflet");
  const [regionFilter, setRegionFilter] = useState<string>("ALL");
  const [activePromiseId, setActivePromiseId] = useState<string | null>(promiseBoard[0]?.id ?? null);
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(13);

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

  const regionalBreakdown = useMemo(
    () => peakTelemetry?.regionDemand ?? [],
    [peakTelemetry]
  );

  const branchMarkers = useMemo(() => {
    let branchSeed = 0;
    const all = accounts.flatMap((acc) =>
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
    if (regionFilter === "ALL") return all;
    return all.filter((m) => (m.region || "").toLowerCase().includes(regionFilter.toLowerCase()));
  }, [accounts, regionFilter]);

  // Spatial arcs generated dynamically from actual regional clusters in the database
  const spatialNodes = useMemo(() => {
    const coordsMap = new Map<string, { x: number; y: number }>();
    const total = Math.max(1, regionalBreakdown.length);
    return regionalBreakdown.slice(0, 6).map((row, idx) => {
      const lower = row.region.toLowerCase();
      let x = 300;
      let y = 200;
      if (lower.includes("dar") || lower.includes("zanzibar")) {
        x = 455;
        y = 250;
      } else if (lower.includes("mwanza") || lower.includes("geita") || lower.includes("kahama")) {
        x = 160;
        y = 105;
      } else if (lower.includes("arusha") || lower.includes("moshi") || lower.includes("kilimanjaro")) {
        x = 385;
        y = 95;
      } else if (lower.includes("mbeya") || lower.includes("iringa")) {
        x = 185;
        y = 310;
      } else if (lower.includes("dodoma")) {
        x = 290;
        y = 205;
      } else {
        const angle = (idx / total) * Math.PI * 2;
        x = Math.round(300 + Math.cos(angle) * 145);
        y = Math.round(200 + Math.sin(angle) * 115);
      }
      coordsMap.set(row.region, { x, y });
      const colors = ["#1039B9", "#06B6D4", "#10B981", "#6366F1", "#F59E0B", "#EC4899"];
      return {
        ...row,
        x,
        y,
        color: colors[idx % colors.length],
      };
    });
  }, [regionalBreakdown]);

  // 14-day series strictly from DB timestamps (no synthetic Math/modulo generation)
  const realDailySeries = useMemo(() => {
    if (peakTelemetry?.dailyTimeline && peakTelemetry.dailyTimeline.length > 0) {
      return peakTelemetry.dailyTimeline;
    }
    const nowMs = Date.now();
    return Array.from({ length: 14 }, (_, idx) => {
      const dStr = new Date(nowMs - (13 - idx) * 86_400_000).toISOString().slice(0, 10);
      const dayEvents = (spine?.recentEvents ?? []).filter((e) => e.receivedAt.slice(0, 10) === dStr);
      const dayAudits = auditLogs.filter((a) => a.createdAt.slice(0, 10) === dStr);
      const dayOrders = wholesaleOrders.filter((o) => o.createdAt.slice(0, 10) === dStr);
      return {
        date: dStr,
        label: dStr.slice(5),
        salesTzs: 0,
        salesCount: dayAudits.filter((a) => a.category === "POS").length,
        escrowTzs: dayOrders.reduce((s, o) => s + o.totalTzs, 0),
        eventsCount: dayEvents.length + dayAudits.length,
      };
    });
  }, [peakTelemetry?.dailyTimeline, spine?.recentEvents, auditLogs, wholesaleOrders]);

  const maxDayMetric = useMemo(() => {
    return Math.max(
      1,
      ...realDailySeries.map((d) => Math.max(d.salesTzs + d.escrowTzs, d.eventsCount * 25000, d.salesCount * 25000))
    );
  }, [realDailySeries]);

  const selectedDay = realDailySeries[selectedDayIdx] ?? realDailySeries[realDailySeries.length - 1];

  const filteredEvents = useMemo(() => {
    const list = spine?.recentEvents ?? [];
    if (timelineFilter === "all") return list;
    return list.filter((e) => e.type.startsWith(timelineFilter));
  }, [spine?.recentEvents, timelineFilter]);

  const filteredHealthRows = useMemo(() => {
    const rows = spine?.orgHealthScores ?? [];
    if (regionFilter === "ALL") return rows;
    return rows.filter((r) => r.region.toLowerCase().includes(regionFilter.toLowerCase()));
  }, [spine?.orgHealthScores, regionFilter]);

  const statusDotCls = (status: HqPromiseMetric["status"]) => {
    if (status === "alert") return "bg-rose-500";
    if (status === "warning") return "bg-amber-500";
    return "bg-emerald-500";
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
      {/* LEFT / CENTER 8 COLS: FULL-BLEED LIVE MAP + REAL DB 14-DAY GRAPH STAGE */}
      <div className={`xl:col-span-8 rounded-2xl overflow-hidden border ${t.cardBorderCls} ${isDark ? "bg-[#0F141D]" : "bg-white"}`}>
        {/* Top Flush Control Bar */}
        <div className={`px-4 py-2.5 border-b ${t.subtleBorderCls} flex flex-wrap items-center justify-between gap-2`}>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#1039B9] dark:text-sky-400 mr-1">
              FLEET MAP
            </span>
            <button
              type="button"
              onClick={() => setRegionFilter("ALL")}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer ${
                regionFilter === "ALL" ? t.primaryBtnCls : t.wellCls
              }`}
            >
              All Regions ({branchMarkers.length})
            </button>
            {regionalBreakdown.map((reg) => (
              <button
                key={reg.region}
                type="button"
                onClick={() => setRegionFilter(regionFilter === reg.region ? "ALL" : reg.region)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer ${
                  regionFilter === reg.region ? t.primaryBtnCls : t.wellCls
                }`}
              >
                {reg.region} ({reg.branchesCount})
              </button>
            ))}
          </div>

          <div className={`inline-flex rounded-full p-0.5 gap-0.5 ${t.wellCls}`}>
            {(
              [
                { id: "leaflet", label: "Street Map" },
                { id: "arcs", label: "Regional Arcs" },
                { id: "topology", label: "Spine Flow" },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setStageMode(m.id)}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold cursor-pointer ${
                  stageMode === m.id ? t.primaryBtnCls : t.mutedCls
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Interactive Map / Arcs / Topology Viewport */}
        <div className="relative h-[340px] sm:h-[400px] lg:h-[420px] w-full">
          {stageMode === "leaflet" ? (
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
          ) : stageMode === "arcs" ? (
            <div className={`relative w-full h-full flex items-center justify-center ${isDark ? "bg-[#0B0F17]" : "bg-[#F8FAFC]"}`}>
              <svg viewBox="0 0 600 400" className="w-full h-full">
                <circle cx="300" cy="200" r="170" fill="none" stroke={isDark ? "rgba(148,163,184,0.16)" : "rgba(15,23,42,0.08)"} strokeDasharray="3 5" />
                <circle cx="300" cy="200" r="110" fill="none" stroke={isDark ? "rgba(148,163,184,0.18)" : "rgba(15,23,42,0.1)"} />
                {spatialNodes.map((n, idx) => {
                  const primary = spatialNodes[0] ?? { x: 455, y: 250 };
                  const d = `M ${n.x} ${n.y} Q ${(n.x + primary.x) / 2} ${Math.min(n.y, primary.y) - 35} ${primary.x} ${primary.y}`;
                  return (
                    <g key={n.region}>
                      {idx > 0 && <path d={d} fill="none" stroke={isDark ? "#38BDF8" : "#1039B9"} strokeWidth="2" strokeOpacity="0.65" />}
                      <circle cx={n.x} cy={n.y} r="14" fill={n.color} fillOpacity="0.18" />
                      <circle cx={n.x} cy={n.y} r="6" fill={n.color} />
                    </g>
                  );
                })}
              </svg>
              {spatialNodes.map((n) => {
                const leftPct = Math.min(76, Math.max(4, (n.x / 600) * 100 - 11));
                const topPct = Math.min(82, Math.max(8, (n.y / 400) * 100 - 12));
                return (
                  <button
                    key={n.region}
                    type="button"
                    onClick={() => setRegionFilter(regionFilter === n.region ? "ALL" : n.region)}
                    style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                    className={`absolute px-2.5 py-1.5 rounded-xl flex items-center gap-2 text-left transition-transform hover:scale-105 cursor-pointer ${t.glassHudCls}`}
                  >
                    <span className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: n.color }}>
                      {n.branchesCount}
                    </span>
                    <div className="leading-tight">
                      <div className={`text-[10px] font-semibold ${t.mutedCls}`}>{n.region}</div>
                      <div className="text-xs font-bold tabular-nums">{formatTzs(n.revenue30dTzs, { compact: true })}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className={`w-full h-full p-5 overflow-x-auto flex items-center ${isDark ? "bg-[#0B0F17]" : "bg-[#F8FAFC]"}`}>
              <div className="min-w-[680px] w-full grid grid-cols-12 gap-4 items-center">
                <div className="col-span-4 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#1039B9] dark:text-sky-400">
                    Active Regional Dispensaries
                  </div>
                  {regionalBreakdown.slice(0, 4).map((row) => (
                    <button
                      key={row.region}
                      type="button"
                      onClick={() => setRegionFilter(regionFilter === row.region ? "ALL" : row.region)}
                      className={`w-full px-3 py-2 rounded-xl flex items-center justify-between text-xs cursor-pointer ${t.glassHudCls}`}
                    >
                      <span className="font-semibold">{row.region}</span>
                      <span className="font-mono text-[#1039B9] dark:text-sky-400">
                        {formatTzs(row.revenue30dTzs, { compact: true })}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="col-span-4 flex flex-col items-center gap-2 text-center">
                  <div className="text-[10px] font-mono">{filteredEvents.length} events in stream</div>
                  <div className="w-full h-0.5 bg-gradient-to-r from-[#1039B9] via-[#38BDF8] to-emerald-500" />
                  <button
                    type="button"
                    onClick={() => onSwitchTab("comms")}
                    className="w-24 h-24 rounded-3xl bg-[#1039B9] text-white shadow-lg flex flex-col items-center justify-center hover:scale-105 transition-transform cursor-pointer"
                  >
                    <span className="text-[10px] uppercase opacity-80">Spine</span>
                    <span className="text-lg font-bold font-mono">#{spine?.globalSeqHead ?? 0}</span>
                    <span className="text-[9px] opacity-80">{spine?.chainVerified ? "SHA OK" : "Check"}</span>
                  </button>
                  <div className={`text-[10px] font-mono ${t.mutedCls}`}>
                    Lag {spine?.projectionLagSeq ?? 0} &middot; {spine?.mappedProductSharePct ?? 0}% G-ID
                  </div>
                </div>
                <div className="col-span-4 space-y-2">
                  {[
                    { title: "Kasri Escrow Machine", stat: `${escrowHeldOrders.length} held · ${formatTzs(heldValueTzs, { compact: true })}`, tab: "finance" as HqTab },
                    { title: "Models & Quantiles", stat: `${summary.nearExpiryBatches} near-expiry lots`, tab: "intelligence" as HqTab },
                    { title: "Decision Inbox", stat: `${openTickets.length} tickets · proposals`, tab: "decisions" as HqTab },
                  ].map((node) => (
                    <button
                      key={node.title}
                      type="button"
                      onClick={() => onSwitchTab(node.tab)}
                      className={`w-full px-3 py-2.5 rounded-xl flex items-center justify-between text-xs cursor-pointer ${t.glassHudCls}`}
                    >
                      <div className="text-left">
                        <div className="font-bold">{node.title}</div>
                        <div className={`text-[10px] font-mono ${t.mutedCls}`}>{node.stat}</div>
                      </div>
                      <span className="text-[#1039B9] dark:text-sky-400 font-bold text-[11px]">Open &gt;</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Interactive 14-Day Real DB Telemetry Graph + Event Stream Filter */}
        <div className={`px-4 py-3 border-t ${t.subtleBorderCls} space-y-2.5`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold">14-Day Live DB Activity</span>
              {selectedDay && (
                <span className={`text-[11px] font-mono ${t.mutedCls}`}>
                  {selectedDay.date}: {formatTzs(selectedDay.salesTzs, { compact: true })} POS ({selectedDay.salesCount} receipts) &middot;{" "}
                  {formatTzs(selectedDay.escrowTzs, { compact: true })} Escrow &middot; {selectedDay.eventsCount} events
                </span>
              )}
            </div>
            {onTimelineFilterChange && (
              <div className="flex flex-wrap items-center gap-1">
                {[
                  { id: "all", label: "All" },
                  { id: "sale.", label: "Sales" },
                  { id: "stock.", label: "Stock" },
                  { id: "access.", label: "Access" },
                  { id: "command.", label: "Commands" },
                  { id: "agent.", label: "Agents" },
                  { id: "recall.", label: "Recalls" },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onTimelineFilterChange(s.id)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer ${
                      timelineFilter === s.id ? t.primaryBtnCls : t.wellCls
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="h-24 flex items-end gap-1.5">
            {realDailySeries.map((day, idx) => {
              const totalSignal = day.salesTzs + day.escrowTzs + day.eventsCount * 25000 + day.salesCount * 25000;
              const barPct = Math.max(8, Math.min(100, Math.round((totalSignal / maxDayMetric) * 100)));
              const escrowPct = totalSignal > 0 ? Math.round(((day.escrowTzs) / Math.max(1, totalSignal)) * barPct) : 0;
              const isSelected = idx === selectedDayIdx;
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDayIdx(idx)}
                  title={`${day.date}: ${day.salesCount} sales, ${day.eventsCount} events`}
                  className={`flex-1 h-full flex flex-col justify-end items-center gap-0.5 group cursor-pointer ${
                    isSelected ? "opacity-100" : "opacity-75 hover:opacity-100"
                  }`}
                >
                  <div className="w-full flex flex-col justify-end items-stretch h-[78px]">
                    {escrowPct > 0 && (
                      <div className="w-full rounded-t bg-amber-400" style={{ height: `${escrowPct}%` }} />
                    )}
                    <div
                      className={`w-full rounded-b ${escrowPct === 0 ? "rounded-t" : ""} ${
                        isSelected ? "bg-[#1039B9] dark:bg-sky-300 ring-2 ring-[#1039B9]/30" : "bg-[#1039B9]/75 dark:bg-sky-400/75"
                      }`}
                      style={{ height: `${Math.max(6, barPct - escrowPct)}%` }}
                    />
                  </div>
                  <span className={`text-[9px] font-mono ${isSelected ? "font-bold text-[#1039B9] dark:text-sky-400" : t.mutedCls}`}>
                    {day.label.slice(3)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* RIGHT 4 COLS: OPEN HAIRLINE-DIVIDED PROMISES + HEALTH & ESCROW LEDGER */}
      <div className={`xl:col-span-4 rounded-2xl border overflow-hidden divide-y ${t.cardBorderCls} ${isDark ? "bg-[#0F141D] divide-slate-800" : "bg-white divide-[#EAECF0]"}`}>
        {/* 1. Compact Operational Guarantees Strip */}
        <div className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#1039B9] dark:text-sky-400">
              SPINE PROMISES ({promiseBoard.length})
            </span>
            <button
              type="button"
              onClick={() => onSwitchTab("intelligence")}
              className="text-[11px] font-semibold text-[#1039B9] dark:text-sky-400 hover:underline cursor-pointer"
            >
              Open Models &gt;
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {promiseBoard.map((pm) => {
              const active = selectedPromise?.id === pm.id;
              return (
                <button
                  key={pm.id}
                  type="button"
                  onClick={() => setActivePromiseId(active ? null : pm.id)}
                  className={`px-2.5 py-2 rounded-xl border text-left transition-colors cursor-pointer ${
                    active ? "border-[#1039B9] bg-[#1039B9]/8" : `${t.cardBorderCls} hover:border-[#1039B9]/40`
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${statusDotCls(pm.status)}`} />
                    <span className="font-mono font-bold text-xs tabular-nums">{pm.primaryValue}</span>
                  </div>
                  <div className="text-[11px] font-medium truncate mt-0.5">{pm.promise}</div>
                </button>
              );
            })}
          </div>

          {selectedPromise && (
            <div className={`p-2.5 rounded-xl text-[11px] space-y-1.5 ${t.wellCls}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[#1039B9] dark:text-sky-400 truncate">
                  {selectedPromise.provenance.projectionVersion} &middot; Seq {selectedPromise.provenance.firstSeq}..{selectedPromise.provenance.lastSeq}
                </span>
                <button
                  type="button"
                  onClick={() => onSwitchTab(PROMISE_BACKING_TAB[selectedPromise.id] ?? "comms")}
                  className="font-semibold underline shrink-0 cursor-pointer"
                >
                  Inspect &gt;
                </button>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px]">
                {selectedPromise.subMetrics.map((sm) => (
                  <span key={sm.label} className={t.mutedCls}>
                    {sm.label}: <strong className="font-mono text-current">{sm.value}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 2. Interactive Org Health & Region Jump Ledger */}
        <div className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold">
              Org Health &amp; Churn Risk ({filteredHealthRows.length})
            </span>
            <button
              type="button"
              onClick={() => onSwitchTab("fleet")}
              className="text-[11px] font-semibold text-[#1039B9] dark:text-sky-400 hover:underline cursor-pointer"
            >
              Manage Fleet &gt;
            </button>
          </div>
          <div className="max-h-[210px] overflow-y-auto divide-y divide-slate-500/10 text-xs">
            {filteredHealthRows.map((oh) => (
              <button
                key={oh.accountId}
                type="button"
                onClick={() => {
                  onSelectOrg(oh.accountId);
                  onSwitchTab("fleet");
                }}
                className="w-full py-2 flex items-center justify-between gap-2 text-left hover:bg-slate-500/5 px-1 rounded cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="font-semibold truncate">{oh.orgName}</div>
                  <div className={`text-[10px] truncate ${t.mutedCls}`}>
                    {oh.region} &middot; {oh.accessState}
                  </div>
                </div>
                <div className="text-right font-mono shrink-0 tabular-nums">
                  <div className="font-bold">{oh.score}/100</div>
                  <div className={`text-[10px] ${oh.churnRisk30dPct >= 50 ? "text-rose-500" : t.mutedCls}`}>
                    {oh.churnRisk30dPct}% risk
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 3. Live Action Footer: Kasri Escrow + Open Support */}
        <div className="px-4 py-3 grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => onSwitchTab("finance")}
            className={`p-2.5 rounded-xl text-left hover:border-[#1039B9]/40 transition-colors cursor-pointer ${t.wellCls}`}
          >
            <div className={`text-[10px] ${t.mutedCls}`}>Kasri Escrow Held</div>
            <div className="font-bold font-mono tabular-nums">{formatTzs(heldValueTzs, { compact: true })}</div>
            <div className={`text-[10px] ${t.mutedCls}`}>{escrowHeldOrders.length} active POs</div>
          </button>
          <button
            type="button"
            onClick={() => onSwitchTab("support")}
            className={`p-2.5 rounded-xl text-left hover:border-[#1039B9]/40 transition-colors cursor-pointer ${t.wellCls}`}
          >
            <div className={`text-[10px] ${t.mutedCls}`}>Support &amp; Audits</div>
            <div className="font-bold font-mono tabular-nums">{openTickets.length} open tickets</div>
            <div className={`text-[10px] ${t.mutedCls}`}>{auditLogs.length} audit logs</div>
          </button>
        </div>
      </div>
    </div>
  );
}
