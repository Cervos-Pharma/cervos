"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import PublicNav from "@/components/PublicNav";
import FlipText from "@/components/FlipText";
import { useI18n } from "@/lib/i18n/context";
import { useIsLowEndDevice } from "@/lib/useDeviceTier";

export default function AboutOverviewPage() {
  const { lang } = useI18n();
  const isSw = lang === "SW";
  const isLowEnd = useIsLowEndDevice();

  const heroRef = useRef<HTMLElement>(null);
  const [heroMesh, setHeroMesh] = useState({ x: 60, y: 38, active: false });

  const chainPeople = [
    {
      num: "01",
      role: isSw ? "Mfamasia wa Kaunta" : "Community Pharmacist",
      part: isSw
        ? "Anakagua cheti, kuhakikisha dozi salama, na kumlinda mgonjwa."
        : "Reviews prescriptions, checks safe batches, and guides patients cleanly.",
    },
    {
      num: "02",
      role: isSw ? "Mhudumu wa Mauzo" : "Counter Attendant",
      part: isSw
        ? "Anafanya mauzo ya haraka na kuchapisha risiti hata intaneti ikikatika."
        : "Serves customers quickly with offline checkout and instant receipts.",
    },
    {
      num: "03",
      role: isSw ? "Mmiliki wa Duka" : "Pharmacy Owner",
      part: isSw
        ? "Anasimamia matawi, zamu za fedha, na kufuatilia tarehe za dawa."
        : "Oversees branch shifts, margins, and upcoming shelf expiry alerts.",
    },
    {
      num: "04",
      role: isSw ? "Msambazaji Halali" : "Licensed Wholesaler",
      part: isSw
        ? "Anapokea maagizo halisi kutoka madukani na kuthibitisha makundi."
        : "Fulfills verified weekly dispensary orders straight from depot stock.",
    },
    {
      num: "05",
      role: isSw ? "Dereva wa Ugavi" : "Fleet Driver",
      part: isSw
        ? "Anasafirisha mizigo salama kutoka ghala hadi mlango wa duka."
        : "Moves verified cartons reliably along regional routes across Tanzania.",
    },
    {
      num: "06",
      role: isSw ? "Timu ya Kliniki" : "Clinic & Dispensary Team",
      part: isSw
        ? "Wanaratibu dawa za wagonjwa wa nje na utunzaji wa baridi."
        : "Coordinates outpatient care prescriptions and cold-storage safety.",
    },
    {
      num: "07",
      role: "Kasri\u2122",
      part: isSw
        ? "Inalinda malipo ya jumla mpaka mzigo upokelewe na kuhakikiwa rafuni."
        : "Holds wholesale payments safely until cartons are verified on arrival.",
    },
    {
      num: "08",
      role: isSw ? "Mtafiti wa Afya" : "Public Health Researcher",
      part: isSw
        ? "Anasoma mwelekeo wa upatikanaji dawa ili kubaini upungufu mapema."
        : "Turns anonymized stock patterns into early shortage and stewardship signals.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col selection:bg-[#1039B9] selection:text-white antialiased overflow-x-clip">
      {/* Hero Over Brand Photography */}
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
            src="/cervos-people-delivery.jpg"
            alt="Pharmacy shopkeeper and regional driver working together"
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
                "linear-gradient(100deg, rgba(15, 23, 42, 0.94) 0%, rgba(15, 23, 42, 0.8) 52%, rgba(15, 23, 42, 0.35) 100%)",
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
              <FlipText text={isSw ? "MNYORORO MZIMA WA DAWA" : "THE MEDICINE CHAIN"} flipKey={lang} />
            </div>
            <h1
              className="text-3xl sm:text-5xl lg:text-[52px] font-bold tracking-tight text-white leading-[1.08] mb-5"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              <FlipText
                text={
                  isSw
                    ? "Tunafanya kazi na kila mtu anayefikisha dawa salama."
                    : "Working alongside everyone who moves medicine safely."
                }
                flipKey={lang}
                mode="words"
              />
            </h1>
            <p className="text-sm sm:text-lg text-slate-200 leading-relaxed mb-8 max-w-xl">
              <FlipText
                text={
                  isSw
                    ? "Kuanzia mfamasia wa mtaa hadi msambazaji na malipo ya Kasri\u2122, hapa ndipo watu wanane katika mnyororo wanapoungana."
                    : "From neighborhood counter staff to depot drivers and Kasri\u2122 clearing: eight essential roles connected cleanly to protect patients."
                }
                flipKey={lang}
                mode="words"
              />
            </p>
          </div>
        </div>
      </section>

      <main className="flex-1">
        {/* Eight Roles Across Our Chain */}
        <section className="py-16 sm:py-24 bg-white border-b border-[#E2E8F0]">
          <div className="max-w-6xl mx-auto px-5 sm:px-6">
            <div className="max-w-xl mb-12">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#006875] mb-2">
                <FlipText text={isSw ? "WATU WANANE" : "EIGHT ROLES IN SYNC"} flipKey={lang} />
              </div>
              <h2
                className="text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight"
                style={{ fontFamily: "Outfit, Inter, sans-serif" }}
              >
                <FlipText
                  text={
                    isSw
                      ? "Kila hatua kuanzia ghala hadi mikononi mwa mgonjwa."
                      : "Every hand between factory release and patient care."
                  }
                  flipKey={lang}
                  mode="words"
                />
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 border-t border-l border-[#E2E8F0]">
              {chainPeople.map((person) => (
                <div
                  key={person.num}
                  className="p-6 sm:p-7 border-r border-b border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] transition-colors"
                >
                  <div className="text-[11px] font-mono font-bold text-[#1039B9] mb-3">
                    {person.num}
                  </div>
                  <h3
                    className="text-base font-bold text-[#0F172A] mb-2"
                    style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                  >
                    <FlipText text={person.role} flipKey={lang} />
                  </h3>
                  <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
                    <FlipText text={person.part} flipKey={lang} mode="words" />
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Choose Path: Detailed Company Story vs Partners */}
        <section className="py-16 sm:py-20 bg-[#F8FAFC]">
          <div className="max-w-5xl mx-auto px-5 sm:px-6">
            <div className="text-center mb-10">
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#1039B9] mb-2">
                <FlipText text={isSw ? "CHAGUA SEHEMU" : "GO DEEPER"} flipKey={lang} />
              </div>
              <h2
                className="text-2xl sm:text-3xl font-bold text-[#0F172A]"
                style={{ fontFamily: "Outfit, Inter, sans-serif" }}
              >
                <FlipText
                  text={isSw ? "Ungependa kusoma zaidi kuhusu nini?" : "Where would you like to read further?"}
                  flipKey={lang}
                  mode="words"
                />
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Link
                href="/about/company"
                className="group rounded-2xl border border-[#E2E8F0] bg-white p-8 hover:border-[#1039B9]/45 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#1039B9] mb-2">
                    01 &middot; CERVOS PHARMA
                  </div>
                  <h3
                    className="text-xl sm:text-2xl font-bold text-[#0F172A] mb-3 group-hover:text-[#1039B9] transition-colors"
                    style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                  >
                    <FlipText text={isSw ? "Kuhusu Kampuni" : "About Cervos Pharma"} flipKey={lang} />
                  </h3>
                  <p className="text-sm text-[#475569] leading-relaxed mb-6">
                    <FlipText
                      text={
                        isSw
                          ? "Soma hadithi yetu kutoka Dar es Salaam, kwa nini kaunta zisizo na mtandao ni muhimu, na misingi yetu."
                          : "Read our story from Dar es Salaam, why offline-first counters matter, and our core principles."
                      }
                      flipKey={lang}
                      mode="words"
                    />
                  </p>
                </div>
                <span className="text-xs font-bold text-[#1039B9]">
                  <FlipText text={isSw ? "Soma Zaidi" : "Read Company Story"} flipKey={lang} /> &rarr;
                </span>
              </Link>

              <Link
                href="/partners"
                className="group rounded-2xl border border-[#E2E8F0] bg-white p-8 hover:border-[#006875]/45 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#006875] mb-2">
                    02 &middot; PARTNERS
                  </div>
                  <h3
                    className="text-xl sm:text-2xl font-bold text-[#0F172A] mb-3 group-hover:text-[#006875] transition-colors"
                    style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                  >
                    <FlipText text={isSw ? "Wadau na Washirika" : "Our Partners"} flipKey={lang} />
                  </h3>
                  <p className="text-sm text-[#475569] leading-relaxed mb-6">
                    <FlipText
                      text={
                        isSw
                          ? "Fahamu wasambazaji, makampuni ya usafirishaji, na jinsi ya kushirikiana na Cervos Pharma."
                          : "Discover our distributors, cold-chain fleets, Kasri\u2122 clearing, and submit a partnership inquiry."
                      }
                      flipKey={lang}
                      mode="words"
                    />
                  </p>
                </div>
                <span className="text-xs font-bold text-[#006875]">
                  <FlipText text={isSw ? "Fungua Ukurasa wa Wadau" : "Explore Partners"} flipKey={lang} /> &rarr;
                </span>
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
            <Link href="/about/company" className="hover:text-white transition-colors">
              Cervos Pharma
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
