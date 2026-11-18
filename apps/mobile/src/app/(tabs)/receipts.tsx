import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { formatTzs } from "@cervos/core";
import { EmptyStateCard } from "@/components/state-views";
import { useMobileSession } from "@/context/session-context";
import { colors, radius, spacing, typography, useBrandColors } from "@/theme";

export default function ReceiptsVaultScreen() {
  const router = useRouter();
  const { workspace, lang, scopedSales } = useMobileSession();
  const brand = useBrandColors(workspace?.account?.customization?.brandAccent);
  const isSw = lang === "SW";
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return scopedSales;
    return scopedSales.filter(
      (s) =>
        (s.receiptNumber || s.id).toLowerCase().includes(q) ||
        (s.customerName || "").toLowerCase().includes(q) ||
        s.actorName.toLowerCase().includes(q) ||
        (s.lines ?? []).some((l) => l.brandName.toLowerCase().includes(q))
    );
  }, [scopedSales, search]);

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
          <Text style={typography.title}>{isSw ? "Risiti za Mauzo" : "Receipts Vault"}</Text>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: radius.full,
              backgroundColor: brand.successSoft,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: brand.success }}>
              Immutable
            </Text>
          </View>
        </View>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={isSw ? "Tafuta namba ya risiti au mteja..." : "Search receipt #, customer, or cashier..."}
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
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: 40 }}
        ListEmptyComponent={
          <EmptyStateCard
            sf="doc.text"
            md="receipt-long"
            title={isSw ? "Hakuna risiti bado" : "No receipts yet"}
            description={
              isSw
                ? "Risiti zote zinazotolewa kwenye Kaunta ya POS huhifadhiwa hapa."
                : "Completed counter sales appear here permanently and cannot be deleted."
            }
            actionLabel={isSw ? "Fungua Kaunta ya POS" : "Open Counter POS"}
            onAction={() => router.push("/(tabs)/pos")}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/receipt-sheet?saleId=${encodeURIComponent(item.id)}`)}
            style={({ pressed }) => ({
              padding: spacing.md,
              borderRadius: radius.xl,
              borderCurve: "continuous",
              backgroundColor: pressed
                ? colors.tertiaryBackground
                : colors.secondaryGroupedBackground,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing.sm,
            })}
          >
            <View style={{ flex: 1, gap: 3 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: brand.accent }}>
                  {item.receiptNumber || `RCP-${item.id.slice(-6).toUpperCase()}`}
                </Text>
                <Text style={typography.headline}>
                  {item.customerName || (isSw ? "Mteja wa Kaunta" : "Walk-in Patient")}
                </Text>
              </View>
              <Text style={typography.caption}>
                {item.itemCount} items · {item.paymentMethod.toUpperCase()} · {item.actorName} ·{" "}
                {item.createdAt.slice(0, 16).replace("T", " ")}
              </Text>
            </View>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.label }}>
              {formatTzs(item.totalTzs)}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}
