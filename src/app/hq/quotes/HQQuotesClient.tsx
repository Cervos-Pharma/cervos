/**
 * @file hq/quotes/HQQuotesClient.tsx
 * @description Client component for the HQ Quote Requests management page.
 * Mounted by: `app/hq/quotes/page.tsx` (server component that fetches quote list).
 *
 * Features:
 *  - Filter tabs: All / Pending / Contacted
 *  - Expand rows to see full message and contact details
 *  - "Mark Contacted" action (calls `markQuoteContacted` server action)
 *  - "Invite Supplier" action (calls `createSupplierInvite` server action)
 *  - Optimistic UI: status updates immediately before server confirmation
 *
 * Uses `useState` for per-row loading (not useTransition — React 18 doesn't
 * support async functions inside startTransition).
 */
"use client";

import { useState } from "react";
import { markQuoteContacted, createSupplierInvite } from "@/lib/actions/hq";
import Toast from "@/components/Toast";
import { useI18n } from "@/lib/i18n/context";

interface Quote {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone?: string;
  message?: string;
  status: string;
  created_at: string;
}

export default function HQQuotesClient({ quotes }: { quotes: Quote[] }) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<"all" | "pending" | "contacted">("all");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [inviteModal, setInviteModal] = useState<{ quote: Quote } | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<{ link: string; inviteId: string } | null>(null);

  const filtered = quotes.filter((q) => {
    const status = optimistic[q.id] ?? q.status;
    if (filter === "all") return true;
    return status === filter;
  });

  async function handleMarkContacted(quoteId: string) {
    setOptimistic((prev) => ({ ...prev, [quoteId]: "contacted" }));
    setLoadingId(quoteId);
    try {
      const result = await markQuoteContacted(quoteId);
      if (result.error) {
        setOptimistic((prev) => ({ ...prev, [quoteId]: "pending" }));
        setToast({ message: result.error!, type: "error" });
      } else {
        setToast({ message: "Quote marked as contacted.", type: "success" });
      }
    } finally {
      setLoadingId(null);
    }
  }

  async function handleInviteSupplier(quote: Quote) {
    setInviteModal({ quote });
    setGeneratedLink(null);
  }

  async function handleGenerateInvite() {
    if (!inviteModal) return;
    setInviteLoading(true);
    try {
      const result = await createSupplierInvite(
        inviteModal.quote.id,
        inviteModal.quote.email,
        inviteModal.quote.company_name
      );
      if (result.error) {
        setToast({ message: result.error, type: "error" });
      } else if (result.data) {
        setGeneratedLink({ link: result.data.inviteLink, inviteId: result.data.inviteId });
        setOptimistic((prev) => ({ ...prev, [inviteModal.quote.id]: "contacted" }));
        setToast({ message: "Invite generated successfully!", type: "success" });
      }
    } finally {
      setInviteLoading(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setToast({ message: "Link copied to clipboard!", type: "success" });
    }).catch(() => {
      setToast({ message: "Failed to copy. Try manually.", type: "error" });
    });
  }

  function closeInviteModal() {
    setInviteModal(null);
    setGeneratedLink(null);
  }

  const pendingCount = quotes.filter((q) => (optimistic[q.id] ?? q.status) === "pending").length;

  return (
    <>
      <div className="flex gap-2 mb-6 items-center">
        {(["all", "pending", "contacted"] as const).map((f) => (
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
            {f === "pending" && pendingCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-700 rounded-full font-mono">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
        <span className="ml-auto font-label-md text-label-md text-on-surface-variant">
          {filtered.length} request{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface-base border border-outline-variant p-12 text-center">
          <p className="font-body-md text-on-surface-variant">No quote requests found.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((q) => {
            const status = optimistic[q.id] ?? q.status;
            const isContacted = status === "contacted";
            const isUpdating = loadingId === q.id;
            const isExpanded = expanded === q.id;

            return (
              <div
                key={q.id}
                className="bg-surface-base border border-outline-variant overflow-hidden"
              >
                <div
                  className="flex items-center justify-between p-5 cursor-pointer hover:bg-surface-container-low/30 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : q.id)}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <span className={`inline-flex items-center gap-1 font-mono text-xs px-2 py-0.5 border uppercase flex-shrink-0 ${
                      isContacted
                        ? "border-tertiary-container text-tertiary bg-[#dcfce7]"
                        : "border-[#b45309] text-[#b45309] bg-[#fef3c7]"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full block ${isContacted ? "bg-tertiary-container" : "bg-[#b45309]"}`} />
                      {status}
                    </span>
                    <div className="min-w-0">
                      <p className="font-body-md text-body-md text-ink-deep font-medium truncate">
                        {q.company_name}
                      </p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        {q.contact_name} · {q.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                    <span className="font-body-sm text-body-sm text-on-surface-variant hidden sm:block">
                      {new Date(q.created_at).toLocaleDateString()}
                    </span>
                    {!isContacted && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMarkContacted(q.id); }}
                        disabled={isUpdating}
                        className="text-primary font-label-md text-label-md text-sm hover:underline disabled:opacity-60 flex items-center gap-1"
                      >
                        {isUpdating && (
                          <div className="w-3 h-3 border border-primary/40 border-t-primary rounded-full animate-spin" />
                        )}
                        Mark contacted
                      </button>
                    )}
                    {isContacted && (optimistic[q.id] ?? q.status) !== "invited" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleInviteSupplier(q); }}
                        className="text-secondary font-label-md text-label-md text-sm hover:underline flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[16px]">mail</span>
                        Invite Supplier
                      </button>
                    )}
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                      {isExpanded ? "expand_less" : "expand_more"}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-outline-variant/30 px-5 py-4 bg-surface-container-low/20">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      {q.phone && (
                        <div>
                          <p className="font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider mb-1">Phone</p>
                          <p className="font-body-md text-body-md text-ink-deep">{q.phone}</p>
                        </div>
                      )}
                      <div>
                        <p className="font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider mb-1">Submitted</p>
                        <p className="font-body-md text-body-md text-ink-deep">
                          {new Date(q.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {q.message && (
                      <div>
                        <p className="font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider mb-1">Message</p>
                        <p className="font-body-md text-body-md text-on-surface whitespace-pre-wrap">{q.message}</p>
                      </div>
                    )}
                    <div className="mt-4 flex gap-2">
                      <a
                        href={`mailto:${q.email}?subject=Re: Your Cervos Supplier Application`}
                        className="inline-flex items-center gap-1 bg-primary text-on-primary font-label-md text-label-md px-4 py-2 rounded hover:opacity-90 transition-opacity text-sm"
                      >
                        <span className="material-symbols-outlined text-[16px]">mail</span>
                        Send Email
                      </a>
                      {isContacted && (
                        <button
                          onClick={() => handleInviteSupplier(q)}
                          className="inline-flex items-center gap-1 bg-secondary text-on-secondary font-label-md text-label-md px-4 py-2 rounded hover:opacity-90 transition-opacity text-sm"
                        >
                          <span className="material-symbols-outlined text-[16px]">send</span>
                          Generate Invite Link
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {inviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-deep/50 backdrop-blur-sm">
          <div className="bg-surface-base border border-outline-variant w-full max-w-md mx-4 p-6 shadow-2xl">
            {!generatedLink ? (
              <>
                <h3 className="font-headline-md text-headline-md text-ink-deep mb-1">{t("hqquote.invite")}</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mb-6">
                  Generate a one-time invite link for <strong>{inviteModal.quote.company_name}</strong>.
                </p>
                <div className="bg-surface-container-low p-4 rounded mb-6">
                  <p className="font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider mb-2">{t("hqquote.sending_to")}</p>
                  <p className="font-body-md text-body-md text-ink-deep">{inviteModal.quote.contact_name}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">{inviteModal.quote.email}</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={closeInviteModal}
                    className="flex-1 h-11 border border-outline-variant text-on-surface-variant font-label-md rounded hover:bg-surface-container transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGenerateInvite}
                    disabled={inviteLoading}
                    className="flex-1 h-11 bg-primary text-on-primary font-label-md font-bold rounded hover:bg-primary/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {inviteLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>Generate Invite <span className="material-symbols-outlined text-[18px]">send</span></>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[20px] text-secondary">check_circle</span>
                  </div>
                  <div>
                    <h3 className="font-headline-md text-headline-md text-ink-deep">{t("hqquote.link_generated")}</h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">{t("hqquote.share_link")}</p>
                  </div>
                </div>
                <div className="bg-surface-container-low p-3 rounded mb-4 break-all">
                  <p className="font-mono text-xs text-on-surface-variant">{generatedLink.link}</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={closeInviteModal}
                    className="flex-1 h-11 border border-outline-variant text-on-surface-variant font-label-md rounded hover:bg-surface-container transition-all"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => copyToClipboard(generatedLink.link)}
                    className="flex-1 h-11 bg-secondary text-on-secondary font-label-md font-bold rounded hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">content_copy</span>
                    Copy Link
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}
