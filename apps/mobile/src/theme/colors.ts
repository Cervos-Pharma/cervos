import React, { createContext, useContext } from "react";
import { Platform, useColorScheme } from "react-native";
import { Color } from "expo-router";

export type ThemePreference = "light" | "dark" | "system";
export type FontScalePreference = "compact" | "standard" | "large";

interface CervosThemeState {
  themePref: ThemePreference;
  fontScale: FontScalePreference;
  orgAccentHex?: string;
}

const CervosThemeContext = createContext<CervosThemeState>({
  themePref: "system",
  fontScale: "standard",
});

export function CervosThemeProvider({
  themePref = "system",
  fontScale = "standard",
  orgAccentHex,
  children,
}: CervosThemeState & { children: React.ReactNode }) {
  return React.createElement(
    CervosThemeContext.Provider,
    { value: { themePref, fontScale, orgAccentHex } },
    children
  );
}

export const colors = {
  label: Platform.select({
    ios: Color.ios.label,
    android: Color.android.dynamic.onSurface,
    default: "#111317",
  })!,
  secondaryLabel: Platform.select({
    ios: Color.ios.secondaryLabel,
    android: Color.android.dynamic.onSurfaceVariant,
    default: "#60646C",
  })!,
  tertiaryLabel: Platform.select({
    ios: Color.ios.tertiaryLabel,
    android: Color.android.dynamic.outline,
    default: "#8B929E",
  })!,
  separator: Platform.select({
    ios: Color.ios.separator,
    android: Color.android.dynamic.outlineVariant,
    default: "#E2E8F0",
  })!,
  systemBackground: Platform.select({
    ios: Color.ios.systemBackground,
    android: Color.android.dynamic.surface,
    default: "#FFFFFF",
  })!,
  groupedBackground: Platform.select({
    ios: Color.ios.systemGroupedBackground,
    android: Color.android.dynamic.surfaceContainerLowest,
    default: "#F5F6F8",
  })!,
  secondaryGroupedBackground: Platform.select({
    ios: Color.ios.secondarySystemGroupedBackground,
    android: Color.android.dynamic.surfaceContainerLow,
    default: "#FFFFFF",
  })!,
  tertiaryBackground: Platform.select({
    ios: Color.ios.tertiarySystemGroupedBackground,
    android: Color.android.dynamic.surfaceContainer,
    default: "#F1F5F9",
  })!,
  systemBlue: Platform.select({
    ios: Color.ios.systemBlue,
    android: Color.android.dynamic.primary,
    default: "#1039B9",
  })!,
  systemGreen: Platform.select({
    ios: Color.ios.systemGreen,
    android: "#16A34A",
    default: "#059669",
  })!,
  systemOrange: Platform.select({
    ios: Color.ios.systemOrange,
    android: "#D97706",
    default: "#D97706",
  })!,
  systemRed: Platform.select({
    ios: Color.ios.systemRed,
    android: Color.android.dynamic.error,
    default: "#DC2626",
  })!,
  onTint: "#FFFFFF",
} as const;

export const STATIC_BRAND_LIGHT = "#1039B9";
export const STATIC_BRAND_DARK = "#38BDF8";

export function useBrandColors(orgAccentOverride?: string) {
  const osScheme = useColorScheme();
  const ctx = useContext(CervosThemeContext);
  const resolvedMode: "light" | "dark" =
    ctx.themePref === "dark"
      ? "dark"
      : ctx.themePref === "light"
        ? "light"
        : osScheme === "dark"
          ? "dark"
          : "light";
  const isDark = resolvedMode === "dark";
  const accent =
    orgAccentOverride || ctx.orgAccentHex || (isDark ? STATIC_BRAND_DARK : STATIC_BRAND_LIGHT);
  const fontMult = ctx.fontScale === "compact" ? 0.92 : ctx.fontScale === "large" ? 1.08 : 1;

  return {
    isDark,
    mode: resolvedMode,
    themePref: ctx.themePref,
    fontScale: ctx.fontScale,
    fontMult,
    accent,
    accentSoft: isDark ? "rgba(56, 189, 248, 0.16)" : "rgba(16, 57, 185, 0.10)",
    teal: isDark ? "#2DD4BF" : "#006875",
    tealSoft: isDark ? "rgba(45, 212, 191, 0.16)" : "rgba(0, 104, 117, 0.10)",
    success: isDark ? "#34D399" : "#059669",
    successSoft: isDark ? "rgba(52, 211, 153, 0.16)" : "rgba(5, 150, 105, 0.10)",
    warning: isDark ? "#FBBF24" : "#D97706",
    warningSoft: isDark ? "rgba(251, 191, 36, 0.16)" : "rgba(217, 119, 6, 0.12)",
    danger: isDark ? "#F87171" : "#DC2626",
    dangerSoft: isDark ? "rgba(248, 113, 113, 0.16)" : "rgba(220, 38, 38, 0.10)",
    limeBadgeBg: "#E2F575",
    limeBadgeInk: "#111317",
    canvasBg: isDark ? "#090C12" : "#F5F6F8",
    cardBg: isDark ? "#11161F" : "#FFFFFF",
    cardSubtleBg: isDark ? "#161D2B" : "#F8FAFC",
    inputBg: isDark ? "#0D131F" : "#F1F5F9",
    borderColor: isDark ? "#1E293B" : "#E2E8F0",
    textPrimary: isDark ? "#F8FAFC" : "#111317",
    textSecondary: isDark ? "#94A3B8" : "#60646C",
    textMuted: isDark ? "#64748B" : "#8B929E",
    staticCardBg: isDark ? "#11161F" : "#FFFFFF",
    staticMuted: isDark ? "#94A3B8" : "#64748B",
    staticBorder: isDark ? "#1E293B" : "#EAECF0",
  };
}
