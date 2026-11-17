/**
 * @file components/HQSidebar.tsx
 * @description Fixed left navigation sidebar for the HQ Console (/hq/*).
 *
 * Responsive behaviour:
 *  - lg+ (desktop): permanently fixed 16rem sidebar.
 *  - < lg: slides in as an overlay drawer. HQ pages render no top header bar,
 *    so the sidebar itself renders a floating hamburger button (top-left,
 *    below lg) to open the drawer. Closes on backdrop tap, Escape, or nav.
 *
 * Highlights the active route using `usePathname()`. No props required —
 * nav items are statically defined (HQ has no per-user customisation).
 *
 * @prop openSupportCount - Optional live count of open support tickets (passed
 *   by HQSidebarServer, which fetches it server-side). Displays a badge on the
 *   Support nav item when > 0.
 */
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useI18n } from "@/lib/i18n/context";
import MobileDrawer from "@/components/MobileDrawer";

interface HQSidebarProps {
  openSupportCount?: number;
}

export default function HQSidebar({ openSupportCount = 0 }: HQSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, setLang, t } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the drawer whenever the route changes (nav tap from inside drawer).
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const NAV = [
    { label: t("hq.sidebar.overview"),       href: "/hq",                icon: "dashboard" },
    { label: t("hq.sidebar.alerts"),         href: "/hq/alerts",         icon: "notifications" },
    { label: t("hq.sidebar.intelligence"),   href: "/hq/intelligence",   icon: "insights" },
    { label: t("hq.sidebar.accounts"),       href: "/hq/accounts",       icon: "group" },
    { label: t("hq.sidebar.billing"),        href: "/hq/billing",        icon: "payments" },
    { label: t("hq.sidebar.quotes"),         href: "/hq/quotes",         icon: "request_quote" },
    { label: t("hq.sidebar.invites"),        href: "/hq/invites",        icon: "mail" },
    { label: t("hq.sidebar.network"),        href: "/hq/network",        icon: "public" },
    { label: t("hq.sidebar.downloads"),      href: "/hq/downloads",      icon: "download" },
    { label: t("hq.sidebar.support"),        href: "/hq/support",        icon: "support_agent" },
    { label: t("hq.sidebar.team"),           href: "/hq/team",           icon: "badge" },
    { label: t("hq.sidebar.news"),           href: "/hq/news",           icon: "newspaper" },
    { label: t("hq.sidebar.messages"),       href: "/hq/messages",       icon: "campaign" },
    { label: t("hq.sidebar.audit"),          href: "/hq/audit",          icon: "shield" },
  ];

  async function handleLogout() {
    setMobileOpen(false);
    document.cookie = `hq_sess=; Max-Age=0; path=/`;
    router.push("/hq");
  }

  const closeMobile = () => setMobileOpen(false);

  const content = (
    <>
      {/* Brand header */}
      <div className="px-5 py-4 border-b border-outline-variant flex items-center gap-2.5">
        <div className="w-7 h-7 relative flex-shrink-0">
          <Image
            src="/cervos-mark.svg"
            alt="Cervos HQ"
            width={28}
            height={28}
            className="object-contain"
            priority
          />
        </div>
        <div className="min-w-0">
          <span className="font-headline-md text-sm font-bold text-ink-deep block leading-tight">
            {t("hq.sidebar.title")}
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {t("hq.sidebar.status")}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-0.5 px-3 py-3 overflow-y-auto min-h-0 scrollbar-thin [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-outline-variant [&::-webkit-scrollbar-thumb]:rounded-full">
        {NAV.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/hq" && pathname.startsWith(item.href));
          const isSupport = item.href === "/hq/support";
          const showBadge = isSupport && openSupportCount > 0;

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
              <span className="flex-1 truncate">{item.label}</span>
              {showBadge && (
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full min-w-[20px] text-center tabular-nums ${
                  active
                    ? "bg-primary text-on-primary"
                    : "bg-amber-100 text-amber-700"
                }`}>
                  {openSupportCount > 99 ? "99+" : openSupportCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 mt-auto border-t border-outline-variant shrink-0 bg-surface-base flex flex-col gap-1">
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
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full text-error hover:bg-error-container/60 transition-colors rounded-lg text-sm font-medium text-left"
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
          <span>{t("hq.sidebar.logout")}</span>
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

      {/* Floating hamburger (below lg) — HQ pages have no top header bar, so
          the sidebar provides its own trigger for the drawer. */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation menu"
        className="lg:hidden fixed top-3 left-3 z-30 p-2.5 rounded-lg bg-surface-base border border-outline-variant shadow-sm text-on-surface-variant hover:text-ink-deep transition-colors"
      >
        <span className="material-symbols-outlined text-[22px]">menu</span>
      </button>

      <aside className="hidden lg:flex flex-col w-64 z-40 fixed left-0 top-0 bottom-0 border-r border-outline-variant bg-surface-base h-full overflow-hidden">
        {content}
      </aside>
    </>
  );
}
