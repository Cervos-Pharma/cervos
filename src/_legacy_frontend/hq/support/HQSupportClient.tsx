/**
 * @file hq/support/HQSupportClient.tsx
 * @description Client component for the HQ Support ticket management page.
 * Mounted by: `app/hq/support/page.tsx` (server component that fetches ticket list).
 *
 * Features:
 *  - Filter tabs: All / Open / In Progress / Resolved
 *  - Expand rows to see full message, category, contact details
 *  - Status selector: Open → In Progress → Resolved (calls updateTicketStatus)
 *  - Internal note textarea: save with addTicketNote (HQ-only, not shown to user)
 *  - Optimistic UI for status changes
 *
 * Uses useState for loading state (not useTransition — React 18 doesn't support
 * async functions inside startTransition).
 */
"use client";

import { useState } from "react";
import { updateTicketStatus, addTicketNote, TicketStatus, SupportTicket } from "@/lib/actions/support";
import Toast from "@/components/Toast";
import { useI18n } from "@/lib/i18n/context";

type FilterTab = "all" | "open" | "in_progress" | "resolved";

const STATUS_LABELS: Record<TicketStatus, string> = {
  open:        "Open",
  in_progress: "In Progress",
  resolved:    "Resolved",
};

const STATUS_COLORS: Record<TicketStatus, string> = {
  open:        "border-amber-400 text-amber-700 bg-amber-50",
  in_progress: "border-blue-400 text-blue-700 bg-blue-50",
  resolved:    "border-green-400 text-green-700 bg-green-50",
};

const STATUS_DOT: Record<TicketStatus, string> = {
  open:        "bg-amber-400",
  in_progress: "bg-blue-400",
  resolved:    "bg-green-400",
};

const CATEGORY_LABELS: Record<string, string> = {
  billing:   "Billing",
  technical: "Technical",
  general:   "General",
  other:     "Other",
};

export default function HQSupportClient({ tickets }: { tickets: SupportTicket[] }) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [optimisticStatus, setOptimisticStatus] = useState<Record<string, TicketStatus>>({});
  const [noteValues, setNoteValues] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const getStatus = (t: SupportTicket): TicketStatus =>
    optimisticStatus[t.id] ?? t.status;

  const filtered = tickets.filter((t) => {
    const status = getStatus(t);
    if (filter === "all") return true;
    return status === filter;
  });

  const counts: Record<FilterTab, number> = {
    all:         tickets.length,
    open:        tickets.filter((t) => getStatus(t) === "open").length,
    in_progress: tickets.filter((t) => getStatus(t) === "in_progress").length,
    resolved:    tickets.filter((t) => getStatus(t) === "resolved").length,
  };

  async function handleStatusChange(ticketId: string, newStatus: TicketStatus) {
    const prev = getStatus(tickets.find((t) => t.id === ticketId)!);
    setOptimisticStatus((s) => ({ ...s, [ticketId]: newStatus }));
    setLoadingId(ticketId);
    try {
      const result = await updateTicketStatus(ticketId, newStatus);
      if (result.error) {
        setOptimisticStatus((s) => ({ ...s, [ticketId]: prev }));
        setToast({ message: result.error!, type: "error" });
      } else {
        setToast({ message: `Status updated to "${STATUS_LABELS[newStatus]}".`, type: "success" });
      }
    } finally {
      setLoadingId(null);
    }
  }

  async function handleSaveNote(ticketId: string) {
    const note = noteValues[ticketId] ?? "";
    setSavingNoteId(ticketId);
    try {
      const result = await addTicketNote(ticketId, note);
      if (result.error) {
        setToast({ message: result.error!, type: "error" });
      } else {
        setToast({ message: "Note saved.", type: "success" });
      }
    } finally {
      setSavingNoteId(null);
    }
  }

  const TABS: { key: FilterTab; label: string }[] = [
    { key: "all",         label: "All" },
    { key: "open",        label: "Open" },
    { key: "in_progress", label: "In Progress" },
    { key: "resolved",    label: "Resolved" },
  ];

  return (
    <>
      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 items-center flex-wrap">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 font-label-md text-label-md transition-colors flex items-center gap-2 ${
              filter === key
                ? "bg-primary text-on-primary"
                : "border border-outline-variant text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {label}
            {counts[key] > 0 && (
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
                filter === key ? "bg-on-primary/20 text-on-primary" : "bg-surface-container-highest text-on-surface-variant"
              }`}>
                {counts[key]}
              </span>
            )}
          </button>
        ))}
        <span className="ml-auto font-label-md text-label-md text-on-surface-variant">
          {filtered.length} ticket{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Ticket list */}
      {filtered.length === 0 ? (
        <div className="bg-surface-base border border-outline-variant p-12 text-center">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant/30 block mb-3">
            support_agent
          </span>
          <p className="font-body-md text-on-surface-variant">No tickets found.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((ticket) => {
            const status = getStatus(ticket);
            const isExpanded = expanded === ticket.id;
            const isUpdating = loadingId === ticket.id;
            const isSavingNote = savingNoteId === ticket.id;

            // Initialize note value from DB on first expand
            const noteValue = noteValues[ticket.id] ?? (ticket.internal_note ?? "");

            return (
              <div
                key={ticket.id}
                className="bg-surface-base border border-outline-variant overflow-hidden"
              >
                {/* Row header */}
                <div
                  className="flex items-center justify-between p-5 cursor-pointer hover:bg-surface-container-low/30 transition-colors"
                  onClick={() => {
                    // Initialize note value if expanding for the first time
                    if (!isExpanded && noteValues[ticket.id] === undefined) {
                      setNoteValues((n) => ({ ...n, [ticket.id]: ticket.internal_note ?? "" }));
                    }
                    setExpanded(isExpanded ? null : ticket.id);
                  }}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Status badge */}
                    <span className={`inline-flex items-center gap-1.5 font-mono text-xs px-2 py-0.5 border uppercase flex-shrink-0 ${STATUS_COLORS[status]}`}>
                      <span className={`w-1.5 h-1.5 rounded-full block ${STATUS_DOT[status]}`} />
                      {STATUS_LABELS[status]}
                    </span>

                    {/* Category chip */}
                    <span className="font-mono text-[10px] uppercase px-2 py-0.5 bg-surface-container-highest text-on-surface-variant border border-outline-variant flex-shrink-0">
                      {CATEGORY_LABELS[ticket.category] ?? ticket.category}
                    </span>

                    {/* Subject + email */}
                    <div className="min-w-0">
                      <p className="font-body-md text-body-md text-ink-deep font-medium truncate">
                        {ticket.subject}
                      </p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                        {ticket.contact_email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                    <span className="font-body-sm text-body-sm text-on-surface-variant hidden sm:block">
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </span>
                    {ticket.internal_note && (
                      <span
                        className="material-symbols-outlined text-[16px] text-primary"
                        title="Has internal note"
                      >
                        sticky_note_2
                      </span>
                    )}
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                      {isExpanded ? "expand_less" : "expand_more"}
                    </span>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-outline-variant/30 px-5 py-5 bg-surface-container-low/20 space-y-5">
                    {/* Meta grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider mb-1">Contact</p>
                        <p className="font-body-md text-body-md text-ink-deep">{ticket.contact_email}</p>
                      </div>
                      <div>
                        <p className="font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider mb-1">Category</p>
                        <p className="font-body-md text-body-md text-ink-deep">{CATEGORY_LABELS[ticket.category] ?? ticket.category}</p>
                      </div>
                      <div>
                        <p className="font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider mb-1">Submitted</p>
                        <p className="font-body-md text-body-md text-ink-deep">
                          {new Date(ticket.created_at).toLocaleString()}
                        </p>
                      </div>
                      {ticket.updated_at !== ticket.created_at && (
                        <div>
                          <p className="font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider mb-1">{t("hqsup.last_updated")}</p>
                          <p className="font-body-md text-body-md text-ink-deep">
                            {new Date(ticket.updated_at).toLocaleString()}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider mb-1">Source</p>
                        <p className="font-body-md text-body-md text-ink-deep capitalize">{ticket.source}</p>
                      </div>
                    </div>

                    {/* Message */}
                    <div>
                      <p className="font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider mb-2">Message</p>
                      <div className="bg-surface-base border border-outline-variant/50 p-4">
                        <p className="font-body-md text-body-md text-on-surface whitespace-pre-wrap">{ticket.message}</p>
                      </div>
                    </div>

                    {/* Status changer */}
                    <div>
                      <p className="font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider mb-2">{t("hqsup.change_status")}</p>
                      <div className="flex gap-2 flex-wrap">
                        {(["open", "in_progress", "resolved"] as TicketStatus[]).map((s) => (
                          <button
                            key={s}
                            onClick={() => handleStatusChange(ticket.id, s)}
                            disabled={isUpdating || status === s}
                            className={`px-3 py-1.5 font-label-md text-label-md text-sm transition-colors disabled:opacity-60 flex items-center gap-1.5 ${
                              status === s
                                ? `${STATUS_COLORS[s]} border`
                                : "border border-outline-variant text-on-surface-variant hover:bg-surface-container"
                            }`}
                          >
                            {isUpdating && status !== s && loadingId === ticket.id && (
                              <div className="w-3 h-3 border border-current/40 border-t-current rounded-full animate-spin" />
                            )}
                            {STATUS_LABELS[s]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Internal note */}
                    <div>
                      <p className="font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider mb-2">
                        Internal Note
                        <span className="ml-1 normal-case text-on-surface-variant/50">(HQ only — not visible to users)</span>
                      </p>
                      <textarea
                        value={noteValue}
                        onChange={(e) =>
                          setNoteValues((n) => ({ ...n, [ticket.id]: e.target.value }))
                        }
                        rows={3}
                        placeholder="Add an internal note…"
                        className="w-full border border-outline-variant bg-surface-base p-3 font-body-md text-body-md text-on-surface resize-y focus:outline-none focus:border-primary transition-colors"
                      />
                      <div className="mt-2 flex items-center gap-3">
                        <button
                          onClick={() => handleSaveNote(ticket.id)}
                          disabled={isSavingNote}
                          className="inline-flex items-center gap-1.5 bg-primary text-on-primary font-label-md text-label-md px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-60 text-sm"
                        >
                          {isSavingNote ? (
                            <div className="w-3 h-3 border border-on-primary/40 border-t-on-primary rounded-full animate-spin" />
                          ) : (
                            <span className="material-symbols-outlined text-[16px]">save</span>
                          )}
                          {isSavingNote ? "Saving…" : "Save Note"}
                        </button>
                        <a
                          href={`mailto:${ticket.contact_email}?subject=Re: ${encodeURIComponent(ticket.subject)}`}
                          className="inline-flex items-center gap-1.5 border border-outline-variant text-on-surface-variant font-label-md text-label-md px-4 py-2 hover:bg-surface-container transition-colors text-sm"
                        >
                          <span className="material-symbols-outlined text-[16px]">mail</span>
                          Reply by Email
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </>
  );
}
