import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import {
  classifyReorderUrgency,
  detectSalesAnomalies,
  formatTzs,
  holtLinearForecast,
  linearTrendRegression,
  predictCounterStaffingWindows,
} from "@cervos/core";
import { BranchSwitcherSheet } from "@/components/branch-switcher-sheet";
import {
  GlobalQuickJumpBar,
  NotificationsSheetModal,
} from "@/components/cervos-ui/GlobalSearchAndAlerts";
import {
  RevenuePulseChart,
  type ChartBarPoint,
} from "@/components/cervos-ui/RevenuePulseChart";
import { StationSpotlightCard } from "@/components/cervos-ui/StationSpotlightCard";
import { PlatformIcon } from "@/components/platform-icon";
import { ShiftLaunchBanner } from "@/components/shift-banner";
import { ErrorBanner, WorkspaceSkeleton } from "@/components/state-views";
import { useMobileSession } from "@/context/session-context";
import { postWorkspaceAction } from "@/services/api";
import { playSoundCue, triggerHaptic } from "@/services/sounds";
import { radius, spacing, useBrandColors } from "@/theme";
import {
  buildDailyRevenueSeries,
  buildMlProducts,
  computeStockHealth,
  summarizeBranchPnl,
  todayIsoDay,
} from "@/utils/intelligence";

export default function HomeOverviewScreen() {
  const router = useRouter();
  const {
    workspace,
    isLoading,
    isFetching,
    loadError,
    lang,
    isOnline,
    pendingSync,
    syncing,
    canManageAdmin,
    orgScope,
    activeCentre,
    scopedBatches,
    scopedSales,
    scopedExpenses,
    activeShift,
    updatePrefs,
    refreshState,
    syncNow,
    switchCentre,
  } = useMobileSession();

  const accentHex = workspace?.account?.customization?.brandAccent;
  const brand = useBrandColors(accentHex);
  const [branchSheetOpen, setBranchSheetOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [hqReplyOpen, setHqReplyOpen] = useState(false);
  const [hqReplyText, setHqReplyText] = useState("");
  const [hqReplyBusy, setHqReplyBusy] = useState(false);
  const [hqReplyNotice, setHqReplyNotice] = useState<string | null>(null);

  const isSw = lang === "SW";
  const todayIso = todayIsoDay();
  const unreadNotifs = (workspace?.notifications ?? []).filter((n) => !n.read).length;

  const edgePulse = useMemo(() => {
    const series30 = buildDailyRevenueSeries(scopedSales, 30);
    const holt = holtLinearForecast(series30, 7);
    const trend = linearTrendRegression(series30);
    const anomalies = detectSalesAnomalies(series30, 3.0);
    const peaks = predictCounterStaffingWindows(scopedSales);
    const mlProducts = buildMlProducts(scopedSales, scopedBatches);
    const urgentReorders = classifyReorderUrgency(mlProducts)
      .filter((r) => r.tier === "urgent" || r.tier === "soon")
      .slice(0, 3);
    const chartPoints: ChartBarPoint[] = [
      ...series30.slice(-7).map((pt) => ({
        label: pt.date.slice(8),
        sublabel: pt.date,
        value: pt.revenue,
        isForecast: false,
      })),
      ...holt.slice(0, 5).map((pt) => ({
        label: `+${pt.date.slice(8)}`,
        sublabel: pt.date,
        value: pt.predicted,
        isForecast: true,
      })),
    ];
    return {
      forecast7Total: holt.reduce((s, p) => s + p.predicted, 0),
      trend,
      anomaliesCount: anomalies.length,
      peakWindow: peaks[0],
      urgentReorders,
      chartPoints,
    };
  }, [scopedBatches, scopedSales]);

  if (isLoading && !workspace) {
    return (
      <View style={{ flex: 1, backgroundColor: brand.canvasBg, padding: spacing.md, paddingTop: 64 }}>
        <WorkspaceSkeleton />
      </View>
    );
  }

  const pnl = summarizeBranchPnl(scopedSales, scopedExpenses, 30);
  const stock = computeStockHealth(scopedBatches, todayIso);
  const todayRevenue = scopedSales
    .filter((s) => s.createdAt.slice(0, 10) === todayIso)
    .reduce((sum, s) => sum + s.totalTzs, 0);
  const escrowHeldTzs = (workspace?.wholesaleOrders ?? [])
    .filter((o) => o.escrowStatus === "escrow_held")
    .reduce((sum, o) => sum + o.totalTzs, 0);
  const validLotsCount = scopedBatches.filter((b) => !b.quarantined && b.expiryDate >= todayIso && b.quantity > 0).length;

  const unreadHq = (workspace?.hqMessages ?? []).filter((m) => !m.acknowledged);
  const scale = brand.fontMult;

  const cardSurface = {
    padding: spacing.md,
    borderRadius: radius.xl,
    borderCurve: "continuous" as const,
    backgroundColor: brand.cardBg,
    borderWidth: 1,
    borderColor: brand.borderColor,
  };

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: brand.canvasBg }}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 44 }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching || syncing}
            onRefresh={() => {
              void syncNow();
            }}
          />
        }
      >
        {/* Top Cervos Web-Style Architectural Station Bar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: spacing.xs,
            paddingTop: spacing.xs,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
            <Image
              source={
                workspace?.account?.customization?.brandLogoUrl
                  ? { uri: workspace.account.customization.brandLogoUrl }
                  : require("../../../assets/images/icon.png")
              }
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: brand.borderColor,
              }}
              contentFit="cover"
            />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 10 * scale,
                  fontWeight: "700",
                  letterSpacing: 0.9,
                  color: brand.textMuted,
                  textTransform: "uppercase",
                }}
                numberOfLines={1}
              >
                {workspace?.account?.orgName || "CERVOS PHARMA"}
              </Text>
              <Pressable
                onPress={() => {
                  if (canManageAdmin || (workspace?.centres?.length ?? 0) > 1) {
                    setBranchSheetOpen(true);
                  }
                }}
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Text
                  style={{ fontSize: 19 * scale, fontWeight: "800", color: brand.textPrimary }}
                  numberOfLines={1}
                >
                  {orgScope === "all" && canManageAdmin
                    ? isSw ? "Matawi Yote" : "All Branches"
                    : activeCentre?.name || "Primary Branch"}
                </Text>
                {(canManageAdmin || (workspace?.centres?.length ?? 0) > 1) && (
                  <PlatformIcon sf="chevron.down" md="keyboard-arrow-down" color={brand.accent} size={18} />
                )}
              </Pressable>
            </View>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {/* Manual Light / Dark Theme Toggle (Matches Web Header) */}
            <Pressable
              accessibilityLabel="Toggle light/dark theme"
              onPress={() => {
                const nextMode = brand.isDark ? "light" : "dark";
                updatePrefs({ themePref: nextMode });
                void triggerHaptic("selection");
                void postWorkspaceAction({ action: "update_profile_settings", themePref: nextMode }).catch(() => undefined);
              }}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: brand.cardBg,
                borderWidth: 1,
                borderColor: brand.borderColor,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <PlatformIcon
                sf={brand.isDark ? "sun.max.fill" : "moon.fill"}
                md={brand.isDark ? "light-mode" : "dark-mode"}
                color={brand.textPrimary}
                size={16}
              />
            </Pressable>

            {/* Notifications Bell */}
            <Pressable
              accessibilityLabel="Open Notifications"
              onPress={() => setNotificationsOpen(true)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: brand.cardBg,
                borderWidth: 1,
                borderColor: unreadNotifs > 0 ? brand.accent : brand.borderColor,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <PlatformIcon
                sf="bell.fill"
                md="notifications"
                color={unreadNotifs > 0 ? brand.accent : brand.textPrimary}
                size={16}
              />
              {unreadNotifs > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: brand.limeBadgeBg,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 3,
                  }}
                >
                  <Text style={{ fontSize: 9, fontWeight: "800", color: brand.limeBadgeInk }}>
                    {unreadNotifs > 9 ? "9+" : unreadNotifs}
                  </Text>
                </View>
              )}
            </Pressable>

            {/* Live Online / Offline Sync Pill */}
            <Pressable
              onPress={() => void syncNow()}
              style={{
                paddingHorizontal: 10,
                height: 36,
                borderRadius: radius.full,
                backgroundColor: isOnline ? brand.successSoft : brand.warningSoft,
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
              }}
            >
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: isOnline ? brand.success : brand.warning,
                }}
              />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: isOnline ? brand.success : brand.warning,
                }}
              >
                {syncing
                  ? "Sync"
                  : pendingSync > 0
                    ? `${pendingSync}`
                    : isOnline
                      ? "Live"
                      : "Offline"}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Global Quick-Jump Search Bar (Mirrors Web WorkspaceShell) */}
        <GlobalQuickJumpBar
          centres={workspace?.centres ?? []}
          batches={workspace?.batches ?? []}
          sales={workspace?.sales ?? []}
          profiles={workspace?.profiles ?? []}
          isSw={isSw}
          accentHex={accentHex}
          onSelectBranch={(cid) => void switchCentre(cid)}
        />

        {loadError && (
          <ErrorBanner
            message={loadError}
            onRetry={() => {
              void refreshState();
            }}
          />
        )}

        {/* Prominent Shift Prompt on Launch */}
        <ShiftLaunchBanner />

        {/* Web-Parity 2x2 Architectural Bento KPI Grid */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          <View style={[cardSurface, { flexBasis: "48%", flexGrow: 1, gap: 4 }]}>
            <Text style={{ fontSize: 12 * scale, color: brand.textSecondary }}>
              {isSw ? "Mauzo Leo" : "Today's Sales"}
            </Text>
            <Text style={{ fontSize: 20 * scale, fontWeight: "800", color: brand.textPrimary }}>
              {formatTzs(todayRevenue, { compact: true })}
            </Text>
            <Text style={{ fontSize: 11, color: brand.success, fontWeight: "700" }}>
              {scopedSales.length} {isSw ? "risiti (30s)" : "sales (30d)"}
            </Text>
          </View>

          <View style={[cardSurface, { flexBasis: "48%", flexGrow: 1, gap: 4 }]}>
            <Text style={{ fontSize: 12 * scale, color: brand.textSecondary }}>
              {isSw ? "Faida Halisi (30s)" : "30d Net Profit"}
            </Text>
            <Text style={{ fontSize: 20 * scale, fontWeight: "800", color: brand.success }}>
              {formatTzs(pnl.netProfit, { compact: true })}
            </Text>
            <Text style={{ fontSize: 11, color: brand.textMuted }}>{pnl.grossMarginPct}% gross margin</Text>
          </View>

          <View style={[cardSurface, { flexBasis: "48%", flexGrow: 1, gap: 4 }]}>
            <Text style={{ fontSize: 12 * scale, color: brand.textSecondary }}>
              {isSw ? "Thamani ya Stoo" : "Stock Retail"}
            </Text>
            <Text style={{ fontSize: 20 * scale, fontWeight: "800", color: brand.textPrimary }}>
              {formatTzs(stock.atRetail, { compact: true })}
            </Text>
            <Text style={{ fontSize: 11, color: brand.textMuted }}>{scopedBatches.length} active lots</Text>
          </View>

          <View style={[cardSurface, { flexBasis: "48%", flexGrow: 1, gap: 4 }]}>
            <Text style={{ fontSize: 12 * scale, color: brand.textSecondary }}>
              {isSw ? "Zinaisha <=30s" : "Expiring <=30d"}
            </Text>
            <Text
              style={{
                fontSize: 20 * scale,
                fontWeight: "800",
                color: stock.expiring30Units > 0 ? brand.warning : brand.success,
              }}
            >
              {stock.expiring30Units} packs
            </Text>
            <Text style={{ fontSize: 11, color: brand.textMuted }}>
              {formatTzs(stock.expiring30Cost, { compact: true })} at cost
            </Text>
          </View>
        </View>

        {/* Visual Revenue Pulse & Holt 7d Forecast Chart */}
        <RevenuePulseChart
          title={isSw ? "Mtiririko wa Mauzo & Utabiri" : "7-Day Revenue Pulse + Holt Forecast"}
          points={edgePulse.chartPoints}
          accentHex={accentHex}
        />

        {/* HQ Messages Strip + Owner Reply */}
        {unreadHq.length > 0 && (
          <View
            style={[
              cardSurface,
              {
                backgroundColor: brand.accentSoft,
                borderColor: brand.accent,
                gap: spacing.xs,
              },
            ]}
          >
            <Text style={{ fontSize: 10, fontWeight: "800", letterSpacing: 1, color: brand.accent }}>
              HQ NOTICE
            </Text>
            <Text style={{ fontSize: 16 * scale, fontWeight: "700", color: brand.textPrimary }}>
              {isSw ? unreadHq[0].swTitle : unreadHq[0].title}
            </Text>
            <Text style={{ fontSize: 13 * scale, color: brand.textSecondary }}>
              {isSw ? unreadHq[0].swBody : unreadHq[0].body}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
              <Pressable
                onPress={async () => {
                  await postWorkspaceAction({ action: "ack_hq_message", messageId: unreadHq[0].id });
                  await playSoundCue("tap");
                  await refreshState();
                }}
                style={{ paddingVertical: 6 }}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: brand.accent }}>
                  {isSw ? "Thibitisha Kusoma" : "Mark Read"}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setHqReplyOpen((cur) => !cur);
                  setHqReplyNotice(null);
                }}
                style={{ paddingVertical: 6 }}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: brand.textPrimary }}>
                  {isSw ? "Jibu HQ" : "Reply to HQ"}
                </Text>
              </Pressable>
            </View>

            {hqReplyOpen && (
              <View style={{ gap: spacing.xs, paddingTop: 4 }}>
                <TextInput
                  value={hqReplyText}
                  onChangeText={setHqReplyText}
                  placeholder={isSw ? "Andika ujumbe kwenda HQ..." : "Write a note to Cervos HQ..."}
                  placeholderTextColor={brand.textMuted}
                  style={{
                    minHeight: 40,
                    borderRadius: radius.md,
                    backgroundColor: brand.cardBg,
                    paddingHorizontal: spacing.sm,
                    color: brand.textPrimary,
                    fontSize: 14,
                  }}
                />
                <Pressable
                  disabled={hqReplyBusy}
                  onPress={async () => {
                    if (hqReplyText.trim().length < 3) return;
                    setHqReplyBusy(true);
                    try {
                      const res = await postWorkspaceAction({
                        action: "reply_hq_trail",
                        title: `Owner Reply (${workspace?.account?.orgName || "Branch"})`,
                        body: hqReplyText.trim(),
                      });
                      if (res.ok) {
                        setHqReplyText("");
                        setHqReplyOpen(false);
                        setHqReplyNotice(isSw ? "Ujumbe umetumwa kwa HQ." : "Reply sent to HQ.");
                        await playSoundCue("notify");
                        await refreshState();
                      }
                    } finally {
                      setHqReplyBusy(false);
                    }
                  }}
                  style={{
                    alignSelf: "flex-start",
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: radius.full,
                    backgroundColor: brand.accent,
                    opacity: hqReplyBusy ? 0.6 : 1,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#FFFFFF" }}>
                    {hqReplyBusy ? "..." : isSw ? "Tuma Kwenda HQ" : "Send HQ Reply"}
                  </Text>
                </Pressable>
              </View>
            )}
            {hqReplyNotice && (
              <Text style={{ fontSize: 12, fontWeight: "600", color: brand.success }}>{hqReplyNotice}</Text>
            )}
          </View>
        )}

        {/* Edge ML Pulse Card */}
        <Pressable onPress={() => router.push("/reports")} style={[cardSurface, { gap: spacing.xs }]}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 10, fontWeight: "800", letterSpacing: 1, color: brand.accent }}>
              {isSw ? "UFAHAMU WA EDGE ML" : "EDGE ML INTELLIGENCE"}
            </Text>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: radius.full,
                backgroundColor:
                  edgePulse.trend.direction === "rising"
                    ? brand.successSoft
                    : edgePulse.trend.direction === "cooling"
                      ? brand.warningSoft
                      : brand.accentSoft,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "700",
                  textTransform: "capitalize",
                  color:
                    edgePulse.trend.direction === "rising"
                      ? brand.success
                      : edgePulse.trend.direction === "cooling"
                        ? brand.warning
                        : brand.accent,
                }}
              >
                {edgePulse.trend.direction}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: brand.textSecondary }}>
                {isSw ? "Utabiri wa Siku 7 Zijazo" : "Holt 7-Day Revenue Forecast"}
              </Text>
              <Text style={{ fontSize: 18 * scale, fontWeight: "800", color: brand.textPrimary }}>
                {formatTzs(edgePulse.forecast7Total, { compact: true })}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 12, color: brand.textSecondary }}>
                {isSw ? "Saa ya Kilele" : "Peak Window"}
              </Text>
              <Text style={{ fontSize: 13, fontWeight: "700", color: brand.teal }}>
                {edgePulse.peakWindow ? edgePulse.peakWindow.hourLabel : "08:00 - 11:00"}
              </Text>
            </View>
          </View>

          {edgePulse.urgentReorders.length > 0 && (
            <Text style={{ fontSize: 12, fontWeight: "600", color: brand.warning }} numberOfLines={1}>
              {isSw ? "Agiza Mapema: " : "Restock Priority: "}
              {edgePulse.urgentReorders
                .map((r) => `${r.brandName}${r.suggestedQty > 0 ? ` (+${r.suggestedQty})` : ""}`)
                .join(" · ")}
            </Text>
          )}
        </Pressable>

        {/* Multi-Branch Comparison Cards (All Branches mode) */}
        {orgScope === "all" && (workspace?.orgBranchComparison?.length ?? 0) > 0 && (
          <View style={{ gap: spacing.xs }}>
            <Text style={{ fontSize: 10, fontWeight: "800", letterSpacing: 1, color: brand.accent }}>
              {isSw ? "ULINGANISHO WA MATAWI YOTE (30S)" : "MULTI-BRANCH PERFORMANCE (30D)"}
            </Text>
            {(workspace?.orgBranchComparison ?? []).map((br) => (
              <Pressable
                key={br.centreId}
                onPress={() => void switchCentre(br.centreId)}
                style={[cardSurface, { gap: 4 }]}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: brand.textPrimary }}>
                    {br.name} · {br.region}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: brand.accent }}>
                    {formatTzs(br.revenue30dTzs, { compact: true })}
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: brand.textMuted }}>
                  {br.txCount30d} tx · {formatTzs(br.grossProfit30dTzs, { compact: true })} margin ·{" "}
                  {br.stockUnits} packs
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* 3-Slide Web-Parity Station Spotlight Carousel & Interactive Map */}
        <StationSpotlightCard
          orgName={workspace?.account?.orgName || "Cervos Pharmacy"}
          brandLogoUrl={workspace?.account?.customization?.brandLogoUrl}
          centre={activeCentre}
          centres={workspace?.centres ?? []}
          profileName={workspace?.activeProfile?.displayName}
          todayRevenueTzs={todayRevenue}
          validLotsCount={validLotsCount}
          nearExpiryCount={stock.expiring30Units}
          escrowHeldTzs={escrowHeldTzs}
          isSw={isSw}
          accentHex={accentHex}
          onSelectCentre={(cid) => void switchCentre(cid)}
        />

        {/* Quick Operations Strip (Matches Web Sidebar Modules) */}
        <View style={{ gap: spacing.xs }}>
          <Text style={{ fontSize: 10, fontWeight: "800", letterSpacing: 1, color: brand.textMuted }}>
            {isSw ? "UENDESHAJI WA HARAKA" : "WORKSPACE MODULES"}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {[
              {
                label: isSw ? "Ripoti & ML" : "Reports & ML",
                sub: "7 Intelligence Tabs + PDF",
                route: "/reports",
                sf: "chart.bar.xaxis" as const,
                md: "insights" as const,
              },
              {
                label: isSw ? "Funga Zamu" : "Shift & Expenses",
                sub: activeShift ? "Close Drawer" : "P&L Ledger",
                route: "/shift-close",
                sf: "banknote.fill" as const,
                md: "payments" as const,
              },
              {
                label: isSw ? "Soga ya Tawi" : "Branch Chat",
                sub: `${(workspace?.branchMessages ?? []).length} notes`,
                route: "/branch-chat",
                sf: "bubble.left.and.bubble.right.fill" as const,
                md: "forum" as const,
              },
              {
                label: isSw ? "Jumla & Kasri" : "Wholesale B2B",
                sub: "Orders & GS1 GRN",
                route: "/wholesale",
                sf: "shippingbox.fill" as const,
                md: "local-shipping" as const,
              },
            ].map((item) => (
              <Pressable
                key={item.route}
                onPress={() => router.push(item.route as never)}
                style={[cardSurface, { flexBasis: "47%", flexGrow: 1, gap: 4 }]}
              >
                <PlatformIcon sf={item.sf} md={item.md} color={brand.accent} size={20} />
                <Text style={{ fontSize: 14 * scale, fontWeight: "700", color: brand.textPrimary }}>
                  {item.label}
                </Text>
                <Text style={{ fontSize: 11, color: brand.textMuted }}>{item.sub}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      <BranchSwitcherSheet
        isPresented={branchSheetOpen}
        onDismiss={() => setBranchSheetOpen(false)}
      />
      <NotificationsSheetModal
        visible={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        notifications={workspace?.notifications ?? []}
        isSw={isSw}
        accentHex={accentHex}
        onMarkAllRead={async () => {
          await postWorkspaceAction({ action: "mark_notifications_read" });
          await refreshState();
        }}
      />
    </>
  );
}
