import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { formatTzs } from "../../lib/core";
import { useMobileSession } from "../../src/context/MobileSessionContext";
import { CERVOS_COLORS, TOUCH_MIN_HEIGHT } from "../../src/theme/tokens";

export default function MobileReceiptsScreen() {
  const { workspaceState, lang, isDark } = useMobileSession();
  const isSw = lang === "SW";
  const [query, setQuery] = useState("");
  const sales = (workspaceState?.sales as Array<{
    id: string;
    receiptNumber?: string;
    customerName?: string;
    actorName: string;
    totalTzs: number;
    itemCount: number;
    paymentMethod: string;
    createdAt: string;
  }> | undefined) || [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter(
      (s) =>
        (s.receiptNumber ?? s.id).toLowerCase().includes(q) ||
        (s.customerName ?? "").toLowerCase().includes(q) ||
        s.actorName.toLowerCase().includes(q)
    );
  }, [sales, query]);

  const bg = isDark ? CERVOS_COLORS.darkBg : CERVOS_COLORS.lightBg;
  const card = isDark ? CERVOS_COLORS.darkCard : CERVOS_COLORS.lightCard;
  const border = isDark ? CERVOS_COLORS.darkBorder : CERVOS_COLORS.lightBorder;
  const text = isDark ? CERVOS_COLORS.darkText : CERVOS_COLORS.lightText;
  const muted = isDark ? CERVOS_COLORS.darkMuted : CERVOS_COLORS.lightMuted;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: text }]}>
        {isSw ? `Kumbukumbu za Risiti (${filtered.length})` : `Receipts Vault (${filtered.length})`}
      </Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={isSw ? "Tafuta namba ya risiti au jina la mteja..." : "Search receipt #, customer, or cashier..."}
        placeholderTextColor={muted}
        style={[styles.search, { backgroundColor: card, borderColor: border, color: text }]}
      />
      {filtered.length === 0 ? (
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={{ color: muted, fontSize: 14 }}>
            {isSw ? "Hakuna risiti bado." : "No immutable receipts logged yet."}
          </Text>
        </View>
      ) : (
        filtered.map((s) => (
          <View key={s.id} style={[styles.card, { backgroundColor: card, borderColor: border }]}>
            <View style={styles.rowBetween}>
              <Text style={{ color: CERVOS_COLORS.cobalt, fontWeight: "800", fontSize: 13 }}>
                {s.receiptNumber || s.id.slice(-8).toUpperCase()}
              </Text>
              <Text style={{ color: text, fontWeight: "700", fontSize: 15 }}>{formatTzs(s.totalTzs)}</Text>
            </View>
            <Text style={{ color: muted, fontSize: 12 }}>
              {s.customerName ? `${s.customerName} · ` : ""}
              {s.paymentMethod.toUpperCase()} &middot; {s.itemCount} items &middot; {s.actorName}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 18, paddingTop: 54, paddingBottom: 32, gap: 12 },
  title: { fontSize: 22, fontWeight: "700" },
  search: { minHeight: TOUCH_MIN_HEIGHT, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, fontSize: 14 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 6 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
