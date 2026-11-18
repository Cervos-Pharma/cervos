import { TextStyle } from "react-native";
import { colors } from "./colors";

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  full: 9999,
} as const;

export const shadows = {
  card: "0 1px 2px rgba(0, 0, 0, 0.04)",
  raised: "0 4px 12px rgba(0, 0, 0, 0.08)",
  overlay: "0 8px 24px rgba(0, 0, 0, 0.16)",
} as const;

export const motion = {
  fast: 150,
  base: 250,
  slow: 400,
} as const;

export const typography = {
  largeTitle: { fontSize: 32, fontWeight: "700", color: colors.label, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: "700", color: colors.label, letterSpacing: -0.3 },
  headline: { fontSize: 17, fontWeight: "600", color: colors.label },
  body: { fontSize: 16, fontWeight: "400", color: colors.label },
  subhead: { fontSize: 14, fontWeight: "400", color: colors.secondaryLabel },
  caption: { fontSize: 12, fontWeight: "400", color: colors.secondaryLabel },
  overline: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.tertiaryLabel,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
} as const satisfies Record<string, TextStyle>;
