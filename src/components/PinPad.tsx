"use client";

import { useEffect } from "react";

interface PinPadProps {
  value: string;
  maxLength?: number;
  isDark: boolean;
  isSw?: boolean;
  busy?: boolean;
  onChange: (nextPin: string) => void;
  onSubmit?: () => void;
}

/**
 * Tactile 3x4 numeric PIN pad for PWA, native desktop, and workstation counters.
 * Supports pointer/touch taps as well as hardware keyboard digits 0-9, Backspace, and Enter.
 */
export default function PinPad({
  value,
  maxLength = 6,
  isDark,
  isSw = false,
  busy = false,
  onChange,
  onSubmit,
}: PinPadProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (busy) return;
      const targetTag = (e.target as HTMLElement | null)?.tagName;
      if (targetTag === "INPUT" || targetTag === "TEXTAREA") return;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        if (value.length < maxLength) {
          onChange(`${value}${e.key}`);
        }
      } else if (e.key === "Backspace") {
        e.preventDefault();
        if (value.length > 0) {
          onChange(value.slice(0, -1));
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onChange("");
      } else if (e.key === "Enter" && value.length >= 4 && onSubmit) {
        e.preventDefault();
        onSubmit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [value, maxLength, busy, onChange, onSubmit]);

  const appendDigit = (digit: string) => {
    if (busy || value.length >= maxLength) return;
    onChange(`${value}${digit}`);
  };

  const backspace = () => {
    if (busy || value.length === 0) return;
    onChange(value.slice(0, -1));
  };

  const clear = () => {
    if (busy) return;
    onChange("");
  };

  const keyCls = isDark
    ? "bg-slate-900/90 hover:bg-slate-800 active:bg-[#1039B9]/30 border-slate-700/80 text-white"
    : "bg-white hover:bg-slate-50 active:bg-slate-200 border-[#E2E8F0] text-slate-900 shadow-xs";

  const utilCls = isDark
    ? "bg-slate-900/50 hover:bg-slate-800 border-slate-800 text-slate-300"
    : "bg-[#F8FAFC] hover:bg-slate-100 border-[#E2E8F0] text-slate-600";

  return (
    <div className="space-y-3 select-none">
      {/* PIN Dot Display */}
      <div
        className={`flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl border ${
          isDark ? "bg-slate-900/70 border-slate-800" : "bg-[#F8FAFC] border-[#E2E8F0]"
        }`}
        aria-label={isSw ? "Tarakimu za PIN" : "PIN digits entered"}
      >
        {Array.from({ length: maxLength }).map((_, idx) => {
          const filled = idx < value.length;
          return (
            <span
              key={idx}
              className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                filled
                  ? isDark
                    ? "bg-[#38BDF8] scale-110"
                    : "bg-[#1039B9] scale-110"
                  : isDark
                    ? "bg-slate-700/70 scale-95"
                    : "bg-slate-300 scale-95"
              }`}
            />
          );
        })}
      </div>

      {/* 3x4 Numeric Keypad */}
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={busy}
            onClick={() => appendDigit(digit)}
            className={`min-h-[52px] rounded-xl border text-lg font-bold transition-all cursor-pointer active:scale-[0.97] ${keyCls}`}
          >
            {digit}
          </button>
        ))}

        <button
          type="button"
          disabled={busy || value.length === 0}
          onClick={clear}
          className={`min-h-[52px] rounded-xl border text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-45 ${utilCls}`}
        >
          {isSw ? "Futa" : "Clear"}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => appendDigit("0")}
          className={`min-h-[52px] rounded-xl border text-lg font-bold transition-all cursor-pointer active:scale-[0.97] ${keyCls}`}
        >
          0
        </button>

        <button
          type="button"
          disabled={busy || value.length === 0}
          onClick={backspace}
          aria-label="Backspace"
          className={`min-h-[52px] rounded-xl border text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-45 ${utilCls}`}
        >
          {isSw ? "Nyuma" : "Del"}
        </button>
      </div>
    </div>
  );
}
