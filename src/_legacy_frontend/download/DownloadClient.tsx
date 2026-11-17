"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import PublicNav from "@/components/PublicNav";
import Toast from "@/components/Toast";
import { useI18n } from "@/lib/i18n/context";
import { AppRelease } from "@/lib/actions/hq";
import MapClientWrapper from "@/components/MapClientWrapper";
import type { MarkerData, MapRoute } from "@/components/CervosMap";
import { CervosEmblem, type EmblemState } from "@cervos/ui";

/* ─── types / constants ─────────────────────────────────────────── */

interface DownloadClientProps {
  releases: Record<string, AppRelease>;
}

type PlatformId = "windows" | "linux" | "pwa" | "macos";
const PLATFORMS: PlatformId[] = ["windows", "linux", "pwa", "macos"];

interface PlatformDetail {
  id: PlatformId;
  labelKey: string;
  subKey: string;
  icon: string;
  ext: string;
  badge: string;
  sizeDesc: string;
  installGuide: string;
  features: string[];
  releaseKey?: "windows" | "linux" | "mac";
}

const PLATFORM_CONFIG: Record<PlatformId, PlatformDetail> = {
  windows: {
    id: "windows",
    labelKey: "download.for.windows",
    subKey: "download.req.windows",
    icon: "window",
    ext: ".exe",
    badge: "64-bit NSIS Setup",
    sizeDesc: "64.2 MB · Standalone installer",
    installGuide: "Run cervos-setup-2.4.1.exe. Follow standard NSIS wizard. Auto-configures local SQLite and desktop shortcut.",
    features: [
      "Bundled standalone SQLite database (zero cloud dependency)",
      "Automatic background silent delta updates",
      "ESC/POS thermal receipt printer drivers (USB & Network)",
      "PIN-locked cashier switch and daily shift balancing",
    ],
    releaseKey: "windows",
  },
  linux: {
    id: "linux",
    labelKey: "download.for.linux",
    subKey: "download.req.linux",
    icon: "terminal",
    ext: ".deb / .AppImage",
    badge: "Debian & Ubuntu",
    sizeDesc: "58.7 MB · x86_64 / arm64",
    installGuide: "Install with 'sudo dpkg -i cervos-pos_2.4.1_amd64.deb' or execute the standalone AppImage. Supports systemd kiosk mode.",
    features: [
      "Native glibc package for Ubuntu 20.04+, Debian 11+, and Linux Mint",
      "Kiosk auto-start mode via systemd service",
      "Zero tracking or telemetry — strictly local storage",
      "Hardware barcode scanner support (/dev/input/by-id)",
    ],
    releaseKey: "linux",
  },
  pwa: {
    id: "pwa",
    labelKey: "download.for.pwa",
    subKey: "download.req.pwa",
    icon: "smartphone",
    ext: "PWA",
    badge: "Mobile & Tablet",
    sizeDesc: "0 MB · Instant 1-tap browser install",
    installGuide: "On iOS Safari: Tap Share button -> 'Add to Home Screen'. On Android Chrome: Tap menu -> 'Install app'.",
    features: [
      "Instant install on iPhone, iPad, and Android phones & tablets",
      "Full offline caching powered by Service Worker & IndexedDB",
      "Direct camera barcode scanning for instant medicine lookup",
      "Touch-optimized rapid dispensing interface",
    ],
    releaseKey: undefined,
  },
  macos: {
    id: "macos",
    labelKey: "download.for.macos",
    subKey: "download.req.macos",
    icon: "laptop_mac",
    ext: ".dmg",
    badge: "Universal Disk Image",
    sizeDesc: "71.8 MB · Apple Silicon & Intel",
    installGuide: "Open Cervos-2.4.1-universal.dmg and drag Cervos to your Applications folder. Gatekeeper notarized by Apple.",
    features: [
      "Native Universal binary for M1/M2/M3/M4 and Intel Macs",
      "Retina display graphics with high-contrast clinical theme",
      "Multi-window counter dispensing for large hospital pharmacies",
      "Silent local database replication",
    ],
    releaseKey: "mac",
  },
};

const FEATURES = [
  { icon: "inventory_2", titleKey: "download.feat1.title", bodyKey: "download.feat1.body" },
  { icon: "wifi_off", titleKey: "download.feat2.title", bodyKey: "download.feat2.body" },
  { icon: "storefront", titleKey: "download.feat3.title", bodyKey: "download.feat3.body" },
  { icon: "receipt_long", titleKey: "download.feat4.title", bodyKey: "download.feat4.body" },
  { icon: "account_tree", titleKey: "download.feat5.title", bodyKey: "download.feat5.body" },
  { icon: "lock", titleKey: "download.feat6.title", bodyKey: "download.feat6.body" },
];

const STEPS = [
  { n: "01", titleKey: "download.step1.title", bodyKey: "download.step1.body" },
  { n: "02", titleKey: "download.step2.title", bodyKey: "download.step2.body" },
  { n: "03", titleKey: "download.step3.title", bodyKey: "download.step3.body" },
];

/* ─── math helpers ──────────────────────────────────────────────── */
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smoothstep = (t: number) => {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};

/* ─── feature screens ───────────────────────────────────────────── */

const RECEIPT = [
  { name: "Amoxicillin 500mg", qty: 3, price: "4,500" },
  { name: "Paracetamol 500mg", qty: 10, price: "3,200" },
  { name: "ORS Sachets 1L", qty: 5, price: "2,500" },
  { name: "Metformin 850mg", qty: 6, price: "5,400" },
];

function TransactionScreen({ show }: { show: boolean }) {
  const { t } = useI18n();
  const [processed, setProcessed] = useState(false);

  return (
    <div
      className="absolute inset-0 flex items-center justify-center p-6 md:p-12"
      style={{
        opacity: show ? 1 : 0,
        transition: "opacity 0.4s ease",
        pointerEvents: show ? "auto" : "none",
      }}
    >
      <div className="w-full max-w-2xl bg-slate-900/90 border border-slate-700/60 rounded-2xl p-6 sm:p-8 backdrop-blur-md shadow-2xl space-y-6">
        {/* POS header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <p className="text-slate-400 font-mono text-[11px] uppercase tracking-widest">
              {t("download.screen.pos")} · Kariakoo Station #1
            </p>
            <p className="text-white text-xl sm:text-2xl font-bold">{t("download.screen.newtx")}</p>
          </div>
          <div className="flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>SQLite Offline · Synced</span>
          </div>
        </div>

        {/* Line items */}
        <div className="space-y-2">
          {RECEIPT.map(({ name, qty, price }) => (
            <div
              key={name}
              className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-2.5"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[16px]">medication</span>
                </div>
                <div>
                  <p className="text-white text-xs sm:text-sm font-medium">{name}</p>
                  <p className="text-slate-400 text-[11px]">x {qty} units</p>
                </div>
              </div>
              <p className="text-white font-mono font-semibold text-xs sm:text-sm">TZS {price}</p>
            </div>
          ))}
        </div>

        {/* Totals and Payment Options */}
        <div className="border-t border-slate-800 pt-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wider font-mono">{t("download.screen.total")}</p>
            <p className="text-white text-2xl sm:text-3xl font-bold font-mono">TZS 15,600</p>
          </div>
          <div className="flex gap-2">
            {["M-Pesa", "Cash", "Card"].map((m, i) => (
              <div
                key={m}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  i === 0
                    ? "bg-emerald-600 text-white border-emerald-500 shadow-sm"
                    : "bg-white/5 text-slate-300 border-white/10"
                }`}
              >
                {m}
              </div>
            ))}
          </div>
        </div>

        {/* Process button */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setProcessed((p) => !p)}
            className="w-full bg-primary hover:bg-primary-variant text-white rounded-xl py-3.5 flex items-center justify-center gap-2 text-sm font-semibold transition-colors shadow-md active:scale-[0.99]"
          >
            <span className="material-symbols-outlined text-[18px]">
              {processed ? "check_circle" : "contactless"}
            </span>
            <span>
              {processed ? "Receipt Printed · SQLite Synced" : t("download.screen.process")}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

const NOTIFICATIONS = [
  { icon: "warning", color: "amber", title: "Low Stock: Paracetamol 500mg", body: "Kariakoo Station has 8 boxes remaining. Suggested reorder: 40 units.", time: "Just now", branch: "Kariakoo Branch" },
  { icon: "sync", color: "emerald", title: "Shift Balanced & Cloud Mirrored", body: "Cash variance TZS 0 across 42 counter sales. Local hash verified.", time: "2m ago", branch: "Upanga Dispensary" },
  { icon: "storefront", color: "blue", title: "Wholesale PO Approved via PayMe", body: "Escrow funds locked for Afya Wholesale Ltd. Awaiting dispatch.", time: "5m ago", branch: "All Branches" },
  { icon: "event", color: "rose", title: "Near-Expiry Batch Flagged: BX-992A", body: "Amoxicillin 500mg expires in 2 days. FEFO priority auto-applied.", time: "8m ago", branch: "Mikocheni Central" },
];

const colorMap: Record<string, string> = {
  amber: "bg-amber-500/15 border-amber-500/30 text-amber-400",
  emerald: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
  blue: "bg-blue-500/15 border-blue-500/30 text-blue-400",
  rose: "bg-rose-500/15 border-rose-500/30 text-rose-400",
};

function NotificationsScreen({ show }: { show: boolean }) {
  const { t } = useI18n();
  return (
    <div
      className="absolute inset-0 flex items-center justify-center p-6 md:p-12"
      style={{
        opacity: show ? 1 : 0,
        transition: "opacity 0.4s ease",
        pointerEvents: show ? "auto" : "none",
      }}
    >
      <div className="w-full max-w-2xl bg-slate-900/90 border border-slate-700/60 rounded-2xl p-6 sm:p-8 backdrop-blur-md shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <p className="text-slate-400 font-mono text-[11px] uppercase tracking-widest">
              Live Clinical Telemetry
            </p>
            <p className="text-white text-xl sm:text-2xl font-bold">Real-Time Alerts &amp; Audits</p>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono">
            <span className="material-symbols-outlined text-[14px]">schedule</span>
            <span>Live Stream</span>
          </div>
        </div>

        <div className="space-y-3">
          {NOTIFICATIONS.map(({ icon, color, title, body, time, branch }) => (
            <div
              key={title}
              className="flex gap-4 bg-white/5 border border-white/10 rounded-xl p-3.5 hover:bg-white/8 transition-colors cursor-default"
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${colorMap[color]}`}
              >
                <span className="material-symbols-outlined text-[18px]">{icon}</span>
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-white text-xs sm:text-sm font-semibold">{title}</p>
                  <p className="text-slate-400 text-[11px] shrink-0 font-mono">{time}</p>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">{body}</p>
                <p className="text-slate-400 text-[10px] font-mono uppercase tracking-wider">{branch}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const MAP_BRANCHES = [
  { name: "Kariakoo Station #1", city: "Dar es Salaam", lat: -6.8213, lng: 39.2696, active: true, txns: "2,841" },
  { name: "Upanga Dispensary", city: "Dar es Salaam", lat: -6.8103, lng: 39.2835, active: true, txns: "1,203" },
  { name: "Mikocheni Central", city: "Dar es Salaam", lat: -6.7712, lng: 39.2460, active: true, txns: "847" },
  { name: "Baraka Chemists", city: "Arusha", lat: -3.3961, lng: 36.7904, active: true, txns: "1,549" },
  { name: "Neema Pharmacy", city: "Mwanza", lat: -2.5166, lng: 32.9017, active: true, txns: "912" },
];

function MapScreen({ show }: { show: boolean }) {
  const { t } = useI18n();

  const markers: MarkerData[] = MAP_BRANCHES.map((b) => ({
    id: b.name,
    lat: b.lat,
    lng: b.lng,
    label: `${b.name} · ${b.city}`,
    kind: b.name.includes("HQ") ? "hq" : "branch",
    status: b.active ? "online" : "grace",
    detail: `${b.txns} txns synced`,
  }));

  const hq = MAP_BRANCHES[0];
  const routes: MapRoute[] = MAP_BRANCHES.slice(1).map((b) => ({
    id: `dl-route-${b.name}`,
    from: [hq.lat, hq.lng],
    to: [b.lat, b.lng],
    status: b.active ? "active" : "pending",
  }));

  return (
    <div
      className="absolute inset-0 flex items-center justify-center p-6 md:p-12"
      style={{
        opacity: show ? 1 : 0,
        transition: "opacity 0.4s ease",
        pointerEvents: show ? "auto" : "none",
      }}
    >
      <div className="w-full max-w-4xl bg-slate-900/90 border border-slate-700/60 rounded-2xl p-6 sm:p-8 backdrop-blur-md shadow-2xl flex flex-col md:flex-row gap-6 items-center">
        <div className="flex-1 w-full rounded-xl overflow-hidden border border-white/10 h-[280px] sm:h-[320px]">
          {show && (
            <MapClientWrapper
              center={[-6.5, 36.5]}
              zoom={6}
              markers={markers}
              routes={routes}
              defaultStyle="dark"
              showControls={false}
              className="h-full w-full"
            />
          )}
        </div>

        <div className="w-full md:w-64 shrink-0 space-y-4">
          <div>
            <p className="text-slate-400 font-mono text-[11px] uppercase tracking-widest">
              Cloud Delta Mirror
            </p>
            <p className="text-white text-lg font-bold">Multi-Branch Network</p>
          </div>

          <div className="space-y-2">
            {MAP_BRANCHES.map(({ name, city, txns }) => (
              <div key={name} className="flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-0">
                <div>
                  <p className="text-white font-semibold">{name}</p>
                  <p className="text-slate-400 text-[10px]">{city}</p>
                </div>
                <span className="font-mono text-emerald-400 text-xs">{txns} tx</span>
              </div>
            ))}
          </div>

          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-mono">
            All 5 branches online &amp; synchronized.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── detect OS ─────────────────────────────────────────────────── */
function detectPlatform(): PlatformId {
  if (typeof navigator === "undefined") return "windows";
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod|android/i.test(ua)) return "pwa";
  const p = navigator.platform.toLowerCase();
  if (p.includes("win")) return "windows";
  if (p.includes("linux")) return "linux";
  if (p.includes("mac")) return "macos";
  return "windows";
}

/* ─── main component ────────────────────────────────────────────── */
export default function DownloadClient({ releases }: DownloadClientProps) {
  const [activePlatform, setActivePlatform] = useState<PlatformId>("windows");
  const [toast, setToast] = useState<{ message: string; type: "info" | "success" } | null>(null);
  const { t } = useI18n();

  const currentDetail = PLATFORM_CONFIG[activePlatform];
  const currentRelease = currentDetail.releaseKey ? releases[currentDetail.releaseKey] : null;

  // Scroll expansion state
  const scrollZoneRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [scrollP, setScrollP] = useState(0);
  const [clipStart, setClipStart] = useState({ t: 22, r: 3, b: 22, l: 48 });

  useEffect(() => {
    setActivePlatform(detectPlatform());
  }, []);

  const captureRect = useCallback(() => {
    if (!cardRef.current) return;
    const r = cardRef.current.getBoundingClientRect();
    const vw = window.innerWidth,
      vh = window.innerHeight;
    setClipStart({
      t: clamp((r.top / vh) * 100, 0, 48),
      r: clamp(((vw - r.right) / vw) * 100, 0, 48),
      b: clamp(((vh - r.bottom) / vh) * 100, 0, 48),
      l: clamp((r.left / vw) * 100, 0, 48),
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(captureRect, 300);
    window.addEventListener("resize", captureRect);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", captureRect);
    };
  }, [captureRect]);

  useEffect(() => {
    const handleScroll = () => {
      const zone = scrollZoneRef.current;
      if (!zone) return;
      const rect = zone.getBoundingClientRect();
      const scrollable = zone.offsetHeight - window.innerHeight;
      const scrolled = Math.max(0, -rect.top);
      setScrollP(Math.min(1, scrolled / scrollable));
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Expansion calculations
  const rawExp = scrollP < 0.25 ? scrollP / 0.25 : scrollP > 0.75 ? (1 - scrollP) / 0.25 : 1;
  const expansion = smoothstep(rawExp);

  const plateauP = scrollP < 0.25 ? 0 : scrollP > 0.75 ? 1 : (scrollP - 0.25) / 0.5;
  const [manualTab, setManualTab] = useState<number | null>(null);
  const activeScreen = manualTab !== null ? manualTab : plateauP < 0.33 ? 0 : plateauP < 0.67 ? 1 : 2;

  const cp = {
    t: lerp(clipStart.t, 0, expansion),
    r: lerp(clipStart.r, 0, expansion),
    b: lerp(clipStart.b, 0, expansion),
    l: lerp(clipStart.l, 0, expansion),
    radius: lerp(24, 0, expansion),
  };

  const heroOpacity = 1 - smoothstep(clamp((scrollP - 0.05) / 0.2, 0, 1));
  const SCREEN_LABELS = ["Counter POS", "Expiry Radar", "National Sync Network"];

  const handleDownloadClick = () => {
    if (activePlatform === "pwa") {
      setToast({
        message: "To install PWA: On iOS tap Share -> 'Add to Home Screen'. On Android tap Menu -> 'Install app'.",
        type: "info",
      });
      return;
    }

    if (currentRelease) {
      setToast({ message: t("download.toast.started"), type: "success" });
    } else {
      setToast({
        message: `${currentDetail.badge} build registered. Download link active in production package repository.`,
        type: "info",
      });
    }
  };

  return (
    <div className="min-h-screen bg-surface-base flex flex-col font-body-md text-on-surface antialiased overflow-x-hidden">
      <PublicNav />

      {/* ── Scroll-driven Workstation Hero ── */}
      <div ref={scrollZoneRef} style={{ minHeight: "240vh" }}>
        <div className="sticky top-0 h-screen overflow-hidden">
          
          {/* Edge-lit Fullscreen Overlay — smooth lerp clip-path on scroll */}
          <div
            aria-hidden={expansion < 0.05}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 40,
              clipPath: `inset(${cp.t}% ${cp.r}% ${cp.b}% ${cp.l}% round ${cp.radius}px)`,
              opacity: expansion,
              background: "#0A0E17",
              pointerEvents: expansion > 0.3 ? "auto" : "none",
            }}
          >
            {/* Ambient Radial Spotlight & Blueprint Grid */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `
                  radial-gradient(circle at 50% 30%, rgba(31, 95, 91, 0.22) 0%, rgba(10, 14, 23, 0) 70%),
                  linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px)
                `,
                backgroundSize: "100% 100%, 48px 48px, 48px 48px",
              }}
            />

            {/* Subtle Vector Brand Mark Watermark */}
            <div className="absolute bottom-8 left-8 pointer-events-none select-none opacity-10 flex items-center gap-3">
              <CervosEmblem state="idle" size={48} />
              <span className="font-headline-md text-xl font-bold text-white tracking-widest">
                CERVOS OS
              </span>
            </div>

            {/* Terminal Window Header Bar */}
            <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
              </div>

              <div className="flex items-center gap-2.5">
                <CervosEmblem state="idle" size={20} />
                <span className="text-slate-300 text-xs font-mono font-medium tracking-wide">
                  Cervos Pharmacy OS · Kariakoo Station #1 · v2.4.1 (Offline SQLite)
                </span>
              </div>

              {/* Interactive Screen Selector Tabs */}
              <div className="flex gap-1.5">
                {SCREEN_LABELS.map((label, idx) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setManualTab(idx)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      activeScreen === idx
                        ? "bg-primary text-white shadow-sm"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Feature Screens */}
            <div className="absolute inset-0 top-14">
              <TransactionScreen show={activeScreen === 0} />
              <NotificationsScreen show={activeScreen === 1} />
              <MapScreen show={activeScreen === 2} />
            </div>

            {/* Bottom Scroll Indicator */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10">
              <div className="flex gap-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="rounded-full transition-all duration-300"
                    style={{
                      width: activeScreen === i ? "24px" : "6px",
                      height: "6px",
                      background: activeScreen === i ? "#1039b9" : "rgba(255, 255, 255, 0.25)",
                    }}
                  />
                ))}
              </div>
              <p className="text-slate-400 text-[10px] font-mono uppercase tracking-widest">
                Scroll to explore screens · Click tabs to toggle
              </p>
            </div>
          </div>

          {/* Normal Hero — Fades out as user scrolls into the expanded workstation */}
          <div style={{ opacity: heroOpacity, transition: "opacity 0ms" }}>
            <section className="relative h-screen flex items-center overflow-hidden">
              <div className="max-w-container-max mx-auto px-5 sm:px-8 w-full pt-16">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
                  
                  {/* Left Column: Platform Pitch and Target Selector */}
                  <div className="lg:col-span-6 space-y-6">
                    <div className="space-y-3">
                      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        <span>Dedicated Station Installers &amp; Mobile PWA</span>
                      </div>

                      <h1 className="font-headline-xl text-3xl sm:text-4xl lg:text-5xl font-bold text-ink-deep tracking-tight">
                        {t("download.hero.title.1")}{" "}
                        <span className="text-primary">{t("download.hero.title.2")}</span>
                      </h1>

                      <p className="font-body-lg text-base text-on-surface-variant leading-relaxed max-w-xl">
                        {t("download.hero.body")}{" "}
                        <strong className="text-ink-deep font-semibold">
                          {t("download.hero.body.strong")}
                        </strong>
                      </p>
                    </div>

                    {/* Dedicated Dashboard Provisioning Callout */}
                    <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-ink-deep">
                          {t("download.portal.callout.title")}
                        </p>
                        <p className="text-[11px] text-on-surface-variant">
                          {t("download.portal.callout.desc")}
                        </p>
                      </div>
                      <Link
                        href="/dashboard/downloads"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-surface-base px-3 py-2 rounded-lg border border-outline-variant hover:bg-white shadow-sm shrink-0"
                      >
                        <span>Dashboard Downloads</span>
                        <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                      </Link>
                    </div>

                    {/* 4-Platform Selector Card */}
                    <div className="bg-surface-base border border-outline-variant rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
                      {/* Segmented Platform Tabs */}
                      <div className="grid grid-cols-4 gap-1.5 bg-surface-container-low p-1.5 rounded-xl border border-outline-variant">
                        {PLATFORMS.map((pid) => {
                          const conf = PLATFORM_CONFIG[pid];
                          const active = activePlatform === pid;
                          return (
                            <button
                              key={pid}
                              type="button"
                              onClick={() => setActivePlatform(pid)}
                              className={`flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                                active
                                  ? "bg-surface-base text-primary shadow-sm border border-outline-variant"
                                  : "text-on-surface-variant hover:text-ink-deep"
                              }`}
                            >
                              <span className="material-symbols-outlined text-[20px]">{conf.icon}</span>
                              <span className="text-[11px] font-medium">{conf.badge}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Active Platform Summary & Direct Download Action */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-ink-deep">{t(currentDetail.labelKey)}</span>
                          <span className="font-mono text-on-surface-variant">{currentDetail.sizeDesc}</span>
                        </div>

                        {activePlatform === "pwa" ? (
                          <div className="space-y-2">
                            <Link
                              href="/branch"
                              className="w-full bg-primary hover:bg-primary-variant text-on-primary py-3.5 px-6 rounded-xl flex justify-center items-center gap-3 font-semibold text-sm transition-all shadow-sm active:scale-[0.98]"
                            >
                              <span className="material-symbols-outlined text-[18px]">open_in_browser</span>
                              <span>Open Instant Web App</span>
                              <span className="ml-auto font-mono text-xs opacity-75">1-Tap Install</span>
                            </Link>
                            <p className="text-[11px] text-on-surface-variant text-center">
                              Works offline on iPhone, iPad, and Android devices via Service Worker.
                            </p>
                          </div>
                        ) : currentRelease ? (
                          <a
                            href={`/api/downloads/${currentRelease.id}/redirect`}
                            download
                            onClick={handleDownloadClick}
                            className="w-full bg-primary hover:bg-primary-variant text-on-primary py-3.5 px-6 rounded-xl flex justify-center items-center gap-3 font-semibold text-sm transition-all shadow-sm active:scale-[0.98]"
                          >
                            <span className="material-symbols-outlined text-[18px]">{currentDetail.icon}</span>
                            <span>{t(currentDetail.labelKey)}</span>
                            <span className="ml-auto font-mono text-xs opacity-75">{currentDetail.ext}</span>
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={handleDownloadClick}
                            className="w-full bg-primary hover:bg-primary-variant text-on-primary py-3.5 px-6 rounded-xl flex justify-center items-center gap-3 font-semibold text-sm transition-all shadow-sm active:scale-[0.98]"
                          >
                            <span className="material-symbols-outlined text-[18px]">{currentDetail.icon}</span>
                            <span>{t(currentDetail.labelKey)}</span>
                            <span className="ml-auto font-mono text-xs opacity-75">{currentDetail.ext}</span>
                          </button>
                        )}

                        <p className="text-center font-mono text-[11px] text-on-surface-variant">
                          {t(currentDetail.subKey)} · Free · No credit card needed
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Workstation Preview Frame */}
                  <div className="lg:col-span-6 relative">
                    <div
                      ref={cardRef}
                      className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-4 group transition-all duration-300"
                    >
                      {/* Window Header */}
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">
                          Cervos Terminal · Station #1 Kariakoo
                        </span>
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      </div>

                      {/* Workstation Screen Preview */}
                      <div className="bg-slate-950 rounded-2xl p-5 border border-slate-800/80 space-y-4">
                        <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2.5">
                          <div>
                            <p className="text-white font-semibold">Active Dispensing Queue</p>
                            <p className="text-[11px] text-slate-400">Strict FEFO Batch Selection</p>
                          </div>
                          <span className="text-[10px] font-mono uppercase bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">
                            Offline Ready
                          </span>
                        </div>

                        <div className="space-y-2">
                          {RECEIPT.slice(0, 3).map((item) => (
                            <div
                              key={item.name}
                              className="flex items-center justify-between bg-white/5 p-2.5 rounded-lg text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px] text-primary">
                                  medication
                                </span>
                                <span className="text-white">{item.name}</span>
                              </div>
                              <span className="text-slate-300 font-mono">TZS {item.price}</span>
                            </div>
                          ))}
                        </div>

                        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                          <span className="text-slate-400">Total: TZS 10,200</span>
                          <span className="text-emerald-400 font-mono text-[11px]">
                            0 Unsynced Sales · Live
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-center gap-2 pt-1 text-slate-400 text-xs font-mono">
                        <span className="material-symbols-outlined text-[16px] animate-bounce">
                          keyboard_arrow_down
                        </span>
                        <span>Scroll down to expand interactive workstation</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* ── 2. Platform Architecture & Features ── */}
      <section className="py-20 sm:py-24 bg-surface-container-lowest border-t border-outline-variant">
        <div className="max-w-container-max mx-auto px-5 sm:px-8">
          <div className="max-w-2xl mx-auto text-center space-y-2 mb-12">
            <p className="text-xs font-mono font-semibold uppercase tracking-widest text-primary">
              All 4 Builds · Unified Database Architecture
            </p>
            <h2 className="font-headline-lg text-2xl sm:text-3xl font-bold text-ink-deep">
              {t("download.features.title")}
            </h2>
            <p className="font-body-md text-on-surface-variant text-sm sm:text-base">
              {t("download.features.body")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon, titleKey, bodyKey }) => (
              <div
                key={titleKey}
                className="bg-surface-base border border-outline-variant rounded-2xl p-6 shadow-sm hover:border-primary/40 hover:shadow-md transition-all space-y-3"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                  <span className="material-symbols-outlined text-[20px]">{icon}</span>
                </div>
                <h3 className="font-semibold text-sm text-ink-deep">{t(titleKey)}</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">{t(bodyKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. Step-by-Step Installation Guides ── */}
      <section className="py-20 sm:py-24 bg-surface border-t border-outline-variant">
        <div className="max-w-container-max mx-auto px-5 sm:px-8">
          <div className="max-w-2xl mx-auto text-center space-y-2 mb-12">
            <h2 className="font-headline-lg text-2xl sm:text-3xl font-bold text-ink-deep">
              {t("download.how.title")}
            </h2>
            <p className="font-body-md text-on-surface-variant text-sm sm:text-base">
              {t("download.how.body")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map(({ n, titleKey, bodyKey }) => (
              <div
                key={n}
                className="bg-surface-base border border-outline-variant rounded-2xl p-6 shadow-sm space-y-3"
              >
                <span className="text-3xl font-bold font-mono text-primary/30">{n}</span>
                <h3 className="font-semibold text-base text-ink-deep">{t(titleKey)}</h3>
                <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                  {t(bodyKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. System Requirements ── */}
      <section className="py-20 sm:py-24 bg-surface-base border-t border-outline-variant">
        <div className="max-w-container-max mx-auto px-5 sm:px-8">
          <h2 className="font-headline-md text-xl sm:text-2xl font-bold text-ink-deep text-center mb-10">
            {t("download.req.title")}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: "memory", titleKey: "download.req.processor.title", specKey: "download.req.processor.spec", noteKey: "download.req.processor.note" },
              { icon: "developer_board", titleKey: "download.req.ram.title", specKey: "download.req.ram.spec", noteKey: "download.req.ram.note" },
              { icon: "hard_drive", titleKey: "download.req.storage.title", specKey: "download.req.storage.spec", noteKey: "download.req.storage.note" },
              { icon: "public", titleKey: "download.req.network.title", specKey: "download.req.network.spec", noteKey: "download.req.network.note" },
            ].map((r) => (
              <div
                key={r.titleKey}
                className="bg-surface border border-outline-variant rounded-2xl p-5 space-y-2"
              >
                <div className="w-8 h-8 rounded-lg bg-surface-base border border-outline-variant flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[18px]">{r.icon}</span>
                </div>
                <p className="font-mono text-[11px] text-on-surface-variant uppercase tracking-wider">
                  {t(r.titleKey)}
                </p>
                <p className="font-semibold text-sm text-ink-deep">{t(r.specKey)}</p>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">{t(r.noteKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. Pre-Footer Action Block ── */}
      <section className="py-20 bg-slate-900 text-white text-center border-t border-slate-800">
        <div className="max-w-2xl mx-auto px-5 sm:px-8 space-y-6">
          <h2 className="font-headline-lg text-2xl sm:text-3xl font-bold">
            {t("download.cta.title")}
          </h2>
          <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto">
            {t("download.cta.body")}
          </p>
          <div className="flex gap-3.5 justify-center flex-wrap pt-2">
            <Link
              href="/branch"
              className="bg-primary hover:bg-primary-variant text-on-primary text-sm font-semibold px-6 py-3.5 rounded-xl transition-colors shadow-md"
            >
              Open Instant Counter POS
            </Link>
            <Link
              href="/dashboard/downloads"
              className="border border-white/20 text-white text-sm font-semibold px-6 py-3.5 rounded-xl hover:bg-white/10 transition-colors"
            >
              Go to Dashboard Downloads
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-5 sm:px-8 flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-outline-variant bg-surface-container-lowest">
        <p className="text-xs text-on-surface-variant font-mono">
          © {new Date().getFullYear()} Cervos · hq@cervos.online
        </p>
        <div className="flex gap-6 text-xs font-semibold">
          {[
            { key: "footer.terms", href: "/terms" },
            { key: "footer.privacy", href: "/privacy" },
            { key: "footer.suppliers", href: "/supplier/quote" },
            { key: "footer.signin", href: "/auth" },
          ].map(({ key, href }) => (
            <Link
              key={key}
              href={href}
              className="text-on-surface-variant hover:text-primary transition-colors"
            >
              {t(key)}
            </Link>
          ))}
        </div>
      </footer>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
