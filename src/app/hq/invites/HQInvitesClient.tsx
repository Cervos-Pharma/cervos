"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Toast from "@/components/Toast";

interface Invite {
  id: string;
  quoteRequestId: string;
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  inviteToken: string;
  tokenExpiresAt: string;
  status: string;
  createdAt: string;
  acceptedAt?: string;
  supplierAccountId?: string;
  supplierAccountName?: string;
  branchName?: string;
  expectedBranches?: number;
  currentSupplier?: string;
  annualVolume?: string;
}

export default function HQInvitesClient() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "accepted" | "expired" | "cancelled">("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadInvites();
  }, []);

  async function loadInvites() {
    setLoading(true);
    try {
      const res = await fetch("/api/hq/invites");
      const data = await res.json();
      if (data.error) {
        setToast({ message: data.error, type: "error" });
      } else {
        setInvites(data.data || []);
      }
    } catch {
      setToast({ message: "Failed to load invites", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleResend(inviteId: string) {
    setActionLoading(inviteId);
    try {
      const res = await fetch("/api/hq/invites/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });
      const data = await res.json();
      if (data.error) {
        setToast({ message: data.error, type: "error" });
      } else {
        setToast({ message: "Invite resent! Link copied to clipboard.", type: "success" });
        await navigator.clipboard.writeText(data.data.inviteLink);
        loadInvites();
      }
    } catch {
      setToast({ message: "Failed to resend invite", type: "error" });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancel(inviteId: string) {
    if (!confirm("Cancel this invite? The supplier will no longer be able to use it.")) return;
    setActionLoading(inviteId);
    try {
      const res = await fetch("/api/hq/invites/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });
      const data = await res.json();
      if (data.error) {
        setToast({ message: data.error, type: "error" });
      } else {
        setToast({ message: "Invite cancelled.", type: "success" });
        loadInvites();
      }
    } catch {
      setToast({ message: "Failed to cancel invite", type: "error" });
    } finally {
      setActionLoading(null);
    }
  }

  function copyLink(token: string) {
    const appUrl = window.location.origin;
    navigator.clipboard.writeText(`${appUrl}/auth?invite_token=${token}`).then(() => {
      setToast({ message: "Link copied!", type: "success" });
    }).catch(() => {
      setToast({ message: "Failed to copy", type: "error" });
    });
  }

  const filtered = invites.filter((inv) => {
    if (filter === "all") return true;
    return inv.status === filter;
  });

  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    accepted: "bg-green-100 text-green-700 border-green-200",
    expired: "bg-gray-100 text-gray-600 border-gray-200",
    cancelled: "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <>
      <div className="flex gap-2 mb-6 items-center">
        {(["all", "pending", "accepted", "expired", "cancelled"] as const).map((f) => (
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
        <span className="ml-auto font-label-md text-label-md text-on-surface-variant">
          {filtered.length} invite{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface-base border border-outline-variant p-12 text-center">
          <p className="font-body-md text-on-surface-variant">No invites found.</p>
        </div>
      ) : (
        <div className="bg-surface-base border border-outline-variant overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-container-low">
                <th className="text-left px-5 py-3 font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Company</th>
                <th className="text-left px-5 py-3 font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Email</th>
                <th className="text-left px-5 py-3 font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3 font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Created</th>
                <th className="text-left px-5 py-3 font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Accepted</th>
                <th className="text-left px-5 py-3 font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <tr key={inv.id} className="border-b border-outline-variant/30 hover:bg-surface-container-low/30">
                  <td className="px-5 py-4">
                    <p className="font-body-md text-body-md text-ink-deep font-medium">{inv.companyName}</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">{inv.contactName}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-body-sm text-body-sm text-ink-deep">{inv.email}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1 font-mono text-xs px-2 py-0.5 border rounded ${statusColors[inv.status] || statusColors.pending}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${inv.status === "pending" ? "bg-amber-500" : inv.status === "accepted" ? "bg-green-500" : "bg-gray-400"}`} />
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant/60">
                      {new Date(inv.createdAt).toLocaleTimeString()}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    {inv.acceptedAt ? (
                      <p className="font-body-sm text-body-sm text-green-600">
                        {new Date(inv.acceptedAt).toLocaleDateString()}
                      </p>
                    ) : (
                      <span className="font-body-sm text-body-sm text-on-surface-variant/40">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2 items-center">
                      <button
                        onClick={() => copyLink(inv.inviteToken)}
                        className="text-primary font-label-md text-label-md text-sm hover:underline flex items-center gap-1"
                        title="Copy invite link"
                      >
                        <span className="material-symbols-outlined text-[16px]">content_copy</span>
                        Copy
                      </button>
                      {inv.status === "pending" && (
                        <>
                          <button
                            onClick={() => handleResend(inv.id)}
                            disabled={actionLoading === inv.id}
                            className="text-secondary font-label-md text-label-md text-sm hover:underline flex items-center gap-1 disabled:opacity-60"
                          >
                            {actionLoading === inv.id ? (
                              <div className="w-3 h-3 border border-secondary/40 border-t-secondary rounded-full animate-spin" />
                            ) : (
                              <span className="material-symbols-outlined text-[16px]">refresh</span>
                            )}
                            Resend
                          </button>
                          <button
                            onClick={() => handleCancel(inv.id)}
                            disabled={actionLoading === inv.id}
                            className="text-error font-label-md text-label-md text-sm hover:underline flex items-center gap-1 disabled:opacity-60"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                    {inv.supplierAccountName && (
                      <p className="font-body-sm text-body-sm text-green-600 mt-1">
                        Account: {inv.supplierAccountName}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
