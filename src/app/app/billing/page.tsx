"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { COMMERCIAL_PLAN_CATALOG, formatTzs } from "@cervos/core";
import WorkspaceShell, { type WorkspaceNavItem } from "@/components/WorkspaceShell";
import { useWorkspaceTheme } from "@/lib/workspace/theme";

const MAX_FOREGROUND_POLLS = 12;
const POLL_INTERVAL_MS = 4000;
const PENDING_PAYMENT_STORAGE_KEY = "cervos_pending_payment";

interface BillingAccountSummary {
  id: string;
  orgName: string;
  fullName?: string;
  roleType: string;
  lang: "EN" | "SW";
  subscriptionActive: boolean;
  subscriptionPlan: string;
  subscriptionActivatedAt?: string;
  subscriptionExpiresAt?: string;
  billingCycle?: "monthly" | "annual";
  subscriptionDaysLeft?: number | null;
  subscriptionInGraceDay?: boolean;
  billingOverdue?: boolean;
  trialEndsAt?: string;
  accessLock?: { locked: boolean; source: "hq" | "billing" | null; reason: string };
  customization?: {
    brandLogoUrl?: string;
    brandAccent?: string;
    fontScale?: "compact" | "standard" | "large";
  };
}

interface BillingPackageItem {
  id: string;
  audience: string;
  name: string;
  priceMonthlyTzs: number;
  priceAnnualTzs?: number;
  pricePerBranchMonthlyTzs?: number;
  includedAdminsPerBranch?: number;
  includedOperatorsPerBranch?: number;
  maxBranches: number | null;
  maxOperators: number | null;
}

type BillingChannel =
  | "M-Pesa (Vodacom)"
  | "Mixx by Yas (Tigo)"
  | "Airtel Money"
  | "Halopesa"
  | "CRDB / NMB Bank"
  | "Visa / Mastercard";

export default function DedicatedBillingPage() {
  const router = useRouter();
  const { theme, isDark, toggleTheme } = useWorkspaceTheme();
  const [account, setAccount] = useState<BillingAccountSummary | null>(null);
  const [branchCount, setBranchCount] = useState(1);
  const [centreName, setCentreName] = useState("Primary Branch");
  const [shellProfile, setShellProfile] = useState<{
    id: string;
    displayName: string;
    role: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [livePlans, setLivePlans] = useState<BillingPackageItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedPlan, setSelectedPlan] = useState<string>("Community Standard");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [channel, setChannel] = useState<BillingChannel>("M-Pesa (Vodacom)");
  const [payerRef, setPayerRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [pollAttempts, setPollAttempts] = useState(0);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const [bouncedMsg, setBouncedMsg] = useState<string | null>(null);
  const [pendingUssd, setPendingUssd] = useState<{
    reference: string;
    msisdn: string;
    amountTzs: number;
    baseAmountTzs?: number;
    upgradeCreditTzs?: number;
    isUpgrade?: boolean;
    message: string;
  } | null>(null);
  const [receiptCode, setReceiptCode] = useState<string | null>(null);
  const [confirmedCreditTzs, setConfirmedCreditTzs] = useState(0);
  const [confirmedAmountTzs, setConfirmedAmountTzs] = useState<number | null>(null);
  const [confirmedUpgrade, setConfirmedUpgrade] = useState(false);

  const checkInFlightRef = useRef(false);

  const loadBilling = async () => {
    setLoading(true);
    const [r, pkgRes] = await Promise.all([
      fetch("/api/workspace/state", { cache: "no-store" }),
      fetch("/api/workspace/packages", { cache: "no-store" }).catch(() => null),
    ]);
    let loadedPkgs: BillingPackageItem[] | null = null;
    if (pkgRes && pkgRes.ok) {
      const pkgData = (await pkgRes.json()) as { packages?: BillingPackageItem[] };
      if (Array.isArray(pkgData.packages) && pkgData.packages.length > 0) {
        loadedPkgs = pkgData.packages;
        setLivePlans(pkgData.packages);
      }
    }
    if (r.status === 401) {
      router.replace("/auth?mode=signin");
      return;
    }
    const data = await r.json();
    if (Array.isArray(data.centres)) {
      setBranchCount(Math.max(1, data.centres.length));
      const activeCtr =
        data.centres.find((c: { id: string; name: string }) => c.id === data.activeCentreId) ??
        data.centres[0];
      if (activeCtr?.name) setCentreName(activeCtr.name);
    }
    if (data.activeProfile) {
      setShellProfile(data.activeProfile);
    }
    if (data.account) {
      setAccount(data.account);
      let preselectPlan: string | null = null;
      try {
        const sp = new URLSearchParams(window.location.search);
        const qp = sp.get("plan");
        if (qp) preselectPlan = qp;
      } catch {
        /* ignore URL error */
      }
      if (preselectPlan) {
        setSelectedPlan(preselectPlan);
        const list = loadedPkgs ?? [];
        const match = list.find(
          (p) => p.name.toLowerCase() === preselectPlan?.toLowerCase() || p.id === preselectPlan
        );
        if (match) setSelectedPlan(match.name);
      } else {
        setSelectedPlan(data.account.subscriptionPlan || "Community Standard");
      }
      if (data.account.billingCycle === "annual") {
        setBillingCycle("annual");
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadBilling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isSw = account?.lang === "SW";
  const accent = "#1039B9";
  const cardCls = isDark ? "bg-[#11161F] border-slate-800 text-slate-100" : "bg-white border-[#EAECF0] text-[#111317]";
  const chipCls = isDark ? "bg-[#171D28] border-slate-800 text-slate-200" : "bg-[#F8FAFC] border-[#EAECF0] text-[#111317]";
  const mutedCls = isDark ? "text-slate-400" : "text-[#64748B]";

  const catalogSource: BillingPackageItem[] = useMemo(
    () =>
      livePlans ??
      COMMERCIAL_PLAN_CATALOG.map((p) => ({
        id: p.id,
        audience: p.audience,
        name: p.name,
        priceMonthlyTzs: p.priceMonthlyTzs,
        priceAnnualTzs: p.priceAnnualTzs,
        pricePerBranchMonthlyTzs: p.priceMonthlyTzs,
        includedAdminsPerBranch: 1,
        includedOperatorsPerBranch: 1,
        maxBranches: p.maxBranches,
        maxOperators: p.maxOperators,
      })),
    [livePlans]
  );

  const plans = useMemo(() => {
    const audienceTarget =
      account?.roleType === "supplier" ? "supplier" : account?.roleType === "hospital" ? "hospital" : "pharmacy";
    const matching = catalogSource.filter((p) => p.audience === audienceTarget);
    if (matching.length > 0) return matching;
    return catalogSource.filter((p) => p.audience === "pharmacy" || p.audience === "supplier");
  }, [catalogSource, account?.roleType]);

  const currentPkg = useMemo(
    () =>
      plans.find(
        (p) =>
          p.name.toLowerCase() === (account?.subscriptionPlan || "").toLowerCase() ||
          p.id.toLowerCase() === (account?.subscriptionPlan || "").toLowerCase()
      ) ?? null,
    [plans, account?.subscriptionPlan]
  );

  const selectedPlanObj = plans.find((p) => p.name === selectedPlan) ?? plans[0];

  const computeQuoteFor = (targetPkg: BillingPackageItem | undefined, cycle: "monthly" | "annual") => {
    const unitMonthly = Math.max(
      5000,
      targetPkg
        ? Math.max(targetPkg.priceMonthlyTzs, (targetPkg.pricePerBranchMonthlyTzs ?? targetPkg.priceMonthlyTzs) * branchCount)
        : 45000
    );
    const baseAmountTzs =
      cycle === "annual"
        ? Math.max(unitMonthly * 10, targetPkg?.priceAnnualTzs || unitMonthly * 10)
        : unitMonthly;

    const isSame = Boolean(
      currentPkg && targetPkg
        ? currentPkg.id === targetPkg.id
        : (account?.subscriptionPlan || "").toLowerCase() === (targetPkg?.name || "").toLowerCase()
    );
    const isSwitch = Boolean(account?.subscriptionActive && !account?.billingOverdue && !isSame);
    const currentMonthly = currentPkg
      ? Math.max(
          5000,
          Math.max(currentPkg.priceMonthlyTzs, (currentPkg.pricePerBranchMonthlyTzs ?? currentPkg.priceMonthlyTzs) * branchCount)
        )
      : 0;
    const isUpgrade = Boolean(isSwitch && unitMonthly > currentMonthly);

    let creditTzs = 0;
    if (isSwitch && currentPkg && currentMonthly > 0) {
      const activeCycle: "monthly" | "annual" =
        account?.billingCycle === "annual" || /year/i.test(account?.subscriptionPlan || "")
          ? "annual"
          : "monthly";
      const activeTotal =
        activeCycle === "annual"
          ? Math.max(currentMonthly * 10, currentPkg.priceAnnualTzs || currentMonthly * 10)
          : currentMonthly;
      const periodDays = activeCycle === "annual" ? 365 : 30;
      let ratio = 0.5;
      if (account?.subscriptionExpiresAt) {
        const expMs = Date.parse(account.subscriptionExpiresAt);
        if (Number.isFinite(expMs)) {
          ratio = Math.min(1, Math.max(0, (expMs - Date.now()) / (periodDays * 86400000)));
        }
      }
      creditTzs = Math.min(Math.round(activeTotal * ratio), Math.max(0, baseAmountTzs - 5000));
    }

    const amountDueTzs = Math.max(5000, baseAmountTzs - creditTzs);
    return { baseAmountTzs, creditTzs, amountDueTzs, isUpgrade, isSwitch, isSame };
  };

  const activeQuote = computeQuoteFor(selectedPlanObj, billingCycle);

  const persistBackgroundWaiter = (pending: {
    reference: string;
    planName: string;
    msisdn: string;
    amountTzs: number;
    isUpgrade?: boolean;
  }) => {
    try {
      window.localStorage.setItem(
        PENDING_PAYMENT_STORAGE_KEY,
        JSON.stringify({ ...pending, startedAt: new Date().toISOString() })
      );
    } catch {
      /* ignore quota/privacy blocks */
    }
  };

  const clearBackgroundWaiter = () => {
    try {
      window.localStorage.removeItem(PENDING_PAYMENT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const checkPendingPayment = async (refCode: string, isAutoPoll = false) => {
    if (checkInFlightRef.current) return;
    checkInFlightRef.current = true;
    if (!isAutoPoll) setCheckingStatus(true);
    try {
      const res = await fetch("/api/workspace/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check_subscription_payment", reference: refCode }),
      });
      const out = await res.json();
      if (out.status === "completed") {
        clearBackgroundWaiter();
        setConfirmedAmountTzs(out.amountTzs ?? pendingUssd?.amountTzs ?? null);
        setConfirmedCreditTzs(pendingUssd?.upgradeCreditTzs ?? 0);
        setConfirmedUpgrade(Boolean(out.isUpgrade ?? pendingUssd?.isUpgrade));
        setPendingUssd(null);
        setReceiptCode(out.receiptNumber || refCode);
        if (out.account) setAccount(out.account);
        setStep(3);
      } else if (out.status === "failed" || res.status === 402) {
        clearBackgroundWaiter();
        setPendingUssd(null);
        setBouncedMsg(out.error || "Mobile money payment failed or was declined.");
      } else if (isAutoPoll) {
        setPollAttempts((prev) => {
          const next = prev + 1;
          if (next >= MAX_FOREGROUND_POLLS) {
            setPollTimedOut(true);
          }
          return next;
        });
      }
    } finally {
      checkInFlightRef.current = false;
      if (!isAutoPoll) setCheckingStatus(false);
    }
  };

  useEffect(() => {
    if (!pendingUssd || pollTimedOut) return;
    const timer = setInterval(() => {
      void checkPendingPayment(pendingUssd.reference, true);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingUssd?.reference, pollTimedOut]);

  const submitPayment = async () => {
    if (!account) return;
    setBusy(true);
    setBouncedMsg(null);
    setPollAttempts(0);
    setPollTimedOut(false);
    const res = await fetch("/api/workspace/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "activate_subscription",
        planName: selectedPlan,
        billingCycle,
        paymentChannel: channel,
        payerPhoneOrRef: payerRef,
      }),
    });
    const out = await res.json();
    setBusy(false);
    if (!res.ok) {
      setBouncedMsg(out.error || "Payment could not be initiated.");
      setStep(2);
      return;
    }
    if (out.pending && out.reference) {
      const pendingObj = {
        reference: out.reference,
        msisdn: out.msisdn || payerRef,
        amountTzs: out.amountTzs || activeQuote.amountDueTzs,
        baseAmountTzs: out.baseAmountTzs ?? activeQuote.baseAmountTzs,
        upgradeCreditTzs: out.upgradeCreditTzs ?? activeQuote.creditTzs,
        isUpgrade: Boolean(out.isUpgrade ?? activeQuote.isUpgrade),
        message: out.message || "Enter your PIN on your phone to complete payment.",
      };
      persistBackgroundWaiter({
        reference: pendingObj.reference,
        planName: selectedPlan,
        msisdn: pendingObj.msisdn,
        amountTzs: pendingObj.amountTzs,
        isUpgrade: pendingObj.isUpgrade,
      });
      setPendingUssd(pendingObj);
      return;
    }
    clearBackgroundWaiter();
    setReceiptCode(out.receiptNumber || "SUB-OK");
    setConfirmedAmountTzs(out.amountTzs ?? activeQuote.amountDueTzs);
    setConfirmedCreditTzs(out.upgradeCreditTzs ?? 0);
    setConfirmedUpgrade(Boolean(out.isUpgrade));
    if (out.account) setAccount(out.account);
    setStep(3);
  };

  if (loading || !account) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 ${isDark ? "bg-[#090C12] text-slate-100" : "bg-[#F8FAFC] text-[#111317]"}`}>
        <div className="flex items-center gap-3 text-sm font-semibold">
          <span className="w-5 h-5 rounded-full border-2 border-[#1039B9] border-t-transparent animate-spin" />
          <span>{isSw ? "Inapakia kituo cha malipo..." : "Loading payment center..."}</span>
        </div>
      </div>
    );
  }

  const daysLeft = account.subscriptionDaysLeft;
  const pollProgressPct = Math.min(100, Math.round((pollAttempts / MAX_FOREGROUND_POLLS) * 100));

  const toggleLang = async () => {
    const nextLang = account.lang === "SW" ? "EN" : "SW";
    setAccount({ ...account, lang: nextLang });
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
    router.replace("/app/gate?stage=profile");
  };

  const signOutOrg = async () => {
    await fetch("/api/workspace/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "signout" }),
    });
    router.replace("/auth?mode=signin");
  };

  const billingContent = (
    <div className="max-w-3xl mx-auto space-y-6 py-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>
              CERVOS BILLING &amp; PLAN UPGRADES
            </div>
            <h1 className="text-2xl sm:text-3xl font-normal tracking-tight mt-0.5" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
              {isSw ? `Malipo & Maboresho - ${account.orgName}` : `Plan Billing & Upgrades - ${account.orgName}`}
            </h1>
          </div>
          <Link href="/app" className={`min-h-[44px] inline-flex items-center justify-center px-4 py-2.5 rounded-full border text-xs font-semibold ${chipCls}`}>
            &larr; {isSw ? "Rudi Kituoni" : "Back to Workspace"}
          </Link>
        </div>

        {/* Clear 3-Step Payment Progress Bar + Expiry Window Status */}
        <div className={`rounded-[24px] border p-4 sm:p-5 space-y-4 ${cardCls}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                  account.accessLock?.locked
                    ? "bg-rose-500/15 text-rose-500"
                    : account.subscriptionInGraceDay
                      ? "bg-amber-500/20 text-amber-600 dark:text-amber-300"
                      : account.subscriptionActive
                        ? "bg-emerald-500/15 text-emerald-500"
                        : "bg-amber-500/15 text-amber-600"
                }`}
              >
                {account.accessLock?.locked
                  ? isSw ? "Imefungwa - Malipo Yanahitajika" : "Locked - Renewal Required"
                  : account.subscriptionInGraceDay
                    ? isSw ? "Siku ya Mwisho ya Neema" : "Final Grace Day - Renew Tonight"
                    : account.subscriptionActive
                      ? isSw ? "Mpango Hai" : "Active Paid Plan"
                      : isSw ? "Majaribio ya Siku 15" : "15-Day Trial Active"}
              </span>
              <span className="text-xs font-semibold">{account.subscriptionPlan}</span>
              {typeof daysLeft === "number" && !account.accessLock?.locked && (
                <span className={`text-[11px] px-2.5 py-0.5 rounded-full border ${daysLeft <= 5 ? "border-amber-500/40 text-amber-600 dark:text-amber-300 bg-amber-500/10" : chipCls}`}>
                  {daysLeft === 0
                    ? (isSw ? "Inaisha leo" : "Expires today")
                    : isSw
                      ? `Zimebaki siku ${daysLeft}`
                      : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
                </span>
              )}
            </div>
            <span className={`text-[11px] font-mono ${mutedCls}`}>
              {step === 1 ? "Step 1/3 · Select Plan" : step === 2 ? "Step 2/3 · Pay / Edit Info" : "Step 3/3 · Confirmed"}
            </span>
          </div>

          <div className="flex flex-wrap sm:grid sm:grid-cols-3 gap-2.5 text-xs">
            {[
              { id: 1 as const, label: isSw ? "1. Chagua au Boresha" : "1. Select or Upgrade" },
              { id: 2 as const, label: isSw ? "2. Lipa au Hariri" : "2. Payment Info" },
              { id: 3 as const, label: isSw ? "3. Uthibitisho" : "3. Complete" },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => s.id < 3 && setStep(s.id)}
                className={`flex-1 min-w-[100px] min-h-[44px] py-2.5 px-3 rounded-xl border font-semibold inline-flex items-center justify-center text-center cursor-pointer transition-colors ${
                  step === s.id ? "text-white border-transparent" : chipCls
                }`}
                style={step === s.id ? { backgroundColor: accent } : undefined}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* STEP 1: CHOOSE / UPGRADE PLAN */}
        {step === 1 && (
          <div className={`rounded-[24px] border p-4 sm:p-6 space-y-4 ${cardCls}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">{isSw ? "Chagua au Pandisha Kifurushi" : "Choose or Upgrade Your Plan"}</h2>
                <p className={`text-[11px] ${mutedCls}`}>
                  {branchCount > 1
                    ? `${branchCount} branches detected in ${account.orgName} — active remaining balance is credited automatically on upgrades.`
                    : `Remaining balance on an active plan is credited automatically when upgrading tiers.`}
                </p>
              </div>
              <div className={`inline-flex rounded-full border p-0.5 text-[11px] font-semibold ${chipCls}`}>
                {(["monthly", "annual"] as const).map((cyc) => (
                  <button
                    key={cyc}
                    type="button"
                    onClick={() => setBillingCycle(cyc)}
                    className={`px-3 py-1 rounded-full cursor-pointer ${
                      billingCycle === cyc ? "text-white" : mutedCls
                    }`}
                    style={billingCycle === cyc ? { backgroundColor: accent } : undefined}
                  >
                    {cyc === "monthly" ? (isSw ? "Mwezi" : "Monthly") : (isSw ? "Mwaka (-2mo)" : "Annual (-2mo)")}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {plans.map((p) => {
                const chosen = p.name === selectedPlan;
                const q = computeQuoteFor(p, billingCycle);
                const badgeLabel = q.isSame && account.subscriptionActive
                  ? isSw ? "Mpango wa Sasa" : "Current Plan"
                  : q.isUpgrade
                    ? isSw ? "Pandisha" : "Upgrade"
                    : q.isSwitch
                      ? isSw ? "Badili" : "Switch"
                      : null;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPlan(p.name)}
                    className={`min-h-[64px] p-4 rounded-2xl border text-left space-y-2 cursor-pointer transition-all ${
                      chosen ? "ring-2" : chipCls
                    }`}
                    style={chosen ? { borderColor: accent } : undefined}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-sm">{p.name}</span>
                          {badgeLabel && (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${
                                q.isSame
                                  ? "bg-emerald-500/15 text-emerald-500"
                                  : q.isUpgrade
                                    ? "bg-blue-500/15 text-[#1039B9] dark:text-[#38BDF8]"
                                    : "bg-slate-500/15 text-slate-500"
                              }`}
                            >
                              {badgeLabel}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-extrabold tabular-nums" style={{ color: accent }}>
                          {formatTzs(q.amountDueTzs)}
                        </div>
                        {q.creditTzs > 0 && (
                          <div className="text-[10px] text-emerald-500 font-semibold tabular-nums">
                            -{formatTzs(q.creditTzs)} credit
                          </div>
                        )}
                      </div>
                    </div>
                    <div className={`text-[11px] ${mutedCls}`}>
                      {p.maxBranches ? `Up to ${p.maxBranches} branch(es)` : "Unlimited branches"} &middot;{" "}
                      {p.includedAdminsPerBranch ?? 1} Admin + {p.includedOperatorsPerBranch ?? 1} Operator/branch included
                      {p.maxOperators ? ` · Up to ${p.maxOperators} staff` : " · Unlimited staff"}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className={`text-xs ${mutedCls}`}>
                {activeQuote.isUpgrade
                  ? `${isSw ? "Unapandisha kwenda" : "Upgrading to"} ${selectedPlanObj?.name}: ${formatTzs(activeQuote.amountDueTzs)} due today`
                  : `${selectedPlanObj?.name}: ${formatTzs(activeQuote.amountDueTzs)} / ${billingCycle === "annual" ? "year" : "month"}`}
              </div>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full sm:w-auto min-h-[44px] px-6 py-3 rounded-full text-white text-xs font-semibold cursor-pointer"
                style={{ backgroundColor: accent }}
              >
                {activeQuote.isUpgrade
                  ? isSw ? "Endelea Kupandisha ->" : "Continue to Upgrade Checkout ->"
                  : isSw ? "Endelea Kwenye Malipo ->" : "Continue to Payment ->"}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: PAY / EDIT INFO & BOUNDED USSD LOADER */}
        {step === 2 && (
          <div className={`rounded-[24px] border p-4 sm:p-6 space-y-4 ${cardCls}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">{selectedPlan}</h2>
                  {activeQuote.isUpgrade && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-[#1039B9] dark:text-[#38BDF8]">
                      {isSw ? "Boresha Mpango" : "Plan Upgrade"}
                    </span>
                  )}
                </div>
                <p className={`text-xs ${mutedCls}`}>
                  {formatTzs(activeQuote.amountDueTzs)} {isSw ? "kulipwa leo" : "due today"} &middot;{" "}
                  {billingCycle === "annual" ? (isSw ? "mwaka mzima" : "12 months") : (isSw ? "mwezi mmoja" : "30 days")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className={`inline-flex rounded-full border p-0.5 text-[11px] font-semibold ${chipCls}`}>
                  {(["monthly", "annual"] as const).map((cyc) => (
                    <button
                      key={cyc}
                      type="button"
                      disabled={Boolean(pendingUssd)}
                      onClick={() => setBillingCycle(cyc)}
                      className={`px-3 py-1 rounded-full cursor-pointer disabled:opacity-50 ${
                        billingCycle === cyc ? "text-white" : mutedCls
                      }`}
                      style={billingCycle === cyc ? { backgroundColor: accent } : undefined}
                    >
                      {cyc === "monthly" ? (isSw ? "Mwezi" : "Monthly") : (isSw ? "Mwaka" : "Annual (-2mo)")}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPendingUssd(null);
                    setPollAttempts(0);
                    setPollTimedOut(false);
                    setStep(1);
                  }}
                  className="min-h-[44px] px-2 py-2 inline-flex items-center text-xs font-semibold hover:underline cursor-pointer"
                  style={{ color: accent }}
                >
                  {isSw ? "Badili Mpango" : "Change Plan"}
                </button>
              </div>
            </div>

            {activeQuote.creditTzs > 0 && !pendingUssd && (
              <div className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${chipCls}`}>
                <div className="flex items-center justify-between">
                  <span className={mutedCls}>{selectedPlan} ({billingCycle})</span>
                  <span className="font-semibold tabular-nums">{formatTzs(activeQuote.baseAmountTzs)}</span>
                </div>
                <div className="flex items-center justify-between text-emerald-500">
                  <span>{isSw ? "Salio la mpango wa sasa" : `Remaining ${account.subscriptionPlan} credit`}</span>
                  <span className="font-semibold tabular-nums">-{formatTzs(activeQuote.creditTzs)}</span>
                </div>
                <div className="pt-1.5 border-t border-slate-500/20 flex items-center justify-between font-bold">
                  <span>{isSw ? "Jumla ya Kulipa Leo" : "Net Upgrade Due Today"}</span>
                  <span className="tabular-nums" style={{ color: accent }}>{formatTzs(activeQuote.amountDueTzs)}</span>
                </div>
              </div>
            )}

            {bouncedMsg && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/35 text-xs text-rose-500 space-y-1">
                <div className="font-bold">{isSw ? "Malipo Yamekwama - Hariri Taarifa" : "Payment Did Not Clear - Edit & Retry"}</div>
                <div>{bouncedMsg}</div>
              </div>
            )}

            {pendingUssd ? (
              <div className={`p-5 rounded-2xl border space-y-4 ${isDark ? "border-sky-500/35 bg-sky-500/5" : "border-blue-500/25 bg-blue-50/70"}`}>
                <div className="flex items-center gap-3.5">
                  {!pollTimedOut ? (
                    <span
                      className="w-9 h-9 rounded-full border-[3px] border-[#1039B9]/25 border-t-[#1039B9] animate-spin shrink-0"
                      aria-label="Waiting for payment confirmation"
                    />
                  ) : (
                    <span className="w-9 h-9 rounded-full bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                      </svg>
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#1039B9] dark:text-sky-300">
                        {pollTimedOut
                          ? (isSw ? "Bado Inasubiri Uthibitisho wa Simu" : "Still Waiting for Mobile Money Approval")
                          : (isSw ? "Ingiza PIN ya Simu Kwenye USSD" : "Approve PIN Prompt on Your Phone")}
                      </span>
                      <span className={`text-[11px] font-mono tabular-nums ${mutedCls}`}>
                        {Math.min(pollAttempts, MAX_FOREGROUND_POLLS)}/{MAX_FOREGROUND_POLLS}
                      </span>
                    </div>
                    <p className={`text-xs mt-1 leading-relaxed ${mutedCls}`}>
                      {pendingUssd.message} ({formatTzs(pendingUssd.amountTzs)} to <strong>+{pendingUssd.msisdn}</strong> &middot; Ref <strong className="font-mono">{pendingUssd.reference}</strong>)
                    </p>
                  </div>
                </div>

                {/* Bounded Poll Progress Bar */}
                <div className="space-y-1">
                  <div className="h-1.5 w-full rounded-full bg-slate-500/20 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(8, pollProgressPct)}%`,
                        backgroundColor: pollTimedOut ? "#D97706" : accent,
                      }}
                    />
                  </div>
                  <div className={`text-[11px] ${mutedCls}`}>
                    {pollTimedOut
                      ? isSw
                        ? "Muda wa ukaguzi wa moja kwa moja umeisha ili kuzuia kusubiri bure. Unaweza kubofya Hakiki Sasa au kuendelea kituoni - tutakupa taarifa papo hapo malipo yakikamilika."
                        : "Auto-check window finished so you are not kept waiting here. Tap Check Status Now anytime, or continue working in your workspace and we'll notify you as soon as it clears."
                      : isSw
                        ? "Tunathibitisha malipo kiotomatiki. Unaweza pia kuendelea kutumia mfumo na tukupashe habari yakithibitika."
                        : "Automatically verifying with mobile money. Or continue to your workspace now and we will celebrate and notify you when confirmed."}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    disabled={checkingStatus}
                    onClick={() => {
                      setPollAttempts(0);
                      setPollTimedOut(false);
                      void checkPendingPayment(pendingUssd.reference, false);
                    }}
                    className="min-h-[42px] px-4 py-2 rounded-full text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                    style={{ backgroundColor: accent }}
                  >
                    {checkingStatus
                      ? (isSw ? "Inahakiki..." : "Checking...")
                      : isSw ? "Hakiki Sasa" : "Check Status Now"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      persistBackgroundWaiter({
                        reference: pendingUssd.reference,
                        planName: selectedPlan,
                        msisdn: pendingUssd.msisdn,
                        amountTzs: pendingUssd.amountTzs,
                        isUpgrade: pendingUssd.isUpgrade,
                      });
                      router.push("/app");
                    }}
                    className={`min-h-[42px] px-4 py-2 rounded-full border text-xs font-semibold cursor-pointer ${chipCls}`}
                  >
                    {isSw ? "Endelea Kituoni - Nijulishe Yakikamilika" : "Continue in Background -> Notify Me"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearBackgroundWaiter();
                      setPendingUssd(null);
                      setPollAttempts(0);
                      setPollTimedOut(false);
                    }}
                    className="min-h-[42px] px-3 py-2 text-xs font-semibold text-rose-500 hover:underline cursor-pointer"
                  >
                    {isSw ? "Hariri Namba / Ghairi" : "Edit Number / Cancel"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-3 text-xs">
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1.5 ${mutedCls}`}>
                      {isSw ? "Chagua Mtandao au Njia ya Malipo" : "Choose Mobile Money Network or Bank / Card"}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {(
                        [
                          "M-Pesa (Vodacom)",
                          "Mixx by Yas (Tigo)",
                          "Airtel Money",
                          "Halopesa",
                          "CRDB / NMB Bank",
                          "Visa / Mastercard",
                        ] as const
                      ).map((ch) => (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => setChannel(ch)}
                          className={`min-h-[44px] py-2.5 px-3 rounded-xl border text-xs font-semibold inline-flex items-center justify-center text-center cursor-pointer ${
                            channel === ch ? "text-white border-transparent" : chipCls
                          }`}
                          style={channel === ch ? { backgroundColor: accent } : undefined}
                        >
                          {ch}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${mutedCls}`}>
                      {channel.includes("Bank") || channel.includes("Visa")
                        ? (isSw ? "Kumbukumbu ya Benki / Kadi" : "Bank Transaction / Card Reference")
                        : (isSw ? "Namba ya Simu ya Kupokea USSD (Mf. 0712 345 678)" : "Mobile Money Phone Number (e.g. 0712 345 678 or +255712345678)")}
                    </label>
                    <input
                      type="text"
                      value={payerRef}
                      onChange={(e) => setPayerRef(e.target.value)}
                      placeholder={channel.includes("Bank") || channel.includes("Visa") ? "CRDB/NMB or Card Ref" : "+255 712 345 678"}
                      className={`w-full min-h-[44px] px-4 py-3 rounded-xl border text-sm focus:outline-none ${chipCls}`}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    disabled={busy || payerRef.trim().length < 4}
                    onClick={() => void submitPayment()}
                    className="w-full sm:w-auto min-h-[44px] px-6 py-3 rounded-full text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                    style={{ backgroundColor: accent }}
                  >
                    {busy
                      ? (isSw ? "Inatuma USSD..." : "Sending Payment Prompt...")
                      : channel.includes("Bank") || channel.includes("Visa")
                        ? (isSw ? "Thibitisha Malipo ->" : "Submit Payment ->")
                        : (isSw ? "Tuma Ujumbe wa USSD Simuni ->" : "Send USSD Prompt to Phone ->")}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* STEP 3: CLEAR COMPLETION */}
        {step === 3 && (
          <div className={`rounded-[28px] border p-5 sm:p-8 text-center space-y-4 ${cardCls}`}>
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-500">
                {confirmedUpgrade
                  ? (isSw ? "MPANGO UMEPANDISHWA" : "PLAN UPGRADE CONFIRMED")
                  : (isSw ? "MALIPO YAMEKAMILIKA" : "PAYMENT CONFIRMED")}
              </div>
              <h2 className="text-2xl font-normal" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                {selectedPlan} {isSw ? "Imewashwa" : "is Now Active"}
              </h2>
              <p className={`text-xs ${mutedCls}`}>
                Receipt: <strong className="font-mono">{receiptCode}</strong> &middot; {channel} &middot; {payerRef}
                {confirmedAmountTzs ? ` · ${formatTzs(confirmedAmountTzs)} paid` : ""}
                {confirmedCreditTzs > 0 ? ` (${formatTzs(confirmedCreditTzs)} credit applied)` : ""}
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => router.replace("/app")}
                className="w-full sm:w-auto min-h-[44px] px-6 py-3 rounded-full text-white text-xs font-semibold cursor-pointer"
                style={{ backgroundColor: accent }}
              >
                {isSw ? "Ingia Kituoni ->" : "Return to Unlocked Workspace ->"}
              </button>
            </div>
          </div>
        )}
    </div>
  );

  if (shellProfile && !account.accessLock?.locked) {
    const navItems: WorkspaceNavItem[] = [
      { id: "overview", label: isSw ? "Muhtasari" : "Overview", href: "/app" },
      { id: "operations", label: isSw ? "Kaunta POS" : "Counter POS", href: "/app?tab=operations" },
      { id: "billing", label: isSw ? "Malipo" : "Billing", active: true, href: "/app/billing" },
      { id: "reports", label: isSw ? "Ripoti" : "Reports", href: "/app?tab=reports" },
      { id: "user_settings", label: isSw ? "Mipangilio" : "Settings", href: "/app/settings" },
    ];
    return (
      <WorkspaceShell
        orgName={account.orgName}
        centreName={centreName}
        profileName={shellProfile.displayName}
        profileRole={shellProfile.role}
        brandLogoUrl={account.customization?.brandLogoUrl}
        brandAccent={account.customization?.brandAccent || accent}
        fontScale={account.customization?.fontScale}
        lang={account.lang}
        onToggleLang={() => void toggleLang()}
        theme={theme}
        onToggleTheme={toggleTheme}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        navItems={navItems}
        onLockProfile={() => void lockProfile()}
        onSignOut={() => void signOutOrg()}
      >
        {billingContent}
      </WorkspaceShell>
    );
  }

  return (
    <div className={`min-h-screen px-4 py-6 sm:py-8 sm:px-8 ${isDark ? "bg-[#090C12] text-slate-100" : "bg-[#F8FAFC] text-[#111317]"}`}>
      {billingContent}
    </div>
  );
}
