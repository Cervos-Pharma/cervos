import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { formatTzs } from "@cervos/core";
import { useMobileSession } from "@/context/session-context";
import { colors, radius, spacing, typography, useBrandColors } from "@/theme";
import { computeStockHealth, summarizeBranchPnl } from "@/utils/intelligence";

export default function ReportsScreen() {
  const { workspace, scopedSales, scopedBatches, scopedExpenses, activeCentre, lang } =
    useMobileSession();
  const brand = useBrandColors(workspace?.account?.customization?.brandAccent);
  const isSw = lang === "SW";
  const [days, setDays] = useState<7 | 30 | 60>(30);

  const pnl = summarizeBranchPnl(scopedSales, scopedExpenses, days);
  const stock = computeStockHealth(scopedBatches);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 40 }}
    >
      <Text style={typography.caption}>{activeCentre?.name || workspace?.account?.orgName}</Text>

      <View style={{ flexDirection: "row", gap: spacing.xs }}>
        {([7, 30, 60] as const).map((w) => (
          <Pressable
            key={w}
            onPress={() => setDays(w)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: radius.full,
              backgroundColor: days === w ? brand.accent : colors.secondaryGroupedBackground,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: days === w ? colors.onTint : colors.label,
              }}
            >
              {w} {isSw ? "Siku" : "Days"}
            </Text>
          </Pressable>
        ))}
      </View>

      <View
        style={{
          padding: spacing.md,
          borderRadius: radius.xl,
          borderCurve: "continuous",
          backgroundColor: colors.secondaryGroupedBackground,
          gap: spacing.sm,
        }}
      >
        <Text style={typography.overline}>PROFIT & LOSS SUMMARY</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={typography.subhead}>Gross Sales ({pnl.salesCount})</Text>
          <Text style={{ fontWeight: "700", color: colors.label }}>{formatTzs(pnl.revenue)}</Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={typography.subhead}>Cost of Stock</Text>
          <Text style={{ fontWeight: "600", color: colors.secondaryLabel }}>-{formatTzs(pnl.cogs)}</Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={typography.subhead}>Operating Expenses</Text>
          <Text style={{ fontWeight: "600", color: colors.secondaryLabel }}>-{formatTzs(pnl.opex)}</Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            paddingTop: spacing.xs,
            borderTopWidth: 1,
            borderTopColor: colors.separator,
          }}
        >
          <Text style={typography.headline}>Net Operating Profit</Text>
          <Text style={{ fontSize: 17, fontWeight: "700", color: brand.success }}>
            {formatTzs(pnl.netProfit)} ({pnl.grossMarginPct}%)
          </Text>
        </View>
      </View>

      <View
        style={{
          padding: spacing.md,
          borderRadius: radius.xl,
          borderCurve: "continuous",
          backgroundColor: colors.secondaryGroupedBackground,
          gap: spacing.sm,
        }}
      >
        <Text style={typography.overline}>STOCK HEALTH & EXPIRY RISK</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={typography.subhead}>Stock at Cost</Text>
          <Text style={{ fontWeight: "700", color: colors.label }}>{formatTzs(stock.atCost)}</Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={typography.subhead}>Stock at Retail</Text>
          <Text style={{ fontWeight: "700", color: brand.accent }}>{formatTzs(stock.atRetail)}</Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={typography.subhead}>Expiring &le; 30 Days ({stock.expiring30Units} packs)</Text>
          <Text style={{ fontWeight: "700", color: brand.warning }}>{formatTzs(stock.expiring30Cost)}</Text>
        </View>
      </View>
    </ScrollView>
  );
}
