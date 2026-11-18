"use client";

import Link from "next/link";
import { useState } from "react";
import type { TourTabTarget } from "./steps";

interface StationChecklistProps {
  profileId: string;
  orgName: string;
  branchName: string;
  isDark: boolean;
  isSw: boolean;
  accent: string;
  hasActiveShift: boolean;
  batchCount: number;
  saleCount: number;
  onJumpTab: (tab: TourTabTarget) => void;
  onStartTour: () => void;
}

export function StationChecklist({
  profileId,
  branchName,
  isDark,
  isSw,
  accent,
  hasActiveShift,
  batchCount,
  saleCount,
  onJumpTab,
  onStartTour,
}: StationChecklistProps) {
  const storageKey = `cervos-checklist-dismissed-${profileId}`;
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined" || !profileId) return false;
    try {
      return window.localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  const items = [
    {
      id: "shift",
      label: isSw ? "Thibitisha zamu yako ya leo" : "Clock in on launch check",
      done: hasActiveShift,
      action: () => onJumpTab("overview"),
    },
    {
      id: "stock",
      label: isSw ? "Kagua au pokea mzigo stooni" : "Review or add stock batch",
      done: batchCount > 0,
      action: () => onJumpTab("inventory"),
    },
    {
      id: "pos",
      label: isSw ? "Fanya mauzo kwenye Kaunta ya POS" : "Ring up first Counter POS sale",
      done: saleCount > 0,
      action: () => onJumpTab("operations"),
    },
  ];

  const doneCount = items.filter((i) => i.done).length;
  if (dismissed || doneCount === items.length) return null;

  const dismiss = () => {
    try {
      if (profileId) window.localStorage.setItem(storageKey, "1");
    } catch {
      // Ignore storage write block
    }
    setDismissed(true);
  };

  return (
    <div
      className={`rounded-[22px] border p-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        isDark
          ? "bg-[#11161F] border-slate-800 text-slate-100"
          : "bg-white border-[#EAECF0] text-slate-900"
      }`}
    >
      <div className="space-y-1.5 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: accent }}
          >
            {isSw ? "HATUA ZA KUANZA" : "GETTING STARTED"} &middot; {doneCount}/{items.length}
          </span>
          <span className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            {branchName}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.action}
              className={`px-3 py-1.5 rounded-full border text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
                item.done
                  ? isDark
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-emerald-600/25 bg-emerald-50 text-emerald-800"
                  : isDark
                    ? "border-slate-700 bg-slate-900 hover:border-slate-600 text-slate-200"
                    : "border-[#E2E8F0] bg-[#F8FAFC] hover:border-slate-300 text-slate-700"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  item.done ? "bg-emerald-500" : "bg-slate-400"
                }`}
              />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/app/settings?tab=hardware"
          className={`px-3 py-1.5 rounded-full border text-xs font-semibold ${
            isDark
              ? "border-slate-700 text-slate-300 hover:bg-slate-800"
              : "border-[#E2E8F0] text-slate-600 hover:bg-slate-50"
          }`}
        >
          {isSw ? "Vifaa" : "Hardware"}
        </Link>
        <button
          type="button"
          onClick={onStartTour}
          className="px-3.5 py-1.5 rounded-full text-white text-xs font-semibold cursor-pointer"
          style={{ backgroundColor: accent }}
        >
          {isSw ? "Mwongozo" : "Take Tour"}
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="px-2 py-1 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
          aria-label="Hide getting started"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
