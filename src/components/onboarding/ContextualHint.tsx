"use client";

import { useState } from "react";

interface ContextualHintProps {
  id: string;
  children: React.ReactNode;
  accent: string;
  isDark: boolean;
}

export function ContextualHint({ id, children, accent, isDark }: ContextualHintProps) {
  const storageKey = `cervos-hint-${id}`;
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // Ignore storage failures
    }
    setDismissed(true);
  };

  return (
    <div
      className={`rounded-2xl border px-3.5 py-2.5 text-xs flex items-center justify-between gap-3 ${
        isDark
          ? "bg-slate-900/70 border-slate-800 text-slate-300"
          : "bg-[#F8FAFC] border-[#E2E8F0] text-slate-700"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: accent }}
        />
        <span className="leading-snug">{children}</span>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 cursor-pointer shrink-0"
      >
        Dismiss
      </button>
    </div>
  );
}
