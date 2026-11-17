"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import FlipText from "@/components/FlipText";
import { useI18n } from "@/lib/i18n/context";

type MenuKey = "products" | "markets" | "about";

interface PublicNavProps {
  variant?: "hero" | "light";
  activePath?: string;
  ctaLabel?: string;
  ctaHref?: string;
  ctaFlipKey?: string;
  shimmerTick?: number;
  isLowEnd?: boolean;
}

export default function PublicNav({
  variant = "light",
  activePath: _activePath,
  ctaLabel,
  ctaHref = "/auth?mode=signin",
  ctaFlipKey,
  shimmerTick = 0,
  isLowEnd = false,
}: PublicNavProps) {
  const { lang, setLang } = useI18n();
  const isSw = lang === "SW";
  const isHero = variant === "hero";

  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<MenuKey | null>(null);
  const navRootRef = useRef<HTMLDivElement>(null);
  const hoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (navRootRef.current && !navRootRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleEsc);
      if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    };
  }, []);

  const toggleMenu = (key: MenuKey) => {
    setOpenMenu((prev) => (prev === key ? null : key));
  };

  const openOnHover = (key: MenuKey) => {
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    setOpenMenu(key);
  };

  const scheduleHoverClose = () => {
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    hoverCloseTimer.current = setTimeout(() => setOpenMenu(null), 150);
  };

  const productItems = [
    { href: "/products?focus=counter", label: isSw ? "Kaunta ya POS" : "Counter POS" },
    { href: "/products?focus=shelf", label: isSw ? "Usalama wa Rafu" : "Shelf Control" },
    { href: "/products?focus=wholesale", label: isSw ? "Ugavi wa Jumla" : "Wholesale Supply" },
    { href: "/products#calculator-focus", label: isSw ? "Mpango & Gharama" : "Plans & Pricing" },
  ];

  const marketItems = [
    { href: "/markets?focus=pharmacies", label: isSw ? "Maduka ya Dawa" : "Pharmacies" },
    { href: "/markets?focus=suppliers", label: isSw ? "Wasambazaji" : "Suppliers" },
    { href: "/markets?focus=clinics", label: isSw ? "Zahanati & Kliniki" : "Clinics" },
    { href: "/markets?focus=researchers", label: isSw ? "Watafiti" : "Researchers" },
    { href: "/markets?focus=investors", label: isSw ? "Wawekezaji" : "Investors" },
  ];

  const aboutItems = [
    { href: "/about/company", label: "Cervos Pharma" },
    { href: "/partners", label: isSw ? "Wadau Wetu" : "Partners" },
  ];

  const resolvedCtaLabel = ctaLabel ?? (isSw ? "Ingia" : "Sign In");
  const resolvedFlipKey = ctaFlipKey ?? lang;

  const textBase = isHero ? "text-slate-100" : "text-slate-700";
  const hoverAccent = isHero ? "hover:text-[#38BDF8]" : "hover:text-[#1039B9]";

  return (
    <div ref={navRootRef} className="relative z-40">
      <header
        className={`max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-2 sm:gap-3 ${isHero ? "mb-14 sm:mb-20" : "h-16"
          }`}
      >
        <Link href="/" className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
          <div
            className={`relative w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden bg-white shadow-sm shrink-0 ${isHero ? "ring-1 ring-white/25" : "ring-1 ring-slate-200"
              }`}
          >
            <Image
              src="/cervos-company-logo-circular.svg"
              alt="Cervos Pharma"
              fill
              className="object-contain p-0.5"
              priority
            />
          </div>
          <span
            className={`font-bold text-sm sm:text-lg tracking-tight whitespace-nowrap ${isHero ? "text-white" : "text-[#0F172A]"
              }`}
            style={{ fontFamily: "Outfit, Inter, sans-serif" }}
          >
            Cervos Pharma
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-5 shrink-0">
          <nav className={`hidden lg:flex items-center gap-1.5 text-xs font-semibold ${textBase}`}>
            {/* Products: Label routes to /products; arrow button toggles dropdown */}
            <div
              className="relative flex items-center"
              onMouseEnter={() => openOnHover("products")}
              onMouseLeave={scheduleHoverClose}
            >
              <div
                className={`inline-flex items-center rounded-md transition-colors ${openMenu === "products"
                  ? isHero
                    ? "bg-white/12 text-[#38BDF8]"
                    : "bg-slate-100 text-[#1039B9]"
                  : `${hoverAccent} ${isHero ? "hover:bg-white/8" : "hover:bg-slate-100/80"}`
                  }`}
              >
                <Link
                  href="/products"
                  onClick={() => setOpenMenu(null)}
                  className="pl-2.5 pr-1 py-1.5"
                >
                  <FlipText text={isSw ? "Bidhaa" : "Products"} flipKey={lang} />
                </Link>
                <button
                  type="button"
                  onClick={() => toggleMenu("products")}
                  aria-label="Toggle Products menu"
                  aria-expanded={openMenu === "products"}
                  aria-haspopup="menu"
                  className="pr-2 pl-0.5 py-1.5 cursor-pointer"
                >
                  <ChevronIcon open={openMenu === "products"} />
                </button>
              </div>

              <DropdownPanel open={openMenu === "products"}>
                {productItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpenMenu(null)}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC] hover:text-[#1039B9] transition-colors"
                  >
                    <span>{item.label}</span>
                  </Link>
                ))}
              </DropdownPanel>
            </div>

            {/* Markets: Label routes to /markets; arrow button toggles dropdown */}
            <div
              className="relative flex items-center"
              onMouseEnter={() => openOnHover("markets")}
              onMouseLeave={scheduleHoverClose}
            >
              <div
                className={`inline-flex items-center rounded-md transition-colors ${openMenu === "markets"
                  ? isHero
                    ? "bg-white/12 text-[#38BDF8]"
                    : "bg-slate-100 text-[#1039B9]"
                  : `${hoverAccent} ${isHero ? "hover:bg-white/8" : "hover:bg-slate-100/80"}`
                  }`}
              >
                <Link
                  href="/markets"
                  onClick={() => setOpenMenu(null)}
                  className="pl-2.5 pr-1 py-1.5"
                >
                  <FlipText text={isSw ? "Masoko" : "Markets"} flipKey={lang} />
                </Link>
                <button
                  type="button"
                  onClick={() => toggleMenu("markets")}
                  aria-label="Toggle Markets menu"
                  aria-expanded={openMenu === "markets"}
                  aria-haspopup="menu"
                  className="pr-2 pl-0.5 py-1.5 cursor-pointer"
                >
                  <ChevronIcon open={openMenu === "markets"} />
                </button>
              </div>

              <DropdownPanel open={openMenu === "markets"}>
                {marketItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpenMenu(null)}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC] hover:text-[#1039B9] transition-colors"
                  >
                    <span>{item.label}</span>
                  </Link>
                ))}
              </DropdownPanel>
            </div>

            <Link
              href="/dispatch"
              className={`px-2.5 py-1.5 rounded-md transition-colors ${hoverAccent} ${isHero ? "hover:bg-white/8" : "hover:bg-slate-100/80"
                }`}
            >
              <FlipText text={isSw ? "Habari" : "The Dispatch"} flipKey={lang} />
            </Link>

            <Link
              href="/help"
              className={`px-2.5 py-1.5 rounded-md transition-colors ${hoverAccent} ${isHero ? "hover:bg-white/8" : "hover:bg-slate-100/80"
                }`}
            >
              <FlipText text={isSw ? "Msaada" : "Help"} flipKey={lang} />
            </Link>

            {/* About: Label routes to /about; arrow button toggles dropdown */}
            <div
              className="relative flex items-center"
              onMouseEnter={() => openOnHover("about")}
              onMouseLeave={scheduleHoverClose}
            >
              <div
                className={`inline-flex items-center rounded-md transition-colors ${openMenu === "about"
                  ? isHero
                    ? "bg-white/12 text-[#38BDF8]"
                    : "bg-slate-100 text-[#1039B9]"
                  : `${hoverAccent} ${isHero ? "hover:bg-white/8" : "hover:bg-slate-100/80"}`
                  }`}
              >
                <Link
                  href="/about"
                  onClick={() => setOpenMenu(null)}
                  className="pl-2.5 pr-1 py-1.5"
                >
                  <FlipText text={isSw ? "Kuhusu" : "About"} flipKey={lang} />
                </Link>
                <button
                  type="button"
                  onClick={() => toggleMenu("about")}
                  aria-label="Toggle About menu"
                  aria-expanded={openMenu === "about"}
                  aria-haspopup="menu"
                  className="pr-2 pl-0.5 py-1.5 cursor-pointer"
                >
                  <ChevronIcon open={openMenu === "about"} />
                </button>
              </div>

              <DropdownPanel open={openMenu === "about"} align="right">
                {aboutItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpenMenu(null)}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC] hover:text-[#1039B9] transition-colors"
                  >
                    <span>{item.label}</span>
                  </Link>
                ))}
              </DropdownPanel>
            </div>

            <Link
              href="/contact"
              className={`px-2.5 py-1.5 rounded-md transition-colors ${hoverAccent} ${isHero ? "hover:bg-white/8" : "hover:bg-slate-100/80"
                }`}
            >
              <FlipText text={isSw ? "Mawasiliano" : "Contacts"} flipKey={lang} />
            </Link>
          </nav>

          {/* Mobile Single-Button Translate Toggle */}
          <button
            type="button"
            onClick={() => setLang(isSw ? "EN" : "SW")}
            aria-label={isSw ? "Switch language to English" : "Badili lugha kuwa Kiswahili"}
            title={isSw ? "Switch to English" : "Badili kwenda Kiswahili"}
            className={`inline-flex sm:hidden items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-bold transition-all cursor-pointer shrink-0 ${isHero
              ? "bg-white/14 hover:bg-white/24 text-white border border-white/20 backdrop-blur-xs"
              : "bg-slate-100 hover:bg-slate-200/80 text-[#0F172A] border border-[#E2E8F0]"
              }`}
          >
            <svg
              className={`w-3.5 h-3.5 ${isHero ? "text-[#38BDF8]" : "text-[#1039B9]"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.85}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m10.5 21 5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 0 1 6-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 0 1-3.827-5.802"
              />
            </svg>
            <span>{lang}</span>
          </button>

          {/* Desktop & Large-View Classic Segmented Language Toggle */}
          <div
            className={`hidden sm:flex items-center rounded p-0.5 text-[11px] font-bold ${isHero ? "bg-white/15 backdrop-blur-xs" : "bg-slate-100 border border-[#E2E8F0]"
              }`}
          >
            <button
              type="button"
              onClick={() => setLang("EN")}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${!isSw
                ? "bg-white text-[#0F172A] shadow-2xs"
                : isHero
                  ? "text-slate-200"
                  : "text-slate-500"
                }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLang("SW")}
              className={`px-2 py-0.5 rounded transition-all cursor-pointer ${isSw
                ? "bg-white text-[#0F172A] shadow-2xs"
                : isHero
                  ? "text-slate-200"
                  : "text-slate-500"
                }`}
            >
              SW
            </button>
          </div>

          <Link
            href={ctaHref}
            className="hidden md:inline-flex items-center justify-center relative overflow-hidden w-[116px] py-2 rounded bg-[#1039B9] hover:bg-[#0D2E94] text-white text-xs font-semibold shadow-sm transition-colors whitespace-nowrap text-center shrink-0"
          >
            {!isLowEnd && shimmerTick > 0 && (
              <span key={`nav-glimmer-${shimmerTick}`} className="cta-glimmer-overlay" />
            )}
            <FlipText text={resolvedCtaLabel} flipKey={resolvedFlipKey} />
          </Link>

          <button
            type="button"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((prev) => !prev)}
            className={`lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-md border transition-colors cursor-pointer shrink-0 ${isHero
              ? "border-white/25 text-white hover:bg-white/12"
              : "border-[#E2E8F0] text-[#0F172A] hover:bg-slate-100"
              }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </header>

      {mobileOpen && (
        <div className="lg:hidden absolute left-3 right-3 top-full mt-2 max-h-[calc(100vh-5.5rem)] overflow-y-auto rounded-2xl border border-[#E2E8F0] bg-white text-[#0F172A] shadow-2xl p-4 z-50 animate-stage-pop">
          <div className="space-y-1 text-xs font-semibold">
            {(
              [
                {
                  key: "products" as const,
                  label: isSw ? "Bidhaa" : "Products",
                  items: [
                    { href: "/products", label: isSw ? "Muhtasari wa Bidhaa" : "All Products" },
                    ...productItems,
                  ],
                },
                {
                  key: "markets" as const,
                  label: isSw ? "Masoko" : "Markets",
                  items: [
                    { href: "/markets", label: isSw ? "Muhtasari wa Masoko" : "Markets Overview" },
                    ...marketItems,
                  ],
                },
                {
                  key: "about" as const,
                  label: isSw ? "Kuhusu" : "About",
                  items: [
                    { href: "/about", label: isSw ? "Muhtasari wa Mnyororo" : "Overview" },
                    ...aboutItems,
                  ],
                },
              ] as const
            ).map((group) => {
              const expanded = mobileExpanded === group.key;
              return (
                <div key={group.key} className="border-b border-slate-100 pb-1">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setMobileExpanded(expanded ? null : group.key)}
                    className="w-full flex items-center justify-between px-2.5 py-3 text-left text-[#0F172A] hover:text-[#1039B9] cursor-pointer"
                  >
                    <span>{group.label}</span>
                    <ChevronIcon open={expanded} />
                  </button>
                  <div
                    className={`grid transition-all duration-300 ease-out ${expanded ? "grid-rows-[1fr] opacity-100 pb-2" : "grid-rows-[0fr] opacity-0"
                      }`}
                  >
                    <div className="overflow-hidden pl-2 space-y-1">
                      {group.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => {
                            setMobileOpen(false);
                            setMobileExpanded(null);
                          }}
                          className="block px-3 py-2.5 rounded-lg bg-[#F8FAFC] hover:bg-blue-50/70 text-xs font-semibold text-[#0F172A] transition-colors"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}

            <Link
              href="/downloads"
              onClick={() => setMobileOpen(false)}
              className="block px-2.5 py-2.5 hover:text-[#1039B9]"
            >
              {isSw ? "Pakua Programu" : "Downloads"}
            </Link>
            <Link
              href="/dispatch"
              onClick={() => setMobileOpen(false)}
              className="block px-2.5 py-2.5 hover:text-[#1039B9]"
            >
              {isSw ? "Jarida" : "The Dispatch"}
            </Link>
            <Link
              href="/help"
              onClick={() => setMobileOpen(false)}
              className="block px-2.5 py-2.5 hover:text-[#1039B9]"
            >
              {isSw ? "Kituo cha Msaada" : "Help Center"}
            </Link>
            <Link
              href="/contact"
              onClick={() => setMobileOpen(false)}
              className="block px-2.5 py-2.5 hover:text-[#1039B9]"
            >
              {isSw ? "Mawasiliano" : "Contacts"}
            </Link>
          </div>

          <div className="mt-4 pt-3.5 border-t border-slate-100 grid grid-cols-2 gap-2.5">
            <Link
              href="/auth?mode=signin"
              onClick={() => setMobileOpen(false)}
              className="py-2.5 px-3 rounded-lg border border-[#E2E8F0] hover:bg-slate-50 text-xs font-semibold text-[#0F172A] text-center transition-colors"
            >
              {isSw ? "Ingia" : "Sign In"}
            </Link>
            <Link
              href="/auth?mode=signup"
              onClick={() => setMobileOpen(false)}
              className="py-2.5 px-3 rounded-lg bg-[#1039B9] hover:bg-[#0D2E94] text-white text-xs font-semibold text-center transition-colors shadow-xs"
            >
              {isSw ? "Anza Sasa" : "Get Started"}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function DropdownPanel({
  open,
  align = "left",
  children,
}: {
  open: boolean;
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  return (
    <div
      role="menu"
      className={`absolute top-full mt-2 ${align === "right" ? "right-0" : "left-0"} w-48 rounded-xl border border-[#E2E8F0] bg-white text-[#0F172A] shadow-xl p-1.5 transition-all duration-200 origin-top ${open
        ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
        : "opacity-0 -translate-y-1.5 scale-95 pointer-events-none"
        }`}
    >
      {children}
    </div>
  );
}
