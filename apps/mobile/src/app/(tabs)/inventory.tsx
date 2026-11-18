import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { formatTzs } from "@cervos/core";
import { PlatformIcon } from "@/components/platform-icon";
import { EmptyStateCard } from "@/components/state-views";
import { ContextualHint } from "@/components/onboarding";
import { useMobileSession } from "@/context/session-context";
import { postWorkspaceAction } from "@/services/api";
import { playSoundCue, triggerHaptic } from "@/services/sounds";
import { colors, radius, spacing, typography, useBrandColors } from "@/theme";
import { todayIsoDay } from "@/utils/intelligence";

type StockFilter = "all" | "expiring" | "low" | "blocked";

export default function InventoryScreen() {
  const router = useRouter();
  const { workspace, lang, capabilities, scopedBatches, refreshState } = useMobileSession();
  const brand = useBrandColors(workspace?.account?.customization?.brandAccent);
  const isSw = lang === "SW";
  const todayIso = todayIsoDay();
  const in30Iso = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StockFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedBatches.filter((b) => {
      if (q) {
        const hit =
          b.brandName.toLowerCase().includes(q) ||
          b.genericName.toLowerCase().includes(q) ||
          b.batchNumber.toLowerCase().includes(q) ||
          b.category.toLowerCase().includes(q);
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
      const res = await postWorkspaceAction({
        action: "manage_batch",
        subAction: "adjust_qty",
        batchId,
        delta,
      });
      if (res.ok) {
        void playSoundCue("tap");
        void triggerHaptic("light");
        await refreshState();
      }
    } finally {
      setBusyId(null);
    }
  };

  const toggleQuarantine = async (batchId: string) => {
    setBusyId(batchId);
    try {
      const res = await postWorkspaceAction({
        action: "manage_batch",
        subAction: "toggle_quarantine",
        batchId,
      });
      if (res.ok) {
        void playSoundCue("switch");
        void triggerHaptic("medium");
        await refreshState();
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.groupedBackground }}>
      <View
        style={{
          paddingTop: 54,
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.sm,
          backgroundColor: colors.secondaryGroupedBackground,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
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

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={isSw ? "Tafuta dawa, kundi au kategoria..." : "Search brand, lot # or category..."}
          placeholderTextColor={colors.tertiaryLabel as string}
          style={{
            minHeight: 42,
            borderRadius: radius.md,
            borderCurve: "continuous",
            backgroundColor: colors.tertiaryBackground,
            paddingHorizontal: spacing.md,
            color: colors.label,
            fontSize: 14,
          }}
        />

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
        <ContextualHint
          id="inventory-safety-v1"
          text={
            isSw
              ? "Dawa za kuisha mapema hutoka kwanza, na zilizokwisha muda au kuwekwa karantini huzuiwa POS."
              : "Earliest-expiry stock sells first automatically; expired or quarantined packs stay blocked at checkout."
          }
          accentColor={brand.accent}
          tintBackground={brand.accentSoft}
        />
      </View>

      <FlatList
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
          return (
            <View
              style={{
                padding: spacing.md,
                borderRadius: radius.xl,
                borderCurve: "continuous",
                backgroundColor: colors.secondaryGroupedBackground,
                gap: spacing.xs,
                opacity: isBusy ? 0.6 : 1,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={typography.headline}>{item.brandName}</Text>
                  <Text style={typography.caption}>
                    {item.genericName} · {item.category} · Lot {item.batchNumber}
                  </Text>
                </View>
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
