"use client";

import { useMemo, useState } from "react";
import { formatTzs } from "@cervos/core";
import CervosMap from "@/components/MapClientWrapper";
import type { MarkerData } from "@/components/CervosMap";
import { hqSurfaceTokens } from "./hqSurface";
import type {
  HqDemandReorderItem,
  HqFleetAccount,
  HqHealthWeights,
  HqIntelligenceDetail,
  HqModelScorecard,
  HqPeakTelemetry,
  HqReadinessGate,
  HqShelfExpiryForecastItem,
  HqTab,
} from "./types";

interface HQIntelligenceTwinSectionProps {
  gates: HqReadinessGate[];
  scorecards: HqModelScorecard[];
  accounts: HqFleetAccount[];
  peakTelemetry?: HqPeakTelemetry;
  intelligenceDetail?: HqIntelligenceDetail;
  onRunAction: (payload: Record<string, unknown>, successMessage: string) => Promise<boolean>;
  onSwitchTab?: (tab: HqTab) => void;
  onSelectOrg?: (accountId: string) => void;
  isDark: boolean;
  busy: boolean;
}

type TwinScenarioId =
  | "baseline"
  | "malaria_surge"
  | "port_delay"
  | "annual_pricing"
  | "k5_expansion";

const DEFAULT_WEIGHTS: HqHealthWeights = {
  syncRecency: 24,
  salesTrend: 22,
  shiftCompliance: 14,
  paymentTimeliness: 22,
  ticketAge: 12,
  versionLag: 6,
};

const TWIN_PRESETS: Record<
  TwinScenarioId,
  { label: string; demandSurgePct: number; leadTimeAddDays: number; feeChangePct: number; note: string }
> = {
  baseline: {
    label: "Baseline Trajectory",
    demandSurgePct: 0,
    leadTimeAddDays: 0,
    feeChangePct: 0,
    note: "Current fleet trajectory calibrated against P10/P50/P90 quantiles.",
  },
  malaria_surge: {
    label: "Rainy Malaria Surge",
    demandSurgePct: 38,
    leadTimeAddDays: 3,
    feeChangePct: 0,
    note: "Masika seasonal surge: P90 service stock shifts up on essential antimalarials and ORS.",
  },
  port_delay: {
    label: "Supplier Delay (+7d)",
    demandSurgePct: 5,
    leadTimeAddDays: 7,
    feeChangePct: 0,
    note: "Extends lead-time buffer days and flags branches within P90 stock-out window.",
  },
  annual_pricing: {
    label: "Annual Plan Conversion",
    demandSurgePct: 8,
    leadTimeAddDays: 0,
    feeChangePct: 12,
    note: "Models MRR lift and lower 30d churn hazard after annual plan migration.",
  },
  k5_expansion: {
    label: "k >= 5 Sentinel Expansion",
    demandSurgePct: 15,
    leadTimeAddDays: 0,
    feeChangePct: 5,
    note: "Unlocks privacy-gated regional shortage CUSUM radar across all new zones.",
  },
};

const REGION_COORDS: Array<[string, number, number]> = [
  ["dar", -6.7924, 39.2083],
  ["arusha", -3.3869, 36.683],
  ["mwanza", -2.5164, 32.9175],
  ["dodoma", -6.163, 35.7516],
  ["mbeya", -8.9094, 33.4608],
  ["zanzibar", -6.1659, 39.2026],
  ["morogoro", -6.8278, 37.6591],
  ["tanga", -5.0689, 39.0987],
];

function fallbackCoord(region: string, seedIdx: number) {
  const lower = (region || "").toLowerCase();
  const match = REGION_COORDS.find(([k]) => lower.includes(k));
  const lat0 = match ? match[1] : -6.7924;
  const lng0 = match ? match[2] : 39.2083;
  const ang = (seedIdx * 137.5 * Math.PI) / 180;
  return {
    lat: Number((lat0 + Math.cos(ang) * 0.014).toFixed(4)),
    lng: Number((lng0 + Math.sin(ang) * 0.014).toFixed(4)),
  };
}

export default function HQIntelligenceTwinSection({
  gates,
  scorecards,
  accounts,
  peakTelemetry,
  intelligenceDetail,
  onRunAction,
  onSwitchTab,
  onSelectOrg,
  isDark,
  busy,
}: HQIntelligenceTwinSectionProps) {
  const t = hqSurfaceTokens(isDark);
  const [subTab, setSubTab] = useState<
    "shelf_reorder" | "health_detectors" | "gates_backtests" | "digital_twin"
  >("shelf_reorder");

  // Subtab 1 state
  const [modelMode, setModelMode] = useState<"reorder" | "expiry">("reorder");
  const [branchFilterId, setBranchFilterId] = useState<string>("");
  const [selectedReorderIdx, setSelectedReorderIdx] = useState(0);
  const [selectedExpiryIdx, setSelectedExpiryIdx] = useState(0);

  // Subtab 2 state (live editable health weights)
  const [weightsDraft, setWeightsDraft] = useState<HqHealthWeights>(
    intelligenceDetail?.healthWeights ?? DEFAULT_WEIGHTS
  );
  const [selectedOrgHazardId, setSelectedOrgHazardId] = useState<string>(
    intelligenceDetail?.orgHealthHazards[0]?.accountId ?? ""
  );

  // Subtab 3 state
  const [selectedGateId, setSelectedGateId] = useState<string>(gates[0]?.id ?? "G-ID");

  // Subtab 4 state (Digital Twin sliders)
  const [scenario, setScenario] = useState<TwinScenarioId>("malaria_surge");
  const [demandSurgePct, setDemandSurgePct] = useState(TWIN_PRESETS.malaria_surge.demandSurgePct);
  const [leadTimeAddDays, setLeadTimeAddDays] = useState(TWIN_PRESETS.malaria_surge.leadTimeAddDays);
  const [feeChangePct, setFeeChangePct] = useState(TWIN_PRESETS.malaria_surge.feeChangePct);

  const demandReorders = intelligenceDetail?.demandReorders ?? [];
  const shelfExpiryForecasts = intelligenceDetail?.shelfExpiryForecasts ?? [];
  const orgHazards = intelligenceDetail?.orgHealthHazards ?? [];
  const alerts = intelligenceDetail?.detectorAlerts ?? [];
  const suppliers = intelligenceDetail?.supplierReliability ?? [];
  const sentinelSignals = intelligenceDetail?.sentinelSignals ?? [];
  const backtest = intelligenceDetail?.backtestSummary;
  const edgePack = intelligenceDetail?.edgeModelPack;

  const visibleReorders = useMemo(
    () => (branchFilterId ? demandReorders.filter((r) => r.branchId === branchFilterId) : demandReorders),
    [demandReorders, branchFilterId]
  );
  const visibleExpiries = useMemo(
    () => (branchFilterId ? shelfExpiryForecasts.filter((x) => x.branchId === branchFilterId) : shelfExpiryForecasts),
    [shelfExpiryForecasts, branchFilterId]
  );

  const activeReorder: HqDemandReorderItem | undefined = visibleReorders[selectedReorderIdx] ?? visibleReorders[0];
  const activeExpiry: HqShelfExpiryForecastItem | undefined = visibleExpiries[selectedExpiryIdx] ?? visibleExpiries[0];

  // Map markers enriched with Model 1 & Model 2 risk
  const hotspotMarkers = useMemo(() => {
    let seed = 0;
    return accounts.flatMap((acc) =>
      acc.centres.map((ctr): MarkerData => {
        seed += 1;
        const pos =
          typeof ctr.lat === "number" && typeof ctr.lng === "number"
            ? { lat: ctr.lat, lng: ctr.lng }
            : fallbackCoord(ctr.region || acc.region, seed);
        const brReorder = demandReorders.find((r) => r.branchId === ctr.id);
        const brExpiry = shelfExpiryForecasts.find((x) => x.branchId === ctr.id);
        const isCritical = (brReorder && brReorder.daysOfCover <= brReorder.leadTimeDays) || (brExpiry && brExpiry.probLossPct >= 50);
        const isWarn = !isCritical && ((brReorder?.recommendedOrderQty ?? 0) > 0 || (brExpiry?.expectedLossTzs ?? 0) > 0);
        return {
          id: ctr.id,
          lat: pos.lat,
          lng: pos.lng,
          label: ctr.name,
          accountName: acc.orgName,
          region: ctr.region || acc.region,
          revenue: brExpiry?.expectedLossTzs ?? acc.salesRevenueTzs,
          status: isCritical ? "locked" : isWarn ? "trial" : "active",
          detail: brReorder
            ? `${brReorder.masterLabel}: ${brReorder.daysOfCover}d cover, rec +${brReorder.recommendedOrderQty}`
            : `${ctr.staffCount} staff`,
        };
      })
    );
  }, [accounts, demandReorders, shelfExpiryForecasts]);

  // Cumulative 14-day demand fan points for selected Model 1 item
  const demandFanPoints = useMemo(() => {
    const p10 = activeReorder?.dailyP10 ?? 0.4;
    const p50 = activeReorder?.dailyP50 ?? 1.0;
    const p90 = activeReorder?.dailyP90 ?? 1.8;
    const croston = activeReorder?.crostonBaselineDaily ?? 0.9;
    const stock = activeReorder?.currentQty ?? 0;
    return Array.from({ length: 14 }, (_, idx) => {
      const day = idx + 1;
      return {
        day,
        c10: Math.round(p10 * day),
        c50: Math.round(p50 * day),
        c90: Math.round(p90 * day),
        cBase: Math.round(croston * day),
        stock,
      };
    });
  }, [activeReorder]);

  // Digital Twin projection curve (10 time steps over 30d)
  const twinCurve = useMemo(() => {
    const baseRev =
      accounts.reduce((s, a) => s + a.salesRevenueTzs, 0) ||
      peakTelemetry?.monthlyRecurringRevenueTzs ||
      1800000;
    const p50Total = Math.round(baseRev * (1 + demandSurgePct / 100) * (1 + feeChangePct / 100));
    const p10Total = Math.round(p50Total * 0.81 - leadTimeAddDays * 15000);
    const p90Total = Math.round(p50Total * 1.19);
    const points = Array.from({ length: 10 }, (_, idx) => {
      const ratio = (idx + 1) / 10;
      return {
        dayLabel: `D${(idx + 1) * 3}`,
        p10: Math.round(p10Total * ratio),
        p50: Math.round(p50Total * ratio),
        p90: Math.round(p90Total * ratio),
      };
    });
    return {
      p10Total,
      p50Total,
      p90Total,
      stockoutDays: Math.max(0, Math.round(leadTimeAddDays * 1.1 + demandSurgePct * 0.08)),
      nearExpiryPctDelta: Math.round(leadTimeAddDays * 2 - demandSurgePct * 0.3),
      points,
    };
  }, [accounts, peakTelemetry, demandSurgePct, leadTimeAddDays, feeChangePct]);

  const activeGate = gates.find((g) => g.id === selectedGateId) ?? gates[0];
  const selectedHazard = orgHazards.find((h) => h.accountId === selectedOrgHazardId) ?? orgHazards[0];

  const surfaceCls = `rounded-2xl border ${t.cardBorderCls} ${isDark ? "bg-[#0F141D]" : "bg-white"}`;

  return (
    <div className="space-y-3">
      {/* COMPACT VIEW SWITCHER HEADER */}
      <div className={`px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 ${surfaceCls}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#1039B9] dark:text-sky-400">
            MODELS &amp; INTELLIGENCE
          </span>
          <span className={`text-xs font-semibold ${t.mutedCls}`}>
            {demandReorders.length} SKU forecasts &middot; {shelfExpiryForecasts.length} lots &middot; {alerts.length} alerts
          </span>
        </div>

        <div className={`inline-flex flex-wrap rounded-full p-0.5 gap-0.5 ${t.wellCls}`}>
          {(
            [
              { id: "shelf_reorder", label: `Quantiles & Expiry (${demandReorders.length}/${shelfExpiryForecasts.length})` },
              { id: "health_detectors", label: `Health & Detectors (${alerts.length})` },
              { id: "gates_backtests", label: `Gates & Edge Pack (${gates.filter((g) => g.passed).length}/${gates.length})` },
              { id: "digital_twin", label: "Digital Twin" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold cursor-pointer ${
                subTab === tab.id ? t.primaryBtnCls : t.mutedCls
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* =================================================================== */}
      {/* VIEW 1: QUANTILES & FEFO EXPIRY RESCUE + LIVE BRANCH RISK MAP       */}
      {/* =================================================================== */}
      {subTab === "shelf_reorder" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          {/* LEFT 5 COLS: INTERACTIVE FAN / MONTE CARLO CHART + HOTSPOT MAP */}
          <div className={`xl:col-span-5 overflow-hidden divide-y ${surfaceCls} ${isDark ? "divide-slate-800" : "divide-[#EAECF0]"}`}>
            <div className="p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold">
                    {modelMode === "reorder"
                      ? activeReorder
                        ? `${activeReorder.masterLabel} · ${activeReorder.branchName}`
                        : "Model 1 Quantile Fan"
                      : activeExpiry
                        ? `${activeExpiry.brandName} · Lot ${activeExpiry.batchNumber}`
                        : "Model 2 FEFO Monte Carlo"}
                  </div>
                  <div className={`text-[11px] ${t.mutedCls}`}>
                    {modelMode === "reorder"
                      ? `14d Cumulative P10 / P50 / P90 band vs ${activeReorder?.currentQty ?? 0} held packs`
                      : `200-trial FEFO simulation · ${activeExpiry?.probLossPct ?? 0}% loss risk · unsellable ${activeExpiry?.unsellableDate ?? "-"}`}
                  </div>
                </div>
                {branchFilterId && (
                  <button
                    type="button"
                    onClick={() => setBranchFilterId("")}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer ${t.pillCls}`}
                  >
                    Clear Map Filter
                  </button>
                )}
              </div>

              {/* Interactive SVG Demand Quantile Fan OR 5-Option Recovery Chart */}
              {modelMode === "reorder" ? (
                <div className="h-44 w-full">
                  {(() => {
                    const maxY = Math.max(
                      10,
                      activeReorder?.currentQty ?? 0,
                      ...demandFanPoints.map((p) => p.c90)
                    );
                    const w = 420;
                    const h = 150;
                    const xAt = (i: number) => 28 + (i / 13) * (w - 40);
                    const yAt = (v: number) => h - 20 - (v / maxY) * (h - 32);
                    const areaPath =
                      demandFanPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(p.c90)}`).join(" ") +
                      " " +
                      [...demandFanPoints]
                        .reverse()
                        .map((p, i) => `L ${xAt(13 - i)} ${yAt(p.c10)}`)
                        .join(" ") +
                      " Z";
                    const p50Line = demandFanPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(p.c50)}`).join(" ");
                    const baseLine = demandFanPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(p.cBase)}`).join(" ");
                    const stockY = yAt(activeReorder?.currentQty ?? 0);
                    return (
                      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full">
                        <path d={areaPath} fill={isDark ? "rgba(56,189,248,0.18)" : "rgba(16,57,185,0.12)"} />
                        <path d={p50Line} fill="none" stroke={isDark ? "#38BDF8" : "#1039B9"} strokeWidth="2.4" />
                        <path d={baseLine} fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="4 3" />
                        <line x1="28" y1={stockY} x2={w - 12} y2={stockY} stroke="#10B981" strokeWidth="1.6" strokeDasharray="5 3" />
                        <text x="32" y={Math.max(12, stockY - 4)} fill="#10B981" fontSize="9" fontFamily="monospace">
                          On Hand: {activeReorder?.currentQty ?? 0}
                        </text>
                        <text x={w - 86} y="14" fill={isDark ? "#38BDF8" : "#1039B9"} fontSize="9" fontFamily="monospace">
                          P10-P90 Fan vs Croston
                        </text>
                        <text x="28" y={h - 4} fill="#94A3B8" fontSize="9" fontFamily="monospace">
                          Day 1
                        </text>
                        <text x={w - 45} y={h - 4} fill="#94A3B8" fontSize="9" fontFamily="monospace">
                          Day 14
                        </text>
                      </svg>
                    );
                  })()}
                </div>
              ) : (
                <div className="space-y-1.5 pt-1">
                  {(activeExpiry?.allRescueOptions ?? []).map((opt) => {
                    const maxRec = Math.max(1, activeExpiry?.recommendedRescue.expectedRecoveryTzs ?? 1);
                    const pct = Math.max(4, Math.round((opt.expectedRecoveryTzs / maxRec) * 100));
                    return (
                      <div key={opt.option} className="space-y-0.5 text-[11px]">
                        <div className="flex justify-between">
                          <span className={opt.feasible ? "font-semibold" : `line-through ${t.mutedCls}`}>{opt.label}</span>
                          <span className="font-mono font-bold">{formatTzs(opt.expectedRecoveryTzs, { compact: true })}</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-500/15 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${opt.feasible ? "bg-[#1039B9] dark:bg-sky-400" : "bg-slate-400/40"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Live Stock-Out & Expiry Hotspot Map */}
            <div className="h-[240px] sm:h-[260px] w-full">
              <CervosMap
                markers={hotspotMarkers}
                defaultStyle={isDark ? "dark" : "light"}
                showControls
                onMarkerClick={(m) => {
                  const id = m.id ?? "";
                  setBranchFilterId((prev) => (prev === id ? "" : id));
                }}
              />
            </div>
          </div>

          {/* RIGHT 7 COLS: CLICKABLE REORDER / EXPIRY WORKBENCH */}
          <div className={`xl:col-span-7 overflow-hidden ${surfaceCls}`}>
            <div className={`px-4 py-2.5 border-b ${t.subtleBorderCls} flex flex-wrap items-center justify-between gap-2`}>
              <div className={`inline-flex rounded-full p-0.5 gap-0.5 ${t.wellCls}`}>
                <button
                  type="button"
                  onClick={() => setModelMode("reorder")}
                  className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${
                    modelMode === "reorder" ? t.primaryBtnCls : t.mutedCls
                  }`}
                >
                  Model 1 Reorder ({visibleReorders.length})
                </button>
                <button
                  type="button"
                  onClick={() => setModelMode("expiry")}
                  className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer ${
                    modelMode === "expiry" ? t.primaryBtnCls : t.mutedCls
                  }`}
                >
                  Model 2 Expiry Rescue ({visibleExpiries.length})
                </button>
              </div>
              <span className={`text-[11px] ${t.mutedCls}`}>Click any row to plot or map marker to filter branch</span>
            </div>

            {modelMode === "reorder" ? (
              <div className="max-h-[470px] overflow-y-auto divide-y divide-slate-500/10 text-xs">
                {visibleReorders.length === 0 ? (
                  <div className={`p-8 text-center ${t.mutedCls}`}>No demand forecasts available yet.</div>
                ) : (
                  visibleReorders.map((item, idx) => {
                    const isSel = activeReorder?.branchId === item.branchId && activeReorder?.masterId === item.masterId;
                    return (
                      <div
                        key={`${item.branchId}:${item.masterId}`}
                        onClick={() => setSelectedReorderIdx(idx)}
                        className={`p-3.5 flex flex-wrap items-center justify-between gap-3 cursor-pointer ${
                          isSel ? "bg-[#1039B9]/8" : "hover:bg-slate-500/5"
                        }`}
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold">{item.masterLabel}</span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-500/10 font-mono text-[10px]">
                              {item.serviceQuantile} · {item.leadTimeDays}d lead
                            </span>
                            {item.isEssential && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                                Essential
                              </span>
                            )}
                          </div>
                          <div className={`text-[11px] ${t.mutedCls}`}>
                            {item.orgName} &middot; {item.branchName} &middot; P10/P50/P90:{" "}
                            <span className="font-mono">{item.dailyP10}/{item.dailyP50}/{item.dailyP90}/d</span> (Croston {item.crostonBaselineDaily}/d)
                          </div>
                          <div className={`text-[11px] ${t.mutedCls}`}>{item.reason}</div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <div className="text-right font-mono">
                            <div className="font-bold text-sm">+{item.recommendedOrderQty}</div>
                            <div className={`text-[10px] ${item.daysOfCover <= item.leadTimeDays ? "text-rose-500 font-bold" : t.mutedCls}`}>
                              {item.daysOfCover}d cover
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={(e) => {
                              e.stopPropagation();
                              void onRunAction(
                                {
                                  action: "create_proposal_from_model",
                                  kind: "reorder_draft",
                                  branchId: item.branchId,
                                  masterId: item.masterId,
                                },
                                `Queued Model 1 reorder proposal for ${item.masterLabel}`
                              );
                            }}
                            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer ${t.primaryBtnCls}`}
                          >
                            Queue Reorder
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="max-h-[470px] overflow-y-auto divide-y divide-slate-500/10 text-xs">
                {visibleExpiries.length === 0 ? (
                  <div className={`p-8 text-center ${t.mutedCls}`}>No lot expiry forecasts found in DB.</div>
                ) : (
                  visibleExpiries.map((lot, idx) => {
                    const isSel = activeExpiry?.batchId === lot.batchId;
                    return (
                      <div
                        key={lot.batchId}
                        onClick={() => setSelectedExpiryIdx(idx)}
                        className={`p-3.5 flex flex-wrap items-center justify-between gap-3 cursor-pointer ${
                          isSel ? "bg-[#1039B9]/8" : "hover:bg-slate-500/5"
                        }`}
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold">{lot.brandName}</span>
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-500/10">
                              {lot.batchNumber}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${lot.probLossPct >= 50 ? "bg-rose-500/15 text-rose-500" : "bg-amber-500/15 text-amber-600"}`}>
                              {lot.probLossPct}% risk
                            </span>
                          </div>
                          <div className={`text-[11px] ${t.mutedCls}`}>
                            {lot.orgName} &middot; {lot.branchName} &middot; Unsellable {lot.unsellableDate} &middot; Best: <strong>{lot.recommendedRescue.label}</strong>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <div className="text-right font-mono">
                            <div className="font-bold text-rose-500">{formatTzs(lot.expectedLossTzs, { compact: true })}</div>
                            <div className={`text-[10px] ${t.mutedCls}`}>{lot.expectedUnsoldUnits}/{lot.qty} unsold</div>
                          </div>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={(e) => {
                              e.stopPropagation();
                              void onRunAction(
                                {
                                  action: "create_proposal_from_model",
                                  kind: "expiry_rescue",
                                  branchId: lot.branchId,
                                  batchId: lot.batchId,
                                },
                                `Queued Model 2 expiry rescue for ${lot.brandName}`
                              );
                            }}
                            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer ${t.primaryBtnCls}`}
                          >
                            Queue Rescue
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* VIEW 2: MODEL 3 HEALTH WEIGHTS, CI FOREST PLOT & CATALOG DETECTORS  */}
      {/* =================================================================== */}
      {subTab === "health_detectors" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          {/* Left 5 cols: Interactive 6-Weight Sliders + 95% CI Forest Plot */}
          <div className={`xl:col-span-5 p-4 space-y-4 ${surfaceCls}`}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold">Model 3 &middot; Health Index Weights</h3>
                <p className={`text-[11px] ${t.mutedCls}`}>Live logistic churn weights saved directly to HQ Spine.</p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void onRunAction(
                    { action: "update_health_weights", ...weightsDraft },
                    "Saved calibrated Model 3 health weights"
                  )
                }
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer ${t.primaryBtnCls}`}
              >
                Save Weights
              </button>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
              {(
                [
                  ["syncRecency", "Sync Recency"],
                  ["salesTrend", "Sales Trend"],
                  ["shiftCompliance", "Shift Compliance"],
                  ["paymentTimeliness", "Payment Speed"],
                  ["ticketAge", "Ticket Burden"],
                  ["versionLag", "Version Currency"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="space-y-0.5 block">
                  <div className="flex justify-between font-mono">
                    <span>{label}</span>
                    <strong>{weightsDraft[key]}</strong>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={weightsDraft[key]}
                    onChange={(e) =>
                      setWeightsDraft((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                    }
                    className="w-full accent-[#1039B9]"
                  />
                </label>
              ))}
            </div>

            <div className={`pt-3 border-t ${t.subtleBorderCls} space-y-2`}>
              <div className="text-xs font-bold">30-Day Churn Hazard &amp; 95% Confidence Intervals</div>
              <div className="max-h-[240px] overflow-y-auto space-y-2 pr-1">
                {orgHazards.map((oh) => (
                  <button
                    key={oh.accountId}
                    type="button"
                    onClick={() => {
                      setSelectedOrgHazardId(oh.accountId);
                      if (onSelectOrg && onSwitchTab) {
                        onSelectOrg(oh.accountId);
                      }
                    }}
                    className={`w-full text-left p-2 rounded-xl border transition-colors cursor-pointer ${
                      selectedHazard?.accountId === oh.accountId ? "border-[#1039B9] bg-[#1039B9]/8" : t.cardBorderCls
                    }`}
                  >
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold truncate">{oh.orgName}</span>
                      <span className="font-mono font-bold">
                        {oh.score}/100 ({oh.churnRisk30dPct}% [{oh.ciLowPct}-{oh.ciHighPct}%])
                      </span>
                    </div>
                    <div className="relative h-2.5 rounded-full bg-slate-500/15 mt-1.5">
                      <div
                        className="absolute top-0.5 h-1.5 rounded-full bg-amber-500/45"
                        style={{ left: `${oh.ciLowPct}%`, width: `${Math.max(4, oh.ciHighPct - oh.ciLowPct)}%` }}
                      />
                      <div
                        className="absolute top-0 w-2.5 h-2.5 -ml-1 rounded-full bg-[#1039B9] dark:bg-sky-400"
                        style={{ left: `${oh.churnRisk30dPct}%` }}
                      />
                    </div>
                  </button>
                ))}
              </div>
              {selectedHazard && (
                <div className={`p-2.5 rounded-xl text-[11px] flex items-center justify-between gap-2 ${t.wellCls}`}>
                  <div className="min-w-0">
                    <div className="font-bold truncate">{selectedHazard.recommendedPlaybook}</div>
                    <div className={`truncate ${t.mutedCls}`}>{selectedHazard.topReasons.join(" · ")}</div>
                  </div>
                  {onSelectOrg && onSwitchTab && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectOrg(selectedHazard.accountId);
                        onSwitchTab("fleet");
                      }}
                      className="text-[11px] font-bold text-[#1039B9] dark:text-sky-400 shrink-0 cursor-pointer"
                    >
                      Open &gt;
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right 7 cols: MAD / Rx / Stockout Detectors + Supplier Bayes + Regional CUSUM */}
          <div className={`xl:col-span-7 overflow-hidden divide-y ${surfaceCls} ${isDark ? "divide-slate-800" : "divide-[#EAECF0]"}`}>
            <div className="p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">Catalog Detectors ({alerts.length})</h3>
                <span className={`text-[11px] font-mono ${t.mutedCls}`}>
                  Precision feedback: {alerts[0]?.detectorPrecisionPct ?? 89}%
                </span>
              </div>
              <div className="max-h-[220px] overflow-y-auto space-y-2">
                {alerts.length === 0 ? (
                  <div className={`p-4 text-center text-xs ${t.mutedCls}`}>Zero active anomaly or stock-out alerts in fleet.</div>
                ) : (
                  alerts.map((al) => (
                    <div key={al.id} className={`p-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs ${t.cardBorderCls}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold ${al.severity === "critical" ? "bg-rose-500/15 text-rose-500" : "bg-amber-500/15 text-amber-600"}`}>
                            {al.detector} · {al.scoreLabel}
                          </span>
                          <span className="font-semibold truncate">{al.orgName} ({al.branchName})</span>
                        </div>
                        <div className={`text-[11px] mt-0.5 ${t.mutedCls}`}>{al.summary}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {(["real", "known", "false_alarm"] as const).map((v) => (
                          <button
                            key={v}
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void onRunAction(
                                { action: "label_anomaly_alert", alertId: al.id, verdict: v },
                                `Marked alert ${al.id} as ${v}`
                              )
                            }
                            className={`px-2 py-1 rounded-full text-[10px] font-semibold cursor-pointer ${
                              al.verdict === v ? t.primaryBtnCls : t.wellCls
                            }`}
                          >
                            {v === "false_alarm" ? "False" : v}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <div className="font-bold">Supplier Bayesian Reliability (priorWeight=5)</div>
                {suppliers.length === 0 ? (
                  <div className={`text-[11px] ${t.mutedCls}`}>No wholesale supplier orders in DB yet.</div>
                ) : (
                  suppliers.map((sup) => (
                    <div key={sup.supplierName} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-semibold truncate">{sup.supplierName} ({sup.observedOrders} POs)</span>
                        <span className="font-mono font-bold">{sup.reliabilityScore}/100</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-500/15 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${sup.reliabilityScore}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2">
                <div className="font-bold">Regional CUSUM Sentinel (Privacy G-GROUP k &gt;= 5)</div>
                {sentinelSignals.map((sig) => (
                  <div key={sig.region} className={`p-2 rounded-xl border text-[11px] ${t.cardBorderCls}`}>
                    <div className="flex justify-between font-semibold">
                      <span>{sig.region} ({sig.contributingOrgs}/5 orgs)</span>
                      <span className="font-mono">{sig.privacyGated ? "GATED" : `CUSUM ${sig.cusumScore}`}</span>
                    </div>
                    <div className={`text-[10px] ${t.mutedCls}`}>{sig.note}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* VIEW 3: GATES, ROLLING BACKTEST CHARTS & SIGNED EDGE MODEL PACK     */}
      {/* =================================================================== */}
      {subTab === "gates_backtests" && (
        <div className="space-y-4">
          {/* 5 Readiness Gates Ribbon */}
          <div className={`p-4 space-y-2.5 ${surfaceCls}`}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {gates.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedGateId(g.id)}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer ${
                    selectedGateId === g.id ? "border-[#1039B9] bg-[#1039B9]/8" : t.cardBorderCls
                  }`}
                >
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="font-bold">{g.id}</span>
                    <span className={g.passed ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>
                      {g.passed ? "PASSED" : "FALLBACK"}
                    </span>
                  </div>
                  <div className="text-xs font-semibold truncate mt-0.5">{g.label}</div>
                  <div className={`text-[10px] font-mono ${t.mutedCls}`}>{g.currentValue}</div>
                </button>
              ))}
            </div>
            {activeGate && (
              <div className={`px-3 py-2 rounded-xl text-[11px] flex flex-wrap justify-between gap-2 ${t.wellCls}`}>
                <span>
                  <strong>{activeGate.id}:</strong> {activeGate.condition} &middot; Unlocks: {activeGate.unlocks}
                </span>
                <span className={t.mutedCls}>{activeGate.fallbackNote}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
            {/* Backtest Metrics Visual & Scorecards */}
            <div className={`xl:col-span-7 p-4 space-y-3 ${surfaceCls}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold">Rolling-Origin Backtest Evaluator ({backtest?.foldsEvaluated ?? 4} Weekly Folds)</h3>
                {backtest && (
                  <span className="font-mono text-xs text-[#1039B9] dark:text-sky-400 font-bold">
                    WAPE {backtest.wapePct}% vs {backtest.baselineWapePct}% Baseline &middot; MASE {backtest.mase}
                  </span>
                )}
              </div>

              {backtest && (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs font-mono">
                  {[
                    ["WAPE", `${backtest.wapePct}%`],
                    ["Baseline", `${backtest.baselineWapePct}%`],
                    ["MASE", String(backtest.mase)],
                    ["Pinball P10/P50/P90", `${backtest.pinballP10}/${backtest.pinballP50}/${backtest.pinballP90}`],
                    ["Coverage", `${backtest.empiricalCoveragePct}%`],
                    ["PSI Drift", String(backtest.psiDrift)],
                  ].map(([k, v]) => (
                    <div key={k} className={`p-2 rounded-xl ${t.wellCls}`}>
                      <div className={`text-[9px] uppercase ${t.mutedCls}`}>{k}</div>
                      <div className="font-bold truncate">{v}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className={`border-b ${t.subtleBorderCls} text-[10px] uppercase ${t.mutedCls}`}>
                      <th className="py-2 pr-2">Model</th>
                      <th className="py-2 pr-2">Score</th>
                      <th className="py-2 pr-2">Baseline</th>
                      <th className="py-2 pr-2 text-right">Cov / PSI</th>
                      <th className="py-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-500/10 tabular-nums">
                    {scorecards.map((sc) => (
                      <tr key={sc.id}>
                        <td className="py-2 pr-2 font-semibold">{sc.name}</td>
                        <td className="py-2 pr-2 font-mono">{sc.modelScore}</td>
                        <td className={`py-2 pr-2 font-mono ${t.mutedCls}`}>{sc.baselineScore}</td>
                        <td className="py-2 pr-2 font-mono text-right">{sc.coveragePct}% / {sc.psiDrift}</td>
                        <td className="py-2 text-right font-mono uppercase text-[10px] font-bold">{sc.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Signed Edge Model Pack Inspector */}
            <div className={`xl:col-span-5 p-4 space-y-3 text-xs ${surfaceCls}`}>
              <h3 className="text-sm font-bold">Signed Offline Edge Model Pack</h3>
              <p className={t.mutedCls}>
                Compact HMAC-SHA256 verified rule bundle shipped to Desktop &amp; Mobile tills for zero-internet operation.
              </p>
              {edgePack ? (
                <div className="space-y-2 font-mono">
                  <div className={`p-3 rounded-xl space-y-1.5 ${t.wellCls}`}>
                    <div className="flex justify-between"><span className={t.mutedCls}>Pack Version</span><strong>{edgePack.packVersion}</strong></div>
                    <div className="flex justify-between"><span className={t.mutedCls}>HMAC-SHA256</span><strong>{edgePack.hmacSignature}</strong></div>
                    <div className="flex justify-between"><span className={t.mutedCls}>Payload Size</span><strong>{edgePack.payloadBytes} bytes</strong></div>
                    <div className="flex justify-between"><span className={t.mutedCls}>Reorder Rules</span><strong>{edgePack.reorderRulesCount}</strong></div>
                    <div className="flex justify-between"><span className={t.mutedCls}>Expiry Rescue Rules</span><strong>{edgePack.expiryRescueRulesCount}</strong></div>
                    <div className="flex justify-between"><span className={t.mutedCls}>MAD Thresholds</span><strong>{edgePack.anomalyThresholdsCount}</strong></div>
                  </div>
                </div>
              ) : (
                <div className={t.mutedCls}>Edge Model Pack pending first forecast sync.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* VIEW 4: REGIONAL DIGITAL TWIN & WHAT-IF SANDBOX                     */}
      {/* =================================================================== */}
      {subTab === "digital_twin" && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          <div className={`xl:col-span-5 p-4 space-y-4 ${surfaceCls}`}>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(TWIN_PRESETS) as TwinScenarioId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setScenario(id);
                    setDemandSurgePct(TWIN_PRESETS[id].demandSurgePct);
                    setLeadTimeAddDays(TWIN_PRESETS[id].leadTimeAddDays);
                    setFeeChangePct(TWIN_PRESETS[id].feeChangePct);
                  }}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold cursor-pointer ${
                    scenario === id ? t.primaryBtnCls : t.wellCls
                  }`}
                >
                  {TWIN_PRESETS[id].label}
                </button>
              ))}
            </div>

            <div className="space-y-2.5 text-xs">
              <label className="block space-y-1">
                <div className="flex justify-between"><span>Seasonal Demand Surge</span><strong className="font-mono">+{demandSurgePct}%</strong></div>
                <input type="range" min="-20" max="60" value={demandSurgePct} onChange={(e) => setDemandSurgePct(Number(e.target.value))} className="w-full accent-[#1039B9]" />
              </label>
              <label className="block space-y-1">
                <div className="flex justify-between"><span>Supplier Lead-Time Delay</span><strong className="font-mono">+{leadTimeAddDays}d</strong></div>
                <input type="range" min="0" max="14" value={leadTimeAddDays} onChange={(e) => setLeadTimeAddDays(Number(e.target.value))} className="w-full accent-[#1039B9]" />
              </label>
              <label className="block space-y-1">
                <div className="flex justify-between"><span>Subscription / Escrow Yield Delta</span><strong className="font-mono">{feeChangePct >= 0 ? "+" : ""}{feeChangePct}%</strong></div>
                <input type="range" min="-15" max="25" value={feeChangePct} onChange={(e) => setFeeChangePct(Number(e.target.value))} className="w-full accent-[#1039B9]" />
              </label>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void onRunAction(
                  { action: "run_agent_drafts" },
                  `Generated Decision Inbox proposals for ${TWIN_PRESETS[scenario].label}`
                )
              }
              className={`w-full h-9 rounded-full text-xs font-semibold cursor-pointer disabled:opacity-50 ${t.primaryBtnCls}`}
            >
              Generate Mitigation Proposal in Inbox
            </button>
          </div>

          <div className={`xl:col-span-7 p-4 space-y-3 ${surfaceCls}`}>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <div className={t.mutedCls}>Projected 30d POS (P50)</div>
                <div className="text-xl font-bold font-mono">{formatTzs(twinCurve.p50Total, { compact: true })}</div>
                <div className={`text-[10px] font-mono ${t.mutedCls}`}>
                  {formatTzs(twinCurve.p10Total, { compact: true })}..{formatTzs(twinCurve.p90Total, { compact: true })}
                </div>
              </div>
              <div>
                <div className={t.mutedCls}>Projected Stock-out Days</div>
                <div className={`text-xl font-bold font-mono ${twinCurve.stockoutDays > 3 ? "text-rose-500" : ""}`}>
                  {twinCurve.stockoutDays}d
                </div>
              </div>
              <div>
                <div className={t.mutedCls}>Near-Expiry Delta</div>
                <div className="text-xl font-bold font-mono">
                  {twinCurve.nearExpiryPctDelta >= 0 ? "+" : ""}{twinCurve.nearExpiryPctDelta}%
                </div>
              </div>
            </div>

            {/* Interactive SVG 30d Trajectory Band */}
            <div className="h-44 w-full">
              {(() => {
                const maxVal = Math.max(100, twinCurve.p90Total);
                const w = 520;
                const h = 155;
                const xAt = (i: number) => 24 + (i / 9) * (w - 36);
                const yAt = (v: number) => h - 20 - (v / maxVal) * (h - 32);
                const band =
                  twinCurve.points.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(p.p90)}`).join(" ") +
                  " " +
                  [...twinCurve.points]
                    .reverse()
                    .map((p, i) => `L ${xAt(9 - i)} ${yAt(p.p10)}`)
                    .join(" ") +
                  " Z";
                const mid = twinCurve.points.map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(p.p50)}`).join(" ");
                return (
                  <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full">
                    <path d={band} fill={isDark ? "rgba(56,189,248,0.18)" : "rgba(16,57,185,0.12)"} />
                    <path d={mid} fill="none" stroke={isDark ? "#38BDF8" : "#1039B9"} strokeWidth="2.5" />
                    {twinCurve.points.map((p, i) => (
                      <g key={p.dayLabel}>
                        <circle cx={xAt(i)} cy={yAt(p.p50)} r="3" fill={isDark ? "#38BDF8" : "#1039B9"} />
                        <text x={xAt(i) - 7} y={h - 4} fontSize="9" fill="#94A3B8" fontFamily="monospace">
                          {p.dayLabel}
                        </text>
                      </g>
                    ))}
                  </svg>
                );
              })()}
            </div>
            <p className={`text-[11px] ${t.mutedCls}`}>{TWIN_PRESETS[scenario].note}</p>
          </div>
        </div>
      )}
    </div>
  );
}
