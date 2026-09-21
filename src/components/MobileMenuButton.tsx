/**
 * @file components/MobileMenuButton.tsx
 * @description Hamburger button shown in portal page headers below `lg`.
 * Dispatches SIDEBAR_OPEN_EVENT, which the portal sidebar (a client component)
 * listens for to slide in its mobile drawer. Desktop (lg+) renders nothing.
 */
"use client";

import { SIDEBAR_OPEN_EVENT } from "./sidebar-events";

export default function MobileMenuButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(SIDEBAR_OPEN_EVENT))}
      aria-label="Open navigation menu"
      className={`lg:hidden shrink-0 p-2 -ml-1 mr-1 rounded-md text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors ${className}`}
    >
      <span className="material-symbols-outlined text-[22px]">menu</span>
    </button>
  );
}
