"use client";

import { useState, type FormEvent } from "react";
import { submitSupportTicket, type TicketCategory } from "@/lib/actions/support";
import { IconCheck } from "@/components/LandingIcons";
import FlipText from "@/components/FlipText";

interface Props {
  lang: string;
  isSw: boolean;
}

export default function SupportHelpSection({ lang, isSw }: Props) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [category, setCategory] = useState<TicketCategory>("general");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const faqs = [
    {
      q: isSw
        ? "Je, duka linasimama intaneti ikikatika?"
        : "Does the counter stop if internet cuts out?",
      a: isSw
        ? "Hapana. Kila mauzo na risiti vinahifadhiwa moja kwa moja kwenye kifaa chako na vitasawazishwa kimya kimya mtandao ukirudi."
        : "No. Every sale saves directly on your counter device and prints receipts immediately, then syncs quietly once internet returns.",
    },
    {
      q: isSw
        ? "Mfumo unazuia vipi kuuza dawa iliyoisha muda?"
        : "How does Cervos stop expired medicines from selling?",
      a: isSw
        ? "Unaposkani dawa, mfumo unachagua dawa ya karibu zaidi kuisha kwanza, na unazuia kabisa kuuza dawa yoyote iliyopitwa na tarehe."
        : "Scanning picks the earliest valid batch automatically and blocks any expired box from passing checkout.",
    },
    {
      q: isSw
        ? "Wasambazaji wa jumla wanajiunga vipi?"
        : "How do wholesale suppliers join the network?",
      a: isSw
        ? "Bonyeza 'Jiunge Nasi' au 'Ingia' juu ili kufungua akaunti ya msambazaji na kupokea maagizo moja kwa moja kutoka maduka."
        : "Use Sign In or the Wholesale Supply card link to verify your warehouse account and start receiving direct orders.",
    },
    {
      q: isSw
        ? "Je, mashine za risiti na skana zipi zinafaa?"
        : "Which receipt printers and barcode scanners work?",
      a: isSw
        ? "Mashine yoyote ya kawaida ya kuchapisha risiti na skana za USB au Bluetooth zinaunganishwa mara moja bila usanidi mgumu."
        : "Any standard USB or Bluetooth barcode scanner and counter receipt printer plugs in cleanly and starts printing immediately.",
    },
  ];

  const categories: Array<{ value: TicketCategory; label: string }> = [
    { value: "general", label: isSw ? "Maswali ya Jumla" : "General" },
    { value: "technical", label: isSw ? "Msaada wa Kiufundi" : "Technical" },
    { value: "billing", label: isSw ? "Malipo" : "Billing" },
    { value: "other", label: isSw ? "Ugavi / Mengineyo" : "Wholesale & Other" },
  ];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await submitSupportTicket({
        subject,
        message,
        category,
        contactEmail: email,
      });
      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        setSubmittedEmail(email);
        setSubject("");
        setMessage("");
      }
    } catch {
      setErrorMsg(
        isSw
          ? "Imeshindwa kutuma tiketi. Tafadhali jaribu tena."
          : "Could not send your ticket right now. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section id="support" className="py-20 sm:py-24 bg-[#F8FAFC] border-t border-[#E2E8F0]">
      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        <div className="max-w-2xl mb-12">
          <div className="text-xs font-bold tracking-[0.22em] uppercase text-[#006875] mb-2">
            <FlipText
              text={isSw ? "MSAADA NA MAWASILIANO" : "HELP, FAQ & CONTACT US"}
              flipKey={lang}
            />
          </div>
          <h2
            className="text-3xl sm:text-4xl font-bold text-[#0F172A] mb-3"
            style={{ fontFamily: "Outfit, Inter, sans-serif" }}
          >
            <FlipText
              text={
                isSw
                  ? "Maswali ya haraka na dawati la msaada."
                  : "Quick answers or open a support ticket."
              }
              flipKey={lang}
            />
          </h2>
          <p className="text-sm text-[#475569] leading-relaxed">
            <FlipText
              mode="words"
              text={
                isSw
                  ? "Pata majibu ya haraka hapa au tuma tiketi moja kwa moja kwa timu yetu ya Dar es Salaam."
                  : "Find quick answers on how Cervos works or submit a direct support ticket to our team."
              }
              flipKey={lang}
            />
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          {/* Left Column: FAQ & Help Guide */}
          <div className="lg:col-span-6">
            <div className="divide-y divide-[#E2E8F0] border-y border-[#E2E8F0] bg-white rounded-md px-5 sm:px-6">
              {faqs.map((item, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div key={item.q} className="py-4">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      aria-expanded={isOpen}
                      className="w-full flex items-center justify-between gap-4 text-left"
                    >
                      <span className="text-sm font-semibold text-[#0F172A]">
                        <FlipText text={item.q} flipKey={lang} mode="words" />
                      </span>
                      <span
                        className={`text-sm font-bold text-[#1039B9] shrink-0 transition-transform duration-200 ${
                          isOpen ? "rotate-45" : ""
                        }`}
                      >
                        +
                      </span>
                    </button>
                    {isOpen && (
                      <p className="mt-2.5 text-xs sm:text-sm text-[#475569] leading-relaxed pr-6">
                        <FlipText text={item.a} flipKey={lang} mode="words" />
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Direct Contact Strip */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-md bg-white border border-[#E2E8F0]">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  <FlipText text={isSw ? "Barua Pepe" : "Direct Email"} flipKey={lang} />
                </div>
                <a
                  href="mailto:support@cervos.online"
                  className="font-semibold text-[#1039B9] hover:underline"
                >
                  support@cervos.online
                </a>
              </div>
              <div className="p-4 rounded-md bg-white border border-[#E2E8F0]">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  <FlipText text={isSw ? "Dawati la Kituo" : "Service Desk"} flipKey={lang} />
                </div>
                <div className="font-semibold text-[#0F172A]">
                  <FlipText
                    text={
                      isSw
                        ? "Dar es Salaam · Jtatu - Jmosi"
                        : "Dar es Salaam · Mon - Sat"
                    }
                    flipKey={lang}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Live Support Ticket Form */}
          <div className="lg:col-span-6 bg-white rounded-md border border-[#E2E8F0] p-6 sm:p-8 shadow-xs">
            {submittedEmail ? (
              <div className="py-10 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-[#00542C] flex items-center justify-center mx-auto mb-4">
                  <IconCheck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#0F172A] mb-2">
                  <FlipText
                    text={isSw ? "Tiketi Imepokelewa" : "Support Ticket Received"}
                    flipKey={lang}
                  />
                </h3>
                <p className="text-xs sm:text-sm text-[#475569] max-w-sm mx-auto mb-6">
                  <FlipText
                    mode="words"
                    text={
                      isSw
                        ? `Asante. Tutakujibu kupitia ${submittedEmail} hivi punde.`
                        : `Thank you. Our team will reply to ${submittedEmail} shortly.`
                    }
                    flipKey={lang}
                  />
                </p>
                <button
                  type="button"
                  onClick={() => setSubmittedEmail(null)}
                  className="px-5 py-2 rounded bg-[#1039B9] hover:bg-[#0D2E94] text-white text-xs font-semibold transition-all"
                >
                  <FlipText
                    text={isSw ? "Tuma Tiketi Nyingine" : "Send Another Ticket"}
                    flipKey={lang}
                  />
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
                  <h3 className="text-base font-bold text-[#0F172A]">
                    <FlipText
                      text={isSw ? "Fungua Tiketi ya Msaada" : "Open a Support Ticket"}
                      flipKey={lang}
                    />
                  </h3>
                  <span className="text-[11px] font-semibold text-[#006875]">
                    <FlipText text={isSw ? "Inajibiwa Haraka" : "Fast Response"} flipKey={lang} />
                  </span>
                </div>

                {errorMsg && (
                  <div className="p-3 rounded bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800">
                    {errorMsg}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="support-email"
                      className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5"
                    >
                      <FlipText text={isSw ? "Barua Pepe" : "Your Email"} flipKey={lang} />
                    </label>
                    <input
                      id="support-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@pharmacy.co.tz"
                      className="w-full px-3.5 py-2.5 rounded border border-[#E2E8F0] bg-[#F8FAFC] text-sm text-[#0F172A] focus:outline-none focus:border-[#1039B9]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="support-category"
                      className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5"
                    >
                      <FlipText text={isSw ? "Aina" : "Topic"} flipKey={lang} />
                    </label>
                    <select
                      id="support-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value as TicketCategory)}
                      className="w-full px-3.5 py-2.5 rounded border border-[#E2E8F0] bg-[#F8FAFC] text-sm text-[#0F172A] focus:outline-none focus:border-[#1039B9]"
                    >
                      {categories.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="support-subject"
                    className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5"
                  >
                    <FlipText text={isSw ? "Mada" : "Subject"} flipKey={lang} />
                  </label>
                  <input
                    id="support-subject"
                    type="text"
                    required
                    maxLength={200}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={
                      isSw
                        ? "Mfano: Kusanidi mashine ya risiti kaunta"
                        : "e.g. Setting up our thermal receipt printer"
                    }
                    className="w-full px-3.5 py-2.5 rounded border border-[#E2E8F0] bg-[#F8FAFC] text-sm text-[#0F172A] focus:outline-none focus:border-[#1039B9]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="support-message"
                    className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5"
                  >
                    <FlipText text={isSw ? "Ujumbe" : "How can we help?"} flipKey={lang} />
                  </label>
                  <textarea
                    id="support-message"
                    rows={4}
                    required
                    maxLength={5000}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                      isSw
                        ? "Eleza kwa ufupi unachohitaji msaada..."
                        : "Tell us briefly what you need help with..."
                    }
                    className="w-full px-3.5 py-2.5 rounded border border-[#E2E8F0] bg-[#F8FAFC] text-sm text-[#0F172A] focus:outline-none focus:border-[#1039B9] resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded bg-[#1039B9] hover:bg-[#0D2E94] disabled:opacity-60 text-white text-xs font-semibold shadow-xs transition-all"
                >
                  <FlipText
                    text={
                      submitting
                        ? isSw
                          ? "Inatuma..."
                          : "Sending..."
                        : isSw
                          ? "Tuma Tiketi"
                          : "Submit Support Ticket"
                    }
                    flipKey={lang}
                  />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
