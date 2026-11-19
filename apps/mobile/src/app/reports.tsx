import { useMemo, useState } from "react";
import { Pressable, ScrollView, Share, Text, View } from "react-native";
import {
  classifyAbcXyzMatrix,
  classifyReorderUrgency,
  computeSafetyStockRecommendations,
  detectSalesAnomalies,
  formatTzs,
  holtLinearForecast,
  linearTrendRegression,
  mineBasketAffinities,
  predictCounterStaffingWindows,
} from "@cervos/core";
import {
  RevenuePulseChart,
  type ChartBarPoint,
} from "@/components/cervos-ui/RevenuePulseChart";
import { useMobileSession } from "@/context/session-context";
import { shareIntelligenceReportPdf } from "@/services/receipts";
import { triggerHaptic } from "@/services/sounds";
import { radius, spacing, useBrandColors } from "@/theme";
import {
  buildDailyRevenueSeries,
  buildMlProducts,
  computeStockHealth,
  summarizeBranchPnl,
  todayIsoDay,
} from "@/utils/intelligence";

type ReportSubTab =
  | "brief"
  | "sales"
  | "products"
  | "stock"
  | "people"
  | "procurement"
  | "my_perf";

const REPORT_TABS: Array<{
  id: ReportSubTab;
  label: string;
  swLabel: string;
  orgOnly?: boolean;
  financeOnly?: boolean;
}> = [
  { id: "brief", label: "Business Summary", swLabel: "Muhtasari", orgOnly: true },
  { id: "sales", label: "Sales & Rush Hours", swLabel: "Mauzo & Kilele", orgOnly: true },
  { id: "products", label: "Products & Profit", swLabel: "Bidhaa & Faida", orgOnly: true },
  { id: "stock", label: "Expiry Risk", swLabel: "Hatari ya Muda", orgOnly: true },
  { id: "people", label: "Team & Branches", swLabel: "Timu & Matawi", orgOnly: true },
  { id: "procurement", label: "Suppliers & P&L", swLabel: "Bohari & P&L", orgOnly: true, financeOnly: true },
  { id: "my_perf", label: "My Performance", swLabel: "Utendaji Wangu" },
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOUR_BUCKETS = [
  { label: "06-10", start: 6, end: 9 },
  { label: "10-14", start: 10, end: 13 },
  { label: "14-18", start: 14, end: 17 },
  { label: "18-22", start: 18, end: 21 },
] as const;

export default function ReportsScreen() {
  const {
    workspace,
    scopedSales,
    scopedBatches,
    scopedExpenses,
    activeCentre,
    capabilities,
    lang,
  } = useMobileSession();
  const brand = useBrandColors(workspace?.account?.customization?.brandAccent);
  const isSw = lang === "SW";
  const scale = brand.fontMult;

  const canViewOrg = capabilities.canViewOrgReports;
  const canViewFinance = capabilities.canViewFinance;
  const canExport = capabilities.canExportReports;

  const visibleTabs = useMemo(
    () =>
      REPORT_TABS.filter((t) => {
        if (t.orgOnly && !canViewOrg) return false;
        if (t.financeOnly && !canViewFinance) return false;
        return true;
      }),
    [canViewOrg, canViewFinance]
  );

  const [activeTab, setActiveTab] = useState<ReportSubTab>(canViewOrg ? "brief" : "my_perf");
  const [days, setDays] = useState<14 | 30 | 60>(30);
  const [selectedHeatCell, setSelectedHeatCell] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);

  const pnl = useMemo(
    () => summarizeBranchPnl(scopedSales, scopedExpenses, days),
    [scopedSales, scopedExpenses, days]
  );
  const stock = useMemo(() => computeStockHealth(scopedBatches, todayIsoDay()), [scopedBatches]);
  const series = useMemo(() => buildDailyRevenueSeries(scopedSales, days), [scopedSales, days]);
  const full30 = useMemo(() => buildDailyRevenueSeries(scopedSales, 30), [scopedSales]);
  const mlProducts = useMemo(
    () => buildMlProducts(scopedSales, scopedBatches, days),
    [scopedSales, scopedBatches, days]
  );

  const holtForecast = useMemo(() => holtLinearForecast(full30, 7), [full30]);
  const trendOls = useMemo(() => linearTrendRegression(series), [series]);
  const anomalies = useMemo(() => detectSalesAnomalies(series, 2.1), [series]);
  const affinities = useMemo(() => mineBasketAffinities(scopedSales, 2), [scopedSales]);
  const urgencyList = useMemo(() => classifyReorderUrgency(mlProducts), [mlProducts]);
  const safetyStockList = useMemo(
    () => computeSafetyStockRecommendations(scopedSales, mlProducts, 4),
    [scopedSales, mlProducts]
  );
  const abcXyzList = useMemo(() => classifyAbcXyzMatrix(scopedSales, mlProducts), [scopedSales, mlProducts]);
  const staffingWindows = useMemo(() => predictCounterStaffingWindows(scopedSales), [scopedSales]);
  const forecast7Total = useMemo(() => holtForecast.reduce((sum, p) => sum + p.predicted, 0), [holtForecast]);

  // Business Health Score (0-100) matching Web formula structure
  const healthScore = useMemo(() => {
    const marginScore = Math.min(35, Math.max(5, Math.round(pnl.grossMarginPct * 1.1)));
    const turnoverScore = Math.min(30, pnl.salesCount * 2);
    const expiryPenalty = Math.min(25, stock.expiredCount * 5 + Math.round(stock.expiring30Units / 10));
    const momentumBonus = trendOls.direction === "rising" ? 20 : trendOls.direction === "cooling" ? 8 : 14;
    return Math.max(18, Math.min(99, marginScore + turnoverScore + momentumBonus - expiryPenalty + 15));
  }, [pnl.grossMarginPct, pnl.salesCount, stock.expiredCount, stock.expiring30Units, trendOls.direction]);

  // Payment Mix Breakdown
  const paymentMix = useMemo(() => {
    const map = new Map<string, { channel: string; count: number; revenue: number }>();
    for (const s of scopedSales) {
      const ch = (s.paymentMethod || "cash").toUpperCase();
      const cur = map.get(ch) ?? { channel: ch, count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += s.totalTzs;
      map.set(ch, cur);
    }
    const total = Math.max(1, scopedSales.reduce((sum, s) => sum + s.totalTzs, 0));
    return Array.from(map.values())
      .map((item) => ({ ...item, pct: Math.round((item.revenue / total) * 100) }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [scopedSales]);

  // 7x4 Hour-of-Week Heatmap
  const heatmapGrid = useMemo(() => {
    const grid = WEEKDAYS.map(() => HOUR_BUCKETS.map(() => 0));
    let maxVal = 1;
    for (const s of scopedSales) {
      const dt = new Date(s.createdAt);
      if (Number.isNaN(dt.getTime())) continue;
      const monIdx = (dt.getDay() + 6) % 7;
      const hr = dt.getHours();
      const bIdx = HOUR_BUCKETS.findIndex((b) => hr >= b.start && hr <= b.end);
      if (bIdx >= 0) {
        grid[monIdx][bIdx] += 1;
        if (grid[monIdx][bIdx] > maxVal) maxVal = grid[monIdx][bIdx];
      }
    }
    return { grid, maxVal };
  }, [scopedSales]);

  // Staff Leaderboard
  const staffLeaderboard = useMemo(() => {
    const map = new Map<string, { name: string; count: number; revenue: number }>();
    for (const s of scopedSales) {
      const cur = map.get(s.actorName) ?? { name: s.actorName, count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += s.totalTzs;
      map.set(s.actorName, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [scopedSales]);

  // Personal Sales Summary
  const mySales = useMemo(() => {
    const pid = workspace?.activeProfile?.id;
    const mine = scopedSales.filter((s) => !pid || s.profileId === pid);
    const rev = mine.reduce((sum, s) => sum + s.totalTzs, 0);
    return { count: mine.length, revenue: rev, avgBasket: mine.length > 0 ? Math.round(rev / mine.length) : 0 };
  }, [scopedSales, workspace?.activeProfile?.id]);

  // Expense Category Rollup
  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of scopedExpenses) {
      map.set(e.category, (map.get(e.category) ?? 0) + e.amountTzs);
    }
    return Array.from(map.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [scopedExpenses]);

  const combinedChartPoints = useMemo<ChartBarPoint[]>(() => {
    const actual = series.slice(-8).map((pt) => ({
      label: pt.date.slice(8),
      sublabel: pt.date,
      value: pt.revenue,
      isForecast: false,
    }));
    const forecast = holtForecast.slice(0, 5).map((pt) => ({
      label: `+${pt.date.slice(8)}`,
      sublabel: pt.date,
      value: pt.predicted,
      isForecast: true,
    }));
    return [...actual, ...forecast];
  }, [series, holtForecast]);

  const cardStyle = {
    padding: spacing.md,
    borderRadius: radius.xl,
    borderCurve: "continuous" as const,
    backgroundColor: brand.cardBg,
    borderWidth: 1,
    borderColor: brand.borderColor,
    gap: spacing.sm,
  };

  const handleSharePdf = async () => {
    if (exportBusy) return;
    setExportBusy(true);
    try {
      await shareIntelligenceReportPdf({
        orgName: workspace?.account?.orgName || "Cervos Pharmacy",
        branchName: activeCentre?.name || "All Branches",
        windowDays: days,
        narrative: `Health Score ${healthScore}/100 · Revenue ${formatTzs(pnl.revenue)} across ${pnl.salesCount} receipts · Net Operating Profit ${formatTzs(pnl.netProfit)} (${pnl.grossMarginPct}% gross margin).`,
        metrics: [
          { label: "Revenue", value: formatTzs(pnl.revenue, { compact: true }) },
          { label: "Net Profit", value: formatTzs(pnl.netProfit, { compact: true }) },
          { label: "Stock Retail", value: formatTzs(stock.atRetail, { compact: true }) },
          { label: "Health Score", value: `${healthScore}/100` },
        ],
        tableHeaders: ["Top Medicine", "ABC-XYZ", "Units / Revenue"],
        rows: mlProducts.slice(0, 12).map((p) => ({
          col1: p.brandName,
          col2: p.abcClass,
          col3: `${p.unitsSold}x · ${formatTzs(p.revenue)}`,
        })),
      });
    } finally {
      setExportBusy(false);
    }
  };

  const handleShareCsv = async () => {
    const header = "Brand,ABC Class,Units Sold,On Hand,Revenue TZS,Days Cover\n";
    const lines = mlProducts
      .map(
        (p) =>
          `"${p.brandName.replace(/"/g, '""')}",${p.abcClass},${p.unitsSold},${p.onHand},${p.revenue},${p.daysOfCover ?? ""}`
      )
      .join("\n");
    await Share.share({
      title: `${workspace?.account?.orgName || "Cervos"} ${days}d CSV`,
      message: `${header}${lines}`,
    });
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: brand.canvasBg }}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 48 }}
    >
      {/* Top Bar: Window Selector + CSV/PDF Export */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.xs }}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {([14, 30, 60] as const).map((w) => (
            <Pressable
              key={w}
              onPress={() => {
                setDays(w);
                void triggerHaptic("selection");
              }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: radius.full,
                backgroundColor: days === w ? brand.accent : brand.cardBg,
                borderWidth: 1,
                borderColor: days === w ? brand.accent : brand.borderColor,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: days === w ? "#FFFFFF" : brand.textPrimary }}>
                {w}d
              </Text>
            </Pressable>
          ))}
        </View>

        {canExport && (
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Pressable
              onPress={() => void handleShareCsv()}
              style={{
                paddingHorizontal: 11,
                paddingVertical: 7,
                borderRadius: radius.full,
                backgroundColor: brand.cardBg,
                borderWidth: 1,
                borderColor: brand.borderColor,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: brand.textPrimary }}>CSV</Text>
            </Pressable>
            <Pressable
              disabled={exportBusy}
              onPress={() => void handleSharePdf()}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: radius.full,
                backgroundColor: brand.teal,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#FFFFFF" }}>
                {exportBusy ? "..." : "PDF Report"}
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Web-Parity 7 Sub-Tab Navigation Strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {visibleTabs.map((t) => {
          const active = activeTab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => {
                setActiveTab(t.id);
                void triggerHaptic("selection");
              }}
              style={{
                paddingHorizontal: 13,
                paddingVertical: 8,
                borderRadius: radius.full,
                backgroundColor: active ? brand.accent : brand.cardBg,
                borderWidth: 1,
                borderColor: active ? brand.accent : brand.borderColor,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: active ? "#FFFFFF" : brand.textSecondary }}>
                {isSw ? t.swLabel : t.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {activeTab === "brief" && (
        <>
          {/* Business Health Score Gauge */}
          <View style={cardStyle}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={{ fontSize: 10, fontWeight: "800", letterSpacing: 1, color: brand.accent }}>
                  BUSINESS HEALTH SCORE
                </Text>
                <Text style={{ fontSize: 22 * scale, fontWeight: "800", color: brand.textPrimary }}>
                  {healthScore} / 100
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: radius.full,
                  backgroundColor: brand.limeBadgeBg,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "800", color: brand.limeBadgeInk }}>
                  {healthScore >= 75 ? "STRONG" : healthScore >= 50 ? "STEADY" : "NEEDS FOCUS"}
                </Text>
              </View>
            </View>
            <View
              style={{
                height: 10,
                borderRadius: 5,
                backgroundColor: brand.cardSubtleBg,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${healthScore}%`,
                  height: "100%",
                  backgroundColor: healthScore >= 75 ? brand.success : healthScore >= 50 ? brand.accent : brand.warning,
                }}
              />
            </View>
          </View>

          {/* P&L Waterfall */}
          <View style={cardStyle}>
            <Text style={{ fontSize: 10, fontWeight: "800", letterSpacing: 1, color: brand.textMuted }}>
              PROFIT & LOSS ({days}D)
            </Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 13, color: brand.textSecondary }}>Revenue ({pnl.salesCount} receipts)</Text>
              <Text style={{ fontWeight: "700", color: brand.textPrimary }}>{formatTzs(pnl.revenue)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 13, color: brand.textSecondary }}>Cost of Goods Sold</Text>
              <Text style={{ fontWeight: "600", color: brand.textSecondary }}>-{formatTzs(pnl.cogs)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 13, color: brand.textSecondary }}>Operating Expenses</Text>
              <Text style={{ fontWeight: "600", color: brand.danger }}>-{formatTzs(pnl.opex)}</Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                paddingTop: spacing.xs,
                borderTopWidth: 1,
                borderTopColor: brand.borderColor,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "800", color: brand.textPrimary }}>Net Operating Profit</Text>
              <Text style={{ fontSize: 16, fontWeight: "800", color: brand.success }}>
                {formatTzs(pnl.netProfit)} ({pnl.grossMarginPct}%)
              </Text>
            </View>
          </View>

          {/* Payment Channel Mix */}
          <View style={cardStyle}>
            <Text style={{ fontSize: 10, fontWeight: "800", letterSpacing: 1, color: brand.textMuted }}>
              PAYMENT CHANNEL MIX
            </Text>
            {paymentMix.length === 0 ? (
              <Text style={{ fontSize: 12, color: brand.textMuted }}>No settled payments yet.</Text>
            ) : (
              paymentMix.map((ch) => (
                <View key={ch.channel} style={{ gap: 4 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: brand.textPrimary }}>
                      {ch.channel} ({ch.count})
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: brand.accent }}>
                      {formatTzs(ch.revenue, { compact: true })} ({ch.pct}%)
                    </Text>
                  </View>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: brand.cardSubtleBg, overflow: "hidden" }}>
                    <View style={{ width: `${ch.pct}%`, height: "100%", backgroundColor: brand.accent }} />
                  </View>
                </View>
              ))
            )}
          </View>
        </>
      )}

      {activeTab === "sales" && (
        <>
          <RevenuePulseChart
            title={`DAILY REVENUE & 5D HOLT PROJECTION (${trendOls.direction.toUpperCase()} · R² ${trendOls.rSquared})`}
            points={combinedChartPoints}
            accentHex={workspace?.account?.customization?.brandAccent}
          />

          {/* 24x7 Compressed Rush-Hour Heatmap */}
          <View style={cardStyle}>
            <Text style={{ fontSize: 10, fontWeight: "800", letterSpacing: 1, color: brand.accent }}>
              WEEKLY RUSH-HOUR HEATMAP
            </Text>
            <View style={{ flexDirection: "row", paddingLeft: 34, gap: 4 }}>
              {HOUR_BUCKETS.map((b) => (
                <Text key={b.label} style={{ flex: 1, textAlign: "center", fontSize: 10, fontWeight: "700", color: brand.textMuted }}>
                  {b.label}
                </Text>
              ))}
            </View>
            {WEEKDAYS.map((day, dIdx) => (
              <View key={day} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={{ width: 30, fontSize: 11, fontWeight: "700", color: brand.textSecondary }}>{day}</Text>
                {HOUR_BUCKETS.map((b, bIdx) => {
                  const val = heatmapGrid.grid[dIdx][bIdx];
                  const ratio = val / heatmapGrid.maxVal;
                  const cellBg =
                    val === 0
                      ? brand.cardSubtleBg
                      : ratio > 0.65
                        ? brand.accent
                        : ratio > 0.3
                          ? brand.teal
                          : brand.accentSoft;
                  return (
                    <Pressable
                      key={`${day}_${b.label}`}
                      onPress={() => setSelectedHeatCell(`${day} ${b.label}: ${val} counter receipts`)}
                      style={{
                        flex: 1,
                        height: 26,
                        borderRadius: 6,
                        backgroundColor: cellBg,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "700",
                          color: ratio > 0.3 && val > 0 ? "#FFFFFF" : brand.textMuted,
                        }}
                      >
                        {val || "-"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
            {selectedHeatCell && (
              <Text style={{ fontSize: 12, fontWeight: "700", color: brand.accent }}>{selectedHeatCell}</Text>
            )}
          </View>

          {/* Staffing Peaks & Anomalies */}
          <View style={cardStyle}>
            <Text style={{ fontSize: 10, fontWeight: "800", letterSpacing: 1, color: brand.textMuted }}>
              STAFFING PEAKS · 7D FORECAST {formatTzs(forecast7Total, { compact: true })}
            </Text>
            {staffingWindows.slice(0, 5).map((win) => (
              <View key={win.hour24} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 13, color: brand.textSecondary }}>
                  {win.hourLabel} ({win.avgReceiptsPerDay}/day)
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: win.loadTier === "peak" ? brand.danger : win.loadTier === "busy" ? brand.warning : brand.success,
                  }}
                >
                  {win.loadTier.toUpperCase()} · {win.recommendedCounters} counter{win.recommendedCounters > 1 ? "s" : ""}
                </Text>
              </View>
            ))}
            {anomalies.length > 0 && (
              <View style={{ paddingTop: 6, borderTopWidth: 1, borderTopColor: brand.borderColor, gap: 4 }}>
                <Text style={{ fontSize: 10, fontWeight: "800", color: brand.warning }}>ANOMALY SIGNALS (MAD Z-SCORE)</Text>
                {anomalies.slice(0, 3).map((a) => (
                  <Text key={a.date} style={{ fontSize: 12, color: brand.textPrimary }}>
                    {a.date}: {a.kind.toUpperCase()} ({formatTzs(a.revenue, { compact: true })}, z={a.zScore})
                  </Text>
                ))}
              </View>
            )}
          </View>
        </>
      )}

      {activeTab === "products" && (
        <>
          <View style={cardStyle}>
            <Text style={{ fontSize: 10, fontWeight: "800", letterSpacing: 1, color: brand.accent }}>
              ABC-XYZ MARGIN & VOLATILITY MATRIX
            </Text>
            {abcXyzList.length === 0 ? (
              <Text style={{ fontSize: 12, color: brand.textMuted }}>More sales needed for ABC-XYZ clustering.</Text>
            ) : (
              abcXyzList.slice(0, 10).map((cell) => (
                <View
                  key={cell.productId}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingVertical: 5,
                    borderBottomWidth: 1,
                    borderBottomColor: brand.borderColor,
                  }}
                >
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: brand.textPrimary }} numberOfLines={1}>
                      {cell.brandName}
                    </Text>
                    <Text style={{ fontSize: 11, color: brand.textMuted }} numberOfLines={1}>
                      {cell.strategyHint} · CV {cell.cv}
                    </Text>
                  </View>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.md, backgroundColor: brand.accentSoft }}>
                    <Text style={{ fontSize: 11, fontWeight: "800", color: brand.accent }}>
                      {cell.segment} · {cell.revenueSharePct}%
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {affinities.length > 0 && (
            <View style={cardStyle}>
              <Text style={{ fontSize: 10, fontWeight: "800", letterSpacing: 1, color: brand.teal }}>
                CROSS-SELL COMPANION PAIRS
              </Text>
              {affinities.slice(0, 6).map((aff) => (
                <View key={`${aff.aId}-${aff.bId}`} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ flex: 1, fontSize: 13, color: brand.textPrimary }} numberOfLines={1}>
                    {aff.aName} + {aff.bName}
                  </Text>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: brand.teal }}>
                    {aff.confidencePct}% ({aff.lift}x)
                  </Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      {activeTab === "stock" && (
        <>
          <View style={cardStyle}>
            <Text style={{ fontSize: 10, fontWeight: "800", letterSpacing: 1, color: brand.warning }}>
              EXPIRY EXPOSURE & STOCK VALUATION
            </Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 13, color: brand.textSecondary }}>Inventory at Cost</Text>
              <Text style={{ fontWeight: "700", color: brand.textPrimary }}>{formatTzs(stock.atCost)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 13, color: brand.textSecondary }}>Inventory at Retail</Text>
              <Text style={{ fontWeight: "700", color: brand.accent }}>{formatTzs(stock.atRetail)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 13, color: brand.textSecondary }}>Expiring &le;30d ({stock.expiring30Units} packs)</Text>
              <Text style={{ fontWeight: "700", color: brand.warning }}>{formatTzs(stock.expiring30Cost)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 13, color: brand.textSecondary }}>Expired Lots / Low Stock Lots</Text>
              <Text style={{ fontWeight: "700", color: brand.danger }}>
                {stock.expiredCount} / {stock.lowStockCount}
              </Text>
            </View>
          </View>

          <View style={cardStyle}>
            <Text style={{ fontSize: 10, fontWeight: "800", letterSpacing: 1, color: brand.accent }}>
              DYNAMIC REORDER URGENCY & SAFETY STOCK
            </Text>
            {urgencyList.slice(0, 8).map((u) => {
              const safety = safetyStockList.find((s) => s.productId === u.productId);
              const badgeColor =
                u.tier === "urgent" ? brand.danger : u.tier === "soon" ? brand.warning : brand.success;
              return (
                <View
                  key={u.productId}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingVertical: 5,
                    borderBottomWidth: 1,
                    borderBottomColor: brand.borderColor,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: brand.textPrimary }} numberOfLines={1}>
                      {u.brandName}
                    </Text>
                    <Text style={{ fontSize: 11, color: brand.textMuted }}>
                      Score {u.score}
                      {safety ? ` · ROP ${safety.reorderPointUnits} (${safety.currentValidQty} valid)` : ""}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: badgeColor, textTransform: "uppercase" }}>
                    {u.tier} {u.suggestedQty > 0 ? `+${u.suggestedQty}` : ""}
                  </Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      {activeTab === "people" && (
        <>
          <View style={cardStyle}>
            <Text style={{ fontSize: 10, fontWeight: "800", letterSpacing: 1, color: brand.accent }}>
              DISPENSARY STAFF LEADERBOARD
            </Text>
            {staffLeaderboard.length === 0 ? (
              <Text style={{ fontSize: 12, color: brand.textMuted }}>No staff sales recorded in window.</Text>
            ) : (
              staffLeaderboard.map((st, idx) => (
                <View key={st.name} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: brand.textPrimary }}>
                    #{idx + 1} {st.name}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: brand.accent }}>
                    {st.count} tx · {formatTzs(st.revenue, { compact: true })}
                  </Text>
                </View>
              ))
            )}
          </View>

          {(workspace?.orgBranchComparison?.length ?? 0) > 0 && (
            <View style={cardStyle}>
              <Text style={{ fontSize: 10, fontWeight: "800", letterSpacing: 1, color: brand.teal }}>
                BRANCH COMPARISON (30D)
              </Text>
              {(workspace?.orgBranchComparison ?? []).map((br) => (
                <View key={br.centreId} style={{ paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: brand.borderColor }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: brand.textPrimary }}>
                      {br.name} ({br.region})
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: brand.accent }}>
                      {formatTzs(br.revenue30dTzs, { compact: true })}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: brand.textMuted }}>
                    Margin {formatTzs(br.grossProfit30dTzs, { compact: true })} · {br.txCount30d} tx · {br.stockUnits} packs
                  </Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      {activeTab === "procurement" && (
        <View style={cardStyle}>
          <Text style={{ fontSize: 10, fontWeight: "800", letterSpacing: 1, color: brand.accent }}>
            OPERATING EXPENSES BY CATEGORY ({days}D)
          </Text>
          {expenseByCategory.length === 0 ? (
            <Text style={{ fontSize: 12, color: brand.textMuted }}>No operating expenses logged yet.</Text>
          ) : (
            expenseByCategory.map((row) => (
              <View key={row.category} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 13, color: brand.textPrimary }}>{row.category}</Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: brand.danger }}>-{formatTzs(row.amount)}</Text>
              </View>
            ))
          )}
        </View>
      )}

      {activeTab === "my_perf" && (
        <View style={cardStyle}>
          <Text style={{ fontSize: 10, fontWeight: "800", letterSpacing: 1, color: brand.accent }}>
            MY COUNTER PERFORMANCE ({workspace?.activeProfile?.displayName || "Operator"})
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 13, color: brand.textSecondary }}>Receipts Processed</Text>
            <Text style={{ fontWeight: "800", color: brand.textPrimary }}>{mySales.count}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 13, color: brand.textSecondary }}>Total Sales Settled</Text>
            <Text style={{ fontWeight: "800", color: brand.accent }}>{formatTzs(mySales.revenue)}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 13, color: brand.textSecondary }}>Average Basket Value</Text>
            <Text style={{ fontWeight: "800", color: brand.success }}>{formatTzs(mySales.avgBasket)}</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
