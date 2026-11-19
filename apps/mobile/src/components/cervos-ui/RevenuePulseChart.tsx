import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { formatTzs } from "@cervos/core";
import { radius, spacing, useBrandColors } from "@/theme";

export interface ChartBarPoint {
  label: string;
  sublabel?: string;
  value: number;
  secondaryValue?: number;
  isForecast?: boolean;
}

export function RevenuePulseChart({
  title,
  points,
  accentHex,
  height = 118,
}: {
  title: string;
  points: ChartBarPoint[];
  accentHex?: string;
  height?: number;
}) {
  const brand = useBrandColors(accentHex);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const safePoints = points.slice(-14);
  const maxVal = Math.max(1, ...safePoints.map((p) => p.value));
  const activePoint =
    selectedIdx !== null && safePoints[selectedIdx]
      ? safePoints[selectedIdx]
      : safePoints[safePoints.length - 1];

  return (
    <View
      style={{
        padding: spacing.md,
        borderRadius: radius.xl,
        borderCurve: "continuous",
        backgroundColor: brand.cardBg,
        borderWidth: 1,
        borderColor: brand.borderColor,
        gap: spacing.sm,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.xs }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 10, fontWeight: "700", letterSpacing: 0.9, color: brand.textMuted }}>
            {title.toUpperCase()}
          </Text>
          {activePoint && (
            <Text style={{ fontSize: 13, fontWeight: "700", color: brand.textPrimary, marginTop: 2 }}>
              {activePoint.sublabel || activePoint.label}: {formatTzs(activePoint.value)}
              {activePoint.isForecast ? " (Holt Est.)" : ""}
            </Text>
          )}
        </View>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: radius.full,
            backgroundColor: brand.limeBadgeBg,
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: "800", color: brand.limeBadgeInk }}>
            LIVE
          </Text>
        </View>
      </View>

      {safePoints.length === 0 ? (
        <View style={{ height: height * 0.6, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ fontSize: 12, color: brand.textMuted }}>No counter activity yet</Text>
        </View>
      ) : (
        <View style={{ height, flexDirection: "row", alignItems: "flex-end", gap: 4, paddingTop: 8 }}>
          {safePoints.map((pt, idx) => {
            const pct = Math.max(6, Math.round((pt.value / maxVal) * (height - 26)));
            const isSel = selectedIdx === idx || (selectedIdx === null && idx === safePoints.length - 1);
            const barColor = pt.isForecast
              ? brand.teal
              : isSel
                ? brand.accent
                : brand.isDark
                  ? "rgba(56, 189, 248, 0.45)"
                  : "rgba(16, 57, 185, 0.35)";
            return (
              <Pressable
                key={`${pt.label}_${idx}`}
                onPress={() => setSelectedIdx(idx)}
                style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 4, height: "100%" }}
              >
                <View
                  style={{
                    width: "100%",
                    maxWidth: 18,
                    height: pct,
                    borderRadius: 6,
                    backgroundColor: barColor,
                    borderWidth: pt.isForecast ? 1 : 0,
                    borderColor: pt.isForecast ? brand.teal : "transparent",
                  }}
                />
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 9,
                    fontWeight: isSel ? "700" : "500",
                    color: isSel ? brand.accent : brand.textMuted,
                  }}
                >
                  {pt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
