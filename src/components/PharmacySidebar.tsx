/**
 * @file components/PharmacySidebar.tsx
 * @description Left navigation sidebar for the pharmacy portal (/dashboard/*).
 *
 * Responsive behaviour:
 *  - lg+ (desktop): permanently fixed 16rem sidebar (unchanged behaviour).
 *  - < lg (mobile/tablet): hidden by default; slides in as an overlay drawer
 *    when the user taps the hamburger rendered by <MobileMenuButton /> in the
 *    page header (the sidebar listens for the SIDEBAR_OPEN_EVENT). Closes on
 *    backdrop tap, Escape, or after navigating via any nav link.
 *
 * Features:
 *  - Active route highlighting via `usePathname()`
 *  - EN/SW language toggle (persisted via LanguageProvider)
 *  - Sign out button (clears Supabase session, redirects to /auth)
 *  - Custom account logo: when `logoUrl` is provided, replaces the Cervos
 *    wordmark with the pharmacy's own branding in the sidebar header.
 *    Falls back to Cervos logo + "Pharmacy OS" if no logo set.
 *
 * @param accountName  - Displayed in the footer as the signed-in account. Optional.
 * @param branchName   - Active branch name shown in a chip below the logo. Optional.
 * @param logoUrl      - Supabase Storage URL of the account's custom logo. Optional.
 *                       Populated after onboarding completes. Falls back to Cervos logo.
 */
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/context";
import MobileDrawer from "@/components/MobileDrawer";
import { SIDEBAR_OPEN_EVENT } from "@/components/sidebar-events";

interface PharmacySidebarProps {
  branchName?: string;
  accountName?: string;
  /** Custom account logo URL from Supabase Storage. Falls back to Cervos logo. */
  logoUrl?: string;
}

export default function PharmacySidebar({ branchName, accountName, logoUrl }: PharmacySidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, setLang, t } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);

  // Demo branches for the organization switcher
  const ORG_BRANCHES = [
    { id: "br-uzuri-cbd", name: "Kariakoo Flagship", subtitle: "Active POS · Station #1", active: true },
    { id: "br-uzuri-upanga", name: "Upanga Dispensary", subtitle: "3 Active Operators", active: false },
    { id: "br-uzuri-mik", name: "Mikocheni Central", subtitle: "2 Active Operators", active: false },
  ];

  // Opened by the hamburger in page headers (<MobileMenuButton />).
  useEffect(() => {
    const open = () => setMobileOpen(true);
    window.addEventListener(SIDEBAR_OPEN_EVENT, open);
    return () => window.removeEventListener(SIDEBAR_OPEN_EVENT, open);
  }, []);

  // Close the drawer whenever the route changes (nav tap from inside drawer).
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function handleLogout() {
    setMobileOpen(false);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth");
    router.refresh();
  }

  const closeMobile = () => setMobileOpen(false);

  const NAV = [
    { labelKey: "portal.dashboard",   href: "/dashboard",             icon: "dashboard" },
    { labelKey: "portal.alerts",      href: "/dashboard/alerts",      icon: "notifications" },
    { labelKey: "portal.inventory",   href: "/dashboard/inventory",   icon: "inventory_2" },
    { labelKey: "portal.marketplace", href: "/dashboard/marketplace", icon: "storefront" },
    { labelKey: "portal.operators",  href: "/dashboard/operators",   icon: "group" },
    { labelKey: "portal.orders",     href: "/dashboard/orders",      icon: "shopping_cart" },
    { labelKey: "portal.branches",    href: "/dashboard/branches",    icon: "storefront" },
    { labelKey: "portal.downloads",   href: "/dashboard/downloads",   icon: "download" },
    { labelKey: "portal.network",     href: "/dashboard/network",     icon: "map" },
    { labelKey: "portal.reports",    href: "/dashboard/reports",    icon: "analytics" },
    { labelKey: "portal.billing",    href: "/dashboard/billing",     icon: "payments" },
    { labelKey: "portal.settings",   href: "/dashboard/settings",    icon: "settings" },
  ];

  const content = (
    <>
      {/* Brand / account header */}
      <div className="px-5 py-4 border-b border-outline-variant flex items-center justify-between gap-2.5">
        <Link href="/" className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 relative flex-shrink-0">
            <Image
              src="/cervos-mark.svg"
              alt="Cervos"
              width={32}
              height={32}
              className="object-contain"
              priority
            />
          </div>
          <div className="min-w-0">
            <span className="font-headline-md text-sm font-bold text-ink-deep block leading-tight">Cervos</span>
            <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">Pharmacy OS</span>
          </div>
        </Link>
        <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">
          Verified
        </span>
      </div>

      {/* Interactive Collapsible Organization & Branch Switcher */}
      <div className="mx-3 mt-3">
        <button
          type="button"
          onClick={() => setOrgMenuOpen((o) => !o)}
          aria-expanded={orgMenuOpen}
          className="w-full text-left p-2.5 rounded-lg border border-outline-variant bg-surface-container-low hover:bg-surface-container transition-colors flex items-center justify-between gap-2 group"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <p className="font-medium text-xs text-ink-deep truncate font-semibold">
                {accountName ?? "Uzuri Pharmacy Group"}
              </p>
            </div>
            <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
              {branchName ?? "Kariakoo Flagship"}
            </p>
          </div>
          <span
            className={`material-symbols-outlined text-[18px] text-on-surface-variant transition-transform duration-200 shrink-0 ${
              orgMenuOpen ? "rotate-180 text-primary" : "group-hover:text-ink-deep"
            }`}
          >
            expand_more
          </span>
        </button>

        {/* Collapsible Branches Dropdown */}
        {orgMenuOpen && (
          <div className="mt-1 p-1.5 rounded-lg border border-outline-variant bg-surface-base shadow-md space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
            <p className="px-2 py-1 font-mono text-[9px] text-on-surface-variant uppercase tracking-wider">
              Connected Branches
            </p>
            {ORG_BRANCHES.map((b) => (
              <div
                key={b.id}
                className={`flex items-center justify-between p-2 rounded text-xs transition-colors ${
                  b.active
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-ink-deep hover:bg-surface-container-low"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate">{b.name}</p>
                  <p className="text-[10px] text-on-surface-variant truncate font-normal font-mono">{b.subtitle}</p>
                </div>
                {b.active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                )}
              </div>
            ))}
            <div className="pt-1 border-t border-outline-variant/60">
              <Link
                href="/dashboard/branches"
                onClick={closeMobile}
                className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-primary font-medium hover:underline"
              >
                <span className="material-symbols-outlined text-[14px]">add</span>
                <span>Manage Branches</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-0.5 px-3 py-3 overflow-y-auto min-h-0 scrollbar-thin [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-outline-variant [&::-webkit-scrollbar-thumb]:rounded-full">
        {NAV.map(item => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMobile}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-on-surface-variant hover:bg-surface-container-low hover:text-ink-deep"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
              <span className="truncate">{t(item.labelKey)}</span>
            </Link>
          );
        })}
        <Link
          href="/download"
          onClick={closeMobile}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors mt-1 ${
            pathname === "/download"
              ? "bg-primary/10 text-primary font-semibold"
              : "text-on-surface-variant hover:bg-surface-container-low hover:text-ink-deep"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          <span className="truncate">{t("portal.download")}</span>
        </Link>
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 mt-auto flex flex-col gap-1 border-t border-outline-variant shrink-0 bg-surface-base">
        {accountName && (
          <div className="px-3 py-1.5 mb-1">
            <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-wider">{t("sidebar.signed_in_as")}</p>
            <p className="text-xs font-semibold text-ink-deep truncate">{accountName}</p>
          </div>
        )}
        <div className="flex items-center gap-2 px-3 py-1.5">
          <span className="material-symbols-outlined text-[16px] text-on-surface-variant">translate</span>
          <div className="flex gap-0.5 bg-surface-container-low border border-outline-variant rounded-md p-0.5">
            {(["EN", "SW"] as const).map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-colors ${
                  lang === l ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-ink-deep"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 text-error hover:bg-error-container/60 transition-colors w-full text-left rounded-lg text-sm font-medium"
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
          <span>{t("portal.logout")}</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      <MobileDrawer open={mobileOpen} onClose={closeMobile}>
        <aside className="bg-surface-base h-full w-64 flex flex-col overflow-hidden">
          {content}
        </aside>
      </MobileDrawer>

      <aside className="hidden lg:flex bg-surface-base fixed left-0 top-0 h-full w-64 border-r border-outline-variant flex-col z-20 overflow-hidden">
        {content}
      </aside>
    </>
  );
}
