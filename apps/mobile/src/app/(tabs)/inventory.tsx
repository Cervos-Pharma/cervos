import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { formatTzs, matchCatalogByBarcode, normalizeBarcode, parseScanIntent } from "@cervos/core";
import { PlatformIcon } from "@/components/platform-icon";
import { EmptyStateCard } from "@/components/state-views";
import { useMobileSession } from "@/context/session-context";
import { playSoundCue, triggerHaptic } from "@/services/sounds";
import { colors, radius, spacing, typography, useBrandColors } from "@/theme";
import type { WorkspaceBatch } from "@/types/workspace";
import { computeStockHealth, todayIsoDay } from "@/utils/intelligence";

type StockFilter = "all" | "expiring" | "low" | "blocked";

export default function InventoryScreen() {
  const router = useRouter();
  const {
    workspace,
    cloudCatalog,
    lang,
    capabilities,
    scopedBatches,
    scopedSales,
    pendingScannedCode,
    setPendingScannedCode,
    pendingScanContext,
    setPendingScanContext,
    runOnlineOrQueue,
  } = useMobileSession();
  const brand = useBrandColors(workspace?.account?.customization?.brandAccent);
  const isSw = lang === "SW";
  const todayIso = todayIsoDay();
  const in30Iso = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const listRef = useRef<FlatList<WorkspaceBatch>>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StockFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [highlightedBatchId, setHighlightedBatchId] = useState<string | null>(null);
  const [scanBanner, setScanBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingScannedCode || pendingScanContext !== "inventory") return;
    const code = pendingScannedCode;
    setPendingScannedCode(null);
    setPendingScanContext(null);

    const intent = parseScanIntent(code);
    if (intent.kind === "receipt") {
      const targetSale = (workspace?.sales ?? scopedSales).find(
        (s) =>
          (intent.saleId && s.id === intent.saleId) ||
          (s.receiptNumber && s.receiptNumber.toUpperCase() === intent.receiptNumber.toUpperCase())
      );
      if (targetSale) {
        router.push(`/receipt-sheet?saleId=${encodeURIComponent(targetSale.id)}`);
      } else {
        router.push("/(tabs)/receipts");
      }
      return;
    }

    const cloudHit = matchCatalogByBarcode(cloudCatalog, code);
    const gtin =
      intent.kind === "gs1" ? intent.gtin : intent.kind === "barcode" ? intent.code : null;
    const normGtin = gtin ? normalizeBarcode(gtin) : null;
    const lower = code.trim().toLowerCase();

    const batchMatch = scopedBatches.find(
      (b) =>
        (intent.kind === "lot" && b.batchNumber.toLowerCase() === intent.batchNumber.toLowerCase()) ||
        (intent.kind === "gs1" &&
          intent.batchNumber &&
          b.batchNumber.toLowerCase() === intent.batchNumber.toLowerCase()) ||
        (normGtin && b.barcode && normalizeBarcode(b.barcode) === normGtin) ||
        (cloudHit &&
          (b.productId === cloudHit.masterId ||
            b.productId === cloudHit.id ||
            b.brandName.toLowerCase() === cloudHit.brandName.toLowerCase() ||
            b.genericName.toLowerCase() === cloudHit.inn.toLowerCase())) ||
        b.batchNumber.toLowerCase() === lower ||
        b.productId.toLowerCase() === lower
    );

    if (batchMatch) {
      setFilter("all");
      setSearch(batchMatch.batchNumber);
      setHighlightedBatchId(batchMatch.id);
      setScanBanner(
        isSw
          ? `Kundi limepatikana: ${batchMatch.brandName} (${batchMatch.batchNumber})`
          : `Located ${batchMatch.brandName} · Lot ${batchMatch.batchNumber}`
      );
      void playSoundCue("scan");
      void triggerHaptic("success");
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      });
      return;
    }

    // Not stocked in this branch yet -> prefill new batch intake from Cloud Catalog / GS1
    void playSoundCue("notify");
    void triggerHaptic("light");
    router.push(`/batch-sheet?barcode=${encodeURIComponent(code)}`);
  }, [
    pendingScannedCode,
    pendingScanContext,
    setPendingScannedCode,
    setPendingScanContext,
    cloudCatalog,
    scopedBatches,
    scopedSales,
    workspace?.sales,
    isSw,
    router,
  ]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedBatches.filter((b) => {
      if (q) {
        const hit =
          b.brandName.toLowerCase().includes(q) ||
          b.genericName.toLowerCase().includes(q) ||
          b.batchNumber.toLowerCase().includes(q) ||
          b.category.toLowerCase().includes(q) ||
          (b.barcode || "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (filter === "expiring") return !b.quarantined && b.expiryDate >= todayIso && b.expiryDate <= in30Iso;
      if (filter === "low") return !b.quarantined && b.quantity <= (b.lowStockThreshold ?? 15);
      if (filter === "blocked") return b.quarantined || b.expiryDate < todayIso;
      return true;
    });
  }, [scopedBatches, search, filter, todayIso, in30Iso]);

  const adjustQty = async (batchId: string, delta: number) => {
    setBusyId(batchId);
    try {
      const out = await runOnlineOrQueue(
        { action: "manage_batch", subAction: "adjust_qty", batchId, delta },
        { type: "adjust_qty", payload: { batchId, delta } }
      );
      if (out.ok) {
        void playSoundCue("tap");
        void triggerHaptic("light");
      } else {
        void playSoundCue("alert");
      }
    } finally {
      setBusyId(null);
    }
  };

  const toggleQuarantine = async (batchId: string) => {
    setBusyId(batchId);
    try {
      const out = await runOnlineOrQueue(
        { action: "manage_batch", subAction: "toggle_quarantine", batchId },
        { type: "toggle_quarantine", payload: { batchId } }
      );
      if (out.ok) {
        void playSoundCue("switch");
        void triggerHaptic("medium");
      } else {
        void playSoundCue("alert");
      }
    } finally {
      setBusyId(null);
    }
  };

  const stockVal = useMemo(() => computeStockHealth(scopedBatches, todayIso), [scopedBatches, todayIso]);

  return (
    <View style={{ flex: 1, backgroundColor: brand.canvasBg }}>
      <View
        style={{
          paddingTop: 54,
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.sm,
          backgroundColor: brand.cardBg,
          borderBottomWidth: 1,
          borderBottomColor: brand.borderColor,
          gap: spacing.sm,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={typography.title}>{isSw ? "Stoo ya Dawa" : "Inventory"}</Text>
          {capabilities.canEditInventory && (
            <Pressable
              onPress={() => router.push("/batch-sheet")}
              style={{
                paddingHorizontal: 14,
                height: 36,
                borderRadius: radius.full,
                backgroundColor: brand.accent,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <PlatformIcon sf="plus" md="add" color={colors.onTint} size={16} />
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.onTint }}>
                {isSw ? "Ongeza" : "Add Stock"}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          <TextInput
            value={search}
            onChangeText={(t) => {
              setSearch(t);
              if (highlightedBatchId) setHighlightedBatchId(null);
              if (scanBanner) setScanBanner(null);
            }}
            placeholder={isSw ? "Tafuta dawa, kundi au msimbopau..." : "Search brand, lot #, barcode..."}
            placeholderTextColor={colors.tertiaryLabel as string}
            style={{
              flex: 1,
              minHeight: 42,
              borderRadius: radius.md,
              borderCurve: "continuous",
              backgroundColor: colors.tertiaryBackground,
              paddingHorizontal: spacing.md,
              color: colors.label,
              fontSize: 14,
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scan Barcode"
            onPress={() => {
              setPendingScanContext("inventory");
              router.push("/scanner-modal?target=inventory");
            }}
            style={{
              height: 42,
              paddingHorizontal: 12,
              borderRadius: radius.md,
              borderCurve: "continuous",
              backgroundColor: brand.accentSoft,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <PlatformIcon sf="barcode.viewfinder" md="qr-code-scanner" color={brand.accent} size={18} />
            <Text style={{ fontSize: 12, fontWeight: "700", color: brand.accent }}>
              {isSw ? "Skani" : "Scan Barcode"}
            </Text>
          </Pressable>
        </View>

        {scanBanner && (
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: radius.md,
              backgroundColor: brand.successSoft,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing.xs,
            }}
          >
            <Text style={{ flex: 1, fontSize: 12, fontWeight: "700", color: brand.success }}>
              {scanBanner}
            </Text>
            <Pressable
              onPress={() => {
                setScanBanner(null);
                setHighlightedBatchId(null);
                setSearch("");
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: brand.accent }}>
                {isSw ? "Futa" : "Clear"}
              </Text>
            </Pressable>
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
          {(
            [
              { id: "all", label: isSw ? "Zote" : "All" },
              { id: "expiring", label: isSw ? "Inaisha <=30s" : "Expiring <=30d" },
              { id: "low", label: isSw ? "Kidogo" : "Low Stock" },
              { id: "blocked", label: isSw ? "Zilizozuiwa" : "Blocked" },
            ] as const
          ).map((f) => {
            const active = filter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f.id)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: radius.full,
                  backgroundColor: active ? brand.accent : colors.tertiaryBackground,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: active ? colors.onTint : colors.secondaryLabel,
                  }}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Web-Parity Stock Valuation & Risk Summary Bar */}
        <View style={{ flexDirection: "row", gap: 6 }}>
          <View style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md, backgroundColor: brand.cardSubtleBg, borderWidth: 1, borderColor: brand.borderColor }}>
            <Text style={{ fontSize: 10, color: brand.textMuted }}>AT COST</Text>
            <Text style={{ fontSize: 12, fontWeight: "800", color: brand.textPrimary }}>
              {formatTzs(stockVal.atCost, { compact: true })}
            </Text>
          </View>
          <View style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md, backgroundColor: brand.cardSubtleBg, borderWidth: 1, borderColor: brand.borderColor }}>
            <Text style={{ fontSize: 10, color: brand.textMuted }}>RETAIL VALUE</Text>
            <Text style={{ fontSize: 12, fontWeight: "800", color: brand.accent }}>
              {formatTzs(stockVal.atRetail, { compact: true })}
            </Text>
          </View>
          <View style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md, backgroundColor: brand.cardSubtleBg, borderWidth: 1, borderColor: brand.borderColor }}>
            <Text style={{ fontSize: 10, color: brand.textMuted }}>EXP &le;30D</Text>
            <Text style={{ fontSize: 12, fontWeight: "800", color: stockVal.expiring30Units > 0 ? brand.warning : brand.success }}>
              {stockVal.expiring30Units} pcs
            </Text>
          </View>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: 40 }}
        ListEmptyComponent={
          <EmptyStateCard
            sf="shippingbox"
            md="inventory-2"
            title={isSw ? "Hakuna makundi yaliyoonekana" : "No stock lots matched"}
            description={
              isSw
                ? "Bonyeza Ongeza kupokea mzigo mpya wa dawa."
                : "Tap Add Stock to receive a batch with automatic brand details."
            }
            actionLabel={capabilities.canEditInventory ? (isSw ? "Ongeza Mzigo" : "Add Stock Batch") : undefined}
            onAction={capabilities.canEditInventory ? () => router.push("/batch-sheet") : undefined}
          />
        }
        renderItem={({ item }) => {
          const isExpired = item.expiryDate < todayIso;
          const isSoon = !isExpired && item.expiryDate <= in30Iso;
          const isBusy = busyId === item.id;
          const isHighlighted = highlightedBatchId === item.id;
          return (
            <View
              style={{
                padding: spacing.md,
                borderRadius: radius.xl,
                borderCurve: "continuous",
                backgroundColor: colors.secondaryGroupedBackground,
                borderWidth: isHighlighted ? 1.5 : 0,
                borderColor: isHighlighted ? brand.accent : "transparent",
                gap: spacing.xs,
                opacity: isBusy ? 0.6 : 1,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.sm }}>
                <Pressable
                  onPress={() => router.push(`/batch-detail?id=${encodeURIComponent(item.id)}`)}
                  style={{ flex: 1 }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={[typography.headline, { flexShrink: 1 }]}>{item.brandName}</Text>
                    <PlatformIcon sf="qrcode" md="qr-code-2" color={brand.accent} size={15} />
                  </View>
                  <Text style={typography.caption}>
                    {item.genericName} · {item.category} · Lot {item.batchNumber}
                  </Text>
                </Pressable>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: radius.full,
                    backgroundColor:
                      isExpired || item.quarantined
                        ? brand.dangerSoft
                        : isSoon
                          ? brand.warningSoft
                          : brand.successSoft,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color:
                        isExpired || item.quarantined
                          ? brand.danger
                          : isSoon
                            ? brand.warning
                            : brand.success,
                    }}
                  >
                    {item.quarantined
                      ? "Quarantined"
                      : isExpired
                        ? "Expired"
                        : `Exp ${item.expiryDate}`}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.label }}>
                  {item.quantity} packs · {formatTzs(item.salePriceTzs)}
                </Text>

                {capabilities.canEditInventory && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Pressable
                      onPress={() => void adjustQty(item.id, -1)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: radius.md,
                        backgroundColor: colors.tertiaryBackground,
                      }}
                    >
                      <Text style={{ fontWeight: "700", color: colors.label }}>-1</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void adjustQty(item.id, 1)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: radius.md,
                        backgroundColor: colors.tertiaryBackground,
                      }}
                    >
                      <Text style={{ fontWeight: "700", color: colors.label }}>+1</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void toggleQuarantine(item.id)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: radius.md,
                        backgroundColor: item.quarantined ? brand.successSoft : brand.warningSoft,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: item.quarantined ? brand.success : brand.warning,
                        }}
                      >
                        {item.quarantined ? "Release" : "Hold"}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}
