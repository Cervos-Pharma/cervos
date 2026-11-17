"use client";

import { useMemo, useState } from "react";
import { COMMERCIAL_PLAN_CATALOG, formatTzs } from "@cervos/core";
import type { HqAuditEvent, HqFleetAccount } from "./types";

interface HQFleetSectionProps {
  accounts: HqFleetAccount[];
  auditLogs: HqAuditEvent[];
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

const LOCK_REASON_PRESETS = [
  "Compliance permit renewal required pending TMDA inspection.",
  "Controlled substance dispensing audit hold initiated by HQ.",
  "Unusual POS void or stock discrepancy flagged for owner review.",
];

export default function HQFleetSection({
  accounts,
  auditLogs,
  selectedOrgId,
  onSelectOrg,
  onRunAction,
  onJumpToComposer,
  onJumpToOrgEvents,
  isDark,
  busy,
}: HQFleetSectionProps) {
  const [filter, setFilter] = useState<FleetFilter>("all");
  const [query, setQuery] = useState("");
  const [lockReason, setLockReason] = useState(LOCK_REASON_PRESETS[0]);
  const [customPlan, setCustomPlan] = useState("");

  const cardCls = isDark
    ? "bg-[#11161F] border-slate-800 text-slate-100"
    : "bg-white border-[#EAECF0] text-[#111317]";
  const chipCls = isDark
    ? "bg-[#171D28] border-slate-800 text-slate-200"
    : "bg-[#F8FAFC] border-[#EAECF0] text-[#111317]";
  const inputCls = isDark
    ? "bg-[#090C12] border-slate-700 text-slate-100 placeholder:text-slate-500"
    : "bg-[#F8FAFC] border-[#CBD5E1] text-[#111317] placeholder:text-slate-400";
  const mutedCls = isDark ? "text-slate-400" : "text-[#64748B]";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return accounts.filter((a) => {
      if (filter === "active" && (a.accessLock.locked || !a.subscriptionActive)) return false;
      if (filter === "trial" && (a.accessLock.locked || a.subscriptionActive)) return false;
      if (filter === "locked" && !a.accessLock.locked) return false;
      if (filter === "overdue" && !a.billingOverdue) return false;
      if (filter === "verified" && a.verificationStatus !== "verified") return false;
      if (!q) return true;
      return (
        a.orgName.toLowerCase().includes(q) ||
        a.fullName.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        (a.username ?? "").toLowerCase().includes(q) ||
        a.region.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q)
      );
    });
  }, [accounts, filter, query]);

  const selectedOrg = useMemo(
    () => accounts.find((a) => a.id === selectedOrgId) ?? filtered[0] ?? accounts[0] ?? null,
    [accounts, filtered, selectedOrgId]
  );

  const selectedOrgAudits = useMemo(
    () =>
      selectedOrg
        ? auditLogs.filter((l) => l.accountId === selectedOrg.id).slice(0, 6)
        : [],
    [auditLogs, selectedOrg]
  );

  const filterOptions: Array<{ key: FleetFilter; label: string; count: number }> = [
    { key: "all", label: "All Orgs", count: accounts.length },
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

  const planChoices = COMMERCIAL_PLAN_CATALOG.map((p) => p.name);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
      {/* Left: Fleet Roster */}
      <div className={`xl:col-span-7 rounded-[24px] border p-5 space-y-4 ${cardCls}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2
              className="text-lg font-semibold tracking-tight"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              Organization Fleet Oversight
            </h2>
            <p className={`text-xs ${mutedCls}`}>
              Select any pharmacy or supplier organization to inspect branches, operators, stock
              risk, and enforce HQ or billing controls.
            </p>
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search org, owner, @user, region..."
            className={`w-full sm:w-64 h-9 px-3.5 rounded-full border text-xs focus:outline-none focus:border-[#1039B9] ${inputCls}`}
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {filterOptions.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                filter === item.key
                  ? "bg-[#1039B9] text-white"
                  : `border ${chipCls} hover:border-[#1039B9]/40`
              }`}
            >
              {item.label}{" "}
              <span className="font-mono text-[11px] opacity-80">({item.count})</span>
            </button>
          ))}
        </div>

        <div className="space-y-2.5 max-h-[680px] overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <div className={`rounded-2xl border p-8 text-center text-xs ${chipCls} ${mutedCls}`}>
              No organizations match the current filter.
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
                  className={`w-full text-left rounded-2xl border p-4 transition-all cursor-pointer ${
                    isSelected
                      ? "border-[#1039B9] ring-2 ring-[#1039B9]/15 " +
                        (isDark ? "bg-[#151D2C]" : "bg-[#F4F7FF]")
                      : `${chipCls} hover:border-[#1039B9]/40`
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold truncate">{org.orgName}</span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-500/10 text-[10px] font-mono uppercase">
                          {org.roleType}
                        </span>
                        {org.verificationStatus === "verified" && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                            Verified
                          </span>
                        )}
                      </div>
                      <div className={`text-xs mt-1 truncate ${mutedCls}`}>
                        {org.fullName} ({org.username ? `@${org.username}` : org.email}) &middot;{" "}
                        {org.region}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      {isHqLocked ? (
                        <span className="px-2.5 py-1 rounded-full bg-red-500/15 text-red-700 dark:text-red-300 text-[10px] font-bold uppercase">
                          HQ Locked
                        </span>
                      ) : isBillingLocked ? (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase">
                          Billing Lock
                        </span>
                      ) : org.subscriptionActive ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold uppercase">
                          Active
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-blue-500/15 text-[#1039B9] dark:text-[#38BDF8] text-[10px] font-bold uppercase">
                          Trial
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs">
                    <div className={`rounded-xl border px-2.5 py-2 ${cardCls}`}>
                      <div className={`text-[10px] uppercase font-semibold ${mutedCls}`}>
                        Branches / Staff
                      </div>
                      <div className="font-bold tabular-nums mt-0.5">
                        {org.centresCount} / {org.profilesCount}
                      </div>
                    </div>
                    <div className={`rounded-xl border px-2.5 py-2 ${cardCls}`}>
                      <div className={`text-[10px] uppercase font-semibold ${mutedCls}`}>
                        Sales ({org.salesCount})
                      </div>
                      <div className="font-bold tabular-nums mt-0.5">
                        {formatTzs(org.salesRevenueTzs)}
                      </div>
                    </div>
                    <div className={`rounded-xl border px-2.5 py-2 ${cardCls}`}>
                      <div className={`text-[10px] uppercase font-semibold ${mutedCls}`}>
                        Stock Cost
                      </div>
                      <div className="font-bold tabular-nums mt-0.5">
                        {formatTzs(org.stockValueAtCostTzs)}
                      </div>
                    </div>
                    <div className={`rounded-xl border px-2.5 py-2 ${cardCls}`}>
                      <div className={`text-[10px] uppercase font-semibold ${mutedCls}`}>
                        FEFO Risk
                      </div>
                      <div className="font-bold tabular-nums mt-0.5">
                        <span className={org.expiredCount > 0 ? "text-red-600 dark:text-red-400" : ""}>
                          {org.expiredCount} exp
                        </span>{" "}
                        &middot;{" "}
                        <span className={org.nearExpiryCount > 0 ? "text-amber-600 dark:text-amber-400" : ""}>
                          {org.nearExpiryCount} near
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right: Deep Org Inspector & Governance Controls */}
      <div className={`xl:col-span-5 rounded-[24px] border p-5 space-y-5 ${cardCls}`}>
        {!selectedOrg ? (
          <div className={`py-12 text-center text-xs ${mutedCls}`}>
            Select an organization from the fleet list to inspect controls.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-500/15">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-[#1039B9] dark:text-[#38BDF8] font-bold">
                  {selectedOrg.id}
                </div>
                <h3
                  className="text-xl font-semibold tracking-tight mt-0.5"
                  style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                >
                  {selectedOrg.orgName}
                </h3>
                <p className={`text-xs mt-0.5 ${mutedCls}`}>
                  Owner: {selectedOrg.fullName} &middot; {selectedOrg.email} &middot; Plan:{" "}
                  <span className="font-semibold text-current">{selectedOrg.subscriptionPlan}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onJumpToComposer(selectedOrg.id)}
                  className="px-3 py-1.5 rounded-full bg-[#1039B9] text-white text-xs font-semibold hover:bg-[#0d2e94] transition-colors cursor-pointer"
                >
                  Message Org
                </button>
                <button
                  type="button"
                  onClick={() => onJumpToOrgEvents(selectedOrg.id)}
                  className={`px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer ${chipCls}`}
                >
                  Audit Trail
                </button>
              </div>
            </div>

            {/* Access Lock Status Banner */}
            {selectedOrg.accessLock.locked ? (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-300">
                    Access Locked ({selectedOrg.accessLock.source === "hq" ? "Manual HQ Override" : "Billing / Trial Gate"})
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      onRunAction(
                        { action: "unlock_account", accountId: selectedOrg.id },
                        `Workspace unlocked for ${selectedOrg.orgName}`
                      )
                    }
                    className="px-3 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                  >
                    Unlock Workspace
                  </button>
                </div>
                <p className="text-xs text-red-700 dark:text-red-200 leading-relaxed">
                  {selectedOrg.accessLock.reason}
                </p>
                {selectedOrg.hqLock?.lockedAt && (
                  <div className="text-[11px] font-mono text-red-600/80 dark:text-red-300/80">
                    By {selectedOrg.hqLock.lockedBy} at{" "}
                    {selectedOrg.hqLock.lockedAt.slice(0, 16).replace("T", " ")}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  Operational Access: Open ({selectedOrg.subscriptionActive ? "Paid Plan Active" : "Trial Window"})
                </div>
                <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300">
                  {selectedOrg.lang}
                </span>
              </div>
            )}

            {/* Manual HQ Lock & Billing Overdue Controls */}
            <div className={`rounded-2xl border p-4 space-y-3 ${chipCls}`}>
              <div className="text-[11px] font-bold uppercase tracking-wider">
                HQ Override &amp; Billing Enforcement
              </div>

              <div className="space-y-2">
                <label className={`block text-[10px] font-bold uppercase ${mutedCls}`}>
                  Manual Lock Audit Reason (pushes critical notice to /app)
                </label>
                <input
                  type="text"
                  value={lockReason}
                  onChange={(e) => setLockReason(e.target.value)}
                  maxLength={220}
                  className={`w-full h-9 px-3 rounded-xl border text-xs focus:outline-none focus:border-[#1039B9] ${inputCls}`}
                />
                <div className="flex flex-wrap gap-1.5">
                  {LOCK_REASON_PRESETS.map((preset, idx) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setLockReason(preset)}
                      className={`px-2 py-0.5 rounded-full border text-[10px] cursor-pointer ${cardCls}`}
                    >
                      Preset {idx + 1}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {selectedOrg.hqLock?.locked ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      onRunAction(
                        { action: "unlock_account", accountId: selectedOrg.id },
                        `Manual HQ lock released for ${selectedOrg.orgName}`
                      )
                    }
                    className="h-9 px-3 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                  >
                    Release Manual HQ Lock
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
                        `Manual HQ lock activated on ${selectedOrg.orgName}`
                      )
                    }
                    className="h-9 px-3 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 cursor-pointer"
                  >
                    Engage Manual HQ Lock
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
                        ? `Cleared billing overdue lock for ${selectedOrg.orgName}`
                        : `Engaged billing overdue lock on ${selectedOrg.orgName}`
                    )
                  }
                  className={`h-9 px-3 rounded-xl border text-xs font-semibold disabled:opacity-50 cursor-pointer ${
                    selectedOrg.billingOverdue
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  }`}
                >
                  {selectedOrg.billingOverdue ? "Clear Billing Overdue" : "Mark Billing Overdue"}
                </button>
              </div>
            </div>

            {/* Plan, Trial & Verification Controls */}
            <div className={`rounded-2xl border p-4 space-y-3 ${chipCls}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">
                  Plan, Trial &amp; Compliance Verification
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    onRunAction(
                      {
                        action: "toggle_network_verify",
                        accountId: selectedOrg.id,
                        verified: selectedOrg.verificationStatus !== "verified",
                      },
                      selectedOrg.verificationStatus === "verified"
                        ? `Paused network verification for ${selectedOrg.orgName}`
                        : `Verified license and unlocked Kasri network for ${selectedOrg.orgName}`
                    )
                  }
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer ${
                    selectedOrg.verificationStatus === "verified"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-slate-500/15 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {selectedOrg.verificationStatus === "verified"
                    ? "Verified (Click to Pause)"
                    : "Unverified (Click to Verify)"}
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <select
                  value={customPlan || selectedOrg.subscriptionPlan}
                  onChange={(e) => setCustomPlan(e.target.value)}
                  className={`flex-1 min-w-[160px] h-9 px-3 rounded-xl border text-xs ${inputCls}`}
                >
                  {!planChoices.includes(selectedOrg.subscriptionPlan) && (
                    <option value={selectedOrg.subscriptionPlan}>
                      {selectedOrg.subscriptionPlan}
                    </option>
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
                  className="h-9 px-3 rounded-xl bg-[#1039B9] text-white text-xs font-semibold hover:bg-[#0d2e94] disabled:opacity-50 cursor-pointer"
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
                      `Extended trial window by 14 days for ${selectedOrg.orgName}`
                    )
                  }
                  className={`h-9 px-3 rounded-xl border text-xs font-semibold cursor-pointer ${cardCls}`}
                >
                  +14d Trial
                </button>
              </div>
            </div>

            {/* Branches & Staff Roster */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider">
                Branches ({selectedOrg.centresCount}) &amp; Operators ({selectedOrg.profilesCount})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selectedOrg.centres.map((ctr) => (
                  <div key={ctr.id} className={`rounded-xl border p-3 text-xs ${chipCls}`}>
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold truncate">{ctr.name}</span>
                      {ctr.isPrimary && (
                        <span className="px-1.5 py-0.5 rounded bg-[#1039B9]/10 text-[#1039B9] dark:text-[#38BDF8] text-[9px] font-bold">
                          HQ
                        </span>
                      )}
                    </div>
                    <div className={`text-[11px] mt-0.5 truncate ${mutedCls}`}>
                      {ctr.address}, {ctr.region}
                    </div>
                    <div className="text-[10px] font-mono mt-1 opacity-80">
                      {ctr.staffCount} assigned staff &middot; {ctr.phone}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {selectedOrg.profiles.map((prof) => (
                  <span
                    key={prof.id}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] ${chipCls}`}
                  >
                    <span className="font-semibold">{prof.displayName}</span>
                    {prof.username && (
                      <span className={`font-mono text-[10px] ${mutedCls}`}>@{prof.username}</span>
                    )}
                    <span className="px-1.5 py-0.2 rounded bg-slate-500/10 text-[9px] font-mono">
                      {prof.role}
                    </span>
                  </span>
                ))}
              </div>
            </div>

            {/* Operational Snapshot */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className={`rounded-xl border p-2.5 ${chipCls}`}>
                <div className={`text-[10px] uppercase ${mutedCls}`}>Wholesale</div>
                <div className="font-bold tabular-nums mt-0.5">
                  {selectedOrg.wholesaleOrdersCount} POs
                </div>
                <div className={`text-[10px] ${mutedCls}`}>
                  {selectedOrg.escrowHeldCount} in escrow
                </div>
              </div>
              <div className={`rounded-xl border p-2.5 ${chipCls}`}>
                <div className={`text-[10px] uppercase ${mutedCls}`}>Expenses</div>
                <div className="font-bold tabular-nums mt-0.5">
                  {formatTzs(selectedOrg.expensesTotalTzs)}
                </div>
                <div className={`text-[10px] ${mutedCls}`}>
                  {selectedOrg.lowStockCount} low stock
                </div>
              </div>
              <div className={`rounded-xl border p-2.5 ${chipCls}`}>
                <div className={`text-[10px] uppercase ${mutedCls}`}>Inbox / Joins</div>
                <div className="font-bold tabular-nums mt-0.5">
                  {selectedOrg.unacknowledgedHqMessagesCount} unread
                </div>
                <div className={`text-[10px] ${mutedCls}`}>
                  {selectedOrg.pendingJoinRequestsCount} join reqs
                </div>
              </div>
            </div>

            {/* Recent Audit Events for Org */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider">
                  Recent Audit Events ({selectedOrg.auditEventsCount})
                </span>
                <button
                  type="button"
                  onClick={() => onJumpToOrgEvents(selectedOrg.id)}
                  className="text-[11px] font-semibold text-[#1039B9] dark:text-[#38BDF8] hover:underline cursor-pointer"
                >
                  Filter in Explorer &rarr;
                </button>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {selectedOrgAudits.length === 0 ? (
                  <div className={`text-xs ${mutedCls}`}>No audit events recorded yet.</div>
                ) : (
                  selectedOrgAudits.map((ev) => (
                    <div
                      key={ev.id}
                      className={`rounded-xl border px-3 py-2 text-xs flex items-center justify-between gap-2 ${chipCls}`}
                    >
                      <div className="min-w-0 truncate">
                        <span className="font-mono text-[10px] font-bold mr-2 opacity-80">
                          {ev.category}
                        </span>
                        <span>{ev.action}</span>
                      </div>
                      <span className={`font-mono text-[10px] shrink-0 ${mutedCls}`}>
                        {ev.createdAt.slice(5, 16).replace("T", " ")}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
