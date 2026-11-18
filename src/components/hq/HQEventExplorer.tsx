"use client";

import { useMemo, useState, type FormEvent } from "react";
import { matchesSearch } from "@/lib/search";
import type { AuditCategory, HqAuditEvent, HqFleetAccount } from "./types";

interface HQEventExplorerProps {
  auditLogs: HqAuditEvent[];
  categoryCounts: Record<AuditCategory, number>;
  accounts: HqFleetAccount[];
  orgFilter: string;
  onOrgFilterChange: (accountId: string) => void;
  onRunAction: (
    payload: Record<string, unknown>,
    successMessage: string
  ) => Promise<boolean>;
  isDark: boolean;
  busy: boolean;
}

const CATEGORIES: AuditCategory[] = [
  "AUTH",
  "SETUP",
  "SECURITY",
  "POS",
  "COMPLIANCE",
  "BILLING",
];

const CATEGORY_STYLE: Record<AuditCategory, string> = {
  AUTH: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  SETUP: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
  SECURITY: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  POS: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  COMPLIANCE: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
  BILLING: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
};

function csvEscape(val: string): string {
  const safe = /^[=+\-@\t\r]/.test(val) ? `'${val}` : val;
  return `"${safe.replace(/"/g, '""')}"`;
}

export default function HQEventExplorer({
  auditLogs,
  categoryCounts,
  accounts,
  orgFilter,
  onOrgFilterChange,
  onRunAction,
  isDark,
  busy,
}: HQEventExplorerProps) {
  const [catFilter, setCatFilter] = useState<"ALL" | AuditCategory>("ALL");
  const [search, setSearch] = useState("");
  const [logOrgId, setLogOrgId] = useState(accounts[0]?.id ?? "");
  const [logCategory, setLogCategory] = useState<AuditCategory>("COMPLIANCE");
  const [logNote, setLogNote] = useState("");

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
    return auditLogs.filter((entry) => {
      if (catFilter !== "ALL" && entry.category !== catFilter) return false;
      if (orgFilter !== "ALL" && entry.accountId !== orgFilter) return false;
      return matchesSearch(
        search,
        entry.action,
        entry.actor,
        entry.orgName,
        entry.category,
        entry.region
      );
    });
  }, [auditLogs, catFilter, orgFilter, search]);

  const handleExportCsv = () => {
    const headers = ["Timestamp", "Category", "Organization", "Region", "Actor", "Action", "EventID"];
    const rows = filtered.map((ev) =>
      [
        csvEscape(ev.createdAt),
        csvEscape(ev.category),
        csvEscape(ev.orgName),
        csvEscape(ev.region),
        csvEscape(ev.actor),
        csvEscape(ev.action),
        csvEscape(ev.id),
      ].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cervos-hq-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRecordAudit = async (e: FormEvent) => {
    e.preventDefault();
    const targetId = logOrgId || accounts[0]?.id;
    if (!targetId || logNote.trim().length < 4) return;
    const ok = await onRunAction(
      {
        action: "log_audit_event",
        accountId: targetId,
        category: logCategory,
        auditAction: logNote.trim(),
      },
      `Recorded ${logCategory} audit note`
    );
    if (ok) {
      setLogNote("");
    }
  };

  return (
    <div className="space-y-5">
      {/* Category KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <button
          type="button"
          onClick={() => setCatFilter("ALL")}
          className={`rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
            catFilter === "ALL"
              ? "border-[#1039B9] ring-2 ring-[#1039B9]/15 " + cardCls
              : chipCls
          }`}
        >
          <div className={`text-[10px] font-bold uppercase tracking-wider ${mutedCls}`}>
            All Events
          </div>
          <div className="text-xl font-bold tabular-nums mt-1">{auditLogs.length}</div>
        </button>

        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCatFilter(cat)}
            className={`rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
              catFilter === cat
                ? "border-[#1039B9] ring-2 ring-[#1039B9]/15 " + cardCls
                : chipCls
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-mono font-bold uppercase">{cat}</span>
              <span className={`w-2 h-2 rounded-full border ${CATEGORY_STYLE[cat]}`} />
            </div>
            <div className="text-xl font-bold tabular-nums mt-1">
              {categoryCounts[cat] ?? 0}
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Main Filterable Event Stream */}
        <div className={`xl:col-span-8 rounded-[24px] border p-5 space-y-4 ${cardCls}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2
                className="text-lg font-semibold tracking-tight"
                style={{ fontFamily: "Outfit, Inter, sans-serif" }}
              >
                Workspace Event &amp; Audit Explorer
              </h2>
              <p className={`text-xs ${mutedCls}`}>
                Inspect AUTH, SETUP, SECURITY, POS, COMPLIANCE, and BILLING telemetry across every
                organization.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportCsv}
              className={`px-3.5 py-2 rounded-full border text-xs font-semibold cursor-pointer ${chipCls}`}
            >
              Export CSV ({filtered.length})
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search actor, event action, org, or region..."
              className={`sm:col-span-7 h-9 px-3.5 rounded-xl border text-xs focus:outline-none focus:border-[#1039B9] ${inputCls}`}
            />
            <select
              value={orgFilter}
              onChange={(e) => onOrgFilterChange(e.target.value)}
              className={`sm:col-span-5 h-9 px-3 rounded-xl border text-xs ${inputCls}`}
            >
              <option value="ALL">All Organizations ({accounts.length})</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.orgName} ({acc.region})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <div className={`rounded-2xl border p-8 text-center text-xs ${chipCls} ${mutedCls}`}>
                No audit events match the active filters.
              </div>
            ) : (
              filtered.map((ev) => (
                <div
                  key={ev.id}
                  className={`rounded-2xl border p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${chipCls}`}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full border font-mono text-[10px] font-bold ${
                          CATEGORY_STYLE[ev.category]
                        }`}
                      >
                        {ev.category}
                      </span>
                      <span className="font-bold">{ev.orgName}</span>
                      <span className={`text-[11px] ${mutedCls}`}>&middot; {ev.actor}</span>
                    </div>
                    <div className="text-xs leading-snug">{ev.action}</div>
                  </div>
                  <div className={`font-mono text-[11px] shrink-0 sm:text-right ${mutedCls}`}>
                    <div>{ev.createdAt.slice(0, 10)}</div>
                    <div>{ev.createdAt.slice(11, 19)} UTC</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Log Custom HQ Audit Event */}
        <form
          onSubmit={handleRecordAudit}
          className={`xl:col-span-4 rounded-[24px] border p-5 space-y-4 ${cardCls}`}
        >
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#1039B9] dark:text-[#38BDF8]">
              HQ Compliance Log
            </div>
            <h3
              className="text-base font-semibold mt-0.5"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              Record Inspection / Audit Event
            </h3>
            <p className={`text-xs mt-1 ${mutedCls}`}>
              Append a signed HQ governance entry to an organization&apos;s permanent event trail.
            </p>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className={`block text-[10px] font-bold uppercase mb-1 ${mutedCls}`}>
                Target Organization
              </label>
              <select
                value={logOrgId || accounts[0]?.id || ""}
                onChange={(e) => setLogOrgId(e.target.value)}
                className={`w-full h-9 px-3 rounded-xl border ${inputCls}`}
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.orgName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-[10px] font-bold uppercase mb-1 ${mutedCls}`}>
                Event Category
              </label>
              <select
                value={logCategory}
                onChange={(e) => setLogCategory(e.target.value as AuditCategory)}
                className={`w-full h-9 px-3 rounded-xl border font-mono ${inputCls}`}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={`block text-[10px] font-bold uppercase mb-1 ${mutedCls}`}>
                Audit Description
              </label>
              <textarea
                rows={4}
                required
                minLength={4}
                maxLength={260}
                value={logNote}
                onChange={(e) => setLogNote(e.target.value)}
                placeholder="e.g. Verified TMDA cold-chain permit renewal and temperature log."
                className={`w-full p-3 rounded-xl border focus:outline-none focus:border-[#1039B9] ${inputCls}`}
              />
            </div>

            <button
              type="submit"
              disabled={busy || logNote.trim().length < 4}
              className="w-full h-10 rounded-xl bg-[#1039B9] hover:bg-[#0d2e94] text-white font-semibold disabled:opacity-50 cursor-pointer"
            >
              {busy ? "Saving..." : "Append Audit Event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
