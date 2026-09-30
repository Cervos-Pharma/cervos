"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Toast from "@/components/Toast";
import { useI18n } from "@/lib/i18n/context";

interface QuoteAnswers {
  expectedBranches?: number;
  annualVolume?: string;
  currentSupplier?: string;
}

export default function SupplierQuoteAnswersClient() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const quoteRequestId = searchParams.get("quoteRequestId");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState<QuoteAnswers>({
    expectedBranches: undefined,
    annualVolume: "",
    currentSupplier: "",
  });

  useEffect(() => {
    if (quoteRequestId) {
      loadExistingAnswers();
    }
  }, [quoteRequestId]);

  async function loadExistingAnswers() {
    setLoading(true);
    try {
      const res = await fetch(`/api/supplier/quote-answers?quoteRequestId=${encodeURIComponent(quoteRequestId!)}`);
      const data = await res.json();
      if (data.data) {
        setAnswers({
          expectedBranches: data.data.expectedBranches ?? undefined,
          annualVolume: data.data.annualVolume ?? "",
          currentSupplier: data.data.currentSupplier ?? "",
        });
      }
    } catch {
      // Ignore - user may not have answers yet
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quoteRequestId) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/supplier/quote-answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteRequestId,
          answers,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setToast({ message: data.error, type: "error" });
      } else {
        setSubmitted(true);
        setToast({ message: "Answers submitted successfully!", type: "success" });
      }
    } catch {
      setToast({ message: "Failed to submit answers", type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  if (!quoteRequestId) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="font-body-md text-on-surface-variant">No quote request specified.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-[32px] text-secondary">check_circle</span>
        </div>
        <h2 className="font-headline-md text-headline-md text-ink-deep mb-2">{t("supq.answers_submitted")}</h2>
        <p className="font-body-md text-on-surface-variant mb-6">
          Thank you for providing this information. The Cervos HQ team will review your answers and be in touch soon.
        </p>
        <a
          href="/supplier"
          className="inline-flex items-center gap-2 bg-primary text-on-primary font-label-md px-6 py-3 rounded hover:bg-primary/90 transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          Go to Dashboard
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-8">
        <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest mb-1">
          Supplier Portal
        </p>
        <h1 className="font-headline-lg text-headline-lg text-ink-deep">
          Complete Your Application
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Please answer a few questions to help us process your supplier application.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-surface-base border border-outline-variant p-6">
        <div className="mb-6">
          <label className="block font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider mb-2">
            How many branches do you plan to have?
          </label>
          <input
            type="number"
            min="1"
            value={answers.expectedBranches ?? ""}
            onChange={(e) => setAnswers((a) => ({ ...a, expectedBranches: e.target.value ? parseInt(e.target.value) : undefined }))}
            placeholder="e.g. 5"
            className="w-full h-12 px-4 bg-surface-base/60 border border-ink-deep/20 text-body-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
          />
        </div>

        <div className="mb-6">
          <label className="block font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider mb-2">
            What's your expected annual volume?
          </label>
          <input
            type="text"
            value={answers.annualVolume ?? ""}
            onChange={(e) => setAnswers((a) => ({ ...a, annualVolume: e.target.value }))}
            placeholder="e.g. $500,000 - $1,000,000"
            className="w-full h-12 px-4 bg-surface-base/60 border border-ink-deep/20 text-body-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
          />
        </div>

        <div className="mb-6">
          <label className="block font-label-md text-label-md text-on-surface-variant text-xs uppercase tracking-wider mb-2">
            Current supplier / distributor (if any)
          </label>
          <input
            type="text"
            value={answers.currentSupplier ?? ""}
            onChange={(e) => setAnswers((a) => ({ ...a, currentSupplier: e.target.value }))}
            placeholder="e.g. PharmaDist Co. or None"
            className="w-full h-12 px-4 bg-surface-base/60 border border-ink-deep/20 text-body-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
          />
        </div>

        <div className="flex gap-3">
          <a
            href="/supplier"
            className="flex-1 h-12 border border-outline-variant text-on-surface-variant font-label-md rounded hover:bg-surface-container transition-all flex items-center justify-center"
          >
            Cancel
          </a>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 h-12 bg-primary text-on-primary font-label-md font-bold rounded hover:bg-primary/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>Submit Answers <span className="material-symbols-outlined text-[18px]">send</span></>
            )}
          </button>
        </div>
      </form>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
