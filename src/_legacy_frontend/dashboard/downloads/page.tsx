"use client";

import { useState } from "react";
import Link from "next/link";
import PharmacySidebar from "@/components/PharmacySidebar";
import MobileMenuButton from "@/components/MobileMenuButton";
import { CervosEmblem, Button, Card, Badge, Notice, Stat } from "@cervos/ui";
import { useI18n } from "@/lib/i18n/context";

interface TerminalBuild {
  id: "windows" | "debian" | "pwa" | "macos";
  name: string;
  badge: string;
  fileExt: string;
  architecture: string;
  size: string;
  description: string;
  features: string[];
  recommended?: boolean;
}

const BUILDS: TerminalBuild[] = [
  {
    id: "windows",
    name: "Windows 64-bit NSIS Terminal",
    badge: "Recommended for Counter POS",
    fileExt: "cervos-pos-setup-v2.4.1.exe",
    architecture: "x86_64 NSIS Installer",
    size: "64.2 MB",
    description:
      "Full local binary terminal with embedded SQLite, USB barcode scanner listener, ESC/POS thermal receipt printer drivers, and background cloud sync.",
    features: [
      "Zero-lag offline SQLite sales & FEFO queue",
      "Native Windows USB printer & cash drawer trigger",
      "Automatic background delta sync to Cervos Cloud",
      "PIN-gated shift start, blind counts & handoffs",
    ],
    recommended: true,
  },
  {
    id: "debian",
    name: "Debian & Ubuntu Linux Package",
    badge: "Hardware & Touch Kiosks",
    fileExt: "cervos-pos_2.4.1_amd64.deb",
    architecture: "Debian .deb / AppImage",
    size: "58.7 MB",
    description:
      "Native packaging for dedicated touchscreen POS terminals, Linux mini-PCs, and Raspberry Pi counter stations with local systemd auto-start.",
    features: [
      "Low-memory headless or kiosk mode",
      "Linux raw socket receipt printing (CUPS/raw)",
      "Strict offline persistence under unstable power",
      "Debian APT repository auto-updates",
    ],
  },
  {
    id: "pwa",
    name: "Mobile PWA (Android, iPhone & iPad)",
    badge: "Instant 1-Tap Mobile POS",
    fileExt: "https://cervos.online/branch",
    architecture: "Progressive Web App (Offline IndexedDB)",
    size: "4.1 MB (Cached)",
    description:
      "Install directly from Chrome or Safari without app store friction. Perfect for roaming floor staff, delivery riders, and mobile stock audits.",
    features: [
      "Rear camera GS1 DataMatrix & barcode reader",
      "Full offline sale creation & local cache",
      "SMS & WhatsApp receipt dispatch via Textify",
      "Installs on Android, iPhone, iPad & Mac WebKit",
    ],
  },
  {
    id: "macos",
    name: "macOS Universal Disk Image",
    badge: "Owner & Back-Office Mac",
    fileExt: "Cervos-POS-2.4.1-Universal.dmg",
    architecture: "Apple Silicon & Intel Universal",
    size: "71.8 MB",
    description:
      "Optimized native build for pharmacy business owners and managers auditing stock, reconciling shifts, and overseeing operations from Mac.",
    features: [
      "Native macOS dark & light mode integration",
      "Full offline local ledger inspection",
      "Multi-branch live telemetry stream",
      "Touch ID & Keychain secure operator authentication",
    ],
  },
];

export default function DashboardDownloadsPage() {
  const { t } = useI18n();
  const [selectedBuild, setSelectedBuild] = useState<TerminalBuild["id"]>("windows");
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const active = BUILDS.find((b) => b.id === selectedBuild) ?? BUILDS[0];

  const handleTriggerDownload = (build: TerminalBuild) => {
    setDownloadSuccess(build.name);
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  return (
    <div className="flex min-h-screen bg-surface">
      <PharmacySidebar
        accountName="Uzuri Pharmacy Group"
        branchName="Kariakoo Flagship"
      />

      <div className="lg:ml-64 flex-1 min-w-0 flex flex-col">
        {/* Top Header */}
        <header className="bg-surface fixed top-0 right-0 h-16 border-b border-outline-variant flex items-center px-6 sm:px-8 lg:w-[calc(100%-16rem)] w-full z-10 backdrop-blur-md bg-surface-base/90">
          <MobileMenuButton />
          <div className="flex items-center gap-3">
            <CervosEmblem state="idle" size={32} />
            <div>
              <p className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest leading-none">
                Owner Workspace · Deployment
              </p>
              <h1 className="font-headline-md text-base sm:text-lg font-bold text-ink-deep leading-tight mt-0.5">
                Dedicated Terminal & POS Downloads
              </h1>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/branch"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant text-xs font-semibold text-ink-deep hover:bg-surface-container-low transition-colors"
            >
              <span className="material-symbols-outlined text-[15px]">point_of_sale</span>
              <span>Open Web POS</span>
            </Link>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-grow pt-20 px-4 sm:px-8 py-8 max-w-6xl mx-auto w-full space-y-8">
          {/* Overview Hero Card */}
          <div className="rounded-2xl border border-outline-variant bg-surface-base p-6 sm:p-8 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="max-w-2xl space-y-2">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Station Provisioning Active</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-ink-deep tracking-tight">
                Install Native POS Terminals for Your Branches
              </h2>
              <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed">
                Download verified binary packages for Windows NSIS, Linux Debian, Mobile PWA, or macOS.
                Every terminal includes embedded SQLite for 100% offline dispensing and syncs automatically with your owner dashboard.
              </p>
            </div>

            <div className="w-full md:w-auto p-4 rounded-xl border border-outline-variant bg-surface-container-low/60 shrink-0 space-y-2">
              <p className="font-mono text-[10px] uppercase text-on-surface-variant font-bold">
                Branch Linkage Code
              </p>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold text-primary tracking-widest bg-surface-base px-3 py-1.5 rounded border border-outline-variant">
                  UZURI-CBD-2026
                </span>
                <Badge tone="success">Verified</Badge>
              </div>
              <p className="text-[11px] text-on-surface-variant max-w-xs">
                Enter this activation code on any newly installed terminal to link it instantly to Kariakoo Flagship.
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card elevation="raised" padding="sm">
              <Stat label="Licensed Terminals" value="3 / 5" change="2 Slots Available" trend="up" />
            </Card>
            <Card elevation="raised" padding="sm">
              <Stat label="Active Online Now" value="1" change="Kariakoo Station #1" trend="flat" />
            </Card>
            <Card elevation="raised" padding="sm">
              <Stat label="Offline SQLite Buffer" value="0" change="All Sales Synced" trend="up" />
            </Card>
            <Card elevation="raised" padding="sm">
              <Stat label="Current POS Build" value="v2.4.1" change="Up to date" />
            </Card>
          </div>

          {downloadSuccess && (
            <Notice tone="success" title="Download Initiated">
              Downloading {downloadSuccess}. Launch setup and enter your branch code to begin.
            </Notice>
          )}

          {/* Platform Selector Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-ink-deep">Select Target Platform</h3>
              <span className="font-mono text-xs text-on-surface-variant">Version 2.4.1 (Stable Release)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {BUILDS.map((b) => {
                const isSelected = selectedBuild === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBuild(b.id)}
                    className={`text-left p-5 rounded-xl border transition-all duration-150 flex flex-col justify-between gap-4 ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/20"
                        : "border-outline-variant bg-surface-base hover:bg-surface-container-low"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono text-xs font-bold text-on-surface-variant uppercase">
                          {b.id}
                        </span>
                        {b.recommended && (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800">
                            Primary
                          </span>
                        )}
                      </div>
                      <h4 className="font-semibold text-sm sm:text-base text-ink-deep leading-snug">
                        {b.name}
                      </h4>
                      <p className="font-mono text-[11px] text-on-surface-variant mt-1">{b.size}</p>
                    </div>

                    <div className="pt-3 border-t border-outline-variant/60 flex items-center justify-between text-xs font-semibold text-primary">
                      <span>{isSelected ? "Selected" : "Inspect"}</span>
                      <span className="material-symbols-outlined text-[16px]">
                        {isSelected ? "check_circle" : "arrow_forward"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detailed Selected Build Card */}
          <div className="rounded-2xl border border-outline-variant bg-surface-base p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-outline-variant">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge tone="primary">{active.badge}</Badge>
                  <span className="font-mono text-xs text-on-surface-variant">{active.architecture}</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-ink-deep">{active.name}</h3>
                <p className="text-sm text-on-surface-variant mt-1">{active.description}</p>
              </div>

              <div className="shrink-0 flex items-center gap-3">
                {active.id === "pwa" ? (
                  <Link
                    href="/branch"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-primary text-on-primary font-semibold text-sm hover:bg-primary-variant transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">open_in_browser</span>
                    <span>Launch PWA Terminal</span>
                  </Link>
                ) : (
                  <Button
                    size="lg"
                    icon="box"
                    onClick={() => handleTriggerDownload(active)}
                  >
                    Download {active.fileExt.split(".").pop()?.toUpperCase()} ({active.size})
                  </Button>
                )}
              </div>
            </div>

            {/* Feature Checklist */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {active.features.map((feat, i) => (
                <div key={i} className="flex items-start gap-3 p-3.5 rounded-lg bg-surface-container-low/60 border border-outline-variant/60">
                  <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">
                    check_circle
                  </span>
                  <span className="text-xs sm:text-sm font-medium text-ink-deep">{feat}</span>
                </div>
              ))}
            </div>

            {/* Installation Steps */}
            <div className="p-4 rounded-xl border border-outline-variant bg-surface-muted/50 space-y-2">
              <p className="font-mono text-xs uppercase font-bold text-ink-deep">Installation Instructions:</p>
              <ol className="text-xs text-on-surface-variant space-y-1.5 list-decimal list-inside">
                <li>Run the downloaded package on your counter computer or tablet.</li>
                <li>When prompted for setup, input your pharmacy branch code (<code className="font-mono font-bold text-ink-deep">UZURI-CBD-2026</code>).</li>
                <li>Your local SQLite database will initialize immediately and pre-load all current medicine batches and prices.</li>
                <li>Start dispensing. Sales persist locally with zero lag and sync automatically when internet is available.</li>
              </ol>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
