/**
 * @file support/SupportForm.tsx
 * @description Client component — the public support ticket submission form.
 * Mounted by app/support/page.tsx which passes prefilled email (if signed in)
 * and existing tickets for the logged-in user.
 *
 * Uses useState for loading state (React 18 — no async useTransition).
 */
"use client";

import { useState } from "react";
import { submitSupportTicket, PublicTicket, TicketCategory } from "@/lib/actions/support";
import Toast from "@/components/Toast";
import { useI18n } from "@/lib/i18n/context";

const CATEGORIES: { value: TicketCategory; labelKey: string }[] = [
  { value: "billing",   labelKey: "support.form.billing" },
  { value: "technical", labelKey: "support.form.technical" },
  { value: "general",  labelKey: "support.form.general" },
  { value: "other",    labelKey: "support.form.other" },
];

const STATUS_LABELS_KEYS: Record<string, string> = {
  open:        "support.form.status.open",
  in_progress: "support.form.status.in_progress",
  resolved:    "support.form.status.resolved",
};

const STATUS_COLORS: Record<string, string> = {
  open:        "border-amber-400 text-amber-700 bg-amber-50",
  in_progress: "border-blue-400 text-blue-700 bg-blue-50",
  resolved:    "border-green-400 text-green-700 bg-green-50",
};

interface SupportFormProps {
  prefillEmail?: string;
  existingTickets?: PublicTicket[];
}

export default function SupportForm({ prefillEmail = "", existingTickets = [] }: SupportFormProps) {
  const { t } = useI18n();
  const [subject, setSubject]       = useState("");
  const [message, setMessage]       = useState("");
  const [category, setCategory]     = useState<TicketCategory>("general");
  const [email, setEmail]           = useState(prefillEmail);
  const [loading, setLoading]       = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [toast, setToast]           = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [tickets, setTickets]       = useState<PublicTicket[]>(existingTickets);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await submitSupportTicket({ subject, message, category, contactEmail: email });
      if (result.error) {
        setToast({ message: result.error, type: "error" });
      } else {
        setSubmitted(true);
        setToast({ message: t("support.form.ticket_submitted"), type: "success" });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {submitted ? (
        <div className="bg-surface-base border border-outline-variant p-8 text-center">
          <span className="material-symbols-outlined text-[48px] text-primary block mb-3">check_circle</span>
          <h2 className="font-headline-md text-headline-md text-ink-deep mb-2">{t("support.form.ticket_submitted")}</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mb-4">
            {t("support.form.thank_you").replace("{email}", email)}
          </p>
          <button
            onClick={() => {
              setSubmitted(false);
              setSubject("");
              setMessage("");
              setCategory("general");
              if (!prefillEmail) setEmail("");
            }}
            className="font-label-md text-label-md text-primary hover:underline"
          >
            {t("support.form.submit_another")}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-surface-base border border-outline-variant p-8 space-y-6">
          {/* Subject */}
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider mb-2">
              {t("support.form.subject")} <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              required
              placeholder="Brief description of your question"
              className="w-full border border-outline-variant bg-surface p-3 font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider mb-2">
              {t("support.form.category")} <span className="text-error">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={`px-3 py-2 font-label-md text-label-md border transition-colors text-sm ${
                    category === c.value
                      ? "bg-primary text-on-primary border-primary"
                      : "border-outline-variant text-on-surface-variant hover:bg-surface-container"
                  }`}
                >
                  {t(c.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider mb-2">
              {t("support.form.message")} <span className="text-error">*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={5000}
              required
              placeholder="Describe your question or issue in detail…"
              className="w-full border border-outline-variant bg-surface p-3 font-body-md text-body-md text-on-surface resize-y focus:outline-none focus:border-primary transition-colors"
            />
            <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant text-right">
              {message.length} / 5000
            </p>
          </div>

          {/* Contact email */}
          <div>
            <label className="block font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider mb-2">
              {t("support.form.contact_email")} <span className="text-error">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={320}
              required
              placeholder="your@email.com"
              className="w-full border border-outline-variant bg-surface p-3 font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary transition-colors"
            />
            {prefillEmail && (
              <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
                {t("support.form.prefilled")}
              </p>
            )}
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 bg-primary text-on-primary font-label-md text-label-md px-6 py-3 hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {loading ? (
                <div className="w-4 h-4 border border-on-primary/40 border-t-on-primary rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-[18px]">send</span>
              )}
              {loading ? t("support.form.submitting") : t("support.form.submit_ticket")}
            </button>
          </div>
        </form>
      )}

      {/* Prior tickets (logged-in users) */}
      {tickets.length > 0 && (
        <div className="mt-10">
          <h2 className="font-headline-md text-headline-md text-ink-deep mb-4">{t("support.form.your_tickets")}</h2>
          <div className="flex flex-col gap-3">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="bg-surface-base border border-outline-variant p-5 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-body-md text-body-md text-ink-deep font-medium truncate">{ticket.subject}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                    {new Date(ticket.created_at).toLocaleDateString()} · {ticket.category}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1.5 font-mono text-xs px-2 py-0.5 border uppercase flex-shrink-0 ${STATUS_COLORS[ticket.status] ?? ""}`}>
                  {t(STATUS_LABELS_KEYS[ticket.status] ?? ticket.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </>
  );
}
