/**
 * @file components/SupplierSidebar.tsx
 * @description Left navigation sidebar for the supplier portal (/supplier/*).
 *
 * Responsive behaviour:
 *  - lg+ (desktop): permanently fixed 16rem sidebar.
 *  - < lg: slides in as an overlay drawer (opened via the hamburger in the
 *    page header / SIDEBAR_OPEN_EVENT). Previously the sidebar was simply
 *    `hidden md:flex`, leaving mobile users with no navigation at all.
 *
 * Features:
 *  - Active route highlighting via `usePathname()`
 *  - EN/SW language toggle (persisted via LanguageProvider)
 *  - Sign out button (clears Supabase session, redirects to /auth)
 *  - Custom account logo: when `logoUrl` is provided, shows the supplier's
 *    company logo in the sidebar header instead of the generic "Cervos" text.
 *    Populated after onboarding completes; falls back to wordmark.
 *
 * @param accountName - Displayed in the footer as the signed-in account. Optional.
 * @param logoUrl     - Supabase Storage URL of the account's custom logo. Optional.
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

interface SupplierSidebarProps {
  accountName?: string;
  /** Custom account logo URL from Supabase Storage. Falls back to Cervos wordmark. */
  logoUrl?: string;
}

export default function SupplierSidebar({ accountName, logoUrl }: SupplierSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, setLang, t } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const open = () => setMobileOpen(true);
    window.addEventListener(SIDEBAR_OPEN_EVENT, open);
    return () => window.removeEventListener(SIDEBAR_OPEN_EVENT, open);
  }, []);

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
    { labelKey: "portal.dashboard",   href: "/supplier",              icon: "dashboard" },
    { labelKey: "sup.catalog",        href: "/supplier/catalog",      icon: "inventory_2" },
    { labelKey: "sup.orders",         href: "/supplier/orders",        icon: "receipt_long" },
    { labelKey: "sup.alerts",         href: "/supplier/alerts",        icon: "notifications_active" },
    { labelKey: "sup.analytics",      href: "/supplier/analytics",    icon: "monitoring" },
    { labelKey: "sup.storefront",     href: "/supplier/storefront",    icon: "storefront" },
    { labelKey: "sup.connections",    href: "/supplier/connections",  icon: "hub" },
    { labelKey: "sup.subscription",   href: "/supplier/subscription", icon: "workspace_premium" },
    { labelKey: "sup.activity",       href: "/supplier/activity",      icon: "history" },
    { labelKey: "portal.settings",    href: "/supplier/settings",      icon: "settings" },
  ];

  const content = (
    <>
      {/* Brand / account header */}
      <div className="px-5 py-4 border-b border-outline-variant flex items-center gap-2.5">
        {logoUrl ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 relative flex-shrink-0 rounded-lg overflow-hidden border border-outline-variant">
              <Image
                src={logoUrl}
                alt={accountName ?? "Supplier"}
                fill
                sizes="32px"
                className="object-contain"
              />
            </div>
            <div className="min-w-0">
              <p className="font-headline-md font-bold text-ink-deep truncate text-sm leading-tight">
                {accountName ?? t("sidebar.supplier")}
              </p>
              <p className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">
                {t("sidebar.supplier_portal")}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="w-7 h-7 relative flex-shrink-0">
              <Image
                src="/cervos-mark.svg"
                alt="Cervos"
                width={28}
                height={28}
                className="object-contain"
                priority
              />
            </div>
            <div>
              <span className="font-headline-md text-sm font-bold text-ink-deep block leading-tight">Cervos</span>
              <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">
                {t("sidebar.supplier_portal")}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-0.5 px-3 py-3 overflow-y-auto min-h-0 scrollbar-thin [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-outline-variant [&::-webkit-scrollbar-thumb]:rounded-full">
        {NAV.map((item) => {
          const active = pathname === item.href || (item.href !== "/supplier" && pathname.startsWith(item.href));
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
            {(["EN", "SW"] as const).map((l) => (
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
        <Link
          href="/support"
          onClick={closeMobile}
          className="flex items-center gap-3 px-3 py-2 text-on-surface-variant hover:text-ink-deep hover:bg-surface-container-low transition-colors rounded-lg text-sm"
        >
          <span className="material-symbols-outlined text-[18px]">contact_support</span>
          <span>{t("sup.support")}</span>
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 text-error hover:bg-error-container/60 transition-colors rounded-lg text-sm font-medium w-full text-left"
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
        <aside className="h-full w-64 flex flex-col bg-surface-base overflow-hidden">{content}</aside>
      </MobileDrawer>

      <aside className="hidden lg:flex flex-col w-64 z-20 fixed left-0 top-0 bottom-0 border-r border-outline-variant bg-surface-base h-full overflow-hidden">
        {content}
      </aside>
    </>
  );
}
