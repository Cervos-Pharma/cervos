export type AppLang = "EN" | "SW";

export const CERVOS_COLORS = {
  cobalt: "#1039B9",
  cobaltDark: "#0D2E94",
  lime: "#E2F575",
  emerald: "#10B981",
  amber: "#F59E0B",
  rose: "#F43F5E",
  lightBg: "#F7F8FA",
  lightCard: "#FFFFFF",
  lightBorder: "#E2E8F0",
  lightText: "#111317",
  lightMuted: "#64748B",
  darkBg: "#0B0F17",
  darkCard: "#11161F",
  darkBorder: "#1E293B",
  darkText: "#F8FAFC",
  darkMuted: "#94A3B8",
} as const;

export const TOUCH_MIN_HEIGHT = 48;

export const MOBILE_COPY = {
  EN: {
    welcomeTitle: "Run your pharmacy with calm speed",
    welcomeSub: "Offline POS, FEFO batch safety, camera barcode scanning, permits, and live sync.",
    chooseLang: "Choose Language",
    getStarted: "Create Workspace / Join",
    signIn: "Sign In",
    tutorialTitle: "Quick Pharmacy Tutorial",
    syncOnline: "Synced",
    syncPending: "Queued Offline",
    permits: "Permits & Sync",
    receipts: "Receipts",
    inventory: "Inventory",
    scanner: "Scanner",
    counter: "Counter",
  },
  SW: {
    welcomeTitle: "Endesha duka lako kwa kasi na utulivu",
    welcomeSub: "POS bila mtandao, usalama wa FEFO, skana ya kamera, leseni na sync mubashara.",
    chooseLang: "Chagua Lugha",
    getStarted: "Fungua Akaunti / Jiunge",
    signIn: "Ingia",
    tutorialTitle: "Mwongozo wa Haraka",
    syncOnline: "Imesawazishwa",
    syncPending: "Inasubiri Mtandao",
    permits: "Leseni & Sync",
    receipts: "Risiti",
    inventory: "Stoo",
    scanner: "Skana",
    counter: "Kaunta",
  },
} as const;
