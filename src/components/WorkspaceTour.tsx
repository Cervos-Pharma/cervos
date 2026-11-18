"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

interface WorkspaceTourProps {
  open: boolean;
  onClose: (markCompleted: boolean) => void;
  orgName: string;
  branchName: string;
  isDark: boolean;
  isSw: boolean;
  accent: string;
  onJumpTab?: (tab: "overview" | "inventory" | "operations" | "receipts" | "billing" | "team") => void;
}

export default function WorkspaceTour({
  open,
  onClose,
  orgName,
  branchName,
  isDark,
  isSw,
  accent,
  onJumpTab,
}: WorkspaceTourProps) {
  const [step, setStep] = useState(0);

  if (!open || typeof document === "undefined") return null;

  const steps = isSw
    ? [
        {
          title: `Karibu kwenye Kituo cha ${branchName}`,
          badge: "1 / 5 · UTENGAJI WA TAWI",
          body: `${orgName} inaweza kuwa na matawi mengi, lakini stoo, mauzo ya kaunta, risiti, matumizi na soga za timu ya ${branchName} zimetenganishwa kikamilifu. Tumia kibadilisha tawi juu kuangalia tawi lingine.`,
          tip: "Kila duka lina hesabu zake binafsi bila kuchanganyika.",
          tab: "overview" as const,
          actionLabel: "Tazama Muhtasari",
        },
        {
          title: "Kuingia Zamu (Clock In) & Ulinzi wa Kiotomatiki",
          badge: "2 / 5 · ZAMU YA KAZI",
          body: "Unapofungua app nyumbani, hakikisha umeingia zamu ya leo moja kwa moja. Ukiacha app nje kwa saa nyingi bila shughuli, mfumo utakutoa zamu kiotomatiki ili kulinda rekodi za kazi na droo ya fedha.",
          tip: "Hakikisha umefunga droo ya fedha mwisho wa zamu.",
          tab: "overview" as const,
          actionLabel: "Anza Nyumbani",
        },
        {
          title: "Kaunta ya POS & Ulinzi wa FEFO",
          badge: "3 / 5 · MAUZO YA HARAKA",
          body: "Changanua msimbopau au gonga dawa yoyote. Cervos huchagua kiotomatiki toleo lililo karibu zaidi kuisha muda na huzuia dawa zilizopitwa au zilizowekwa karantini.",
          tip: "Andika jina la dawa kwenye Stoo ili kujaza taarifa za awali haraka.",
          tab: "inventory" as const,
          actionLabel: "Fungua Stoo",
        },
        {
          title: "Vifaa Halisi: Printa & Skana ya Msimbopau",
          badge: "4 / 5 · MASHINE NA UTATUZI",
          body: "Unganisha printa halisi ya USB/Serial/Bluetooth na ujaribu skana yako ndani ya Mipangilio ya Vifaa. Kuna mwongozo wa utatuzi wa hatua kwa hatua endapo karatasi haitoki au skana haibonyezi Enter.",
          tip: "Kila risiti ya ukubwa wa 58mm au 80mm inaweza kuchapishwa au kupimwa.",
          tab: "operations" as const,
          actionLabel: "Fungua Vifaa & Mipangilio",
        },
        {
          title: "Soga ya Tawi na Dawati la Msaada HQ",
          badge: "5 / 5 · USHIRIKIANO NA MSAADA",
          body: "Soga ya timu ipo kwa wafanyakazi wa tawi hili pekee. Ukihitaji msaada wa kiufundi au malipo kutoka Cervos HQ, tuma tiketi moja kwa moja kutoka kwenye kikasha cha HQ.",
          tip: "Weka sauti ya arifa au nyamazisha muda wowote kwenye Mipangilio.",
          tab: "receipts" as const,
          actionLabel: "Tazama Risiti",
        },
      ]
    : [
        {
          title: `Welcome to ${branchName} Counter`,
          badge: "1 / 5 · STRICT BRANCH ISOLATION",
          body: `Every branch under ${orgName} keeps its own separate inventory batches, POS sales, receipts, cash drawer, expenses, and staff chat. Switch branches in the top header bar whenever inspecting another location.`,
          tip: "Dispensing or editing stock never touches another branch's shelf.",
          tab: "overview" as const,
          actionLabel: "Go to Counter Home",
        },
        {
          title: "Clock In at Launch & Auto Clock-Out",
          badge: "2 / 5 · SHIFT ATTENDANCE",
          body: "When starting your day, confirm 'Are you in shift?' right at the top of Home before selling. If you stay out of the app for too long, Cervos automatically clocks out your idle shift to protect payroll & cash totals.",
          tip: "Owner and managers can still audit every shift log under Operations.",
          tab: "overview" as const,
          actionLabel: "View Shift Prompt",
        },
        {
          title: "POS Checkout, FEFO & Restock Autofill",
          badge: "3 / 5 · DISPENSARY SAFETY",
          body: "Scan GS1 barcodes or tap medicines to build a basket. Expired or quarantined boxes are automatically blocked. When restocking in Inventory, type any existing brand name to preload generic name, category, pricing, and WebP photo in one tap.",
          tip: "You can also pick from category presets or save new custom categories.",
          tab: "inventory" as const,
          actionLabel: "Inspect Inventory",
        },
        {
          title: "Real Hardware Setup & Troubleshooting",
          badge: "4 / 5 · PRINTER & SCANNER GUIDE",
          body: "Pair a real USB, Serial, or Bluetooth 58mm/80mm thermal receipt printer—or configure OS System Print—under Operations -> Hardware Studio. Built-in scanner calibration and troubleshooting diagnostics help solve paper or USB issues fast.",
          tip: "Checkout Preview shows your real detected printer status, never fake statuses.",
          tab: "operations" as const,
          actionLabel: "Open Hardware Setup",
        },
        {
          title: "Branch-Only Chat, Audio Cues & HQ Support",
          badge: "5 / 5 · TEAM & HELP DESK",
          body: "Team chat and @mentions stay scoped strictly inside this branch. Curated sound effects confirm scans, receipts, alerts, and shift punches (adjustable or mutable anytime). Need Cervos HQ assistance? Open a Support Ticket straight from the HQ Inbox.",
          tip: "Replay this guide anytime from the Guide button in the top bar.",
          tab: "overview" as const,
          actionLabel: "Finish Guide",
        },
      ];

  const current = steps[step] ?? steps[0];
  const cardCls = isDark
    ? "bg-[#11161F] border-slate-700 text-slate-100"
    : "bg-white border-slate-200 text-slate-900";
  const mutedCls = isDark ? "text-slate-400" : "text-slate-600";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isSw ? "Mwongozo wa Kuanzia Cervos" : "Cervos Quick Start Guide"}
      className="fixed inset-0 z-[130] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={() => onClose(true)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-xl rounded-[28px] border p-6 sm:p-7 shadow-2xl space-y-5 animate-stage-pop ${cardCls}`}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-white"
            style={{ backgroundColor: accent }}
          >
            {current.badge}
          </span>
          <button
            type="button"
            onClick={() => onClose(true)}
            className={`text-xs font-semibold hover:underline cursor-pointer ${mutedCls}`}
          >
            {isSw ? "Ruka Mwongozo" : "Skip Guide"}
          </button>
        </div>

        <div className="space-y-2">
          <h2
            className="text-xl font-bold tracking-tight"
            style={{ fontFamily: "Outfit, Inter, sans-serif" }}
          >
            {current.title}
          </h2>
          <p className={`text-sm leading-relaxed ${mutedCls}`}>{current.body}</p>
        </div>

        <div
          className={`rounded-2xl border px-4 py-3 text-xs font-medium ${
            isDark
              ? "border-slate-800 bg-slate-900/70 text-sky-300"
              : "border-blue-100 bg-blue-50/80 text-[#1039B9]"
          }`}
        >
          Tip: {current.tip}
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-1.5">
            {steps.map((s, idx) => (
              <button
                key={s.badge}
                type="button"
                aria-label={`Step ${idx + 1}`}
                onClick={() => setStep(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  idx === step ? "w-6" : "w-2 opacity-35"
                }`}
                style={{ backgroundColor: accent }}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className={`px-3.5 py-2 rounded-full border text-xs font-semibold cursor-pointer ${
                  isDark ? "border-slate-700 text-slate-200" : "border-slate-300 text-slate-700"
                }`}
              >
                {isSw ? "Nyuma" : "Back"}
              </button>
            )}
            {onJumpTab && step < steps.length - 1 && (
              <button
                type="button"
                onClick={() => {
                  onJumpTab(current.tab);
                  setStep((s) => Math.min(steps.length - 1, s + 1));
                }}
                className={`px-3.5 py-2 rounded-full border text-xs font-semibold cursor-pointer ${
                  isDark ? "border-slate-700 text-slate-200" : "border-slate-300 text-slate-700"
                }`}
              >
                {current.actionLabel}
              </button>
            )}
            {step < steps.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="px-5 py-2 rounded-full text-white text-xs font-semibold cursor-pointer"
                style={{ backgroundColor: accent }}
              >
                {isSw ? "Endelea ->" : "Next ->"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onClose(true)}
                className="px-5 py-2 rounded-full text-white text-xs font-semibold cursor-pointer"
                style={{ backgroundColor: accent }}
              >
                {isSw ? "Maliza Mwongozo" : "Start Working"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
