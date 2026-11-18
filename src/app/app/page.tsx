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
import { playAppSound } from "@/lib/sounds";
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
import { triggerBackgroundDownload } from "@/lib/workspace/download";
import { matchesSearch } from "@/lib/search";
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
    subscriptionExpiresAt?: string;
    subscriptionDaysLeft?: number | null;
    subscriptionInGraceDay?: boolean;
    billingOverdue?: boolean;
    trialEndsAt?: string;
    accessLock?: { locked: boolean; source: "hq" | "billing" | null; reason: string };
    customCategories?: string[];
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
  orgBranchComparison?: Array<{
    centreId: string;
    name: string;
    revenue: number;
    profit: number;
    tx: number;
    marginPct: number;
    stockAtCost: number;
    turnover: number;
  }>;
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
  const { canPromptNative, isInstalled, installing, deviceKind, triggerInstall } = usePwaInstall();

  const [data, setData] = useState<AppWorkspaceData | null>(null);
  const [tab, setTab] = useState<AppTab>(() => {
    if (typeof window === "undefined") return "overview";
    const qt = new URLSearchParams(window.location.search).get("tab");
    if (
      qt === "overview" ||
      qt === "operations" ||
      qt === "receipts" ||
      qt === "inventory" ||
      qt === "network" ||
      qt === "reports" ||
      qt === "billing" ||
      qt === "team"
    ) {
      return qt;
    }
    return "overview";
  });
  const [orgScope, setOrgScope] = useState<"all" | "branch">("branch");
  const [sessionLockedOut, setSessionLockedOut] = useState(false);
  const userChoseScopeRef = useRef(false);
  const [contextSwitchToast, setContextSwitchToast] = useState<{
    label: string;
    scope: "all" | "branch";
    key: number;
  } | null>(null);
  const [paymentCelebration, setPaymentCelebration] = useState<{
    status: "completed" | "failed";
    planName: string;
    reference?: string;
    message: string;
  } | null>(null);
  const [dismissedExpiryStrip, setDismissedExpiryStrip] = useState(false);

  const showSwitchToast = (label: string, scope: "all" | "branch") => {
    const key = Date.now();
    setContextSwitchToast({ label, scope, key });
    window.setTimeout(() => {
      setContextSwitchToast((cur) => (cur?.key === key ? null : cur));
    }, 3200);
  };

  const handleSetOrgScope = (nextScope: "all" | "branch") => {
    userChoseScopeRef.current = true;
    setOrgScope(nextScope);
    if (nextScope === "all" && (tab === "operations" || tab === "inventory" || tab === "receipts")) {
      setTab("overview");
    }
    const targetName =
      nextScope === "all"
        ? data?.account?.lang === "SW"
          ? "Matawi Yote"
          : "All Branches"
        : data?.centres?.find((c) => c.id === data.activeCentreId)?.name ||
        data?.centres?.[0]?.name ||
        "Branch";
    showSwitchToast(targetName, nextScope);
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [showInstallOffer, setShowInstallOffer] = useState(false);
  const [installNotice, setInstallNotice] = useState<string | null>(null);
  const [previewSplash, setPreviewSplash] = useState(false);

  // Quick Counter POS / Action Demo State
  const [cartTotal, setCartTotal] = useState(14500);
  const [cartItems, setCartItems] = useState(1);
  const [receiptMsg, setReceiptMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const fetchState = async () => {
    setSyncing(true);
    try {
      const r = await fetch("/api/workspace/state", { cache: "no-store" });
      if (r.status === 401) {
        setSessionLockedOut(true);
        setData(null);
        router.replace("/auth?mode=signin");
        return;
      }
      const res = (await r.json()) as AppWorkspaceData & {
        loungeOnly?: boolean;
        paymentResolution?: {
          status: "completed" | "failed";
          reference: string;
          planName: string;
          amountTzs: number;
          message: string;
        } | null;
      };
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
      if (res.paymentResolution) {
        try {
          window.localStorage.removeItem("cervos_pending_payment");
        } catch {
          /* ignore */
        }
        setPaymentCelebration({
          status: res.paymentResolution.status,
          planName: res.paymentResolution.planName,
          reference: res.paymentResolution.reference,
          message: res.paymentResolution.message,
        });
      }
      setI18nLang(res.account.lang);
      setData(res);
      setLastSyncedAt(new Date().toISOString());
    } finally {
      setSyncing(false);
    }
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

      // PWA standalone & Native Desktop require PIN pad entry on every fresh app launch after exit
      const win = window as unknown as {
        __TAURI__?: unknown;
        __TAURI_INTERNALS__?: unknown;
        navigator: Navigator & { standalone?: boolean };
      };
      const isPwaOrDesktop =
        window.matchMedia?.("(display-mode: standalone)").matches ||
        win.navigator?.standalone === true ||
        Boolean(win.__TAURI__ || win.__TAURI_INTERNALS__) ||
        /electron|tauri|cervos/i.test(window.navigator.userAgent || "");

      if (isPwaOrDesktop && window.sessionStorage.getItem("cervos-station-active") !== "1") {
        void fetch("/api/workspace/gate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "lock_profile" }),
        }).finally(() => {
          router.replace("/app/gate?stage=profile");
        });
        return;
      }
    } catch {
      // Ignore URL / storage parse error
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
      const snoozeUntilRaw = window.localStorage.getItem("cervos-install-offer-snoozed-until");
      const snoozeUntil = snoozeUntilRaw ? Number(snoozeUntilRaw) : 0;
      const notSnoozed = !Number.isFinite(snoozeUntil) || Date.now() > snoozeUntil;
      if (justSignedIn && notSnoozed) {
        setShowInstallOffer(true);
      }
    } catch {
      // Ignore storage block
    }
    const syncInterval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchState();
      }
    }, 25000);
    const onOnline = () => void fetchState();
    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchState();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
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
        if (sp.get("scope") === "all") {
          setOrgScope("all");
        } else {
          setOrgScope("branch");
        }
      } catch {
        setOrgScope("branch");
      }
      userChoseScopeRef.current = true;
    }
  }, [data?.activeProfile, data?.account]);

  const dismissInstallOffer = () => {
    setShowInstallOffer(false);
    try {
      // Show infrequently (remember dismissal for 14 days instead of nagging every login)
      window.localStorage.setItem(
        "cervos-install-offer-snoozed-until",
        String(Date.now() + 14 * 24 * 60 * 60 * 1000)
      );
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
    router.replace("/auth?mode=signin&switch_org=1");
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
      const matchedName =
        data?.centres?.find((c) => c.id === centreId)?.name ||
        (data?.account?.lang === "SW" ? "Tawi Limebadilishwa" : "Switched Branch");
      playAppSound("switch");
      showSwitchToast(matchedName, "branch");
      await fetchState();
      window.dispatchEvent(new Event(WORKSPACE_REFRESH_EVENT));
    }
  };

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let attempts = 0;
    const pollBackgroundPayment = async () => {
      let raw: string | null = null;
      try {
        raw = window.localStorage.getItem("cervos_pending_payment");
      } catch {
        return;
      }
      if (!raw) return;
      let saved: { reference?: string; planName?: string; startedAt?: string } | null = null;
      try {
        saved = JSON.parse(raw);
      } catch {
        return;
      }
      if (!saved?.reference) return;
      const ageMs = saved.startedAt ? Date.now() - Date.parse(saved.startedAt) : 0;
      if (ageMs > 20 * 60 * 1000 || attempts >= 15) {
        try {
          window.localStorage.removeItem("cervos_pending_payment");
        } catch {
          /* ignore */
        }
        if (timer) clearInterval(timer);
        return;
      }
      attempts += 1;
      try {
        const res = await fetch("/api/workspace/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "check_subscription_payment", reference: saved.reference }),
        });
        const out = await res.json();
        if (out.status === "completed") {
          window.localStorage.removeItem("cervos_pending_payment");
          if (timer) clearInterval(timer);
          setPaymentCelebration({
            status: "completed",
            planName: out.planName || saved.planName || "Cervos Plan",
            reference: out.receiptNumber || saved.reference,
            message: `${out.planName || saved.planName || "Plan"} payment cleared and unlocked!`,
          });
          void fetchState();
        } else if (out.status === "failed" || res.status === 402) {
          window.localStorage.removeItem("cervos_pending_payment");
          if (timer) clearInterval(timer);
          setPaymentCelebration({
            status: "failed",
            planName: saved.planName || "Cervos Plan",
            reference: saved.reference,
            message: out.error || "Mobile money payment failed or was declined.",
          });
        }
      } catch {
        /* retry quietly within bounded background limit */
      }
    };
    void pollBackgroundPayment();
    timer = setInterval(() => void pollBackgroundPayment(), 6000);
    return () => {
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const list = data?.auditLogs ?? [];
    if (!searchQuery.trim()) return list;
    return list.filter((log) =>
      matchesSearch(searchQuery, log.action, log.actor, log.category, log.createdAt)
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
              label: isSw ? "Stoo ya Dawa" : "Inventory",
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
      showBranchChat={true}
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
      syncing={syncing}
      lastSyncedAt={lastSyncedAt}
      onSyncNow={() => {
        void fetchState();
        window.dispatchEvent(new Event(WORKSPACE_REFRESH_EVENT));
      }}
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
        {/* Animated Branch Switch Confirmation Popup (visible across Reports & all tabs) */}
        {contextSwitchToast && (
          <div
            key={contextSwitchToast.key}
            role="status"
            aria-live="polite"
            className="fixed top-[68px] left-1/2 -translate-x-1/2 z-[70] pointer-events-none px-4"
          >
            <div
              className="pointer-events-auto inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full shadow-lg border text-xs font-semibold animate-stage-pop backdrop-blur-md"
              style={{
                backgroundColor: isDark ? "rgba(17, 22, 31, 0.96)" : "rgba(255, 255, 255, 0.96)",
                borderColor: brandAccent,
                color: isDark ? "#F8FAFC" : "#0F172A",
              }}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>
                {isSw ? "Mtazamo umehamishiwa:" : "Viewing:"}{" "}
                <strong style={{ color: isDark ? "#38BDF8" : brandAccent }}>{contextSwitchToast.label}</strong>
              </span>
            </div>
          </div>
        )}

        {/* Background Payment Celebration / Retry Banner */}
        {paymentCelebration && (
          <div
            className={`rounded-[22px] border p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 animate-stage-pop ${paymentCelebration.status === "completed"
              ? "bg-emerald-500/12 border-emerald-500/40"
              : "bg-rose-500/10 border-rose-500/40"
              }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white ${paymentCelebration.status === "completed" ? "bg-emerald-500" : "bg-rose-500"
                  }`}
              >
                {paymentCelebration.status === "completed" ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </span>
              <div>
                <div className={`text-xs sm:text-sm font-bold ${paymentCelebration.status === "completed" ? "text-emerald-600 dark:text-emerald-300" : "text-rose-500"}`}>
                  {paymentCelebration.status === "completed"
                    ? isSw
                      ? `Hongera! ${paymentCelebration.planName} Imewashwa`
                      : `Celebration! ${paymentCelebration.planName} Is Now Active`
                    : isSw
                      ? "Malipo Hayakukamilika"
                      : "Subscription Payment Did Not Clear"}
                </div>
                <p className={`text-xs mt-0.5 ${mutedText}`}>
                  {paymentCelebration.message}
                  {paymentCelebration.reference ? ` (Ref ${paymentCelebration.reference})` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {paymentCelebration.status === "failed" && (
                <Link
                  href="/app/billing"
                  className="px-4 py-2 rounded-full text-white text-xs font-semibold"
                  style={{ backgroundColor: brandAccent }}
                >
                  {isSw ? "Jaribu Tena" : "Retry Payment ->"}
                </Link>
              )}
              <button
                type="button"
                onClick={() => setPaymentCelebration(null)}
                className={`px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer ${isDark ? "border-slate-700 text-slate-300" : "border-slate-300 text-slate-600"
                  }`}
              >
                {isSw ? "Funga" : "Dismiss"}
              </button>
            </div>
          </div>
        )}

        {/* Personalized Approaching-Expiry Reminder Strip (<= 7 days or grace day) */}
        {!dismissedExpiryStrip &&
          typeof account.subscriptionDaysLeft === "number" &&
          account.subscriptionDaysLeft <= 7 &&
          !account.accessLock?.locked && (
            <div className={`rounded-[20px] border px-4 py-3 flex flex-wrap items-center justify-between gap-3 animate-stage-pop ${account.subscriptionInGraceDay
              ? "bg-rose-500/10 border-rose-500/35"
              : "bg-amber-500/10 border-amber-500/35"
              }`}>
              <div className="text-xs">
                <strong className={account.subscriptionInGraceDay ? "text-rose-500" : "text-amber-600 dark:text-amber-300"}>
                  {(() => {
                    const firstName = (account.fullName || account.orgName).trim().split(/\s+/)[0];
                    if (account.subscriptionInGraceDay) {
                      return isSw
                        ? `${firstName}, leo ni siku ya mwisho ya ${account.subscriptionPlan} kabla ya kusitishwa kesho.`
                        : `Hi ${firstName}, your ${account.subscriptionPlan} plan expired today - renew tonight so ${account.orgName} counters stay active tomorrow.`;
                    }
                    return isSw
                      ? `${firstName}, zimebaki siku ${account.subscriptionDaysLeft} kwenye ${account.subscriptionPlan} kwa ${account.orgName}.`
                      : `Hi ${firstName}, ${account.subscriptionDaysLeft} day${account.subscriptionDaysLeft === 1 ? "" : "s"} left on your ${account.subscriptionPlan} plan for ${account.orgName}.`;
                  })()}
                </strong>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href="/app/billing"
                  className="px-3.5 py-1.5 rounded-full text-white text-[11px] font-semibold"
                  style={{ backgroundColor: brandAccent }}
                >
                  {isSw ? "Lipia / Boresha ->" : "Renew / Upgrade ->"}
                </Link>
                <button
                  type="button"
                  onClick={() => setDismissedExpiryStrip(true)}
                  className={`text-[11px] font-semibold px-2 py-1 cursor-pointer ${mutedText}`}
                >
                  &times;
                </button>
              </div>
            </div>
          )}

        {/* Post-Login Infrequent Install & Cross-Device Convenience Tip */}
        {showInstallOffer && (!isInstalled || installNotice) && (
          <div
            className={`rounded-lg border p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 animate-stage-pop ${isDark
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
                    (deviceKind === "desktop"
                      ? isSw
                        ? "Weka app hapa kwenye kompyuta (PWA) au pakua toleo la Android kwa ukaguzi wa stoo."
                        : "Install as a desktop app right here, or grab the Android app for mobile barcode stock counts."
                      : isSw
                        ? "Weka app hapa simuni (PWA) au pakua kisakinishi cha Windows kwa kaunta."
                        : "Install on this phone for quick counter access, or grab the Windows installer for your desktop station.")}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                disabled={installing}
                onClick={handleQuickPwaInstall}
                className="px-4 py-2 rounded-md text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                style={{ backgroundColor: brandAccent }}
              >
                {installing && (
                  <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                )}
                <span>
                  {canPromptNative
                    ? isSw
                      ? "Sakinisha PWA Papo Hapo"
                      : "Install Browser App (PWA)"
                    : isSw
                      ? "Weka PWA"
                      : "Instant PWA Guide"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetUrl =
                    deviceKind === "desktop"
                      ? "https://github.com/Cervos-Pharma/cervos/releases/download/installers/Cervos-Pharma.apk"
                      : "https://github.com/Cervos-Pharma/cervos/releases/download/installers/Cervos-POS-Setup.exe";
                  const fname = triggerBackgroundDownload(targetUrl);
                  setInstallNotice(
                    isSw
                      ? `Inapakua ${fname} chinichini bila kuondoka hapa.`
                      : `Downloading ${fname} for your other device in the background.`
                  );
                }}
                className={`px-3.5 py-2 rounded-md border text-xs font-semibold cursor-pointer ${isDark
                  ? "border-slate-700 hover:bg-slate-800 text-slate-100"
                  : "border-[#E2E8F0] hover:bg-slate-50 text-[#0F172A]"
                  }`}
              >
                {deviceKind === "desktop"
                  ? isSw ? "Pakua Android APK" : "Get Android App"
                  : isSw ? "Pakua Windows (.exe)" : "Get Windows POS"}
              </button>
              <Link
                href="/app/download"
                className={`px-3 py-2 text-xs font-semibold hover:underline ${mutedText}`}
              >
                {isSw ? "Vifaa Vyote" : "All Platforms"} &rarr;
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
        {showInstallOffer && isInstalled && !installNotice && (
          <div
            className={`rounded-lg border px-4 py-3 flex flex-wrap items-center justify-between gap-3 animate-stage-pop ${isDark
              ? "bg-[#11161F]/90 border-slate-800 text-slate-200"
              : "bg-white border-[#E2E8F0] text-[#0F172A]"
              }`}
          >
            <div className="text-xs">
              <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 font-bold text-[10px] mr-2">
                {isSw ? "IMEWEKWA HAPA" : "INSTALLED"}
              </span>
              {deviceKind === "desktop"
                ? isSw
                  ? "Kituo cha kompyuta kiko tayari. Unataka app ya Android kwa ukaguzi wa simu?"
                  : "App installed here. Want the Android app for mobile barcode stock counts?"
                : isSw
                  ? "App iko tayari simuni. Unataka kisakinishi cha Windows kwa kaunta?"
                  : "App installed here. Want the Windows desktop installer for your counter PC?"}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const targetUrl =
                    deviceKind === "desktop"
                      ? "https://github.com/Cervos-Pharma/cervos/releases/download/installers/Cervos-Pharma.apk"
                      : "https://github.com/Cervos-Pharma/cervos/releases/download/installers/Cervos-POS-Setup.exe";
                  const fname = triggerBackgroundDownload(targetUrl);
                  setInstallNotice(`Downloading ${fname} in the background.`);
                }}
                className="px-3 py-1.5 rounded-md text-white text-[11px] font-semibold cursor-pointer"
                style={{ backgroundColor: brandAccent }}
              >
                {deviceKind === "desktop" ? "Get Android APK" : "Get Windows POS"}
              </button>
              <button
                type="button"
                onClick={dismissInstallOffer}
                className={`px-2 py-1 text-xs cursor-pointer ${mutedText}`}
              >
                &times;
              </button>
            </div>
          </div>
        )}

        {/* Global Quick-Jump Search Bar Panel (active whenever user searches in header) */}
        {searchQuery.trim().length > 0 && (() => {
          const matchedCentres = centres.filter((c) =>
            matchesSearch(searchQuery, c.name, c.region, c.address)
          );
          const matchedBatches = (data.batches ?? [])
            .filter((b) =>
              matchesSearch(searchQuery, b.brandName, b.genericName, b.batchNumber, b.category)
            )
            .slice(0, 5);
          const matchedSales = (data.sales ?? [])
            .filter((s) =>
              matchesSearch(
                searchQuery,
                s.receiptNumber,
                s.id,
                s.customerName,
                s.actorName,
                s.paymentMethod,
                ...(s.lines ?? []).map((ln) => ln.brandName)
              )
            )
            .slice(0, 4);
          const matchedStaff = profiles
            .filter((p) => matchesSearch(searchQuery, p.displayName, p.username, p.role))
            .slice(0, 4);
          const totalHits =
            matchedCentres.length + matchedBatches.length + matchedSales.length + matchedStaff.length;
          return (
            <div className={`rounded-[22px] border p-4 space-y-3 animate-stage-pop ${cardSurface}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold">
                  {isSw
                    ? `Matokeo ya utafutaji "${searchQuery}" (${totalHits})`
                    : `Quick Search Results for "${searchQuery}" (${totalHits})`}
                </div>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className={`text-[11px] font-semibold hover:underline cursor-pointer ${mutedText}`}
                >
                  {isSw ? "Futa utafutaji" : "Clear Search"} &times;
                </button>
              </div>
              {totalHits === 0 ? (
                <div className={`text-xs ${mutedText}`}>
                  {isSw
                    ? "Hakuna tawi, dawa, risiti au mfanyakazi anayelingana."
                    : "No matching branches, batches, receipts, or staff found."}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {matchedCentres.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        void switchCentre(c.id);
                      }}
                      className="px-3 py-1.5 rounded-full border border-[#1039B9]/35 bg-blue-500/10 text-[#1039B9] dark:text-[#38BDF8] text-[11px] font-semibold cursor-pointer"
                    >
                      Branch: {c.name} ({c.region})
                    </button>
                  ))}
                  {matchedBatches.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        userChoseScopeRef.current = true;
                        setOrgScope("branch");
                        setTab("inventory");
                      }}
                      className="px-3 py-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 text-[11px] font-semibold cursor-pointer"
                    >
                      Stock: {b.brandName} ({b.batchNumber}) &middot; {b.quantity} left
                    </button>
                  ))}
                  {matchedSales.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        userChoseScopeRef.current = true;
                        setOrgScope("branch");
                        setTab("receipts");
                      }}
                      className="px-3 py-1.5 rounded-full border border-amber-500/35 bg-amber-500/10 text-amber-600 dark:text-amber-300 text-[11px] font-semibold cursor-pointer"
                    >
                      Receipt: {s.receiptNumber || s.id} &middot; {s.customerName || "Walk-in"}
                    </button>
                  ))}
                  {matchedStaff.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setTab("team")}
                      className={`px-3 py-1.5 rounded-full border text-[11px] font-semibold cursor-pointer ${isDark ? "border-slate-700 bg-slate-800/70 text-slate-200" : "border-slate-200 bg-slate-100 text-slate-700"
                        }`}
                    >
                      Staff: {p.displayName} ({p.role.replace(/_/g, " ")})
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

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
            orgBranchComparison={data.orgBranchComparison ?? []}
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
                  className={`px-4 py-2.5 rounded-full border text-xs font-semibold min-h-[44px] inline-flex items-center ${isDark ? "border-slate-700 hover:bg-white/5" : "border-[#E2E8F0] hover:bg-slate-50"
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
