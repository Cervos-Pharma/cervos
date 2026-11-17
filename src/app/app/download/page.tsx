"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import WorkspaceShell, { type WorkspaceNavItem } from "@/components/WorkspaceShell";
import PwaLaunchSplash from "@/components/PwaLaunchSplash";
import {
  IconApple,
  IconCheck,
  IconDownload,
  IconLinux,
  IconMobile,
  IconWindows,
} from "@/components/LandingIcons";
import { detectClientPlatform, getDownloadBuilds, type PlatformBuildId } from "@/lib/landing-data";
import { useWorkspaceTheme } from "@/lib/workspace/theme";
import { usePwaInstall } from "@/lib/workspace/usePwaInstall";

interface DownloadWorkspaceState {
  authenticated: boolean;
  account: {
    id: string;
    orgName: string;
    lang: "EN" | "SW";
    networkUnlocked: boolean;
    customization?: {
      brandLogoUrl?: string;
      brandAccent?: string;
      fontScale?: "compact" | "standard" | "large";
    };
  };
  centres: Array<{ id: string; name: string; region: string }>;
  activeCentreId: string | null;
  activeProfile: { id: string; displayName: string; role: string; isMasterAdmin: boolean } | null;
}

export default function InAppDownloadPage() {
  const router = useRouter();
  const { theme, isDark, toggleTheme } = useWorkspaceTheme();
  const { canPromptNative, isInstalled, installing, triggerInstall } = usePwaInstall();

  const [data, setData] = useState<DownloadWorkspaceState | null>(null);
  const [detected, setDetected] = useState<PlatformBuildId>("windows");
  const [searchQuery, setSearchQuery] = useState("");
  const [pwaNotice, setPwaNotice] = useState<string | null>(null);
  const [previewSplash, setPreviewSplash] = useState(false);

  useEffect(() => {
    setDetected(detectClientPlatform());
    fetch("/api/workspace/state")
      .then(async (r) => {
        if (r.status === 401) {
          router.replace("/auth?mode=signin");
          return null;
        }
        return r.json();
      })
      .then((res: DownloadWorkspaceState | null) => {
        if (!res) return;
        if (!res.activeProfile) {
          router.replace("/app/gate?stage=profile");
          return;
        }
        setData(res);
      });
  }, [router]);

  const toggleLang = async () => {
    if (!data) return;
    const nextLang = data.account.lang === "SW" ? "EN" : "SW";
    setData({ ...data, account: { ...data.account, lang: nextLang } });
    await fetch("/api/workspace/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_lang", lang: nextLang }),
    });
  };

  const lockProfile = async () => {
    await fetch("/api/workspace/gate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lock_profile" }),
    });
    router.push("/app/gate?stage=profile");
  };

  const signOutOrg = async () => {
    await fetch("/api/workspace/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "signout" }),
    });
    router.push("/auth?mode=signin");
  };

  const handleInstallPwa = async () => {
    const outcome = await triggerInstall();
    if (outcome === "installed") {
      setPwaNotice(
        data?.account.lang === "SW"
          ? "Cervos PWA imewekwa! Fungua programu au jaribu muonekano wa kuanzia hapa chini."
          : "Cervos PWA installed cleanly. Launch from your dock/home screen or preview the welcome splash."
      );
      setPreviewSplash(true);
    } else if (outcome === "manual") {
      setPwaNotice(
        data?.account.lang === "SW"
          ? "Kwenye Chrome/Edge bonyeza aikoni ya kusakinisha kwenye upau wa anwani, au iPhone Share > Add to Home Screen."
          : "Use your browser install icon in the address bar (or Safari Share > Add to Home Screen) to pin Cervos offline."
      );
    }
  };

  if (!data || !data.activeProfile) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 ${isDark ? "bg-[#090C12]" : "bg-[#F8FAFC]"}`}>
        <div className="max-w-3xl w-full space-y-4">
          <div className={`h-8 w-48 rounded-md animate-pulse ${isDark ? "bg-slate-800" : "bg-slate-200"}`} />
          <div className={`h-40 rounded-lg animate-pulse ${isDark ? "bg-slate-900" : "bg-white border border-[#E2E8F0]"}`} />
        </div>
      </div>
    );
  }

  const isSw = data.account.lang === "SW";
  const accent = data.account.customization?.brandAccent || "#1039B9";
  const activeCentre = data.centres.find((c) => c.id === data.activeCentreId) ?? data.centres[0];
  const builds = getDownloadBuilds(isSw);

  const navItems: WorkspaceNavItem[] = [
    { id: "home", label: isSw ? "Muhtasari" : "Workspace Home", href: "/app" },
    { id: "download", label: isSw ? "Pakua Programu" : "Get App & Offline", active: true, href: "/app/download" },
    { id: "settings", label: isSw ? "Mipangilio" : "Settings", href: "/app/settings" },
  ];

  const cardCls = isDark
    ? "bg-[#11161F]/92 border-slate-800 text-slate-100"
    : "bg-white/95 border-[#E2E8F0] text-[#0F172A] shadow-2xs";
  const mutedCls = isDark ? "text-slate-400" : "text-slate-500";

  const platformIcon = (id: PlatformBuildId) => {
    if (id === "pwa") return <IconMobile className="w-5 h-5" />;
    if (id === "windows") return <IconWindows className="w-5 h-5" />;
    if (id === "linux") return <IconLinux className="w-5 h-5" />;
    return <IconApple className="w-5 h-5" />;
  };

  return (
    <WorkspaceShell
      orgName={data.account.orgName}
      centreName={activeCentre?.name || "Primary Centre"}
      profileName={data.activeProfile.displayName}
      profileRole={data.activeProfile.role}
      brandLogoUrl={data.account.customization?.brandLogoUrl}
      brandAccent={accent}
      fontScale={data.account.customization?.fontScale}
      lang={data.account.lang}
      onToggleLang={toggleLang}
      theme={theme}
      onToggleTheme={toggleTheme}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      navItems={navItems}
      onLockProfile={lockProfile}
      onSignOut={signOutOrg}
    >
      <PwaLaunchSplash
        lang={data.account.lang}
        isDark={isDark}
        forceShow={previewSplash}
        onDismiss={() => setPreviewSplash(false)}
      />

      <div className="max-w-5xl mx-auto space-y-6">
        <div className="space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: accent }}>
            {isSw ? "FANYA KAZI HATA BILA MTANDAO" : "OFFLINE APP & INSTALLERS"}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
            {isSw ? "Sakinisha Cervos Kwenye Kifaa Chako" : "Install Cervos on This Device"}
          </h1>
          <p className={`text-xs sm:text-sm ${mutedCls}`}>
            {isSw
              ? "Tumia app kamili yenye kasi ya papo hapo, hifadhi ya kaunta bila mtandao, na usawazishaji wa moja kwa moja."
              : "Switch from a regular tab to an offline-ready workspace app - lighter, faster launches, and uninterrupted counter receipts."}
          </p>
        </div>

        {/* Highlighted Instant Browser App (PWA) Card */}
        <div className={`rounded-lg border p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-6 ${cardCls}`}>
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{isInstalled ? (isSw ? "TAYARI IMEWEKWA" : "INSTALLED AS PWA") : isSw ? "WEKA PAPO HAPO" : "INSTANT BROWSER PWA"}</span>
            </div>
            <h2 className="text-xl font-bold" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
              {isSw ? "Programu Nyepesi ya Kivinjari (PWA)" : "Instant App Experience · Zero Installer"}
            </h2>
            <p className={`text-xs sm:text-sm leading-relaxed ${mutedCls}`}>
              {isSw
                ? "Inafunguka kwa sekunde moja tu, inafanya kazi bila mtandao wa intaneti, na inahifadhi nafasi kwenye diski yako."
                : "Launches in its own clean window, stays lighter than desktop binaries, keeps counter stock cached offline, and opens with a clean welcome splash."}
            </p>
            {pwaNotice && (
              <div className="mt-2 p-3 rounded-md bg-blue-500/10 border border-blue-500/25 text-xs font-medium text-blue-600 dark:text-sky-300">
                {pwaNotice}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              disabled={installing}
              onClick={handleInstallPwa}
              className="px-5 py-2.5 rounded-md text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer transition-opacity hover:opacity-90"
              style={{ backgroundColor: accent }}
            >
              <IconDownload className="w-4 h-4" />
              <span>
                {installing
                  ? "..."
                  : canPromptNative
                    ? isSw
                      ? "Sakinisha Sasa (PWA)"
                      : "Install Instant PWA"
                    : isSw
                      ? "Maelekezo ya Kusakinisha PWA"
                      : "Install in Browser (PWA)"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewSplash(true)}
              className={`px-4 py-2.5 rounded-md border text-xs font-semibold cursor-pointer ${
                isDark ? "border-slate-700 hover:bg-slate-800" : "border-[#E2E8F0] hover:bg-slate-50"
              }`}
            >
              {isSw ? "Jaribu Ufunguzi wa PWA" : "Preview PWA Splash"}
            </button>
          </div>
        </div>

        {/* Device-Specific Native Downloads Inside Workspace */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {builds
            .filter((b) => !searchQuery.trim() || b.title.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((b) => {
              const isDetected = b.id === detected;
              const isPwaCard = b.id === "pwa";
              return (
                <div
                  key={b.id}
                  className={`rounded-lg border p-5 flex flex-col justify-between gap-4 transition-all ${cardCls} ${
                    isDetected ? "ring-1" : ""
                  }`}
                  style={isDetected ? { borderColor: accent } : undefined}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span
                        className={`w-9 h-9 rounded-md flex items-center justify-center ${
                          isDark ? "bg-slate-800 text-[#38BDF8]" : "bg-[#EFF6FF] text-[#1039B9]"
                        }`}
                      >
                        {platformIcon(b.id)}
                      </span>
                      {isDetected && (
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-bold text-white"
                          style={{ backgroundColor: accent }}
                        >
                          {isSw ? "Kifaa Chako" : "Detected"}
                        </span>
                      )}
                    </div>

                    <div>
                      <div className={`text-[10px] font-bold uppercase tracking-wider ${mutedCls}`}>
                        {b.eyebrow}
                      </div>
                      <div className="text-base font-bold mt-0.5">{b.title}</div>
                    </div>

                    <p className={`text-xs leading-relaxed ${mutedCls}`}>{b.desc}</p>
                  </div>

                  {isPwaCard ? (
                    <button
                      type="button"
                      onClick={handleInstallPwa}
                      className={`w-full py-2.5 px-3 rounded-md border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                        isDark
                          ? "border-slate-700 hover:border-[#38BDF8] text-white"
                          : "border-[#E2E8F0] hover:border-[#1039B9] text-[#0F172A]"
                      }`}
                    >
                      <IconCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{isSw ? "Sakinisha Kwenye Simu" : "Install Mobile PWA"}</span>
                    </button>
                  ) : (
                    <a
                      href={b.href}
                      download
                      className={`w-full py-2.5 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-2 text-center transition-colors ${
                        isDetected
                          ? "text-white"
                          : isDark
                            ? "border border-slate-700 hover:bg-slate-800 text-slate-200"
                            : "border border-[#E2E8F0] hover:bg-slate-50 text-[#0F172A]"
                      }`}
                      style={isDetected ? { backgroundColor: accent } : undefined}
                    >
                      <IconDownload className="w-3.5 h-3.5" />
                      <span>{b.cta}</span>
                    </a>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </WorkspaceShell>
  );
}
