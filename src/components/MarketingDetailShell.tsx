"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import PublicNav from "@/components/PublicNav";
import FlipText from "@/components/FlipText";
import { IconCheck } from "@/components/LandingIcons";
import { useI18n } from "@/lib/i18n/context";
import { useIsLowEndDevice } from "@/lib/useDeviceTier";
import type { MarketingFeaturePage } from "@/lib/marketing-catalog";

interface Props {
  page: MarketingFeaturePage;
  related: MarketingFeaturePage[];
}

export default function MarketingDetailShell({ page, related }: Props) {
  const { lang } = useI18n();
  const isSw = lang === "SW";
  const isLowEnd = useIsLowEndDevice();

  const heroRef = useRef<HTMLElement>(null);
  const [heroMesh, setHeroMesh] = useState({ x: 64, y: 40, active: false });
  const [activeIndex, setActiveIndex] = useState(0);

  const eyebrow = isSw ? page.eyebrowSw : page.eyebrowEn;
  const title = isSw ? page.titleSw : page.titleEn;
  const summary = isSw ? page.summarySw : page.summaryEn;
  const ctaLabel = isSw ? page.ctaSw : page.ctaEn;
  const secondaryLabel = isSw ? page.secondaryCtaSw : page.secondaryCtaEn;
  const highlights = isSw ? page.highlightsSw : page.highlightsEn;
  const selected = highlights[activeIndex] ?? highlights[0];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col selection:bg-[#1039B9] selection:text-white antialiased overflow-x-clip">
      {/* Full-Bleed Dark Photo Hero with Interactive Pointer Mesh (Matches Home Style 3) */}
      <section
        ref={heroRef}
        onPointerMove={(e) => {
          if (isLowEnd || !heroRef.current) return;
          const rect = heroRef.current.getBoundingClientRect();
          setHeroMesh({
            x: ((e.clientX - rect.left) / rect.width) * 100,
            y: ((e.clientY - rect.top) / rect.height) * 100,
            active: true,
          });
        }}
        onPointerLeave={() => setHeroMesh((prev) => ({ ...prev, active: false }))}
        className="relative bg-[#0F172A] text-white pt-5 sm:pt-6 pb-20 sm:pb-28 overflow-hidden"
      >
        <div className="absolute inset-0 z-0">
          <Image
            src={page.image}
            alt={title}
            fill
            className="object-cover object-center opacity-85 transition-transform duration-700 ease-out"
            style={{
              transform:
                !isLowEnd && heroMesh.active
                  ? `scale(1.02) translate(${(50 - heroMesh.x) * 0.06}px, ${(50 - heroMesh.y) * 0.06}px)`
                  : "scale(1)",
            }}
            priority
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(100deg, rgba(15, 23, 42, 0.94) 0%, rgba(15, 23, 42, 0.78) 48%, rgba(15, 23, 42, 0.35) 100%)",
            }}
          />
        </div>

        {/* Interactive Cursor Mesh */}
        <div
          className="pointer-events-none absolute inset-0 z-10 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(148, 163, 184, 0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.2) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-300"
          style={{
            opacity: heroMesh.active ? 1 : 0.25,
            backgroundImage:
              "linear-gradient(to right, rgba(56, 189, 248, 0.45) 1px, transparent 1px), linear-gradient(to bottom, rgba(56, 189, 248, 0.45) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            maskImage: `radial-gradient(300px circle at ${heroMesh.x}% ${heroMesh.y}%, black 0%, transparent 72%)`,
            WebkitMaskImage: `radial-gradient(300px circle at ${heroMesh.x}% ${heroMesh.y}%, black 0%, transparent 72%)`,
          }}
        />

        <PublicNav
          variant="hero"
          ctaHref="/auth?mode=signup"
          ctaLabel={isSw ? "Anza Sasa" : "Get Started"}
          isLowEnd={isLowEnd}
        />

        <div className="max-w-6xl mx-auto px-5 sm:px-6 relative z-20 pt-4">
          <div className="max-w-2xl">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#38BDF8] mb-3">
              <FlipText text={eyebrow} flipKey={lang} />
            </div>
            <h1
              className="text-3xl sm:text-5xl lg:text-[52px] font-bold tracking-tight text-white leading-[1.08] mb-5"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              <FlipText text={title} flipKey={lang} mode="words" />
            </h1>
            <p className="text-sm sm:text-lg text-slate-200 leading-relaxed mb-8 max-w-xl">
              <FlipText text={summary} flipKey={lang} mode="words" />
            </p>

            <div className="flex flex-wrap items-center gap-3.5">
              <Link
                href={page.ctaHref}
                className="px-6 py-3 rounded bg-[#1039B9] hover:bg-[#0D2E94] text-white text-xs sm:text-sm font-semibold shadow-md transition-all"
              >
                <FlipText text={ctaLabel} flipKey={lang} />
              </Link>
              <Link
                href={page.secondaryCtaHref}
                className="px-5 py-3 rounded bg-white/10 hover:bg-white/20 border border-white/25 backdrop-blur-xs text-white text-xs sm:text-sm font-semibold transition-all"
              >
                <FlipText text={secondaryLabel} flipKey={lang} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <main className="flex-1">
        {/* Interactive Editorial Spotlight (Zero Generic 3-Card Row) */}
        <section className="py-16 sm:py-24 bg-white border-b border-[#E2E8F0]">
          <div className="max-w-6xl mx-auto px-5 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            {/* Left Interactive Selection Spine */}
            <div className="lg:col-span-6 divide-y divide-[#E2E8F0] border-t border-b border-[#E2E8F0]">
              {highlights.map((item, idx) => {
                const isSelected = idx === activeIndex;
                return (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => setActiveIndex(idx)}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`w-full text-left py-6 px-4 sm:px-5 transition-all cursor-pointer flex items-start gap-4 border-l-2 ${
                      isSelected
                        ? "border-l-[#1039B9] bg-[#F8FAFC]"
                        : "border-l-transparent hover:bg-slate-50/70"
                    }`}
                  >
                    <span
                      className={`text-xs font-mono font-bold mt-1 transition-colors ${
                        isSelected ? "text-[#1039B9]" : "text-slate-400"
                      }`}
                    >
                      0{idx + 1}
                    </span>
                    <div>
                      <h2
                        className={`text-base sm:text-lg font-bold mb-1.5 transition-colors ${
                          isSelected ? "text-[#0F172A]" : "text-slate-700"
                        }`}
                        style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                      >
                        <FlipText text={item.title} flipKey={lang} mode="words" />
                      </h2>
                      <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
                        <FlipText text={item.body} flipKey={lang} mode="words" />
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right Framed Field Focus Canvas */}
            <div className="lg:col-span-6">
              <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-5 sm:p-7 shadow-lg">
                <div className="relative aspect-[16/10] rounded-xl overflow-hidden border border-[#E2E8F0] bg-slate-900 mb-6">
                  <Image
                    src={page.image}
                    alt={selected.title}
                    fill
                    className="object-cover opacity-90"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A]/85 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 text-white">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#38BDF8] mb-1">
                      0{activeIndex + 1} &middot; {eyebrow}
                    </div>
                    <div
                      className="text-lg font-bold leading-snug"
                      style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                    >
                      {selected.title}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-50 text-[#00542C] flex items-center justify-center shrink-0 mt-0.5">
                    <IconCheck className="w-3.5 h-3.5" />
                  </span>
                  <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
                    <FlipText text={selected.body} flipKey={`${lang}-${activeIndex}`} mode="words" />
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Clean Horizontal Next-Path Strip */}
        {related.length > 0 && (
          <section className="py-14 bg-[#F8FAFC]">
            <div className="max-w-6xl mx-auto px-5 sm:px-6">
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#006875] mb-5">
                <FlipText text={isSw ? "ENDELEA KUGUNDUA" : "CONTINUE EXPLORING"} flipKey={lang} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#E2E8F0] rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
                {related.map((rel) => (
                  <Link
                    key={rel.slug}
                    href={`/${rel.section}/${rel.slug}`}
                    className="group p-6 sm:p-8 flex items-center justify-between gap-4 hover:bg-[#F8FAFC] transition-colors"
                  >
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1039B9] mb-1.5">
                        {isSw ? rel.eyebrowSw : rel.eyebrowEn}
                      </div>
                      <div
                        className="text-base sm:text-lg font-bold text-[#0F172A] group-hover:text-[#1039B9] transition-colors"
                        style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                      >
                        {isSw ? rel.titleSw : rel.titleEn}
                      </div>
                    </div>
                    <span className="text-sm font-bold text-[#1039B9] group-hover:translate-x-1 transition-transform shrink-0">
                      &rarr;
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="bg-[#0F172A] text-slate-300 py-10 border-t border-slate-800 text-xs">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 flex flex-wrap items-center justify-between gap-4">
          <span>Cervos Pharma &middot; Dar es Salaam, Tanzania</span>
          <div className="flex items-center gap-6">
            <Link href="/" className="hover:text-white transition-colors">
              {isSw ? "Mwanzo" : "Home"}
            </Link>
            <Link href="/about" className="hover:text-white transition-colors">
              {isSw ? "Kuhusu" : "About"}
            </Link>
            <Link href="/partners" className="hover:text-white transition-colors">
              {isSw ? "Wadau" : "Partners"}
            </Link>
            <Link href="/downloads" className="hover:text-white transition-colors">
              {isSw ? "Pakua" : "Downloads"}
            </Link>
            <Link href="/contact" className="hover:text-white transition-colors">
              {isSw ? "Mawasiliano" : "Contacts"}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
