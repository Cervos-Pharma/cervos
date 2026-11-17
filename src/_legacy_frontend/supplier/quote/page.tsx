/**
 * @route /supplier/quote
 * @access PUBLIC — explicitly exempted from middleware auth protection.
 * @description Supplier lead-generation and quote application page.
 *   Contains a marketing hero section and a contact form that submits to
 *   the `quote_requests` Supabase table via `submitQuoteRequest` server action.
 *   Rate limited at 3 submissions/hour/email (in-process).
 *
 * @data Writes: quote_requests (via submitQuoteRequest server action)
 * @middleware publicExceptions in proxy.ts exempts /supplier/quote from auth guards.
 */
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import PublicNav from "@/components/PublicNav";
import Toast from "@/components/Toast";
import { submitQuoteRequest } from "@/lib/actions/quote";
import { useI18n } from "@/lib/i18n/context";

const BENEFITS = [
  { icon: "group",          titleKey: "sup.quote.direct.title",    bodyKey: "sup.quote.direct.body"    },
  { icon: "payment",        titleKey: "sup.quote.escrow.title",   bodyKey: "sup.quote.escrow.body"    },
  { icon: "monitoring",     titleKey: "sup.quote.analytics.title",bodyKey: "sup.quote.analytics.body" },
  { icon: "verified",       titleKey: "sup.quote.verified.title",bodyKey: "sup.quote.verified.body"  },
  { icon: "local_shipping", titleKey: "sup.quote.logistics.title",bodyKey: "sup.quote.logistics.body" },
  { icon: "support_agent",  titleKey: "sup.quote.support.title",  bodyKey: "sup.quote.support.body"  },
];

export default function SupplierGatePage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" | "info" } | null>(null);
  const [form, setForm] = useState({ companyName: "", contactName: "", email: "", phone: "", message: "" });
  const [stats, setStats] = useState<{ pharmacies: number } | null>(null);

  useEffect(() => {
    fetch("/api/public/stats")
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => {});
  }, []);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await submitQuoteRequest(form);
      if (result.error) { setToast({ message: result.error, type: "error" }); }
      else { setSubmitted(true); }
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full h-11 px-3 border border-outline-variant bg-surface-base text-body-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors placeholder:text-on-surface-variant/50";

  return (
    <div className="min-h-screen bg-surface-base flex flex-col">
      <PublicNav activePath="/supplier/quote" />

      {/* ── Hero ── */}
      <section className="relative bg-ink-deep overflow-hidden pt-24 pb-0">
        {/* subtle grid */}
        <div className="absolute inset-0 grid-bg opacity-20" />

        <div className="max-w-container-max mx-auto px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-end">
            {/* Left copy */}
              <div className="pb-16 pt-8">
              <div className="inline-flex items-center gap-2 bg-primary/20 text-primary/90 font-label-md text-label-md px-3 py-1 rounded-full mb-6 border border-primary/20">
                <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                {t("sup.quote.hero_badge")}
              </div>
              <h1 className="font-headline-xl text-on-primary text-headline-xl mb-5 leading-tight">
                {t("sup.quote.hero_headline")}
              </h1>
              <p className="font-body-lg text-body-lg text-surface-variant/75 mb-10 max-w-lg">
                {t("sup.quote.hero_body")}
              </p>

              {/* Social proof strip */}
              <div className="flex flex-wrap gap-8 pb-4">
                {[
                  { value: stats ? stats.pharmacies.toLocaleString() : "Verified", labelKey: "sup.quote.proof.pharmacies" },
                  { value: "Direct", labelKey: "sup.quote.proof.onboarding" },
                  { value: "Escrow", labelKey: "sup.quote.proof.security" },
                ].map(s => (
                  <div key={s.labelKey}>
                    <div className="font-headline-lg text-headline-lg text-primary font-black">{s.value}</div>
                    <div className="font-label-md text-label-md text-surface-variant/60 uppercase tracking-wider text-[10px]">{t(s.labelKey)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — application form */}
            <div className="bg-surface-base custom-notch shadow-2xl relative z-10 -mb-1">
              <div className="p-8">
                {submitted ? (
                  <div className="text-center py-10">
                    <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-5">
                      <span className="material-symbols-outlined text-[32px] text-secondary">check_circle</span>
                    </div>
                    <h2 className="font-headline-md text-headline-md text-ink-deep mb-2">{t("sup.quote.app_received")}</h2>
                    <p className="font-body-md text-body-md text-on-surface-variant mb-6">
                      {t("sup.quote.app_received_body")}
                    </p>
                    <button
                      onClick={() => { setSubmitted(false); setForm({ companyName: "", contactName: "", email: "", phone: "", message: "" }); }}
                      className="font-label-md text-label-md text-primary hover:underline"
                    >
                      {t("sup.quote.app_another")}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mb-6">
                      <h2 className="font-headline-md text-headline-md text-ink-deep">{t("sup.quote.apply_title")}</h2>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{t("sup.quote.apply_subtitle")}</p>
                    </div>
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-label-md text-on-surface-variant uppercase tracking-wider mb-1">{t("sup.quote.company")} *</label>
                          <input type="text" value={form.companyName} onChange={update("companyName")} required placeholder="e.g. MedSupply Ltd" className={inputCls} />
                        </div>
                        <div>
                          <label className="block text-[11px] font-label-md text-on-surface-variant uppercase tracking-wider mb-1">{t("sup.quote.contact_name")} *</label>
                          <input type="text" value={form.contactName} onChange={update("contactName")} required className={inputCls} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-label-md text-on-surface-variant uppercase tracking-wider mb-1">{t("sup.quote.email_star")}</label>
                          <input type="email" value={form.email} onChange={update("email")} required className={inputCls} />
                        </div>
                        <div>
                          <label className="block text-[11px] font-label-md text-on-surface-variant uppercase tracking-wider mb-1">{t("sup.quote.phone_label")}</label>
                          <input type="tel" value={form.phone} onChange={update("phone")} placeholder="+255…" className={inputCls} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-label-md text-on-surface-variant uppercase tracking-wider mb-1">{t("sup.quote.product_range")}</label>
                        <textarea
                          value={form.message}
                          onChange={update("message")}
                          rows={3}
                          placeholder="Briefly describe your product categories and distribution capabilities…"
                          className="w-full px-3 py-2.5 border border-outline-variant bg-surface-base text-body-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none placeholder:text-on-surface-variant/50"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-12 bg-primary text-on-primary font-label-md font-bold hover:bg-primary/90 active:scale-[0.98] transition-all gaming-snap flex items-center justify-center gap-2 disabled:opacity-60 mt-1"
                      >
                        {loading ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>{t("sup.quote.submit_app")} <span className="material-symbols-outlined text-[18px]">send</span></>
                        )}
                      </button>
                      <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
                        {t("sup.quote.already_supplier")}{" "}
                        <Link href="/auth" className="text-primary hover:underline font-semibold">{t("sup.quote.sign_in_link")}</Link>
                      </p>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Hero image band ── */}
      <section className="relative h-64 overflow-hidden">
        <Image src="/pharmacist-2.png" alt="Pharmacy supply chain" fill sizes="100vw" className="object-cover object-top saturate-75" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink-deep via-ink-deep/20 to-surface-base" />
      </section>

      {/* ── Benefits grid ── */}
      <section className="py-24 bg-surface-base">
        <div className="max-w-container-max mx-auto px-8">
          <div className="text-center mb-14">
            <h2 className="font-headline-lg text-headline-lg text-ink-deep mb-3">{t("sup.quote.benefits_title")}</h2>
            <p className="font-body-md text-on-surface-variant max-w-xl mx-auto">
              {t("sup.quote.benefits_body")}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {BENEFITS.map(b => (
              <div key={b.titleKey} className="bg-surface-muted border border-outline-variant/30 p-7 custom-notch-sm group hover:border-primary/30 hover:shadow-[0_4px_12px_rgba(16,57,185,0.06)] transition-all">
                <div className="w-11 h-11 rounded bg-primary/10 flex items-center justify-center text-primary mb-5">
                  <span className="material-symbols-outlined text-[22px]">{b.icon}</span>
                </div>
                <h3 className="font-headline-md text-ink-deep mb-2">{t(b.titleKey)}</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{t(b.bodyKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA bottom ── */}
      <section className="py-16 bg-surface-muted border-t border-outline-variant/20 text-center">
        <div className="max-w-xl mx-auto px-8">
          <h2 className="font-headline-lg text-headline-lg text-ink-deep mb-3">{t("sup.quote.cta.ready")}</h2>
          <p className="font-body-md text-on-surface-variant mb-8">{t("sup.quote.cta.body")} <a href="mailto:suppliers@cervos.online" className="text-primary hover:underline">suppliers@cervos.online</a></p>
          <a href="#top" onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            className="inline-flex items-center gap-2 bg-primary text-on-primary font-label-md text-label-md px-8 py-3 rounded hover:bg-primary/90 active:scale-[0.98] transition-all gaming-snap"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
            {t("sup.quote.cta.apply")}
          </a>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 px-8 border-t border-outline-variant bg-ink-deep text-center">
        <p className="font-body-sm text-body-sm text-surface-variant/60">
          © {new Date().getFullYear()} Cervos ·{" "}
          <Link href="/terms" className="hover:text-surface-bright transition-colors">Terms</Link>{" · "}
          <Link href="/privacy" className="hover:text-surface-bright transition-colors">Privacy</Link>{" · "}
          <a href="mailto:hq@cervos.online" className="hover:text-surface-bright transition-colors">hq@cervos.online</a>
        </p>
      </footer>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
