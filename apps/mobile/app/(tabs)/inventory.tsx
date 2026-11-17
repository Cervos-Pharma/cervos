import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { formatTzs } from "@cervos/core";
import { useMobileSession } from "../../src/context/MobileSessionContext";
import { CERVOS_COLORS, TOUCH_MIN_HEIGHT } from "../../src/theme/tokens";

export default function MobileInventoryScreen() {
  const { workspaceState, lang, isDark } = useMobileSession();
  const isSw = lang === "SW";
  const [query, setQuery] = useState("");
  const batches = (workspaceState?.batches as Array<{
    id: string;
    brandName: string;
    genericName: string;
    batchNumber: string;
    quantity: number;
    salePriceTzs: number;
    expiryDate: string;
    quarantined: boolean;
  }> | undefined) || [];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return batches;
    return batches.filter(
      (b) =>
        b.brandName.toLowerCase().includes(q) ||
        b.genericName.toLowerCase().includes(q) ||
        b.batchNumber.toLowerCase().includes(q)
    );
  }, [batches, query]);

  const bg = isDark ? CERVOS_COLORS.darkBg : CERVOS_COLORS.lightBg;
  const card = isDark ? CERVOS_COLORS.darkCard : CERVOS_COLORS.lightCard;
  const border = isDark ? CERVOS_COLORS.darkBorder : CERVOS_COLORS.lightBorder;
  const text = isDark ? CERVOS_COLORS.darkText : CERVOS_COLORS.lightText;
  const muted = isDark ? CERVOS_COLORS.darkMuted : CERVOS_COLORS.lightMuted;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: text }]}>
        {isSw ? `Stoo ya FEFO (${filtered.length})` : `FEFO Stockroom (${filtered.length})`}
      </Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={isSw ? "Tafuta dawa au batch..." : "Search brand, generic, or batch #..."}
        placeholderTextColor={muted}
        style={[styles.search, { backgroundColor: card, borderColor: border, color: text }]}
      />
      {filtered.length === 0 ? (
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={{ color: muted, fontSize: 14 }}>
            {isSw ? "Hakuna dawa zinazolingana bado." : "No matching stock batches yet."}
          </Text>
        </View>
      ) : (
        filtered.map((b) => (
          <View key={b.id} style={[styles.card, { backgroundColor: card, borderColor: border }]}>
            <View style={styles.rowBetween}>
              <Text style={{ color: text, fontWeight: "700", fontSize: 15 }}>{b.brandName}</Text>
              <Text style={{ color: b.quarantined ? CERVOS_COLORS.rose : CERVOS_COLORS.emerald, fontWeight: "700", fontSize: 12 }}>
                {b.quarantined ? "QUARANTINE" : `${b.quantity} units`}
              </Text>
            </View>
            <Text style={{ color: muted, fontSize: 12 }}>
              {b.genericName} &middot; Batch {b.batchNumber} &middot; Exp {b.expiryDate.slice(0, 10)}
            </Text>
            <Text style={{ color: text, fontWeight: "600", fontSize: 13 }}>{formatTzs(b.salePriceTzs)} / pack</Text>
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
