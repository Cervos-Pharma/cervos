/**
 * @file hq/billing/HQBillingClient.tsx
 * @description Client component for the HQ Billing & Subscription management page.
 * Features:
 *   - Overview stat cards (MRR, active subscriptions, revenue metrics)
 *   - Accounts tab with billing info, plan changes, and history view
 *   - Subscription Plans tab with plan management
 *   - Payment History tab with full system-wide payment records
 */
"use client";

import { useState } from "react";
import {
  getBillingOverview,
  getBillingAccounts,
  getAccountBillingHistory,
  getSubscriptionPlans,
  getAllBillingPayments,
  updateAccountSubscription,
  recordManualPayment,
  upsertSubscriptionPlan,
  deleteSubscriptionPlan,
  type SubscriptionPlan,
  type BillingAccount,
  type BillingPeriod,
  type BillingOverview,
} from "@/lib/actions/hq";
import Toast from "@/components/Toast";
import { useI18n } from "@/lib/i18n/context";

interface PaymentRecord {
  id: string;
  account_id: string;
  account_name: string;
  amount_tzs: number;
  reference: string;
  note: string | null;
  recorded_by_name: string;
  created_at: string;
}

interface Props {
  overview: BillingOverview | null;
  overviewError: string | null;
  accounts: BillingAccount[] | null;
  accountsError: string | null;
  plans: SubscriptionPlan[] | null;
  plansError: string | null;
  payments: PaymentRecord[] | null;
  paymentsError: string | null;
}

function formatTzs(amount: number): string {
  return "TZS " + Math.round(amount).toLocaleString();
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-secondary/10 text-secondary",
    trial: "bg-primary/10 text-primary",
    payment_due: "bg-amber-100 text-amber-700",
    grace: "bg-amber-100 text-amber-700",
    locked: "bg-error-container text-error",
    paused: "bg-surface-container text-on-surface-variant",
    paid: "bg-secondary/10 text-secondary",
    pending: "bg-amber-100 text-amber-700",
    failed: "bg-error-container text-error",
    refunded: "bg-surface-container text-on-surface-variant",
  };
  const cls = styles[status] ?? "bg-surface-container text-on-surface-variant";
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-label-md capitalize ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default function HQBillingClient({
  overview,
  overviewError,
  accounts,
  accountsError,
  plans,
  plansError,
  payments,
  paymentsError,
}: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"accounts" | "plans" | "history">("accounts");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<BillingAccount | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState<BillingPeriod[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [changePlanTarget, setChangePlanTarget] = useState<BillingAccount | null>(null);
  const [changePlanValue, setChangePlanValue] = useState("");
  const [changePlanStatusValue, setChangePlanStatusValue] = useState("");
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [recordPaymentForm, setRecordPaymentForm] = useState({ accountId: "", amount: "", reference: "", note: "" });
  const [editPlanOpen, setEditPlanOpen] = useState(false);
  const [editPlanTarget, setEditPlanTarget] = useState<SubscriptionPlan | null>(null);
  const [editPlanForm, setEditPlanForm] = useState<Omit<SubscriptionPlan, "id">>({ name: "", price_monthly_tzs: 0, price_annual_tzs: 0, max_branches: 1, max_operators: 5, features: [] });
  const [addPlanOpen, setAddPlanOpen] = useState(false);
  const [addPlanForm, setAddPlanForm] = useState<Omit<SubscriptionPlan, "id">>({ name: "", price_monthly_tzs: 0, price_annual_tzs: 0, max_branches: 1, max_operators: 5, features: [] });
  const [accountSearch, setAccountSearch] = useState("");
  const [planSearch, setPlanSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [paymentSearch, setPaymentSearch] = useState("");

  function showToast(message: string, type: "success" | "error" | "info") {
    setToast({ message, type });
  }

  async function openHistory(account: BillingAccount) {
    setSelectedAccount(account);
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const result = await getAccountBillingHistory(account.id);
      if (result.error) {
        showToast(result.error, "error");
      } else {
        setHistoryData(result.data);
      }
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleChangePlan() {
    if (!changePlanTarget) return;
    setLoading(true);
    try {
      const result = await updateAccountSubscription(
        changePlanTarget.id,
        changePlanValue || null,
        changePlanStatusValue || null
      );
      if (result.error) {
        showToast(result.error, "error");
      } else {
        const suspended = result.suspendedBranchIds?.length;
        const msg = suspended
          ? `${changePlanTarget.account_name} updated. ${suspended} branch${suspended > 1 ? "es" : ""} suspended (max_branches exceeded).`
          : `${changePlanTarget.account_name} updated.`;
        showToast(msg, "success");
        setChangePlanOpen(false);
        window.location.reload();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRecordPayment() {
    if (!recordPaymentForm.accountId || !recordPaymentForm.amount || !recordPaymentForm.reference) {
      showToast("Fill in all required fields.", "error");
      return;
    }
    setLoading(true);
    try {
      const result = await recordManualPayment(
        recordPaymentForm.accountId,
        parseFloat(recordPaymentForm.amount),
        recordPaymentForm.reference,
        recordPaymentForm.note
      );
      if (result.error) {
        showToast(result.error, "error");
      } else {
        showToast("Payment recorded.", "success");
        setRecordPaymentOpen(false);
        setRecordPaymentForm({ accountId: "", amount: "", reference: "", note: "" });
        window.location.reload();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSavePlan() {
    setLoading(true);
    try {
      const result = await upsertSubscriptionPlan({
        id: editPlanTarget?.id,
        ...editPlanForm,
      });
      if (result.error) {
        showToast(result.error, "error");
      } else {
        showToast("Plan saved.", "success");
        setEditPlanOpen(false);
        setEditPlanTarget(null);
        window.location.reload();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleAddPlan() {
    setLoading(true);
    try {
      const result = await upsertSubscriptionPlan(addPlanForm);
      if (result.error) {
        showToast(result.error, "error");
      } else {
        showToast("Plan created.", "success");
        setAddPlanOpen(false);
        setAddPlanForm({ name: "", price_monthly_tzs: 0, price_annual_tzs: 0, max_branches: 1, max_operators: 5, features: [] });
        window.location.reload();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePlan(planId: string) {
    if (!confirm("Delete this plan?")) return;
    setLoading(true);
    try {
      const result = await deleteSubscriptionPlan(planId);
      if (result.error) {
        showToast(result.error, "error");
      } else {
        showToast("Plan deleted.", "success");
        window.location.reload();
      }
    } finally {
      setLoading(false);
    }
  }

  function openEditPlan(plan: SubscriptionPlan) {
    setEditPlanTarget(plan);
    setEditPlanForm({
      name: plan.name,
      price_monthly_tzs: plan.price_monthly_tzs,
      price_annual_tzs: plan.price_annual_tzs,
      max_branches: plan.max_branches,
      max_operators: plan.max_operators,
      features: plan.features,
    });
    setEditPlanOpen(true);
  }

  const filteredAccounts = (accounts ?? []).filter((a) =>
    a.account_name.toLowerCase().includes(accountSearch.toLowerCase())
  );

  const filteredPlans = (plans ?? []).filter((p) =>
    p.name.toLowerCase().includes(planSearch.toLowerCase())
  );

  const filteredPayments = (payments ?? []).filter((p) => {
    if (paymentFilter !== "all" && !p.reference.toLowerCase().includes(paymentFilter)) return false;
    if (paymentSearch && !p.account_name.toLowerCase().includes(paymentSearch.toLowerCase()) && !p.reference.toLowerCase().includes(paymentSearch.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {[
          { label: "Total MRR", value: formatTzs(overview?.totalMrr ?? 0), highlight: true },
          { label: "Active Subs", value: overview?.activeSubscriptions ?? 0 },
          { label: "Pending", value: overview?.pendingPayments ?? 0, warning: true },
          { label: "Failed", value: overview?.failedPayments ?? 0, danger: true },
          { label: "MTD Revenue", value: formatTzs(overview?.mtdRevenue ?? 0) },
          { label: "YTD Revenue", value: formatTzs(overview?.ytdRevenue ?? 0) },
        ].map((s) => (
          <div key={s.label} className={`border border-outline-variant p-5 ${s.highlight ? "bg-primary/5 border-primary/20" : "bg-surface-base"}`}>
            <p className="font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider">{s.label}</p>
            <p className={`font-headline-lg text-headline-lg mt-1 ${s.danger ? "text-error" : s.warning ? "text-amber-600" : "text-ink-deep"}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-outline-variant">
        {(["accounts", "plans", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 font-label-md text-label-md capitalize transition-colors border-b-2 ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {t === "history" ? "Payment History" : t}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          {tab === "accounts" && (
            <button
              onClick={() => setRecordPaymentOpen(true)}
              className="px-4 py-2 bg-primary text-on-primary font-label-md text-label-md flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Record Payment
            </button>
          )}
          {tab === "plans" && (
            <button
              onClick={() => setAddPlanOpen(true)}
              className="px-4 py-2 bg-primary text-on-primary font-label-md text-label-md flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Add Plan
            </button>
          )}
        </div>
      </div>

      {/* Accounts Tab */}
      {tab === "accounts" && (
        <>
          {accountsError ? (
            <div className="bg-error-container text-on-error-container p-6 rounded mb-6">
              <p className="font-body-md">Error loading accounts: {accountsError}</p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <input
                  type="search"
                  placeholder="Search accounts..."
                  value={accountSearch}
                  onChange={(e) => setAccountSearch(e.target.value)}
                  className="border border-outline-variant bg-surface-container-low px-4 py-2 text-sm focus:outline-none focus:border-primary w-64"
                />
              </div>
              <div className="bg-surface-base border border-outline-variant rounded overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-surface-container-low">
                      <tr>
                        {["Account", "Plan", "Status", "MRR", "LTV", "Branches", "Started", "Actions"].map((h) => (
                          <th key={h} className="text-left px-6 py-3 font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/30">
                      {filteredAccounts.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-6 py-12 text-center text-on-surface-variant">No accounts found.</td>
                        </tr>
                      ) : (
                        filteredAccounts.map((a) => (
                          <tr key={a.id} className="hover:bg-surface-container-low/30 transition-colors">
                            <td className="px-6 py-4 font-body-md text-body-md text-ink-deep font-medium">{a.account_name}</td>
                            <td className="px-6 py-4">
                              <span className="inline-flex px-2 py-0.5 rounded text-xs font-label-md bg-surface-container">{a.subscription_plan ?? "—"}</span>
                            </td>
                            <td className="px-6 py-4"><StatusBadge status={a.subscription_status} /></td>
                            <td className="px-6 py-4 font-mono text-sm text-on-surface-variant">{formatTzs(a.mrr)}</td>
                            <td className="px-6 py-4 font-mono text-sm text-on-surface-variant">{formatTzs(a.ltv)}</td>
                            <td className="px-6 py-4 font-mono text-sm text-on-surface-variant">{a.branches_on_plan}</td>
                            <td className="px-6 py-4 font-mono text-xs text-on-surface-variant">
                              {a.subscription_started_at ? new Date(a.subscription_started_at).toLocaleDateString() : "—"}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => openHistory(a)}
                                  className="text-sm font-label-md text-primary hover:underline"
                                >
                                  History
                                </button>
                                <button
                                  onClick={() => {
                                    setChangePlanTarget(a);
                                    setChangePlanValue(a.subscription_plan ?? "");
                                    setChangePlanStatusValue(a.subscription_status);
                                    setChangePlanOpen(true);
                                  }}
                                  className="text-sm font-label-md text-primary hover:underline"
                                >
                                  Change Plan
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Plans Tab */}
      {tab === "plans" && (
        <>
          {plansError ? (
            <div className="bg-error-container text-on-error-container p-6 rounded mb-6">
              <p className="font-body-md">Error loading plans: {plansError}</p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <input
                  type="search"
                  placeholder="Search plans..."
                  value={planSearch}
                  onChange={(e) => setPlanSearch(e.target.value)}
                  className="border border-outline-variant bg-surface-container-low px-4 py-2 text-sm focus:outline-none focus:border-primary w-64"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredPlans.map((plan) => (
                  <div key={plan.id} className="bg-surface-base border border-outline-variant rounded p-6 flex flex-col">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="font-headline-md text-headline-md text-ink-deep">{plan.name}</h3>
                      <div className="flex gap-2">
                        <button onClick={() => openEditPlan(plan)} className="text-primary hover:underline text-sm font-label-md">Edit</button>
                        <button onClick={() => handleDeletePlan(plan.id)} className="text-error hover:underline text-sm font-label-md">Delete</button>
                      </div>
                    </div>
                    <div className="mb-4 space-y-1">
                      <div className="flex justify-between font-body-sm">
                        <span className="text-on-surface-variant">Monthly</span>
                        <span className="font-mono text-ink-deep">{formatTzs(plan.price_monthly_tzs)}</span>
                      </div>
                      <div className="flex justify-between font-body-sm">
                        <span className="text-on-surface-variant">Annual</span>
                        <span className="font-mono text-ink-deep">{formatTzs(plan.price_annual_tzs)}</span>
                      </div>
                      <div className="flex justify-between font-body-sm">
                        <span className="text-on-surface-variant">{t("bill.max_branches")}</span>
                        <span className="font-mono text-ink-deep">{plan.max_branches}</span>
                      </div>
                      <div className="flex justify-between font-body-sm">
                        <span className="text-on-surface-variant">{t("bill.max_operators")}</span>
                        <span className="font-mono text-ink-deep">{plan.max_operators}</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="font-label-md text-label-md text-xs text-on-surface-variant uppercase tracking-wider mb-2">Features</p>
                      <ul className="space-y-1">
                        {plan.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-on-surface">
                            <span className="material-symbols-outlined text-[14px] text-secondary mt-0.5">check</span>
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Payment History Tab */}
      {tab === "history" && (
        <>
          {paymentsError ? (
            <div className="bg-error-container text-on-error-container p-6 rounded mb-6">
              <p className="font-body-md">Error loading payments: {paymentsError}</p>
            </div>
          ) : (
            <>
              <div className="flex gap-4 mb-4">
                <input
                  type="search"
                  placeholder="Search by account or reference..."
                  value={paymentSearch}
                  onChange={(e) => setPaymentSearch(e.target.value)}
                  className="border border-outline-variant bg-surface-container-low px-4 py-2 text-sm focus:outline-none focus:border-primary w-64"
                />
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className="border border-outline-variant bg-surface-container-low px-4 py-2 text-sm focus:outline-none focus:border-primary"
                >
                  <option value="all">{t("hqb.all_refs")}</option>
                  <option value="mpesa">M-Pesa</option>
                  <option value="bank">Bank</option>
                </select>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch("/api/hq/export/payments");
                      if (!res.ok) throw new Error("Export failed");
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `payments-${new Date().toISOString().slice(0,10)}.csv`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                      showToast("Payments exported.", "success");
                    } catch {
                      showToast("Export failed.", "error");
                    }
                  }}
                  className="ml-auto flex items-center gap-2 px-4 py-2 border border-outline-variant bg-surface-container-low rounded text-sm hover:border-primary hover:text-primary transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  Export CSV
                </button>
              </div>
              <div className="bg-surface-base border border-outline-variant rounded overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-surface-container-low">
                      <tr>
                        {["Date", "Account", "Amount", "Reference", "Recorded By", "Actions"].map((h) => (
                          <th key={h} className="text-left px-6 py-3 font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/30">
                      {filteredPayments.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant">No payments found.</td>
                        </tr>
                      ) : (
                        filteredPayments.map((p) => (
                          <tr key={p.id} className="hover:bg-surface-container-low/30 transition-colors">
                            <td className="px-6 py-4 font-mono text-xs text-on-surface-variant whitespace-nowrap">
                              {new Date(p.created_at).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 font-body-md text-body-md text-ink-deep font-medium">{p.account_name}</td>
                            <td className="px-6 py-4 font-mono text-sm text-ink-deep">{formatTzs(p.amount_tzs)}</td>
                            <td className="px-6 py-4">
                              <span className="font-mono text-xs text-on-surface-variant">{p.reference}</span>
                            </td>
                            <td className="px-6 py-4 font-body-sm text-body-sm text-on-surface-variant">{p.recorded_by_name}</td>
                            <td className="px-6 py-4">
                              {p.note && <span className="text-xs text-on-surface-variant" title={p.note}>📝</span>}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* History Slideout */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setHistoryOpen(false)} />
          <div className="relative ml-auto w-[480px] h-full bg-surface-container-lowest border-l border-outline-variant shadow-xl flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-outline-variant">
              <div>
                <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{t("hqb.history")}</p>
                <h2 className="font-headline-md text-headline-md text-ink-deep mt-1">{selectedAccount?.account_name}</h2>
              </div>
              <button onClick={() => setHistoryOpen(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {historyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border border-primary/40 border-t-primary rounded-full animate-spin" />
                </div>
              ) : historyData && historyData.length > 0 ? (
                <div className="space-y-4">
                  {historyData.map((period) => (
                    <div key={period.id} className="bg-surface-base border border-outline-variant rounded p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-body-md text-body-md text-ink-deep">{formatTzs(period.amount_tzs)}</p>
                          <p className="font-mono text-xs text-on-surface-variant mt-0.5">
                            {new Date(period.period_start).toLocaleDateString()} – {new Date(period.period_end).toLocaleDateString()}
                          </p>
                        </div>
                        <StatusBadge status={period.status} />
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="font-mono text-xs text-on-surface-variant">
                          Paid: {period.paid_at ? new Date(period.paid_at).toLocaleString() : "—"}
                        </span>
                        {period.invoice_url && (
                          <a href={period.invoice_url} target="_blank" rel="noopener noreferrer" className="text-primary text-xs hover:underline">
                            Invoice
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[32px] mb-2 block">receipt_long</span>
                  <p className="font-body-md">No billing history for this account.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Change Plan Modal */}
      {changePlanOpen && changePlanTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setChangePlanOpen(false)} />
          <div className="relative bg-surface-container-lowest border border-outline-variant rounded p-6 w-full max-w-md shadow-xl">
            <h3 className="font-headline-md text-headline-md text-ink-deep mb-1">{t("hqb.change_plan")}</h3>
            <p className="font-body-sm text-on-surface-variant mb-6">{changePlanTarget.account_name}</p>
            <div className="space-y-4">
              <label className="flex flex-col gap-1">
                <span className="font-label-md text-label-md text-xs text-on-surface-variant uppercase tracking-wider">{t("hqb.plan")}</span>
                <select
                  value={changePlanValue}
                  onChange={(e) => setChangePlanValue(e.target.value)}
                  className="border border-outline-variant bg-surface-container-low px-3 py-2 text-sm focus:outline-none focus:border-primary"
                >
                  <option value="">None</option>
                  {(plans ?? []).map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — {formatTzs(p.price_monthly_tzs)}/mo</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-label-md text-label-md text-xs text-on-surface-variant uppercase tracking-wider">{t("bill.status")}</span>
                <select
                  value={changePlanStatusValue}
                  onChange={(e) => setChangePlanStatusValue(e.target.value)}
                  className="border border-outline-variant bg-surface-container-low px-3 py-2 text-sm focus:outline-none focus:border-primary"
                >
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="payment_due">{t("hqb.payment_due")}</option>
                  <option value="grace">Grace</option>
                  <option value="locked">Locked</option>
                </select>
              </label>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={handleChangePlan}
                disabled={loading}
                className="px-4 py-2 bg-primary text-on-primary font-label-md text-label-md disabled:opacity-60 flex items-center gap-2"
              >
                {loading ? <div className="w-4 h-4 border border-on-primary/40 border-t-on-primary rounded-full animate-spin" /> : null}
                Save Changes
              </button>
              <button
                onClick={() => setChangePlanOpen(false)}
                className="px-4 py-2 border border-outline-variant text-on-surface-variant font-label-md text-label-md"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {recordPaymentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setRecordPaymentOpen(false)} />
          <div className="relative bg-surface-container-lowest border border-outline-variant rounded p-6 w-full max-w-md shadow-xl">
            <h3 className="font-headline-md text-headline-md text-ink-deep mb-1">{t("hqb.manual_pay")}</h3>
            <p className="font-body-sm text-on-surface-variant mb-6">Manually record a payment received outside the system.</p>
            <div className="space-y-4">
              <label className="flex flex-col gap-1">
                <span className="font-label-md text-label-md text-xs text-on-surface-variant uppercase tracking-wider">Account *</span>
                <select
                  value={recordPaymentForm.accountId}
                  onChange={(e) => setRecordPaymentForm((p) => ({ ...p, accountId: e.target.value }))}
                  className="border border-outline-variant bg-surface-container-low px-3 py-2 text-sm focus:outline-none focus:border-primary"
                >
                  <option value="">Select account...</option>
                  {(accounts ?? []).map((a) => (
                    <option key={a.id} value={a.id}>{a.account_name}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-label-md text-label-md text-xs text-on-surface-variant uppercase tracking-wider">Amount (TZS) *</span>
                <input
                  type="number"
                  value={recordPaymentForm.amount}
                  onChange={(e) => setRecordPaymentForm((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="150000"
                  className="border border-outline-variant bg-surface-container-low px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-label-md text-label-md text-xs text-on-surface-variant uppercase tracking-wider">Reference *</span>
                <input
                  type="text"
                  value={recordPaymentForm.reference}
                  onChange={(e) => setRecordPaymentForm((p) => ({ ...p, reference: e.target.value }))}
                  placeholder="M-Pesa code or bank reference"
                  className="border border-outline-variant bg-surface-container-low px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-label-md text-label-md text-xs text-on-surface-variant uppercase tracking-wider">Note</span>
                <textarea
                  value={recordPaymentForm.note}
                  onChange={(e) => setRecordPaymentForm((p) => ({ ...p, note: e.target.value }))}
                  placeholder="Optional notes..."
                  rows={2}
                  className="border border-outline-variant bg-surface-container-low px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none"
                />
              </label>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={handleRecordPayment}
                disabled={loading}
                className="px-4 py-2 bg-primary text-on-primary font-label-md text-label-md disabled:opacity-60 flex items-center gap-2"
              >
                {loading ? <div className="w-4 h-4 border border-on-primary/40 border-t-on-primary rounded-full animate-spin" /> : null}
                Record Payment
              </button>
              <button
                onClick={() => setRecordPaymentOpen(false)}
                className="px-4 py-2 border border-outline-variant text-on-surface-variant font-label-md text-label-md"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Plan Modal */}
      {editPlanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setEditPlanOpen(false)} />
          <div className="relative bg-surface-container-lowest border border-outline-variant rounded p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-auto">
            <h3 className="font-headline-md text-headline-md text-ink-deep mb-6">Edit Plan: {editPlanTarget?.name}</h3>
            <div className="space-y-4">
              <label className="flex flex-col gap-1">
                <span className="font-label-md text-label-md text-xs text-on-surface-variant uppercase tracking-wider">{t("hqb.plan_name")}</span>
                <input
                  type="text"
                  value={editPlanForm.name}
                  onChange={(e) => setEditPlanForm((p) => ({ ...p, name: e.target.value }))}
                  className="border border-outline-variant bg-surface-container-low px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1">
                  <span className="font-label-md text-label-md text-xs text-on-surface-variant uppercase tracking-wider">Monthly Price (TZS)</span>
                  <input
                    type="number"
                    value={editPlanForm.price_monthly_tzs}
                    onChange={(e) => setEditPlanForm((p) => ({ ...p, price_monthly_tzs: parseInt(e.target.value) || 0 }))}
                    className="border border-outline-variant bg-surface-container-low px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-label-md text-label-md text-xs text-on-surface-variant uppercase tracking-wider">Annual Price (TZS)</span>
                  <input
                    type="number"
                    value={editPlanForm.price_annual_tzs}
                    onChange={(e) => setEditPlanForm((p) => ({ ...p, price_annual_tzs: parseInt(e.target.value) || 0 }))}
                    className="border border-outline-variant bg-surface-container-low px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1">
                  <span className="font-label-md text-label-md text-xs text-on-surface-variant uppercase tracking-wider">{t("bill.max_branches")}</span>
                  <input
                    type="number"
                    value={editPlanForm.max_branches}
                    onChange={(e) => setEditPlanForm((p) => ({ ...p, max_branches: parseInt(e.target.value) || 1 }))}
                    className="border border-outline-variant bg-surface-container-low px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-label-md text-label-md text-xs text-on-surface-variant uppercase tracking-wider">{t("bill.max_operators")}</span>
                  <input
                    type="number"
                    value={editPlanForm.max_operators}
                    onChange={(e) => setEditPlanForm((p) => ({ ...p, max_operators: parseInt(e.target.value) || 5 }))}
                    className="border border-outline-variant bg-surface-container-low px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1">
                <span className="font-label-md text-label-md text-xs text-on-surface-variant uppercase tracking-wider">Features (comma-separated)</span>
                <input
                  type="text"
                  value={editPlanForm.features.join(", ")}
                  onChange={(e) => setEditPlanForm((p) => ({ ...p, features: e.target.value.split(",").map((f) => f.trim()).filter(Boolean) }))}
                  className="border border-outline-variant bg-surface-container-low px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </label>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={handleSavePlan}
                disabled={loading}
                className="px-4 py-2 bg-primary text-on-primary font-label-md text-label-md disabled:opacity-60 flex items-center gap-2"
              >
                {loading ? <div className="w-4 h-4 border border-on-primary/40 border-t-on-primary rounded-full animate-spin" /> : null}
                Save Plan
              </button>
              <button
                onClick={() => setEditPlanOpen(false)}
                className="px-4 py-2 border border-outline-variant text-on-surface-variant font-label-md text-label-md"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Plan Modal */}
      {addPlanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setAddPlanOpen(false)} />
          <div className="relative bg-surface-container-lowest border border-outline-variant rounded p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-auto">
            <h3 className="font-headline-md text-headline-md text-ink-deep mb-6">{t("hqb.add_plan")}</h3>
            <div className="space-y-4">
              <label className="flex flex-col gap-1">
                <span className="font-label-md text-label-md text-xs text-on-surface-variant uppercase tracking-wider">{t("hqb.plan_name")}</span>
                <input
                  type="text"
                  value={addPlanForm.name}
                  onChange={(e) => setAddPlanForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Professional"
                  className="border border-outline-variant bg-surface-container-low px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1">
                  <span className="font-label-md text-label-md text-xs text-on-surface-variant uppercase tracking-wider">Monthly Price (TZS)</span>
                  <input
                    type="number"
                    value={addPlanForm.price_monthly_tzs}
                    onChange={(e) => setAddPlanForm((p) => ({ ...p, price_monthly_tzs: parseInt(e.target.value) || 0 }))}
                    className="border border-outline-variant bg-surface-container-low px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-label-md text-label-md text-xs text-on-surface-variant uppercase tracking-wider">Annual Price (TZS)</span>
                  <input
                    type="number"
                    value={addPlanForm.price_annual_tzs}
                    onChange={(e) => setAddPlanForm((p) => ({ ...p, price_annual_tzs: parseInt(e.target.value) || 0 }))}
                    className="border border-outline-variant bg-surface-container-low px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1">
                  <span className="font-label-md text-label-md text-xs text-on-surface-variant uppercase tracking-wider">{t("bill.max_branches")}</span>
                  <input
                    type="number"
                    value={addPlanForm.max_branches}
                    onChange={(e) => setAddPlanForm((p) => ({ ...p, max_branches: parseInt(e.target.value) || 1 }))}
                    className="border border-outline-variant bg-surface-container-low px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-label-md text-label-md text-xs text-on-surface-variant uppercase tracking-wider">{t("bill.max_operators")}</span>
                  <input
                    type="number"
                    value={addPlanForm.max_operators}
                    onChange={(e) => setAddPlanForm((p) => ({ ...p, max_operators: parseInt(e.target.value) || 5 }))}
                    className="border border-outline-variant bg-surface-container-low px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1">
                <span className="font-label-md text-label-md text-xs text-on-surface-variant uppercase tracking-wider">Features (comma-separated)</span>
                <input
                  type="text"
                  value={addPlanForm.features.join(", ")}
                  onChange={(e) => setAddPlanForm((p) => ({ ...p, features: e.target.value.split(",").map((f) => f.trim()).filter(Boolean) }))}
                  placeholder="Basic POS, Inventory tracking"
                  className="border border-outline-variant bg-surface-container-low px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </label>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={handleAddPlan}
                disabled={loading}
                className="px-4 py-2 bg-primary text-on-primary font-label-md text-label-md disabled:opacity-60 flex items-center gap-2"
              >
                {loading ? <div className="w-4 h-4 border border-on-primary/40 border-t-on-primary rounded-full animate-spin" /> : null}
                Create Plan
              </button>
              <button
                onClick={() => setAddPlanOpen(false)}
                className="px-4 py-2 border border-outline-variant text-on-surface-variant font-label-md text-label-md"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
