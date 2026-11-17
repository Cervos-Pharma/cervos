"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import PublicNav from "@/components/PublicNav";
import FlipText from "@/components/FlipText";
import SupportHelpSection from "@/components/SupportHelpSection";
import { useI18n } from "@/lib/i18n/context";
import { useIsLowEndDevice } from "@/lib/useDeviceTier";

export default function ContactPage() {
  const { lang } = useI18n();
  const isSw = lang === "SW";
  const isLowEnd = useIsLowEndDevice();

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
        className="relative bg-[#0F172A] text-white pt-5 sm:pt-6 pb-20 sm:pb-24 overflow-hidden"
      >
        <div className="absolute inset-0 z-0">
          <Image
            src="/cervos-people-counter.jpg"
            alt="Cervos Pharma Community Support Desk"
            fill
            className="object-cover object-center opacity-75"
            priority
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(100deg, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.84) 55%, rgba(15, 23, 42, 0.4) 100%)",
            }}
          />
        </div>

        <PublicNav
          variant="hero"
          ctaHref="/auth?mode=signup"
          ctaLabel={isSw ? "Anza Sasa" : "Get Started"}
          isLowEnd={isLowEnd}
        />

        <div className="max-w-6xl mx-auto px-5 sm:px-6 relative z-20 pt-4">
          <div className="max-w-2xl">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#38BDF8] mb-3">
              <FlipText text={isSw ? "MAWASILIANO & MSAADA" : "CONTACT US"} flipKey={lang} />
            </div>
            <h1
              className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-[1.08] mb-4"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              <FlipText
                text={isSw ? "Ongea na timu yetu Dar es Salaam." : "Talk directly with our team."}
                flipKey={lang}
                mode="words"
              />
            </h1>
            <p className="text-sm sm:text-lg text-slate-200 leading-relaxed max-w-xl">
              <FlipText
                text={
                  isSw
                    ? "Msaada wa haraka kwa kaunta, ushirika wa ugavi, au maswali ya leseni na vifaa."
                    : "Direct support for pharmacy counters, wholesale onboarding, and hardware setup across Tanzania."
                }
                flipKey={lang}
                mode="words"
              />
            </p>
          </div>
        </div>
      </section>

      {/* Clean Contact Details Bar */}
      <section className="bg-white border-b border-[#E2E8F0] py-10">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#006875] mb-1">
              {isSw ? "MAKAO MAKUU" : "HEADQUARTERS"}
            </div>
            <div className="text-sm font-bold text-[#0F172A]">Dar es Salaam, Tanzania</div>
            <div className="text-xs text-slate-500 mt-0.5">East Africa Operations</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1039B9] mb-1">
              {isSw ? "BARUA PEPE" : "SUPPORT EMAIL"}
            </div>
            <a href="mailto:support@cervos.online" className="text-sm font-bold text-[#0F172A] hover:text-[#1039B9]">
              support@cervos.online
            </a>
            <div className="text-xs text-slate-500 mt-0.5">
              {isSw ? "Majibu ndani ya saa chache" : "Mon to Sat response"}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#00542C] mb-1">
              {isSw ? "USHIRIKA" : "PARTNERSHIPS"}
            </div>
            <Link href="/partners#partner-enquiry" className="text-sm font-bold text-[#1039B9] hover:underline">
              {isSw ? "Tuma Ombi la Ushirika" : "Partner Enquiry Desk"} &rarr;
            </Link>
            <div className="text-xs text-slate-500 mt-0.5">
              {isSw ? "Wasambazaji & Kliniki" : "Depots, logistics & labs"}
            </div>
          </div>
        </div>
      </section>

      {/* Shared Interactive FAQ + Support Ticket Desk */}
      <main className="flex-1">
        <SupportHelpSection lang={lang} isSw={isSw} />
      </main>

      <footer className="bg-[#0F172A] text-slate-300 py-10 border-t border-slate-800 text-xs">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 flex flex-wrap items-center justify-between gap-4">
          <span>Cervos Pharma &middot; Dar es Salaam, Tanzania</span>
          <div className="flex items-center gap-6">
            <Link href="/" className="hover:text-white transition-colors">
              {isSw ? "Mwanzo" : "Home"}
            </Link>
            <Link href="/products" className="hover:text-white transition-colors">
              {isSw ? "Bidhaa" : "Products"}
            </Link>
            <Link href="/markets" className="hover:text-white transition-colors">
              {isSw ? "Masoko" : "Markets"}
            </Link>
            <Link href="/about" className="hover:text-white transition-colors">
              {isSw ? "Kuhusu" : "About"}
            </Link>
            <Link href="/downloads" className="hover:text-white transition-colors">
              {isSw ? "Pakua" : "Downloads"}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
