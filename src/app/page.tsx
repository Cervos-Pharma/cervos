"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import {
  detectClientPlatform,
  getDownloadBuilds,
  type PlatformBuildId,
} from "@/lib/landing-data";
import {
  IconBolt,
  IconShield,
  IconLock,
  IconScanner,
  IconDownload,
  IconMobile,
  IconWindows,
  IconLinux,
  IconApple,
  IconCheck,
} from "@/components/LandingIcons";
import FlipText from "@/components/FlipText";
import ForegroundModal from "@/components/ForegroundModal";
import PublicNav from "@/components/PublicNav";
import PartnersTaperRibbon from "@/components/PartnersTaperRibbon";
import SupportHelpSection from "@/components/SupportHelpSection";
import type { ActiveStationPing } from "@/components/TanzaniaGlobe";
import { useI18n } from "@/lib/i18n/context";
import { useIsLowEndDevice } from "@/lib/useDeviceTier";
import { triggerBackgroundDownload } from "@/lib/workspace/download";

const TanzaniaGlobe = dynamic(() => import("@/components/TanzaniaGlobe"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
      Loading Mesh Globe...
    </div>
  ),
});

interface PublicStatsResponse {
  pharmacies: number;
  suppliers: number;
  branches: number;
  downloads: number;
  markers: Array<{
    lat: number;
    lng: number;
    status: "online" | "grace" | "offline";
  }>;
}

const DEFAULT_ACTIVE_PINGS: ActiveStationPing[] = [
  { lat: -6.8137, lng: 39.2819 },
  { lat: -6.8217, lng: 39.2834 },
  { lat: -6.79, lng: 39.208 },
  { lat: -6.895, lng: 39.276 },
  { lat: -5.0667, lng: 39.1 },
];

export default function CervosLandingPage() {
  const { lang } = useI18n();
  const isSw = lang === "SW";
  const isLowEnd = useIsLowEndDevice();
  const builds = getDownloadBuilds(isSw);
  const [detectedBuild, setDetectedBuild] = useState<PlatformBuildId>("windows");

  useEffect(() => {
    setDetectedBuild(detectClientPlatform());
  }, []);

  const activeBuild = builds.find((b) => b.id === detectedBuild) ?? builds[1];

  // Interactive Hover Mesh State
  const heroRef = useRef<HTMLElement>(null);
  const [heroMesh, setHeroMesh] = useState({ x: 64, y: 42, active: false });

  // 10-second opposite alternating CTA state between Hero CTA and Top Nav button
  const [ctaCycle, setCtaCycle] = useState<"signup_hero" | "signin_hero">("signup_hero");
  const [shimmerTick, setShimmerTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCtaCycle((prev) => (prev === "signup_hero" ? "signin_hero" : "signup_hero"));
      setShimmerTick((t) => t + 1);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const navShowsSignIn = ctaCycle === "signup_hero";
  const navCtaLabel = navShowsSignIn
    ? isSw ? "Ingia" : "Sign In"
    : isSw ? "Anza Sasa" : "Get Started";
  const navCtaHref = navShowsSignIn ? "/auth?mode=signin" : "/auth?mode=signup";

  const heroCtaLabel = navShowsSignIn
    ? isSw ? "Anza Sasa" : "Get Started"
    : isSw ? "Ingia" : "Sign In";
  const heroCtaHref = navShowsSignIn ? "/auth?mode=signup" : "/auth?mode=signin";

  // Expanded Card Focus State for #field ("Read More")
  const [focusedFieldIndex, setFocusedFieldIndex] = useState<number | null>(null);

  useEffect(() => {
    if (focusedFieldIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocusedFieldIndex(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusedFieldIndex]);

  // Live Network Counter (hydrated directly from /api/public/stats without fake pre-fetch number)
  const [stats, setStats] = useState<PublicStatsResponse>({
    pharmacies: 0,
    suppliers: 0,
    branches: 0,
    downloads: 0,
    markers: [],
  });
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [displayedCount, setDisplayedCount] = useState(0);
  const displayedCountRef = useRef(0);

  useEffect(() => {
    let active = true;
    const loadStats = async () => {
      try {
        const res = await fetch("/api/public/stats", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as PublicStatsResponse;
        if (active && typeof json.pharmacies === "number") {
          setStats((prev) => {
            const prevTotal = prev.pharmacies + prev.suppliers;
            const nextTotal = (json.pharmacies || 0) + (json.suppliers || 0);
            // Never clobber an active non-zero DB snapshot with a transient zero response
            if (prevTotal > 0 && nextTotal === 0) return prev;
            return json;
          });
          setStatsLoaded(true);
        }
      } catch {
        /* keep current live snapshot */
      }
    };
    loadStats();
    const timer = setInterval(loadStats, 15000);
    const onVis = () => {
      if (document.visibilityState === "visible") void loadStats();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const totalBusinesses = stats.pharmacies + stats.suppliers;

  useEffect(() => {
    if (!statsLoaded) return;
    const start = displayedCountRef.current;
    const target = totalBusinesses;
    if (start === target) return;
    const duration = 650;
    const startTime = performance.now();
    let frameId = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(start + (target - start) * eased);
      displayedCountRef.current = next;
      setDisplayedCount(next);
      if (progress < 1) frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [totalBusinesses, statsLoaded]);

  const liveOnlinePings: ActiveStationPing[] = useMemo(() => {
    return (stats.markers || [])
      .filter((m) => m.status === "online" && typeof m.lat === "number" && typeof m.lng === "number")
      .map((m) => ({ lat: m.lat, lng: m.lng }));
  }, [stats.markers]);

  const activeStationPings: ActiveStationPing[] = useMemo(() => {
    if (liveOnlinePings.length > 0) return liveOnlinePings;
    const fallbackMarkers = (stats.markers || [])
      .filter((m) => typeof m.lat === "number" && typeof m.lng === "number")
      .map((m) => ({ lat: m.lat, lng: m.lng }));
    return fallbackMarkers.length > 0 ? fallbackMarkers : DEFAULT_ACTIVE_PINGS;
  }, [liveOnlinePings, stats.markers]);

  const platformIcon = (id: string) => {
    if (id === "pwa") return <IconMobile className="w-5 h-5" />;
    if (id === "windows") return <IconWindows className="w-5 h-5" />;
    if (id === "linux") return <IconLinux className="w-5 h-5" />;
    return <IconApple className="w-5 h-5" />;
  };

  const bridgeCards = [
    {
      title: isSw ? "Kaunta Bila Mtandao" : "Offline Counter",
      desc: isSw
        ? "Mauzo na risiti vinaendelea kwenye kifaa chako hata mtandao ukikatika."
        : "Every sale and receipt saves locally so queues never wait.",
      icon: <IconBolt className="w-7 h-7 text-[#1039B9]" />,
      cta: isSw ? "Tazama" : "Explore",
      href: "#field",
    },
    {
      title: isSw ? "Usalama wa Rafu" : "Batch Expiry Lock",
      desc: isSw
        ? "Dawa ya kwanza kuisha inachaguliwa kwanza. Iliyoisha haiuzwi."
        : "Scanners pick safe stock first and lock expired boxes.",
      icon: <IconShield className="w-7 h-7 text-[#006875]" />,
      cta: isSw ? "Tazama" : "Explore",
      href: "#field",
    },
    {
      title: isSw ? "Ulinzi wa Kasri\u2122" : "Pay On Delivery",
      desc: isSw
        ? "Pesa yako ya jumla inalipwa kupitia Kasri\u2122 pale tu unaposkani mzigo rafuni."
        : "Restock funds stay safe in Kasri\u2122 until delivery is verified.",
      icon: <IconLock className="w-7 h-7 text-[#00542C]" />,
      cta: isSw ? "Tazama" : "Explore",
      href: "#field",
    },
  ];

  const focusColumns = [
    {
      icon: <IconBolt className="w-6 h-6 text-[#1039B9]" />,
      title: isSw ? "Kasi ya 0ms" : "Instant Checkout",
      desc: isSw ? "Risiti papo hapo kaunta." : "Zero delay at the register.",
    },
    {
      icon: <IconShield className="w-6 h-6 text-[#006875]" />,
      title: isSw ? "Usalama wa FEFO" : "Safe Medicines",
      desc: isSw ? "Hakuna kuuza dawa iliyoisha." : "Automatic expiry lock on scan.",
    },
    {
      icon: <IconScanner className="w-6 h-6 text-[#1039B9]" />,
      title: isSw ? "Hesabu za Droo" : "Balanced Tills",
      desc: isSw ? "Pesa inalingana na risiti." : "Shift close matches every receipt.",
    },
    {
      icon: <IconLock className="w-6 h-6 text-[#00542C]" />,
      title: isSw ? "Malipo ya Kasri\u2122" : "Fair Restocking",
      desc: isSw ? "Kupitia Kasri\u2122." : "Wholesale via Kasri\u2122 on delivery.",
    },
  ];

  const storyParagraphs = [
    {
      num: "01",
      label: isSw ? "Tunachofanya" : "What we do",
      text: isSw
        ? "Tunatengeneza programu tulivu na za kuaminika kwa ajili ya kaunta na ghala za maduka ya dawa, ili kazi isisimame kamwe, dawa zihakikiwe kabla ya kumfikia mgonjwa, na maagizo ya jumla yawe ya haki."
        : "We make calm, dependable software for neighborhood pharmacy counters and stockrooms, built so service never freezes, medicines are checked before reaching patients, and restocking stays fair.",
    },
    {
      num: "02",
      label: isSw ? "Kwanini tupo" : "Why it matters",
      text: isSw
        ? "Maduka ya dawa mitaani ndiyo kimbilio la kwanza la familia mgonjwa anapohitaji msaada. Lakini kukatika kwa umeme au mtandao kunasimamisha foleni, na dawa zinazopitwa na wakati kimya kimya zinagharimu imani na mapato ya duka."
        : "Community pharmacies are often the first place families turn when someone falls ill. Yet brief power or internet drops pause checkout lines, while untracked shelf dates quietly cost both trust and livelihood.",
    },
    {
      num: "03",
      label: isSw ? "Wadau na faida" : "With whom & the difference",
      text: isSw
        ? "Tunafanya kazi bega kwa bega na wafamasia wa kaunta, wamiliki wa matawi, na wasambazaji halali kote Tanzania ili kuweka maduka wazi siku nzima, kulinda wagonjwa dhidi ya dawa mbovu, na kuhakikisha kila mzigo unafika salama."
        : "Working side by side with local pharmacy teams, branch owners, and trusted wholesale distributors across Tanzania, Cervos keeps counters open all day, prevents expired stock from leaving shelves, and ensures wholesale orders arrive safely.",
    },
  ];

  const fieldCards = [
    {
      img: "/cervos-people-counter.jpg",
      title: isSw ? "Kwenye Kaunta" : "At the Counter",
      desc: isSw
        ? "Malipo ya haraka na risiti papo hapo kaunta."
        : "Fast checkout and receipts straight from your counter.",
      ctaLabel: isSw ? "Anza Sasa" : "Get Started",
      ctaHref: "/auth?mode=signup",
      pitchTitle: isSw
        ? "Usimcheleweshe mgonjwa kwa kusubiri mtandao."
        : "Never make a patient wait on slow internet.",
      pitchBody: isSw
        ? "Kila dawa unayouza inahifadhiwa moja kwa moja kwenye kompyuta ya kaunta. Hata mtandao au umeme ukikatika ghafla, risiti inachapishwa papo hapo na hesabu zinatunzwa salama."
        : "Every sale saves right on your counter terminal the instant you scan. Even when mobile data drops out, receipts print immediately, your cash drawer stays fast, and records sync cleanly once online.",
      wins: [
        isSw ? "Inafanya kazi bila intaneti kabisa" : "Works 100% offline all day",
        isSw ? "Risiti inachapishwa chini ya sekunde moja" : "Instant thermal receipt printing",
        isSw ? "Ufungaji rahisi wa hesabu za zamu jioni" : "Clean evening cash close",
      ],
    },
    {
      img: "/cervos-people-stockroom.jpg",
      title: isSw ? "Kwenye Rafu" : "On Your Shelves",
      desc: isSw
        ? "Chagua dawa salama kwanza na zuia zilizopitwa."
        : "Pick fresh batches first and lock out expired medicine.",
      ctaLabel: isSw ? "Anza Sasa" : "Get Started",
      ctaHref: "/auth?mode=signup&role=pharmacy",
      pitchTitle: isSw
        ? "Linda wagonjwa na zuia hasara ya dawa kuharibika."
        : "Protect every patient and stop silent shelf losses.",
      pitchBody: isSw
        ? "Unaposkani dawa, mfumo unachagua dawa inayokaribia kuisha muda kwanza ili usipoteze mtaji. Dawa yoyote iliyopitwa na wakati inafungwa kabisa isitoke kaunta."
        : "Every barcode scan picks the earliest safe batch automatically, rotating shelves before stock goes bad. If a box passes its expiry date, Cervos locks it out of checkout completely.",
      wins: [
        isSw ? "Dawa ya kwanza kuisha inachaguliwa kwanza" : "Oldest safe batch picked first",
        isSw ? "Kizuizi cha lazima kwa dawa iliyoisha" : "Hard lock on expired medicine",
        isSw ? "Tahadhari za mapema kabla mzigo haujaisha" : "Early shelf expiry warnings",
      ],
    },
    {
      img: "/cervos-people-delivery.jpg",
      title: isSw ? "Ugavi wa Jumla" : "Wholesale Supply",
      desc: isSw
        ? "Agiza kwa wasambazaji wa kweli na lipa mzigo ukifika."
        : "Order from trusted suppliers and pay when boxes arrive.",
      ctaLabel: isSw ? "Jiunge Nasi" : "Join Us",
      ctaHref: "/auth?mode=signup&role=supplier",
      pitchTitle: isSw
        ? "Ongeza wateja wa maduka halisi wanaonunua kila wiki."
        : "Connect directly with verified dispensaries ordering every week.",
      pitchBody: isSw
        ? "Maduka ya dawa yanaagiza moja kwa moja kutoka ghala lako huku malipo yakilindwa na Kasri\u2122 mpaka mzigo upokelewe rafuni. Hakuna kufukuza ankara wala wasiwasi wa malipo."
        : "Receive repeat restock orders straight from active pharmacy shelves with payments secured in Kasri\u2122 until verified delivery. Build lasting buyer relationships across East Africa with zero invoice chasing.",
      wins: [
        isSw ? "Oda za moja kwa moja kutoka famasia" : "Direct orders from active pharmacies",
        isSw ? "Malipo salama yanayolipwa mzigo ukifika" : "Guaranteed payment upon delivery",
        isSw ? "Ufuatiliaji wazi wa safari za magari" : "Clear route visibility across Tanzania",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] selection:bg-[#1039B9] selection:text-white antialiased overflow-x-clip">
      {/* ------------------------------------------------------------------ */}
      {/* Style 3 Hero: Bright Vivid Branded Photo + Responsive Hover Mesh   */}
      {/* ------------------------------------------------------------------ */}
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
        className="relative bg-[#0F172A] text-white pb-28 sm:pb-36 pt-5 sm:pt-6 overflow-hidden group/hero"
      >
        <div className="absolute inset-0 z-0">
          <Image
            src="/cervos-counter-station.jpg"
            alt="Cervos Pharma Counter Station"
            fill
            className="object-cover object-center opacity-95 transition-transform duration-500 ease-out"
            style={{
              transform:
                !isLowEnd && heroMesh.active
                  ? `scale(1.02) translate(${(50 - heroMesh.x) * 0.08}px, ${(50 - heroMesh.y) * 0.08}px)`
                  : "scale(1)",
            }}
            priority
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(95deg, rgba(15, 23, 42, 0.92) 0%, rgba(15, 23, 42, 0.72) 40%, rgba(15, 23, 42, 0.22) 72%, rgba(15, 23, 42, 0.06) 100%)",
            }}
          />
        </div>

        {/* Crisp Interactive Pointer Hover Mesh */}
        <div
          className="pointer-events-none absolute inset-0 z-10 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(148, 163, 184, 0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.2) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-200"
          style={{
            opacity: heroMesh.active ? 1 : 0.3,
            backgroundImage:
              "linear-gradient(to right, rgba(56, 189, 248, 0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(56, 189, 248, 0.5) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            maskImage: `radial-gradient(300px circle at ${heroMesh.x}% ${heroMesh.y}%, black 0%, transparent 72%)`,
            WebkitMaskImage: `radial-gradient(300px circle at ${heroMesh.x}% ${heroMesh.y}%, black 0%, transparent 72%)`,
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-200"
          style={{
            opacity: heroMesh.active ? 0.72 : 0.2,
            background: `radial-gradient(380px circle at ${heroMesh.x}% ${heroMesh.y}%, rgba(16, 57, 185, 0.36), transparent 68%)`,
          }}
        />

        {/* Top Navigation Bar with Dropdowns + EN/SW + Alternating CTA */}
        <PublicNav
          variant="hero"
          ctaLabel={navCtaLabel}
          ctaHref={navCtaHref}
          ctaFlipKey={`${lang}-${ctaCycle}`}
          shimmerTick={shimmerTick}
          isLowEnd={isLowEnd}
        />

        {/* Left Hero Message (Clean, zero slop pill) */}
        <div className="max-w-6xl mx-auto px-5 sm:px-6 relative z-20 pt-2">
          <div className="max-w-xl">
            <h1
              className="text-3xl sm:text-5xl lg:text-[56px] font-bold tracking-tight text-white leading-[1.08] mb-5 drop-shadow-xs"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              <FlipText
                text={isSw ? "Kaunta ya Dawa" : "The Pharmacy Counter"}
                flipKey={lang}
              />
              <br />
              <FlipText
                text={isSw ? "Isiyosimama Kamwe" : "That Never Stops"}
                flipKey={lang}
              />
            </h1>

            <p className="text-sm sm:text-lg text-slate-100 mb-7 sm:mb-8 max-w-lg leading-relaxed drop-shadow-2xs">
              <FlipText
                mode="words"
                text={
                  isSw
                    ? "Uza dawa hata mtandao ukikatika, zuia dawa zilizopitwa na wakati, na agiza mzigo kwa usalama."
                    : "Fast offline counter sales, zero expired stock dispensed, and protected wholesale restocking."
                }
                flipKey={lang}
              />
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href={heroCtaHref}
                className="relative overflow-hidden w-full sm:w-auto text-center px-6 py-3 rounded bg-[#1039B9] hover:bg-[#0D2E94] text-white text-xs font-semibold shadow-md transition-all min-w-[138px]"
              >
                {!isLowEnd && shimmerTick > 0 && (
                  <span key={`hero-glimmer-${shimmerTick}`} className="cta-glimmer-overlay" />
                )}
                <FlipText text={heroCtaLabel} flipKey={`${lang}-${ctaCycle}`} />
              </Link>
              <a
                href="#downloads"
                className="w-full sm:w-auto text-center px-6 py-3 rounded border border-white/40 bg-white/10 backdrop-blur-xs hover:bg-white/20 text-white text-xs font-semibold transition-all"
              >
                <FlipText text={isSw ? "Pakua Cervos" : "Download Cervos"} flipKey={lang} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Overlapping 3 Elevated White Cards                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 -mt-16 sm:-mt-20 relative z-30">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {bridgeCards.map((c, idx) => (
            <div
              key={idx}
              className="group relative bg-white rounded-md border border-[#E2E8F0] shadow-lg p-7 text-center flex flex-col items-center justify-between transition-all duration-300 hover:-translate-y-1.5 hover:border-[#1039B9]/40 hover:shadow-xl overflow-hidden"
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, rgba(16, 57, 185, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(16, 57, 185, 0.05) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              />
              <div className="relative z-10 flex flex-col items-center">
                <div className="mb-4 p-3 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] group-hover:border-[#1039B9]/30 transition-colors">
                  {c.icon}
                </div>
                <h2 className="text-lg font-bold text-[#0F172A] mb-2">
                  <FlipText text={c.title} flipKey={lang} />
                </h2>
                <p className="text-xs text-[#475569] leading-relaxed mb-6">
                  <FlipText text={c.desc} flipKey={lang} mode="words" />
                </p>
              </div>
              <a
                href={c.href}
                className="relative z-10 px-5 py-2 rounded bg-[#1039B9] hover:bg-[#0D2E94] text-white text-xs font-semibold transition-all"
              >
                <FlipText text={c.cta} flipKey={lang} />
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 4-Column Light Focus Grid                                          */}
      {/* ------------------------------------------------------------------ */}
      <section id="focus" className="py-16 sm:py-20 bg-[#F8FAFC]">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 text-center">
          <div className="text-xs font-bold tracking-[0.22em] uppercase text-[#1039B9] mb-10 sm:mb-12">
            <FlipText
              text={isSw ? "MISINGI YA FAMASIA" : "OUR DISPENSARY FOCUS"}
              flipKey={lang}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {focusColumns.map((col, i) => (
              <div
                key={i}
                className="group flex flex-col items-center p-5 rounded-md border border-transparent hover:border-[#E2E8F0] hover:bg-white transition-all"
              >
                <div className="mb-4 p-2.5 rounded-lg bg-white border border-[#E2E8F0] shadow-2xs group-hover:scale-105 transition-transform">
                  {col.icon}
                </div>
                <h3 className="text-base font-bold text-[#0F172A] mb-1.5">
                  <FlipText text={col.title} flipKey={lang} />
                </h3>
                <p className="text-xs text-[#475569] leading-relaxed max-w-[220px]">
                  <FlipText text={col.desc} flipKey={lang} mode="words" />
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Artistic Editorial About Us Story (No Clickables, Revolving/Float) */}
      {/* ------------------------------------------------------------------ */}
      <section id="about" className="py-24 sm:py-28 bg-white border-y border-[#E2E8F0]">
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-14 lg:gap-12 items-center">
            <div className="lg:col-span-6">
              <div className="text-xs font-bold tracking-[0.24em] uppercase text-[#006875] mb-3">
                <FlipText text={isSw ? "HADITHI YETU" : "OUR STORY"} flipKey={lang} />
              </div>
              <h2
                className="text-3xl sm:text-4xl font-bold text-[#0F172A] leading-[1.14] mb-10"
                style={{ fontFamily: "Outfit, Inter, sans-serif" }}
              >
                <FlipText
                  text={
                    isSw
                      ? "Zana rahisi na imara kwa kila duka la dawa."
                      : "Quiet software built around real neighborhood care."
                  }
                  flipKey={lang}
                />
              </h2>

              <div className="space-y-9">
                {storyParagraphs.map((para, idx) => (
                  <div
                    key={para.num}
                    className={`relative pl-8 border-l border-[#E2E8F0] ${idx === 1 ? "lg:ml-6" : idx === 2 ? "lg:ml-3" : ""
                      }`}
                  >
                    <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-white ring-2 ring-[#1039B9]" />
                    <div className="flex items-center gap-2.5 mb-2">
                      <span className="text-[11px] font-bold tracking-widest uppercase text-[#1039B9]">
                        {para.num}
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        <FlipText text={para.label} flipKey={lang} />
                      </span>
                    </div>
                    <p className="text-sm sm:text-base text-[#334155] leading-relaxed">
                      <FlipText text={para.text} flipKey={lang} mode="words" />
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-8 pl-8">
                <Link
                  href="/about"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#1039B9] hover:text-[#0D2E94] border-b border-[#1039B9]/30 hover:border-[#0D2E94] pb-0.5 transition-all"
                >
                  <FlipText text={isSw ? "Soma zaidi" : "Find out more"} flipKey={lang} />
                  <span>&rarr;</span>
                </Link>
              </div>
            </div>

            <div className="lg:col-span-6 relative h-[460px] sm:h-[520px] flex items-center justify-center">
              <div className="absolute w-80 h-80 rounded-full bg-blue-100/60 blur-3xl pointer-events-none" />
              <div className="absolute w-60 h-60 sm:w-72 sm:h-72 rounded-full border border-dashed border-slate-300/80 pointer-events-none" />

              <div className={`${isLowEnd ? "" : "animate-orbit-ring"} relative w-[300px] h-[300px] sm:w-[370px] sm:h-[370px] rounded-full border border-slate-200/90 flex items-center justify-center pointer-events-none`}>
                <div className={`${isLowEnd ? "" : "animate-orbit-upright"} absolute -top-5 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-[#1039B9]`}>
                  <IconBolt className="w-4 h-4" />
                </div>
                <div className={`${isLowEnd ? "" : "animate-orbit-upright"} absolute top-1/2 -right-5 -translate-y-1/2 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-[#006875]`}>
                  <IconShield className="w-4 h-4" />
                </div>
                <div className={`${isLowEnd ? "" : "animate-orbit-upright"} absolute -bottom-5 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-[#00542C]`}>
                  <IconLock className="w-4 h-4" />
                </div>
                <div className={`${isLowEnd ? "" : "animate-orbit-upright"} absolute top-1/2 -left-5 -translate-y-1/2 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-[#1039B9]`}>
                  <IconScanner className="w-4 h-4" />
                </div>
              </div>

              <div className="absolute w-24 h-24 rounded-full bg-white shadow-xl border border-slate-200 flex items-center justify-center z-20">
                <div className="relative w-16 h-16">
                  <Image
                    src="/cervos-product-logo-circular.svg"
                    alt="Cervos Product Mark"
                    fill
                    className="object-contain"
                  />
                </div>
              </div>

              <div className={`${isLowEnd ? "" : "animate-float-gentle"} absolute top-4 left-2 sm:left-4 w-44 sm:w-52 h-32 sm:h-36 rounded-2xl overflow-hidden shadow-xl border-4 border-white bg-white z-10`}>
                <Image
                  src="/cervos-people-counter.jpg"
                  alt="Pharmacist assisting customer at Cervos community pharmacy"
                  fill
                  className="object-cover"
                />
              </div>

              <div
                className={`${isLowEnd ? "" : "animate-float-gentle"} absolute bottom-4 right-2 sm:right-4 w-44 sm:w-52 h-32 sm:h-36 rounded-2xl overflow-hidden shadow-xl border-4 border-white bg-white z-10`}
                style={{ animationDelay: "1.8s" }}
              >
                <Image
                  src="/cervos-people-delivery.jpg"
                  alt="Driver and shopkeeper checking arriving pharmacy cartons"
                  fill
                  className="object-cover"
                />
              </div>

              <div
                className={`${isLowEnd ? "" : "animate-float-gentle"} absolute top-12 right-4 sm:right-8 px-3.5 py-1.5 rounded-full bg-white/95 backdrop-blur-sm border border-slate-200 shadow-md text-[11px] font-semibold text-[#0F172A] z-20`}
                style={{ animationDelay: "0.9s" }}
              >
                <FlipText text={isSw ? "Bila Mtandao" : "Always Open"} flipKey={lang} />
              </div>
              <div
                className={`${isLowEnd ? "" : "animate-float-gentle"} absolute bottom-14 left-4 sm:left-10 px-3.5 py-1.5 rounded-full bg-white/95 backdrop-blur-sm border border-slate-200 shadow-md text-[11px] font-semibold text-[#006875] z-20`}
                style={{ animationDelay: "2.4s" }}
              >
                <FlipText text={isSw ? "Dawa Salama" : "Patient Safe"} flipKey={lang} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Deep Navy Branded Field Gallery + Interactive Expand Focus         */}
      {/* ------------------------------------------------------------------ */}
      <section id="field" className="py-20 bg-[#0F172A] text-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <div className="text-center text-xs font-bold tracking-[0.22em] uppercase text-blue-300 mb-12">
            <FlipText text={isSw ? "VITUO VYA CERVOS" : "INSIDE CERVOS STATIONS"} flipKey={lang} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {fieldCards.map((fc, idx) => (
              <div
                key={fc.img}
                className="group bg-white rounded-md overflow-hidden shadow-lg flex flex-col justify-between transition-transform duration-300 hover:-translate-y-1"
              >
                <div className="relative h-52 w-full bg-slate-200 overflow-hidden">
                  <Image
                    src={fc.img}
                    alt={fc.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-6 text-[#0F172A] flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-bold text-[#0F172A] mb-1.5">
                      <FlipText text={fc.title} flipKey={lang} />
                    </h3>
                    <p className="text-xs text-[#475569] leading-relaxed mb-5">
                      <FlipText text={fc.desc} flipKey={lang} mode="words" />
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    <Link
                      href={fc.ctaHref}
                      className="inline-block px-4 py-1.5 rounded bg-[#1039B9] hover:bg-[#0D2E94] text-white text-xs font-semibold transition-all"
                    >
                      <FlipText text={fc.ctaLabel} flipKey={lang} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setFocusedFieldIndex(idx)}
                      className="text-xs font-semibold text-[#006875] hover:text-[#1039B9] transition-colors inline-flex items-center gap-1"
                    >
                      <FlipText text={isSw ? "Soma Zaidi" : "Read More"} flipKey={lang} />
                      <span>&rarr;</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <ForegroundModal
          open={focusedFieldIndex !== null && Boolean(fieldCards[focusedFieldIndex])}
          onClose={() => setFocusedFieldIndex(null)}
          ariaLabel={focusedFieldIndex !== null ? fieldCards[focusedFieldIndex]?.title : undefined}
          backdropClassName="bg-[#0F172A]/80 backdrop-blur-sm"
          panelClassName="relative max-w-3xl w-full bg-white text-[#0F172A] rounded-xl overflow-hidden shadow-2xl border border-slate-200"
        >
          {focusedFieldIndex !== null && fieldCards[focusedFieldIndex] && (
            <div>
              <button
                type="button"
                onClick={() => setFocusedFieldIndex(null)}
                aria-label={isSw ? "Funga" : "Close"}
                className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-white/95 hover:bg-white text-[#0F172A] shadow-md border border-slate-200 flex items-center justify-center transition-transform hover:scale-105 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="grid grid-cols-1 md:grid-cols-12">
                <div className="md:col-span-5 relative h-64 md:h-auto min-h-[260px] bg-slate-100">
                  <Image
                    src={fieldCards[focusedFieldIndex].img}
                    alt={fieldCards[focusedFieldIndex].title}
                    fill
                    className="object-cover"
                  />
                </div>

                <div className="md:col-span-7 p-7 sm:p-9 flex flex-col justify-between">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#006875] mb-2">
                      <FlipText text={fieldCards[focusedFieldIndex].title} flipKey={lang} />
                    </div>
                    <h3
                      className="text-xl sm:text-2xl font-bold text-[#0F172A] leading-snug mb-3"
                      style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                    >
                      <FlipText text={fieldCards[focusedFieldIndex].pitchTitle} flipKey={lang} mode="words" />
                    </h3>
                    <p className="text-sm text-[#475569] leading-relaxed mb-6">
                      <FlipText text={fieldCards[focusedFieldIndex].pitchBody} flipKey={lang} mode="words" />
                    </p>

                    <ul className="space-y-2.5 mb-8">
                      {fieldCards[focusedFieldIndex].wins.map((w) => (
                        <li key={w} className="flex items-center gap-2.5 text-xs font-semibold text-[#0F172A]">
                          <span className="w-5 h-5 rounded-full bg-emerald-50 text-[#00542C] flex items-center justify-center shrink-0">
                            <IconCheck className="w-3.5 h-3.5" />
                          </span>
                          <FlipText text={w} flipKey={lang} mode="words" />
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100">
                    <Link
                      href={fieldCards[focusedFieldIndex].ctaHref}
                      onClick={() => setFocusedFieldIndex(null)}
                      className="px-6 py-2.5 rounded bg-[#1039B9] hover:bg-[#0D2E94] text-white text-xs font-semibold transition-all shadow-sm"
                    >
                      <FlipText text={fieldCards[focusedFieldIndex].ctaLabel} flipKey={lang} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setFocusedFieldIndex(null)}
                      className="px-4 py-2.5 rounded border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-600 transition-colors cursor-pointer"
                    >
                      <FlipText text={isSw ? "Funga" : "Close"} flipKey={lang} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </ForegroundModal>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Floating Clinical Mesh Globe (Unclipped Top/Bottom/Left Halo)      */}
      {/* ------------------------------------------------------------------ */}
      <section
        id="network"
        className="relative py-20 sm:py-28 bg-[#F8FAFC] border-b border-[#E2E8F0] overflow-x-clip"
      >
        <div className="max-w-6xl mx-auto px-5 sm:px-6 relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-center min-h-[540px]">
            <div className="lg:col-span-5 relative z-20 pr-0 lg:pr-8">
              <div className="inline-flex items-center gap-2.5 px-3 py-1 rounded-full bg-white border border-emerald-200/90 shadow-[0_0_20px_rgba(16,185,129,0.22)] mb-4">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#00542C]">
                  <FlipText text={isSw ? "MTANDAO HAI TANZANIA" : "LIVE ACROSS TANZANIA"} flipKey={lang} />
                </span>
              </div>

              <h2
                className="text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-tight text-[#0F172A] leading-[1.15] mb-4"
                style={{ fontFamily: "Outfit, Inter, sans-serif" }}
              >
                {isSw ? (
                  <>
                    <FlipText text="Jiunge na maduka na wasambazaji" flipKey={lang} />{" "}
                    <span className="relative inline-flex items-center justify-center mx-1 px-2.5 py-0.5 rounded-lg bg-[#1039B9]/10 border border-[#38BDF8]/45 text-[#1039B9] tabular-nums shadow-[0_0_22px_rgba(56,189,248,0.4)]">
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute -inset-1 rounded-xl bg-gradient-to-r from-[#1039B9]/25 via-[#38BDF8]/30 to-[#10B981]/25 blur-md animate-pulse"
                      />
                      <span className="relative drop-shadow-[0_0_10px_rgba(16,57,185,0.28)]">
                        {statsLoaded ? displayedCount : "\u2014"}
                      </span>
                    </span>{" "}
                    <FlipText text="kote Tanzania." flipKey={lang} />
                  </>
                ) : (
                  <>
                    <FlipText text="Join" flipKey={lang} />{" "}
                    <span className="relative inline-flex items-center justify-center mx-1 px-2.5 py-0.5 rounded-lg bg-[#1039B9]/10 border border-[#38BDF8]/45 text-[#1039B9] tabular-nums shadow-[0_0_22px_rgba(56,189,248,0.4)]">
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute -inset-1 rounded-xl bg-gradient-to-r from-[#1039B9]/25 via-[#38BDF8]/30 to-[#10B981]/25 blur-md animate-pulse"
                      />
                      <span className="relative drop-shadow-[0_0_10px_rgba(16,57,185,0.28)]">
                        {statsLoaded ? displayedCount : "\u2014"}
                      </span>
                    </span>{" "}
                    <FlipText
                      text={statsLoaded && totalBusinesses === 1 ? "pharmacy or supplier." : "pharmacies and suppliers."}
                      flipKey={lang}
                    />
                  </>
                )}
              </h2>

              <p className="text-sm text-[#475569] leading-relaxed mb-8">
                <FlipText
                  mode="words"
                  text={
                    isSw
                      ? "Kila nukta inayowaka inaonyesha duka linalohudumia wagonjwa au kupokea mzigo leo."
                      : "Every soft light marks a pharmacy helping patients or fulfilling stock today."
                  }
                  flipKey={lang}
                />
              </p>

              <div className="grid grid-cols-2 gap-4 pt-6 border-t border-[#E2E8F0] max-w-md">
                <div className="p-4 rounded-md bg-white border border-emerald-200/80 shadow-[0_2px_16px_rgba(16,185,129,0.12)]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.85)]" />
                    <span className="text-xs font-semibold text-[#475569]">
                      <FlipText text={isSw ? "Wazi Leo" : "Open Today"} flipKey={lang} />
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-[#0F172A] tabular-nums">
                    {statsLoaded ? (liveOnlinePings.length || stats.branches) : "\u2014"}
                  </div>
                </div>

                <div className="p-4 rounded-md bg-white border border-[#E2E8F0] shadow-2xs">
                  <div className="text-xs font-semibold text-[#475569] mb-1">
                    <FlipText text={isSw ? "Matawi" : "Locations"} flipKey={lang} />
                  </div>
                  <div className="text-2xl font-bold text-[#1039B9] tabular-nums drop-shadow-[0_0_8px_rgba(16,57,185,0.2)]">
                    {statsLoaded ? stats.branches : "\u2014"}
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 relative h-[520px] sm:h-[680px] lg:h-[760px] -my-12 lg:-my-20 flex items-center justify-end pointer-events-auto">
              <div className="w-[620px] h-[620px] sm:w-[820px] sm:h-[820px] lg:w-[940px] lg:h-[840px] translate-x-6 sm:translate-x-20 lg:translate-x-36">
                <TanzaniaGlobe activePoints={activeStationPings} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Detected Device Download + Link to All Platforms                   */}
      {/* ------------------------------------------------------------------ */}
      <section id="downloads" className="py-20 sm:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-5 sm:px-6">
          <div className="text-center mb-10">
            <div className="text-xs font-bold tracking-[0.22em] uppercase text-[#1039B9] mb-2">
              <FlipText text={isSw ? "ANZA LEO" : "GET STARTED TODAY"} flipKey={lang} />
            </div>
            <h2
              className="text-3xl sm:text-4xl font-bold text-[#0F172A] tracking-tight"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              <FlipText
                text={isSw ? "Tayari kwa kifaa chako." : "Ready for your device."}
                flipKey={lang}
              />
            </h2>
          </div>

          <div className="max-w-xl mx-auto rounded-3xl border border-[#0F172A]/10 bg-[#0F172A] text-white p-7 sm:p-9 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-[#38BDF8]">{platformIcon(activeBuild.id)}</span>
                <h3
                  className="text-2xl font-bold text-white"
                  style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                >
                  {activeBuild.title}
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-sm">
                <FlipText text={activeBuild.desc} flipKey={lang} mode="words" />
              </p>
            </div>

            <div className="shrink-0">
              {activeBuild.href.startsWith("/") ? (
                <Link
                  href={activeBuild.href}
                  className="w-full sm:w-auto px-6 py-3 rounded-full bg-[#1039B9] hover:bg-[#0D2E94] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-md"
                >
                  <IconDownload className="w-4 h-4" />
                  <FlipText text={activeBuild.cta} flipKey={lang} />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    triggerBackgroundDownload(activeBuild.href);
                  }}
                  className="w-full sm:w-auto px-6 py-3 rounded-full bg-[#1039B9] hover:bg-[#0D2E94] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                >
                  <IconDownload className="w-4 h-4" />
                  <FlipText text={activeBuild.cta} flipKey={lang} />
                </button>
              )}
            </div>
          </div>

          <div className="text-center mt-6">
            <Link
              href="/downloads"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1039B9] hover:text-[#0D2E94] transition-colors"
            >
              <span>
                {isSw ? "Unatumia kifaa tofauti? Tazama vifaa vyote" : "Using another device? View all platforms"}
              </span>
              <span>&rarr;</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Our Partners - Tapered Optical Horizon Ribbon                      */}
      {/* ------------------------------------------------------------------ */}
      <PartnersTaperRibbon lang={lang} isSw={isSw} />

      {/* ------------------------------------------------------------------ */}
      {/* Unified Contact Us, Help, FAQ & Support Ticket Desk                */}
      {/* ------------------------------------------------------------------ */}
      <SupportHelpSection lang={lang} isSw={isSw} />

      {/* ------------------------------------------------------------------ */}
      {/* Clean Brand Footer                                                 */}
      {/* ------------------------------------------------------------------ */}
      <footer id="contacts" className="bg-[#0F172A] text-slate-300 py-12 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-xs">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3">
              <div className="relative w-7 h-7 rounded-full overflow-hidden bg-white">
                <Image
                  src="/cervos-company-logo-circular.svg"
                  alt="Cervos Pharma"
                  fill
                  className="object-contain p-0.5"
                />
              </div>
              <span className="font-bold text-white tracking-wide">Cervos Pharma</span>
              <span className="text-slate-400">&copy; {new Date().getFullYear()}</span>
            </div>
            <div className="text-[11px] text-slate-400">
              hq@cervos.online &middot; Dar es Salaam, Tanzania
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-slate-300">
            <Link href="/products" className="hover:text-white transition-colors">
              <FlipText text={isSw ? "Bidhaa" : "Products"} flipKey={lang} />
            </Link>
            <Link href="/markets" className="hover:text-white transition-colors">
              <FlipText text={isSw ? "Masoko" : "Markets"} flipKey={lang} />
            </Link>
            <a href="#focus" className="hover:text-white transition-colors">
              <FlipText text={isSw ? "Habari" : "The Dispatch"} flipKey={lang} />
            </a>
            <Link href="/partners" className="hover:text-white transition-colors">
              <FlipText text={isSw ? "Wadau" : "Partners"} flipKey={lang} />
            </Link>
            <a href="#support" className="hover:text-white transition-colors">
              <FlipText text={isSw ? "Msaada" : "Help"} flipKey={lang} />
            </a>
            <Link href="/about" className="hover:text-white transition-colors">
              <FlipText text={isSw ? "Kuhusu" : "About"} flipKey={lang} />
            </Link>
            <Link href="/downloads" className="hover:text-white transition-colors">
              <FlipText text={isSw ? "Pakua" : "Downloads"} flipKey={lang} />
            </Link>
            <Link href="/contact" className="hover:text-white transition-colors">
              <FlipText text={isSw ? "Mawasiliano" : "Contacts"} flipKey={lang} />
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
