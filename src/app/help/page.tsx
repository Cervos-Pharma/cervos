"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import PublicNav from "@/components/PublicNav";
import FlipText from "@/components/FlipText";
import SupportHelpSection from "@/components/SupportHelpSection";
import { IconCheck } from "@/components/LandingIcons";
import { useI18n } from "@/lib/i18n/context";
import { useIsLowEndDevice } from "@/lib/useDeviceTier";

type HelpCategory = "all" | "counter" | "shelf" | "wholesale" | "account";

interface HelpGuide {
  id: string;
  cat: Exclude<HelpCategory, "all">;
  catLabel: string;
  question: string;
  answer: string;
  steps: string[];
}

export default function HelpCenterPage() {
  const { lang } = useI18n();
  const isSw = lang === "SW";
  const isLowEnd = useIsLowEndDevice();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<HelpCategory>("all");
  const [openId, setOpenId] = useState<string>("offline-sales");

  const heroRef = useRef<HTMLElement>(null);
  const [heroMesh, setHeroMesh] = useState({ x: 62, y: 40, active: false });

  const categories: Array<{ id: HelpCategory; label: string }> = [
    { id: "all", label: isSw ? "Miongozo Yote" : "All Topics" },
    { id: "counter", label: isSw ? "Kaunta & Mauzo" : "Counter & Sales" },
    { id: "shelf", label: isSw ? "Rafu & Tarehe" : "Shelves & Expiry" },
    { id: "wholesale", label: isSw ? "Ugavi & Kasri\u2122" : "Wholesale & Kasri\u2122" },
    { id: "account", label: isSw ? "Akaunti & Timu" : "Account & Staff" },
  ];

  const guides: HelpGuide[] = isSw
    ? [
        {
          id: "offline-sales",
          cat: "counter",
          catLabel: "KAUNTA",
          question: "Kaunta yangu inaendelea kuuza vipi intaneti ikikatika?",
          answer:
            "Programu ya Cervos kwenye Windows, Mac, na Ubuntu huhifadhi mauzo yako yote moja kwa moja kwenye kifaa chako kwanza. Unaweza kuchapisha risiti na kukamilisha malipo bila kusubiri mtandao, na taarifa husawazishwa mara muunganisho ukirudi.",
          steps: [
            "Endelea kuskani na kutoa risiti kama kawaida dukani.",
            "Usifunge programu ikiwa bado kuna zamu inayoendelea.",
            "Mtandao ukirudi, mauzo yote hupanda kwenye akaunti ya mmiliki moja kwa moja.",
          ],
        },
        {
          id: "printers-scanners",
          cat: "counter",
          catLabel: "VIFAA",
          question: "Ninaunganisha vipi mashine ya risiti na skana ya dawa?",
          answer:
            "Mashine nyingi za kawaida za risiti na skana za USB au Bluetooth zinaanza kufanya kazi mara moja ukichomeka kwenye kompyuta ya kaunta.",
          steps: [
            "Chomeka skana ya USB au unganisha kwa Bluetooth kwenye kompyuta yako.",
            "Chagua mashine yako ya risiti chini ya mipangilio ya kaunta.",
            "Jaribu kuskani boksi moja ili kuhakiki bei na risiti inatoka safi.",
          ],
        },
        {
          id: "expiry-shield",
          cat: "shelf",
          catLabel: "RAFU",
          question: "Mfumo unazuiaje kuuza dawa zilizopitwa na muda?",
          answer:
            "Unapoingiza mzigo mpya kwa simu ya iPhone au Samsung, unaweka tarehe ya mwisho na kundi. Kaunta huchagua kundi salama la zamani kwanza na huzuia malipo kwa dawa yoyote iliyopitwa na muda.",
          steps: [
            "Skani boksi jipya linapofika kutoka kwa msambazaji.",
            "Angalia orodha ya tahadhari siku 60 kabla ya kuisha muda.",
            "Panga rafu kutokana na maelekezo ya mfumo ili mzigo utoke kwa mpangilio.",
          ],
        },
        {
          id: "kasri-wholesale",
          cat: "wholesale",
          catLabel: "UGAVI",
          question: "Malipo kupitia Kasri\u2122 yanamlindaje mnunuzi na msambazaji?",
          answer:
            "Unapoweka oda ya jumla, fedha hukaa salama ndani ya Kasri\u2122 hadi gari lifike dukani na wahudumu wako waskani kupokea mzigo kamili.",
          steps: [
            "Chagua bidhaa kutoka kwa wasambazaji waliosajiliwa.",
            "Thibitisha malipo ya awali kupitia Kasri\u2122 kabla ya safari.",
            "Skani maboksi dukani pindi yakifika ili kukamilisha malipo kwa msambazaji.",
          ],
        },
        {
          id: "team-pins",
          cat: "account",
          catLabel: "TIMU",
          question: "Ninaongezaje wahudumu wapya na kufunga hesabu za zamu?",
          answer:
            "Mmiliki anaweza kutengeneza akaunti za wahudumu pamoja na namba zao za siri (PIN) za zamu, kisha kulinganisha taslimu na malipo ya simu jioni kwa uwazi.",
          steps: [
            "Fungua sehemu ya timu kwenye akaunti ya mmiliki.",
            "Ongeza jina la mhudumu na mpangie zamu yake.",
            "Mwisho wa zamu, linganisha kiasi kilichoko drooni na jumla ya mfumo.",
          ],
        },
      ]
    : [
        {
          id: "offline-sales",
          cat: "counter",
          catLabel: "COUNTER POS",
          question: "How does my pharmacy counter keep selling when the internet drops?",
          answer:
            "Every Cervos desktop station saves active bills and customer receipts directly on your workstation first. Staff continue serving patients at full speed, and completed sales sync automatically once mobile data or fiber returns.",
          steps: [
            "Keep scanning medicines and printing receipts normally at the desk.",
            "No manual export or end-of-day re-entry is required.",
            "Branch owner views update cleanly as soon as connectivity resumes.",
          ],
        },
        {
          id: "printers-scanners",
          cat: "counter",
          catLabel: "HARDWARE",
          question: "How do I connect a receipt printer or barcode scanner?",
          answer:
            "Standard USB or Bluetooth barcode scanners and counter thermal receipt printers plug straight in without custom drivers or special configuration.",
          steps: [
            "Plug your scanner and printer into your Windows, Mac, or Linux station.",
            "Select your default printer once inside counter preferences.",
            "Run one test scan to verify clean alignment and cut.",
          ],
        },
        {
          id: "expiry-shield",
          cat: "shelf",
          catLabel: "SHELF SAFETY",
          question: "How does Cervos stop expired medicines from reaching patients?",
          answer:
            "Whenever arriving stock is scanned with an iPhone or Samsung, the shelf date locks to that carton. Checkout directs staff to the earliest valid pack first and firmly blocks any expired lot from clearing the counter.",
          steps: [
            "Scan incoming boxes on delivery arrival before placing them on shelves.",
            "Review early 60-day notices inside your weekly owner summary.",
            "Transfer slow items early or return before value is lost.",
          ],
        },
        {
          id: "kasri-wholesale",
          cat: "wholesale",
          catLabel: "KASRI\u2122",
          question: "How does Kasri\u2122 protect both shops and wholesalers?",
          answer:
            "When a pharmacy orders stock from a regional wholesaler, funds rest safely in Kasri\u2122 while vans travel. Payout clears automatically to the distributor once boxes scan cleanly onto the shop shelf.",
          steps: [
            "Select verified packs and shelf dates from licensed depot catalogs.",
            "Lock order funds inside Kasri\u2122 ahead of dispatch.",
            "Confirm receipt by scanning cartons at your dispensary door.",
          ],
        },
        {
          id: "team-pins",
          cat: "account",
          catLabel: "STAFF & ACCOUNTS",
          question: "How do I add pharmacy staff and close evening shifts?",
          answer:
            "Store owners invite staff members with individual shift PINs so every sale, refund, and cash drawer close stays tied to the active operator.",
          steps: [
            "Open Team inside your branch owner portal and add staff details.",
            "Assign cashier, pharmacist, or manager access clearly.",
            "Review blind drawer count against printed shift totals at closing.",
          ],
        },
      ];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return guides.filter((g) => {
      const catMatch = category === "all" || g.cat === category;
      if (!catMatch) return false;
      if (!q) return true;
      return (
        g.question.toLowerCase().includes(q) ||
        g.answer.toLowerCase().includes(q) ||
        g.steps.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [guides, category, query]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#0F172A] flex flex-col selection:bg-[#1039B9] selection:text-white antialiased overflow-x-clip">
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
            src="/cervos-people-stockroom.jpg"
            alt="Cervos Pharma Help Center"
            fill
            className="object-cover object-center opacity-70 transition-transform duration-700 ease-out"
            style={{
              transform:
                !isLowEnd && heroMesh.active
                  ? `scale(1.02) translate(${(50 - heroMesh.x) * 0.05}px, ${(50 - heroMesh.y) * 0.05}px)`
                  : "scale(1)",
            }}
            priority
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(100deg, rgba(15, 23, 42, 0.96) 0%, rgba(15, 23, 42, 0.85) 55%, rgba(15, 23, 42, 0.45) 100%)",
            }}
          />
        </div>

        <PublicNav
          variant="hero"
          ctaHref="/auth?mode=signup"
          ctaLabel={isSw ? "Anza Sasa" : "Get Started"}
          isLowEnd={isLowEnd}
        />

        <div className="max-w-4xl mx-auto px-5 sm:px-6 relative z-20 pt-6 text-center">
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#38BDF8] mb-3">
            <FlipText text={isSw ? "KITUO CHA MSAADA" : "CERVOS HELP CENTER"} flipKey={lang} />
          </div>
          <h1
            className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-[1.08] mb-5"
            style={{ fontFamily: "Outfit, Inter, sans-serif" }}
          >
            <FlipText
              text={isSw ? "Tunawezaje kukusaidia leo?" : "Practical answers for every counter."}
              flipKey={lang}
              mode="words"
            />
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl mx-auto mb-8">
            {isSw
              ? "Tafuta miongozo ya kusanidi kaunta, kukagua rafu, kufunga hesabu za jioni, na kutuma oda za Kasri\u2122."
              : "Search setup guides for counters, shelf scanning, shift reconciliation, and Kasri\u2122 wholesale clearing."}
          </p>

          {/* Clean Hero Search Bar */}
          <div className="max-w-xl mx-auto relative">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                isSw
                  ? "Tafuta mfano: intaneti, risiti, Kasri, tarehe..."
                  : "Search offline counter, receipts, expiry alerts, Kasri..."
              }
              className="w-full px-5 py-3.5 rounded-2xl bg-white text-[#0F172A] placeholder:text-slate-400 text-xs sm:text-sm shadow-2xl focus:outline-none focus:ring-2 focus:ring-[#38BDF8]"
            />
          </div>
        </div>
      </section>

      <main className="flex-1">
        {/* Category Filters & Structured Step-by-Step Answers */}
        <section className="py-16 sm:py-20 bg-white border-b border-zinc-200">
          <div className="max-w-4xl mx-auto px-5 sm:px-6">
            <div className="flex flex-wrap items-center gap-2 mb-10">
              {categories.map((c) => {
                const selected = category === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                      selected
                        ? "bg-[#0F172A] text-white shadow-xs"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-[#FAFAFA] p-10 text-center text-sm text-slate-600">
                {isSw
                  ? "Hakuna mwongozo uliolingana na utafutaji huu. Tuandikie tiketi hapa chini."
                  : "No matching guide found. Feel free to send a direct ticket to our team below."}
              </div>
            ) : (
              <div className="space-y-4">
                {filtered.map((guide) => {
                  const isOpen = openId === guide.id;
                  return (
                    <div
                      key={guide.id}
                      className="rounded-2xl border border-zinc-200 bg-[#FAFAFA] overflow-hidden transition-colors"
                    >
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setOpenId(isOpen ? "" : guide.id)}
                        className="w-full px-6 py-5 flex items-center justify-between gap-4 text-left bg-white hover:bg-zinc-50/70 transition-colors cursor-pointer"
                      >
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1039B9] mb-1">
                            {guide.catLabel}
                          </div>
                          <div
                            className="text-sm sm:text-base font-bold text-[#0F172A]"
                            style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                          >
                            {guide.question}
                          </div>
                        </div>
                        <svg
                          className={`w-4 h-4 text-zinc-500 shrink-0 transition-transform duration-200 ${
                            isOpen ? "rotate-180" : ""
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {isOpen && (
                        <div className="px-6 py-5 border-t border-zinc-200/80 space-y-4">
                          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                            {guide.answer}
                          </p>
                          <ul className="space-y-2">
                            {guide.steps.map((stepText) => (
                              <li
                                key={stepText}
                                className="flex items-start gap-2.5 text-xs sm:text-sm text-[#0F172A]"
                              >
                                <span className="w-5 h-5 rounded-full bg-emerald-50 text-[#00542C] flex items-center justify-center shrink-0 mt-0.5">
                                  <IconCheck className="w-3.5 h-3.5" />
                                </span>
                                <span>{stepText}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Quick Useful Paths Strip */}
            <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Link
                href="/downloads"
                className="rounded-2xl border border-zinc-200 bg-white hover:border-[#1039B9] p-5 transition-colors"
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#1039B9] mb-1">
                  {isSw ? "PROGRAMU" : "INSTALLERS"}
                </div>
                <div className="text-sm font-bold text-[#0F172A]">
                  {isSw ? "Pakua Kwa Kila Kifaa" : "Download For Any Device"} &rarr;
                </div>
              </Link>
              <Link
                href="/products#calculator-focus"
                className="rounded-2xl border border-zinc-200 bg-white hover:border-[#1039B9] p-5 transition-colors"
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#006875] mb-1">
                  {isSw ? "GHARAMA" : "PLANS"}
                </div>
                <div className="text-sm font-bold text-[#0F172A]">
                  {isSw ? "Kikokotoo cha Bei" : "Pricing Calculator"} &rarr;
                </div>
              </Link>
              <Link
                href="/contact"
                className="rounded-2xl border border-zinc-200 bg-white hover:border-[#1039B9] p-5 transition-colors"
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#00542C] mb-1">
                  {isSw ? "TIMU" : "DAR ES SALAAM"}
                </div>
                <div className="text-sm font-bold text-[#0F172A]">
                  {isSw ? "Wasiliana na Ofisi" : "Contact HQ"} &rarr;
                </div>
              </Link>
            </div>
          </div>
        </section>

        {/* Direct Support Desk */}
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
            <Link href="/dispatch" className="hover:text-white transition-colors">
              {isSw ? "Jarida" : "The Dispatch"}
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
