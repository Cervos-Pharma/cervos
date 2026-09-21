/**
 * @file components/MobileDrawer.tsx
 * @description Reusable slide-in/out drawer for mobile navigation.
 *
 * Used by every portal sidebar (pharmacy, supplier, branch, HQ) so each has a
 * consistent mobile pattern: below `minWidth` px the sidebar renders inside an
 * overlay drawer that slides in from the left; above it the sidebar stays
 * fixed. The drawer closes on backdrop tap, Escape, route change, or when the
 * parent sets `open = false` (e.g. after a nav link tap).
 *
 * @param open        - Whether the drawer is visible (controlled by the parent).
 * @param onClose     - Called when the user dismisses the drawer (backdrop, Escape).
 * @param children    - Sidebar content (the full sidebar tree is rendered inside).
 * @param minWidth    - Tailwind breakpoint px width that hides the drawer on
 *                      desktop (e.g. 1024 for `lg:`). Defaults to 1024.
 */
"use client";

import { useEffect } from "react";

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Tailwind breakpoint px above which the drawer is hidden (1024 = lg). */
  minWidth?: number;
}

const BP_CLASS: Record<number, string> = {
  768: "md:hidden",
  1024: "lg:hidden",
};

export default function MobileDrawer({ open, onClose, children, minWidth = 1024 }: MobileDrawerProps) {
  // Only render below the given breakpoint, so desktop always shows the
  // permanent fixed sidebar and the drawer exists solely for small screens.
  const hiddenClass = BP_CLASS[minWidth] ?? BP_CLASS[1024];

  // Lock body scroll + close on Escape while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={`fixed inset-0 z-50 ${hiddenClass}`} role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-[fadeIn_.15s_ease-out]"
        onClick={onClose}
        aria-hidden
      />
      {/* Slide-in panel — sidebar content is rendered inside by the parent.
          NO animation fill-mode: the panel's resting style is its natural
          on-screen position, so after the slide (or if animations are
          disabled entirely) the drawer is always visible in place. */}
      <div className="absolute left-0 top-0 bottom-0 w-64 max-w-[85vw] bg-surface shadow-2xl animate-[slideInLeft_.2s_ease-out] overflow-hidden">
        {children}
      </div>
    </div>
  );
}
