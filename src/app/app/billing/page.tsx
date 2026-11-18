"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { COMMERCIAL_PLAN_CATALOG, formatTzs } from "@cervos/core";
import { useWorkspaceTheme } from "@/lib/workspace/theme";

interface BillingAccountSummary {
  id: string;
  orgName: string;
  roleType: string;
  lang: "EN" | "SW";
  subscriptionActive: boolean;
  subscriptionPlan: string;
  billingOverdue?: boolean;
  trialEndsAt?: string;
  accessLock?: { locked: boolean; source: "hq" | "billing" | null; reason: string };
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
  const { isDark } = useWorkspaceTheme();
  const [account, setAccount] = useState<BillingAccountSummary | null>(null);
  const [livePlans, setLivePlans] = useState<BillingPackageItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedPlan, setSelectedPlan] = useState<string>("Community Standard");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [channel, setChannel] = useState<BillingChannel>("M-Pesa (Vodacom)");
  const [payerRef, setPayerRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [bouncedMsg, setBouncedMsg] = useState<string | null>(null);
  const [pendingUssd, setPendingUssd] = useState<{
    reference: string;
    msisdn: string;
    amountTzs: number;
    message: string;
  } | null>(null);
  const [receiptCode, setReceiptCode] = useState<string | null>(null);

  const loadBilling = async () => {
    setLoading(true);
    const [r, pkgRes] = await Promise.all([
      fetch("/api/workspace/state", { cache: "no-store" }),
      fetch("/api/workspace/packages", { cache: "no-store" }).catch(() => null),
    ]);
    if (pkgRes && pkgRes.ok) {
      const pkgData = (await pkgRes.json()) as { packages?: BillingPackageItem[] };
      if (Array.isArray(pkgData.packages) && pkgData.packages.length > 0) {
        setLivePlans(pkgData.packages);
      }
    }
    if (r.status === 401) {
      router.replace("/auth?mode=signin");
      return;
    }
    const data = await r.json();
    if (data.account) {
      setAccount(data.account);
      setSelectedPlan(data.account.subscriptionPlan || "Community Standard");
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

  const checkPendingPayment = async (refCode: string) => {
    setCheckingStatus(true);
    try {
      const res = await fetch("/api/workspace/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check_subscription_payment", reference: refCode }),
      });
      const out = await res.json();
      if (out.status === "completed") {
        setPendingUssd(null);
        setReceiptCode(out.receiptNumber || refCode);
        if (out.account) setAccount(out.account);
        setStep(3);
      } else if (out.status === "failed" || res.status === 402) {
        setPendingUssd(null);
        setBouncedMsg(out.error || "Mobile money payment failed or was declined.");
      }
    } finally {
      setCheckingStatus(false);
    }
  };

  useEffect(() => {
    if (!pendingUssd) return;
    const timer = setInterval(() => {
      void checkPendingPayment(pendingUssd.reference);
    }, 3500);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingUssd?.reference]);

  const submitPayment = async () => {
    if (!account) return;
    setBusy(true);
    setBouncedMsg(null);
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
      setPendingUssd({
        reference: out.reference,
        msisdn: out.msisdn || payerRef,
        amountTzs: out.amountTzs || currentPlanObj?.priceMonthlyTzs || 45000,
        message: out.message || "Enter your PIN on your phone to complete payment.",
      });
      return;
    }
    setReceiptCode(out.receiptNumber || "SUB-OK");
    if (out.account) setAccount(out.account);
    setStep(3);
  };

  const catalogSource: BillingPackageItem[] =
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
    }));
  const plans = catalogSource.filter((p) => p.audience === "pharmacy" || p.audience === "supplier");
  const currentPlanObj = plans.find((p) => p.name === selectedPlan) ?? plans[0];

  if (loading || !account) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 ${isDark ? "bg-[#090C12] text-slate-100" : "bg-[#F8FAFC] text-[#111317]"}`}>
        <div className="text-sm font-semibold animate-pulse">Loading payment center...</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen px-4 py-6 sm:py-8 sm:px-8 ${isDark ? "bg-[#090C12] text-slate-100" : "bg-[#F8FAFC] text-[#111317]"}`}>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>
              CERVOS BILLING &amp; PLAN CHECKOUT
            </div>
            <h1 className="text-2xl sm:text-3xl font-normal tracking-tight mt-0.5" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
              {isSw ? `Malipo ya Mpango - ${account.orgName}` : `Plan Payment - ${account.orgName}`}
            </h1>
          </div>
          <Link href="/app" className={`min-h-[44px] inline-flex items-center justify-center px-4 py-2.5 rounded-full border text-xs font-semibold ${chipCls}`}>
            &larr; {isSw ? "Rudi Kituoni" : "Back to Workspace"}
          </Link>
        </div>

        {/* Clear 3-Step Payment Progress Bar + Trial Status */}
        <div className={`rounded-[24px] border p-4 sm:p-5 space-y-4 ${cardCls}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                  account.accessLock?.locked
                    ? "bg-rose-500/15 text-rose-500"
                    : account.subscriptionActive
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-amber-500/15 text-amber-600"
                }`}
              >
                {account.accessLock?.locked
                  ? isSw ? "Imefungwa - Malipo Yanahitajika" : "Locked - Payment Needed"
                  : account.subscriptionActive
                    ? isSw ? "Mpango Hai" : "Active Paid Plan"
                    : isSw ? "Majaribio ya Siku 15" : "15-Day Trial Active"}
              </span>
              <span className="text-xs font-semibold">{account.subscriptionPlan}</span>
            </div>
            <span className={`text-[11px] font-mono ${mutedCls}`}>
              {step === 1 ? "Step 1/3 · Select Plan" : step === 2 ? "Step 2/3 · Pay / Edit Info" : "Step 3/3 · Confirmed"}
            </span>
          </div>

          <div className="flex flex-wrap sm:grid sm:grid-cols-3 gap-2.5 text-xs">
            {[
              { id: 1 as const, label: isSw ? "1. Chagua Mpango" : "1. Select Plan" },
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

        {/* STEP 1: CHOOSE PLAN */}
        {step === 1 && (
          <div className={`rounded-[24px] border p-4 sm:p-6 space-y-4 ${cardCls}`}>
            <h2 className="text-sm font-semibold">{isSw ? "Chagua Kifurushi cha Shirika" : "Choose Your Organization Plan"}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {plans.map((p) => {
                const chosen = p.name === selectedPlan;
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
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm">{p.name}</span>
                      <span className="text-xs font-extrabold tabular-nums shrink-0" style={{ color: accent }}>
                        {formatTzs(p.priceMonthlyTzs)}/mo
                      </span>
                    </div>
                    <div className={`text-[11px] ${mutedCls}`}>
                      {p.maxBranches ? `Up to ${p.maxBranches} branch(es)` : "Unlimited branches"} &middot;{" "}
                      {p.includedAdminsPerBranch ?? 1} Admin + {p.includedOperatorsPerBranch ?? 1} Operator/branch included
                      {p.pricePerBranchMonthlyTzs ? ` (${formatTzs(p.pricePerBranchMonthlyTzs)}/branch min)` : ""}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full sm:w-auto min-h-[44px] px-6 py-3 rounded-full text-white text-xs font-semibold cursor-pointer"
                style={{ backgroundColor: accent }}
              >
                {isSw ? "Endelea Kwenye Malipo ->" : "Continue to Payment ->"}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: PAY / EDIT INFO & REAL USSD PUSH CONFIRMATION */}
        {step === 2 && (
          <div className={`rounded-[24px] border p-4 sm:p-6 space-y-4 ${cardCls}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">{selectedPlan}</h2>
                <p className={`text-xs ${mutedCls}`}>
                  {formatTzs(
                    billingCycle === "annual"
                      ? (currentPlanObj?.priceAnnualTzs || (currentPlanObj?.priceMonthlyTzs ?? 45000) * 10)
                      : (currentPlanObj?.priceMonthlyTzs ?? 45000)
                  )}{" "}
                  / {billingCycle === "annual" ? (isSw ? "mwaka" : "year") : (isSw ? "mwezi" : "month")}
                </p>
              </div>
              <div className="flex items-center gap-2">
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
                      {cyc === "monthly" ? (isSw ? "Mwezi" : "Monthly") : (isSw ? "Mwaka" : "Annual (-2mo)")}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => { setPendingUssd(null); setStep(1); }} className="min-h-[44px] px-2 py-2 inline-flex items-center text-xs font-semibold hover:underline cursor-pointer" style={{ color: accent }}>
                  {isSw ? "Badili Mpango" : "Change Plan"}
                </button>
              </div>
            </div>

            {bouncedMsg && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/35 text-xs text-rose-500 space-y-1">
                <div className="font-bold">{isSw ? "Malipo Yamekwama - Hariri Taarifa" : "Payment Did Not Clear - Edit & Retry"}</div>
                <div>{bouncedMsg}</div>
              </div>
            )}

            {pendingUssd ? (
              <div className="p-5 rounded-2xl border border-blue-500/35 bg-blue-500/10 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#1039B9] dark:text-sky-300">
                    {isSw ? "Subiri Uthibitisho wa Simu (USSD)" : "Waiting for Phone USSD PIN Approval"}
                  </span>
                  <span className="text-[11px] font-mono animate-pulse">
                    {checkingStatus ? "Checking..." : "Polling Payme..."}
                  </span>
                </div>
                <p className="text-xs leading-relaxed">
                  {pendingUssd.message} ({formatTzs(pendingUssd.amountTzs)} to <strong>+{pendingUssd.msisdn}</strong> &middot; Ref <strong className="font-mono">{pendingUssd.reference}</strong>)
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    disabled={checkingStatus}
                    onClick={() => void checkPendingPayment(pendingUssd.reference)}
                    className="px-4 py-2 rounded-full text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                    style={{ backgroundColor: accent }}
                  >
                    {checkingStatus ? "Verifying..." : isSw ? "Nimeshalipa - Hakiki Sasa" : "I Approved on Phone - Verify Now"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingUssd(null)}
                    className={`px-4 py-2 rounded-full border text-xs font-semibold cursor-pointer ${chipCls}`}
                  >
                    {isSw ? "Hariri Namba / Ghairi" : "Edit Number / Retry"}
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
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center text-2xl font-bold">
              &#10003;
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-500">
                {isSw ? "MALIPO YAMEKAMILIKA" : "PAYMENT CONFIRMED"}
              </div>
              <h2 className="text-2xl font-normal" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
                {selectedPlan} {isSw ? "Imewashwa" : "is Now Active"}
              </h2>
              <p className={`text-xs ${mutedCls}`}>
                Receipt: <strong className="font-mono">{receiptCode}</strong> &middot; {channel} &middot; {payerRef}
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
    </div>
  );
}
