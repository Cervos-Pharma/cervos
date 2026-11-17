"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface ForegroundModalProps {
  open: boolean;
  onClose: () => void;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  backdropClassName?: string;
  panelClassName?: string;
  children: React.ReactNode;
}

/**
 * Renders a centered viewport overlay directly into document.body so parent
 * transforms or overflow rules never shift the popped card out of view.
 */
export default function ForegroundModal({
  open,
  onClose,
  ariaLabel,
  ariaLabelledBy,
  backdropClassName = "bg-slate-950/60 backdrop-blur-md",
  panelClassName = "w-full max-w-4xl",
  children,
}: ForegroundModalProps) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = requestAnimationFrame(() => {
      panelRef.current?.focus({ preventScroll: true });
    });

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleEsc);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 h-dvh w-screen overflow-y-auto flex items-center justify-center p-4 sm:p-6 ${backdropClassName}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className={`relative my-auto outline-none animate-stage-pop ${panelClassName}`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
