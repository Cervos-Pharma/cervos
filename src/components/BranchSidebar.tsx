"use client";

/**
 * @file components/BranchSidebar.tsx
 * @description Sidebar for the operator branch portal (/branch/*).
 *
 * Responsive behaviour:
 *  - lg+ (desktop): permanently fixed 16rem sidebar.
 *  - < lg: slides in as an overlay drawer (opened via the hamburger in the
 *    page header / SIDEBAR_OPEN_EVENT). Previously `hidden md:flex` left
 *    mobile operators with no navigation.
 */
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/context";
import MobileDrawer from "@/components/MobileDrawer";
import { SIDEBAR_OPEN_EVENT } from "@/components/sidebar-events";

interface BranchSidebarProps {
  branchName?: string;
  pharmacyName?: string;
}

export default function BranchSidebar({ branchName, pharmacyName }: BranchSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
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
    { label: "Dashboard",   href: "/branch",            icon: "dashboard" },
    { label: "Stock",       href: "/branch/stock",      icon: "inventory_2" },
    { label: "Orders",      href: "/branch/orders",     icon: "receipt_long" },
    { label: "Transactions", href: "/branch/transactions", icon: "payments" },
  ];

  const content = (
    <>
      <div className="p-6 border-b border-outline-variant">
        <h1 className="font-headline-md font-bold text-on-surface tracking-tight">Cervos</h1>
        <p className="font-label-md text-label-md text-on-surface-variant mt-1 uppercase tracking-wider">
          Branch Portal
        </p>
      </div>

      <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low">
        <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider text-xs mb-1">
          Branch
        </p>
        <p className="font-body-md font-medium text-on-surface truncate">{branchName ?? "—"}</p>
        <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{pharmacyName}</p>
      </div>

      <ul className="flex-1 py-3 overflow-y-auto min-h-0">
        {NAV.map((item) => {
          const active = pathname === item.href || (item.href !== "/branch" && pathname.startsWith(item.href));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={closeMobile}
                className={`flex items-center gap-3 px-6 py-3 font-label-md text-label-md transition-all ${
                  active
                    ? "text-primary border-r-2 border-primary bg-surface-container-low font-bold"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-outline-variant py-3 shrink-0 bg-surface">
        <ul>
          <li>
            <Link
              href="/support"
              onClick={closeMobile}
              className="flex items-center gap-3 px-6 py-3 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-all font-label-md text-label-md"
            >
              <span className="material-symbols-outlined text-[18px]">contact_support</span>
              {t("sup.support")}
            </Link>
          </li>
          <li>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-6 py-3 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-all font-label-md text-label-md w-full text-left"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              {t("portal.logout")}
            </button>
          </li>
        </ul>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile drawer — slide in/out below lg */}
      <MobileDrawer open={mobileOpen} onClose={closeMobile}>
        <nav className="h-full w-64 flex flex-col bg-surface overflow-hidden">{content}</nav>
      </MobileDrawer>

      {/* Fixed desktop sidebar — lg+ only */}
      <nav className="hidden lg:flex flex-col w-64 z-40 fixed left-0 top-0 bottom-0 border-r border-outline-variant bg-surface h-full overflow-hidden">
        {content}
      </nav>
    </>
  );
}
