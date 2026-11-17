"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import WorkspaceShell, {
  type WorkspaceNavItem,
  type WorkspaceNotificationItem,
} from "@/components/WorkspaceShell";

const CervosMap = dynamic(() => import("@/components/CervosMap"), { ssr: false });
import PwaLaunchSplash from "@/components/PwaLaunchSplash";
import { requestOpenBranchChat, WORKSPACE_REFRESH_EVENT } from "@/components/ShellBranchChat";
import PharmacyDashboard, {
  type DashboardBatch,
  type DashboardCatalogItem,
  type DashboardExpenseRecord,
  type DashboardHqMessage,
  type DashboardHqUpdate,
  type DashboardJoinRequest,
  type DashboardPaymentSettings,
  type DashboardSale,
  type DashboardSavedCustomer,
  type DashboardShiftLog,
  type DashboardStaffProfile,
  type DashboardWholesaleOrder,
  type NotificationEnvInfo,
  type PharmacyTab,
} from "@/components/dashboards/PharmacyDashboard";
import {
  clampProfileCapabilities,
  type ProfileCapabilities,
  type WorkspaceProfileRole,
} from "@/lib/workspace/permissions";
import { IconCheck, IconDownload, IconLock, IconShield } from "@/components/LandingIcons";
import { useWorkspaceTheme } from "@/lib/workspace/theme";
import { usePwaInstall } from "@/lib/workspace/usePwaInstall";
import { useI18n } from "@/lib/i18n/context";

interface AuditLogEntry {
  id: string;
  actor: string;
  category: string;
  action: string;
  createdAt: string;
}

interface AppWorkspaceData {
  authenticated: boolean;
  account: {
    id: string;
    email: string;
    fullName: string;
    roleType: "pharmacy" | "supplier" | "dispensary" | "researcher" | "investor" | "other";
    orgName: string;
    region: string;
    lang: "EN" | "SW";
    onboardingDone: boolean;
    verificationStatus: "skipped" | "verified";
    networkUnlocked: boolean;
    subscriptionActive: boolean;
    subscriptionPlan: string;
    billingOverdue?: boolean;
    trialEndsAt?: string;
    accessLock?: { locked: boolean; source: "hq" | "billing" | null; reason: string };
    customization?: {
      brandLogoUrl?: string;
      brandAccent?: string;
      fontScale?: "compact" | "standard" | "large";
      layoutType?: "balanced" | "focus" | "executive";
      themePref?: "light" | "dark" | "system";
    };
  };
  centres: Array<{ id: string; name: string; region: string; address: string; lat?: number; lng?: number }>;
  profiles: DashboardStaffProfile[];
  auditLogs: AuditLogEntry[];
  batches?: DashboardBatch[];
  sales?: DashboardSale[];
  wholesaleOrders?: DashboardWholesaleOrder[];
  supplierCatalog?: DashboardCatalogItem[];
  expenses?: DashboardExpenseRecord[];
  paymentSettings?: DashboardPaymentSettings | null;
  joinRequests?: DashboardJoinRequest[];
  hqUpdates?: DashboardHqUpdate[];
  hqMessages?: DashboardHqMessage[];
  savedCustomers?: DashboardSavedCustomer[];
  shiftLogs?: DashboardShiftLog[];
  notificationEnv?: NotificationEnvInfo;
  stockAlerts?: { nearExpiryCount: number; expiredCount: number; lowStockCount: number };
  notifications?: WorkspaceNotificationItem[];
  activeCentreId: string | null;
  activeProfile: {
    id: string;
    centreId: string;
    displayName: string;
    role: string;
    isMasterAdmin: boolean;
    capabilities?: ProfileCapabilities;
    profilePrefs?: {
      fontScale?: "compact" | "standard" | "large";
      themePref?: "light" | "dark" | "system";
      preferredLang?: "EN" | "SW";
    };
  } | null;
}

type AppTab = PharmacyTab;

export default function WorkspaceHomePage() {
  const router = useRouter();
  const { setLang: setI18nLang } = useI18n();
  const { theme, isDark, toggleTheme } = useWorkspaceTheme();
  const { canPromptNative, isInstalled, installing, triggerInstall } = usePwaInstall();

  const [data, setData] = useState<AppWorkspaceData | null>(null);
  const [tab, setTab] = useState<AppTab>("overview");
  const [orgScope, setOrgScope] = useState<"all" | "branch">("branch");
  const [sessionLockedOut, setSessionLockedOut] = useState(false);
  const userChoseScopeRef = useRef(false);

  const handleSetOrgScope = (nextScope: "all" | "branch") => {
    userChoseScopeRef.current = true;
    setOrgScope(nextScope);
    if (nextScope === "all" && (tab === "operations" || tab === "inventory" || tab === "receipts")) {
      setTab("overview");
    }
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [showInstallOffer, setShowInstallOffer] = useState(false);
  const [installNotice, setInstallNotice] = useState<string | null>(null);
  const [previewSplash, setPreviewSplash] = useState(false);

  // Quick Counter POS / Action Demo State
  const [cartTotal, setCartTotal] = useState(14500);
  const [cartItems, setCartItems] = useState(1);
  const [receiptMsg, setReceiptMsg] = useState<string | null>(null);

  const fetchState = async () => {
    const r = await fetch("/api/workspace/state", { cache: "no-store" });
    if (r.status === 401) {
      setSessionLockedOut(true);
      setData(null);
      router.replace("/auth?mode=signin");
      return;
    }
    const res = (await r.json()) as AppWorkspaceData & { loungeOnly?: boolean };
    if (res.loungeOnly) {
      router.replace("/app/lounge");
      return;
    }
    if (!res.account?.onboardingDone) {
      router.replace("/app/onboarding");
      return;
    }
    if (!res.activeProfile) {
      router.replace("/app/gate?stage=profile");
      return;
    }
    setI18nLang(res.account.lang);
    setData(res);
  };

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const urlTab = sp.get("tab") as AppTab | null;
      if (urlTab && ["overview", "operations", "receipts", "inventory", "network", "reports", "billing", "team"].includes(urlTab)) {
        setTab(urlTab);
        if (urlTab === "operations" || urlTab === "inventory" || urlTab === "receipts") {
          userChoseScopeRef.current = true;
          setOrgScope("branch");
        }
      }
      if (sp.get("scope") === "all") {
        userChoseScopeRef.current = true;
        setOrgScope("all");
      } else if (sp.get("scope") === "branch") {
        userChoseScopeRef.current = true;
        setOrgScope("branch");
      }
    } catch {
      // Ignore URL parse error
    }
    fetchState();
    const onRefresh = () => fetchState();
    window.addEventListener(WORKSPACE_REFRESH_EVENT, onRefresh);
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        void fetchState();
      }
    };
    window.addEventListener("pageshow", onPageShow);
    try {
      const justSignedIn = window.sessionStorage.getItem("cervos-just-logged-in") === "1";
      const dismissed = window.sessionStorage.getItem("cervos-install-offer-dismissed") === "1";
      if (justSignedIn && !dismissed) {
        setShowInstallOffer(true);
      }
    } catch {
      // Ignore storage block
    }
    return () => {
      window.removeEventListener(WORKSPACE_REFRESH_EVENT, onRefresh);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  useEffect(() => {
    if (!data?.activeProfile || !data?.account || userChoseScopeRef.current) return;
    const isAdmin =
      data.activeProfile.role === "pharmacy_owner" ||
      data.activeProfile.role === "supplier_admin" ||
      data.activeProfile.role === "regulator_officer";
    const isPharm = data.account.roleType === "pharmacy" || data.account.roleType === "other";
    if (isAdmin && isPharm) {
      try {
        const sp = new URLSearchParams(window.location.search);
        const urlTab = sp.get("tab");
        if (sp.get("scope") !== "branch" && urlTab !== "operations" && urlTab !== "inventory") {
          setOrgScope("all");
        }
      } catch {
        setOrgScope("all");
      }
      userChoseScopeRef.current = true;
    }
  }, [data?.activeProfile, data?.account]);

  const dismissInstallOffer = () => {
    setShowInstallOffer(false);
    try {
      window.sessionStorage.setItem("cervos-install-offer-dismissed", "1");
    } catch {
      // Ignore
    }
  };

  const handleQuickPwaInstall = async () => {
    const outcome = await triggerInstall();
    if (outcome === "installed") {
      setShowInstallOffer(false);
      setPreviewSplash(true);
    } else if (outcome === "manual") {
      setInstallNotice(
        data?.account.lang === "SW"
          ? "Bonyeza aikoni ya kusakinisha kwenye kivinjari chako, au nenda Pakua Programu kuchagua kifaa."
          : "Click your browser's install icon or open Get App for step-by-step & desktop builds."
      );
    }
  };

  const toggleLang = async () => {
    if (!data) return;
    const nextLang = data.account.lang === "SW" ? "EN" : "SW";
    setI18nLang(nextLang);
    setData({ ...data, account: { ...data.account, lang: nextLang } });
    await fetch("/api/workspace/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_lang", lang: nextLang }),
    });
  };

  const lockProfile = async () => {
    setSessionLockedOut(true);
    setData(null);
    await fetch("/api/workspace/gate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lock_profile" }),
    });
    router.replace("/app/gate?stage=profile");
  };

  const signOutOrg = async () => {
    setSessionLockedOut(true);
    setData(null);
    await fetch("/api/workspace/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "signout" }),
    });
    router.replace("/auth?mode=signin");
  };

  const paySubscription = async (planName?: string) => {
    if (!data) return;
    const res = await fetch("/api/workspace/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "activate_subscription",
        planName: planName || data.account.subscriptionPlan || "Community Standard",
      }),
    });
    if (res.ok) {
      await fetchState();
    }
  };

  const switchCentre = async (centreId: string) => {
    const res = await fetch("/api/workspace/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "switch_centre", centreId }),
    });
    if (res.ok) {
      userChoseScopeRef.current = true;
      setOrgScope("branch");
      await fetchState();
      window.dispatchEvent(new Event(WORKSPACE_REFRESH_EVENT));
    }
  };

  const recordDemoSale = async () => {
    if (!data) return;
    const amount = cartTotal;
    const res = await fetch("/api/workspace/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "record_pos_sale", amountTzs: amount, itemCount: cartItems }),
    });
    if (res.ok) {
      setReceiptMsg(`Receipt issued for TZS ${amount.toLocaleString("en-US")}`);
      setCartTotal(0);
      setCartItems(0);
      await fetchState();
    }
  };

  const handleMarkNotificationsRead = async () => {
    if (!data?.notifications?.some((n) => !n.read)) return;
    setData({
      ...data,
      notifications: data.notifications.map((n) => ({ ...n, read: true })),
    });
    await fetch("/api/workspace/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_notifications_read" }),
    });
  };

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = data?.auditLogs ?? [];
    if (!q) return list;
    return list.filter(
      (log) =>
        log.action.toLowerCase().includes(q) ||
        log.actor.toLowerCase().includes(q) ||
        log.category.toLowerCase().includes(q)
    );
  }, [data?.auditLogs, searchQuery]);

  if (sessionLockedOut) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 ${isDark ? "bg-[#090C12] text-slate-100" : "bg-[#F8FAFC] text-[#111317]"}`}>
        <div className={`w-full max-w-md rounded-[28px] border p-7 text-center space-y-4 ${isDark ? "bg-[#11161F] border-slate-800" : "bg-white border-[#EAECF0]"}`}>
          <div className="w-12 h-12 mx-auto rounded-full bg-blue-500/10 text-[#1039B9] flex items-center justify-center">
            <IconLock className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
            Workspace Screen Locked
          </h2>
          <p className={`text-xs ${isDark ? "text-slate-400" : "text-[#64748B]"}`}>
            Your active session was secured and cleared from screen memory. Sign back in or enter your PIN to continue.
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <Link href="/app/gate?stage=profile" className="flex-1 py-2.5 rounded-full border text-xs font-semibold text-center">
              Profile PIN Gate
            </Link>
            <Link href="/auth?mode=signin" className="flex-1 py-2.5 rounded-full text-white text-xs font-semibold text-center bg-[#1039B9]">
              Sign In Again
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!data || !data.activeProfile) {
    return (
      <div className={`min-h-screen p-6 sm:p-10 transition-colors ${isDark ? "bg-[#090C12]" : "bg-[#F8FAFC]"}`}>
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className={`h-9 w-64 rounded-md animate-pulse ${isDark ? "bg-slate-800" : "bg-white border border-[#E2E8F0]"}`} />
            <div className="flex gap-2">
              <div className={`h-9 w-20 rounded-md animate-pulse ${isDark ? "bg-slate-800" : "bg-white border border-[#E2E8F0]"}`} />
              <div className={`h-9 w-24 rounded-md animate-pulse ${isDark ? "bg-slate-800" : "bg-white border border-[#E2E8F0]"}`} />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className={`lg:col-span-8 h-44 rounded-lg animate-pulse ${isDark ? "bg-slate-900 border border-slate-800" : "bg-white border border-[#E2E8F0]"}`} />
            <div className={`lg:col-span-4 h-44 rounded-lg animate-pulse ${isDark ? "bg-slate-900 border border-slate-800" : "bg-white border border-[#E2E8F0]"}`} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className={`lg:col-span-7 h-56 rounded-lg animate-pulse ${isDark ? "bg-slate-900 border border-slate-800" : "bg-white border border-[#E2E8F0]"}`} />
            <div className={`lg:col-span-5 h-56 rounded-lg animate-pulse ${isDark ? "bg-slate-900 border border-slate-800" : "bg-white border border-[#E2E8F0]"}`} />
          </div>
        </div>
      </div>
    );
  }

  const { account, activeProfile, centres, profiles, activeCentreId } = data;
  const activeCentre = centres.find((c) => c.id === activeCentreId) ?? centres[0];
  const isSw = account.lang === "SW";
  const brandAccent = account.customization?.brandAccent || "#1039B9";
  const layoutType = account.customization?.layoutType || "balanced";

  const role = activeProfile.role;
  const canManageAdmin =
    role === "pharmacy_owner" || role === "supplier_admin" || activeProfile.isMasterAdmin;
  const canManageStock = canManageAdmin || role === "superintendent_pharmacist";
  const resolvedCaps = clampProfileCapabilities(
    (role as WorkspaceProfileRole) || "pos_cashier",
    activeProfile.capabilities,
    activeProfile.isMasterAdmin
  );
  const isPharmacyWorkspace = account.roleType === "pharmacy" || account.roleType === "other";
  const isGeneralOrgHub = isPharmacyWorkspace && canManageAdmin && orgScope === "all";

  const roleSectionTitle = (() => {
    switch (account.roleType) {
      case "supplier":
        return isSw ? "Kituo cha Msambazaji" : "Wholesale Depot Desk";
      case "dispensary":
        return isSw ? "Huduma ya Kliniki" : "Clinic Dispensary";
      case "researcher":
        return isSw ? "Takwimu za Afya" : "Research Insights";
      case "investor":
        return isSw ? "Mwonekano wa Uwekezaji" : "Investor Brief";
      default:
        return isSw ? "Kaunta ya POS" : "Counter POS";
    }
  })();

  const navItems: WorkspaceNavItem[] = isGeneralOrgHub
    ? [
        {
          id: "overview",
          label: isSw ? "Matawi Yote" : "All Centres",
          active: tab === "overview",
          onClick: () => setTab("overview"),
        },
        {
          id: "billing",
          label: isSw ? "Fedha & Kulinganisha" : "Finance & Compare",
          active: tab === "billing",
          onClick: () => setTab("billing"),
        },
        {
          id: "reports",
          label: isSw ? "Ripoti & Akili" : "Reports & Insights",
          active: tab === "reports",
          onClick: () => setTab("reports"),
        },
        {
          id: "network",
          label: isSw ? "Jumla & B2B" : "B2B Wholesale",
          active: tab === "network",
          locked: !account.networkUnlocked,
          onClick: () => setTab("network"),
        },
        {
          id: "team",
          label: isSw ? "Timu & Ufikiaji" : "Team & Access",
          active: tab === "team",
          onClick: () => setTab("team"),
        },
        {
          id: "user_settings",
          label: isSw ? "Wasifu Wangu" : "My Settings",
          href: "/app/settings?tab=user",
        },
        {
          id: "settings",
          label: isSw ? "Mipangilio ya Shirika" : "Org Settings",
          href: "/app/settings?tab=org",
        },
      ]
    : isPharmacyWorkspace
      ? [
          {
            id: "overview",
            label: isSw ? "Muhtasari" : "Overview",
            active: tab === "overview",
            onClick: () => setTab("overview"),
          },
          ...(resolvedCaps.canSellPos
            ? [
                {
                  id: "operations",
                  label: isSw ? "Kaunta ya POS" : "Counter POS",
                  active: tab === "operations",
                  onClick: () => setTab("operations"),
                },
              ]
            : []),
          {
            id: "receipts",
            label: isSw ? "Risiti Zote" : "Receipts",
            active: tab === "receipts",
            onClick: () => setTab("receipts"),
          },
          ...(resolvedCaps.canEditInventory || resolvedCaps.canViewOrgReports
            ? [
                {
                  id: "inventory",
                  label: isSw ? "Hifadhi & FEFO" : "Inventory & FEFO",
                  active: tab === "inventory",
                  onClick: () => setTab("inventory"),
                },
              ]
            : []),
          {
            id: "network",
            label: isSw ? "Bohari & Kasri" : "Wholesale & Kasri",
            active: tab === "network",
            locked: !account.networkUnlocked,
            onClick: () => setTab("network"),
          },
          {
            id: "reports",
            label: isSw ? "Ripoti & Akili" : "Reports & Insights",
            active: tab === "reports",
            onClick: () => setTab("reports"),
          },
          ...(resolvedCaps.canViewFinance || canManageAdmin
            ? [
                {
                  id: "billing",
                  label: isSw ? "Fedha & Malipo" : "Finance & Billing",
                  active: tab === "billing",
                  onClick: () => setTab("billing"),
                },
              ]
            : []),
          ...(resolvedCaps.canManageTeam || canManageAdmin
            ? [
                {
                  id: "team",
                  label: isSw ? "Timu & Vibali" : "Team & Permits",
                  active: tab === "team",
                  onClick: () => setTab("team"),
                },
              ]
            : []),
          {
            id: "user_settings",
            label: isSw ? "Wasifu Wangu" : "My Settings",
            href: "/app/settings?tab=user",
          },
        ]
    : [
        {
          id: "overview",
          label: isSw ? "Muhtasari" : "Overview",
          active: tab === "overview",
          onClick: () => setTab("overview"),
        },
        {
          id: "operations",
          label: roleSectionTitle,
          active: tab === "operations",
          onClick: () => setTab("operations"),
        },
        {
          id: "network",
          label: isSw ? "Mtandao wa Cervos" : "Cervos Network",
          active: tab === "network",
          locked: !account.networkUnlocked,
          onClick: () => setTab("network"),
        },
        ...(canManageAdmin
          ? [
              {
                id: "billing",
                label: isSw ? "Mpango & Malipo" : "Plan & Billing",
                active: tab === "billing",
                onClick: () => setTab("billing"),
              },
              {
                id: "settings",
                label: isSw ? "Mipangilio ya Shirika" : "Org Settings",
                href: "/app/settings?tab=org",
              },
            ]
          : [
              {
                id: "user_settings",
                label: isSw ? "Wasifu Wangu" : "My Settings",
                href: "/app/settings?tab=user",
              },
            ]),
      ];

  const cardSurface = isDark
    ? "bg-[#11161F]/90 border-slate-800 text-slate-100"
    : "bg-white/95 border-[#E2E8F0] text-[#0F172A] shadow-2xs";

  const mutedText = isDark ? "text-slate-400" : "text-slate-500";

  const roleActions = (() => {
    switch (account.roleType) {
      case "supplier":
        return {
          headline: isSw ? "Simamia ghala lako na maagizo" : "Manage warehouse dispatches and depot lots",
          primaryBtn: isSw ? "Fungua Orodha ya Ghala" : "Open Depot Dispatch",
          actionHint: "Log outbound batch numbers and prep delivery manifests.",
        };
      case "dispensary":
        return {
          headline: isSw ? "Hudumia wagonjwa na kagua rafu za wodi" : "Manage outpatient dispensing and ward cover",
          primaryBtn: isSw ? "Fungua Kaunta ya Zahanati" : "Open Clinic Dispensary",
          actionHint: "Check earliest valid packs before issuing prescriptions.",
        };
      case "researcher":
        return {
          headline: isSw ? "Mwelekeo wa upatikanaji wa dawa mikoani" : "Review regional availability & research briefs",
          primaryBtn: isSw ? "Tazama Kanda" : "Explore Study Notes",
          actionHint: "Network certificate verification unlocks aggregate regional exports.",
        };
      case "investor":
        return {
          headline: isSw ? "Ukuaji wa vituo na mtiririko wa Kasri\u2122" : "Portfolio adoption & verified corridor velocity",
          primaryBtn: isSw ? "Kagua Ukuaji" : "Review Portfolio Metrics",
          actionHint: "Verified partner credentials unlock full quarterly governance.",
        };
      default:
        return {
          headline: isSw ? "Endelea na mauzo ya kaunta & hesabu" : "Ring patients quickly and keep shelves safe",
          primaryBtn: isSw ? "Fungua Kaunta" : "Open Counter Register",
          actionHint: "Offline-ready POS works immediately even if network verification is skipped.",
        };
    }
  })();

  if (account.accessLock?.locked) {
    const isBilling = account.accessLock.source === "billing";
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 ${isDark ? "bg-[#090C12] text-slate-100" : "bg-[#F8FAFC] text-[#111317]"}`}>
        <div className={`w-full max-w-lg rounded-[28px] border p-8 space-y-5 shadow-2xl ${isDark ? "bg-[#11161F] border-slate-800" : "bg-white border-[#EAECF0]"}`}>
          <div className="flex items-center justify-between gap-3">
            <span className="px-3 py-1 rounded-full bg-rose-500/15 text-rose-500 text-[11px] font-bold uppercase tracking-wider">
              {isBilling
                ? isSw ? "Malipo Yanahitajika" : "Billing Lock Active"
                : isSw ? "Kizuizi Kutoka HQ" : "HQ Manual Override Lock"}
            </span>
            <span className="text-xs font-semibold opacity-75">{account.orgName}</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
            {isBilling
              ? isSw ? "Kamilisha Malipo Kufungua Kituo" : "Plan Payment Required to Unlock Workspace"
              : isSw ? "Kituo Kimezuiwa kwa Muda na Cervos HQ" : "Workspace Access Paused by Cervos HQ"}
          </h1>
          <p className={`text-sm leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}>
            {account.accessLock.reason}
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {isBilling && canManageAdmin && (
              <Link
                href="/app/billing"
                className="px-6 py-3 rounded-full text-white text-xs font-semibold min-h-[44px] inline-flex items-center"
                style={{ backgroundColor: brandAccent }}
              >
                {isSw ? "Fungua Ukurasa wa Malipo ->" : "Pay & Unlock Now ->"}
              </Link>
            )}
            <button
              type="button"
              onClick={lockProfile}
              className={`px-4 py-2.5 rounded-full border text-xs font-semibold cursor-pointer ${isDark ? "border-slate-700 text-slate-200" : "border-slate-200 text-slate-800"}`}
            >
              {isSw ? "Badili Wasifu" : "Switch Profile"}
            </button>
            <button
              type="button"
              onClick={signOutOrg}
              className={`px-4 py-2.5 rounded-full border border-rose-400/40 text-rose-500 text-xs font-semibold cursor-pointer`}
            >
              {isSw ? "Toka Nje" : "Sign Out"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <WorkspaceShell
      orgName={account.orgName}
      centreName={isGeneralOrgHub ? (isSw ? "Matawi Yote" : "All Branches") : activeCentre?.name || account.region}
      profileName={activeProfile.displayName}
      profileRole={role}
      showBranchChat={!isGeneralOrgHub}
      brandLogoUrl={account.customization?.brandLogoUrl}
      brandAccent={brandAccent}
      fontScale={activeProfile.profilePrefs?.fontScale || account.customization?.fontScale}
      lang={account.lang}
      onToggleLang={toggleLang}
      theme={theme}
      onToggleTheme={toggleTheme}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      navItems={navItems}
      notifications={data.notifications ?? []}
      onMarkNotificationsRead={handleMarkNotificationsRead}
      onLockProfile={lockProfile}
      onSignOut={signOutOrg}
    >
      <PwaLaunchSplash
        lang={account.lang}
        isDark={isDark}
        forceShow={previewSplash}
        onDismiss={() => setPreviewSplash(false)}
      />

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Post-Login In-App Install Prompt (PWA or In-App Device Downloads) */}
        {showInstallOffer && !isInstalled && (
          <div
            className={`rounded-lg border p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 animate-stage-pop ${
              isDark
                ? "bg-[#11161F]/95 border-slate-700 text-slate-100"
                : "bg-white border-[#E2E8F0] text-[#0F172A] shadow-sm"
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className="w-9 h-9 rounded-md text-white flex items-center justify-center shrink-0"
                style={{ backgroundColor: brandAccent }}
              >
                <IconDownload className="w-4 h-4" />
              </span>
              <div>
                <div className="text-xs sm:text-sm font-bold">
                  {isSw
                    ? "Pakua Cervos kwa Kasi & Kazi Bila Mtandao"
                    : "Want the full offline app experience?"}
                </div>
                <p className={`text-xs mt-0.5 ${mutedText}`}>
                  {installNotice ||
                    (isSw
                      ? "Weka app nyepesi hapa hapa kwenye kivinjari (PWA) au pakua toleo la kompyuta yako."
                      : "Install right here as a fast, lightweight browser PWA or pick your device installer inside the app.")}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                disabled={installing}
                onClick={handleQuickPwaInstall}
                className="px-4 py-2 rounded-md text-white text-xs font-semibold cursor-pointer"
                style={{ backgroundColor: brandAccent }}
              >
                {canPromptNative
                  ? isSw
                    ? "Sakinisha PWA Papo Hapo"
                    : "Install Browser App (PWA)"
                  : isSw
                    ? "Weka PWA"
                    : "Instant PWA Guide"}
              </button>
              <Link
                href="/app/download"
                className={`px-4 py-2 rounded-md border text-xs font-semibold ${
                  isDark
                    ? "border-slate-700 hover:bg-slate-800 text-slate-100"
                    : "border-[#E2E8F0] hover:bg-slate-50 text-[#0F172A]"
                }`}
              >
                {isSw ? "Chagua Kifaa" : "Device Downloads"} &rarr;
              </Link>
              <button
                type="button"
                onClick={dismissInstallOffer}
                className={`px-2.5 py-2 text-xs font-semibold cursor-pointer ${mutedText} hover:underline`}
              >
                {isSw ? "Baadaye" : "Not now"}
              </button>
            </div>
          </div>
        )}

        {/* Role-Tailored Workspace Sweep #1: Pharmacy & Standard Dashboard (std.jpg + @cervos/core Schema) */}
        {isPharmacyWorkspace ? (
          <PharmacyDashboard
            account={account}
            activeCentre={activeCentre}
            centres={centres}
            profiles={profiles}
            filteredLogs={filteredLogs}
            batches={data.batches ?? []}
            sales={data.sales ?? []}
            wholesaleOrders={data.wholesaleOrders ?? []}
            supplierCatalog={data.supplierCatalog ?? []}
            expenses={data.expenses ?? []}
            paymentSettings={data.paymentSettings ?? null}
            joinRequests={data.joinRequests ?? []}
            hqUpdates={data.hqUpdates ?? []}
            hqMessages={data.hqMessages ?? []}
            savedCustomers={data.savedCustomers ?? []}
            shiftLogs={data.shiftLogs ?? []}
            notificationEnv={data.notificationEnv}
            stockAlerts={data.stockAlerts ?? { nearExpiryCount: 0, expiredCount: 0, lowStockCount: 0 }}
            tab={tab}
            setTab={setTab}
            orgScope={orgScope}
            onSetOrgScope={handleSetOrgScope}
            activeProfileId={activeProfile.id}
            activeProfileName={activeProfile.displayName}
            activeProfileRole={role}
            resolvedCapabilities={resolvedCaps}
            isDark={isDark}
            canManageAdmin={canManageAdmin}
            canManageStock={canManageStock}
            searchQuery={searchQuery}
            onRefreshState={fetchState}
            onPaySubscription={paySubscription}
            onOpenChat={requestOpenBranchChat}
            onSwitchCentre={switchCentre}
          />
        ) : (
          <div className="space-y-5 animate-stage-pop">
            <div className={`rounded-[28px] border p-7 sm:p-9 space-y-5 ${cardSurface}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span
                  className="px-3 py-1 rounded-full bg-blue-500/10 text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: brandAccent }}
                >
                  {account.roleType.toUpperCase()} &middot; {isSw ? "INAKUJA HIVI KARIBUNI" : "COMING SOON"}
                </span>
                <span className={`text-xs font-medium ${mutedText}`}>
                  {account.orgName} &middot; {activeCentre?.region || account.region}
                </span>
              </div>

              <div className="space-y-2 max-w-2xl">
                <h1
                  className="text-2xl sm:text-3xl font-normal tracking-tight"
                  style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                >
                  {isSw
                    ? `Habari ${activeProfile.displayName}! Kituo cha ${account.roleType === "supplier" ? "Msambazaji" : account.roleType} Kinakuja Hivi Karibuni`
                    : `Hi there, ${activeProfile.displayName}! The ${account.roleType.charAt(0).toUpperCase() + account.roleType.slice(1)} Workspace Is Coming Soon`}
                </h1>
                <p className={`text-sm leading-relaxed ${mutedText}`}>
                  {isSw
                    ? "Tunakamilisha vipengele kamili vya jukumu hili ili viwe tayari na ubora wa juu. Akaunti yako na vituo vyako vimehifadhiwa salama."
                    : "We are actively finishing the dedicated workflow for this account role so everything ships with zero compromises. Your organization identity, team seats, and trial billing are safely saved."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    setReceiptMsg(
                      isSw
                        ? "Tumekuweka kwenye orodha ya taarifa pindi kituo hiki kitakapofunguka!"
                        : "You are on the priority launch list. We will notify you as soon as this role module goes live."
                    )
                  }
                  className="px-5 py-2.5 rounded-full text-white text-xs font-semibold cursor-pointer min-h-[44px]"
                  style={{ backgroundColor: brandAccent }}
                >
                  {isSw ? "Nijulishe Ikifunguka" : "Notify Me When Ready"} &rarr;
                </button>
                <Link
                  href="/app/settings?tab=user"
                  className={`px-4 py-2.5 rounded-full border text-xs font-semibold min-h-[44px] inline-flex items-center ${
                    isDark ? "border-slate-700 hover:bg-white/5" : "border-[#E2E8F0] hover:bg-slate-50"
                  }`}
                >
                  {isSw ? "Mipangilio Yangu" : "My Settings"}
                </Link>
                <button
                  type="button"
                  onClick={signOutOrg}
                  className="px-4 py-2.5 rounded-full border border-rose-400/40 text-rose-500 text-xs font-semibold cursor-pointer min-h-[44px]"
                >
                  {isSw ? "Toka Nje" : "Sign Out"}
                </button>
              </div>

              {receiptMsg && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-xs font-semibold text-emerald-500 flex items-center gap-2">
                  <IconCheck className="w-4 h-4 shrink-0" />
                  <span>{receiptMsg}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              <div className={`lg:col-span-7 rounded-[24px] border p-5 space-y-3 ${cardSurface}`}>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">
                    {isSw ? "Ramani ya Mtandao Tanzania" : "Live East Africa Pharmacy Coverage Map"}
                  </h2>
                  <span className="text-[11px] font-semibold text-emerald-500">Live Tiles</span>
                </div>
                <div className="rounded-2xl overflow-hidden border border-slate-500/20 h-64">
                  <CervosMap
                    center={[activeCentre?.lat ?? -6.369, activeCentre?.lng ?? 36.2]}
                    zoom={6}
                    defaultStyle={isDark ? "dark" : "light"}
                    enableRegionJump
                    markers={[
                      {
                        id: activeCentre?.id || "ctr-main",
                        lat: activeCentre?.lat ?? -6.816,
                        lng: activeCentre?.lng ?? 39.2803,
                        label: account.orgName,
                        region: activeCentre?.region || account.region,
                        kind: account.roleType === "supplier" ? "supplier" : "branch",
                        status: "online",
                        detail: `${account.roleType} rollout preview`,
                      },
                    ]}
                    className="h-64 w-full"
                  />
                </div>
              </div>

              <div className={`lg:col-span-5 rounded-[24px] border p-5 space-y-3 ${cardSurface}`}>
                <h2 className="text-sm font-semibold">
                  {isSw ? "Taarifa za Jukwaa la Cervos" : "Platform Updates & Roadmap"}
                </h2>
                <div className="space-y-2.5 text-xs">
                  {(data.hqUpdates ?? []).slice(0, 3).map((u) => (
                    <div key={u.id} className={`p-3.5 rounded-2xl border ${isDark ? "border-slate-800 bg-slate-900/50" : "border-[#E2E8F0] bg-[#F8FAFC]"}`}>
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-[9px] font-bold" style={{ color: brandAccent }}>
                        {u.tag}
                      </span>
                      <div className="font-bold mt-1">{isSw ? u.swTitle : u.title}</div>
                      <p className={`text-[11px] mt-0.5 ${mutedText}`}>{isSw ? u.swSummary : u.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
