"use client";

import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import PublicNav from "@/components/PublicNav";
import FlipText from "@/components/FlipText";
import ProductSuiteMockups from "@/components/ProductSuiteMockups";
import SubscriptionCalculator from "@/components/SubscriptionCalculator";
import { useI18n } from "@/lib/i18n/context";
import { useIsLowEndDevice } from "@/lib/useDeviceTier";

function ProductsOverviewInner() {
  const { lang } = useI18n();
  const isSw = lang === "SW";
  const isLowEnd = useIsLowEndDevice();
  const searchParams = useSearchParams();

  const rawFocus = searchParams.get("focus");
  const focusTarget =
    rawFocus === "counter" || rawFocus === "shelf" || rawFocus === "wholesale"
      ? rawFocus
      : null;

  const heroRef = useRef<HTMLElement>(null);
  const [heroMesh, setHeroMesh] = useState({ x: 64, y: 38, active: false });

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col selection:bg-[#1039B9] selection:text-white antialiased overflow-x-clip">
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
        className="relative bg-[#0F172A] text-white pt-5 sm:pt-6 pb-24 sm:pb-32 overflow-hidden"
      >
        <div className="absolute inset-0 z-0">
          <Image
            src="/cervos-counter-station.jpg"
            alt="Cervos Pharma Product Suite"
            fill
            className="object-cover object-center opacity-80 transition-transform duration-700 ease-out"
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
                "linear-gradient(100deg, rgba(15, 23, 42, 0.94) 0%, rgba(15, 23, 42, 0.8) 50%, rgba(15, 23, 42, 0.35) 100%)",
            }}
          />
        </div>

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

        <div className="max-w-6xl mx-auto px-5 sm:px-6 relative z-20 pt-6">
          <div className="max-w-2xl">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#38BDF8] mb-3">
              <FlipText text={isSw ? "BIDHAA ZA CERVOS" : "THE CERVOS SUITE"} flipKey={lang} />
            </div>
            <h1
              className="text-3xl sm:text-5xl lg:text-[56px] font-bold tracking-tight text-white leading-[1.06] mb-5"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              <FlipText
                text={
                  isSw
                    ? "Kila zana ya duka na ugavi. Imeundwa kwa utulivu."
                    : "Every counter, shelf, and route. Engineered as one."
                }
                flipKey={lang}
                mode="words"
              />
            </h1>
            <p className="text-sm sm:text-lg text-slate-200 leading-relaxed mb-8 max-w-xl">
              <FlipText
                text={
                  isSw
                    ? "Shuka chini kuona mifumo kwenye kompyuta, simu na tableti, pamoja na kikokotoo cha bei."
                    : "Scroll through desktop workstations, pocket shelf scanners, and wholesale tablets, then estimate your plan below."
                }
                flipKey={lang}
                mode="words"
              />
            </p>

            <div className="flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                onClick={() =>
                  document
                    .getElementById("counter-stage")
                    ?.scrollIntoView({ behavior: isLowEnd ? "auto" : "smooth", block: "start" })
                }
                className="px-6 py-3 rounded-full bg-white text-[#0F172A] hover:bg-slate-100 text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer"
              >
                <FlipText text={isSw ? "Tazama Masuluhisho" : "Explore Solutions"} flipKey={lang} />
              </button>
              <button
                type="button"
                onClick={() =>
                  document
                    .getElementById("calculator-focus")
                    ?.scrollIntoView({ behavior: isLowEnd ? "auto" : "smooth", block: "center" })
                }
                className="px-5 py-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/25 backdrop-blur-xs text-white text-xs sm:text-sm font-semibold transition-all cursor-pointer"
              >
                <FlipText text={isSw ? "Kikokotoo cha Bei" : "Pricing Calculator"} flipKey={lang} />
              </button>
            </div>
          </div>
        </div>
      </section>

      <main className="flex-1">
        <ProductSuiteMockups lang={lang} isSw={isSw} focusTarget={focusTarget} />
        <SubscriptionCalculator lang={lang} isSw={isSw} />
      </main>

      <footer className="bg-[#0F172A] text-slate-300 py-10 border-t border-slate-800 text-xs">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 flex flex-wrap items-center justify-between gap-4">
          <span>Cervos Pharma &middot; Dar es Salaam, Tanzania</span>
          <div className="flex items-center gap-6">
            <Link href="/" className="hover:text-white transition-colors">
              {isSw ? "Mwanzo" : "Home"}
            </Link>
            <Link href="/markets/pharmacies" className="hover:text-white transition-colors">
              {isSw ? "Masoko" : "Markets"}
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

export default function ProductsOverviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0F172A] flex items-center justify-center text-xs text-slate-400">
          Loading...
        </div>
      }
    >
      <ProductsOverviewInner />
    </Suspense>
  );
}
