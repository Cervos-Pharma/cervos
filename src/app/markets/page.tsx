"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import PublicNav from "@/components/PublicNav";
import FlipText from "@/components/FlipText";
import ForegroundModal from "@/components/ForegroundModal";
import { ScrollRevealBand } from "@/components/AppleHardwareMockups";
import { IconCheck } from "@/components/LandingIcons";
import { useI18n } from "@/lib/i18n/context";
import { useIsLowEndDevice } from "@/lib/useDeviceTier";

type MarketKey = "pharmacies" | "suppliers" | "clinics" | "researchers" | "investors";

function MarketsOverviewInner() {
  const { lang } = useI18n();
  const isSw = lang === "SW";
  const isLowEnd = useIsLowEndDevice();
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawFocus = searchParams.get("focus");
  const focusParam: MarketKey | null =
    rawFocus === "pharmacies" ||
    rawFocus === "suppliers" ||
    rawFocus === "clinics" ||
    rawFocus === "researchers" ||
    rawFocus === "investors"
      ? rawFocus
      : null;

  const [activeMarketModal, setActiveMarketModal] = useState<MarketKey | null>(focusParam);

  const heroRef = useRef<HTMLElement>(null);
  const [heroMesh, setHeroMesh] = useState({ x: 64, y: 38, active: false });

  useEffect(() => {
    if (focusParam) {
      setActiveMarketModal(focusParam);
    }
  }, [focusParam]);

  useEffect(() => {
    if (!activeMarketModal) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMarketModal();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  });

  const closeMarketModal = () => {
    setActiveMarketModal(null);
    if (typeof window !== "undefined" && window.location.search.includes("focus=")) {
      router.replace("/markets", { scroll: false });
    }
  };

  const whyCervosReasons = isSw
    ? [
        {
          num: "01",
          title: "Usikwame foleni mtandao ukikatika",
          body: "Mauzo ya kaunta na uchapishaji wa risiti yanaendelea bila kusuasua hata intaneti ya mtaani ikipotea.",
        },
        {
          num: "02",
          title: "Okoa mtaji unaopotea rafuni",
          body: "Dawa zinazokaribia tarehe ya mwisho zinatambuliwa mapema na zilizokwisha haziwezi kuuzwa kauntani.",
        },
        {
          num: "03",
          title: "Biashara ya jumla yenye uhakika",
          body: "Kupitia Kasri\u2122, mnunuzi ana uhakika wa mzigo halali na msambazaji ana uhakika wa malipo ukifika.",
        },
        {
          num: "04",
          title: "Ona matawi yote kwa utulivu",
          body: "Badala ya kupiga simu kila usiku kuuliza mauzo na fedha za mchana, fungua skrini moja kuona kila tawi.",
        },
      ]
    : [
        {
          num: "01",
          title: "Keep serving even without internet",
          body: "Your counter never stalls during evening rush hour. Every bill saves safely on your workstation and prints customer receipts right away.",
        },
        {
          num: "02",
          title: "Stop losing capital to expired boxes",
          body: "Early reminders surface aging cartons weeks in advance, while checkout stops any expired medicine from ever reaching a patient.",
        },
        {
          num: "03",
          title: "Trade wholesale without payment stress",
          body: "Orders between neighborhood pharmacies and licensed wholesalers clear cleanly through Kasri\u2122 the moment boxes land safely.",
        },
        {
          num: "04",
          title: "Clear visibility across every branch",
          body: "Check shift totals, cash vs M-Pesa drawers, and branch profit without spending your evenings chasing notebooks or calling staff.",
        },
      ];

  const sectors: Array<{
    key: MarketKey;
    num: string;
    label: string;
    eyebrow: string;
    image: string;
    title: string;
    summary: string;
    reasons: string[];
    facts: Array<{ label: string; value: string }>;
    ctaPrimary: string;
    ctaRole: string;
    secondaryCtaLabel: string;
    secondaryCtaHref: string;
  }> = [
    {
      key: "pharmacies",
      num: "01",
      label: isSw ? "Maduka ya Dawa" : "Pharmacies",
      eyebrow: isSw ? "MADUKA YA DAWA" : "COMMUNITY PHARMACIES",
      image: "/cervos-people-counter.jpg",
      title: isSw
        ? "Kaunta ya haraka, hesabu safi za jioni, na rafu zisizoisha bure."
        : "Built so every neighborhood pharmacy runs faster and protects its margin.",
      summary: isSw
        ? "Kutoka duka moja la mtaa hadi matawi mengi mikoani, Cervos huondoa makosa ya daftari na kulinda faida yako kila siku."
        : "Whether you operate one busy corner counter or ten regional branches, Cervos keeps queues moving offline, blocks expired sales, and simplifies evening closing.",
      reasons: isSw
        ? [
            "Ondoa hasara za dawa zilizopitwa na muda kabla hazijatokea",
            "Lingana vizuri kati ya mauzo ya taslimu, M-Pesa na risiti",
            "Agiza mzigo unaopungua moja kwa moja kutoka kwa wasambazaji halali",
          ]
        : [
            "Eliminate silent expiry write-offs and shelf mix-ups",
            "Close every cash and mobile money shift cleanly in minutes",
            "Reorder missing items direct from trusted depots on time",
          ],
      facts: [
        { label: isSw ? "Inafaa kwa" : "Built for", value: isSw ? "Duka 1 hadi 60+" : "1 to 60+ branches" },
        { label: isSw ? "Bila Mtandao" : "Offline ready", value: isSw ? "Ndio" : "Full counter day" },
        { label: isSw ? "Ugavi" : "Restock", value: "Kasri\u2122 protected" },
      ],
      ctaPrimary: isSw ? "Sajili Duka Lako" : "Onboard Your Pharmacy",
      ctaRole: "/auth?mode=signup&role=pharmacy",
      secondaryCtaLabel: isSw ? "Angalia Mifumo & Bei" : "See Products & Pricing",
      secondaryCtaHref: "/products",
    },
    {
      key: "suppliers",
      num: "02",
      label: isSw ? "Wasambazaji" : "Suppliers",
      eyebrow: isSw ? "WASAMBAZAJI & MAGHALA" : "WHOLESALE SUPPLIERS",
      image: "/cervos-people-delivery.jpg",
      title: isSw
        ? "Badilisha oda za simu zisizo na mpangilio kuwa wateja wa kudumu."
        : "Turn scattered phone orders into predictable regional fulfillment.",
      summary: isSw
        ? "Weka orodha yako ya bei mbele ya maduka yaliyohakikiwa na upokee malipo yako mara tu mizigo inapowasili."
        : "Put live pack availability directly in front of verified pharmacy buyers and remove unpaid invoice chasing through protected Kasri\u2122 clearing.",
      reasons: isSw
        ? [
            "Pokea maagizo safi moja kwa moja kutoka kwa maduka halali",
            "Ondoa usumbufu wa kufuatilia madeni kupitia uhakika wa Kasri\u2122",
            "Jua kwa urahisi kila kundi la dawa lilipopelekwa mkoani",
          ]
        : [
            "Put verified pack pricing right in front of active buyers",
            "Receive assured payout upon doorstep arrival via Kasri\u2122",
            "Maintain clear lot records for every carton leaving the depot",
          ],
      facts: [
        { label: isSw ? "Wanunuzi" : "Buyers", value: isSw ? "Maduka halali" : "Verified shops" },
        { label: isSw ? "Malipo" : "Payouts", value: "Kasri\u2122 on delivery" },
        { label: isSw ? "Mikoa" : "Reach", value: "National corridors" },
      ],
      ctaPrimary: isSw ? "Jiunge kama Msambazaji" : "Connect Your Depot",
      ctaRole: "/auth?mode=signup&role=supplier",
      secondaryCtaLabel: isSw ? "Wasiliana na Ushirikiano" : "Partner With Us",
      secondaryCtaHref: "/partners#partner-enquiry",
    },
    {
      key: "clinics",
      num: "03",
      label: isSw ? "Kliniki" : "Clinics",
      eyebrow: isSw ? "KLINIKI & ZAHANATI" : "CLINICS & DISPENSARIES",
      image: "/cervos-people-stockroom.jpg",
      title: isSw
        ? "Mfululizo thabiti wa dawa kwa wagonjwa bila makabrasha mengi."
        : "Keep vital outpatient medicines in stock and accounted for daily.",
      summary: isSw
        ? "Saidia timu za madaktari na wauguzi kupata dawa halali haraka na kufuatilia matumizi bila kuandika madaftari mengi."
        : "Give outpatient teams clean visibility across dispensary shelves so essential medicines stay stocked and prescriptions clear quickly for patients.",
      reasons: isSw
        ? [
            "Fuatilia utoaji wa dawa kutoka stoo mpaka mgonjwa bila karatasi nyingi",
            "Ona mapema dawa zinazopungua kabla kliniki haijaishiwa",
            "Lugha ya Kiingereza na Kiswahili hurahisisha matumizi kwa timu zote",
          ]
        : [
            "Track internal dispensing clearly without heavy paper logs",
            "Catch dwindling essential medicines before patients wait",
            "Bilingual English and Kiswahili workflow across all clinical roles",
          ],
      facts: [
        { label: isSw ? "Vituo" : "Care setting", value: isSw ? "Zahanati & Hospitali" : "Clinics & Hospitals" },
        { label: isSw ? "Lugha" : "Languages", value: "EN & Kiswahili" },
        { label: isSw ? "Usalama" : "Safety", value: isSw ? "Kizuizi cha muda" : "Expiry locked" },
      ],
      ctaPrimary: isSw ? "Unganisha Kliniki Yako" : "Set Up Your Clinic",
      ctaRole: "/auth?mode=signup&role=clinics",
      secondaryCtaLabel: isSw ? "Ona Programu" : "See Products & Pricing",
      secondaryCtaHref: "/products",
    },
    {
      key: "researchers",
      num: "04",
      label: isSw ? "Watafiti" : "Researchers",
      eyebrow: isSw ? "WATAFITI WA AFYA" : "PUBLIC HEALTH RESEARCHERS",
      image: "/cervos-dispensary-desk.jpg",
      title: isSw
        ? "Mwenendo halisi wa upatikanaji wa dawa katika kanda zote kwa heshima ya faragha."
        : "Clean regional medicine access trends without exposing patient identities.",
      summary: isSw
        ? "Shirikiana na Cervos kufuatilia mahitaji ya dawa muhimu, mabadiliko ya msimu, na uimara wa ugavi katika afya ya jamii."
        : "Partner with public health institutes and universities to spot essential medicine bottlenecks early while preserving strict institutional and patient privacy.",
      reasons: isSw
        ? [
            "Ona maeneo yenye uhaba wa dawa muhimu kabla hali haijawa mbaya",
            "Hakuna taarifa binafsi za mgonjwa zinazotolewa nje ya kituo",
            "Taarifa safi zinazosaidia mipango ya afya ya jamii nchini",
          ]
        : [
            "Identify regional medicine shortages before communities lose access",
            "Zero personal patient information leaves any clinic or shop",
            "Structured regional availability trends to guide health programs",
          ],
      facts: [
        { label: isSw ? "Wigo" : "Scope", value: isSw ? "Mikoa ya Tanzania" : "Tanzania corridors" },
        { label: isSw ? "Faragha" : "Privacy", value: isSw ? "Bila majina ya watu" : "Anonymized signals" },
        { label: isSw ? "Ushirikiano" : "Collaboration", value: isSw ? "Vyuo & Taasisi" : "Institutes & NGOs" },
      ],
      ctaPrimary: isSw ? "Omba Akaunti ya Utafiti" : "Apply as Researcher",
      ctaRole: "/auth?mode=signup&role=researcher",
      secondaryCtaLabel: isSw ? "Tuma Ujumbe wa Ushirikiano" : "Contact Research Desk",
      secondaryCtaHref: "/partners#partner-enquiry",
    },
    {
      key: "investors",
      num: "05",
      label: isSw ? "Wawekezaji" : "Investors",
      eyebrow: isSw ? "WAWEKEZAJI & WADAU" : "INVESTORS & CAPITAL PARTNERS",
      image: "/cervos-counter-station.jpg",
      title: isSw
        ? "Miundombinu ya msingi inayounganisha maduka, maghala na fedha katika sekta muhimu."
        : "Backing essential healthcare commerce infrastructure across East Africa.",
      summary: isSw
        ? "Cervos inajenga mfumo wa kila siku unaotumika kauntani na kwenye ugavi wa jumla, ikileta mapato ya mara kwa mara na ukuaji halisi wa soko."
        : "Every pharmacy desk, regional warehouse, and verified delivery builds durable recurring adoption across an everyday resilient healthcare market.",
      reasons: isSw
        ? [
            "Ukuaji unaotegemea matumizi ya kila siku dukani na ghalani",
            "Mapato ya usajili pamoja na miamala halisi kupitia Kasri\u2122",
            "Ubunifu uliotengenezwa mahususi kwa mazingira ya Afrika Mashariki",
          ]
        : [
            "High retention driven by daily mission-critical checkout and inventory work",
            "Dual growth across shop subscriptions and verified Kasri\u2122 wholesale flows",
            "Built purposefully for local realities across Tanzania and East Africa",
          ],
      facts: [
        { label: isSw ? "Msingi" : "Footprint", value: "Dar es Salaam HQ" },
        { label: isSw ? "Mtindo" : "Model", value: "SaaS + Kasri\u2122" },
        { label: isSw ? "Wigo" : "Expansion", value: "East Africa" },
      ],
      ctaPrimary: isSw ? "Fungua Akaunti ya Mwekezaji" : "Investor Onboarding",
      ctaRole: "/auth?mode=signup&role=investor",
      secondaryCtaLabel: isSw ? "Wasiliana na Uongozi" : "Speak With Leadership",
      secondaryCtaHref: "/partners#partner-enquiry",
    },
  ];

  const activeModalSector = activeMarketModal
    ? sectors.find((s) => s.key === activeMarketModal) ?? sectors[0]
    : null;

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#0F172A] flex flex-col selection:bg-[#1039B9] selection:text-white antialiased overflow-x-clip">
      {/* Editorial Hero */}
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
            alt="Pharmacies, clinics, and supply partners growing on Cervos"
            fill
            className="object-cover object-center opacity-75 transition-transform duration-700 ease-out"
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
                "linear-gradient(100deg, rgba(15, 23, 42, 0.94) 0%, rgba(15, 23, 42, 0.82) 55%, rgba(15, 23, 42, 0.38) 100%)",
            }}
          />
        </div>

        <PublicNav
          variant="hero"
          ctaHref="/auth?mode=signup"
          ctaLabel={isSw ? "Anza Sasa" : "Get Started"}
          isLowEnd={isLowEnd}
        />

        <div className="max-w-6xl mx-auto px-5 sm:px-6 relative z-20 pt-6">
          <div className="max-w-2xl">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#38BDF8] mb-3">
              <FlipText text={isSw ? "MASOKO TUNAYOHUDUMIA" : "WHO CERVOS SERVES"} flipKey={lang} />
            </div>
            <h1
              className="text-3xl sm:text-5xl lg:text-[52px] font-bold tracking-tight text-white leading-[1.08] mb-5"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              <FlipText
                text={
                  isSw
                    ? "Imeundwa kwa kila mdau anayejenga afya ya kesho."
                    : "Why Tanzania's pharmacies, depots, clinics, researchers, and investors choose Cervos."
                }
                flipKey={lang}
                mode="words"
              />
            </h1>
            <p className="text-sm sm:text-lg text-slate-200 leading-relaxed mb-8 max-w-xl">
              <FlipText
                text={
                  isSw
                    ? "Kila kundi lina sababu dhahiri za kufanya kazi na Cervos, kuanzia ufanisi wa kaunta hadi ukuaji wa kudumu."
                    : "From everyday neighborhood shop work to national distribution, clinical oversight, health research, and sustainable growth."
                }
                flipKey={lang}
                mode="words"
              />
            </p>

            <div className="flex flex-wrap items-center gap-3.5">
              <a
                href="#why-cervos"
                className="px-6 py-3 rounded-full bg-white text-[#0F172A] hover:bg-slate-100 text-xs sm:text-sm font-bold shadow-md transition-all"
              >
                <FlipText text={isSw ? "Sababu za Kuchagua Cervos" : "Why Choose Cervos"} flipKey={lang} />
              </a>
              <Link
                href="/products"
                className="px-5 py-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/25 backdrop-blur-xs text-white text-xs sm:text-sm font-semibold transition-all"
              >
                <FlipText text={isSw ? "Ona Bidhaa & Bei" : "See Products & Pricing"} flipKey={lang} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <main className="flex-1">
        {/* Why Businesses Choose Cervos (Sticky Left Thesis + Right Numbered Editorial List) */}
        <section
          id="why-cervos"
          className="scroll-mt-10 py-20 sm:py-28 bg-[#FAF9F6] border-b border-[#E5E4DE]"
        >
          <ScrollRevealBand
            isLowEnd={isLowEnd}
            className="max-w-6xl mx-auto px-5 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start"
          >
            <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#006875]">
                <FlipText text={isSw ? "FAIDA KWA VITENDO" : "THE CERVOS ADVANTAGE"} flipKey={lang} />
              </div>
              <h2
                className="text-3xl sm:text-4xl font-bold text-[#0F172A] tracking-tight leading-tight"
                style={{ fontFamily: "Outfit, Inter, sans-serif" }}
              >
                <FlipText
                  text={
                    isSw
                      ? "Matokeo ya haraka kuanzia siku ya kwanza kazini."
                      : "Four reasons teams switch to Cervos in their first week."
                  }
                  flipKey={lang}
                  mode="words"
                />
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                {isSw
                  ? "Hakuna muda mrefu wa kujifunza. Timu yako inaanza kuhudumia wagonjwa kwa uhakika siku hiyo hiyo."
                  : "No long training weeks or IT consultants. Staff work faster from morning open to closing count."}
              </p>
            </div>

            <div className="lg:col-span-7 divide-y divide-[#E5E4DE] border-t border-b border-[#E5E4DE]">
              {whyCervosReasons.map((item) => (
                <div key={item.num} className="py-7 sm:py-8 grid grid-cols-12 gap-4 items-start">
                  <div className="col-span-2 font-mono text-xs font-bold text-[#1039B9] pt-1">
                    {item.num}
                  </div>
                  <div className="col-span-10 space-y-2">
                    <h3
                      className="text-lg sm:text-xl font-bold text-[#0F172A]"
                      style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                    >
                      {item.title}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollRevealBand>
        </section>

        {/* All 5 Market Audiences Opening Clean Wide Foreground Cards */}
        <section className="py-20 sm:py-24 bg-white">
          <div className="max-w-5xl mx-auto px-5 sm:px-6 divide-y divide-[#E2E8F0]">
            {sectors.map((sec) => (
              <ScrollRevealBand
                key={sec.key}
                isLowEnd={isLowEnd}
                className="py-12 sm:py-14 first:pt-0 last:pb-0"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  <div className="lg:col-span-4 space-y-3">
                    <div className="text-xs font-mono font-bold text-slate-400">{sec.num}</div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#006875]">
                      <FlipText text={sec.eyebrow} flipKey={lang} />
                    </div>
                    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-[#E2E8F0] shadow-2xs">
                      <Image
                        src={sec.image}
                        alt={sec.eyebrow}
                        fill
                        className="object-cover"
                      />
                    </div>
                  </div>

                  <div className="lg:col-span-8 space-y-5">
                    <h2
                      className="text-2xl sm:text-3xl font-bold text-[#0F172A] leading-snug"
                      style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                    >
                      <FlipText text={sec.title} flipKey={lang} mode="words" />
                    </h2>

                    <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
                      {sec.summary}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveMarketModal(sec.key)}
                        className="px-5 py-2.5 rounded-full bg-[#0F172A] hover:bg-zinc-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                      >
                        {isSw ? `Kwa Nini ${sec.label}` : `Why ${sec.label} Choose Cervos`} &rarr;
                      </button>
                      <Link
                        href={sec.ctaRole}
                        className="px-5 py-2.5 rounded-full border border-[#E2E8F0] hover:border-[#1039B9] text-xs font-semibold text-[#1039B9] transition-colors"
                      >
                        {sec.ctaPrimary}
                      </Link>
                    </div>
                  </div>
                </div>
              </ScrollRevealBand>
            ))}
          </div>
        </section>
      </main>

      {/* Floating Foreground Wide Market Focus Modal (Viewport-Locked Portal) */}
      <ForegroundModal
        open={Boolean(activeMarketModal && activeModalSector)}
        onClose={closeMarketModal}
        ariaLabelledBy="market-spotlight-title"
        panelClassName="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white border border-zinc-200/90 shadow-2xl p-6 sm:p-10"
      >
        {activeMarketModal && activeModalSector && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-zinc-100">
              <div className="inline-flex flex-wrap rounded-xl bg-zinc-100 p-1 gap-1">
                {sectors.map((sec) => {
                  const selected = activeMarketModal === sec.key;
                  return (
                    <button
                      key={sec.key}
                      type="button"
                      onClick={() => setActiveMarketModal(sec.key)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        selected
                          ? "bg-[#0F172A] text-white shadow-2xs"
                          : "text-zinc-600 hover:text-zinc-900"
                      }`}
                    >
                      {sec.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-3">
                <span className="hidden md:inline-block text-[11px] font-bold uppercase tracking-[0.2em] text-[#006875]">
                  {activeModalSector.eyebrow}
                </span>
                <button
                  type="button"
                  onClick={closeMarketModal}
                  aria-label="Close market spotlight"
                  className="w-9 h-9 rounded-full bg-zinc-100 hover:bg-zinc-200 text-[#0F172A] flex items-center justify-center cursor-pointer text-lg font-medium"
                >
                  &times;
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-7">
              <div className="lg:col-span-7 space-y-5">
                <h2
                  id="market-spotlight-title"
                  className="text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight leading-snug"
                  style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                >
                  {activeModalSector.title}
                </h2>
                <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                  {activeModalSector.summary}
                </p>

                <ul className="space-y-2.5 pt-1">
                  {activeModalSector.reasons.map((item) => (
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
                  {activeModalSector.facts.map((fact) => (
                    <div key={fact.label} className="pt-3 first:pt-0 flex items-center justify-between text-xs">
                      <span className="text-zinc-500 font-medium">{fact.label}</span>
                      <span className="font-bold text-[#0F172A]">{fact.value}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2.5 pt-2">
                  <Link
                    href={activeModalSector.ctaRole}
                    className="block w-full py-3 px-4 rounded-xl bg-[#1039B9] hover:bg-[#0D2E94] text-white text-xs font-bold text-center transition-colors"
                  >
                    {activeModalSector.ctaPrimary} &rarr;
                  </Link>
                  <Link
                    href={activeModalSector.secondaryCtaHref}
                    className="block w-full py-2.5 px-4 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-[#0F172A] text-xs font-semibold text-center transition-colors"
                  >
                    {activeModalSector.secondaryCtaLabel}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </ForegroundModal>

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

export default function MarketsOverviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0F172A] flex items-center justify-center text-xs text-slate-400">
          Loading...
        </div>
      }
    >
      <MarketsOverviewInner />
    </Suspense>
  );
}
