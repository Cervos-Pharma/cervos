"use client";

import { useEffect, useState } from "react";

interface DispatchInteractionsProps {
  slug: string;
  baseUpvotes: number;
  title: string;
  isSw: boolean;
  compact?: boolean;
}

type VoteState = "up" | "down" | null;

function readVotesMap(): Record<string, VoteState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("cervos-dispatch-votes");
    return raw ? (JSON.parse(raw) as Record<string, VoteState>) : {};
  } catch {
    return {};
  }
}

function writeVotesMap(next: Record<string, VoteState>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("cervos-dispatch-votes", JSON.stringify(next));
  } catch {
    // Ignore storage restriction
  }
}

export default function DispatchInteractions({
  slug,
  baseUpvotes,
  title,
  isSw,
  compact = false,
}: DispatchInteractionsProps) {
  const [vote, setVote] = useState<VoteState>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const map = readVotesMap();
    setVote(map[slug] ?? null);
  }, [slug]);

  const toggleVote = (target: "up" | "down") => {
    const next: VoteState = vote === target ? null : target;
    setVote(next);
    const map = readVotesMap();
    map[slug] = next;
    writeVotesMap(map);
  };

  const shareArticle = async () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/dispatch/${slug}`
        : `/dispatch/${slug}`;

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // User cancelled or unsupported fallback to clipboard
      }
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // Fallback harmless
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const displayedUpvotes = baseUpvotes + (vote === "up" ? 1 : 0);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Upvote Pill (Displays Live Count Only) */}
      <button
        type="button"
        onClick={() => toggleVote("up")}
        aria-pressed={vote === "up"}
        aria-label={isSw ? "Penda makala hii" : "Upvote article"}
        className={`inline-flex items-center gap-1.5 rounded-full border font-semibold transition-all cursor-pointer tabular-nums ${
          compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-xs sm:text-sm"
        } ${
          vote === "up"
            ? "bg-[#1039B9] text-white border-[#1039B9] shadow-2xs"
            : "bg-white text-[#0F172A] border-[#E2E8F0] hover:border-[#1039B9]/50"
        }`}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
        <span>{displayedUpvotes}</span>
      </button>

      {/* Quiet Downvote Toggle (No Numeric Count Displayed) */}
      <button
        type="button"
        onClick={() => toggleVote("down")}
        aria-pressed={vote === "down"}
        aria-label={isSw ? "Haikufaa" : "Downvote article"}
        title={isSw ? "Punguza kama hizi" : "Show fewer like this"}
        className={`inline-flex items-center justify-center rounded-full border transition-all cursor-pointer ${
          compact ? "w-8 h-8" : "w-9 h-9"
        } ${
          vote === "down"
            ? "bg-[#0F172A] text-white border-[#0F172A]"
            : "bg-white text-slate-500 border-[#E2E8F0] hover:text-[#0F172A] hover:border-slate-300"
        }`}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Share via Direct URL */}
      <button
        type="button"
        onClick={shareArticle}
        className={`inline-flex items-center gap-1.5 rounded-full border font-semibold transition-all cursor-pointer ${
          compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-xs sm:text-sm"
        } ${
          copied
            ? "bg-emerald-50 border-emerald-300 text-emerald-800"
            : "bg-white border-[#E2E8F0] text-slate-600 hover:text-[#1039B9] hover:border-[#1039B9]/40"
        }`}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
          />
        </svg>
        <span>
          {copied
            ? isSw
              ? "Kiungo kimenakiliwa"
              : "Link copied"
            : isSw
              ? "Shiriki"
              : "Share"}
        </span>
      </button>
    </div>
  );
}
