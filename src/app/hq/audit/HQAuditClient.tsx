"use client";

import { useState } from "react";
import { searchAuditLog, type AuditLogEntry, type AuditLogFilter } from "@/lib/actions/hq";
import Toast from "@/components/Toast";
import { useI18n } from "@/lib/i18n/context";

const ACTION_COLORS: Record<string, string> = {
  login: "bg-emerald-50 text-emerald-800 border-emerald-200",
  logout: "bg-gray-50 text-gray-700 border-gray-200",
  create: "bg-blue-50 text-blue-800 border-blue-200",
  update: "bg-amber-50 text-amber-800 border-amber-200",
  delete: "bg-red-50 text-red-800 border-red-200",
  approve: "bg-green-50 text-green-800 border-green-200",
  reject: "bg-red-50 text-red-800 border-red-200",
  upload: "bg-purple-50 text-purple-800 border-purple-200",
  download: "bg-indigo-50 text-indigo-800 border-indigo-200",
  sync: "bg-cyan-50 text-cyan-800 border-cyan-200",
};

function actionColor(action: string): string {
  const lower = action.toLowerCase();
  for (const [key, val] of Object.entries(ACTION_COLORS)) {
    if (lower.includes(key)) return val;
  }
  return "bg-surface-container-low text-on-surface border-outline-variant";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function HQAuditClient({
  initialEntries,
  initialTotal,
  initialError,
  actionTypes,
}: {
  initialEntries: AuditLogEntry[];
  initialTotal: number;
  initialError: string | null;
  actionTypes: string[];
}) {
  const { t } = useI18n();
  const [entries, setEntries] = useState(initialEntries);
  const [total, setTotal] = useState(initialTotal);
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  async function doSearch(resetPage = true) {
    setLoading(true);
    setError(null);
    try {
      const filter: AuditLogFilter = {
        query: query || undefined,
        action: actionFilter || undefined,
        entity_type: entityFilter || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        limit: pageSize,
        offset: resetPage ? 0 : page * pageSize,
      };
      const result = await searchAuditLog(filter);
      if (result.error) {
        setError(result.error);
      } else {
        setEntries(result.data ?? []);
        setTotal(result.total);
        if (resetPage) setPage(0);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    doSearch(true);
  }

  function handlePageNext() {
    if ((page + 1) * pageSize < total) {
      setPage((p) => p + 1);
      doSearch(false);
    }
  }

  function handlePagePrev() {
    if (page > 0) {
      setPage((p) => p - 1);
      doSearch(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="bg-surface-base border border-outline-variant rounded-xl p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">Search</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="action, entity type, detail..."
              className="w-full px-3 py-2.5 rounded-md border border-outline-variant bg-surface-base text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">Action</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 py-2.5 rounded-md border border-outline-variant bg-surface-base text-sm focus:outline-none focus:border-primary"
            >
              <option value="">{t("hqaudit.all_actions")}</option>
              {actionTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">{t("hqaudit.entity_type")}</label>
            <input
              type="text"
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              placeholder="e.g. account"
              className="w-full px-3 py-2.5 rounded-md border border-outline-variant bg-surface-base text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2.5 rounded-md border border-outline-variant bg-surface-base text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2.5 rounded-md border border-outline-variant bg-surface-base text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-md bg-primary text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Searching..." : "Search"}
          </button>
          {(query || actionFilter || entityFilter || fromDate || toDate) && (
            <button
              type="button"
              onClick={() => { setQuery(""); setActionFilter(""); setEntityFilter(""); setFromDate(""); setToDate(""); doSearch(true); }}
              className="px-4 py-2.5 rounded-md border border-outline-variant text-on-surface-variant font-semibold hover:bg-surface-container transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      <div className="flex items-center justify-between mb-4">
        <p className="font-label-md text-label-md text-on-surface-variant">
          {total.toLocaleString()} result{total !== 1 ? "s" : ""}
          {total > pageSize && ` · page ${page + 1} of ${Math.ceil(total / pageSize)}`}
        </p>
        <div className="flex gap-2">
          <button
            onClick={handlePagePrev}
            disabled={page === 0}
            className="px-3 py-1.5 rounded-md border border-outline-variant text-sm font-semibold disabled:opacity-40 hover:bg-surface-container transition-colors"
          >
            ← Prev
          </button>
          <button
            onClick={handlePageNext}
            disabled={(page + 1) * pageSize >= total}
            className="px-3 py-1.5 rounded-md border border-outline-variant text-sm font-semibold disabled:opacity-40 hover:bg-surface-container transition-colors"
          >
            Next →
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-error-container text-on-error-container p-6 rounded mb-6">
          <p className="font-body-md">Search error: {error}</p>
        </div>
      )}

      <div className="bg-surface-base border border-outline-variant rounded-xl overflow-hidden">
        {entries.length === 0 && !loading ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-3">manage_search</span>
            <p className="font-body-md text-on-surface-variant">No audit entries found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container-low">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Entity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Detail</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Admin</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Account / Branch</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wider">IP / UA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-mono text-xs text-on-surface">{new Date(entry.created_at).toLocaleString()}</p>
                        <p className="font-mono text-xs text-on-surface-variant opacity-60">{timeAgo(entry.created_at)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold border capitalize ${actionColor(entry.action)}`}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-body-sm text-on-surface font-mono text-xs">{entry.entity_type ?? "—"}</p>
                        {entry.entity_id && (
                          <p className="font-mono text-xs text-on-surface-variant opacity-60 truncate max-w-[120px]">{entry.entity_id.slice(0, 8)}...</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-body-sm text-on-surface text-xs max-w-xs truncate" title={entry.detail ?? undefined}>
                        {entry.detail ?? "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-on-surface">{entry.admin_email ?? entry.admin_id?.slice(0, 8) ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        {entry.account_id && (
                          <span className="font-mono text-xs text-on-surface-variant truncate max-w-[100px]" title={entry.account_id}>
                            A: {entry.account_id.slice(0, 6)}...
                          </span>
                        )}
                        {entry.branch_id && (
                          <span className="font-mono text-xs text-on-surface-variant truncate max-w-[100px]" title={entry.branch_id}>
                            B: {entry.branch_id.slice(0, 6)}...
                          </span>
                        )}
                        {!entry.account_id && !entry.branch_id && <span className="text-xs text-on-surface-variant">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-[140px]">
                        <p className="font-mono text-xs text-on-surface-variant truncate" title={entry.ip_address ?? undefined}>
                          {entry.ip_address ?? "—"}
                        </p>
                        <p className="font-mono text-xs text-on-surface-variant opacity-50 truncate" title={entry.user_agent ?? undefined}>
                          {entry.user_agent?.slice(0, 30) ?? "—"}
                        </p>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
