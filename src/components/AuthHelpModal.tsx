"use client";

import { useEffect, useState } from "react";
import ForegroundModal from "@/components/ForegroundModal";
import { submitSupportTicket, type TicketCategory } from "@/lib/actions/support";
import { IconCheck } from "@/components/LandingIcons";

interface AuthHelpModalProps {
  open: boolean;
  onClose: () => void;
  isSw: boolean;
  defaultEmail?: string;
}

export default function AuthHelpModal({
  open,
  onClose,
  isSw,
  defaultEmail = "",
}: AuthHelpModalProps) {
  const [openFaq, setOpenFaq] = useState<number>(0);
  const [contactEmail, setContactEmail] = useState(defaultEmail);
  const [category, setCategory] = useState<TicketCategory>("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [ticketSent, setTicketSent] = useState(false);

  useEffect(() => {
    if (defaultEmail && !contactEmail) {
      setContactEmail(defaultEmail);
    }
  }, [defaultEmail, contactEmail]);

  const faqs = isSw
    ? [
        {
          q: "Ninaanza vipi akaunti ya Duka la Dawa, Zahanati, au Msambazaji?",
          a: "Chagua jukumu lako kwenye hatua ya pili ya kujisajili, jaza jina la kituo, mkoa au kanda unayohudumia, na mahitaji yako ya msingi. Akaunti inafunguliwa moja kwa moja na unaweza kuunganisha kaunta yako siku hiyo hiyo.",
        },
        {
          q: "Kaunta ya Cervos inaendelea kufanya kazi mtandao ukikatika?",
          a: "Ndiyo. Mauzo, skani za dawa na risiti za wateja zinahifadhiwa kwanza kwenye kifaa chako na kusawazishwa kiotomatiki pindi muunganisho ukirudi.",
        },
        {
          q: "Malipo ya oda za jumla kupitia Kasri\u2122 yanafanyaje kazi?",
          a: "Malipo ya agizo yanahifadhiwa kwa usalama ndani ya Kasri\u2122 na kufunguliwa moja kwa moja pindi mnunuzi akithibitisha kupokea mzigo halali dukani.",
        },
        {
          q: "Nimepoteza nywila au siwezi kuingia kwenye tawi langu, nafanyeje?",
          a: "Unaweza kutumia fomu ya Tiketi ya Msaada hapa chini na timu yetu ya Dar es Salaam itawasiliana nawe ndani ya saa za kazi kuthibitisha umiliki na kufungua ufikiaji wako.",
        },
      ]
    : [
        {
          q: "Which onboarding track should I choose during sign up?",
          a: "Select Pharmacy for retail counters and community branches, Clinic or Dispensary for patient care teams, or Wholesaler and Depot if you distribute stock across regions.",
        },
        {
          q: "Does my counter stay working when mobile internet drops?",
          a: "Yes. Every checkout writes straight to your local counter workstation first and syncs quietly whenever connectivity returns.",
        },
        {
          q: "How does Kasri\u2122 protect wholesale orders between buyers and suppliers?",
          a: "Funds placed on an order stay protected in Kasri\u2122 during transit and release straight to the supplier once arriving stock is scanned at the dispensary.",
        },
        {
          q: "What if I forgot my team credentials or need approval help?",
          a: "Submit a quick support ticket right below using your pharmacy or warehouse email. Our support desk in Dar es Salaam replies promptly with assistance.",
        },
      ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTicketError(null);
    setSubmitting(true);
    try {
      const res = await submitSupportTicket({
        contactEmail: contactEmail.trim(),
        category,
        subject: subject.trim(),
        message: message.trim(),
      });
      if (res?.error) {
        setTicketError(res.error);
      } else {
        setTicketSent(true);
        setSubject("");
        setMessage("");
      }
    } catch {
      setTicketError(
        isSw
          ? "Imeshindikana kutuma ombi kwa sasa. Tafadhali jaribu tena."
          : "Unable to reach support right now. Please try again shortly."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ForegroundModal
      open={open}
      onClose={onClose}
      ariaLabelledBy="auth-help-title"
      backdropClassName="bg-slate-950/65 backdrop-blur-sm"
      panelClassName="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl"
    >
      <div>
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-xs px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#1039B9] mb-1">
              {isSw ? "MSAADA & MASWALI YA MARA KWA MARA" : "ONBOARDING HELP & FAQ"}
            </div>
            <h2
              id="auth-help-title"
              className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              {isSw ? "Majibu ya haraka na Tiketi ya Msaada" : "Answers & Direct Support"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isSw ? "Funga dirisha la msaada" : "Close help modal"}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-[#0F172A] flex items-center justify-center shrink-0 cursor-pointer text-lg font-medium"
          >
            &times;
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Focus FAQ Accordion Card */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] overflow-hidden divide-y divide-slate-200/80">
            {faqs.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaq(isOpen ? -1 : idx)}
                    className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-white/80 transition-colors cursor-pointer"
                  >
                    <span className="text-xs sm:text-sm font-bold text-[#0F172A]">{item.q}</span>
                    <svg
                      className={`w-4 h-4 text-[#1039B9] shrink-0 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 text-xs sm:text-sm text-[#475569] leading-relaxed bg-white">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Embedded Support Ticket Desk Directly Below FAQ */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#006875]">
                  {isSw ? "TUMA TIKETI YA MSAADA" : "OPEN A SUPPORT TICKET"}
                </div>
                <p className="text-xs text-[#475569] mt-0.5">
                  {isSw
                    ? "Bado unahitaji msaada? Andika ujumbe na timu yetu itakujibu."
                    : "Still need personal help setting up your account? Message our support team below."}
                </p>
              </div>
              <span className="text-[11px] font-semibold text-[#1039B9]">support@cervos.online</span>
            </div>

            {ticketSent ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <IconCheck className="w-3.5 h-3.5" />
                </span>
                <div className="text-xs sm:text-sm text-[#0F172A]">
                  <div className="font-bold">
                    {isSw ? "Tiketi imepokelewa!" : "Support ticket received."}
                  </div>
                  <p className="text-[#475569] mt-0.5">
                    {isSw
                      ? "Timu yetu ya huduma kwa wateja itawasiliana nawe kupitia barua pepe."
                      : "Our customer team in Dar es Salaam has logged your request and will reply by email."}
                  </p>
                  <button
                    type="button"
                    onClick={() => setTicketSent(false)}
                    className="mt-2.5 text-xs font-bold text-[#1039B9] hover:underline cursor-pointer"
                  >
                    {isSw ? "Tuma ujumbe mwingine" : "Send another message"}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      {isSw ? "Barua Pepe Yako" : "Your Email"}
                    </label>
                    <input
                      type="email"
                      required
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="owner@pharmacy.co.tz"
                      className="w-full px-3.5 py-2 rounded-lg border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none focus:border-[#1039B9]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      {isSw ? "Aina ya Msaada" : "Topic"}
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as TicketCategory)}
                      className="w-full px-3.5 py-2 rounded-lg border border-[#E2E8F0] text-xs text-[#0F172A] bg-white focus:outline-none focus:border-[#1039B9]"
                    >
                      <option value="general">{isSw ? "Kuanzisha Akaunti" : "Account & Onboarding"}</option>
                      <option value="technical">{isSw ? "Msaada wa Kiufundi" : "Technical / Sync"}</option>
                      <option value="billing">{isSw ? "Malipo & Kasri\u2122" : "Billing & Kasri\u2122"}</option>
                      <option value="other">{isSw ? "Mengineyo" : "Other Question"}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    {isSw ? "Kichwa cha Ombi" : "Subject"}
                  </label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={isSw ? "Mfano: Msaada wa kusanidi tawi" : "e.g. Need help connecting our dispensary"}
                    className="w-full px-3.5 py-2 rounded-lg border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none focus:border-[#1039B9]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    {isSw ? "Maelezo" : "Message"}
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                      isSw
                        ? "Eleza kwa kifupi jinsi tunavyoweza kusaidia..."
                        : "Share what you need help with and your preferred contact details..."
                    }
                    className="w-full px-3.5 py-2 rounded-lg border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none focus:border-[#1039B9] resize-none"
                  />
                </div>

                {ticketError && (
                  <p className="text-xs text-rose-600 font-medium">{ticketError}</p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-[#1039B9] hover:bg-[#0D2E94] disabled:opacity-60 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  {submitting
                    ? isSw
                      ? "Inatuma..."
                      : "Sending..."
                    : isSw
                      ? "Tuma Tiketi ya Msaada"
                      : "Submit Support Ticket"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </ForegroundModal>
  );
}
