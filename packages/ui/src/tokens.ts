/**
 * Cervos design tokens.
 *
 * Principles:
 * - Grounded: warm stone surfaces, deep ink text, one calm teal accent.
 * - Harmonious: every color comes from the same muted family.
 * - Readable: body text starts at 16px, key numbers at 30px or more.
 * - Plain: no emojis anywhere. Icons are simple stroke SVGs.
 */

export const color = {
  canvas: "#F5F3EE",
  surface: "#FFFFFF",
  surfaceSunken: "#EDEAE3",
  border: "#DDD8CE",
  borderStrong: "#BEB7A9",
  ink: "#1E2522",
  inkMuted: "#545C57",
  inkSubtle: "#7A817C",
  primary: "#1F5F5B",
  primaryHover: "#184C49",
  primarySoft: "#E2EEEC",
  onPrimary: "#FFFFFF",
  success: "#2F6F45",
  successSoft: "#E3F0E6",
  warning: "#8A5A10",
  warningSoft: "#F6EBD6",
  danger: "#A23B2F",
  dangerSoft: "#F6E1DD",
  info: "#2D5486",
  infoSoft: "#E1E9F3",
} as const;

export const space = {
  0: "0px",
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  8: "32px",
  10: "40px",
  12: "48px",
  16: "64px",
} as const;

export const radius = {
  sm: "4px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  full: "9999px",
} as const;

export const fontSize = {
  sm: ["14px", "20px"],
  base: ["16px", "24px"],
  lg: ["18px", "28px"],
  xl: ["20px", "28px"],
  "2xl": ["24px", "32px"],
  "3xl": ["30px", "36px"],
  "4xl": ["36px", "40px"],
} as const;

export const shadow = {
  flat: "none",
  raised: "0 1px 2px rgba(30,37,34,0.06), 0 2px 8px rgba(30,37,34,0.06)",
  /** Solid offset edge used for the opt-in 3D look. */
  depth: "0 4px 0 0 #BEB7A9, 0 10px 20px -8px rgba(30,37,34,0.18)",
} as const;

export const motion = {
  fast: "120ms",
  base: "180ms",
  easing: "cubic-bezier(0.2, 0, 0, 1)",
} as const;

export const tokens = { color, space, radius, fontSize, shadow, motion } as const;

/** Tailwind preset so apps can use `bg-cv-canvas`, `text-cv-ink`, `shadow-cv-depth`, and so on. */
export const cervosTailwindPreset = {
  theme: {
    extend: {
      colors: Object.fromEntries(
        Object.entries(color).map(([k, v]) => [`cv-${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`, v])
      ),
      borderRadius: { "cv-sm": radius.sm, "cv-md": radius.md, "cv-lg": radius.lg, "cv-xl": radius.xl },
      boxShadow: { "cv-raised": shadow.raised, "cv-depth": shadow.depth },
    },
  },
};
