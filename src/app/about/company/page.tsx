"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import PublicNav from "@/components/PublicNav";
import FlipText from "@/components/FlipText";
import { useI18n } from "@/lib/i18n/context";
import { useIsLowEndDevice } from "@/lib/useDeviceTier";

export default function AboutCompanyPage() {
  const { lang } = useI18n();
  const isSw = lang === "SW";
  const isLowEnd = useIsLowEndDevice();

  const heroRef = useRef<HTMLElement>(null);
  const [heroMesh, setHeroMesh] = useState({ x: 60, y: 38, active: false });

  const chapters = [
    {
      num: "01",
      kicker: isSw ? "Mwanzo Wetu" : "Where We Started",
      title: isSw ? "Imeundwa kwa hali halisi ya mtaa." : "Built for real neighborhood street conditions.",
      body: isSw
        ? "Maduka ya dawa ni kimbilio la kwanza kwa familia kote Afrika Mashariki. Tulitengeneza Cervos Pharma baada ya kuona kaunta zikisimama kila mtandao au umeme unapoyumba kidogo."
        : "Neighborhood pharmacies are the first point of care for millions of families. Cervos Pharma began in Dar es Salaam so a brief fiber or grid drop never leaves a counter line frozen.",
    },
    {
      num: "02",
      kicker: isSw ? "Usalama wa Mgonjwa" : "Shelf Safety",
      title: isSw ? "Kila kundi la dawa linafuatiliwa kwa utulivu." : "Calm batch discipline on every shelf.",
      body: isSw
        ? "Badala ya daftari za karatasi au kubahatisha tarehe, mfumo unamuongoza mfamasia kuchagua dawa inayowahi kuisha kwanza na kuzuia moja kwa moja dawa iliyopitwa na wakati."
        : "Instead of ledger guesswork, scanning directs staff to the earliest safe batch first and locks expired medicine out of checkout completely.",
    },
    {
      num: "03",
      kicker: isSw ? "Ushirikiano wa Haki" : "Trusted Supply",
      title: isSw ? "Maduka na wasambazaji wanaaminiana wazi." : "Honest restocking between stores and wholesalers.",
      body: isSw
        ? "Kupitia Kasri\u2122 na mtandao wetu wa wadau wa ugavi, maduka yanapokea dawa halali kwa wakati na wasambazaji wanalipwa papo hapo mzigo ukithibitishwa."
        : "Through Kasri\u2122 and licensed regional distributors, community pharmacies receive verified stock reliably while suppliers get paid the instant boxes arrive.",
    },
  ];

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
        className="relative bg-[#0F172A] text-white pt-5 sm:pt-6 pb-20 sm:pb-28 overflow-hidden"
      >
        <div className="absolute inset-0 z-0">
          <Image
            src="/cervos-people-counter.jpg"
            alt="Pharmacist helping customer at community pharmacy"
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
                "linear-gradient(100deg, rgba(15, 23, 42, 0.94) 0%, rgba(15, 23, 42, 0.8) 50%, rgba(15, 23, 42, 0.36) 100%)",
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

        <div className="max-w-6xl mx-auto px-5 sm:px-6 relative z-20 pt-4">
          <div className="max-w-2xl">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#38BDF8] mb-3">
              <FlipText text={isSw ? "KUHUSU KAMPUNI" : "OUR COMPANY"} flipKey={lang} />
            </div>
            <h1
              className="text-3xl sm:text-5xl lg:text-[54px] font-bold tracking-tight text-white leading-[1.08] mb-5"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              <FlipText
                text={
                  isSw
                    ? "Miundombinu tulivu kwa maduka ya dawa."
                    : "Calm infrastructure for everyday pharmacy care."
                }
                flipKey={lang}
                mode="words"
              />
            </h1>
            <p className="text-sm sm:text-lg text-slate-200 leading-relaxed mb-8 max-w-xl">
              <FlipText
                text={
                  isSw
                    ? "Tunatengeneza programu ya uhakika kwa wafamasia na wasambazaji Afrika Mashariki, kutoka Dar es Salaam hadi mikoani."
                    : "Serving community pharmacies, wholesale distributors, and clinical teams across East Africa from Dar es Salaam."
                }
                flipKey={lang}
                mode="words"
              />
            </p>

            <div className="flex flex-wrap items-center gap-3.5">
              <Link
                href="/auth?mode=signup"
                className="px-6 py-3 rounded bg-[#1039B9] hover:bg-[#0D2E94] text-white text-xs sm:text-sm font-semibold shadow-md transition-all"
              >
                <FlipText text={isSw ? "Jiunge na Mtandao" : "Join the Network"} flipKey={lang} />
              </Link>
              <Link
                href="/partners"
                className="px-5 py-3 rounded bg-white/10 hover:bg-white/20 border border-white/25 backdrop-blur-xs text-white text-xs sm:text-sm font-semibold transition-all"
              >
                <FlipText text={isSw ? "Tazama Wadau Wetu" : "Meet Our Partners"} flipKey={lang} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <main className="flex-1 bg-white">
        <section className="py-16 sm:py-24">
          <div className="max-w-5xl mx-auto px-5 sm:px-6 divide-y divide-[#E2E8F0]">
            {chapters.map((ch) => (
              <div
                key={ch.num}
                className="py-10 sm:py-12 first:pt-0 last:pb-0 grid grid-cols-1 md:grid-cols-12 gap-6 items-start"
              >
                <div className="md:col-span-4">
                  <div className="text-[11px] font-mono font-bold text-[#1039B9] mb-1">
                    {ch.num}
                  </div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#006875]">
                    <FlipText text={ch.kicker} flipKey={lang} />
                  </div>
                </div>
                <div className="md:col-span-8">
                  <h2
                    className="text-xl sm:text-2xl font-bold text-[#0F172A] mb-3 leading-snug"
                    style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                  >
                    <FlipText text={ch.title} flipKey={lang} mode="words" />
                  </h2>
                  <p className="text-sm sm:text-base text-[#475569] leading-relaxed">
                    <FlipText text={ch.body} flipKey={lang} mode="words" />
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="py-14 bg-[#F8FAFC] border-t border-[#E2E8F0]">
          <div className="max-w-5xl mx-auto px-5 sm:px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#1039B9] mb-1.5">
                Dar es Salaam &middot; Tanzania
              </div>
              <div
                className="text-xl sm:text-2xl font-bold text-[#0F172A]"
                style={{ fontFamily: "Outfit, Inter, sans-serif" }}
              >
                <FlipText
                  text={isSw ? "Tayari kuanza na duka au ghala lako?" : "Ready to bring Cervos Pharma to your counter?"}
                  flipKey={lang}
                  mode="words"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/about"
                className="px-5 py-2.5 rounded border border-[#E2E8F0] bg-white hover:border-slate-300 text-xs font-semibold text-[#0F172A] transition-all"
              >
                <FlipText text={isSw ? "Rudi Muhtasari" : "Chain Overview"} flipKey={lang} />
              </Link>
              <Link
                href="/auth?mode=signup"
                className="px-5 py-2.5 rounded bg-[#1039B9] hover:bg-[#0D2E94] text-white text-xs font-semibold transition-all"
              >
                <FlipText text={isSw ? "Anza Sasa" : "Get Started"} flipKey={lang} />
              </Link>
            </div>
          </div>
        </section>
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
