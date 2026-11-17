/**
 * @file hq/accounts/HQAccountsClient.tsx
 * Client component for the HQ Accounts management page.
 * Features:
 *   - Filter tabs: All / Pharmacy / Supplier
 *   - Enable Download button (calls `enableDownload` server action)
 *   - Manual branch unlock button (calls `manualUnlockBranch` server action)
 *   - Unlock request badge when a branch has unlock_requested_at set
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { enableDownload, manualUnlockBranch } from "@/lib/actions/hq";
import Toast from "@/components/Toast";

interface Branch {
  id: string;
  name: string;
  account_id: string;
  subscription_status: string;
  unlock_requested_at: string | null;
  manually_unlocked_at: string | null;
}

interface Account {
  id: string;
  name: string;
  type: string;
  billing_status: string;
  download_enabled: boolean;
  created_at: string;
}

interface HQAccountsClientProps {
  accounts: Account[];
  branches: Branch[];
}

export default function HQAccountsClient({ accounts, branches }: HQAccountsClientProps) {
  const [filter, setFilter] = useState<"all" | "pharmacy" | "supplier">("all");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [optimisticDownload, setOptimisticDownload] = useState<Record<string, boolean>>({});
  const [unlockingBranchId, setUnlockingBranchId] = useState<string | null>(null);

  const filtered = filter === "all" ? accounts : accounts.filter((a) => a.type === filter);

  function showToast(message: string, type: "success" | "error" | "info") {
    setToast({ message, type });
  }

  async function handleEnableDownload(accountId: string) {
    setOptimisticDownload((prev) => ({ ...prev, [accountId]: true }));
    setLoadingId(accountId);
    try {
      const result = await enableDownload(accountId);
      if (result.error) {
        setOptimisticDownload((prev) => ({ ...prev, [accountId]: false }));
        showToast(result.error!, "error");
      } else {
        showToast("Download access enabled.", "success");
      }
    } finally {
      setLoadingId(null);
    }
  }

  async function handleUnlock(branchId: string) {
    setUnlockingBranchId(branchId);
    try {
      const result = await manualUnlockBranch(branchId);
      if (result.error) {
        showToast(result.error!, "error");
      } else {
        showToast("Branch manually unlocked.", "success");
        window.location.reload();
      }
    } finally {
      setUnlockingBranchId(null);
    }
  }

  function accountBranches(accountId: string) {
    return branches.filter((b) => b.account_id === accountId);
  }

  return (
    <>
      <div className="flex gap-2 mb-6">
        {(["all", "pharmacy", "supplier"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 font-label-md text-label-md capitalize transition-colors ${
              filter === f
                ? "bg-primary text-on-primary"
                : "border border-outline-variant text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {f}
          </button>
        ))}
        <span className="ml-auto font-label-md text-label-md text-on-surface-variant self-center">
          {filtered.length} account{filtered.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={async () => {
            try {
              const res = await fetch("/api/hq/export/accounts");
              if (!res.ok) throw new Error("Export failed");
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `accounts-${new Date().toISOString().slice(0,10)}.csv`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            } catch { /* silent */ }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-outline-variant text-on-surface-variant text-sm rounded hover:border-primary hover:text-primary transition-all"
        >
          <span className="material-symbols-outlined text-[16px]">download</span>
          Export
        </button>
      </div>

      <div className="bg-surface-base border border-outline-variant rounded overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-body-md text-on-surface-variant">No accounts found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-container-low">
                <tr>
                  {["Name", "Type", "Billing", "Branches", "Download", "Created", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-6 py-3 font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {filtered.map((acct) => {
                  const dlEnabled = optimisticDownload[acct.id] ?? acct.download_enabled;
                  const isUpdating = loadingId === acct.id;
                  const acctsBranches = accountBranches(acct.id);

                  return (
                    <tr key={acct.id} className="hover:bg-surface-container-low/30 transition-colors">
                      <td className="px-6 py-4 font-body-md text-body-md text-ink-deep font-medium">
                        <Link href={`/hq/accounts/${acct.id}`} className="hover:text-primary hover:underline inline-flex items-center gap-1">
                          {acct.name}
                          <span className="material-symbols-outlined text-[14px] text-on-surface-variant/50 group-hover:text-primary">open_in_new</span>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-label-md capitalize ${
                          acct.type === "pharmacy" ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"
                        }`}>
                          {acct.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-label-md ${
                          acct.billing_status === "active" ? "bg-secondary/10 text-secondary" : "bg-error-container text-error"
                        }`}>
                          {acct.billing_status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          {acctsBranches.length === 0 ? (
                            <span className="text-xs text-on-surface-variant">—</span>
                          ) : (
                            acctsBranches.map((b) => (
                              <div key={b.id} className="flex items-center gap-1.5">
                                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                  b.subscription_status === "locked" ? "bg-error-container text-error" :
                                  b.subscription_status === "active" ? "bg-secondary/10 text-secondary" :
                                  "bg-surface-container text-on-surface-variant"
                                }`}>
                                  {b.subscription_status}
                                </span>
                                {b.unlock_requested_at && (
                                  <span className="text-xs text-primary" title={`Unlock requested ${new Date(b.unlock_requested_at).toLocaleDateString()}`}>
                                    Unlock requested
                                  </span>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {acct.type === "pharmacy" ? (
                          dlEnabled ? (
                            <span className="inline-flex items-center gap-1 text-secondary font-label-md text-label-md text-xs">
                              <span className="material-symbols-outlined text-[14px]">check_circle</span>
                              Enabled
                            </span>
                          ) : (
                            <button
                              onClick={() => handleEnableDownload(acct.id)}
                              disabled={isUpdating}
                              className="text-primary font-label-md text-label-md text-sm hover:underline disabled:opacity-60 flex items-center gap-1"
                            >
                              {isUpdating ? (
                                <div className="w-3 h-3 border border-primary/40 border-t-primary rounded-full animate-spin" />
                              ) : null}
                              Enable
                            </button>
                          )
                        ) : (
                          <span className="text-on-surface-variant/40 text-xs">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-body-sm text-body-sm text-on-surface-variant">
                        {new Date(acct.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        {acctsBranches.filter((b) => b.subscription_status === "locked" || b.unlock_requested_at).length > 0 && (
                          <div className="flex flex-col gap-1">
                            {acctsBranches
                              .filter((b) => b.subscription_status === "locked" || b.unlock_requested_at)
                              .map((b) => (
                                <button
                                  key={b.id}
                                  onClick={() => handleUnlock(b.id)}
                                  disabled={unlockingBranchId === b.id}
                                  className="text-xs font-semibold text-primary hover:underline disabled:opacity-50 flex items-center gap-1"
                                >
                                  {unlockingBranchId === b.id ? (
                                    <div className="w-3 h-3 border border-primary/40 border-t-primary rounded-full animate-spin" />
                                  ) : (
                                    <span className="material-symbols-outlined text-[12px]">lock_open</span>
                                  )}
                                  Unlock {b.name}
                                </button>
                              ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
