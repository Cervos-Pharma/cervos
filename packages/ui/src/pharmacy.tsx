"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  formatTzs,
  normalizeCervosRole,
  resolvePermissions,
  STAKEHOLDER_LENS_CATALOG,
} from "@cervos/core";

export interface MoneyProps {
  amount: number | null | undefined;
  compact?: boolean;
  showSign?: boolean;
  className?: string;
}

export function Money({ amount, compact = false, showSign = false, className = "" }: MoneyProps) {
  const formatted = formatTzs(amount, { compact, showSign });
  return <span className={`tabular-nums font-medium ${className}`.trim()}>{formatted}</span>;
}

export interface ExpiryBadgeProps {
  expiryDate: string | null | undefined;
  quarantined?: boolean;
  referenceDate?: string;
}

export function ExpiryBadge({ expiryDate, quarantined = false, referenceDate }: ExpiryBadgeProps) {
  const status = useMemo(() => {
    if (quarantined) {
      return {
        label: "Quarantined",
        icon: "gpp_bad",
        classes: "bg-error-container text-on-error-container border-error/30",
      };
    }
    if (!expiryDate) {
      return {
        label: "No Expiry Set",
        icon: "help_outline",
        classes: "bg-surface-container text-on-surface-variant border-outline-variant",
      };
    }
    const refMs = referenceDate ? Date.parse(referenceDate) : Date.now();
    const expMs = Date.parse(expiryDate);
    if (Number.isNaN(expMs)) {
      return {
        label: "Invalid Date",
        icon: "warning",
        classes: "bg-error-container text-on-error-container border-error/30",
      };
    }
    const diffDays = Math.ceil((expMs - refMs) / 86_400_000);
    if (diffDays < 0) {
      return {
        label: `Expired (${expiryDate.slice(0, 10)})`,
        icon: "block",
        classes: "bg-error-container text-on-error-container border-error/30",
      };
    }
    if (diffDays <= 60) {
      return {
        label: `Expiring in ${diffDays}d`,
        icon: "schedule",
        classes: "bg-secondary-fixed text-on-secondary-fixed border-secondary/30",
      };
    }
    return {
      label: `FEFO Safe (${expiryDate.slice(0, 10)})`,
      icon: "verified_user",
      classes: "bg-tertiary-fixed text-on-tertiary-fixed border-tertiary/30",
    };
  }, [expiryDate, quarantined, referenceDate]);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tabular-nums ${status.classes}`}
    >
      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
        {status.icon}
      </span>
      <span>{status.label}</span>
    </span>
  );
}

export function StakeholderPill({ role }: { role: string | null | undefined }) {
  const canonical = normalizeCervosRole(role);
  const permissions = resolvePermissions(canonical);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-low px-2.5 py-0.5 text-xs font-semibold text-on-surface">
      <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
      <span className="capitalize">{permissions.stakeholder.replace("_", " ")}</span>
      <span className="text-on-surface-variant">·</span>
      <span className="font-mono text-[11px] text-primary">{canonical}</span>
    </span>
  );
}

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const confirmClasses =
    tone === "danger"
      ? "bg-error text-on-error hover:bg-on-error-container"
      : "bg-primary text-on-primary hover:bg-primary-variant";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cervos-confirm-title"
    >
      <div className="w-full max-w-md overscroll-contain rounded-xl border border-outline-variant bg-surface-base p-6 shadow-xl">
        <h2 id="cervos-confirm-title" className="font-headline-md text-lg font-semibold text-on-surface">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{description}</p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg border border-outline-variant bg-surface-base px-4 py-2 text-sm font-medium text-on-surface transition-[background-color,transform] duration-150 ease-out hover:bg-surface-container-low enabled:active:scale-[0.96] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-[background-color,transform] duration-150 ease-out enabled:active:scale-[0.96] disabled:opacity-50 ${confirmClasses}`}
          >
            {busy ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export interface CommandItem {
  id: string;
  label: string;
  subtitle: string;
  href: string;
  keywords?: string;
}

const DEFAULT_COMMANDS: CommandItem[] = [
  {
    id: "portal-dashboard",
    label: "Pharmacy Owner Dashboard",
    subtitle: "Command multi-branch sales, inventory, accounting and restock",
    href: "/dashboard",
    keywords: "owner pharmacy dashboard sales profit accounting inventory",
  },
  {
    id: "portal-branch",
    label: "Branch Operator Counter POS",
    subtitle: "Rapid dispensing, FEFO allocation, stock batches and cash shifts",
    href: "/branch",
    keywords: "branch counter pos dispenser cashier sales shift stock",
  },
  {
    id: "portal-supplier",
    label: "Wholesale Supplier Portal",
    subtitle: "Depot logistics, catalog orders, quotes and buyer branches",
    href: "/supplier",
    keywords: "supplier wholesale distributor catalog orders logistics depot",
  },
  {
    id: "portal-hq",
    label: "Cervos Central HQ Console",
    subtitle: "National accounts, billing, network telemetry and audit",
    href: "/hq",
    keywords: "hq console central network admin accounts billing audit",
  },
  {
    id: "portal-design-lab",
    label: "Interactive Design Lab",
    subtitle: "Spatial Glass Studio & component specimen laboratory",
    href: "/design-lab",
    keywords: "design lab taste spatial glass tokens ui",
  },
  ...STAKEHOLDER_LENS_CATALOG.map((lens) => ({
    id: `lens-${lens.group}`,
    label: `${lens.order}. ${lens.label}`,
    subtitle: lens.summary,
    href: lens.defaultRoute,
    keywords: `${lens.group} ${lens.roles.join(" ")}`,
  })),
  {
    id: "ecosystem-hub",
    label: "Unified 8-Stakeholder Ecosystem Console",
    subtitle: "Inspect connected Patient, Owner, Operator, Regulator, Researcher, Hospital, Supplier & Prescriber flows",
    href: "/ecosystem",
    keywords: "ecosystem 8 stakeholders hub",
  },
  {
    id: "billing",
    label: "Pharmacy Commercial Tiers & Billing",
    subtitle: "PAYG, Community Standard, Chain Growth, Hospital & Institutional plans",
    href: "/dashboard/billing",
    keywords: "billing payme subscription plans",
  },
  {
    id: "download",
    label: "Install Native POS Desktop / Android",
    subtitle: "Download offline terminal builds",
    href: "/download",
    keywords: "tauri apk windows download",
  },
];

export function CervosCommandBar({
  onNavigate,
  showFloatingTrigger = false,
}: {
  onNavigate?: (href: string) => void;
  showFloatingTrigger?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const onCustomOpen = () => setOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("cervos:open-command-bar", onCustomOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("cervos:open-command-bar", onCustomOpen);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DEFAULT_COMMANDS;
    return DEFAULT_COMMANDS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        (item.keywords ?? "").toLowerCase().includes(q)
    );
  }, [query]);

  const navigateTo = (href: string) => {
    setOpen(false);
    setQuery("");
    if (onNavigate) {
      onNavigate(href);
    } else if (typeof window !== "undefined") {
      window.location.assign(href);
    }
  };

  return (
    <>
      {showFloatingTrigger && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-base px-3 py-1.5 text-xs font-medium text-on-surface shadow-sm transition-[background-color,transform] duration-150 ease-out hover:bg-surface-container-low enabled:active:scale-[0.96]"
        >
          <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
            search
          </span>
          <span>Switch Workspace</span>
          <kbd className="rounded bg-surface-container px-1.5 py-0.5 font-mono text-[10px] text-on-surface-variant">
            Ctrl+K
          </kbd>
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center bg-on-surface/35 p-4 pt-20 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Cervos Command Bar"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl overflow-hidden rounded-xl border border-outline-variant bg-surface-base shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-outline-variant px-4 py-3">
              <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">
                hub
              </span>
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Jump to any of the 8 Cervos stakeholders, portal, or tool..."
                className="w-full bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded px-2 py-1 text-xs font-medium text-on-surface-variant hover:bg-surface-container-low"
              >
                Esc
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto overscroll-contain p-2">
              {filtered.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-on-surface-variant">
                  No matching workspace found.
                </p>
              ) : (
                <ul className="space-y-1">
                  {filtered.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => navigateTo(item.href)}
                        className="flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-[background-color,transform] duration-150 ease-out hover:bg-surface-container-low enabled:active:scale-[0.99]"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-on-surface">{item.label}</div>
                          <div className="mt-0.5 truncate text-xs text-on-surface-variant">
                            {item.subtitle}
                          </div>
                        </div>
                        <span className="shrink-0 font-mono text-[11px] text-primary">{item.href}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

