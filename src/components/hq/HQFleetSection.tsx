"use client";

import { useMemo, useState, type FormEvent } from "react";
import { COMMERCIAL_PLAN_CATALOG, formatTzs } from "@cervos/core";
import { matchesSearch } from "@/lib/search";
import { hqSurfaceTokens } from "./hqSurface";
import { downloadCertificateProof } from "./downloadProof";
import ComplianceProofViewerModal from "./ComplianceProofViewerModal";
import type { HqAuditEvent, HqFleetAccount, HqPackageRecord } from "./types";

interface HQFleetSectionProps {
  accounts: HqFleetAccount[];
  auditLogs: HqAuditEvent[];
  packages: HqPackageRecord[];
  selectedOrgId: string;
  onSelectOrg: (accountId: string) => void;
  onRunAction: (
    payload: Record<string, unknown>,
    successMessage: string
  ) => Promise<boolean>;
  onJumpToComposer: (accountId: string) => void;
  onJumpToOrgEvents: (accountId: string) => void;
  isDark: boolean;
  busy: boolean;
}

type FleetFilter = "all" | "active" | "trial" | "locked" | "overdue" | "verified";
type InspectorTab = "controls" | "branches" | "operators" | "audit";

const LOCK_REASON_PRESETS = [
  "Compliance permit renewal required pending TMDA inspection.",
  "Controlled substance dispensing audit hold initiated by HQ.",
  "Unusual POS void or stock discrepancy flagged for owner review.",
];

const OPERATOR_ROLES = [
  { value: "pharmacy_owner", label: "Pharmacy Owner" },
  { value: "superintendent_pharmacist", label: "Superintendent Pharmacist" },
  { value: "pos_cashier", label: "POS Cashier" },
  { value: "warehouse_dispatcher", label: "Warehouse Dispatcher" },
  { value: "supplier_admin", label: "Supplier Admin" },
];

export default function HQFleetSection({
  accounts,
  auditLogs,
  packages,
  selectedOrgId,
  onSelectOrg,
  onRunAction,
  onJumpToComposer,
  onJumpToOrgEvents,
  isDark,
  busy,
}: HQFleetSectionProps) {
  const [filter, setFilter] = useState<FleetFilter>("all");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("controls");
  const [query, setQuery] = useState("");
  const [lockReason, setLockReason] = useState(LOCK_REASON_PRESETS[0]);
  const [customPlan, setCustomPlan] = useState("");
  const [branchCmdReason, setBranchCmdReason] = useState("");

  // Add Operator form state
  const [newOpName, setNewOpName] = useState("");
  const [newOpRole, setNewOpRole] = useState("pos_cashier");
  const [newOpCentreId, setNewOpCentreId] = useState("");
  const [newOpPin, setNewOpPin] = useState("4829");

  // Inline PIN reset draft per operator
  const [pinDrafts, setPinDrafts] = useState<Record<string, string>>({});
  const [verifyNote, setVerifyNote] = useState("");
  const [inspectedProof, setInspectedProof] = useState<{
    org: HqFleetAccount;
    cert: HqFleetAccount["certificates"][number] | null;
  } | null>(null);

  const t = hqSurfaceTokens(isDark);
  const cardCls = t.panelCls;
  const chipCls = t.wellCls;
  const inputCls = t.inputCls;
  const mutedCls = t.mutedCls;

  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      if (filter === "active" && (a.accessLock.locked || !a.subscriptionActive)) return false;
      if (filter === "trial" && (a.accessLock.locked || a.subscriptionActive)) return false;
      if (filter === "locked" && !a.accessLock.locked) return false;
      if (filter === "overdue" && !a.billingOverdue) return false;
      if (filter === "verified" && a.verificationStatus !== "verified") return false;
      return matchesSearch(
        query,
        a.orgName,
        a.fullName,
        a.email,
        a.username,
        a.region,
        a.subscriptionPlan,
        a.roleType,
        a.id,
        ...a.centres.map((c) => `${c.name} ${c.region}`)
      );
    });
  }, [accounts, filter, query]);

  const selectedOrg = useMemo(
    () => accounts.find((a) => a.id === selectedOrgId) ?? filtered[0] ?? accounts[0] ?? null,
    [accounts, filtered, selectedOrgId]
  );

  const selectedOrgAudits = useMemo(
    () => (selectedOrg ? auditLogs.filter((l) => l.accountId === selectedOrg.id).slice(0, 12) : []),
    [auditLogs, selectedOrg]
  );

  const planChoices = useMemo(() => {
    const set = new Set<string>();
    for (const p of packages) set.add(p.name);
    for (const p of COMMERCIAL_PLAN_CATALOG) set.add(p.name);
    return Array.from(set);
  }, [packages]);

  const filterOptions: Array<{ key: FleetFilter; label: string; count: number }> = [
    { key: "all", label: "All", count: accounts.length },
    {
      key: "active",
      label: "Active",
      count: accounts.filter((a) => !a.accessLock.locked && a.subscriptionActive).length,
    },
    {
      key: "trial",
      label: "Trial",
      count: accounts.filter((a) => !a.accessLock.locked && !a.subscriptionActive).length,
    },
    {
      key: "locked",
      label: "Locked",
      count: accounts.filter((a) => a.accessLock.locked).length,
    },
    {
      key: "overdue",
      label: "Overdue",
      count: accounts.filter((a) => a.billingOverdue).length,
    },
    {
      key: "verified",
      label: "Verified",
      count: accounts.filter((a) => a.verificationStatus === "verified").length,
    },
  ];

  const handleAddOperator = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedOrg || newOpName.trim().length < 2) return;
    const targetCentre = newOpCentreId || selectedOrg.centres[0]?.id || "";
    const ok = await onRunAction(
      {
        action: "manage_operator",
        op: "add",
        accountId: selectedOrg.id,
        centreId: targetCentre,
        displayName: newOpName.trim(),
        role: newOpRole,
        pin: newOpPin.trim(),
      },
      `Provisioned operator "${newOpName.trim()}" on ${selectedOrg.orgName}`
    );
    if (ok) {
      setNewOpName("");
      setNewOpPin("4829");
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
      {/* Left: Compact Searchable Org Directory */}
      <div className={`xl:col-span-5 rounded-2xl border p-4 space-y-3 ${cardCls}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2
              className="text-base font-semibold tracking-tight"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              Organizations ({filtered.length})
            </h2>
            <p className={`text-[11px] ${mutedCls}`}>Pick any workspace to manage locks, branches, or staff.</p>
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search org, @user, region..."
            className={`w-full sm:w-52 h-8 px-3 rounded-lg border text-xs focus:outline-none focus:border-[#1039B9] ${inputCls}`}
          />
        </div>

        <div className="flex flex-wrap gap-1">
          {filterOptions.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                filter === item.key
                  ? "bg-[#1039B9] text-white"
                  : `border ${chipCls} hover:border-[#1039B9]/40`
              }`}
            >
              {item.label} <span className="font-mono opacity-80">({item.count})</span>
            </button>
          ))}
        </div>

        <div className="space-y-2 max-h-[680px] overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <div className={`rounded-xl border p-6 text-center text-xs ${chipCls} ${mutedCls}`}>
              No organizations match this filter.
            </div>
          ) : (
            filtered.map((org) => {
              const isSelected = selectedOrg?.id === org.id;
              const isHqLocked = org.hqLock?.locked;
              const isBillingLocked = org.accessLock.locked && org.accessLock.source === "billing";

              return (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => onSelectOrg(org.id)}
                  className={`w-full text-left rounded-xl border p-3.5 transition-all cursor-pointer ${
                    isSelected
                      ? "border-[#1039B9] ring-2 ring-[#1039B9]/15 " +
                        (isDark ? "bg-[#151D2C]" : "bg-[#F4F7FF]")
                      : `${chipCls} hover:border-[#1039B9]/40`
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-bold truncate">{org.orgName}</span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-500/10 text-[10px] font-mono uppercase">
                          {org.roleType}
                        </span>
                      </div>
                      <div className={`text-[11px] mt-0.5 truncate ${mutedCls}`}>
                        {org.fullName} &middot; {org.region}
                      </div>
                    </div>
                    {isHqLocked ? (
                      <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-700 dark:text-red-300 text-[10px] font-bold uppercase shrink-0">
                        HQ Lock
                      </span>
                    ) : isBillingLocked ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase shrink-0">
                        Billing
                      </span>
                    ) : org.subscriptionActive ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold uppercase shrink-0">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-[#1039B9] dark:text-sky-300 text-[10px] font-bold uppercase shrink-0">
                        Trial
                      </span>
                    )}
                  </div>

                  <div className={`grid grid-cols-3 gap-2 mt-2.5 pt-2 border-t border-slate-500/10 text-[11px] ${mutedCls}`}>
                    <span>
                      {org.centresCount}/{org.planMaxBranches ?? "unlim"} br &middot;{" "}
                      {org.profilesCount}/{org.planMaxOperators ?? "unlim"} st
                    </span>
                    <span className="font-mono tabular-nums text-current">
                      {formatTzs(org.salesRevenueTzs)}
                      {typeof org.subscriptionDaysLeft === "number" ? ` · ${org.subscriptionDaysLeft}d` : ""}
                    </span>
                    <span className={org.expiredCount > 0 ? "text-red-500 font-semibold" : ""}>
                      {org.expiredCount} exp / {org.nearExpiryCount} near
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right: Structured Inspector Panel with Sub-Tabs */}
      <div className={`xl:col-span-7 rounded-2xl border p-5 space-y-4 ${cardCls}`}>
        {!selectedOrg ? (
          <div className={`py-14 text-center text-xs ${mutedCls}`}>
            Select an organization to inspect branches, operators, and commands.
          </div>
        ) : (
          <>
            {/* Org Header */}
            <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-500/15">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#1039B9] dark:text-sky-400 font-bold">
                    {selectedOrg.id}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-500/10 text-[10px] font-mono">
                    {selectedOrg.subscriptionPlan}
                  </span>
                  {selectedOrg.verificationStatus === "verified" && (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                      Verified
                    </span>
                  )}
                </div>
                <h3
                  className="text-xl font-semibold tracking-tight mt-0.5"
                  style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                >
                  {selectedOrg.orgName}
                </h3>
                <p className={`text-xs mt-0.5 ${mutedCls}`}>
                  {selectedOrg.fullName} &middot; {selectedOrg.email} &middot; {selectedOrg.region}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onJumpToComposer(selectedOrg.id)}
                  className="px-3 py-1.5 rounded-lg bg-[#1039B9] text-white text-xs font-semibold hover:bg-[#0d2e94] cursor-pointer"
                >
                  Send Notice / SMS
                </button>
                <button
                  type="button"
                  onClick={() => onJumpToOrgEvents(selectedOrg.id)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${chipCls}`}
                >
                  Full Audit
                </button>
              </div>
            </div>

            {/* Sub-Tab Selector inside Inspector */}
            <div className={`flex flex-wrap gap-1.5 p-1 rounded-xl border ${chipCls}`}>
              {(
                [
                  { id: "controls", label: "Access & Plan" },
                  { id: "branches", label: `Branches & Commands (${selectedOrg.centresCount})` },
                  { id: "operators", label: `Operators & PINs (${selectedOrg.profilesCount})` },
                  { id: "audit", label: `Activity (${selectedOrgAudits.length})` },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setInspectorTab(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    inspectorTab === t.id
                      ? "bg-[#1039B9] text-white"
                      : `${mutedCls} hover:text-current`
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab 1: Access, Locks, Plan, Verification */}
            {inspectorTab === "controls" && (
              <div className="space-y-4">
                {selectedOrg.accessLock.locked ? (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase text-red-700 dark:text-red-300">
                        Locked ({selectedOrg.accessLock.source === "hq" ? "HQ Override" : "Billing Gate"})
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          onRunAction(
                            { action: "unlock_account", accountId: selectedOrg.id },
                            `Unlocked ${selectedOrg.orgName}`
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                      >
                        Unlock Workspace
                      </button>
                    </div>
                    <p className="text-xs text-red-700 dark:text-red-200">{selectedOrg.accessLock.reason}</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    <span>Access Open ({selectedOrg.subscriptionActive ? "Paid Plan Active" : "Trial Active"})</span>
                    <span className="font-mono">{selectedOrg.lang}</span>
                  </div>
                )}

                <div className={`rounded-xl border p-4 space-y-3 ${chipCls}`}>
                  <div className="text-xs font-bold uppercase tracking-wider">HQ Lock &amp; Billing Guard</div>
                  <input
                    type="text"
                    value={lockReason}
                    onChange={(e) => setLockReason(e.target.value)}
                    maxLength={220}
                    className={`w-full h-9 px-3 rounded-lg border text-xs ${inputCls}`}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {LOCK_REASON_PRESETS.map((preset, idx) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setLockReason(preset)}
                        className={`px-2 py-0.5 rounded-md border text-[10px] cursor-pointer ${cardCls}`}
                      >
                        Preset {idx + 1}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedOrg.hqLock?.locked ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          onRunAction(
                            { action: "unlock_account", accountId: selectedOrg.id },
                            `Released HQ lock on ${selectedOrg.orgName}`
                          )
                        }
                        className="h-9 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                      >
                        Release HQ Lock
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          onRunAction(
                            {
                              action: "lock_account",
                              accountId: selectedOrg.id,
                              reason: lockReason.trim() || LOCK_REASON_PRESETS[0],
                            },
                            `Locked ${selectedOrg.orgName}`
                          )
                        }
                        className="h-9 rounded-lg bg-red-600 text-white text-xs font-semibold cursor-pointer"
                      >
                        Engage HQ Lock
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        onRunAction(
                          {
                            action: "set_billing_overdue",
                            accountId: selectedOrg.id,
                            overdue: !selectedOrg.billingOverdue,
                            restoreSubscription: selectedOrg.billingOverdue,
                          },
                          selectedOrg.billingOverdue
                            ? `Cleared overdue billing on ${selectedOrg.orgName}`
                            : `Marked billing overdue on ${selectedOrg.orgName}`
                        )
                      }
                      className={`h-9 rounded-lg border text-xs font-semibold cursor-pointer ${
                        selectedOrg.billingOverdue
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      }`}
                    >
                      {selectedOrg.billingOverdue ? "Clear Billing Overdue" : "Mark Billing Overdue"}
                    </button>
                  </div>
                </div>

                <div className={`rounded-xl border p-4 space-y-3 ${chipCls}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Subscription &amp; Verification</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          selectedOrg.verificationStatus === "verified"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        }`}
                      >
                        {selectedOrg.verificationStatus === "verified" ? "Verified" : "Unverified"}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          onRunAction(
                            {
                              action: "toggle_network_verify",
                              accountId: selectedOrg.id,
                              verified: true,
                              note: verifyNote.trim() || undefined,
                            },
                            `Marked ${selectedOrg.orgName} verified`
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                      >
                        Mark Verified
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          onRunAction(
                            {
                              action: "toggle_network_verify",
                              accountId: selectedOrg.id,
                              verified: false,
                              note: verifyNote.trim() || undefined,
                            },
                            `Marked ${selectedOrg.orgName} unverified`
                          )
                        }
                        className="px-2.5 py-1 rounded-lg border border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-300 text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                      >
                        Mark Unverified
                      </button>
                    </div>
                  </div>

                  {/* Uploaded Compliance Proofs & Permit Documents */}
                  <div className={`rounded-lg border p-3 space-y-2 ${cardCls}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider">
                        Uploaded Compliance Proofs ({selectedOrg.certificates.length})
                      </span>
                      {selectedOrg.certificates.length === 0 && (
                        <button
                          type="button"
                          onClick={() => setInspectedProof({ org: selectedOrg, cert: null })}
                          className="text-[11px] font-semibold text-[#1039B9] dark:text-sky-400 hover:underline cursor-pointer"
                        >
                          Inspect Record &rarr;
                        </button>
                      )}
                    </div>

                    {selectedOrg.certificates.length === 0 ? (
                      <div className={`text-xs ${mutedCls}`}>
                        No operating permit or compliance proof uploaded by this organization yet.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedOrg.certificates.map((cert) => {
                          const certStatus =
                            cert.status ??
                            (selectedOrg.verificationStatus === "verified" ? "verified" : "pending");
                          return (
                            <div
                              key={cert.id}
                              className={`p-2.5 rounded-lg border flex flex-wrap items-center justify-between gap-2 text-xs ${chipCls}`}
                            >
                              <div className="min-w-0">
                                <div className="font-bold flex flex-wrap items-center gap-1.5">
                                  <span>{cert.docType}</span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold ${
                                      certStatus === "verified"
                                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                        : certStatus === "rejected"
                                          ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                                          : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                    }`}
                                  >
                                    {certStatus}
                                  </span>
                                </div>
                                <div className={`text-[11px] font-mono ${mutedCls}`}>
                                  {cert.licenseNumber} &middot; {cert.fileName} &middot; {cert.uploadedAt.slice(0, 10)}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => void downloadCertificateProof(selectedOrg, cert)}
                                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer ${chipCls}`}
                                  title={cert.fileDataUrl ? `Download ${cert.fileName}` : "Download inspection sheet"}
                                >
                                  Download
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setInspectedProof({ org: selectedOrg, cert })}
                                  className="px-2.5 py-1 rounded-lg bg-[#1039B9] text-white text-[11px] font-semibold cursor-pointer"
                                >
                                  View / Read Proof
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <input
                      type="text"
                      value={verifyNote}
                      onChange={(e) => setVerifyNote(e.target.value)}
                      maxLength={240}
                      placeholder="Optional compliance review note / rejection reason..."
                      className={`w-full h-8 px-2.5 rounded-lg border text-xs ${inputCls}`}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <select
                      value={customPlan || selectedOrg.subscriptionPlan}
                      onChange={(e) => setCustomPlan(e.target.value)}
                      className={`flex-1 min-w-[160px] h-9 px-3 rounded-lg border text-xs ${inputCls}`}
                    >
                      {!planChoices.includes(selectedOrg.subscriptionPlan) && (
                        <option value={selectedOrg.subscriptionPlan}>{selectedOrg.subscriptionPlan}</option>
                      )}
                      {planChoices.map((plan) => (
                        <option key={plan} value={plan}>
                          {plan}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        onRunAction(
                          {
                            action: "update_subscription",
                            accountId: selectedOrg.id,
                            subscriptionPlan: customPlan || selectedOrg.subscriptionPlan,
                            subscriptionActive: true,
                          },
                          `Activated ${customPlan || selectedOrg.subscriptionPlan} for ${selectedOrg.orgName}`
                        )
                      }
                      className="h-9 px-3 rounded-lg bg-[#1039B9] text-white text-xs font-semibold cursor-pointer"
                    >
                      Activate Plan
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        onRunAction(
                          {
                            action: "update_subscription",
                            accountId: selectedOrg.id,
                            extendTrialDays: 14,
                          },
                          `Extended trial +14d for ${selectedOrg.orgName}`
                        )
                      }
                      className={`h-9 px-3 rounded-lg border text-xs font-semibold cursor-pointer ${cardCls}`}
                    >
                      +14d Trial
                    </button>
                  </div>
                </div>

                {/* Owner-Configured Kasri Payout / Settlement Channels */}
                <div className={`rounded-xl border p-4 space-y-2 ${chipCls}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider">Kasri Settlement Channels</span>
                    <span className={`text-[10px] font-mono ${mutedCls}`}>
                      {selectedOrg.paymentSettings
                        ? `Cycle: ${selectedOrg.paymentSettings.settlementCycle}${selectedOrg.paymentSettings.vatRegistered ? " · VAT Reg" : ""}`
                        : "Unconfigured"}
                    </span>
                  </div>
                  {!selectedOrg.paymentSettings ? (
                    <p className={`text-xs ${mutedCls}`}>
                      Owner has not configured payout wallets or bank account yet.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div className={`p-2.5 rounded-lg border ${cardCls}`}>
                        <div className={`text-[10px] uppercase ${mutedCls}`}>M-Pesa Paybill / Till</div>
                        <div className="font-mono font-semibold mt-0.5">
                          {selectedOrg.paymentSettings.mpesaPaybill || "Not set"}
                        </div>
                      </div>
                      <div className={`p-2.5 rounded-lg border ${cardCls}`}>
                        <div className={`text-[10px] uppercase ${mutedCls}`}>Tigo / Mixx Lipa</div>
                        <div className="font-mono font-semibold mt-0.5">
                          {selectedOrg.paymentSettings.tigoLipaNumber || "Not set"}
                        </div>
                      </div>
                      <div className={`p-2.5 rounded-lg border ${cardCls}`}>
                        <div className={`text-[10px] uppercase ${mutedCls}`}>Bank Settlement</div>
                        <div className="font-semibold mt-0.5 truncate">
                          {selectedOrg.paymentSettings.bankName
                            ? `${selectedOrg.paymentSettings.bankName} · ${selectedOrg.paymentSettings.bankAccount}`
                            : selectedOrg.paymentSettings.bankAccount || "Not set"}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Branches & Desktop Terminal Commands */}
            {inspectorTab === "branches" && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={branchCmdReason}
                  onChange={(e) => setBranchCmdReason(e.target.value)}
                  placeholder="Optional command reason / note for branch desktop agent..."
                  className={`w-full h-9 px-3 rounded-lg border text-xs ${inputCls}`}
                />
                <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                  {selectedOrg.centres.map((ctr) => (
                    <div key={ctr.id} className={`rounded-xl border p-3.5 space-y-2.5 ${chipCls}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-bold flex flex-wrap items-center gap-1.5">
                            <span>{ctr.name}</span>
                            {ctr.isPrimary && (
                              <span className="px-1.5 py-0.5 rounded bg-[#1039B9]/15 text-[#1039B9] dark:text-sky-300 text-[9px]">
                                PRIMARY
                              </span>
                            )}
                            {ctr.status === "paused" && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[9px]">
                                PAUSED
                              </span>
                            )}
                            {ctr.status === "archived" && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-600 dark:text-slate-300 text-[9px]">
                                ARCHIVED
                              </span>
                            )}
                            {ctr.excludedFromRollup && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300 text-[9px]">
                                EXCLUDED
                              </span>
                            )}
                          </div>
                          <div className={`text-[11px] ${mutedCls}`}>
                            {ctr.address}, {ctr.region} &middot; {ctr.staffCount} staff &middot; {ctr.phone}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            onRunAction(
                              {
                                action: "branch_command",
                                accountId: selectedOrg.id,
                                centreId: ctr.id,
                                cmd: "force_sync",
                                reason: branchCmdReason.trim() || undefined,
                              },
                              `Queued force_sync for ${ctr.name}`
                            )
                          }
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer ${cardCls}`}
                        >
                          Force Sync
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            onRunAction(
                              {
                                action: "branch_command",
                                accountId: selectedOrg.id,
                                centreId: ctr.id,
                                cmd: ctr.status === "paused" || ctr.status === "archived" ? "resume_branch" : "pause_branch",
                                reason: branchCmdReason.trim() || undefined,
                              },
                              ctr.status === "paused" || ctr.status === "archived"
                                ? `Resumed branch ${ctr.name}`
                                : `Paused branch ${ctr.name}`
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[11px] font-semibold cursor-pointer"
                        >
                          {ctr.status === "paused" || ctr.status === "archived" ? "Resume Branch" : "Pause Branch"}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            onRunAction(
                              {
                                action: "branch_command",
                                accountId: selectedOrg.id,
                                centreId: ctr.id,
                                cmd: "toggle_exclude_branch",
                                reason: branchCmdReason.trim() || undefined,
                              },
                              `${ctr.excludedFromRollup ? "Included" : "Excluded"} ${ctr.name}`
                            )
                          }
                          className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer ${cardCls}`}
                        >
                          {ctr.excludedFromRollup ? "Include in Totals" : "Exclude from Totals"}
                        </button>
                        {ctr.status !== "archived" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              onRunAction(
                                {
                                  action: "branch_command",
                                  accountId: selectedOrg.id,
                                  centreId: ctr.id,
                                  cmd: "archive_branch",
                                  reason: branchCmdReason.trim() || "Archived by HQ",
                                },
                                `Archived branch ${ctr.name}`
                              )
                            }
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer ${cardCls}`}
                          >
                            Archive
                          </button>
                        )}
                        {!ctr.isPrimary && selectedOrg.centres.length > 1 && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              onRunAction(
                                {
                                  action: "branch_command",
                                  accountId: selectedOrg.id,
                                  centreId: ctr.id,
                                  cmd: "delete_branch",
                                  reason: branchCmdReason.trim() || "Deleted by HQ",
                                },
                                `Deleted branch ${ctr.name}`
                              )
                            }
                            className="px-2.5 py-1 rounded-lg bg-red-500/15 text-red-700 dark:text-red-300 text-[11px] font-semibold cursor-pointer"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 3: Operators & Terminal PIN Management */}
            {inspectorTab === "operators" && (
              <div className="space-y-4">
                <form onSubmit={handleAddOperator} className={`rounded-xl border p-3.5 space-y-2.5 ${chipCls}`}>
                  <div className="text-xs font-bold uppercase tracking-wider">Provision New Operator</div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input
                      type="text"
                      value={newOpName}
                      onChange={(e) => setNewOpName(e.target.value)}
                      placeholder="Full name"
                      required
                      className={`h-8 px-2.5 rounded-lg border text-xs ${inputCls}`}
                    />
                    <select
                      value={newOpCentreId || selectedOrg.centres[0]?.id || ""}
                      onChange={(e) => setNewOpCentreId(e.target.value)}
                      className={`h-8 px-2 rounded-lg border text-xs ${inputCls}`}
                    >
                      {selectedOrg.centres.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={newOpRole}
                      onChange={(e) => setNewOpRole(e.target.value)}
                      className={`h-8 px-2 rounded-lg border text-xs ${inputCls}`}
                    >
                      {OPERATOR_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={newOpPin}
                        onChange={(e) => setNewOpPin(e.target.value)}
                        placeholder="PIN (4-6 digits)"
                        maxLength={6}
                        className={`w-24 h-8 px-2 rounded-lg border font-mono text-xs ${inputCls}`}
                      />
                      <button
                        type="submit"
                        disabled={busy}
                        className="flex-1 h-8 px-3 rounded-lg bg-[#1039B9] text-white text-xs font-semibold cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </form>

                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {selectedOrg.profiles.map((prof) => {
                    const pinVal = pinDrafts[prof.id] ?? "";
                    return (
                      <div
                        key={prof.id}
                        className={`rounded-xl border p-3 flex flex-wrap items-center justify-between gap-2 text-xs ${chipCls}`}
                      >
                        <div className="min-w-0">
                          <div className="font-bold">
                            {prof.displayName}{" "}
                            {prof.isMasterAdmin && (
                              <span className="ml-1 px-1.5 py-0.5 rounded bg-blue-500/15 text-[#1039B9] dark:text-sky-300 text-[9px]">
                                OWNER
                              </span>
                            )}
                          </div>
                          <div className={`text-[11px] font-mono ${mutedCls}`}>
                            @{prof.username || "staff"} &middot;{" "}
                            {selectedOrg.centres.find((c) => c.id === prof.centreId)?.name || prof.centreId}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <select
                            value={prof.role}
                            disabled={busy}
                            onChange={(e) =>
                              void onRunAction(
                                {
                                  action: "manage_operator",
                                  op: "set_role",
                                  accountId: selectedOrg.id,
                                  profileId: prof.id,
                                  role: e.target.value,
                                },
                                `Updated role for ${prof.displayName}`
                              )
                            }
                            className={`h-7 px-2 rounded-lg border text-[11px] ${inputCls}`}
                          >
                            {OPERATOR_ROLES.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>

                          <input
                            type="text"
                            value={pinVal}
                            onChange={(e) =>
                              setPinDrafts((prev) => ({ ...prev, [prof.id]: e.target.value }))
                            }
                            placeholder="New PIN"
                            maxLength={6}
                            className={`w-20 h-7 px-2 rounded-lg border font-mono text-[11px] ${inputCls}`}
                          />
                          <button
                            type="button"
                            disabled={busy || pinVal.length < 4}
                            onClick={() =>
                              void onRunAction(
                                {
                                  action: "manage_operator",
                                  op: "reset_pin",
                                  accountId: selectedOrg.id,
                                  profileId: prof.id,
                                  pin: pinVal,
                                },
                                `Reset PIN for ${prof.displayName}`
                              )
                            }
                            className={`h-7 px-2 rounded-lg border text-[11px] font-semibold disabled:opacity-40 cursor-pointer ${cardCls}`}
                          >
                            Set PIN
                          </button>

                          {!prof.isMasterAdmin && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void onRunAction(
                                  {
                                    action: "manage_operator",
                                    op: "remove",
                                    accountId: selectedOrg.id,
                                    profileId: prof.id,
                                  },
                                  `Removed operator ${prof.displayName}`
                                )
                              }
                              className="h-7 px-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 text-[11px] font-semibold cursor-pointer"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tab 4: Org Activity */}
            {inspectorTab === "audit" && (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {selectedOrgAudits.length === 0 ? (
                  <div className={`text-xs ${mutedCls}`}>No events recorded for this organization yet.</div>
                ) : (
                  selectedOrgAudits.map((ev) => (
                    <div
                      key={ev.id}
                      className={`rounded-xl border px-3 py-2 text-xs flex items-center justify-between gap-2 ${chipCls}`}
                    >
                      <div className="min-w-0 truncate">
                        <span className="font-mono text-[10px] font-bold mr-2 opacity-80">{ev.category}</span>
                        <span>{ev.action}</span>
                      </div>
                      <span className={`font-mono text-[10px] shrink-0 ${mutedCls}`}>
                        {ev.createdAt.slice(5, 16).replace("T", " ")}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      {inspectedProof && (
        <ComplianceProofViewerModal
          org={inspectedProof.org}
          certificate={inspectedProof.cert}
          isDark={isDark}
          busy={busy}
          onClose={() => setInspectedProof(null)}
          onVerifyDecision={async (verified, note, certificateId) => {
            const ok = await onRunAction(
              {
                action: "toggle_network_verify",
                accountId: inspectedProof.org.id,
                verified,
                certificateId,
                note: note || undefined,
              },
              verified
                ? `Verified compliance proof for ${inspectedProof.org.orgName}`
                : `Marked ${inspectedProof.org.orgName} unverified`
            );
            if (ok) setInspectedProof(null);
          }}
        />
      )}
    </div>
  );
}
