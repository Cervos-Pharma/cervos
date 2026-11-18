"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { IconDownload, IconLock, IconShield } from "@/components/LandingIcons";
import { BranchChatDockedAside, useShellBranchChat } from "@/components/ShellBranchChat";

export interface WorkspaceNavItem {
  id: string;
  label: string;
  href?: string;
  active?: boolean;
  locked?: boolean;
  onClick?: () => void;
}

export interface WorkspaceNotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

interface WorkspaceShellProps {
  orgName: string;
  centreName: string;
  profileName: string;
  profileRole: string;
  brandLogoUrl?: string;
  brandAccent?: string;
  fontScale?: "compact" | "standard" | "large";
  lang: "EN" | "SW";
  onToggleLang: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  navItems: WorkspaceNavItem[];
  notifications?: WorkspaceNotificationItem[];
  onMarkNotificationsRead?: () => void;
  syncing?: boolean;
  lastSyncedAt?: string | null;
  onSyncNow?: () => void;
  showBranchChat?: boolean;
  onLockProfile: () => void;
  onSignOut: () => void;
  children: React.ReactNode;
}

function RailItemIcon({ id, active }: { id: string; active?: boolean }) {
  const stroke = active ? 2 : 1.75;
  switch (id) {
    case "overview":
    case "home":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955a1.126 1.126 0 0 1 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
        </svg>
      );
    case "operations":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
        </svg>
      );
    case "inventory":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
        </svg>
      );
    case "team":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
        </svg>
      );
    case "network":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582" />
        </svg>
      );
    case "reports":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
        </svg>
      );
    case "billing":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
        </svg>
      );
    case "download":
      return <IconDownload className="w-4 h-4" />;
    case "user_settings":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      );
    case "settings":
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      );
  }
}

function resolvePrimaryMobileAction(navItems: WorkspaceNavItem[], profileRole: string): WorkspaceNavItem | undefined {
  const roleLower = (profileRole || "").toLowerCase();
  const findAny = (ids: string[]) => ids.map((id) => navItems.find((n) => n.id === id)).find(Boolean);

  if (roleLower.includes("accountant") || roleLower.includes("finance")) {
    return findAny(["billing", "reports", "operations", "network"]) ?? navItems[1] ?? navItems[0];
  }
  if (roleLower.includes("warehouse") || roleLower.includes("dispatch") || roleLower.includes("store")) {
    return findAny(["inventory", "operations", "network", "reports"]) ?? navItems[1] ?? navItems[0];
  }
  if (roleLower.includes("supplier") || roleLower.includes("wholesale")) {
    return findAny(["network", "billing", "operations", "reports"]) ?? navItems[1] ?? navItems[0];
  }
  if (roleLower.includes("research") || roleLower.includes("investor")) {
    return findAny(["reports", "billing", "network"]) ?? navItems[1] ?? navItems[0];
  }
  // Pharmacy owner / pharmacist / cashier primary daily station = POS (`operations`), falling back on org hub
  return findAny(["operations", "billing", "reports", "inventory"]) ?? navItems[1] ?? navItems[0];
}

export default function WorkspaceShell({
  orgName,
  centreName,
  profileName,
  profileRole,
  brandLogoUrl,
  brandAccent = "#1039B9",
  fontScale = "standard",
  lang,
  onToggleLang,
  theme,
  onToggleTheme,
  searchQuery,
  onSearchChange,
  navItems,
  notifications = [],
  onMarkNotificationsRead,
  syncing = false,
  lastSyncedAt = null,
  onSyncNow,
  showBranchChat = true,
  onLockProfile,
  onSignOut,
  children,
}: WorkspaceShellProps) {
  const isDark = theme === "dark";
  const isSw = lang === "SW";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Opens expanded by default for ~1.1s on launch, then smoothly auto-collapses unless user pins/toggles manually
  const [railExpanded, setRailExpanded] = useState(true);
  const userToggledRef = useRef(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [mesh, setMesh] = useState({ x: 60, y: 30, active: false });
  const branchChat = useShellBranchChat();

  useEffect(() => {
    let collapseTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      const pinned = localStorage.getItem("cervos-rail-pinned");
      if (pinned === "1") {
        setRailExpanded(true);
      } else {
        collapseTimer = setTimeout(() => {
          if (!userToggledRef.current) setRailExpanded(false);
        }, 1150);
      }
    } catch {
      collapseTimer = setTimeout(() => {
        if (!userToggledRef.current) setRailExpanded(false);
      }, 1150);
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      if (collapseTimer) clearTimeout(collapseTimer);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const toggleRailExpanded = () => {
    userToggledRef.current = true;
    setRailExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("cervos-rail-pinned", next ? "1" : "0");
      } catch {
        // Ignore
      }
      return next;
    });
  };

  // Propagate fontScale and brandAccent into document CSS root variables so all `rem` text & surfaces react immediately
  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = fontScale === "compact" ? "13.5px" : fontScale === "large" ? "18.5px" : "16px";
    root.style.setProperty("--cv-accent", brandAccent);
    return () => {
      root.style.fontSize = "";
    };
  }, [fontScale, brandAccent]);

  const surfaceBg = isDark ? "bg-[#090C12] text-slate-100" : "bg-[#F5F6F8] text-[#111317]";
  const railPillCls = isDark
    ? "bg-[#11161F] border-slate-800 text-slate-400 hover:text-white"
    : "bg-white border-[#EAECF0] text-slate-500 hover:text-[#111317] shadow-[0_2px_8px_rgba(15,23,42,0.04)]";

  const initials = profileName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  const scaleCls =
    fontScale === "compact"
      ? "text-[13px]"
      : fontScale === "large"
        ? "text-[15.5px]"
        : "";

  return (
    <div
      ref={canvasRef}
      onPointerMove={(e) => {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        setMesh({
          x: ((e.clientX - rect.left) / rect.width) * 100,
          y: ((e.clientY - rect.top) / rect.height) * 100,
          active: true,
        });
      }}
      onPointerLeave={() => setMesh((p) => ({ ...p, active: false }))}
      className={`relative min-h-screen flex flex-col transition-colors duration-300 overflow-x-clip ${surfaceBg} ${scaleCls}`}
    >
      {/* Subtle Responsive Dotted Mesh Background */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: isDark
            ? "radial-gradient(rgba(148, 163, 184, 0.12) 1px, transparent 1px)"
            : "radial-gradient(rgba(15, 23, 42, 0.08) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-300"
        style={{
          opacity: mesh.active ? 0.9 : 0.25,
          backgroundImage: isDark
            ? "radial-gradient(rgba(56, 189, 248, 0.42) 1.2px, transparent 1.2px)"
            : "radial-gradient(rgba(16, 57, 185, 0.35) 1.2px, transparent 1.2px)",
          backgroundSize: "24px 24px",
          maskImage: `radial-gradient(300px circle at ${mesh.x}% ${mesh.y}%, black 0%, transparent 72%)`,
          WebkitMaskImage: `radial-gradient(300px circle at ${mesh.x}% ${mesh.y}%, black 0%, transparent 72%)`,
        }}
      />

      {/* Mobile Drawer Navigation */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs" onClick={() => setSidebarOpen(false)} />
          <div
            className={`relative z-10 w-68 max-w-[82vw] h-full p-5 flex flex-col justify-between border-r ${isDark ? "bg-[#0D1119] border-slate-800 text-slate-100" : "bg-white border-[#E2E8F0] text-[#111317]"
              }`}
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative w-8 h-8 rounded-full overflow-hidden ring-1 ring-slate-200 bg-white shrink-0">
                    <Image
                      src={brandLogoUrl || "/cervos-company-logo-circular.svg"}
                      alt={orgName}
                      fill
                      className="object-contain p-0.5"
                      unoptimized={Boolean(brandLogoUrl)}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{orgName}</div>
                    <div className="text-[10px] text-slate-400 truncate">{centreName}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 cursor-pointer"
                >
                  &times;
                </button>
              </div>

              <nav className="space-y-1.5">
                {navItems.map((item) => {
                  const cls = `w-full flex items-center justify-between px-3.5 py-2.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${item.active
                    ? isDark
                      ? "bg-white text-[#111317]"
                      : "bg-[#111317] text-white"
                    : isDark
                      ? "text-slate-300 hover:bg-white/5"
                      : "text-slate-600 hover:bg-slate-100"
                    }`;
                  if (item.href) {
                    return (
                      <Link key={item.id} href={item.href} onClick={() => setSidebarOpen(false)} className={cls}>
                        <span>{item.label}</span>
                        {item.locked && <IconLock className="w-3.5 h-3.5 text-amber-500" />}
                      </Link>
                    );
                  }
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        item.onClick?.();
                        setSidebarOpen(false);
                      }}
                      className={cls}
                    >
                      <span>{item.label}</span>
                      {item.locked && <IconLock className="w-3.5 h-3.5 text-amber-500" />}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="space-y-2 pt-4 border-t border-slate-200/20">
              <div className="grid grid-cols-3 gap-1.5 pb-1">
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className={`py-2 px-2 rounded-xl border text-[11px] font-semibold cursor-pointer ${railPillCls}`}
                >
                  {isDark ? (isSw ? "Mwanga" : "Light") : (isSw ? "Giza" : "Dark")}
                </button>
                <button
                  type="button"
                  onClick={onToggleLang}
                  className={`py-2 px-2 rounded-xl border text-[11px] font-semibold cursor-pointer ${railPillCls}`}
                >
                  {lang}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSidebarOpen(false);
                    setHelpOpen(true);
                  }}
                  className={`py-2 px-2 rounded-xl border text-[11px] font-semibold cursor-pointer ${railPillCls}`}
                >
                  {isSw ? "Mwongozo" : "Guide"}
                </button>
              </div>
              <Link
                href="/app/download"
                onClick={() => setSidebarOpen(false)}
                className={`block w-full py-2 px-3.5 rounded-full border text-xs font-semibold text-center ${railPillCls}`}
              >
                {isSw ? "Pakua Programu" : "Get Offline App"}
              </Link>
              {onSyncNow && (
                <button
                  type="button"
                  disabled={syncing}
                  onClick={() => {
                    onSyncNow();
                    setSidebarOpen(false);
                  }}
                  className={`w-full py-2 px-3.5 rounded-full border text-xs font-semibold cursor-pointer disabled:opacity-50 ${railPillCls}`}
                >
                  {syncing ? (isSw ? "Inasawazisha..." : "Syncing...") : (isSw ? "Sawazisha Sasa (Auto-Sync)" : "Sync Now (Auto-Sync On)")}
                </button>
              )}
              <button
                type="button"
                onClick={onLockProfile}
                className="w-full py-2.5 px-3.5 rounded-full text-xs font-semibold text-white cursor-pointer"
                style={{ backgroundColor: brandAccent }}
              >
                {isSw ? "Funga / Badili Wasifu" : "Switch Profile"}
              </button>
              <button
                type="button"
                onClick={onSignOut}
                className="w-full py-2 text-xs font-semibold text-rose-500 cursor-pointer"
              >
                {isSw ? "Ondoka Akaunti" : "Sign Out Org"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOP NAVIGATION HEADER: Sticky frosted bar following user on scroll */}
      <header
        className={`sticky top-0 z-30 w-full border-b backdrop-blur-xl transition-colors duration-200 ${
          isDark
            ? "bg-[#090C12]/88 border-slate-800/75"
            : "bg-[#F5F6F8]/88 border-[#E2E8F0]/80"
        }`}
      >
        <div className="w-full max-w-[1440px] mx-auto px-3.5 sm:px-7 py-2.5 flex items-center justify-between gap-2 sm:gap-3">
        {/* Left: Compact Org + Branch Identity (smoothly yields space on <lg when animated search expands) */}
        <Link
          href="/app"
          className={`flex items-center gap-2 min-w-0 transition-all duration-300 ${mobileSearchOpen ? "max-w-[44px] sm:max-w-none overflow-hidden" : "flex-1 lg:flex-initial"
            }`}
        >
          <div className="relative w-9 h-9 rounded-full overflow-hidden ring-1 ring-slate-200/80 bg-white shrink-0 shadow-2xs">
            <Image
              src={brandLogoUrl || "/cervos-company-logo-circular.svg"}
              alt={orgName}
              fill
              className="object-contain p-1"
              unoptimized={Boolean(brandLogoUrl)}
            />
          </div>
          <div className={`leading-tight min-w-0 transition-opacity duration-200 ${mobileSearchOpen ? "hidden sm:block" : "block"}`}>
            <div className="text-xs font-bold truncate max-w-[155px] sm:max-w-[200px]">{orgName}</div>
            <div className="text-[10px] text-slate-400 truncate max-w-[155px] sm:max-w-[200px]">{centreName}</div>
          </div>
        </Link>

        {/* Right Controls: Mobile = Expanding Search -> Expandable Menu -> User Button | Desktop = Full Bar */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
          {/* Mobile (< lg): Animated Expanding Inline Search Pill */}
          <div
            className={`lg:hidden relative flex items-center h-9 rounded-full border transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] overflow-hidden ${mobileSearchOpen
              ? `w-[186px] sm:w-64 px-2.5 ${isDark ? "bg-[#11161F] border-slate-700 text-white" : "bg-white border-slate-300 text-[#111317] shadow-xs"
              }`
              : `w-9 justify-center ${railPillCls}`
              }`}
          >
            <button
              type="button"
              onClick={() => {
                setMobileSearchOpen((open) => {
                  const next = !open;
                  if (next) {
                    setTimeout(() => searchInputRef.current?.focus(), 60);
                  }
                  return next;
                });
                setProfileMenuOpen(false);
                setBellOpen(false);
              }}
              aria-label={isSw ? "Tafuta" : "Search"}
              className="w-5 h-5 flex items-center justify-center shrink-0 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m0 0A7.5 7.5 0 1 0 5.64 5.64a7.5 7.5 0 0 0 11.01 11.01Z" />
              </svg>
            </button>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={isSw ? "Tafuta..." : "Search..."}
              className={`bg-transparent text-xs focus:outline-none transition-all duration-300 ${mobileSearchOpen ? "w-full ml-1.5 opacity-100" : "w-0 ml-0 opacity-0 pointer-events-none"
                }`}
            />
            {mobileSearchOpen && (
              <button
                type="button"
                onClick={() => {
                  onSearchChange("");
                  setMobileSearchOpen(false);
                }}
                aria-label="Close search"
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs opacity-70 hover:opacity-100 shrink-0 cursor-pointer"
              >
                &times;
              </button>
            )}
          </div>

          {/* Mobile (< lg): Expandable Menu Trigger (Top Right beside Search) */}
          <button
            type="button"
            onClick={() => {
              setSidebarOpen(true);
              setProfileMenuOpen(false);
              setBellOpen(false);
            }}
            aria-label={isSw ? "Fungua menyu" : "Open menu"}
            className={`lg:hidden relative w-9 h-9 rounded-full border flex items-center justify-center shrink-0 cursor-pointer ${railPillCls}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M12 17.25h8.25" />
            </svg>
            {notifications.some((n) => !n.read) && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#11161F]" />
            )}
          </button>

          {/* Desktop (>= lg): Always-open Search + Bell + Theme + Lang + Guide */}
          <div className="relative hidden lg:flex items-center">
            <svg
              className="w-3.5 h-3.5 absolute left-3 text-slate-400 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m0 0A7.5 7.5 0 1 0 5.64 5.64a7.5 7.5 0 0 0 11.01 11.01Z" />
            </svg>
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={isSw ? "Tafuta ndani ya kituo (/)..." : "Search records, batches, logs (/)"}
              className={`w-56 xl:w-64 pl-8 pr-3 py-2 rounded-full border text-xs transition-all focus:outline-none focus:w-72 ${isDark
                ? "bg-[#11161F] border-slate-800 text-white placeholder:text-slate-500 focus:border-[#38BDF8]"
                : "bg-white border-[#EAECF0] text-[#111317] placeholder:text-slate-400 focus:border-[#1039B9] shadow-[0_2px_8px_rgba(15,23,42,0.03)]"
                }`}
            />
          </div>

          <div className="relative hidden lg:block">
            <button
              type="button"
              onClick={() => {
                const next = !bellOpen;
                setBellOpen(next);
                setProfileMenuOpen(false);
                if (next && onMarkNotificationsRead) onMarkNotificationsRead();
              }}
              aria-label="Notifications"
              className={`relative w-9 h-9 rounded-full border flex items-center justify-center transition-colors cursor-pointer ${railPillCls}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.85}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
              </svg>
              {notifications.some((n) => !n.read) && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#11161F]" />
              )}
            </button>

            {bellOpen && (
              <div
                className={`animate-fade-in-scale absolute right-0 mt-2 w-72 rounded-2xl border p-3 shadow-2xl z-40 origin-top-right space-y-2 ${isDark ? "bg-[#11161F] border-slate-800 text-slate-100" : "bg-white border-[#EAECF0] text-[#111317]"
                  }`}
              >
                <div className="flex items-center justify-between px-1 pb-1 border-b border-slate-200/20">
                  <span className="text-[11px] font-bold uppercase tracking-wider">Recent Alerts</span>
                  <span className="text-[10px] text-slate-400">Latest 3</span>
                </div>
                {notifications.slice(0, 3).length === 0 ? (
                  <div className="py-3 text-center text-xs text-slate-400">All caught up.</div>
                ) : (
                  notifications.slice(0, 3).map((n) => (
                    <div
                      key={n.id}
                      className={`p-2.5 rounded-xl text-xs ${isDark ? "bg-slate-900/70" : "bg-[#F8FAFC]"
                        }`}
                    >
                      <div className="font-semibold text-[11px]">{n.title}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">{n.body}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? "Light mode" : "Dark mode"}
            className={`hidden lg:flex w-9 h-9 rounded-full border items-center justify-center transition-colors cursor-pointer ${railPillCls}`}
          >
            {isDark ? (
              <svg className="w-3.5 h-3.5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleLang}
            aria-label="Switch workspace language"
            title={isSw ? "Badili Lugha (EN / SW)" : "Switch Language (EN / SW)"}
            className={`hidden lg:flex h-9 px-3 rounded-full border items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer ${railPillCls}`}
          >
            <svg className="w-3.5 h-3.5 opacity-75" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m10.5 21 5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 0 1 6-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 0 1-3.827-5.802" />
            </svg>
            <span>{lang}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setHelpOpen(true);
              setBellOpen(false);
              setProfileMenuOpen(false);
            }}
            aria-label={isSw ? "Msaada & Mwongozo" : "Help & App Tutorial"}
            title={isSw ? "Msaada & Mwongozo" : "Help & App Tutorial"}
            className={`hidden lg:flex h-9 px-2.5 rounded-full border items-center gap-1 text-xs font-bold transition-colors cursor-pointer ${railPillCls}`}
          >
            <svg className="w-3.5 h-3.5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
            </svg>
            <span>{isSw ? "Mwongozo" : "Guide"}</span>
          </button>

          {onSyncNow && (
            <button
              type="button"
              disabled={syncing}
              onClick={onSyncNow}
              title={lastSyncedAt ? `Last synced ${lastSyncedAt.slice(11, 19)}` : "Auto-sync active"}
              className={`hidden lg:flex h-9 px-3 rounded-full border items-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60 ${railPillCls}`}
            >
              <span className={`w-2 h-2 rounded-full ${syncing ? "bg-amber-400 animate-pulse" : "bg-emerald-500"}`} />
              <span>{syncing ? (isSw ? "Sync..." : "Syncing...") : (isSw ? "Sawazisha" : "Sync Now")}</span>
            </button>
          )}

          {/* Far Right: User Avatar & Settings/Org/SignOut Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setProfileMenuOpen((o) => !o);
                setBellOpen(false);
              }}
              aria-label="User settings and account"
              className={`inline-flex items-center gap-2 p-1 lg:pl-1.5 lg:pr-2.5 rounded-full border transition-colors cursor-pointer ${railPillCls}`}
            >
              <span
                className="w-7 h-7 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0"
                style={{ backgroundColor: brandAccent }}
              >
                {initials || "C"}
              </span>
              <span className="hidden lg:inline text-xs font-semibold max-w-[110px] truncate">{profileName}</span>
            </button>

            {profileMenuOpen && (
              <div
                className={`animate-fade-in-scale absolute right-0 mt-2 w-60 rounded-2xl border p-2 shadow-2xl z-50 origin-top-right ${isDark ? "bg-[#11161F] border-slate-800 text-slate-100" : "bg-white border-[#EAECF0] text-[#111317]"
                  }`}
              >
                <div className="px-3 py-2 border-b border-slate-200/20 mb-1 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{profileName}</div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 truncate">
                      {profileRole.replace(/_/g, " ")}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={onToggleTheme}
                      className={`px-2 py-0.5 rounded-md border text-[10px] font-bold cursor-pointer ${railPillCls}`}
                    >
                      {isDark ? "Light" : "Dark"}
                    </button>
                    <button
                      type="button"
                      onClick={onToggleLang}
                      className={`px-2 py-0.5 rounded-md border text-[10px] font-bold cursor-pointer ${railPillCls}`}
                    >
                      {lang}
                    </button>
                  </div>
                </div>
                <Link
                  href="/app/settings?tab=user"
                  onClick={() => setProfileMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-blue-500/10"
                >
                  <svg className="w-3.5 h-3.5 opacity-75 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                  <span>{isSw ? "Mipangilio Yangu (PIN & Wasifu)" : "My Profile Settings"}</span>
                </Link>
                <Link
                  href="/app/settings?tab=org"
                  onClick={() => setProfileMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-blue-500/10"
                >
                  <svg className="w-3.5 h-3.5 opacity-75 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                  </svg>
                  <span>{isSw ? "Mipangilio ya Shirika" : "Organization Settings"}</span>
                </Link>
                <Link
                  href="/app/download"
                  onClick={() => setProfileMenuOpen(false)}
                  className="block px-3 py-2 rounded-xl text-xs font-semibold hover:bg-blue-500/10"
                >
                  {isSw ? "Pakua Programu" : "Offline App & PWA"}
                </Link>
                <button
                  type="button"
                  onClick={onLockProfile}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold hover:bg-blue-500/10 cursor-pointer"
                >
                  {isSw ? "Funga / Badili Wasifu" : "Switch / Lock Profile"}
                </button>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                >
                  {isSw ? "Ondoka Akaunti" : "Sign Out Org"}
                </button>
              </div>
            )}
          </div>
        </div>
        </div>
      </header>

      {/* BODY: STICKY EXPANDABLE LEFT RAIL + MAIN STAGE + STICKY RIGHT CHAT */}
      <div className={`relative z-10 flex-1 w-full px-3.5 sm:px-7 ${showBranchChat ? "lg:pr-0" : ""} py-3 sm:py-4 flex gap-5 items-start`}>
        {/* Left Expandable Sticky Pill Rail (Follows scroll cleanly) */}
        <aside
          className={`hidden lg:flex lg:sticky lg:top-[66px] lg:self-start lg:h-[calc(100dvh-76px)] flex-col justify-between py-2 shrink-0 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${railExpanded ? "w-48 items-stretch" : "w-11 items-center"
            }`}
        >
          <div className={`flex flex-col gap-2.5 ${railExpanded ? "items-stretch" : "items-center"}`}>
            {/* Smooth Rail Expand / Collapse Toggle */}
            <button
              type="button"
              onClick={toggleRailExpanded}
              aria-label={railExpanded ? "Collapse left menu to icons" : "Expand left menu to show labels"}
              title={railExpanded ? (isSw ? "Funga maneno" : "Icons only") : isSw ? "Panua menyu" : "Expand menu"}
              className={`h-9 rounded-full border flex items-center transition-all duration-300 cursor-pointer ${railExpanded ? "px-3 justify-between w-full" : "w-9 justify-center"
                } ${railPillCls}`}
            >
              {railExpanded && (
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 truncate">
                  {isSw ? "Menyu" : "Menu"}
                </span>
              )}
              <svg
                className={`w-3.5 h-3.5 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${railExpanded ? "rotate-180" : "rotate-0"
                  }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>

            {navItems.map((item) => {
              const btnCls = `group relative h-10 rounded-full border flex items-center transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer overflow-hidden ${railExpanded ? "px-3.5 gap-2.5 justify-start w-full" : "w-10 justify-center"
                } ${item.active
                  ? isDark
                    ? "bg-white text-[#111317] border-white shadow-md"
                    : "bg-[#111317] text-white border-[#111317] shadow-md"
                  : `${railPillCls} hover:scale-[1.03]`
                }`;

              const inner = (
                <>
                  <span className="shrink-0 transition-transform duration-200 group-hover:scale-105">
                    <RailItemIcon id={item.id} active={item.active} />
                  </span>
                  <span
                    className={`text-xs font-semibold whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${railExpanded
                      ? "opacity-100 translate-x-0 max-w-[140px]"
                      : "opacity-0 -translate-x-2 max-w-0 pointer-events-none"
                      }`}
                  >
                    {item.label}
                  </span>
                  {item.locked && (
                    <span
                      className={`${railExpanded
                        ? "ml-auto w-2 h-2 rounded-full bg-amber-400 shrink-0"
                        : "absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-white dark:ring-[#090C12]"
                        }`}
                    />
                  )}
                </>
              );

              if (item.href) {
                return (
                  <Link key={item.id} href={item.href} title={railExpanded ? undefined : item.label} className={btnCls}>
                    {inner}
                  </Link>
                );
              }
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  title={railExpanded ? undefined : item.label}
                  className={btnCls}
                >
                  {inner}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onLockProfile}
            title={railExpanded ? undefined : isSw ? "Funga / Badili Wasifu" : "Switch / Lock PIN Profile"}
            className={`group h-10 rounded-full border flex items-center transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer overflow-hidden ${railExpanded ? "px-3.5 gap-2.5 justify-start w-full" : "w-10 justify-center"
              } ${railPillCls}`}
          >
            <span className="shrink-0">
              <IconShield className="w-4 h-4" />
            </span>
            <span
              className={`text-xs font-semibold whitespace-nowrap transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${railExpanded
                ? "opacity-100 translate-x-0 max-w-[140px]"
                : "opacity-0 -translate-x-2 max-w-0 pointer-events-none"
                }`}
            >
              {isSw ? "Badili Wasifu" : "Switch Profile"}
            </span>
          </button>
        </aside>

        {/* Main Workspace Canvas (extra bottom padding for Mobile Bottom Dock) */}
        <main className="flex-1 min-w-0 pb-24 lg:pb-10 animate-page-enter transition-all duration-300">{children}</main>

        {/* Right Docked Branch Messages Panel (ONLY mounts inside a specific branch station) */}
        {showBranchChat && (
          <BranchChatDockedAside
            chat={branchChat}
            accent={brandAccent}
            isDark={isDark}
            isSw={isSw}
            railPillCls={railPillCls}
          />
        )}
      </div>

      {/* Role-First 3-Button Mobile Dock (< 1024px): Home | Big Primary Action | Messages */}
      {!branchChat.open && !sidebarOpen && (() => {
        const homeItem = navItems.find((n) => n.id === "overview" || n.id === "home") ?? navItems[0];
        const primaryItem = resolvePrimaryMobileAction(navItems, profileRole);
        const msgCount =
          showBranchChat && branchChat.available
            ? branchChat.badge
            : notifications.filter((n) => !n.read).length;

        return (
          <nav
            aria-label={isSw ? "Menyu ya Simu" : "Mobile Bottom Navigation"}
            className={`lg:hidden fixed bottom-0 inset-x-0 z-40 border-t backdrop-blur-xl px-4 pt-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] flex items-end justify-between gap-3 ${isDark
              ? "bg-[#0B0F17]/95 border-slate-800/90 text-slate-200"
              : "bg-white/95 border-[#E2E8F0] text-[#111317] shadow-[0_-6px_24px_rgba(15,23,42,0.06)]"
              }`}
          >
            {/* Left: Home / Dashboard */}
            {homeItem && (
              homeItem.href ? (
                <Link
                  href={homeItem.href}
                  className={`flex-1 min-h-[46px] px-2 py-1 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${homeItem.active ? "font-bold" : isDark ? "text-slate-400" : "text-slate-600"
                    }`}
                  style={homeItem.active ? { color: brandAccent } : undefined}
                >
                  <RailItemIcon id={homeItem.id} active={homeItem.active} />
                  <span className="truncate max-w-[78px]">{homeItem.label}</span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={homeItem.onClick}
                  className={`flex-1 min-h-[46px] px-2 py-1 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors cursor-pointer ${homeItem.active ? "font-bold" : isDark ? "text-slate-400" : "text-slate-600"
                    }`}
                  style={homeItem.active ? { color: brandAccent } : undefined}
                >
                  <RailItemIcon id={homeItem.id} active={homeItem.active} />
                  <span className="truncate max-w-[78px]">{homeItem.label}</span>
                </button>
              )
            )}

            {/* Center: Elevated Large Role-Primary CTA */}
            {primaryItem && (
              primaryItem.href ? (
                <Link
                  href={primaryItem.href}
                  className="shrink-0 -mt-3 h-12 px-5 rounded-full text-white shadow-lg flex items-center justify-center gap-2 text-xs font-bold tracking-tight active:scale-95 transition-transform"
                  style={{ backgroundColor: brandAccent }}
                >
                  <RailItemIcon id={primaryItem.id} active />
                  <span className="truncate max-w-[125px]">{primaryItem.label}</span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={primaryItem.onClick}
                  className="shrink-0 -mt-3 h-12 px-5 rounded-full text-white shadow-lg flex items-center justify-center gap-2 text-xs font-bold tracking-tight active:scale-95 transition-transform cursor-pointer"
                  style={{ backgroundColor: brandAccent }}
                >
                  <RailItemIcon id={primaryItem.id} active />
                  <span className="truncate max-w-[125px]">{primaryItem.label}</span>
                </button>
              )
            )}

            {/* Right: Messages / Branch Chat */}
            <Link
              type="button"
              onClick={() => {
                if (showBranchChat && branchChat.available) {
                  branchChat.toggle();
                } else {
                  if (onMarkNotificationsRead) onMarkNotificationsRead();
                  setSidebarOpen(true);
                }
              }}
              className={`relative flex-1 min-h-[46px] px-2 py-1 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors cursor-pointer ${isDark ? "text-slate-400" : "text-slate-600"
                }`}
            >
              <span className="relative">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.85}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                </svg>
                {msgCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-amber-400 text-[#111317] text-[9px] font-extrabold flex items-center justify-center">
                    {msgCount}
                  </span>
                )}
              </span>
              <span>{isSw ? "Ujumbe" : "Messages"}</span>
            </Link>
          </nav>
        );
      })()}

      {/* Interactive Guided Tutorial & Help Modal */}
      {
        helpOpen && (
          <div
            className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setHelpOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-2xl rounded-[28px] border p-6 sm:p-7 space-y-5 shadow-2xl animate-stage-pop ${isDark ? "bg-[#0F141D] border-slate-800 text-slate-100" : "bg-white border-[#EAECF0] text-[#111317]"
                }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: brandAccent }}>
                    {isSw ? "MWONGOZO WA HARAKA WA CERVOS" : "CERVOS INTERACTIVE GUIDE"}
                  </div>
                  <h2 className="text-xl font-bold mt-0.5" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                    {isSw ? "Jinsi ya Kutumia Kituo Chako" : "How to Run Your Pharmacy Workspace"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setHelpOpen(false)}
                  className={`px-3 py-1 rounded-full border text-xs font-semibold cursor-pointer ${railPillCls}`}
                >
                  {isSw ? "Funga" : "Close"} &times;
                </button>
              </div>

              {(() => {
                const steps = [
                  {
                    targetId: "overview",
                    title: isSw ? "1. Mtazamo Mkuu & Matawi" : "1. Org Hub & Entering a Branch",
                    body: isSw
                      ? "Wamiliki huanza kwenye Mtazamo Mkuu kuona matawi yote, maombi ya wafanyakazi, na ujumbe wa HQ. Bonyeza 'Ingia' kwenye kadi ya tawi lolote kufungua kaunta na gumzo lake."
                      : "Owners start in the All Centres hub to inspect gross totals, HQ notices, and access requests. Click Enter on any floating centre card to open that dispensary's live POS and branch chat.",
                    tip: isSw ? "Kila tawi lina gumzo lake la faragha upande wa kulia." : "Branch chat on the right is private per branch and activates only inside a station.",
                  },
                  {
                    targetId: "operations",
                    title: isSw ? "2. Kaunta ya POS & Ulinzi wa FEFO" : "2. Counter POS & FEFO Batch Lock",
                    body: isSw
                      ? "Mfumo hupanga makundi ya dawa kulingana na tarehe ya kuisha (FEFO) na huzuia kiotomatiki kuuza dawa zilizopitwa na muda au zilizowekwa karantini."
                      : "Counter POS picks the earliest valid expiry batch automatically (FEFO) and blocks expired or quarantined packs from checkout receipts.",
                    tip: isSw ? "Tumia skana ya msimbo au tafuta kwa jina la dawa." : "Scan GS1 barcodes directly or search brand/generic names above the shelf.",
                  },
                  {
                    targetId: "reports",
                    title: isSw ? "3. Ripoti, Edge ML & PDF Safi" : "3. Reports, Edge ML & Clean Branded PDF",
                    body: isSw
                      ? "Pata utabiri wa mauzo, alama ya afya ya duka, na ripoti binafsi za wafanyakazi. Bonyeza 'Chapisha / PDF Safi' kuchagua lugha kabla ya kutoa nakala yenye nembo ya kampuni."
                      : "Explore shop health rings, 7-day Edge ML trends, and individual staff metrics. Clicking Clean PDF or CSV asks your language & narrative preference and prints with your company logo.",
                    tip: isSw ? "Kila mfanyakazi anaweza kuona ripoti yake binafsi hata bila ufikiaji wa shirika zima." : "Every operator always has a My Performance view for their own shift receipts.",
                  },
                  {
                    targetId: "team",
                    title: isSw ? "4. Timu, Vibali & Usalama wa PIN" : "4. Team Permits, Immutable Guardrails & Screen Lock",
                    body: isSw
                      ? "Katika Timu & Vibali, chagua haki za kila mhudumu. Sheria za msingi za usalama hulinda fedha na stoo. Tumia 'Switch Profile' au 'Lock' ukiondoka kaunta."
                      : "Grant role checkboxes cleanly in Team & Permits. Immutable role guardrails protect financial P&L and batch integrity. Always lock or switch profiles between shift handoffs.",
                    tip: isSw ? "Unaweza kurekebisha PIN na haki za wafanyakazi kutoka mahali popote." : "Owners can rotate operator PINs and approve Welcome Lounge requests remotely.",
                  },
                ];
                const active = steps[tutorialStep] ?? steps[0];
                const matchingNav = navItems.find((n) => n.id === active.targetId);

                return (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-1.5">
                      {steps.map((st, idx) => (
                        <button
                          key={st.title}
                          type="button"
                          onClick={() => setTutorialStep(idx)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-colors ${tutorialStep === idx ? "text-white" : railPillCls
                            }`}
                          style={tutorialStep === idx ? { backgroundColor: brandAccent } : undefined}
                        >
                          {isSw ? `Hatua ${idx + 1}` : `Step ${idx + 1}`}
                        </button>
                      ))}
                    </div>

                    <div
                      className={`p-5 rounded-2xl border space-y-2.5 ${isDark ? "bg-[#171D28] border-slate-800" : "bg-[#F8FAFC] border-[#EAECF0]"
                        }`}
                    >
                      <h3 className="text-base font-bold">{active.title}</h3>
                      <p className={`text-xs leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}>{active.body}</p>
                      <div className="pt-1 text-[11px] font-semibold" style={{ color: brandAccent }}>
                        {isSw ? "Dokezo:" : "Tip:"} {active.tip}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={tutorialStep === 0}
                          onClick={() => setTutorialStep((s) => Math.max(0, s - 1))}
                          className={`px-3.5 py-2 rounded-full border text-xs font-semibold disabled:opacity-40 cursor-pointer ${railPillCls}`}
                        >
                          &larr; {isSw ? "Nyuma" : "Previous"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setTutorialStep((s) => (s + 1) % steps.length)}
                          className={`px-3.5 py-2 rounded-full border text-xs font-semibold cursor-pointer ${railPillCls}`}
                        >
                          {isSw ? "Hatua Ijayo" : "Next Step"} &rarr;
                        </button>
                      </div>

                      {matchingNav?.onClick && (
                        <button
                          type="button"
                          onClick={() => {
                            matchingNav.onClick?.();
                            setHelpOpen(false);
                          }}
                          className="px-4 py-2 rounded-full text-white text-xs font-semibold cursor-pointer"
                          style={{ backgroundColor: brandAccent }}
                        >
                          {isSw ? `Nenda: ${matchingNav.label}` : `Jump to ${matchingNav.label}`} &rarr;
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )
      }
    </div >
  );
}
