"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FlipText from "@/components/FlipText";
import ForegroundModal from "@/components/ForegroundModal";
import {
  AluminumTabletMockup,
  AppleIPhoneMockup,
  DesktopStudioBezel,
  MacBookOwnerBezel,
  ProductWalkthroughModal,
  ScrollRevealBand,
  TitaniumPhoneMockup,
  UbuntuKioskBezel,
  type WalkthroughGuide,
} from "@/components/AppleHardwareMockups";
import { IconCheck } from "@/components/LandingIcons";
import { useIsLowEndDevice } from "@/lib/useDeviceTier";

type ProductKey = "counter" | "shelf" | "wholesale";

interface Props {
  lang: string;
  isSw: boolean;
  focusTarget?: ProductKey | null;
}

export default function ProductSuiteMockups({ lang, isSw, focusTarget }: Props) {
  const isLowEnd = useIsLowEndDevice();
  const router = useRouter();
  const [modalProduct, setModalProduct] = useState<ProductKey | null>(focusTarget ?? null);
  const [activeGen, setActiveGen] = useState(3);
  const [openGuideId, setOpenGuideId] = useState<ProductKey | null>(null);

  useEffect(() => {
    if (focusTarget) {
      setModalProduct(focusTarget);
    }
  }, [focusTarget]);

  useEffect(() => {
    if (!modalProduct) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeProductModal();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  });

  const closeProductModal = () => {
    setModalProduct(null);
    if (typeof window !== "undefined" && window.location.search.includes("focus=")) {
      router.replace("/products", { scroll: false });
    }
  };

  const productSpotlightSpecs: Record<
    ProductKey,
    {
      label: string;
      eyebrow: string;
      title: string;
      summary: string;
      outcomes: string[];
      facts: Array<{ label: string; value: string }>;
      ctaRole: string;
    }
  > = {
    counter: {
      label: isSw ? "Kaunta ya POS" : "Counter POS",
      eyebrow: isSw ? "KAUNTA YA MAUZO" : "COUNTER POS",
      title: isSw
        ? "Mauzo ya kasi yanayohudumia wagonjwa hata mtandao ukikatika."
        : "Fast patient checkout that keeps serving even without internet.",
      summary: isSw
        ? "Imeundwa kwa maduka yenye shughuli nyingi. Skani bidhaa, chapisha risiti ya mteja papo hapo, na funga hesabu za fedha za mwisho wa siku kwa dakika chache."
        : "Built for busy pharmacy counters. Scan barcodes into active bills, print customer receipts in under a second, and close daily shift cash without evening math stress.",
      outcomes: isSw
        ? [
            "Inafanya kazi kwenye Windows, Mac, na Ubuntu Linux dukani",
            "Inaendelea kuuza na kuchapisha risiti hata intaneti ikizimika",
            "Inapanga taslimu, M-Pesa, na kadi kwa kila zamu ya mhudumu",
            "Mmiliki anaona mauzo na faida za matawi yote kwa wakati halisi",
          ]
        : [
            "Works smoothly on existing Windows, Mac, and Linux shop computers",
            "Prints receipts and saves sales even when mobile internet drops",
            "Reconciles cash, mobile money, and split bills per operator shift",
            "Gives owners clear daily profit across every branch from one view",
          ],
      facts: [
        { label: isSw ? "Vifaa" : "Works on", value: "Windows, Mac & Linux" },
        { label: isSw ? "Muda wa Kuanza" : "Setup time", value: isSw ? "Dakika 5" : "Under 5 mins" },
        { label: isSw ? "Uhakika" : "Offline ready", value: isSw ? "Ndio, 100%" : "Yes, full day" },
      ],
      ctaRole: "pharmacy",
    },
    shelf: {
      label: isSw ? "Usalama wa Rafu" : "Shelf Control",
      eyebrow: isSw ? "ULINZI WA RAFU" : "SHELF & EXPIRY SHIELD",
      title: isSw
        ? "Okoa mtaji wako kwa kutoa makundi salama kwanza na kuzuia yaliyoisha."
        : "Stop losing capital to expired boxes sitting unseen on shelves.",
      summary: isSw
        ? "Tumia iPhone au Samsung yako kukagua mizigo inapoingia. Mfumo unachagua kundi la karibu kuisha kwanza na kuzuia mauzo ya dawa iliyopitwa na muda."
        : "Check arriving boxes straight from your iPhone or Samsung. Earliest safe batches route to patients first while expired medicines lock firmly at the counter.",
      outcomes: isSw
        ? [
            "Inatumia kamera ya simu ya iPhone au Samsung kukagua mizigo",
            "Inatuma tahadhari siku 60 kabla ya dawa kufikia tarehe ya mwisho",
            "Inaelekeza wahudumu kuuza kundi halali la zamani kwanza",
            "Kizuizi cha moja kwa moja kinazuia dawa iliyoisha kuuzwa",
          ]
        : [
            "Scan incoming stock directly with iPhone or Samsung cameras",
            "Sends early 60-day warnings so slow boxes never spoil unsold",
            "Guides counter staff automatically to earliest valid cartons first",
            "Prevents any expired pack from leaving the pharmacy register",
          ],
      facts: [
        { label: isSw ? "Simu" : "Works on", value: "iPhone & Samsung" },
        { label: isSw ? "Tahadhari" : "Notice", value: isSw ? "Siku 60 mapema" : "60 days early" },
        { label: isSw ? "Usalama" : "Expired block", value: "100% locked" },
      ],
      ctaRole: "pharmacy",
    },
    wholesale: {
      label: isSw ? "Ugavi & Kasri\u2122" : "Wholesale & Kasri\u2122",
      eyebrow: isSw ? "UGAVI WA JUMLA" : "WHOLESALE SUPPLY",
      title: isSw
        ? "Agiza mzigo kutoka maghala halali huku Kasri\u2122 ikilinda malipo yako."
        : "Restock from licensed wholesalers with payment protected by Kasri\u2122.",
      summary: isSw
        ? "Linganisha bei wazi kutoka kwa wasambazaji waliosajiliwa, fuatilia safari ya mzigo kupitia tableti, na ruhusu malipo kumfikia msambazaji mzigo ukifika."
        : "Compare clear wholesale catalog pricing across trusted hubs, watch deliveries arrive along regional corridors, and release Kasri\u2122 payout once boxes scan into your store.",
      outcomes: isSw
        ? [
            "Agiza moja kwa moja kutoka kwa wasambazaji waliosajiliwa nchini",
            "Angalia tarehe za dawa mapema kabla ya kuthibitisha oda",
            "Malipo yanashikiliwa na Kasri\u2122 hadi mzigo ufike salama dukani",
            "Hesabu za stoo zinaongezeka dukani mara tu unapopokea mzigo",
          ]
        : [
            "Order directly from verified wholesalers across Tanzania",
            "See pack sizes and remaining shelf dates before placing orders",
            "Kasri\u2122 protects payment until goods are received and checked",
            "Shop inventory updates instantly once cartons arrive on your shelf",
          ],
      facts: [
        { label: isSw ? "Kanda" : "Coverage", value: "Tanzania & Zanzibar" },
        { label: isSw ? "Malipo" : "Protection", value: "Kasri\u2122" },
        { label: isSw ? "Usafirishaji" : "Tracking", value: isSw ? "Moja kwa moja" : "Doorstep check" },
      ],
      ctaRole: "supplier",
    },
  };

  const walkthroughGuides: Record<ProductKey, WalkthroughGuide> = {
    counter: {
      id: "counter",
      eyebrow: "01 · COUNTER OS",
      title: isSw ? "Mwongozo wa Kaunta" : "Counter OS Walkthrough",
      subtitle: isSw
        ? "Kutoka kusakinisha hadi kufunga hesabu za jioni kwenye Windows, Mac, au Ubuntu."
        : "Fast counter checkout with instant receipts and evening drawer clarity.",
      ctaHref: "/auth?mode=signup&role=pharmacy",
      ctaLabel: isSw ? "Anza Usanidi" : "Start Counter Setup",
      scenes: [
        {
          step: "SCENE 01 / 04",
          durationSec: 4,
          caption: isSw ? "Inafanya kazi kwenye HP, Windows, Mac & Linux" : "Runs on HP, Windows, Mac, and Ubuntu",
          detail: isSw ? "Inafunguka papo hapo bila mtandao." : "Local speed even when internet pauses.",
          image: "/cervos-hardware-desktop.jpg",
        },
        {
          step: "SCENE 02 / 04",
          durationSec: 4,
          caption: isSw ? "Skani dawa moja kwa moja kauntani" : "Scan directly into live checkout",
          detail: isSw ? "Kundi sahihi linachaguliwa mara moja." : "Earliest safe batch surfaces automatically.",
          image: "/cervos-counter-station.jpg",
        },
        {
          step: "SCENE 03 / 04",
          durationSec: 4,
          caption: isSw ? "Chapisha risiti chini ya sekunde moja" : "Instant customer receipt at the desk",
          detail: isSw ? "Taslimu na M-Pesa zinahesabika sahihi." : "Cash and mobile totals match effortlessly.",
          image: "/cervos-hardware-desktop.jpg",
        },
        {
          step: "SCENE 04 / 04",
          durationSec: 4,
          caption: isSw ? "Usawazishaji kimya kimya mtandao ukirudi" : "Automatic branch sync",
          detail: isSw ? "Ona faida za matawi yote kwa wakati mmoja." : "Owners check daily margins from anywhere.",
          image: "/cervos-dispensary-desk.jpg",
        },
      ],
      setupSteps: [
        isSw ? "Pakua Cervos kwenye Windows, Mac, au Linux yako." : "Install Cervos on Windows, Mac, or Linux.",
        isSw ? "Unganisha skana yako na mashine ya risiti." : "Plug in your receipt printer and scanner.",
        isSw ? "Anza kuhudumia wateja ndani ya dakika tano." : "Start serving patients within five minutes.",
      ],
    },
    shelf: {
      id: "shelf",
      eyebrow: "02 · POCKET & SHELF SHIELD",
      title: isSw ? "Mwongozo wa Ukaguzi wa Rafu" : "Pocket Scanner Walkthrough",
      subtitle: isSw
        ? "Kagua makasha rafuni ukitumia iPhone au Samsung na uzuie dawa zilizopitwa."
        : "Check every incoming box on iPhone or Samsung before value expires.",
      ctaHref: "/auth?mode=signup&role=pharmacy",
      ctaLabel: isSw ? "Linda Rafu Zako" : "Protect Your Shelves",
      scenes: [
        {
          step: "SCENE 01 / 04",
          durationSec: 4,
          caption: isSw ? "Fungua skana kwenye Samsung au iPhone" : "Open directly on iPhone or Samsung",
          detail: isSw ? "Tumia kamera ya simu moja kwa moja." : "Scan straight with the phone in your pocket.",
          image: "/cervos-hardware-phone.jpg",
        },
        {
          step: "SCENE 02 / 04",
          durationSec: 4,
          caption: isSw ? "Rekodi mzigo mpya na tarehe" : "Log batch numbers on intake",
          detail: isSw ? "Tahadhari za siku 60 zinafika mapema." : "Catch slow movers months before expiry.",
          image: "/cervos-dispensary-desk.jpg",
        },
        {
          step: "SCENE 03 / 04",
          durationSec: 4,
          caption: isSw ? "Kundi la kwanza kuisha linatoka kwanza" : "Earliest safe batch leaves first",
          detail: isSw ? "Okoa mtaji unaopotea rafuni." : "Keep working capital working for you.",
          image: "/cervos-hardware-phone.jpg",
        },
        {
          step: "SCENE 04 / 04",
          durationSec: 4,
          caption: isSw ? "Kizuizi kamili kwa dawa iliyoisha muda" : "Hard checkout lock on expired boxes",
          detail: isSw ? "Ulinzi kwa mgonjwa na leseni." : "Expired stock can never clear your counter.",
          image: "/cervos-counter-station.jpg",
        },
      ],
      setupSteps: [
        isSw ? "Fungua Cervos Pocket kwenye simu yako." : "Open Cervos on your iPhone or Samsung.",
        isSw ? "Skani boksi zinapoingia dukani." : "Scan arriving cartons at intake.",
        isSw ? "Acha kaunta ichague kundi salama." : "Let checkout direct staff to safe boxes automatically.",
      ],
    },
    wholesale: {
      id: "wholesale",
      eyebrow: "03 · WHOLESALE & KASRI",
      title: isSw ? "Mwongozo wa Ugavi & Kasri\u2122" : "Wholesale & Kasri\u2122 Walkthrough",
      subtitle: isSw
        ? "Agiza kutoka kwa wasambazaji halali ukiwa na uhakika wa Kasri\u2122."
        : "Order from verified wholesalers while payment waits safely until arrival.",
      ctaHref: "/auth?mode=signup&role=supplier",
      ctaLabel: isSw ? "Jiunge na Ugavi" : "Connect Wholesale Depot",
      scenes: [
        {
          step: "SCENE 01 / 04",
          durationSec: 4,
          caption: isSw ? "Linganisha bei halisi za maghala" : "Compare live wholesale catalogs",
          detail: isSw ? "Ona tarehe halali kabla ya kuagiza." : "Verify remaining shelf life before ordering.",
          image: "/cervos-hardware-tablet.jpg",
        },
        {
          step: "SCENE 02 / 04",
          durationSec: 4,
          caption: isSw ? "Malipo yanahifadhiwa na Kasri\u2122" : "Funds lock safely inside Kasri\u2122",
          detail: isSw ? "Usalama kwa mnunuzi na msambazaji." : "Trusted protection along every route.",
          image: "/cervos-fleet-van.jpg",
        },
        {
          step: "SCENE 03 / 04",
          durationSec: 4,
          caption: isSw ? "Fuatilia safari ya mzigo mikoani" : "Watch deliveries along corridors",
          detail: isSw ? "Dar es Salaam, Arusha, Mwanza, Dodoma." : "Clear dispatch milestones from depot to shop.",
          image: "/cervos-hardware-tablet.jpg",
        },
        {
          step: "SCENE 04 / 04",
          durationSec: 4,
          caption: isSw ? "Malipo yanakamilika mzigo ukiskaniwa" : "Payout releases on doorstep scan",
          detail: isSw ? "Hesabu za stoo zinaongezeka papo hapo." : "Zero invoice chasing.",
          image: "/cervos-dispensary-desk.jpg",
        },
      ],
      setupSteps: [
        isSw ? "Thibitisha akaunti ya duka au msambazaji." : "Verify your dispensary or warehouse license.",
        isSw ? "Agiza mzigo moja kwa moja kupitia tableti au desktop." : "Place restock orders from tablet or counter.",
        isSw ? "Skani unapopokea ili Kasri\u2122 ikamilishe malipo." : "Scan boxes on arrival to release Kasri\u2122 payout.",
      ],
    },
  };

  const genealogy = [
    {
      gen: "01",
      year: "2024",
      name: isSw ? "Kaunta Bila Mtandao" : "Offline Counter Core",
      summary: isSw
        ? "Urahisi wa kuuza na kutoa risiti hata intaneti ikikatika."
        : "Built so pharmacies never stop selling when internet drops.",
      unlocked: isSw ? "Kasi ya Papo Hapo" : "Instant Checkout",
    },
    {
      gen: "02",
      year: "2025",
      name: isSw ? "Ulinzi wa Rafu" : "Batch & Expiry Shield",
      summary: isSw
        ? "Kila kundi linafuatiliwa ili kuondoa hasara za kuisha muda."
        : "Earliest safe batches move first; expired boxes stay locked.",
      unlocked: isSw ? "0% Hasara ya Kuisha" : "Zero Expiry Loss",
    },
    {
      gen: "03",
      year: "2025",
      name: isSw ? "Ugavi & Kasri\u2122" : "Wholesale & Kasri\u2122 Rail",
      summary: isSw
        ? "Oda za jumla zinazolindwa hadi mzigo uwasili dukani."
        : "Direct regional restocking settled safely on verified doorstep arrival.",
      unlocked: isSw ? "Malipo Salama" : "Verified Clearing",
    },
    {
      gen: "04",
      year: "2026",
      name: isSw ? "Mfumo Mmoja" : "Unified Cervos Suite",
      summary: isSw
        ? "Mac, Windows, Linux, iPhone, Samsung na tableti kama mfumo mmoja."
        : "Every screen in the pharmacy chain working together effortlessly.",
      unlocked: isSw ? "Vifaa Vyote" : "Every Device Live",
    },
  ];

  const scrollToCalculatorFromModal = () => {
    closeProductModal();
    setTimeout(() => {
      document
        .getElementById("calculator-focus")
        ?.scrollIntoView({ behavior: isLowEnd ? "auto" : "smooth", block: "center" });
    }, 80);
  };

  const activeSpec = modalProduct ? productSpotlightSpecs[modalProduct] : null;

  return (
    <>
      {/* Band 1: Left Punchy Sell Copy + Right Edge-Bleeding MacBook & HP Workstation */}
      <section
        id="counter-stage"
        className="scroll-mt-10 py-20 sm:py-28 bg-white border-b border-[#E2E8F0] overflow-x-clip"
      >
        <ScrollRevealBand
          isLowEnd={isLowEnd}
          className="max-w-6xl mx-auto px-5 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center"
        >
          <div className="lg:col-span-5 space-y-6">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#1039B9]">
              01 &middot; MAC &middot; HP / WINDOWS &middot; LINUX
            </div>
            <h2
              className="text-3xl sm:text-5xl font-bold text-[#0F172A] tracking-[-0.03em] leading-[1.05]"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              <FlipText
                text={isSw ? "Kaunta ya kasi. Hata mtandao ukikatika." : "Serve faster. Even offline."}
                flipKey={lang}
                mode="words"
              />
            </h2>
            <p className="text-sm sm:text-base text-[#475569] leading-relaxed max-w-md">
              <FlipText
                text={
                  isSw
                    ? "Mauzo na risiti vinahifadhiwa papo hapo kwenye kompyuta ya duka na kusawazishwa punde mtandao ukirudi."
                    : "Ring patients through in seconds on HP counters while owners check branch profits on Mac. Zero queue freezes."
                }
                flipKey={lang}
                mode="words"
              />
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setModalProduct("counter")}
                className="px-6 py-3 rounded-full bg-[#1039B9] hover:bg-[#0D2E94] text-white text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer"
              >
                {isSw ? "Maelezo Kamili" : "Inspect Counter POS"} &rarr;
              </button>
              <button
                type="button"
                onClick={() => setOpenGuideId("counter")}
                className="px-5 py-3 rounded-full border border-[#E2E8F0] hover:border-[#1039B9] text-xs font-semibold text-[#1039B9] bg-white transition-colors cursor-pointer"
              >
                {isSw ? "Tazama Mwongozo" : "Watch Walkthrough"}
              </button>
            </div>
          </div>

          <div className="lg:col-span-7">
            <DesktopStudioBezel isLowEnd={isLowEnd} />
          </div>
        </ScrollRevealBand>
      </section>

      {/* Band 2: Dark Obsidian Opposite-Side Counter-Revolving Tilted Phones */}
      <section
        id="shelf-stage"
        className="scroll-mt-10 py-24 sm:py-32 bg-[#09090B] text-white overflow-hidden relative"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse 65% 55% at 50% 50%, rgba(16, 57, 185, 0.25), transparent 72%)",
          }}
        />
        <ScrollRevealBand
          isLowEnd={isLowEnd}
          className="max-w-7xl mx-auto px-5 sm:px-6 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-6 items-center"
        >
          <div className="lg:col-span-3 order-2 lg:order-1">
            <AppleIPhoneMockup isSw={isSw} isLowEnd={isLowEnd} />
          </div>

          <div className="lg:col-span-6 order-1 lg:order-2 text-center px-2 sm:px-6 space-y-6">
            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#38BDF8]">
              02 &middot; APPLE IPHONE &amp; SAMSUNG GALAXY
            </div>
            <h2
              className="text-3xl sm:text-5xl font-bold tracking-[-0.03em] leading-[1.06] text-white"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              <FlipText
                text={isSw ? "Kila simu mkononi ni mlinzi wa rafu." : "Turn every phone into an expiry vault."}
                flipKey={lang}
                mode="words"
              />
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-md mx-auto">
              <FlipText
                text={
                  isSw
                    ? "Kundi la kwanza kuisha linatoka kwanza, na dawa iliyopitwa na muda haiwezi kupita kaunta."
                    : "Scan boxes on iPhone or Samsung in the back storeroom. Earliest safe stock sells first; expired packs stay locked."
                }
                flipKey={lang}
                mode="words"
              />
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setModalProduct("shelf")}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-[#09090B] hover:bg-slate-100 text-xs sm:text-sm font-bold transition-all shadow-lg cursor-pointer"
              >
                <span>{isSw ? "Maelezo ya Usalama wa Rafu" : "Inspect Shelf Control"}</span>
                <span>&rarr;</span>
              </button>
              <button
                type="button"
                onClick={() => setOpenGuideId("shelf")}
                className="px-5 py-3 rounded-full border border-white/25 hover:bg-white/10 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                {isSw ? "Tazama Mwongozo" : "Watch Walkthrough"}
              </button>
            </div>
          </div>

          <div className="lg:col-span-3 order-3">
            <TitaniumPhoneMockup isSw={isSw} isLowEnd={isLowEnd} />
          </div>
        </ScrollRevealBand>
      </section>

      {/* Band 3: Zig-Zag Reverse - Left Edge-Bleeding Tablet + Right Wholesale & Kasri Sell */}
      <section
        id="wholesale-stage"
        className="scroll-mt-10 py-20 sm:py-28 bg-white border-b border-[#E2E8F0] overflow-x-clip"
      >
        <ScrollRevealBand
          isLowEnd={isLowEnd}
          className="max-w-6xl mx-auto px-5 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center"
        >
          <div className="lg:col-span-7 order-2 lg:order-1">
            <AluminumTabletMockup isLowEnd={isLowEnd} />
          </div>

          <div className="lg:col-span-5 order-1 lg:order-2 space-y-6">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#006875]">
              03 &middot; WHOLESALE &amp; KASRI&#8482;
            </div>
            <h2
              className="text-3xl sm:text-5xl font-bold text-[#0F172A] tracking-[-0.03em] leading-[1.05]"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              <FlipText
                text={isSw ? "Agiza mzigo. Lipa ukishapokea." : "Order wholesale. Pay on arrival."}
                flipKey={lang}
                mode="words"
              />
            </h2>
            <p className="text-sm sm:text-base text-[#475569] leading-relaxed max-w-md">
              <FlipText
                text={
                  isSw
                    ? "Fuatilia magari ya mzigo kupitia tableti huku Kasri\u2122 ikilinda malipo hadi ukiskani mapokezi."
                    : "Follow live deliveries corridor by corridor while Kasri\u2122 holds payment safely until cartons scan onto your shelf."
                }
                flipKey={lang}
                mode="words"
              />
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setModalProduct("wholesale")}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#1039B9] hover:bg-[#0D2E94] text-white text-xs sm:text-sm font-bold transition-all shadow-md cursor-pointer"
              >
                <span>{isSw ? "Maelezo ya Ugavi" : "Inspect Wholesale Supply"}</span>
                <span>&rarr;</span>
              </button>
              <button
                type="button"
                onClick={() => setOpenGuideId("wholesale")}
                className="px-5 py-3 rounded-full border border-[#E2E8F0] hover:border-slate-300 text-xs font-semibold text-[#0F172A] transition-colors cursor-pointer"
              >
                {isSw ? "Tazama Mwongozo" : "Watch Walkthrough"}
              </button>
            </div>
          </div>
        </ScrollRevealBand>
      </section>

      {/* Band 4: Side-by-Side Alternating Hardware Strip - Ubuntu Kiosk Left vs MacBook Owner Right */}
      <section className="py-20 sm:py-24 bg-[#F8FAFC] border-b border-[#E2E8F0] overflow-x-clip">
        <ScrollRevealBand
          isLowEnd={isLowEnd}
          className="max-w-7xl mx-auto px-5 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center"
        >
          <div className="lg:col-span-4">
            <UbuntuKioskBezel isSw={isSw} isLowEnd={isLowEnd} />
          </div>

          <div className="lg:col-span-4 text-center px-2 space-y-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#1039B9]">
              04 &middot; EVERY MACHINE YOU OWN
            </div>
            <h3
              className="text-2xl sm:text-4xl font-bold text-[#0F172A] tracking-[-0.03em] leading-tight"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              <FlipText
                text={isSw ? "Kituo kimoja. Skrini yoyote." : "One workflow across Linux kiosks and MacBooks."}
                flipKey={lang}
                mode="words"
              />
            </h3>
            <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
              <FlipText
                text={
                  isSw
                    ? "Hakuna kuhama vifaa. Tumia kompyuta na simu ulizo nazo dukani."
                    : "Bring the hardware already sitting in your pharmacy. Every screen stays quietly in sync."
                }
                flipKey={lang}
                mode="words"
              />
            </p>
            <div className="pt-1">
              <Link
                href="/downloads"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1039B9] hover:underline"
              >
                <span>{isSw ? "Tazama matoleo yote" : "See all platform downloads"}</span>
                <span>&rarr;</span>
              </Link>
            </div>
          </div>

          <div className="lg:col-span-4">
            <MacBookOwnerBezel isSw={isSw} isLowEnd={isLowEnd} />
          </div>
        </ScrollRevealBand>
      </section>

      {/* Band 5: Compact Product Genealogy Spine */}
      <section className="py-16 sm:py-20 bg-white border-b border-[#E2E8F0]">
        <ScrollRevealBand isLowEnd={isLowEnd} className="max-w-5xl mx-auto px-5 sm:px-6">
          <div className="text-center max-w-xl mx-auto mb-10">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#1039B9] mb-2">
              <FlipText text={isSw ? "KIZAZI CHA CERVOS" : "PRODUCT GENEALOGY"} flipKey={lang} />
            </div>
            <h2
              className="text-2xl sm:text-4xl font-bold text-[#0F172A] tracking-[-0.03em]"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              <FlipText
                text={isSw ? "Kutoka kaunta moja hadi mfumo mzima." : "How four builds shaped one unified OS."}
                flipKey={lang}
                mode="words"
              />
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-b border-[#E2E8F0] divide-x divide-[#E2E8F0] mb-8">
            {genealogy.map((item, idx) => {
              const selected = idx === activeGen;
              return (
                <button
                  key={item.gen}
                  type="button"
                  onClick={() => setActiveGen(idx)}
                  className={`py-4 px-4 text-left transition-colors cursor-pointer relative ${
                    selected ? "bg-[#F8FAFC]" : "hover:bg-slate-50"
                  }`}
                >
                  {selected && (
                    <span className="absolute top-0 left-0 right-0 h-0.5 bg-[#1039B9]" />
                  )}
                  <div className="text-[11px] font-semibold tracking-wider text-slate-400 mb-0.5">
                    {item.gen} &middot; {item.year}
                  </div>
                  <div
                    className={`text-xs sm:text-sm font-bold ${
                      selected ? "text-[#1039B9]" : "text-[#0F172A]"
                    }`}
                  >
                    {item.name}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="max-w-xl mx-auto text-center">
            <p className="text-sm sm:text-base text-[#475569] leading-relaxed mb-4">
              {genealogy[activeGen].summary}
            </p>
            <div className="inline-flex items-center gap-2 text-xs font-bold text-[#00542C]">
              <IconCheck className="w-4 h-4" />
              <span>{genealogy[activeGen].unlocked}</span>
            </div>
          </div>
        </ScrollRevealBand>
      </section>

      {/* Floating Foreground Wide Product Spotlight Modal (Viewport-Locked Portal) */}
      <ForegroundModal
        open={Boolean(modalProduct && activeSpec)}
        onClose={closeProductModal}
        ariaLabelledBy="product-spotlight-title"
        panelClassName="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white border border-zinc-200/90 shadow-2xl p-6 sm:p-10"
      >
        {modalProduct && activeSpec && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-zinc-100">
              <div className="inline-flex flex-wrap rounded-xl bg-zinc-100 p-1 gap-1">
                {(["counter", "shelf", "wholesale"] as const).map((key) => {
                  const selected = modalProduct === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setModalProduct(key)}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        selected
                          ? "bg-[#0F172A] text-white shadow-2xs"
                          : "text-zinc-600 hover:text-zinc-900"
                      }`}
                    >
                      {productSpotlightSpecs[key].label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-3">
                <span className="hidden sm:inline-block text-[11px] font-bold uppercase tracking-[0.2em] text-[#1039B9]">
                  {activeSpec.eyebrow}
                </span>
                <button
                  type="button"
                  onClick={closeProductModal}
                  aria-label="Close product spotlight"
                  className="w-9 h-9 rounded-full bg-zinc-100 hover:bg-zinc-200 text-[#0F172A] flex items-center justify-center cursor-pointer text-lg font-medium"
                >
                  &times;
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-7">
              <div className="lg:col-span-7 space-y-5">
                <h2
                  id="product-spotlight-title"
                  className="text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight leading-snug"
                  style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                >
                  {activeSpec.title}
                </h2>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                  {activeSpec.summary}
                </p>

                <ul className="space-y-2.5 pt-1">
                  {activeSpec.outcomes.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-xs sm:text-sm text-[#0F172A]">
                      <span className="w-5 h-5 rounded-full bg-emerald-50 text-[#00542C] flex items-center justify-center shrink-0 mt-0.5">
                        <IconCheck className="w-3.5 h-3.5" />
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="lg:col-span-5 rounded-2xl bg-[#FAFAFA] border border-zinc-200 p-6 flex flex-col justify-between space-y-6">
                <div className="space-y-3 divide-y divide-zinc-200">
                  {activeSpec.facts.map((fact) => (
                    <div key={fact.label} className="pt-3 first:pt-0 flex items-center justify-between text-xs">
                      <span className="text-zinc-500 font-medium">{fact.label}</span>
                      <span className="font-bold text-[#0F172A]">{fact.value}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2.5 pt-2">
                  <button
                    type="button"
                    onClick={scrollToCalculatorFromModal}
                    className="w-full py-3 px-4 rounded-xl bg-[#0F172A] hover:bg-zinc-800 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    {isSw ? "Piga Hesabu ya Bei" : "Pricing Calculator"} &rarr;
                  </button>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Link
                      href={`/auth?mode=signup&role=${activeSpec.ctaRole}`}
                      className="py-2.5 px-3 rounded-xl bg-[#1039B9] hover:bg-[#0D2E94] text-white text-xs font-semibold text-center transition-colors"
                    >
                      {isSw ? "Anza Sasa" : "Get Started"}
                    </Link>
                    <Link
                      href="/downloads"
                      className="py-2.5 px-3 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-[#0F172A] text-xs font-semibold text-center transition-colors"
                    >
                      {isSw ? "Pakua" : "Download"}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </ForegroundModal>

      <ProductWalkthroughModal
        guide={openGuideId ? walkthroughGuides[openGuideId] : null}
        onClose={() => setOpenGuideId(null)}
        isSw={isSw}
      />
    </>
  );
}
