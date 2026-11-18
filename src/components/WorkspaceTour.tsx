"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { buildWorkspaceTourSteps, type TourTabTarget } from "@/components/onboarding/steps";

interface WorkspaceTourProps {
  open: boolean;
  onClose: (markCompleted: boolean) => void;
  orgName: string;
  branchName: string;
  isDark: boolean;
  isSw: boolean;
  accent: string;
  onJumpTab?: (tab: TourTabTarget) => void;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
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
  const [rect, setRect] = useState<TargetRect | null>(null);
  const [vp, setVp] = useState<{ w: number; h: number }>({ w: 1200, h: 800 });

  const steps = buildWorkspaceTourSteps({ orgName, branchName, isSw });
  const current = steps[step] ?? steps[0];

  const measureTarget = useCallback((shouldScroll: boolean) => {
    if (typeof window === "undefined") return;
    setVp({ w: window.innerWidth, h: window.innerHeight });

    if (!current.target) {
      setRect(null);
      return;
    }

    const el = document.querySelector(current.target);
    if (!el) {
      setRect(null);
      return;
    }

    if (shouldScroll) {
      try {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      } catch {
        // Ignore smooth scroll fallback error
      }
    }

    const box = el.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) {
      setRect(null);
      return;
    }

    const pad = 8;
    setRect({
      top: Math.max(8, box.top - pad),
      left: Math.max(8, box.left - pad),
      width: Math.min(window.innerWidth - 16, box.width + pad * 2),
      height: box.height + pad * 2,
    });
  }, [current.target]);

  useEffect(() => {
    if (!open) {
      setStep(0);
      setRect(null);
      return;
    }

    if (onJumpTab && current.tab) {
      onJumpTab(current.tab);
    }

    const t1 = setTimeout(() => measureTarget(true), 80);
    const t2 = setTimeout(() => measureTarget(false), 380);
    const onResizeOrScroll = () => measureTarget(false);

    window.addEventListener("resize", onResizeOrScroll);
    window.addEventListener("scroll", onResizeOrScroll, true);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", onResizeOrScroll);
      window.removeEventListener("scroll", onResizeOrScroll, true);
    };
  }, [open, step, current.tab, measureTarget, onJumpTab]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose(true);
      } else if (e.key === "ArrowRight") {
        setStep((s) => Math.min(steps.length - 1, s + 1));
      } else if (e.key === "ArrowLeft") {
        setStep((s) => Math.max(0, s - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, steps.length]);

  if (!open || typeof document === "undefined") return null;

  const cardCls = isDark
    ? "bg-[#11161F] border-slate-700 text-slate-100"
    : "bg-white border-slate-200 text-slate-900";
  const mutedCls = isDark ? "text-slate-400" : "text-slate-600";

  // Anchor spotlight popover cleanly below or above the target; center when no target rect
  const cardWidth = Math.min(460, vp.w - 32);
  let anchoredStyle: React.CSSProperties | undefined;
  if (rect && vp.w >= 640) {
    const spaceBelow = vp.h - (rect.top + rect.height);
    const placeBelow = spaceBelow >= 260 || rect.top < 250;
    const rawTop = placeBelow ? rect.top + rect.height + 14 : Math.max(16, rect.top - 300);
    const clampedTop = Math.min(Math.max(16, rawTop), Math.max(16, vp.h - 310));
    const clampedLeft = Math.min(Math.max(16, rect.left), Math.max(16, vp.w - cardWidth - 16));
    anchoredStyle = {
      position: "fixed",
      top: clampedTop,
      left: clampedLeft,
      width: cardWidth,
    };
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isSw ? "Mwongozo wa Kuanzia Cervos" : "Cervos Quick Start Guide"}
      className="fixed inset-0 z-[130]"
      onClick={() => onClose(true)}
    >
      {rect ? (
        <div
          aria-hidden="true"
          className="fixed rounded-[20px] pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            boxShadow: "0 0 0 9999px rgba(2, 6, 23, 0.62)",
            border: `2px solid ${accent}`,
          }}
        />
      ) : (
        <div aria-hidden="true" className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs" />
      )}

      <div
        onClick={(e) => e.stopPropagation()}
        style={anchoredStyle}
        className={`${
          anchoredStyle
            ? ""
            : "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-lg"
        } rounded-[26px] border p-5 sm:p-6 shadow-2xl space-y-4 animate-stage-pop z-[131] ${cardCls}`}
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
            className={`px-3 py-1 rounded-full border text-xs font-semibold cursor-pointer ${
              isDark ? "border-slate-700 text-slate-300" : "border-slate-200 text-slate-600"
            }`}
          >
            {isSw ? "Ruka" : "Skip Tour"}
          </button>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold tracking-tight" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
            {current.title}
          </h2>
          <p className={`text-xs sm:text-[13px] leading-relaxed ${mutedCls}`}>{current.body}</p>
        </div>

        <div
          className={`rounded-2xl border px-3.5 py-2.5 text-xs font-medium ${
            isDark
              ? "border-slate-800 bg-slate-900/70 text-sky-300"
              : "border-blue-100 bg-blue-50/80 text-[#1039B9]"
          }`}
        >
          Tip: {current.tip}
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-1.5">
            {steps.map((s, idx) => (
              <button
                key={s.id}
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
            {onJumpTab && current.actionLabel && (
              <button
                type="button"
                onClick={() => {
                  onJumpTab(current.tab === "overview" ? "operations" : current.tab);
                  onClose(true);
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
                {isSw ? "Endelea" : "Next"}
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
