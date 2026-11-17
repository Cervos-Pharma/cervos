"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MapClientWrapper from "@/components/MapClientWrapper";
import type { MapRoute, MarkerData } from "@/components/CervosMap";
import { Icon } from "@cervos/ui";
import LibraryShowcase from "./LibraryShowcase";

type TasteId = "A" | "B" | "C" | "D";
type RadiusMode = "default" | "sharp" | "instrument" | "squircle" | "soft";
type DensityMode = "calm" | "counter";
type StageFocus = "all" | "counter" | "owner" | "supplier" | "components";
type PaymentMethod = "mpesa" | "cash" | "split";
type LangCode = "EN" | "SW";

interface TasteTheme {
  id: TasteId;
  name: string;
  paradigm: string;
  tagline: string;
  archetype: string;
  canvas: string;
  card: string;
  elevated: string;
  headerGlass: string;
  contrastBg: string;
  contrastInk: string;
  ink: string;
  inkMuted: string;
  border: string;
  accent: string;
  accentInk: string;
  accentSoft: string;
  safe: string;
  safeBg: string;
  warn: string;
  warnBg: string;
  critical: string;
  criticalBg: string;
  defaultCardRadius: number;
  defaultControlRadius: number;
}

const TASTE_THEMES: Record<TasteId, TasteTheme> = {
  A: {
    id: "A",
    name: "Hardware Console",
    paradigm: "OP-1 Matrix · OLED · Thermal Tape",
    tagline: "Braun × Teenage Engineering",
    archetype:
      "Flush 1px engineering grid, recessed dark-phosphor OLED telemetry, mechanical keycaps & serrated receipt tape.",
    canvas: "#F2F0EB",
    card: "#F8F7F3",
    elevated: "#E6E2D8",
    headerGlass: "rgba(242, 240, 235, 0.96)",
    contrastBg: "#141413",
    contrastInk: "#F5F2EA",
    ink: "#191919",
    inkMuted: "#595750",
    border: "#191919",
    accent: "#E96A26",
    accentInk: "#FFFFFF",
    accentSoft: "rgba(233, 106, 38, 0.12)",
    safe: "#059669",
    safeBg: "rgba(5, 150, 105, 0.12)",
    warn: "#B45309",
    warnBg: "rgba(180, 83, 9, 0.12)",
    critical: "#C2410C",
    criticalBg: "rgba(194, 65, 12, 0.14)",
    defaultCardRadius: 2,
    defaultControlRadius: 2,
  },
  B: {
    id: "B",
    name: "Editorial Apothecary",
    paradigm: "Morning Letter · Linen Shelf Ledges",
    tagline: "Aesop × One Medical Journal",
    archetype:
      "Asymmetrical print magazine spread, interactive natural-language morning letter, Roman chapter index & apothecary tray.",
    canvas: "#F4EFE6",
    card: "#FAF7F1",
    elevated: "#EAE3D5",
    headerGlass: "rgba(244, 239, 230, 0.94)",
    contrastBg: "#14211B",
    contrastInk: "#F4EFE6",
    ink: "#14211B",
    inkMuted: "#5B645D",
    border: "#D8D2C5",
    accent: "#0F5338",
    accentInk: "#FAF7F1",
    accentSoft: "rgba(15, 83, 56, 0.08)",
    safe: "#15803D",
    safeBg: "rgba(21, 128, 61, 0.10)",
    warn: "#9A6700",
    warnBg: "rgba(154, 103, 0, 0.10)",
    critical: "#9F1239",
    criticalBg: "rgba(159, 18, 57, 0.09)",
    defaultCardRadius: 12,
    defaultControlRadius: 6,
  },
  C: {
    id: "C",
    name: "Kinetic 3D Deck",
    paradigm: "3D Prism Charts · Diagonal HUD · Live Chat",
    tagline: "3D Telemetry × Raycast Chat × Edge HUD",
    archetype:
      "Deep obsidian edge-lit stage, chamfered diagonal HUD blades, multi-axis branch radar & waterfall charts, plus live chat terminal.",
    canvas: "#060913",
    card: "#0D1322",
    elevated: "#131C31",
    headerGlass: "rgba(6, 9, 19, 0.90)",
    contrastBg: "#00E5FF",
    contrastInk: "#060913",
    ink: "#F8FAFC",
    inkMuted: "#94A3B8",
    border: "rgba(0, 229, 255, 0.24)",
    accent: "#00E5FF",
    accentInk: "#060913",
    accentSoft: "rgba(0, 229, 255, 0.14)",
    safe: "#10B981",
    safeBg: "rgba(16, 185, 129, 0.16)",
    warn: "#F59E0B",
    warnBg: "rgba(245, 158, 11, 0.16)",
    critical: "#F43F5E",
    criticalBg: "rgba(244, 63, 94, 0.16)",
    defaultCardRadius: 16,
    defaultControlRadius: 12,
  },
  D: {
    id: "D",
    name: "Spatial Glass Studio",
    paradigm: "Bigger Type · 3D Extruded · Diagonal · Chat",
    tagline: "visionOS 3D × Lit Charts × Spatial Chat",
    archetype:
      "Oversized spatial typography, 3D perspective glass slabs, diagonal light refraction, isometric 3D charts & interactive Pharmacy Copilot.",
    canvas: "#E6ECF5",
    card: "rgba(255, 255, 255, 0.80)",
    elevated: "rgba(255, 255, 255, 0.62)",
    headerGlass: "rgba(238, 243, 251, 0.78)",
    contrastBg: "#12151C",
    contrastInk: "#FFFFFF",
    ink: "#14171F",
    inkMuted: "#505663",
    border: "rgba(255, 255, 255, 0.90)",
    accent: "#0066EC",
    accentInk: "#FFFFFF",
    accentSoft: "rgba(0, 102, 236, 0.12)",
    safe: "#16A34A",
    safeBg: "rgba(22, 163, 74, 0.15)",
    warn: "#C26100",
    warnBg: "rgba(245, 158, 11, 0.18)",
    critical: "#DC2626",
    criticalBg: "rgba(220, 38, 38, 0.14)",
    defaultCardRadius: 22,
    defaultControlRadius: 14,
  },
};

interface BatchLot {
  lotCode: string;
  expiresInDays: number;
  expiryLabel: string;
  qty: number;
}

interface MedicineItem {
  id: string;
  name: string;
  latinSubtitle: string;
  vialNote: string;
  form: string;
  priceTzs: number;
  costTzs: number;
  requiresRx: boolean;
  barcode: string;
  batches: BatchLot[];
}

const INITIAL_MEDICINES: MedicineItem[] = [
  {
    id: "amox-500",
    name: "Amoxicillin 500mg",
    latinSubtitle: "Amoxicillinum Trihydricum · 500 mg",
    vialNote: "Complete full 7-day course at 8h intervals",
    form: "20 Capsules · Blister",
    priceTzs: 4500,
    costTzs: 3100,
    requiresRx: false,
    barcode: "0616110284019",
    batches: [
      { lotCode: "LOT-A24", expiresInDays: 18, expiryLabel: "18d left", qty: 3 },
      { lotCode: "LOT-B09", expiresInDays: 340, expiryLabel: "11m left", qty: 24 },
    ],
  },
  {
    id: "alu-20",
    name: "Artemether / Lumefantrine",
    latinSubtitle: "Artemetherum + Lumefantrinum · ACT",
    vialNote: "Take with fatty meal or milk for absorption",
    form: "20/120mg · 24 Tabs",
    priceTzs: 3200,
    costTzs: 2150,
    requiresRx: false,
    barcode: "0616110992104",
    batches: [{ lotCode: "LOT-M12", expiresInDays: 220, expiryLabel: "7m left", qty: 18 }],
  },
  {
    id: "para-1g",
    name: "Paracetamol Extra 1g",
    latinSubtitle: "Paracetamolum + Coffeinum · 1000 mg",
    vialNote: "Maximum 4 doses per 24 hours; check overlap",
    form: "10 Caplets · Fast Relief",
    priceTzs: 1800,
    costTzs: 950,
    requiresRx: false,
    barcode: "0616110331208",
    batches: [{ lotCode: "LOT-P08", expiresInDays: 420, expiryLabel: "14m left", qty: 40 }],
  },
  {
    id: "azith-500",
    name: "Azithromycin 500mg",
    latinSubtitle: "Azithromycinum Dihydricum · Macrolide",
    vialNote: "Pharmacist prescription review before release",
    form: "3 Film Tabs · Rx Pack",
    priceTzs: 6500,
    costTzs: 4300,
    requiresRx: true,
    barcode: "0616110447102",
    batches: [
      { lotCode: "LOT-Z03", expiresInDays: 26, expiryLabel: "26d left", qty: 2 },
      { lotCode: "LOT-Z19", expiresInDays: 290, expiryLabel: "9m left", qty: 15 },
    ],
  },
  {
    id: "metf-500",
    name: "Metformin ER 500mg",
    latinSubtitle: "Metformini Hydrochloridum · Extended",
    vialNote: "Dispense with evening meal guidance",
    form: "30 Tabs · Chronic Care",
    priceTzs: 8900,
    costTzs: 6200,
    requiresRx: true,
    barcode: "0616110772190",
    batches: [{ lotCode: "LOT-C11", expiresInDays: 390, expiryLabel: "13m left", qty: 20 }],
  },
  {
    id: "ors-zinc",
    name: "ORS + Zinc Co-Pack",
    latinSubtitle: "Salia Rehydratationis + Zincum 20mg",
    vialNote: "Dissolve single sachet in 1L clean water",
    form: "2 Sachets + 10 Tabs",
    priceTzs: 2500,
    costTzs: 1500,
    requiresRx: false,
    barcode: "0616110118932",
    batches: [{ lotCode: "LOT-H04", expiresInDays: 190, expiryLabel: "6m left", qty: 30 }],
  },
];

interface SupplierOrder {
  id: string;
  pharmacy: string;
  region: string;
  itemsSummary: string;
  amountTzs: number;
  eta: string;
  status: "incoming" | "dispatched" | "delivered";
}

const INITIAL_SUPPLIER_ORDERS: SupplierOrder[] = [
  {
    id: "ORD-882",
    pharmacy: "Kariakoo Central Pharmacy",
    region: "Dar es Salaam",
    itemsSummary: "Artemether/Lumefantrine × 60, ORS Co-Pack × 80",
    amountTzs: 485000,
    eta: "45 min courier",
    status: "incoming",
  },
  {
    id: "ORD-879",
    pharmacy: "Meru Ridge Apothecary",
    region: "Arusha",
    itemsSummary: "Metformin ER 500mg × 35, Azithromycin × 40",
    amountTzs: 612000,
    eta: "Tomorrow 09:00",
    status: "dispatched",
  },
];

const LAB_MARKERS: MarkerData[] = [
  {
    id: "depot-dar",
    lat: -6.8165,
    lng: 39.2894,
    label: "Bahari Wholesale Hub · Dar",
    kind: "supplier",
    status: "active",
    detail: "Active dispatch hub · 14 outbound orders",
  },
  {
    id: "kariakoo",
    lat: -6.8229,
    lng: 39.2725,
    label: "Kariakoo Central Pharmacy",
    kind: "branch",
    status: "online",
    detail: "98.4% stocked · Live counter sync",
  },
  {
    id: "upanga",
    lat: -6.8035,
    lng: 39.2799,
    label: "Upanga Clinical Branch",
    kind: "branch",
    status: "healthy",
    detail: "Cash drawer balanced · TZS 620,000",
  },
  {
    id: "mwenge",
    lat: -6.7704,
    lng: 39.2283,
    label: "Mwenge Express Counter",
    kind: "branch",
    status: "at_risk",
    detail: "2 short-dated lots highlighted for FEFO",
  },
];

const LAB_ROUTES: MapRoute[] = [
  {
    id: "r-kariakoo",
    from: [-6.8165, 39.2894],
    to: [-6.8229, 39.2725],
    label: "20 min express rider",
    status: "active",
  },
  {
    id: "r-upanga",
    from: [-6.8165, 39.2894],
    to: [-6.8035, 39.2799],
    label: "Delivered 09:40",
    status: "delivered",
  },
];

const MOUNTED_SKILLS = [
  {
    name: "impeccable",
    source: "E:\\work\\external-skills",
    role: "Design Director & Craft Floor (zero ghost cards, 4.5:1 contrast, restraint)",
  },
  {
    name: "web-design-engineer",
    source: "E:\\work\\external-skills",
    role: "Anchored visual worlds (Braun OP-1, Aesop Journal, Super-App, visionOS)",
  },
  {
    name: "ui-ux-pro-max",
    source: "E:\\Repo\\forks",
    role: "80 styles, 192 palettes, 74 font pairings & 120 UX heuristics",
  },
  {
    name: "better-interface suite",
    source: "E:\\work\\external-skills",
    role: "7-part critique across a11y, layout, color, typography, writing & UI polish",
  },
  {
    name: "design-taste-frontend + originui",
    source: "E:\\work + E:\\Repo\\forks",
    role: "Anti-slop spatial verification + modular React/Tailwind primitives",
  },
];

function formatTzs(amount: number): string {
  return `TZS ${Math.round(amount).toLocaleString("en-US")}`;
}

function allocateFefo(batches: BatchLot[], requestedQty: number) {
  let remaining = requestedQty;
  const picks: { lotCode: string; qty: number; expiryLabel: string; expiresInDays: number }[] = [];
  for (const lot of [...batches].sort((a, b) => a.expiresInDays - b.expiresInDays)) {
    if (remaining <= 0) break;
    if (lot.qty <= 0) continue;
    const take = Math.min(lot.qty, remaining);
    picks.push({
      lotCode: lot.lotCode,
      qty: take,
      expiryLabel: lot.expiryLabel,
      expiresInDays: lot.expiresInDays,
    });
    remaining -= take;
  }
  return picks;
}

interface CartLine {
  med: MedicineItem;
  qty: number;
  fefoPicks: { lotCode: string; qty: number; expiryLabel: string; expiresInDays: number }[];
  lineTotal: number;
}

interface BranchSummary {
  id: string;
  name: string;
  shortName: string;
  sales: number;
  healthPct: number;
  stateEn: string;
  stateSw: string;
  alert: boolean;
}

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  text: string;
  metricTag?: string;
  bars?: { label: string; pct: number; tone: "accent" | "safe" | "warn" }[];
  actionLabel?: string;
  onActionKind?: "add-amox" | "boost-restock" | "open-checkout";
}

interface LabWorldProps {
  theme: TasteTheme;
  lang: LangCode;
  focus: StageFocus;
  setFocus: (f: StageFocus) => void;
  density: DensityMode;
  depth3d: boolean;
  cardRadiusPx: number;
  controlRadiusPx: number;
  filteredMedicines: MedicineItem[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  cart: Record<string, number>;
  cartLines: CartLine[];
  cartTotal: number;
  totalCartItems: number;
  needsRxVerification: boolean;
  verifiedRxIds: Record<string, boolean>;
  toggleVerifyRx: (id: string) => void;
  addToCart: (id: string, delta: number) => void;
  clearCart: () => void;
  handleSimulateScan: () => void;
  openCheckout: () => void;
  todayRevenue: number;
  txCount: number;
  branches: BranchSummary[];
  selectedBranch: string;
  setSelectedBranch: (id: string) => void;
  restockApproved: boolean;
  handleApproveRestock: () => void;
  openInspector: () => void;
  supplierOrders: SupplierOrder[];
  handleAdvanceSupplierOrder: (id: string) => void;
  wizardStep: 1 | 2 | 3;
  setWizardStep: React.Dispatch<React.SetStateAction<1 | 2 | 3>>;
  selectedSegment: "owners" | "counter" | "suppliers";
  setSelectedSegment: (s: "owners" | "counter" | "suppliers") => void;
  chatMessages: ChatMessage[];
  chatInput: string;
  setChatInput: (v: string) => void;
  handleSendChat: (promptText?: string) => void;
}

/* ── Mini SVG Topology Previews for A / B / C / D Selector Cards ─────────── */
function ArchitectureThumb({ id, active }: { id: TasteId; active: boolean }) {
  const stroke = active ? "currentColor" : "#64748B";
  if (id === "A") {
    return (
      <svg className="w-11 h-7 shrink-0" viewBox="0 0 44 28" fill="none">
        <rect x="1" y="1" width="42" height="26" stroke={stroke} strokeWidth="1.3" />
        <rect x="1" y="1" width="42" height="7" fill={stroke} fillOpacity="0.18" stroke={stroke} strokeWidth="1.2" />
        <line x1="29" y1="8" x2="29" y2="27" stroke={stroke} strokeWidth="1.2" />
        <rect x="4" y="11" width="6" height="5" stroke={stroke} strokeWidth="1" />
        <rect x="12" y="11" width="6" height="5" stroke={stroke} strokeWidth="1" />
        <rect x="20" y="11" width="6" height="5" stroke={stroke} strokeWidth="1" />
        <rect x="4" y="18" width="6" height="5" stroke={stroke} strokeWidth="1" />
        <rect x="12" y="18" width="6" height="5" stroke={stroke} strokeWidth="1" />
        <rect x="20" y="18" width="6" height="5" fill="#E96A26" />
        <line x1="32" y1="12" x2="40" y2="12" stroke={stroke} strokeWidth="1.1" />
        <line x1="32" y1="16" x2="39" y2="16" stroke={stroke} strokeWidth="1.1" />
        <rect x="32" y="21" width="8" height="3.5" fill="#E96A26" />
      </svg>
    );
  }
  if (id === "B") {
    return (
      <svg className="w-11 h-7 shrink-0" viewBox="0 0 44 28" fill="none">
        <line x1="2" y1="5" x2="25" y2="5" stroke={stroke} strokeWidth="1.5" />
        <line x1="2" y1="10" x2="22" y2="10" stroke={stroke} strokeOpacity="0.5" strokeWidth="1" />
        <line x1="2" y1="15" x2="24" y2="15" stroke={stroke} strokeOpacity="0.35" strokeWidth="1" />
        <line x1="2" y1="20" x2="24" y2="20" stroke={stroke} strokeOpacity="0.35" strokeWidth="1" />
        <line x1="2" y1="25" x2="18" y2="25" stroke={stroke} strokeOpacity="0.35" strokeWidth="1" />
        <rect x="29" y="3" width="13" height="22" rx="1.5" stroke={stroke} strokeWidth="1.2" fill="#0F5338" fillOpacity="0.14" />
        <line x1="32" y1="8" x2="39" y2="8" stroke={stroke} strokeWidth="1.1" />
        <line x1="32" y1="12" x2="38" y2="12" stroke={stroke} strokeOpacity="0.5" strokeWidth="1" />
      </svg>
    );
  }
  if (id === "C") {
    return (
      <svg className="w-11 h-7 shrink-0" viewBox="0 0 44 28" fill="none">
        <polygon points="3,4 28,4 24,14 1,14" fill="#060913" stroke="#00E5FF" strokeWidth="1.2" />
        <polygon points="32,7 41,2 41,16 32,20" fill="#00E5FF" fillOpacity="0.3" stroke="#00E5FF" strokeWidth="1" />
        <polygon points="2,18 16,18 13,26 1,26" fill="#10B981" fillOpacity="0.25" stroke="#10B981" strokeWidth="1.1" />
        <polygon points="20,17 42,17 39,26 17,26" fill="#0D1322" stroke={stroke} strokeWidth="1.1" />
      </svg>
    );
  }
  return (
    <svg className="w-11 h-7 shrink-0" viewBox="0 0 44 28" fill="none">
      <rect x="1.5" y="4" width="5" height="20" rx="2.5" fill="#0066EC" fillOpacity="0.28" stroke={stroke} strokeWidth="1" />
      <line x1="10" y1="26" x2="26" y2="2" stroke="#0066EC" strokeOpacity="0.4" strokeWidth="2.5" />
      <polygon points="20,6 28,2 36,6 28,10" fill="#0066EC" fillOpacity="0.35" stroke="#0066EC" strokeWidth="1" />
      <polygon points="20,6 28,10 28,21 20,17" fill="#34C759" fillOpacity="0.25" stroke={stroke} strokeWidth="1" />
      <polygon points="36,6 28,10 28,21 36,17" fill="#0066EC" fillOpacity="0.18" stroke={stroke} strokeWidth="1" />
      <circle cx="15" cy="18" r="5" stroke="#0066EC" strokeWidth="1.4" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   WORLD A: HARDWARE INSTRUMENT CONSOLE (Braun × Teenage Engineering OP-1)
   ═══════════════════════════════════════════════════════════════════════════ */
function WorldAConsole(props: LabWorldProps) {
  const {
    theme,
    lang,
    focus,
    setFocus,
    filteredMedicines,
    searchQuery,
    setSearchQuery,
    cart,
    cartLines,
    cartTotal,
    needsRxVerification,
    verifiedRxIds,
    toggleVerifyRx,
    addToCart,
    clearCart,
    handleSimulateScan,
    openCheckout,
    todayRevenue,
    txCount,
    branches,
    selectedBranch,
    setSelectedBranch,
    restockApproved,
    handleApproveRestock,
    openInspector,
    supplierOrders,
    handleAdvanceSupplierOrder,
    wizardStep,
    setWizardStep,
    selectedSegment,
    setSelectedSegment,
  } = props;

  const [multiplier, setMultiplier] = useState<1 | 2 | 5>(1);
  const fnKeys = ["F1", "F2", "F3", "F4", "F5", "F6"];

  return (
    <div className="max-w-[1440px] mx-auto px-3 sm:px-6 py-6 font-mono">
      {/* Main Architectural Housing with 1px exposed frame */}
      <div className="border border-[#191919] bg-[#F2F0EB] relative">
        {/* Corner Registration Crosshairs */}
        <span className="hidden sm:block absolute -top-2.5 -left-2 text-[11px] font-bold select-none">+</span>
        <span className="hidden sm:block absolute -top-2.5 -right-2 text-[11px] font-bold select-none">+</span>

        {/* 1. RECESSED OLED TELEMETRY CONSOLE HEADER */}
        <div className="bg-[#141413] text-[#F5F2EA] border-b border-[#191919] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#2F2E2A]">
            <div className="flex items-center gap-3">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#10B981] shadow-[0_0_8px_#10B981]" />
              <span className="text-[11px] tracking-[0.16em] uppercase text-[#C7C2B6]">
                SYS-01 // KARIAKOO-TILL · FEFO-AUTOLOCK · DAR-GRID
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {(["all", "counter", "owner", "supplier", "components"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFocus(tab)}
                  className={`px-2.5 py-1 text-[10px] uppercase tracking-wider border transition-colors ${
                    focus === tab
                      ? "bg-[#E96A26] text-white border-[#E96A26]"
                      : "bg-[#1E1E1C] text-[#A8A397] border-[#353430] hover:text-white"
                  }`}
                >
                  {tab === "all" ? "ALL-BAY" : tab.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 pt-4 divide-y md:divide-y-0 md:divide-x divide-[#2F2E2A]">
            <div className="pb-3 md:pb-0 md:pr-5">
              <p className="text-[10px] tracking-[0.18em] uppercase text-[#8E8A7F]">
                {lang === "EN" ? "OLED-01 // GROSS REGISTER" : "REJISTA // MAUZO YA LEO"}
              </p>
              <p className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums text-[#F8F5EC] mt-1">
                {formatTzs(todayRevenue)}
              </p>
            </div>
            <div className="py-3 md:py-0 md:px-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] tracking-[0.18em] uppercase text-[#8E8A7F]">
                  OLED-02 // COUNTER TX
                </p>
                <p className="text-2xl sm:text-3xl font-bold tabular-nums text-[#E96A26] mt-1">
                  {String(txCount).padStart(3, "0")} <span className="text-sm text-[#A8A397]">TX</span>
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-[#F59E0B]">
                <span className="w-2 h-2 rounded-full bg-[#F59E0B] shadow-[0_0_6px_#F59E0B]" />
                <span>FEFO ARMED</span>
              </div>
            </div>
            <div className="pt-3 md:pt-0 md:pl-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] tracking-[0.18em] uppercase text-[#8E8A7F]">
                  OLED-03 // INTEGRITY
                </p>
                <p className="text-2xl sm:text-3xl font-bold tabular-nums text-[#34D399] mt-1">
                  98.4% <span className="text-xs font-normal text-[#A8A397]">STOCKED</span>
                </p>
              </div>
              <span className="text-[10px] border border-[#34D399]/40 px-2 py-1 text-[#34D399]">
                SYNC OK
              </span>
            </div>
          </div>
        </div>

        {/* 2. COUNTER POS: MECHANICAL KEYCAP MATRIX + THERMAL RECEIPT TAPE */}
        {(focus === "all" || focus === "counter") && (
          <section
            aria-labelledby="world-a-pos"
            className="grid grid-cols-1 lg:grid-cols-12 gap-0 border-b border-[#191919]"
          >
            {/* Left 8 Columns: Hardware Keycap Matrix */}
            <div className="lg:col-span-8 lg:border-r border-[#191919] bg-[#EAE6DC]">
              {/* Control Bar: Multiplier Strip + Barcode Trigger + Monospace Input */}
              <div className="p-3 sm:p-4 border-b border-[#191919] bg-[#F2F0EB] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span id="world-a-pos" className="text-[11px] font-bold uppercase tracking-widest">
                    KEYCAP-POS
                  </span>
                  <div className="inline-flex border border-[#191919] bg-[#DEDAD0]">
                    {([1, 2, 5] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMultiplier(m)}
                        className={`px-2.5 py-1 text-xs font-bold transition-colors border-r last:border-r-0 border-[#191919] ${
                          multiplier === m ? "bg-[#191919] text-[#F2F0EB]" : "hover:bg-[#E7E3D9]"
                        }`}
                      >
                        ×{m}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleSimulateScan}
                    className="px-2.5 py-1 text-[11px] font-bold uppercase border border-[#191919] bg-[#E96A26] text-white active:translate-y-[1px]"
                  >
                    SCAN GTIN
                  </button>
                  <button
                    type="button"
                    onClick={clearCart}
                    className="px-2.5 py-1 text-[11px] font-bold uppercase border border-[#191919] bg-[#F8F7F3] hover:bg-[#E2DFD5]"
                  >
                    CLR
                  </button>
                </div>

                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={lang === "EN" ? "FILTER SKU / GTIN..." : "TAFUTA SKU..."}
                  className="px-3 py-1.5 text-xs bg-[#141413] text-[#F5F2EA] placeholder:text-[#7D7A70] border border-[#191919] focus:outline-none w-full sm:w-56"
                />
              </div>

              {/* 2x3 or 3x2 Recessed Physical Keycaps */}
              <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredMedicines.map((med, idx) => {
                  const totalAvail = med.batches.reduce((s, b) => s + b.qty, 0);
                  const soonest = [...med.batches].sort((a, b) => a.expiresInDays - b.expiresInDays)[0];
                  const inCart = cart[med.id] ?? 0;
                  const isShort = (soonest?.expiresInDays ?? 999) <= 30;
                  const litSegments = Math.max(1, Math.min(10, Math.round((totalAvail / 40) * 10)));

                  return (
                    <button
                      key={med.id}
                      type="button"
                      disabled={totalAvail === 0}
                      onClick={() => addToCart(med.id, multiplier)}
                      className={`text-left p-3.5 border border-[#191919] border-b-[4px] active:border-b active:translate-y-[3px] transition-all flex flex-col justify-between gap-3 disabled:opacity-40 ${
                        inCart > 0
                          ? "bg-[#FFFDF8] border-b-[#E96A26]"
                          : "bg-[#F8F7F3] border-b-[#9C978B] hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#191919] text-[#F2F0EB]">
                          [{fnKeys[idx] ?? `K${idx + 1}`}]
                        </span>
                        <div className="flex items-center gap-1.5">
                          {med.requiresRx && (
                            <span className="text-[10px] font-bold text-[#B45309] border border-[#B45309] px-1">
                              RX
                            </span>
                          )}
                          {inCart > 0 && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#E96A26] text-white tabular-nums">
                              QTY:{inCart}
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-tight leading-snug">{med.name}</p>
                        <p className="text-[10px] text-[#595750] mt-0.5">
                          {soonest?.lotCode} · {soonest?.expiryLabel}
                        </p>
                      </div>

                      {/* 10-Segment LED Gauge */}
                      <div className="space-y-1.5">
                        <div className="grid grid-cols-10 gap-0.5" aria-hidden="true">
                          {Array.from({ length: 10 }).map((_, segIdx) => {
                            const lit = segIdx < litSegments;
                            const segColor = !lit
                              ? "#DCD8CE"
                              : isShort && segIdx < 4
                                ? "#E96A26"
                                : "#059669";
                            return (
                              <span
                                key={segIdx}
                                className="h-1.5 block"
                                style={{ backgroundColor: segColor }}
                              />
                            );
                          })}
                        </div>
                        <div className="flex items-center justify-between text-[11px] font-bold tabular-nums">
                          <span>{formatTzs(med.priceTzs)}</span>
                          <span className={isShort ? "text-[#E96A26]" : "text-[#595750]"}>
                            {totalAvail}U
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right 4 Columns: Serrated Thermal Paper Tape */}
            <aside className="lg:col-span-4 bg-[#DEDAD0] p-4 flex flex-col justify-between">
              <div className="bg-[#FAF8F2] border-x border-[#B9B3A5] shadow-sm relative">
                {/* SVG Zig-Zag Top Teeth */}
                <svg className="w-full h-2.5 block -mt-2" viewBox="0 0 240 10" preserveAspectRatio="none">
                  <polygon
                    points="0,10 10,0 20,10 30,0 40,10 50,0 60,10 70,0 80,10 90,0 100,10 110,0 120,10 130,0 140,10 150,0 160,10 170,0 180,10 190,0 200,10 210,0 220,10 230,0 240,10"
                    fill="#FAF8F2"
                  />
                </svg>

                <div className="p-4 space-y-3 text-xs">
                  <div className="border-b border-dashed border-[#8E8A7F] pb-2 text-center space-y-0.5">
                    <p className="font-bold tracking-[0.14em] uppercase">CERVOS // THERMAL-01</p>
                    <p className="text-[10px] text-[#595750]">KARIAKOO TILL · FEFO AUTO-EXTRACTION</p>
                  </div>

                  {cartLines.length === 0 ? (
                    <div className="py-10 text-center text-[11px] text-[#595750] uppercase">
                      {lang === "EN" ? "--- PRESS KEYCAP TO PRINT LOT ---" : "--- GUSA KITUFA KUANZA ---"}
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {cartLines.map(({ med, qty, fefoPicks, lineTotal }) => {
                        const needsRxNow = med.requiresRx && !verifiedRxIds[med.id];
                        return (
                          <div key={med.id} className="border-b border-dashed border-[#CBC5B7] pb-2.5 space-y-1.5">
                            <div className="flex justify-between font-bold">
                              <span className="uppercase">{qty}× {med.name}</span>
                              <span className="tabular-nums">{formatTzs(lineTotal)}</span>
                            </div>
                            <div className="space-y-0.5 text-[10px] text-[#595750]">
                              {fefoPicks.map((p) => (
                                <p key={p.lotCode} className="tabular-nums">
                                  &gt; {p.lotCode} -&gt; {p.qty} {p.qty === 1 ? "UNIT" : "UNITS"} ({p.expiryLabel})
                                </p>
                              ))}
                            </div>
                            <div className="flex items-center justify-between pt-1">
                              <div className="inline-flex border border-[#191919]">
                                <button
                                  type="button"
                                  aria-label={`Decrease ${med.name}`}
                                  onClick={() => addToCart(med.id, -1)}
                                  className="px-2 py-0.5 text-[11px] font-bold hover:bg-[#EAE6DC]"
                                >
                                  -
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Increase ${med.name}`}
                                  onClick={() => addToCart(med.id, 1)}
                                  className="px-2 py-0.5 text-[11px] font-bold border-l border-[#191919] hover:bg-[#EAE6DC]"
                                >
                                  +
                                </button>
                              </div>

                              {med.requiresRx && (
                                <button
                                  type="button"
                                  onClick={() => toggleVerifyRx(med.id)}
                                  className={`px-2 py-0.5 text-[10px] font-bold uppercase border ${
                                    needsRxNow
                                      ? "border-[#B45309] text-[#B45309] bg-[#B45309]/10"
                                      : "border-[#059669] text-[#059669] bg-[#059669]/10"
                                  }`}
                                >
                                  {needsRxNow ? "[ VERIFY RX ]" : "[ RX LOCKED OK ]"}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="border-t-2 border-dashed border-[#191919] pt-2.5 flex items-baseline justify-between">
                    <span className="text-[11px] font-bold uppercase">TOTAL DUE</span>
                    <span className="text-xl font-bold tabular-nums">{formatTzs(cartTotal)}</span>
                  </div>

                  <button
                    type="button"
                    disabled={cartLines.length === 0 || needsRxVerification}
                    onClick={openCheckout}
                    className="w-full py-3 text-xs font-bold uppercase tracking-widest bg-[#E96A26] text-white border border-[#191919] border-b-[3px] active:translate-y-[2px] disabled:opacity-40"
                  >
                    {needsRxVerification
                      ? "[ RX INTERLOCK ACTIVE ]"
                      : `[ ENGAGE CHARGE ${formatTzs(cartTotal)} ]`}
                  </button>
                </div>

                {/* SVG Zig-Zag Bottom Teeth */}
                <svg className="w-full h-2.5 block -mb-2 rotate-180" viewBox="0 0 240 10" preserveAspectRatio="none">
                  <polygon
                    points="0,10 10,0 20,10 30,0 40,10 50,0 60,10 70,0 80,10 90,0 100,10 110,0 120,10 130,0 140,10 150,0 160,10 170,0 180,10 190,0 200,10 210,0 220,10 230,0 240,10"
                    fill="#FAF8F2"
                  />
                </svg>
              </div>
            </aside>
          </section>
        )}

        {/* 3. OWNER & SUPPLIER: VU-METER TELEMETRY & FIELD OSCILLOSCOPE MAP */}
        {(focus === "all" || focus === "owner" || focus === "supplier") && (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-0 border-b border-[#191919]">
            {(focus === "all" || focus === "owner") && (
              <div
                className={`${
                  focus === "owner" ? "lg:col-span-12" : "lg:col-span-5 lg:border-r border-[#191919]"
                } p-4 sm:p-5 bg-[#F8F7F3] space-y-4`}
              >
                <div className="flex items-center justify-between border-b border-[#191919] pb-2">
                  <span className="text-[11px] font-bold uppercase tracking-widest">
                    OWNER // BRAUN VU-METER CHANNELS
                  </span>
                  <span className="text-[10px] text-[#059669] font-bold">ALL DRAWERS LOCKED</span>
                </div>

                <div className="space-y-2.5">
                  {branches.map((br, i) => {
                    const active = selectedBranch === br.id;
                    const blocks = Math.max(2, Math.round((br.healthPct / 100) * 16));
                    return (
                      <button
                        key={br.id}
                        type="button"
                        onClick={() => setSelectedBranch(br.id)}
                        className={`w-full text-left p-3 border transition-colors ${
                          active
                            ? "border-[#191919] bg-white"
                            : "border-[#CBC5B7] bg-[#F2F0EB] hover:border-[#191919]"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                          <span>CH-0{i + 1} · {br.name.toUpperCase()}</span>
                          <span className="tabular-nums">{formatTzs(br.sales)}</span>
                        </div>
                        <div className="grid grid-cols-16 gap-0.5 mb-1.5" style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))" }}>
                          {Array.from({ length: 16 }).map((_, idx) => {
                            const lit = idx < blocks;
                            const fill = !lit
                              ? "#DEDAD0"
                              : br.alert && idx > 10
                                ? "#E96A26"
                                : idx > 13
                                  ? "#F59E0B"
                                  : "#059669";
                            return <span key={idx} className="h-2 block" style={{ backgroundColor: fill }} />;
                          })}
                        </div>
                        <p className="text-[10px] text-[#595750]">
                          {lang === "EN" ? br.stateEn : br.stateSw}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Mechanical Restock Toggle Module */}
                <div className="p-3.5 border border-[#191919] bg-[#EAE6DC] space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>RESTOCK RELAY // AMOX-500 × 40</span>
                    <span className={restockApproved ? "text-[#059669]" : "text-[#E96A26]"}>
                      {restockApproved ? "[ RELAY CLOSED ]" : "[ 4D RESERVE ]"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={openInspector}
                      className="px-3 py-1.5 text-[11px] font-bold uppercase border border-[#191919] bg-[#F8F7F3] hover:bg-white"
                    >
                      [ INSPECT +33% MARGIN ]
                    </button>
                    <button
                      type="button"
                      disabled={restockApproved}
                      onClick={handleApproveRestock}
                      className="px-3 py-1.5 text-[11px] font-bold uppercase border border-[#191919] bg-[#191919] text-[#F2F0EB] disabled:opacity-50"
                    >
                      {restockApproved ? "Restock sent" : "Restock · TZS 360,000"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {(focus === "all" || focus === "supplier") && (
              <div
                className={`${
                  focus === "supplier" ? "lg:col-span-12" : "lg:col-span-7"
                } p-4 sm:p-5 bg-[#F2F0EB] flex flex-col justify-between gap-4`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-[#191919] pb-2">
                    <span className="text-[11px] font-bold uppercase tracking-widest">
                      SUPPLIER MANIFEST // DAR COURIER GRID
                    </span>
                    <span className="text-[10px] font-bold tabular-nums">
                      6.8229° S · 39.2725° E
                    </span>
                  </div>

                  {/* Tabular Manifest Terminal */}
                  <div className="border border-[#191919] bg-[#F8F7F3] divide-y divide-[#CBC5B7]">
                    {supplierOrders.map((ord) => (
                      <div
                        key={ord.id}
                        className="p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-bold mr-2">[{ord.id}]</span>
                          <span className="font-semibold">{ord.pharmacy}</span>
                          <p className="text-[10px] text-[#595750] truncate">{ord.itemsSummary}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-bold tabular-nums">{formatTzs(ord.amountTzs)}</span>
                          {ord.status !== "delivered" ? (
                            <button
                              type="button"
                              onClick={() => handleAdvanceSupplierOrder(ord.id)}
                              className="px-2 py-1 text-[10px] font-bold uppercase bg-[#191919] text-white"
                            >
                              {ord.status === "incoming" ? "DISPATCH" : "CONFIRM DELIVERY"}
                            </button>
                          ) : (
                            <span className="px-2 py-1 text-[10px] font-bold uppercase bg-[#059669]/15 text-[#059669]">
                              SETTLED
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Coordinate-Framed Live Map */}
                <div className="border border-[#191919] relative bg-white">
                  <div className="px-3 py-1 bg-[#141413] text-[#F5F2EA] text-[10px] flex justify-between">
                    <span>RADAR // DAR CORRIDOR TELEMETRY</span>
                    <span className="text-[#E96A26]">+ 4 LIVE NODES +</span>
                  </div>
                  <div key={`map-${theme.id}-${focus}`} className="h-[260px] w-full">
                    <MapClientWrapper
                      key={`leaflet-${theme.id}`}
                      center={[-6.805, 39.265]}
                      zoom={12}
                      markers={LAB_MARKERS}
                      routes={LAB_ROUTES}
                      defaultStyle="light"
                      className="h-full w-full"
                    />
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* 4. COMPONENT SPEC SHEET + SKILLS MATRIX */}
        {(focus === "all" || focus === "components") && (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-0 bg-[#F8F7F3]">
            <div className="lg:col-span-7 lg:border-r border-[#191919] p-4 sm:p-5 space-y-4">
              <div className="text-[11px] font-bold uppercase tracking-widest border-b border-[#191919] pb-2">
                @cervos/ui v2 // HARDWARE SPECIMEN
              </div>
              <div className="inline-flex border border-[#191919]">
                {(["owners", "counter", "suppliers"] as const).map((seg) => (
                  <button
                    key={seg}
                    type="button"
                    onClick={() => setSelectedSegment(seg)}
                    className={`px-3 py-1.5 text-[11px] font-bold uppercase border-r last:border-r-0 border-[#191919] ${
                      selectedSegment === seg ? "bg-[#191919] text-white" : "bg-[#F2F0EB]"
                    }`}
                  >
                    {seg}
                  </button>
                ))}
              </div>
              <div className="p-3.5 border border-[#191919] bg-[#F2F0EB] space-y-2.5 text-xs">
                <p className="font-bold uppercase text-[#E96A26]">STEP 0{wizardStep} / 03 // SETUP RELAY</p>
                <p>
                  {wizardStep === 1 && "SELECT BRANCH UNIT FOR HARDWARE DEPLOYMENT."}
                  {wizardStep === 2 && "SET 4-DIGIT CASHIER PIN INTERLOCK."}
                  {wizardStep === 3 && "ARM 45-MIN BAHARI WHOLESALE AUTO-RESTOCK."}
                </p>
                <button
                  type="button"
                  onClick={() => setWizardStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : 1))}
                  className="px-3 py-1.5 text-[11px] font-bold uppercase bg-[#191919] text-white"
                >
                  {wizardStep < 3 ? "STEP NEXT ->" : "RESET"}
                </button>
              </div>
            </div>

            <div className="lg:col-span-5 p-4 sm:p-5 space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-widest border-b border-[#191919] pb-2">
                CURATED SKILLS // E:\Repo\.agents\skills
              </div>
              <div className="space-y-1.5 text-[11px]">
                {MOUNTED_SKILLS.map((sk) => (
                  <div key={sk.name} className="flex justify-between gap-2 border-b border-[#DEDAD0] pb-1.5">
                    <span className="font-bold">{sk.name}</span>
                    <span className="text-[#595750] text-right">{sk.source}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   WORLD B: EDITORIAL APOTHECARY JOURNAL (Aesop × One Medical Journal)
   ═══════════════════════════════════════════════════════════════════════════ */
function WorldBApothecary(props: LabWorldProps) {
  const {
    theme,
    lang,
    focus,
    setFocus,
    filteredMedicines,
    searchQuery,
    setSearchQuery,
    cart,
    cartLines,
    cartTotal,
    needsRxVerification,
    verifiedRxIds,
    toggleVerifyRx,
    addToCart,
    clearCart,
    handleSimulateScan,
    openCheckout,
    todayRevenue,
    txCount,
    branches,
    selectedBranch,
    setSelectedBranch,
    restockApproved,
    handleApproveRestock,
    openInspector,
    supplierOrders,
    handleAdvanceSupplierOrder,
    wizardStep,
    setWizardStep,
    selectedSegment,
    setSelectedSegment,
  } = props;

  const romans = ["i.", "ii.", "iii.", "iv.", "v.", "vi."];
  const activeBranchObj = branches.find((b) => b.id === selectedBranch) ?? branches[0];

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-10 py-10 space-y-14 text-[#14211B]">
      {/* Masthead Editorial Navigation */}
      <div className="border-b border-[#D8D2C5] pb-5 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#5B645D]">
            Volume II · {lang === "EN" ? "Apothecary Monograph" : "Kitabu cha Dawa"}
          </p>
          <h1 className="font-serif text-3xl sm:text-5xl font-normal tracking-tight mt-1">
            {lang === "EN"
              ? "Quiet care at the Kariakoo dispensary."
              : "Utulivu na uaminifu katika huduma ya dawa."}
          </h1>
        </div>

        <nav className="flex flex-wrap gap-4 text-xs border-b border-transparent">
          {(
            [
              { id: "all", label: "Complete Folio" },
              { id: "owner", label: "I. Morning Letter" },
              { id: "counter", label: "II. Shelf Ledges" },
              { id: "supplier", label: "III. Courier Atlas" },
              { id: "components", label: "IV. Herbarium" },
            ] as const
          ).map((ch) => (
            <button
              key={ch.id}
              type="button"
              onClick={() => setFocus(ch.id)}
              className={`pb-1 transition-colors border-b ${
                focus === ch.id
                  ? "border-[#0F5338] text-[#0F5338] font-semibold"
                  : "border-transparent text-[#5B645D] hover:text-[#14211B]"
              }`}
            >
              {ch.label}
            </button>
          ))}
        </nav>
      </div>

      {/* CHAPTER I: INTERACTIVE NATURAL-LANGUAGE MORNING LETTER */}
      {(focus === "all" || focus === "owner") && (
        <section aria-labelledby="world-b-letter" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start border-b border-[#D8D2C5] pb-12">
          <div className="lg:col-span-3 space-y-2">
            <p className="font-serif italic text-sm text-[#0F5338]">Chapter I</p>
            <h2 id="world-b-letter" className="text-xs uppercase tracking-[0.18em] text-[#5B645D]">
              Morning Pulse Letter
            </h2>
            <p className="text-xs leading-relaxed text-[#5B645D]">
              {lang === "EN"
                ? "Select any branch inline to read its morning position."
                : "Gusa tawi lolote ndani ya barua kusoma taarifa yake."}
            </p>
          </div>

          <div className="lg:col-span-9 space-y-6">
            <p className="font-serif text-xl sm:text-[26px] leading-[1.55] text-[#14211B]">
              {lang === "EN" ? "Good morning. Across your dispensary desk at " : "Habari za asubuhi. Katika tawi la "}
              <span className="inline-flex flex-wrap gap-1.5 align-baseline mx-1">
                {branches.map((br) => (
                  <button
                    key={br.id}
                    type="button"
                    onClick={() => setSelectedBranch(br.id)}
                    className={`px-2.5 py-0.5 text-base sm:text-lg font-sans font-medium rounded-full border transition-all ${
                      selectedBranch === br.id
                        ? "bg-[#0F5338] text-[#FAF7F1] border-[#0F5338]"
                        : "bg-transparent text-[#14211B] border-[#C9C1B0] hover:border-[#0F5338]"
                    }`}
                  >
                    {br.shortName}
                  </button>
                ))}
              </span>
              {lang === "EN" ? ", shelves sit at " : ", dawa ziko salama kwa "}
              <span className="underline decoration-[#0F5338]/40 underline-offset-4">
                {activeBranchObj.healthPct}% healthy stock
              </span>
              {lang === "EN" ? " with " : " zikiwa na mauzo ya "}
              <span className="font-mono text-lg sm:text-xl font-semibold text-[#0F5338] tabular-nums">
                {formatTzs(activeBranchObj.id === "kariakoo" ? todayRevenue : activeBranchObj.sales)}
              </span>
              {lang === "EN" ? ` recorded across ${txCount} unhurried patient visits today.` : ` kupitia wagonjwa ${txCount} leo.`}
            </p>

            {/* Quiet Margin & Replenishment Footnote Strip */}
            <div className="pt-4 border-t border-[#E4DDD0] flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-[#5B645D]">
                <span className="font-medium text-[#14211B]">Advisory note:</span> Amoxicillin 500mg reserve has 4 days remaining (40 boxes prepared at Bahari Wholesale).
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <button
                  type="button"
                  onClick={openInspector}
                  className="underline decoration-[#0F5338]/50 underline-offset-4 text-[#14211B] hover:text-[#0F5338] font-medium"
                >
                  Inspect formulation &amp; +33% margin slip
                </button>
                <button
                  type="button"
                  disabled={restockApproved}
                  onClick={handleApproveRestock}
                  className="px-4 py-2 rounded-full border border-[#0F5338] text-[#0F5338] hover:bg-[#0F5338] hover:text-[#FAF7F1] transition-colors font-medium disabled:opacity-50"
                >
                  {restockApproved ? "Restock sent to Bahari" : "Approve restock of 40 boxes"}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CHAPTER II: APOTHECARY SPECIMEN SHELVES + COUNTER MORTAR TRAY */}
      {(focus === "all" || focus === "counter") && (
        <section aria-labelledby="world-b-dispensary" className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start border-b border-[#D8D2C5] pb-12">
          {/* Left: Horizontal Linen Shelf Ledges */}
          <div className="lg:col-span-7 space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="font-serif italic text-sm text-[#0F5338]">Chapter II</p>
                <h2 id="world-b-dispensary" className="font-serif text-2xl font-normal">
                  {lang === "EN" ? "Apothecary Formulations & Shelf Provenance" : "Orodha ya Dawa na Asili ya Makundi"}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleSimulateScan}
                className="text-xs font-medium underline underline-offset-4 text-[#0F5338]"
              >
                + Scan GTIN Amber Vial
              </button>
            </div>

            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === "EN" ? "Search Latin name, formulation, or barcode..." : "Tafuta jina la dawa..."}
              className="w-full bg-transparent border-b border-[#BFB7A6] py-2.5 text-sm placeholder:text-[#7B827B] focus:outline-none focus:border-[#0F5338]"
            />

            <div className="divide-y divide-[#D8D2C5] border-t border-[#D8D2C5]">
              {filteredMedicines.map((med, i) => {
                const totalAvail = med.batches.reduce((s, b) => s + b.qty, 0);
                const soonest = [...med.batches].sort((a, b) => a.expiresInDays - b.expiresInDays)[0];
                const inCart = cart[med.id] ?? 0;
                const isShort = (soonest?.expiresInDays ?? 999) <= 30;

                return (
                  <div
                    key={med.id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#EFE9DD]/60 px-2 -mx-2 transition-colors"
                  >
                    <div className="flex items-start gap-3.5">
                      <span className="font-serif italic text-sm text-[#7B827B] w-5 pt-0.5 shrink-0">
                        {romans[i] ?? `${i + 1}.`}
                      </span>
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-medium">{med.name}</h3>
                          {med.requiresRx && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#9A6700]/10 text-[#9A6700]">
                              Pharmacist Check
                            </span>
                          )}
                        </div>
                        <p className="font-serif italic text-xs text-[#5B645D]">{med.latinSubtitle}</p>
                        <p className="text-xs text-[#5B645D]">
                          {med.vialNote} · <span className="font-mono">{soonest?.lotCode} ({soonest?.expiryLabel})</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pl-8 sm:pl-0">
                      <div className="text-right">
                        <p className="font-mono text-sm font-medium tabular-nums">{formatTzs(med.priceTzs)}</p>
                        <p className={`text-[11px] ${isShort ? "text-[#9A6700]" : "text-[#0F5338]"}`}>
                          {totalAvail} left
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={totalAvail === 0}
                        onClick={() => addToCart(med.id, 1)}
                        className={`px-3.5 py-1.5 text-xs font-medium rounded-full border transition-all active:scale-[0.98] disabled:opacity-40 ${
                          inCart > 0
                            ? "bg-[#0F5338] text-[#FAF7F1] border-[#0F5338]"
                            : "border-[#BFB7A6] text-[#14211B] hover:border-[#0F5338]"
                        }`}
                      >
                        {inCart > 0 ? `On Tray (${inCart}) +` : "+ Place on Tray"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Bespoke Prescription & Dispensary Linen Tray */}
          <aside className="lg:col-span-5 bg-[#FAF7F1] border border-[#D8D2C5] p-6 sm:p-7 space-y-5 shadow-[0_8px_30px_rgba(20,33,27,0.04)]">
            <div className="border-b border-[#E5DFD3] pb-4 flex items-baseline justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#5B645D]">Dispensary Slip No. 01</p>
                <h3 className="font-serif text-xl mt-0.5">
                  {lang === "EN" ? "Patient Counter Tray" : "Sinia ya Mteja"}
                </h3>
              </div>
              {cartLines.length > 0 && (
                <button type="button" onClick={clearCart} className="text-xs text-[#5B645D] underline">
                  Clear tray
                </button>
              )}
            </div>

            {cartLines.length === 0 ? (
              <p className="py-10 font-serif italic text-center text-sm text-[#5B645D]">
                Select any botanical or clinical preparation from the shelf to compose this patient slip.
              </p>
            ) : (
              <div className="space-y-4">
                {cartLines.map(({ med, qty, fefoPicks, lineTotal }) => {
                  const needsRxNow = med.requiresRx && !verifiedRxIds[med.id];
                  return (
                    <div key={med.id} className="border-b border-[#EAE3D5] pb-3.5 space-y-1.5">
                      <div className="flex justify-between items-baseline">
                        <p className="font-medium text-sm">{med.name}</p>
                        <span className="font-mono text-sm tabular-nums">{formatTzs(lineTotal)}</span>
                      </div>
                      <p className="text-[11px] font-mono text-[#5B645D]">
                        Provenance: {fefoPicks.map((p) => `${p.qty}× ${p.lotCode}`).join(" + ")}
                      </p>
                      <div className="flex items-center justify-between pt-1">
                        <div className="inline-flex items-center gap-3 text-xs">
                          <button
                            type="button"
                            onClick={() => addToCart(med.id, -1)}
                            className="w-6 h-6 rounded-full border border-[#D8D2C5] hover:border-[#14211B]"
                          >
                            −
                          </button>
                          <span className="font-mono tabular-nums">{qty}</span>
                          <button
                            type="button"
                            onClick={() => addToCart(med.id, 1)}
                            className="w-6 h-6 rounded-full border border-[#D8D2C5] hover:border-[#14211B]"
                          >
                            +
                          </button>
                        </div>

                        {med.requiresRx && (
                          <button
                            type="button"
                            onClick={() => toggleVerifyRx(med.id)}
                            className={`text-xs underline underline-offset-4 ${
                              needsRxNow ? "text-[#9A6700]" : "text-[#0F5338]"
                            }`}
                          >
                            {needsRxNow ? "Sign Pharmacist Check" : "Pharmacist signed"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                <div className="pt-2 flex items-baseline justify-between">
                  <span className="font-serif italic text-sm text-[#5B645D]">Compounded Total</span>
                  <span className="font-serif text-2xl tabular-nums">{formatTzs(cartTotal)}</span>
                </div>

                <button
                  type="button"
                  disabled={needsRxVerification}
                  onClick={openCheckout}
                  className="w-full py-3.5 rounded-full bg-[#0F5338] text-[#FAF7F1] text-sm font-medium tracking-wide transition-transform active:scale-[0.99] disabled:opacity-40"
                >
                  {needsRxVerification ? "Sign Pharmacist Check Above" : `Settle Receipt · ${formatTzs(cartTotal)}`}
                </button>
              </div>
            )}
          </aside>
        </section>
      )}

      {/* CHAPTER III: PLATE III BOTANICAL ATLAS MAP */}
      {(focus === "all" || focus === "supplier") && (
        <section aria-labelledby="world-b-atlas" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start border-b border-[#D8D2C5] pb-12">
          <div className="lg:col-span-5 space-y-5">
            <div>
              <p className="font-serif italic text-sm text-[#0F5338]">Plate III</p>
              <h2 id="world-b-atlas" className="font-serif text-2xl font-normal">
                Dar es Salaam Courier Dispatch Atlas
              </h2>
            </div>

            <div className="divide-y divide-[#D8D2C5] border-t border-[#D8D2C5]">
              {supplierOrders.map((ord) => (
                <div key={ord.id} className="py-3.5 space-y-2">
                  <div className="flex justify-between items-baseline">
                    <p className="font-medium text-sm">{ord.pharmacy}</p>
                    <span className="font-mono text-xs tabular-nums">{formatTzs(ord.amountTzs)}</span>
                  </div>
                  <p className="text-xs text-[#5B645D]">{ord.itemsSummary}</p>
                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <span className="font-serif italic text-[#0F5338]">
                      {ord.status === "incoming"
                        ? "Awaiting parcel seal"
                        : ord.status === "dispatched"
                          ? `Courier en route · ${ord.eta}`
                          : "Received into ledger"}
                    </span>
                    {ord.status !== "delivered" && (
                      <button
                        type="button"
                        onClick={() => handleAdvanceSupplierOrder(ord.id)}
                        className="underline underline-offset-4 text-[#14211B] hover:text-[#0F5338]"
                      >
                        {ord.status === "incoming" ? "Seal & Dispatch →" : "Mark Received →"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7 p-2.5 bg-[#FAF7F1] border border-[#D8D2C5]">
            <div key={`map-${theme.id}-${focus}`} className="h-[300px] w-full">
              <MapClientWrapper
                key={`leaflet-${theme.id}`}
                center={[-6.805, 39.265]}
                zoom={12}
                markers={LAB_MARKERS}
                routes={LAB_ROUTES}
                defaultStyle="light"
                className="h-full w-full"
              />
            </div>
          </div>
        </section>
      )}

      {/* CHAPTER IV: HERBARIUM COMPONENTS & SKILLS */}
      {(focus === "all" || focus === "components") && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-6 space-y-4">
            <p className="font-serif italic text-sm text-[#0F5338]">Chapter IV</p>
            <h3 className="font-serif text-xl">Quiet Herbarium Primitives</h3>
            <div className="flex gap-2">
              {(["owners", "counter", "suppliers"] as const).map((seg) => (
                <button
                  key={seg}
                  type="button"
                  onClick={() => setSelectedSegment(seg)}
                  className={`px-3.5 py-1 text-xs rounded-full border ${
                    selectedSegment === seg ? "bg-[#0F5338] text-white border-[#0F5338]" : "border-[#C9C1B0]"
                  }`}
                >
                  {seg}
                </button>
              ))}
            </div>
            <div className="p-4 border border-[#D8D2C5] bg-[#FAF7F1] space-y-2.5">
              <p className="font-serif italic text-xs text-[#0F5338]">Note {wizardStep} of 3</p>
              <p className="text-sm">
                {wizardStep === 1 && "Which apothecary counter shall we initialize today?"}
                {wizardStep === 2 && "Select quiet 4-digit PIN sign-in for resident dispensers."}
                {wizardStep === 3 && "Paired with Bahari Wholesale for daily temperature-monitored drops."}
              </p>
              <button
                type="button"
                onClick={() => setWizardStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : 1))}
                className="text-xs underline underline-offset-4 font-medium"
              >
                {wizardStep < 3 ? "Next page →" : "Return to Note 1"}
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-3">
            <p className="font-serif italic text-sm text-[#0F5338]">Colophon</p>
            <h3 className="font-serif text-xl">Mounted Design Skills</h3>
            <div className="divide-y divide-[#D8D2C5] border-t border-[#D8D2C5]">
              {MOUNTED_SKILLS.map((sk) => (
                <div key={sk.name} className="py-2 flex justify-between gap-4 text-xs">
                  <span className="font-medium">{sk.name}</span>
                  <span className="text-[#5B645D] text-right">{sk.role}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

/* ── Shared Interactive Pharmacy Copilot Chat (Glass or Dark HUD variant) ── */
function CopilotChatPanel({
  variant,
  lang,
  chatMessages,
  chatInput,
  setChatInput,
  handleSendChat,
  onAddAmox,
  onBoostRestock,
  onOpenCheckout,
}: {
  variant: "glass" | "hud";
  lang: LangCode;
  chatMessages: ChatMessage[];
  chatInput: string;
  setChatInput: (v: string) => void;
  handleSendChat: (promptText?: string) => void;
  onAddAmox: () => void;
  onBoostRestock: () => void;
  onOpenCheckout: () => void;
}) {
  const isHud = variant === "hud";
  const quickPrompts =
    lang === "EN"
      ? ["Dispense 2 Amox 500", "Show expiry report", "Order more from Bahari"]
      : ["Toa 2 Amox 500", "Ripoti ya makundi FEFO", "Agiza zaidi Bahari"];

  return (
    <div
      className={
        isHud
          ? "rounded-[20px] bg-[#0D1322] border border-[#00E5FF]/30 shadow-[0_16px_44px_rgba(0,229,255,0.12)] flex flex-col justify-between overflow-hidden h-full"
          : "rounded-[22px] bg-white/82 backdrop-blur-2xl border border-white/95 border-b-[4px] border-r-[2px] shadow-[0_16px_42px_rgba(15,23,42,0.10)] flex flex-col justify-between overflow-hidden h-full"
      }
    >
      {/* Header */}
      <div
        className={`px-5 py-3.5 border-b flex items-center justify-between gap-2 ${
          isHud ? "border-white/10 bg-[#080C17]" : "border-black/5 bg-white/50"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="w-2.5 h-2.5 rounded-full animate-pulse"
            style={{ backgroundColor: isHud ? "#00E5FF" : "#0066EC" }}
          />
          <h3 className={`text-base sm:text-lg font-bold tracking-tight ${isHud ? "text-white" : "text-[#14171F]"}`}>
            {lang === "EN" ? "Cervos Assistant" : "Msaidizi wa Cervos"}
          </h3>
        </div>
        <span
          className={`-skew-x-12 px-2.5 py-0.5 text-xs font-bold uppercase ${
            isHud ? "bg-[#00E5FF]/15 text-[#00E5FF]" : "bg-[#0066EC]/12 text-[#0066EC]"
          }`}
        >
          Live Actions
        </span>
      </div>

      {/* Scrollable Chat History */}
      <div className="p-4 sm:p-5 space-y-3 max-h-[340px] overflow-y-auto flex-1">
        {chatMessages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div key={msg.id} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
              <div
                className={`max-w-[92%] px-4 py-3 text-sm sm:text-base leading-snug space-y-2 ${
                  isUser
                    ? isHud
                      ? "rounded-2xl rounded-br-sm bg-[#00E5FF] text-[#060913] font-semibold"
                      : "rounded-2xl rounded-br-sm bg-[#0066EC] text-white font-semibold shadow-sm"
                    : isHud
                      ? "rounded-2xl rounded-bl-sm bg-white/10 text-slate-100 border border-white/10"
                      : "rounded-2xl rounded-bl-sm bg-white/95 text-[#14171F] border border-black/5 shadow-sm"
                }`}
              >
                {msg.metricTag && (
                  <p
                    className={`text-xs font-mono font-bold uppercase tracking-wider ${
                      isHud ? "text-[#00E5FF]" : "text-[#0066EC]"
                    }`}
                  >
                    {msg.metricTag}
                  </p>
                )}
                <p>{msg.text}</p>

                {msg.bars && msg.bars.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {msg.bars.map((b) => (
                      <div key={b.label} className="space-y-1">
                        <div className="flex justify-between text-xs font-mono">
                          <span>{b.label}</span>
                          <span>{b.pct}%</span>
                        </div>
                        <div className={`h-2 rounded-full overflow-hidden ${isHud ? "bg-white/15" : "bg-black/10"}`}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${b.pct}%`,
                              backgroundColor:
                                b.tone === "warn" ? "#F59E0B" : b.tone === "safe" ? "#10B981" : isHud ? "#00E5FF" : "#0066EC",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {msg.actionLabel && msg.onActionKind && (
                  <button
                    type="button"
                    onClick={() => {
                      if (msg.onActionKind === "add-amox") onAddAmox();
                      if (msg.onActionKind === "boost-restock") onBoostRestock();
                      if (msg.onActionKind === "open-checkout") onOpenCheckout();
                    }}
                    className={`mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-transform active:scale-[0.97] ${
                      isHud
                        ? "bg-[#10B981] text-[#060913]"
                        : "bg-[#0066EC]/12 text-[#0066EC] hover:bg-[#0066EC] hover:text-white"
                    }`}
                  >
                    <span>{msg.actionLabel}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Diagonal Prompt Chips + Live Input */}
      <div className={`p-4 border-t space-y-3 ${isHud ? "border-white/10 bg-[#080C17]" : "border-black/5 bg-white/60"}`}>
        <div className="flex flex-wrap gap-2">
          {quickPrompts.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handleSendChat(p)}
              className={`-skew-x-6 px-3 py-1.5 text-xs sm:text-sm font-semibold border transition-all active:scale-[0.97] ${
                isHud
                  ? "border-[#00E5FF]/35 bg-[#0D1322] text-[#00E5FF] hover:bg-[#00E5FF] hover:text-[#060913]"
                  : "border-[#0066EC]/25 bg-white text-[#14171F] hover:bg-[#0066EC] hover:text-white"
              }`}
            >
              <span className="inline-block skew-x-6">{p}</span>
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendChat();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={lang === "EN" ? "Ask copilot: Amox FEFO, margin, dispense..." : "Uliza msaidizi..."}
            className={`flex-1 rounded-full px-4 py-2.5 text-sm sm:text-base focus:outline-none ${
              isHud
                ? "bg-[#131C31] text-white placeholder:text-slate-400 border border-white/15 focus:border-[#00E5FF]"
                : "bg-white text-[#14171F] placeholder:text-[#616166] border border-black/10 focus:border-[#0066EC]"
            }`}
          />
          <button
            type="submit"
            className={`px-5 py-2.5 rounded-full text-sm sm:text-base font-bold transition-transform active:scale-[0.97] ${
              isHud ? "bg-[#00E5FF] text-[#060913]" : "bg-[#0066EC] text-white"
            }`}
          >
            {lang === "EN" ? "Send" : "Tuma"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   WORLD C: KINETIC 3D DECK (Edge-Lit Radar, Diagonal HUD, Prism & Live Chat)
   ═══════════════════════════════════════════════════════════════════════════ */
function WorldCKineticLit(props: LabWorldProps) {
  const {
    theme,
    lang,
    focus,
    setFocus,
    filteredMedicines,
    searchQuery,
    setSearchQuery,
    cart,
    cartLines,
    cartTotal,
    totalCartItems,
    needsRxVerification,
    verifiedRxIds,
    toggleVerifyRx,
    addToCart,
    clearCart,
    handleSimulateScan,
    openCheckout,
    todayRevenue,
    txCount,
    branches,
    selectedBranch,
    setSelectedBranch,
    restockApproved,
    handleApproveRestock,
    openInspector,
    supplierOrders,
    handleAdvanceSupplierOrder,
    wizardStep,
    setWizardStep,
    selectedSegment,
    setSelectedSegment,
    chatMessages,
    chatInput,
    setChatInput,
    handleSendChat,
  } = props;

  const primaryOrder = supplierOrders[0];
  const courierStepIdx =
    primaryOrder?.status === "delivered" ? 3 : primaryOrder?.status === "dispatched" ? 2 : 1;

  // Radar polygon points per branch (5 metrics: Velocity, Margin, FEFO, SLA, Sync)
  const radarShapes: Record<string, string> = {
    kariakoo: "100,18 168,68 148,148 54,142 36,68",
    upanga: "100,28 158,64 138,140 62,146 42,74",
    mwenge: "100,42 150,72 132,126 70,132 48,80",
  };

  return (
    <div
      className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-28 space-y-6 text-[#F8FAFC]"
      style={{
        background:
          "radial-gradient(circle at 12% 10%, rgba(0,229,255,0.12), transparent 40%), radial-gradient(circle at 88% 18%, rgba(16,185,129,0.10), transparent 38%)",
      }}
    >
      {/* 1. CHAMFERED DIAGONAL 3D HERO BLADE + MULTI-AXIS BRANCH RADAR & WATERFALL */}
      {(focus === "all" || focus === "owner") && (
        <section aria-labelledby="world-c-hero" className="space-y-5">
          {/* Branch Telemetry Story Pills */}
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            {branches.map((br) => {
              const active = selectedBranch === br.id;
              return (
                <button
                  key={br.id}
                  type="button"
                  onClick={() => setSelectedBranch(br.id)}
                  className={`-skew-x-6 flex items-center gap-3 px-4 py-2 border transition-all shrink-0 active:scale-[0.97] ${
                    active
                      ? "bg-[#00E5FF]/15 border-[#00E5FF] shadow-[0_0_24px_rgba(0,229,255,0.2)]"
                      : "bg-[#0D1322] border-white/15 hover:border-[#00E5FF]/50"
                  }`}
                >
                  <div className="skew-x-6 flex items-center gap-3">
                    <span
                      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-mono font-bold border-2"
                      style={{
                        borderColor: br.alert ? "#F59E0B" : "#10B981",
                        color: br.alert ? "#F59E0B" : "#10B981",
                      }}
                    >
                      {Math.round(br.healthPct)}%
                    </span>
                    <div className="text-left">
                      <p className="text-sm font-bold leading-tight">{br.shortName}</p>
                      <p className="text-xs font-mono text-slate-300 tabular-nums">
                        {formatTzs(br.id === "kariakoo" ? todayRevenue : br.sales)}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Diagonal Chamfered 3D Hero Blade + Dual Lit Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Hero Blade + 3D Waterfall */}
            <div
              className="lg:col-span-7 bg-[#0D1322] border border-[#00E5FF]/35 border-b-[5px] p-6 sm:p-7 relative overflow-hidden space-y-6"
              style={{ clipPath: "polygon(0 0, 96% 0, 100% 10%, 100% 100%, 3% 100%, 0 90%)" }}
            >
              {/* Diagonal neon light slash */}
              <div
                aria-hidden="true"
                className="absolute -right-12 -top-12 w-56 h-[150%] -skew-x-12 pointer-events-none"
                style={{ background: "linear-gradient(180deg, rgba(0,229,255,0.14), rgba(16,185,129,0.03))" }}
              />

              <div className="relative flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <span className="-skew-x-12 inline-flex items-center gap-2 px-3 py-1 bg-[#10B981]/20 text-[#10B981] text-xs font-bold uppercase">
                    <span className="skew-x-12">+14.2% Velocity · {txCount} Dispenses</span>
                  </span>
                  <p id="world-c-hero" className="text-sm uppercase tracking-widest text-slate-400">
                    {lang === "EN" ? "Kinetic 3D Cash + M-Pesa Pulse" : "Mtiririko wa Mauzo wa 3D"}
                  </p>
                  <p className="text-4xl sm:text-6xl font-bold tracking-tight tabular-nums font-mono text-white">
                    {formatTzs(todayRevenue)}
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={openInspector}
                    className="-skew-x-6 px-4 py-2 border border-[#00E5FF]/40 bg-white/5 text-xs font-bold text-[#00E5FF] hover:bg-[#00E5FF]/15"
                  >
                    <span className="inline-block skew-x-6">Inspect +33% Margin</span>
                  </button>
                  <button
                    type="button"
                    disabled={restockApproved}
                    onClick={handleApproveRestock}
                    className="-skew-x-6 px-4 py-2 bg-[#10B981] text-[#060913] text-xs font-bold disabled:opacity-55"
                  >
                    <span className="inline-block skew-x-6">
                      {restockApproved ? "Restock sent" : "Restock from Bahari · 360k"}
                    </span>
                  </button>
                </div>
              </div>

              {/* 3D Margin & Settlement Waterfall Prism Chart */}
              <div className="relative pt-2 border-t border-white/10">
                <p className="text-xs font-mono uppercase tracking-wider text-[#00E5FF] mb-2">
                  3D Waterfall · Gross → Cost → Courier → Net Margin (+33%)
                </p>
                <svg className="w-full h-36" viewBox="0 0 460 120" fill="none">
                  {[
                    { label: "Gross", h: 92, x: 24, top: "#00E5FF", front: "#0284C7", val: "1.84M" },
                    { label: "COGS", h: 60, x: 132, top: "#94A3B8", front: "#475569", val: "-1.12M" },
                    { label: "Courier", h: 24, x: 240, top: "#F59E0B", front: "#B45309", val: "-110K" },
                    { label: "Net +33%", h: 76, x: 348, top: "#34D399", front: "#059669", val: "+610K" },
                  ].map((col) => {
                    const yTop = 104 - col.h;
                    return (
                      <g key={col.label}>
                        <polygon
                          points={`${col.x},${yTop} ${col.x + 18},${yTop - 10} ${col.x + 68},${yTop - 10} ${col.x + 50},${yTop}`}
                          fill={col.top}
                        />
                        <rect x={col.x} y={yTop} width="50" height={col.h} fill={col.front} />
                        <polygon
                          points={`${col.x + 50},${yTop} ${col.x + 68},${yTop - 10} ${col.x + 68},${94} ${col.x + 50},${104}`}
                          fill="#082F49"
                          fillOpacity="0.8"
                        />
                        <text x={col.x + 25} y={yTop - 14} textAnchor="middle" fill="#F8FAFC" fontSize="11" fontWeight="700">
                          {col.val}
                        </text>
                        <text x={col.x + 25} y="117" textAnchor="middle" fill="#94A3B8" fontSize="11">
                          {col.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* Multi-Axis Branch Radar Chart */}
            <div className="lg:col-span-5 bg-[#0D1322] border border-white/15 border-b-[4px] rounded-[20px] p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold">Branch Strength Radar</h3>
                  <p className="text-xs text-slate-400">Active: {branches.find((b) => b.id === selectedBranch)?.name}</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-[#00E5FF]/15 text-[#00E5FF]">
                  5-Axis Live
                </span>
              </div>

              <svg className="w-full max-w-[230px] mx-auto my-2" viewBox="0 0 200 175" fill="none">
                {[0.35, 0.65, 1].map((scale) => (
                  <polygon
                    key={scale}
                    points="100,15 178,70 148,158 52,158 22,70"
                    transform={`translate(${100 * (1 - scale)}, ${88 * (1 - scale)}) scale(${scale})`}
                    stroke="rgba(148,163,184,0.22)"
                    strokeWidth="1"
                  />
                ))}
                <polygon
                  points={radarShapes[selectedBranch] ?? radarShapes.kariakoo}
                  fill="rgba(0,229,255,0.22)"
                  stroke="#00E5FF"
                  strokeWidth="2.5"
                />
                <text x="100" y="10" textAnchor="middle" fill="#CBD5E1" fontSize="10" fontWeight="700">VELOCITY</text>
                <text x="184" y="72" textAnchor="start" fill="#CBD5E1" fontSize="9">SLA</text>
                <text x="155" y="170" textAnchor="middle" fill="#CBD5E1" fontSize="9">MARGIN</text>
                <text x="45" y="170" textAnchor="middle" fill="#CBD5E1" fontSize="9">FEFO</text>
                <text x="15" y="72" textAnchor="end" fill="#CBD5E1" fontSize="9">SYNC</text>
              </svg>
            </div>
          </div>
        </section>
      )}

      {/* 2. 3D ANGLED SPEED-DIAL COUNTER + MIDNIGHT LEDGER */}
      {(focus === "all" || focus === "counter") && (
        <section aria-labelledby="world-c-counter" className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-8 space-y-4">
            <div className="rounded-[20px] bg-[#0D1322] p-5 border border-white/15 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="world-c-counter" className="text-lg font-bold flex items-center gap-2">
                  <span className="-skew-x-12 px-2.5 py-0.5 bg-[#00E5FF] text-[#060913] text-xs font-bold">
                    Quick add
                  </span>
                  <span>Dispense fast</span>
                </h2>
                <button
                  type="button"
                  onClick={handleSimulateScan}
                  className="-skew-x-6 px-4 py-1.5 bg-[#10B981] text-[#060913] text-xs font-bold"
                >
                  <span className="inline-block skew-x-6">Scan GTIN</span>
                </button>
              </div>

              <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                {[
                  { id: "amox-500", label: "+1 Amox 500" },
                  { id: "alu-20", label: "+1 ALU Malaria" },
                  { id: "para-1g", label: "+1 Para 1g" },
                  { id: "ors-zinc", label: "+1 ORS Zinc" },
                ].map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => addToCart(q.id, 1)}
                    className="-skew-x-12 px-4 py-2.5 border border-[#00E5FF]/40 bg-[#131C31] hover:bg-[#00E5FF] hover:text-[#060913] text-sm font-bold transition-all shrink-0 border-b-[3px] active:translate-y-[1px]"
                  >
                    <span className="inline-block skew-x-12">{q.label}</span>
                  </button>
                ))}
              </div>

              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === "EN" ? "Search medicine or GTIN..." : "Tafuta dawa..."}
                className="w-full rounded-full bg-[#131C31] border border-white/15 px-5 py-3 text-base text-white placeholder:text-slate-400 focus:outline-none focus:border-[#00E5FF]"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredMedicines.map((med) => {
                  const totalAvail = med.batches.reduce((s, b) => s + b.qty, 0);
                  const soonest = [...med.batches].sort((a, b) => a.expiresInDays - b.expiresInDays)[0];
                  const inCart = cart[med.id] ?? 0;

                  return (
                    <button
                      key={med.id}
                      type="button"
                      disabled={totalAvail === 0}
                      onClick={() => addToCart(med.id, 1)}
                      className={`text-left p-4 rounded-[16px] border border-b-[3px] transition-all active:translate-y-[1px] flex items-center justify-between gap-3 ${
                        inCart > 0
                          ? "bg-[#00E5FF]/12 border-[#00E5FF]"
                          : "bg-[#131C31] border-white/10 hover:border-[#00E5FF]/50"
                      }`}
                    >
                      <div>
                        <p className="text-base font-bold text-white">{med.name}</p>
                        <p className="text-xs text-slate-300 mt-0.5">
                          {soonest?.lotCode} · {soonest?.expiryLabel}
                          {med.requiresRx ? " · Rx" : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-base font-bold tabular-nums text-[#00E5FF]">
                          {formatTzs(med.priceTzs)}
                        </p>
                        <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/10">
                          {inCart > 0 ? `${inCart}×` : "+ Add"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="lg:col-span-4 rounded-[20px] bg-[#0D1322] border border-[#00E5FF]/35 border-b-[4px] p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">3D Checkout Ledger</h3>
              {cartLines.length > 0 && (
                <button type="button" onClick={clearCart} className="text-xs text-slate-400 hover:text-white">
                  Clear
                </button>
              )}
            </div>

            {cartLines.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">
                Tap any Speed-Dial blade to charge.
              </p>
            ) : (
              <div className="space-y-3">
                {cartLines.map(({ med, qty, fefoPicks, lineTotal }) => {
                  const needsRxNow = med.requiresRx && !verifiedRxIds[med.id];
                  return (
                    <div key={med.id} className="p-3.5 rounded-[14px] bg-white/5 border border-white/10 space-y-2">
                      <div className="flex justify-between text-base font-semibold">
                        <span>{med.name}</span>
                        <span className="font-mono tabular-nums text-[#00E5FF]">{formatTzs(lineTotal)}</span>
                      </div>
                      <p className="text-xs font-mono text-slate-300">
                        {fefoPicks.map((p) => `${p.qty}× ${p.lotCode}`).join(" + ")}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="inline-flex items-center gap-2 bg-black/50 rounded-full px-2.5 py-1">
                          <button type="button" onClick={() => addToCart(med.id, -1)} className="px-1.5 font-bold">
                            −
                          </button>
                          <span className="font-mono text-sm tabular-nums">{qty}</span>
                          <button type="button" onClick={() => addToCart(med.id, 1)} className="px-1.5 font-bold">
                            +
                          </button>
                        </div>
                        {med.requiresRx && (
                          <button
                            type="button"
                            onClick={() => toggleVerifyRx(med.id)}
                            className={`px-3 py-1 rounded-full text-xs font-bold ${
                              needsRxNow ? "bg-amber-400 text-black" : "bg-emerald-400 text-black"
                            }`}
                          >
                            {needsRxNow ? "Verify Rx" : "Rx checked"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                <div className="pt-3 border-t border-white/15 flex items-baseline justify-between">
                  <span className="text-sm text-slate-400">Total Due</span>
                  <span className="text-3xl font-mono font-bold tabular-nums">{formatTzs(cartTotal)}</span>
                </div>

                <button
                  type="button"
                  disabled={needsRxVerification}
                  onClick={openCheckout}
                  className="-skew-x-6 w-full py-3.5 bg-[#00E5FF] text-[#060913] text-base font-bold transition-transform active:scale-[0.98] disabled:opacity-45"
                >
                  <span className="inline-block skew-x-6">
                    {needsRxVerification ? "Verify Rx Pill Above" : `Pay ${formatTzs(cartTotal)}`}
                  </span>
                </button>
              </div>
            )}
          </aside>
        </section>
      )}

      {/* 3. LIVE COPILOT CHAT + COURIER TRACKER MAP */}
      {(focus === "all" || focus === "supplier") && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <div className="lg:col-span-5">
            <CopilotChatPanel
              variant="hud"
              lang={lang}
              chatMessages={chatMessages}
              chatInput={chatInput}
              setChatInput={setChatInput}
              handleSendChat={handleSendChat}
              onAddAmox={() => addToCart("amox-500", 2)}
              onBoostRestock={handleApproveRestock}
              onOpenCheckout={openCheckout}
            />
          </div>

          <div className="lg:col-span-7 rounded-[20px] bg-[#0D1322] border border-white/15 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold">Live Courier Fulfillment</h2>
                <p className="text-xs text-slate-400">
                  {primaryOrder?.pharmacy} · {primaryOrder?.itemsSummary}
                </p>
              </div>
              {primaryOrder && primaryOrder.status !== "delivered" && (
                <button
                  type="button"
                  onClick={() => handleAdvanceSupplierOrder(primaryOrder.id)}
                  className="px-4 py-2 rounded-full bg-[#00E5FF] text-[#060913] text-xs font-bold"
                >
                  {primaryOrder.status === "incoming" ? "Send Rider" : "Complete Dropoff"}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {["Confirmed", "Packing", "En Route", "Delivered"].map((label, idx) => {
                const reached = idx <= courierStepIdx;
                return (
                  <div key={label} className="space-y-1">
                    <div
                      className="h-2 rounded-full"
                      style={{ backgroundColor: reached ? "#00E5FF" : "rgba(255,255,255,0.12)" }}
                    />
                    <p className={`text-xs font-semibold ${reached ? "text-white" : "text-slate-500"}`}>{label}</p>
                  </div>
                );
              })}
            </div>

            <div key={`map-${theme.id}-${focus}`} className="h-[250px] w-full rounded-[14px] overflow-hidden border border-white/15">
              <MapClientWrapper
                key={`leaflet-${theme.id}`}
                center={[-6.805, 39.265]}
                zoom={12}
                markers={LAB_MARKERS}
                routes={LAB_ROUTES}
                defaultStyle="light"
                className="h-full w-full"
              />
            </div>
          </div>
        </section>
      )}

      {/* 4. COMPONENTS */}
      {(focus === "all" || focus === "components") && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-6 rounded-[20px] bg-[#0D1322] p-5 border border-white/15 space-y-4">
            <h3 className="text-base font-bold">Kinetic HUD Controls</h3>
            <div className="inline-flex rounded-full bg-[#131C31] p-1 gap-1">
              {(["owners", "counter", "suppliers"] as const).map((seg) => (
                <button
                  key={seg}
                  type="button"
                  onClick={() => setSelectedSegment(seg)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize ${
                    selectedSegment === seg ? "bg-[#00E5FF] text-[#060913]" : "text-slate-400"
                  }`}
                >
                  {seg}
                </button>
              ))}
            </div>
            <div className="p-4 rounded-[14px] bg-[#131C31] flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-mono text-[#00E5FF]">STEP {wizardStep}/3</p>
                <p className="text-sm font-semibold mt-0.5">Pair M-Pesa Till &amp; Express Route</p>
              </div>
              <button
                type="button"
                onClick={() => setWizardStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : 1))}
                className="px-4 py-2 rounded-full bg-[#00E5FF] text-[#060913] text-xs font-bold"
              >
                Next
              </button>
            </div>
          </div>
          <div className="lg:col-span-6 rounded-[20px] bg-[#0D1322] p-5 border border-white/15 space-y-2.5">
            <h3 className="text-base font-bold">Mounted Design Intelligence</h3>
            {MOUNTED_SKILLS.map((sk) => (
              <div key={sk.name} className="flex items-center justify-between text-xs py-1.5 border-b last:border-b-0 border-white/10">
                <span className="font-bold text-[#00E5FF]">{sk.name}</span>
                <span className="text-slate-300 truncate max-w-[60%]">{sk.role}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Floating Glow HUD Dock */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-[92vw]">
        <div className="rounded-full bg-[#060913]/95 text-white px-3 py-2 shadow-[0_0_30px_rgba(0,229,255,0.22)] border border-[#00E5FF]/40 backdrop-blur-xl flex items-center gap-2 text-xs">
          {(["all", "counter", "owner", "supplier"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFocus(tab)}
              className={`px-3 py-1 rounded-full font-bold capitalize transition-colors ${
                focus === tab ? "bg-[#00E5FF] text-[#060913]" : "text-slate-300 hover:text-white"
              }`}
            >
              {tab}
            </button>
          ))}
          <span className="h-4 w-px bg-white/20 mx-0.5" />
          <button
            type="button"
            disabled={cartLines.length === 0 || needsRxVerification}
            onClick={openCheckout}
            className="px-3.5 py-1 rounded-full bg-[#10B981] text-[#060913] font-bold tabular-nums disabled:opacity-50"
          >
            {totalCartItems} · {formatTzs(cartTotal)}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   WORLD D: SPATIAL GLASS STUDIO (Bigger Type · 3D Extrusion · Diagonal · Chat)
   ═══════════════════════════════════════════════════════════════════════════ */
function WorldDSpatial(props: LabWorldProps) {
  const {
    theme,
    lang,
    focus,
    setFocus,
    depth3d,
    filteredMedicines,
    searchQuery,
    setSearchQuery,
    cart,
    cartLines,
    cartTotal,
    needsRxVerification,
    verifiedRxIds,
    toggleVerifyRx,
    addToCart,
    clearCart,
    handleSimulateScan,
    openCheckout,
    todayRevenue,
    txCount,
    branches,
    selectedBranch,
    setSelectedBranch,
    restockApproved,
    handleApproveRestock,
    openInspector,
    supplierOrders,
    handleAdvanceSupplierOrder,
    wizardStep,
    setWizardStep,
    selectedSegment,
    setSelectedSegment,
    chatMessages,
    chatInput,
    setChatInput,
    handleSendChat,
  } = props;

  const glassCard = depth3d
    ? "bg-white/80 backdrop-blur-2xl border border-white/95 border-b-[4px] border-r-[2px] shadow-[0_18px_46px_rgba(15,23,42,0.10)] rounded-[24px] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_56px_rgba(0,102,236,0.14)]"
    : "bg-white/78 backdrop-blur-2xl border border-white/85 shadow-[0_12px_40px_rgba(15,23,42,0.08)] rounded-[22px]";

  const card3dTilt: React.CSSProperties = depth3d
    ? { transform: "perspective(1350px) rotateX(1.2deg)" }
    : {};

  const revenuePct = Math.min(100, Math.round((todayRevenue / 2500000) * 100));
  const nowHeight = Math.min(108, Math.max(46, Math.round((todayRevenue / 2500000) * 105)));

  return (
    <div
      className="min-h-[calc(100vh-120px)] py-7 px-4 sm:px-6 text-[#14171F] relative overflow-x-hidden"
      style={{
        background:
          "radial-gradient(circle at 12% 14%, rgba(0, 102, 236, 0.16), transparent 44%), radial-gradient(circle at 86% 20%, rgba(22, 163, 74, 0.14), transparent 40%), radial-gradient(circle at 48% 85%, rgba(124, 58, 237, 0.12), transparent 50%), #E6ECF5",
      }}
    >
      {/* Ambient Diagonal Light Refraction Ribbon */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-y-0 left-1/3 w-72 -skew-x-12 opacity-40"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(0,102,236,0.08) 55%, rgba(255,255,255,0.35) 100%)",
        }}
      />

      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 items-start relative">
        {/* LEFT FLOATING SPATIAL GLASS DOCK */}
        <aside className="lg:sticky lg:top-32 flex lg:flex-col gap-2.5 p-2.5 rounded-[24px] bg-white/78 backdrop-blur-2xl border border-white/95 border-b-[4px] shadow-[0_14px_34px_rgba(15,23,42,0.09)] self-start overflow-x-auto max-w-full">
          {(
            [
              { id: "all", label: "All", title: "All Stage Windows" },
              { id: "counter", label: "⌘K", title: "Spotlight POS" },
              { id: "owner", label: "Pulse", title: "Health Rings" },
              { id: "supplier", label: "Map", title: "Spatial Fleet" },
              { id: "components", label: "UI", title: "Glass Kit" },
            ] as const
          ).map((dockItem) => {
            const active = focus === dockItem.id;
            return (
              <button
                key={dockItem.id}
                type="button"
                title={dockItem.title}
                onClick={() => setFocus(dockItem.id)}
                className={`w-14 h-12 rounded-[16px] text-sm font-bold flex flex-col items-center justify-center transition-all shrink-0 ${
                  active
                    ? "bg-[#0066EC] text-white shadow-[0_6px_18px_rgba(0,102,236,0.38)]"
                    : "text-[#505663] hover:bg-white hover:text-[#14171F]"
                }`}
              >
                <span>{dockItem.label}</span>
              </button>
            );
          })}
        </aside>

        {/* MAIN SPATIAL STAGE */}
        <div className="flex-1 w-full space-y-6">
          {/* TOP-CENTER ⌘K SPOTLIGHT OMNIBAR */}
          <div className="max-w-3xl mx-auto flex items-center gap-3 px-5 py-3.5 rounded-full bg-white/88 backdrop-blur-2xl border border-white border-b-[3px] shadow-[0_14px_36px_rgba(15,23,42,0.09)]">
            <span className="-skew-x-12 px-2.5 py-1 rounded-md bg-[#0066EC]/12 text-xs sm:text-sm font-mono font-bold text-[#0066EC]">
              <span className="inline-block skew-x-12">⌘K</span>
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                lang === "EN"
                  ? "Spotlight search medicine, scan barcode, or ask copilot..."
                  : "Tafuta dawa au skani moja kwa moja..."
              }
              className="flex-1 bg-transparent text-base sm:text-lg font-medium focus:outline-none placeholder:text-[#616166]"
            />
            <button
              type="button"
              onClick={handleSimulateScan}
              className="-skew-x-6 px-4 py-2 rounded-full text-sm font-bold bg-[#0066EC] text-white shadow-sm active:scale-[0.97]"
            >
              <span className="inline-block skew-x-6">Scan GTIN</span>
            </button>
          </div>

          {/* 1. APPLE HEALTH CONCENTRIC RINGS + 3D GLASS BRANCH WIDGETS */}
          {(focus === "all" || focus === "owner") && (
            <section aria-labelledby="world-d-rings" className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              <div
                className={`lg:col-span-5 ${glassCard} p-6 sm:p-7 flex flex-col sm:flex-row items-center gap-6 relative overflow-hidden`}
                style={card3dTilt}
              >
                {/* Diagonal refraction accent */}
                <div
                  aria-hidden="true"
                  className="absolute -right-8 -top-6 w-28 h-56 -skew-x-12 bg-gradient-to-b from-[#0066EC]/10 to-transparent pointer-events-none"
                />

                {/* Oversized Glowing 3-Ring SVG Gauge */}
                <svg className="w-36 h-36 sm:w-40 sm:h-40 shrink-0 -rotate-90 drop-shadow-sm" viewBox="0 0 120 120">
                  <defs>
                    <filter id="dRingGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="2.2" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>
                  <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(0,102,236,0.14)" strokeWidth="10" />
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke="#0066EC"
                    strokeWidth="10"
                    strokeLinecap="round"
                    filter="url(#dRingGlow)"
                    strokeDasharray={`${(revenuePct / 100) * 314} 314`}
                  />
                  <circle cx="60" cy="60" r="36" fill="none" stroke="rgba(22,163,74,0.16)" strokeWidth="10" />
                  <circle
                    cx="60"
                    cy="60"
                    r="36"
                    fill="none"
                    stroke="#16A34A"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${0.984 * 226} 226`}
                  />
                  <circle cx="60" cy="60" r="22" fill="none" stroke="rgba(245,158,11,0.18)" strokeWidth="10" />
                  <circle
                    cx="60"
                    cy="60"
                    r="22"
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${0.92 * 138} 138`}
                  />
                </svg>

                <div className="space-y-2.5 min-w-0 relative">
                  <span className="-skew-x-12 inline-block px-2.5 py-0.5 bg-[#0066EC]/12 text-[#0066EC] text-xs font-bold uppercase tracking-wider">
                    <span id="world-d-rings" className="inline-block skew-x-12">Pharmacy Activity Rings</span>
                  </span>
                  <p className="text-3xl sm:text-4xl font-bold tracking-tight tabular-nums font-mono">
                    {formatTzs(todayRevenue)}
                  </p>
                  <div className="space-y-1.5 text-sm font-medium">
                    <p className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#0066EC]" />
                      <span>Daily Target: {revenuePct}% ({txCount} sales)</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A]" />
                      <span>FEFO Health: 98.4% Fresh</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className={`lg:col-span-7 ${glassCard} p-6 sm:p-7 flex flex-col justify-between gap-4`} style={card3dTilt}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {branches.map((br) => (
                    <button
                      key={br.id}
                      type="button"
                      onClick={() => setSelectedBranch(br.id)}
                      className={`text-left p-4 rounded-[18px] border border-b-[3px] transition-all ${
                        selectedBranch === br.id
                          ? "bg-white border-[#0066EC] shadow-md -translate-y-0.5"
                          : "bg-white/55 border-white/80 hover:bg-white/90"
                      }`}
                    >
                      <p className="text-sm sm:text-base font-bold">{br.shortName}</p>
                      <p className="text-lg sm:text-xl font-mono font-bold tabular-nums mt-1 text-[#0066EC]">
                        {formatTzs(br.id === "kariakoo" ? todayRevenue : br.sales)}
                      </p>
                      <p className="text-xs sm:text-sm text-[#505663] mt-1">
                        {lang === "EN" ? br.stateEn : br.stateSw}
                      </p>
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-black/8">
                  <p className="text-sm font-medium text-[#505663]">
                    Amoxicillin 500mg · 40 boxes ready at Bahari Wholesale (+33% margin)
                  </p>
                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={openInspector}
                      className="px-4 py-2 rounded-full text-sm font-semibold bg-black/5 hover:bg-black/10"
                    >
                      Inspect Margin
                    </button>
                    <button
                      type="button"
                      disabled={restockApproved}
                      onClick={handleApproveRestock}
                      className="-skew-x-6 px-4 py-2 rounded-full text-sm font-bold bg-[#0066EC] text-white disabled:opacity-50"
                    >
                      <span className="inline-block skew-x-6">
                        {restockApproved ? "Restock sent" : "Approve restock"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 2. RAYCAST COMMAND-PALETTE LIST + APPLE PAY GLASS PASSBOOK */}
          {(focus === "all" || focus === "counter") && (
            <section aria-labelledby="world-d-pos" className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Raycast Command List (Bigger Typography) */}
              <div className={`lg:col-span-7 ${glassCard} overflow-hidden`} style={card3dTilt}>
                <div className="px-6 py-4 border-b border-black/8 flex items-center justify-between bg-white/40">
                  <h2 id="world-d-pos" className="text-lg sm:text-xl font-bold tracking-tight">
                    Spotlight Dispensary Actions
                  </h2>
                  <span className="-skew-x-12 px-2.5 py-0.5 bg-[#0066EC]/10 text-[#0066EC] text-xs font-bold">
                    Tap row or ⌘1–⌘6
                  </span>
                </div>
                <div className="divide-y divide-black/8">
                  {filteredMedicines.map((med, i) => {
                    const totalAvail = med.batches.reduce((s, b) => s + b.qty, 0);
                    const soonest = [...med.batches].sort((a, b) => a.expiresInDays - b.expiresInDays)[0];
                    const inCart = cart[med.id] ?? 0;
                    const stockRatio = Math.min(100, Math.round((totalAvail / 40) * 100));

                    return (
                      <button
                        key={med.id}
                        type="button"
                        disabled={totalAvail === 0}
                        onClick={() => addToCart(med.id, 1)}
                        className={`w-full px-6 py-3.5 text-left flex items-center justify-between gap-3 transition-colors hover:bg-[#0066EC]/8 ${
                          inCart > 0 ? "bg-[#0066EC]/12" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <kbd className="px-2 py-1 text-xs font-mono font-bold rounded-md bg-black/6 text-[#505663] shrink-0">
                            ⌘{i + 1}
                          </kbd>
                          <div className="min-w-0">
                            <p className="text-base sm:text-lg font-semibold truncate">
                              {med.name} {inCart > 0 && <span className="text-[#0066EC] font-bold">· {inCart}×</span>}
                            </p>
                            <div className="flex items-center gap-2.5 mt-1">
                              <div className="w-20 h-2 rounded-full bg-black/10 overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${stockRatio}%`,
                                    backgroundColor: (soonest?.expiresInDays ?? 99) <= 30 ? "#F59E0B" : "#16A34A",
                                  }}
                                />
                              </div>
                              <span className="text-xs sm:text-sm text-[#505663] truncate">
                                {soonest?.lotCode} ({soonest?.expiryLabel}) · {totalAvail} packs
                              </span>
                            </div>
                          </div>
                        </div>
                        <span className="font-mono text-base sm:text-lg font-bold tabular-nums shrink-0">
                          {formatTzs(med.priceTzs)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Apple Pay Glass Passbook */}
              <aside className={`lg:col-span-5 ${glassCard} overflow-hidden`} style={card3dTilt}>
                <div className="bg-gradient-to-r from-[#0066EC] via-[#0077FF] to-[#38BDF8] px-6 py-4 text-white flex items-center justify-between relative overflow-hidden">
                  <span className="text-sm sm:text-base font-bold tracking-tight">Cervos Passbook · Till 01</span>
                  {cartLines.length > 0 && (
                    <button type="button" onClick={clearCart} className="text-xs sm:text-sm font-semibold underline opacity-90 hover:opacity-100">
                      Clear
                    </button>
                  )}
                </div>
                <div className="p-5 sm:p-6 space-y-4">
                  {cartLines.length === 0 ? (
                    <p className="py-10 text-center text-sm sm:text-base text-[#505663]">
                      Select any row in Spotlight Dispensary to build a Passbook slip.
                    </p>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {cartLines.map(({ med, qty, fefoPicks, lineTotal }) => {
                          const needsRxNow = med.requiresRx && !verifiedRxIds[med.id];
                          return (
                            <div key={med.id} className="p-3.5 rounded-[16px] bg-white/85 border border-white shadow-sm flex items-center justify-between gap-2">
                              <div>
                                <p className="text-sm sm:text-base font-bold">{med.name}</p>
                                <p className="text-xs font-mono text-[#505663]">
                                  {fefoPicks.map((p) => `${p.qty}× ${p.lotCode}`).join(" + ")}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {med.requiresRx && (
                                  <button
                                    type="button"
                                    onClick={() => toggleVerifyRx(med.id)}
                                    className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                      needsRxNow ? "bg-amber-500/20 text-amber-800" : "bg-emerald-500/20 text-emerald-800"
                                    }`}
                                  >
                                    {needsRxNow ? "Verify Rx" : "Rx checked"}
                                  </button>
                                )}
                                <button type="button" onClick={() => addToCart(med.id, -1)} className="w-7 h-7 rounded-full bg-black/5 text-sm font-bold">
                                  −
                                </button>
                                <span className="font-mono text-sm font-bold tabular-nums">{qty}</span>
                                <button type="button" onClick={() => addToCart(med.id, 1)} className="w-7 h-7 rounded-full bg-black/5 text-sm font-bold">
                                  +
                                </button>
                                <span className="font-mono text-sm font-bold tabular-nums ml-1">
                                  {formatTzs(lineTotal)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="pt-3 border-t border-black/8 flex items-baseline justify-between">
                        <span className="text-sm font-semibold text-[#505663]">Passbook Total</span>
                        <span className="text-3xl font-mono font-bold tabular-nums">{formatTzs(cartTotal)}</span>
                      </div>
                      <button
                        type="button"
                        disabled={needsRxVerification}
                        onClick={openCheckout}
                        className="-skew-x-6 w-full py-3.5 rounded-[16px] bg-[#0066EC] text-white text-base font-bold shadow-[0_8px_24px_rgba(0,102,236,0.34)] active:scale-[0.98] disabled:opacity-45"
                      >
                        <span className="inline-block skew-x-6">
                          {needsRxVerification ? "Verify Rx Pill Above" : `Pay · ${formatTzs(cartTotal)}`}
                        </span>
                      </button>
                    </>
                  )}
                </div>
              </aside>
            </section>
          )}

          {/* NEW ADDITIVE SECTION: 3D ISOMETRIC CHARTS + DIAGONAL HORIZON + LIVE SPATIAL CHAT */}
          {(focus === "all" || focus === "owner" || focus === "counter") && (
            <section aria-labelledby="world-d-charts" className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              {/* Left 7 Cols: 3D Isometric Prism Chart + Diagonal Horizon + 3D Stack */}
              <div className={`lg:col-span-7 ${glassCard} p-6 space-y-6 relative overflow-hidden`} style={card3dTilt}>
                <div
                  aria-hidden="true"
                  className="absolute right-0 top-0 bottom-0 w-1/3 -skew-x-12 bg-gradient-to-b from-[#0066EC]/6 to-emerald-500/5 pointer-events-none"
                />

                <div className="relative flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="-skew-x-12 inline-block px-3 py-0.5 bg-[#16A34A]/15 text-[#16A34A] text-xs font-bold uppercase">
                      <span className="inline-block skew-x-12">3D Isometric Telemetry</span>
                    </span>
                    <h2 id="world-d-charts" className="text-xl sm:text-2xl font-bold tracking-tight mt-1">
                      Hourly Velocity Prisms &amp; Diagonal FEFO Horizon
                    </h2>
                  </div>

                  {/* Interactive 3D Isometric Pharmacy Stack (Click planes to jump!) */}
                  <svg className="w-36 h-24 shrink-0" viewBox="0 0 150 100" fill="none">
                    <g onClick={() => setFocus("supplier")} className="cursor-pointer">
                      <polygon points="75,62 128,74 75,88 22,74" fill="rgba(22,163,74,0.28)" stroke="#16A34A" strokeWidth="1.4" />
                      <text x="75" y="79" textAnchor="middle" fill="#14532D" fontSize="8" fontWeight="700">COURIER</text>
                    </g>
                    <g onClick={() => setFocus("counter")} className="cursor-pointer">
                      <polygon points="75,38 128,50 75,64 22,50" fill="rgba(0,102,236,0.30)" stroke="#0066EC" strokeWidth="1.4" />
                      <text x="75" y="54" textAnchor="middle" fill="#1E3A8A" fontSize="8" fontWeight="700">POS FEFO</text>
                    </g>
                    <g onClick={() => setFocus("owner")} className="cursor-pointer">
                      <polygon points="75,14 128,26 75,40 22,26" fill="rgba(255,255,255,0.92)" stroke="#0066EC" strokeWidth="1.6" />
                      <text x="75" y="30" textAnchor="middle" fill="#14171F" fontSize="8" fontWeight="700">OWNER 3D</text>
                    </g>
                  </svg>
                </div>

                {/* CHART 1: True 3-Face 3D Extruded Isometric Bar Chart */}
                <div className="p-4 rounded-[18px] bg-white/65 border border-white space-y-2 relative">
                  <div className="flex items-center justify-between text-sm font-bold">
                    <span>Today&apos;s Counter Volume (3D Prism Bars)</span>
                    <span className="font-mono text-[#0066EC]">Peak · {formatTzs(todayRevenue)}</span>
                  </div>
                  <svg className="w-full h-44" viewBox="0 0 560 150" fill="none">
                    {/* Diagonal grid lines */}
                    {[30, 65, 100].map((y) => (
                      <line key={y} x1="20" y1={y} x2="540" y2={y - 12} stroke="rgba(15,23,42,0.08)" strokeDasharray="4 4" />
                    ))}
                    {[
                      { t: "08h", h: 38, accent: false },
                      { t: "10h", h: 56, accent: false },
                      { t: "12h", h: 78, accent: false },
                      { t: "14h", h: 66, accent: false },
                      { t: "16h", h: 88, accent: false },
                      { t: "NOW", h: nowHeight, accent: true },
                    ].map((bar, idx) => {
                      const x = 38 + idx * 84;
                      const base = 132;
                      const topY = base - bar.h;
                      const topFill = bar.accent ? "#38BDF8" : "#93C5FD";
                      const frontFill = bar.accent ? "#0066EC" : "#2563EB";
                      const sideFill = bar.accent ? "#1E40AF" : "#1D4ED8";
                      return (
                        <g key={bar.t}>
                          <polygon
                            points={`${x},${topY} ${x + 14},${topY - 9} ${x + 48},${topY - 9} ${x + 34},${topY}`}
                            fill={topFill}
                          />
                          <rect x={x} y={topY} width="34" height={bar.h} fill={frontFill} />
                          <polygon
                            points={`${x + 34},${topY} ${x + 48},${topY - 9} ${x + 48},${base - 9} ${x + 34},${base}`}
                            fill={sideFill}
                          />
                          <text x={x + 18} y="147" textAnchor="middle" fill="#505663" fontSize="12" fontWeight="700">
                            {bar.t}
                          </text>
                        </g>
                      );
                    })}
                    {/* Diagonal Velocity Vector */}
                    <path d="M55 96 L225 60 L480 24" stroke="#16A34A" strokeWidth="2.8" strokeDasharray="5 4" />
                    <circle cx="480" cy="24" r="5" fill="#16A34A" />
                  </svg>
                </div>

                {/* CHART 2: Diagonal FEFO Shelf-Life & Margin Spline */}
                <div className="p-4 rounded-[18px] bg-white/65 border border-white flex flex-col sm:flex-row items-center gap-4">
                  <div className="space-y-1 sm:w-48 shrink-0">
                    <span className="-skew-x-12 inline-block px-2 py-0.5 bg-amber-500/18 text-amber-800 text-xs font-bold">
                      FEFO Diagonal Curve
                    </span>
                    <p className="text-base font-bold">18d Lot Burn vs +33% Margin</p>
                    <p className="text-xs text-[#505663]">Earliest-expiry packs clear automatically before reorder.</p>
                  </div>
                  <svg className="w-full h-24" viewBox="0 0 320 84" fill="none">
                    <defs>
                      <linearGradient id="dAreaGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#0066EC" stopOpacity="0.32" />
                        <stop offset="100%" stopColor="#16A34A" stopOpacity="0.06" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M10 68 C60 64, 95 44, 150 40 C205 36, 250 18, 310 10 L310 78 L10 78 Z"
                      fill="url(#dAreaGrad)"
                    />
                    <path d="M10 68 C60 64, 95 44, 150 40 C205 36, 250 18, 310 10" stroke="#0066EC" strokeWidth="3.2" strokeLinecap="round" />
                    <line x1="10" y1="74" x2="310" y2="16" stroke="#F59E0B" strokeWidth="2" strokeDasharray="4 4" />
                  </svg>
                </div>
              </div>

              {/* Right 5 Cols: Interactive Spatial Copilot Chat */}
              <div className="lg:col-span-5" style={card3dTilt}>
                <CopilotChatPanel
                  variant="glass"
                  lang={lang}
                  chatMessages={chatMessages}
                  chatInput={chatInput}
                  setChatInput={setChatInput}
                  handleSendChat={handleSendChat}
                  onAddAmox={() => addToCart("amox-500", 2)}
                  onBoostRestock={handleApproveRestock}
                  onOpenCheckout={openCheckout}
                />
              </div>
            </section>
          )}

          {/* 3. SPATIAL FLEET WINDOW */}
          {(focus === "all" || focus === "supplier") && (
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              <div className={`lg:col-span-5 ${glassCard} p-6 space-y-3.5`} style={card3dTilt}>
                <h3 className="text-lg font-bold">Spatial Logistics Queue</h3>
                {supplierOrders.map((ord) => (
                  <div key={ord.id} className="p-4 rounded-[18px] bg-white/75 border border-white shadow-sm space-y-2">
                    <div className="flex justify-between text-sm sm:text-base font-bold">
                      <span>{ord.pharmacy}</span>
                      <span className="font-mono text-[#0066EC]">{formatTzs(ord.amountTzs)}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-[#505663]">{ord.itemsSummary}</p>
                    {ord.status !== "delivered" && (
                      <button
                        type="button"
                        onClick={() => handleAdvanceSupplierOrder(ord.id)}
                        className="px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold bg-[#0066EC] text-white"
                      >
                        {ord.status === "incoming" ? "Dispatch Courier" : "Confirm Delivery"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className={`lg:col-span-7 ${glassCard} overflow-hidden p-2.5`} style={card3dTilt}>
                <div key={`map-${theme.id}-${focus}`} className="h-[290px] w-full rounded-[18px] overflow-hidden">
                  <MapClientWrapper
                    key={`leaflet-${theme.id}`}
                    center={[-6.805, 39.265]}
                    zoom={12}
                    markers={LAB_MARKERS}
                    routes={LAB_ROUTES}
                    defaultStyle="light"
                    className="h-full w-full"
                  />
                </div>
              </div>
            </section>
          )}

          {/* 4. SPATIAL UI KIT */}
          {(focus === "all" || focus === "components") && (
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className={`lg:col-span-6 ${glassCard} p-6 space-y-4`}>
                <h3 className="text-lg font-bold">Glass Controls &amp; Stepper</h3>
                <div className="inline-flex p-1.5 rounded-[16px] bg-black/5 gap-1">
                  {(["owners", "counter", "suppliers"] as const).map((seg) => (
                    <button
                      key={seg}
                      type="button"
                      onClick={() => setSelectedSegment(seg)}
                      className={`px-4 py-1.5 rounded-[12px] text-sm font-semibold capitalize ${
                        selectedSegment === seg ? "bg-white shadow-sm" : "text-[#505663]"
                      }`}
                    >
                      {seg}
                    </button>
                  ))}
                </div>
                <div className="p-4 rounded-[16px] bg-white/80 flex items-center justify-between gap-3 text-sm font-medium">
                  <span>Step {wizardStep}/3 · Pair iPadOS Till + Dar Courier</span>
                  <button
                    type="button"
                    onClick={() => setWizardStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : 1))}
                    className="px-4 py-1.5 rounded-full bg-[#0066EC] text-white font-bold"
                  >
                    Next
                  </button>
                </div>
              </div>
              <div className={`lg:col-span-6 ${glassCard} p-6 space-y-2.5`}>
                <h3 className="text-lg font-bold">Mounted Design Skill Suite</h3>
                {MOUNTED_SKILLS.map((sk) => (
                  <div key={sk.name} className="flex justify-between text-sm py-1.5 border-b last:border-b-0 border-black/8">
                    <span className="font-semibold">{sk.name}</span>
                    <span className="text-[#505663] truncate max-w-[60%]">{sk.role}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN DESIGN LAB CLIENT CONTAINER
   ═══════════════════════════════════════════════════════════════════════════ */
export default function DesignLabClient() {
  const [taste, setTaste] = useState<TasteId>("D");
  const [radiusOverride, setRadiusOverride] = useState<RadiusMode>("default");
  const [density, setDensity] = useState<DensityMode>("calm");
  const [depth3d, setDepth3d] = useState(true);
  const [focus, setFocus] = useState<StageFocus>("all");
  const [lang, setLang] = useState<LangCode>("EN");

  // Live Pharmacy Shared Reactive State (persists smoothly when flipping A -> B -> C -> D!)
  const [medicines, setMedicines] = useState<MedicineItem[]>(INITIAL_MEDICINES);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({ "amox-500": 4 });
  const [verifiedRxIds, setVerifiedRxIds] = useState<Record<string, boolean>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("mpesa");
  const [paymentDone, setPaymentDone] = useState(false);
  const [todayRevenue, setTodayRevenue] = useState(1840000);
  const [txCount, setTxCount] = useState(64);
  const [undoBanner, setUndoBanner] = useState<{
    message: string;
    snapshotMedicines: MedicineItem[];
    snapshotCart: Record<string, number>;
    deltaRevenue: number;
  } | null>(null);

  const [selectedBranch, setSelectedBranch] = useState("kariakoo");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [restockApproved, setRestockApproved] = useState(false);
  const [supplierOrders, setSupplierOrders] = useState<SupplierOrder[]>(INITIAL_SUPPLIER_ORDERS);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [selectedSegment, setSelectedSegment] = useState<"owners" | "counter" | "suppliers">("counter");
  const [recipeModalOpen, setRecipeModalOpen] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "m-welcome",
      role: "assistant",
      metricTag: "LIVE PULSE · KARIAKOO",
      text: "Good evening. Kariakoo is at 98.4% stock health with 2 short-dated FEFO lots ready to prioritize.",
      bars: [
        { label: "LOT-A24 Amox (18d)", pct: 82, tone: "warn" },
        { label: "Core Inventory", pct: 98, tone: "safe" },
      ],
      actionLabel: "Add 2 Amox to the sale",
      onActionKind: "add-amox",
    },
  ]);

  const theme = TASTE_THEMES[taste];

  const cardRadiusPx = useMemo(() => {
    if (radiusOverride === "sharp") return 4;
    if (radiusOverride === "instrument") return 10;
    if (radiusOverride === "squircle") return 18;
    if (radiusOverride === "soft") return 24;
    return theme.defaultCardRadius;
  }, [radiusOverride, theme.defaultCardRadius]);

  const controlRadiusPx = useMemo(() => {
    if (radiusOverride === "sharp") return 4;
    if (radiusOverride === "instrument") return 8;
    if (radiusOverride === "squircle") return 12;
    if (radiusOverride === "soft") return 9999;
    return theme.defaultControlRadius;
  }, [radiusOverride, theme.defaultControlRadius]);

  useEffect(() => {
    if (!undoBanner) return;
    const timer = window.setTimeout(() => setUndoBanner(null), 5500);
    return () => window.clearTimeout(timer);
  }, [undoBanner]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCheckoutOpen(false);
        setInspectorOpen(false);
        setRecipeModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filteredMedicines = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return medicines;
    return medicines.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.form.toLowerCase().includes(q) ||
        m.latinSubtitle.toLowerCase().includes(q) ||
        m.barcode.includes(q),
    );
  }, [medicines, searchQuery]);

  const cartLines: CartLine[] = useMemo(() => {
    return Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const med = medicines.find((m) => m.id === id);
        if (!med) return null;
        return {
          med,
          qty,
          fefoPicks: allocateFefo(med.batches, qty),
          lineTotal: med.priceTzs * qty,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [cart, medicines]);

  const cartTotal = useMemo(() => cartLines.reduce((sum, l) => sum + l.lineTotal, 0), [cartLines]);
  const totalCartItems = useMemo(() => cartLines.reduce((sum, l) => sum + l.qty, 0), [cartLines]);
  const needsRxVerification = cartLines.some((l) => l.med.requiresRx && !verifiedRxIds[l.med.id]);

  const branches: BranchSummary[] = [
    {
      id: "kariakoo",
      name: "Kariakoo Main",
      shortName: "Kariakoo",
      sales: todayRevenue,
      healthPct: 98.4,
      stateEn: "Live · 2 short lots",
      stateSw: "Moja kwa moja · Makundi 2 karibu kuisha",
      alert: false,
    },
    {
      id: "upanga",
      name: "Upanga Clinical",
      shortName: "Upanga",
      sales: 620000,
      healthPct: 100,
      stateEn: "Calm · 100% healthy",
      stateSw: "Salama · Asilimia 100",
      alert: false,
    },
    {
      id: "mwenge",
      name: "Mwenge Express",
      shortName: "Mwenge",
      sales: 410000,
      healthPct: 76,
      stateEn: "FEFO priority · 2 lots",
      stateSw: "Kipaumbele cha FEFO · Makundi 2",
      alert: true,
    },
  ];

  const addToCart = (id: string, delta: number) => {
    const med = medicines.find((m) => m.id === id);
    if (!med) return;
    const maxAvail = med.batches.reduce((s, b) => s + b.qty, 0);
    setCart((prev) => {
      const nextQty = Math.max(0, Math.min(maxAvail, (prev[id] ?? 0) + delta));
      if (nextQty === 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: nextQty };
    });
  };

  const handleSimulateScan = () => {
    addToCart("amox-500", 1);
    setCopiedMsg(
      lang === "EN"
        ? "Scanned Amoxicillin 500mg · Earliest FEFO lot picked"
        : "Imeskani Amoxicillin 500mg · Kundi la kwanza limechaguliwa",
    );
    window.setTimeout(() => setCopiedMsg(null), 2600);
  };

  const handleCompletePayment = () => {
    if (cartTotal <= 0) return;
    const snapshotMedicines = JSON.parse(JSON.stringify(medicines)) as MedicineItem[];
    const snapshotCart = { ...cart };
    const saleAmount = cartTotal;

    setMedicines((prev) =>
      prev.map((med) => {
        const takeQty = snapshotCart[med.id] ?? 0;
        if (takeQty <= 0) return med;
        let left = takeQty;
        const updatedBatches = [...med.batches]
          .sort((a, b) => a.expiresInDays - b.expiresInDays)
          .map((b) => {
            if (left <= 0 || b.qty <= 0) return b;
            const take = Math.min(b.qty, left);
            left -= take;
            return { ...b, qty: b.qty - take };
          });
        return { ...med, batches: updatedBatches };
      }),
    );

    setTodayRevenue((v) => v + saleAmount);
    setTxCount((c) => c + 1);
    setPaymentDone(true);

    window.setTimeout(() => {
      setCheckoutOpen(false);
      setPaymentDone(false);
      setCart({});
      setUndoBanner({
        message:
          lang === "EN"
            ? `Sale complete · ${formatTzs(saleAmount)} received`
            : `Mauzo yamekamilika · ${formatTzs(saleAmount)} imepokelewa`,
        snapshotMedicines,
        snapshotCart,
        deltaRevenue: saleAmount,
      });
    }, 650);
  };

  const handleUndoSale = () => {
    if (!undoBanner) return;
    setMedicines(undoBanner.snapshotMedicines);
    setCart(undoBanner.snapshotCart);
    setTodayRevenue((v) => v - undoBanner.deltaRevenue);
    setTxCount((c) => Math.max(0, c - 1));
    setUndoBanner(null);
  };

  const handleApproveRestock = () => {
    if (restockApproved) return;
    setRestockApproved(true);
    setInspectorOpen(false);
    setSupplierOrders((prev) => [
      {
        id: "ORD-890",
        pharmacy: "Kariakoo Central Pharmacy",
        region: "Dar es Salaam",
        itemsSummary: "Amoxicillin 500mg × 40 boxes (Owner Approved)",
        amountTzs: 360000,
        eta: "20 min express rider",
        status: "incoming",
      },
      ...prev,
    ]);
    setCopiedMsg(
      lang === "EN"
        ? "Order dispatched to Bahari Wholesale — live in Supplier stage"
        : "Agizo limetumwa Bahari Wholesale",
    );
    window.setTimeout(() => setCopiedMsg(null), 3200);
  };

  const handleAdvanceSupplierOrder = (id: string) => {
    setSupplierOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        const nextStatus =
          o.status === "incoming"
            ? "dispatched"
            : o.status === "dispatched"
              ? "delivered"
              : "delivered";
        return { ...o, status: nextStatus };
      }),
    );
  };

  const copyTokenRecipe = async () => {
    const cssRecipe = `/* Cervos World ${theme.id}: ${theme.name} (${theme.paradigm}) */
:root {
  --cervos-canvas: ${theme.canvas};
  --cervos-card: ${theme.card};
  --cervos-ink: ${theme.ink};
  --cervos-accent: ${theme.accent};
  --cervos-radius-card: ${cardRadiusPx}px;
  --cervos-radius-control: ${controlRadiusPx}px;
}`;
    try {
      await navigator.clipboard.writeText(cssRecipe);
      setCopiedMsg(lang === "EN" ? `Copied World ${theme.id} recipe!` : "Mtindo umenakiliwa!");
      window.setTimeout(() => setCopiedMsg(null), 2400);
    } catch {
      // Modal opens either way
    }
    setRecipeModalOpen(true);
  };

  const handleSendChat = (promptText?: string) => {
    const raw = (promptText ?? chatInput).trim();
    if (!raw) return;
    const q = raw.toLowerCase();
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: raw,
    };

    let reply: ChatMessage;
    if (q.includes("amox") || q.includes("dispense") || q.includes("toa")) {
      addToCart("amox-500", 2);
      reply = {
        id: `a-${Date.now() + 1}`,
        role: "assistant",
        metricTag: "FEFO AUTO-ALLOCATED",
        text: "Added 2× Amoxicillin 500mg to your active counter slip from earliest lot LOT-A24 (18d left).",
        bars: [
          { label: "LOT-A24 Burn Rate", pct: 92, tone: "accent" },
          { label: "Safety Margin", pct: 33, tone: "safe" },
        ],
        actionLabel: "Open Payment Sheet",
        onActionKind: "open-checkout",
      };
    } else if (q.includes("fefo") || q.includes("expiry") || q.includes("makundi") || q.includes("risk")) {
      reply = {
        id: `a-${Date.now() + 1}`,
        role: "assistant",
        metricTag: "FEFO RISK AUDIT",
        text: "2 batches expire within 30 days: LOT-A24 (Amoxicillin · 18d) and LOT-Z03 (Azithromycin · 26d). Both are pinned first at checkout.",
        bars: [
          { label: "Amox LOT-A24 (18d)", pct: 88, tone: "warn" },
          { label: "Azith LOT-Z03 (26d)", pct: 74, tone: "warn" },
          { label: "11m+ Safe Lots", pct: 96, tone: "safe" },
        ],
      };
    } else if (q.includes("boost") || q.includes("bahari") || q.includes("restock") || q.includes("agiza")) {
      if (!restockApproved) handleApproveRestock();
      reply = {
        id: `a-${Date.now() + 1}`,
        role: "assistant",
        metricTag: "SUPPLIER SYNCED · +33% MARGIN",
        text: "Bahari Wholesale 40-box Amoxicillin replenishment (TZS 360,000) is active with expected +180,000 TZS gross margin.",
        bars: [{ label: "Courier SLA (20 min)", pct: 95, tone: "safe" }],
      };
    } else {
      reply = {
        id: `a-${Date.now() + 1}`,
        role: "assistant",
        metricTag: "LIVE BRANCH SNAPSHOT",
        text: `Live register holds ${formatTzs(todayRevenue)} across ${txCount} sales. Active basket is ${formatTzs(cartTotal)} with ${supplierOrders.length} active Dar courier orders.`,
        bars: [{ label: "Kariakoo Readiness", pct: 98, tone: "safe" }],
        actionLabel: "Boost Bahari Restock",
        onActionKind: "boost-restock",
      };
    }

    setChatMessages((prev) => [...prev.slice(-5), userMsg, reply]);
    if (!promptText) setChatInput("");
  };

  const worldProps: LabWorldProps = {
    theme,
    lang,
    focus,
    setFocus,
    density,
    depth3d,
    cardRadiusPx,
    controlRadiusPx,
    filteredMedicines,
    searchQuery,
    setSearchQuery,
    cart,
    cartLines,
    cartTotal,
    totalCartItems,
    needsRxVerification,
    verifiedRxIds,
    toggleVerifyRx: (id) => setVerifiedRxIds((p) => ({ ...p, [id]: !p[id] })),
    addToCart,
    clearCart: () => setCart({}),
    handleSimulateScan,
    openCheckout: () => setCheckoutOpen(true),
    todayRevenue,
    txCount,
    branches,
    selectedBranch,
    setSelectedBranch,
    restockApproved,
    handleApproveRestock,
    openInspector: () => setInspectorOpen(true),
    supplierOrders,
    handleAdvanceSupplierOrder,
    wizardStep,
    setWizardStep,
    selectedSegment,
    setSelectedSegment,
    chatMessages,
    chatInput,
    setChatInput,
    handleSendChat,
  };

  return (
    <div
      className="min-h-screen transition-colors duration-300"
      style={{ backgroundColor: theme.canvas, color: theme.ink }}
    >
      {/* Top Architecture Switcher Bar */}
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-xl transition-colors duration-300"
        style={{
          backgroundColor: theme.headerGlass,
          borderColor: taste === "A" ? "#191919" : theme.border,
        }}
      >
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-2.5 space-y-2.5">
          {/* Row 1: Brand Back, Dials & Lock In */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Link
                href="/"
                className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md border"
                style={{ borderColor: theme.border, backgroundColor: theme.elevated }}
              >
                <span>&larr; Cervos</span>
              </Link>
              <span className="text-xs font-bold tracking-tight">Design Lab · 4 UX Worlds</span>
              <span className="hidden md:inline text-[11px]" style={{ color: theme.inkMuted }}>
                · Same pharmacy brain, 4 radically different spatial architectures
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                aria-label="Corner radius override"
                value={radiusOverride}
                onChange={(e) => setRadiusOverride(e.target.value as RadiusMode)}
                className="px-2 py-1 text-[11px] font-medium border rounded-md"
                style={{ backgroundColor: theme.card, color: theme.ink, borderColor: theme.border }}
              >
                <option value="default">World Default ({theme.defaultCardRadius}px)</option>
                <option value="sharp">Sharp (4px)</option>
                <option value="instrument">Instrument (10px)</option>
                <option value="squircle">Squircle (18px)</option>
                <option value="soft">Soft (24px)</option>
              </select>

              <div className="inline-flex border rounded-md overflow-hidden" style={{ borderColor: theme.border }}>
                {(["calm", "counter"] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDensity(d)}
                    className="px-2 py-1 text-[11px] font-medium"
                    style={{
                      backgroundColor: density === d ? theme.ink : "transparent",
                      color: density === d ? theme.canvas : theme.inkMuted,
                    }}
                  >
                    {d === "calm" ? "Calm" : "Fast"}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setDepth3d((v) => !v)}
                className="px-2.5 py-1 text-[11px] font-semibold border rounded-md transition-colors"
                style={{
                  borderColor: theme.border,
                  backgroundColor: depth3d ? theme.accentSoft : "transparent",
                  color: depth3d ? theme.accent : theme.inkMuted,
                }}
              >
                {depth3d ? "3D Depth: ON" : "3D Depth: OFF"}
              </button>

              <div className="inline-flex border rounded-md overflow-hidden" style={{ borderColor: theme.border }}>
                {(["EN", "SW"] as const).map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setLang(code)}
                    className="px-2 py-1 text-[11px] font-semibold"
                    style={{
                      backgroundColor: lang === code ? theme.ink : "transparent",
                      color: lang === code ? theme.canvas : theme.inkMuted,
                    }}
                  >
                    {code}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={copyTokenRecipe}
                className="px-3 py-1 rounded-md text-[11px] font-bold transition-transform active:scale-[0.97]"
                style={{ backgroundColor: theme.accent, color: theme.accentInk }}
              >
                {lang === "EN" ? `Lock World ${theme.id}` : `Chagua ${theme.id}`}
              </button>
            </div>
          </div>

          {/* Row 2: 4 Visual Architecture Selector Cards with Mini Spatial Thumbnails */}
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2"
            role="tablist"
            aria-label="UX Architecture World Switcher"
          >
            {(Object.values(TASTE_THEMES) as TasteTheme[]).map((item) => {
              const active = taste === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTaste(item.id)}
                  className="text-left p-2.5 rounded-lg border transition-all flex items-center gap-3 active:scale-[0.99]"
                  style={{
                    backgroundColor: active ? item.contrastBg : "rgba(255,255,255,0.65)",
                    color: active ? item.contrastInk : "#191919",
                    borderColor: active ? item.accent : "rgba(0,0,0,0.12)",
                  }}
                >
                  <ArchitectureThumb id={item.id} active={active} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: item.accent }}
                      />
                      <span className="text-xs font-bold truncate">
                        {item.id}. {item.name}
                      </span>
                    </div>
                    <p
                      className="text-[10px] truncate mt-0.5"
                      style={{
                        color:
                          active && item.id === "C"
                            ? "#0F172A"
                            : active
                              ? "rgba(255,255,255,0.78)"
                              : "#595750",
                      }}
                    >
                      {item.paradigm}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Render the Chosen Architectural Paradigm */}
      {taste === "A" && <WorldAConsole {...worldProps} />}
      {taste === "B" && <WorldBApothecary {...worldProps} />}
      {taste === "C" && <WorldCKineticLit {...worldProps} />}
      {taste === "D" && <WorldDSpatial {...worldProps} />}

      {/* Shared component library */}
      {(focus === "all" || focus === "components") && <LibraryShowcase />}

      {/* Shared Spring Checkout Sheet */}
      {checkoutOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-[2px] p-0 sm:p-4"
          onClick={() => setCheckoutOpen(false)}
        >
          <div
            className="w-full sm:max-w-md p-6 border shadow-2xl"
            style={{
              backgroundColor: taste === "D" ? "#FFFFFF" : theme.card,
              color: theme.ink,
              borderColor: theme.border,
              borderRadius: `${cardRadiusPx}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {paymentDone ? (
              <div className="py-8 text-center space-y-3">
                <div
                  className="w-12 h-12 mx-auto rounded-full flex items-center justify-center text-xl font-bold"
                  style={{ backgroundColor: theme.safeBg, color: theme.safe }}
                >
                  <Icon name="check" size={24} strokeWidth={2.25} />
                </div>
                <p className="text-lg font-semibold">
                  {lang === "EN" ? "Sale Recorded" : "Mauzo Yamekamilika"}
                </p>
                <p className="text-sm font-mono tabular-nums" style={{ color: theme.inkMuted }}>
                  {formatTzs(cartTotal)}
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {lang === "EN" ? "Complete Sale" : "Kamilisha Malipo"}
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: theme.inkMuted }}>
                      World {theme.id} · FEFO lots commit automatically
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close payment sheet"
                    onClick={() => setCheckoutOpen(false)}
                    className="px-2.5 py-1 rounded-md text-xs font-bold border"
                    style={{ borderColor: theme.border }}
                  >
                    <Icon name="close" size={16} label="Close" />
                  </button>
                </div>

                <div
                  className="p-4 text-center border"
                  style={{
                    borderRadius: `${Math.max(4, cardRadiusPx - 4)}px`,
                    backgroundColor: theme.canvas,
                    borderColor: theme.border,
                  }}
                >
                  <span className="text-xs" style={{ color: theme.inkMuted }}>
                    Total Due
                  </span>
                  <p className="text-3xl font-mono font-bold tabular-nums mt-1">{formatTzs(cartTotal)}</p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: "mpesa", label: "M-Pesa" },
                      { id: "cash", label: "Exact Cash" },
                      { id: "split", label: "Split Pay" },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id)}
                      className="py-2.5 px-2 text-xs font-semibold border transition-all"
                      style={{
                        borderRadius: `${Math.min(14, controlRadiusPx)}px`,
                        borderColor: paymentMethod === m.id ? theme.accent : theme.border,
                        backgroundColor: paymentMethod === m.id ? theme.accentSoft : theme.canvas,
                        color: paymentMethod === m.id ? theme.accent : theme.ink,
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleCompletePayment}
                  className="w-full py-3.5 text-sm font-semibold active:scale-[0.98]"
                  style={{
                    borderRadius: `${Math.min(9999, controlRadiusPx)}px`,
                    backgroundColor: theme.accent,
                    color: theme.accentInk,
                  }}
                >
                  Confirm &amp; Issue Receipt
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Owner Slide-Over Batch & Margin Inspector */}
      {inspectorOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/35 backdrop-blur-[2px]"
          onClick={() => setInspectorOpen(false)}
        >
          <div
            className="w-full max-w-md h-full p-6 border-l flex flex-col justify-between overflow-y-auto"
            style={{
              backgroundColor: taste === "D" ? "#FFFFFF" : theme.card,
              color: theme.ink,
              borderColor: theme.border,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Restock Margin &amp; Batch Economics</h3>
                  <p className="text-xs mt-0.5" style={{ color: theme.inkMuted }}>
                    Amoxicillin 500mg · 40 boxes
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close inspector"
                  onClick={() => setInspectorOpen(false)}
                  className="px-2.5 py-1 rounded-md text-xs font-bold border"
                  style={{ borderColor: theme.border }}
                >
                  <Icon name="close" size={16} label="Close" />
                </button>
              </div>

              <div
                className="p-4 border space-y-2.5 text-sm"
                style={{
                  borderRadius: `${Math.max(4, cardRadiusPx - 4)}px`,
                  borderColor: theme.border,
                  backgroundColor: theme.canvas,
                }}
              >
                <div className="flex justify-between">
                  <span style={{ color: theme.inkMuted }}>Supplier</span>
                  <span className="font-semibold">Bahari Wholesale Ltd</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: theme.inkMuted }}>Expiry Guarantee</span>
                  <span className="font-mono font-semibold" style={{ color: theme.safe }}>
                    18+ months
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: theme.inkMuted }}>Unit Cost → Shelf</span>
                  <span className="font-mono tabular-nums">9,000 → 13,500 TZS</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: theme.inkMuted }}>Expected Gross Margin</span>
                  <span className="font-mono font-bold tabular-nums" style={{ color: theme.safe }}>
                    +180,000 TZS (33%)
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={restockApproved}
              onClick={handleApproveRestock}
              className="w-full py-3 text-sm font-semibold active:scale-[0.98] disabled:opacity-50"
              style={{
                borderRadius: `${Math.min(9999, controlRadiusPx)}px`,
                backgroundColor: theme.accent,
                color: theme.accentInk,
              }}
            >
              {restockApproved ? "Restock sent" : "Approve restock · TZS 360,000"}
            </button>
          </div>
        </div>
      )}

      {/* Recipe Lock-In Modal */}
      {recipeModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onClick={() => setRecipeModalOpen(false)}
        >
          <div
            className="w-full max-w-lg p-6 border space-y-4 shadow-2xl"
            style={{
              backgroundColor: taste === "D" ? "#FFFFFF" : theme.card,
              color: theme.ink,
              borderColor: theme.border,
              borderRadius: `${Math.min(20, cardRadiusPx || 8)}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">
                Locked Architecture · World {theme.id} ({theme.name})
              </h3>
              <button
                type="button"
                aria-label="Close recipe modal"
                onClick={() => setRecipeModalOpen(false)}
                className="px-2.5 py-1 rounded-md text-xs font-bold border"
                style={{ borderColor: theme.border }}
              >
                <Icon name="close" size={16} label="Close" />
              </button>
            </div>
            <pre
              className="p-4 text-xs font-mono overflow-x-auto border"
              style={{ borderRadius: "8px", backgroundColor: theme.canvas, borderColor: theme.border }}
            >
{`world: "${theme.id} · ${theme.name}"
paradigm: "${theme.paradigm}"
tokens:
  --cervos-canvas: ${theme.canvas};
  --cervos-ink: ${theme.ink};
  --cervos-accent: ${theme.accent};
  --cervos-radius-card: ${cardRadiusPx}px;
  --cervos-density: "${density}";`}
            </pre>
            <p className="text-xs" style={{ color: theme.inkMuted }}>
              Tell me in chat: &ldquo;Build Cervos on World {theme.id}&rdquo; (or mix worlds, e.g. &ldquo;World A Counter POS + World B Owner Morning Letter&rdquo;) and we will roll out all ungated flows in that exact paradigm.
            </p>
          </div>
        </div>
      )}

      {/* 5.5s Undo Toast */}
      {(undoBanner || copiedMsg) && (
        <div
          role="status"
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 shadow-xl border flex items-center gap-3 text-xs font-semibold rounded-full"
          style={{
            backgroundColor: theme.contrastBg,
            color: theme.contrastInk,
            borderColor: "rgba(255,255,255,0.16)",
          }}
        >
          <span>{undoBanner ? undoBanner.message : copiedMsg}</span>
          {undoBanner && (
            <button
              type="button"
              onClick={handleUndoSale}
              className="px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ backgroundColor: theme.accent, color: theme.accentInk }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
