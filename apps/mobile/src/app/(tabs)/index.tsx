import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Host, List, ListItem } from "@expo/ui";
import { formatTzs } from "@cervos/core";
import { BranchSwitcherSheet } from "@/components/branch-switcher-sheet";
import { StationGuideModal, computeStationChecklist } from "@/components/onboarding";
import { PlatformIcon } from "@/components/platform-icon";
import { ShiftLaunchBanner } from "@/components/shift-banner";
import { ErrorBanner, WorkspaceSkeleton } from "@/components/state-views";
import { useMobileSession } from "@/context/session-context";
import { postWorkspaceAction } from "@/services/api";
import { hasSeenMobileTour, markMobileTourSeen } from "@/services/offline-db";
import { playSoundCue } from "@/services/sounds";
import { colors, radius, spacing, typography, useBrandColors } from "@/theme";
import { computeStockHealth, summarizeBranchPnl, todayIsoDay } from "@/utils/intelligence";

export default function HomeScreen() {
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
    capabilities,
    orgScope,
    activeCentre,
    scopedBatches,
    scopedSales,
    scopedExpenses,
    activeShift,
    refreshState,
    syncNow,
  } = useMobileSession();

  const accentHex = workspace?.account?.customization?.brandAccent;
  const brand = useBrandColors(accentHex);
  const [branchSheetOpen, setBranchSheetOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const profileId = workspace?.activeProfile?.id || "";
  const [tourDismissed, setTourDismissed] = useState<boolean>(() =>
    profileId ? hasSeenMobileTour(profileId) : false
  );

  const isSw = lang === "SW";
  const todayIso = todayIsoDay();

  if (!workspace && isLoading) {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: colors.groupedBackground }}
      >
        <WorkspaceSkeleton />
      </ScrollView>
    );
  }

  const pnl = summarizeBranchPnl(scopedSales, scopedExpenses, 30);
  const stock = computeStockHealth(scopedBatches, todayIso);
  const todayRevenue = scopedSales
    .filter((s) => s.createdAt.slice(0, 10) === todayIso)
    .reduce((sum, s) => sum + s.totalTzs, 0);

  const unreadHq = (workspace?.hqMessages ?? []).filter((m) => !m.acknowledged);
  const checklist = computeStationChecklist({
    lang,
    capabilities,
    activeShift: activeShift ?? null,
    batchCount: scopedBatches.length,
    saleCount: scopedSales.length,
  });
  const checklistDone = checklist.filter((i) => i.done).length;
  const showGettingStarted =
    Boolean(profileId) && !tourDismissed && !hasSeenMobileTour(profileId) && checklistDone < checklist.length;

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: colors.groupedBackground }}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching || syncing}
            onRefresh={() => {
              void syncNow();
            }}
          />
        }
      >
        {/* Top Station Identity & Branch Switcher */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: spacing.sm,
            paddingTop: spacing.xs,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
            <Image
              source={require("../../../assets/images/icon.png")}
              style={{ width: 32, height: 32, borderRadius: 10 }}
              contentFit="cover"
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={typography.overline}>
                {workspace?.account?.orgName || "CERVOS PHARMA"}
              </Text>
              <Pressable
                onPress={() => {
                  if (canManageAdmin || (workspace?.centres?.length ?? 0) > 1) {
                    setBranchSheetOpen(true);
                  }
                }}
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Text style={typography.title} numberOfLines={1}>
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

          <Pressable
            onPress={() => void syncNow()}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: radius.full,
              backgroundColor: isOnline ? brand.successSoft : brand.warningSoft,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: isOnline ? brand.success : brand.warning,
              }}
            />
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: isOnline ? brand.success : brand.warning,
              }}
            >
              {syncing
                ? "Syncing..."
                : pendingSync > 0
                  ? `${pendingSync} Pending`
                  : isOnline
                    ? "Synced"
                    : "Offline"}
            </Text>
          </Pressable>
        </View>

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

        {/* First-run Station Getting Started Strip */}
        {showGettingStarted && (
          <View
            style={{
              padding: spacing.md,
              borderRadius: radius.xl,
              borderCurve: "continuous",
              backgroundColor: colors.secondaryGroupedBackground,
              borderWidth: 1,
              borderColor: brand.staticBorder,
              gap: spacing.sm,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[typography.overline, { color: brand.accent }]}>
                {isSw ? `HATUA ZA KUANZA · ${checklistDone}/${checklist.length}` : `GETTING STARTED · ${checklistDone}/${checklist.length}`}
              </Text>
              <Pressable
                onPress={() => {
                  if (profileId) markMobileTourSeen(profileId);
                  setTourDismissed(true);
                }}
                hitSlop={8}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.secondaryLabel }}>
                  {isSw ? "Ficha" : "Dismiss"}
                </Text>
              </Pressable>
            </View>
            <Text style={typography.subhead}>
              {isSw
                ? "Jifunze jinsi zamu, kaunta safi ya POS, na soga ya tawi zinavyofanya kazi kwa dakika moja."
                : "Walk through launch shift check-in, clean Counter POS, hardware settings, and branch chat."}
            </Text>
            <View style={{ flexDirection: "row", gap: spacing.xs }}>
              <Pressable
                onPress={() => setTourOpen(true)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderRadius: radius.full,
                  backgroundColor: brand.accent,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.onTint }}>
                  {isSw ? "Anza Mwongozo" : "Take 1-Min Tour"}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* 2x2 Key Numbers Grid */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          <View
            style={{
              flexBasis: "48%",
              flexGrow: 1,
              padding: spacing.md,
              borderRadius: radius.xl,
              borderCurve: "continuous",
              backgroundColor: colors.secondaryGroupedBackground,
              borderWidth: 1,
              borderColor: brand.staticBorder,
              gap: 4,
            }}
          >
            <Text style={typography.caption}>{isSw ? "Mauzo Leo" : "Today's Sales"}</Text>
            <Text style={{ fontSize: 19, fontWeight: "700", color: colors.label }}>
              {formatTzs(todayRevenue, { compact: true })}
            </Text>
            <Text style={{ fontSize: 11, color: brand.success, fontWeight: "600" }}>
              {scopedSales.length} {isSw ? "risiti (30s)" : "sales (30d)"}
            </Text>
          </View>

          <View
            style={{
              flexBasis: "48%",
              flexGrow: 1,
              padding: spacing.md,
              borderRadius: radius.xl,
              borderCurve: "continuous",
              backgroundColor: colors.secondaryGroupedBackground,
              gap: 4,
            }}
          >
            <Text style={typography.caption}>{isSw ? "Faida Halisi" : "30d Net Profit"}</Text>
            <Text style={{ fontSize: 19, fontWeight: "700", color: brand.success }}>
              {formatTzs(pnl.netProfit, { compact: true })}
            </Text>
            <Text style={typography.caption}>{pnl.grossMarginPct}% gross margin</Text>
          </View>

          <View
            style={{
              flexBasis: "48%",
              flexGrow: 1,
              padding: spacing.md,
              borderRadius: radius.xl,
              borderCurve: "continuous",
              backgroundColor: colors.secondaryGroupedBackground,
              gap: 4,
            }}
          >
            <Text style={typography.caption}>{isSw ? "Thamani ya Stoo" : "Stock Retail"}</Text>
            <Text style={{ fontSize: 19, fontWeight: "700", color: colors.label }}>
              {formatTzs(stock.atRetail, { compact: true })}
            </Text>
            <Text style={typography.caption}>{scopedBatches.length} active lots</Text>
          </View>

          <View
            style={{
              flexBasis: "48%",
              flexGrow: 1,
              padding: spacing.md,
              borderRadius: radius.xl,
              borderCurve: "continuous",
              backgroundColor: colors.secondaryGroupedBackground,
              gap: 4,
            }}
          >
            <Text style={typography.caption}>{isSw ? "Zinaisha <=30s" : "Expiring <=30d"}</Text>
            <Text
              style={{
                fontSize: 19,
                fontWeight: "700",
                color: stock.expiring30Units > 0 ? brand.warning : brand.success,
              }}
            >
              {stock.expiring30Units} packs
            </Text>
            <Text style={typography.caption}>
              {stock.lowStockCount} low stock alerts
            </Text>
          </View>
        </View>

        {/* HQ Messages Strip */}
        {unreadHq.length > 0 && (
          <View
            style={{
              padding: spacing.md,
              borderRadius: radius.xl,
              borderCurve: "continuous",
              backgroundColor: brand.accentSoft,
              gap: spacing.xs,
            }}
          >
            <Text style={[typography.overline, { color: brand.accent }]}>HQ NOTICE</Text>
            <Text style={typography.headline}>
              {isSw ? unreadHq[0].swTitle : unreadHq[0].title}
            </Text>
            <Text style={typography.subhead}>
              {isSw ? unreadHq[0].swBody : unreadHq[0].body}
            </Text>
            <Pressable
              onPress={async () => {
                await postWorkspaceAction({ action: "ack_hq_message", messageId: unreadHq[0].id });
                await playSoundCue("tap");
                await refreshState();
              }}
              style={{ alignSelf: "flex-start", paddingVertical: 6 }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: brand.accent }}>
                {isSw ? "Thibitisha Kusoma" : "Mark Read"}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Native Grouped Station Actions */}
        <Host matchContents seedColor={brand.accent}>
          <List>
            {capabilities.canSellPos && (
              <ListItem
                supportingText={
                  isSw
                    ? "Uza dawa, skana msimbopau na toa risiti"
                    : "Scan items, collect payment, and print receipts"
                }
                onPress={() => router.push("/(tabs)/pos")}
              >
                {isSw ? "Fungua Kaunta ya POS" : "Open Counter POS"}
              </ListItem>
            )}
            {capabilities.canEditInventory && (
              <ListItem
                supportingText={
                  isSw
                    ? "Ongeza kundi jipya au jaza taarifa za dawa"
                    : "Add stock with category presets & autofill"
                }
                onPress={() => router.push("/batch-sheet")}
              >
                {isSw ? "Ongeza Mzigo Stooni" : "Receive New Stock Batch"}
              </ListItem>
            )}
            <ListItem
              supportingText={
                isSw
                  ? `Ujumbe wa tawi la ${activeCentre?.name || "Kituo"} pekee`
                  : `Private chat scoped inside ${activeCentre?.name || "this branch"}`
              }
              onPress={() => router.push("/branch-chat")}
            >
              {isSw ? "Soga ya Tawi" : "Open Branch Chat"}
            </ListItem>
            <ListItem
              supportingText={
                isSw
                  ? "Faida, utabiri wa siku 7, na hatari ya muda"
                  : "Profit & loss, 7-day forecast, and expiry report"
              }
              onPress={() => router.push("/reports")}
            >
              {isSw ? "Ripoti & Akili ya Biashara" : "Reports & Insights"}
            </ListItem>
            <ListItem
              supportingText={
                isSw
                  ? "Printa, sauti, PIN, na tiketi ya msaada"
                  : "Printer paper width, audio cues, PIN & support"
              }
              onPress={() => router.push("/settings")}
            >
              {isSw ? "Mipangilio ya Kituo" : "Settings & Hardware"}
            </ListItem>
          </List>
        </Host>
      </ScrollView>

      <BranchSwitcherSheet
        isPresented={branchSheetOpen}
        onDismiss={() => setBranchSheetOpen(false)}
      />
      <StationGuideModal
        isPresented={tourOpen}
        onClose={(markDone) => {
          setTourOpen(false);
          if (markDone && profileId) {
            markMobileTourSeen(profileId);
            setTourDismissed(true);
          }
        }}
      />
    </>
  );
}
