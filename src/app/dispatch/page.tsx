"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import PublicNav from "@/components/PublicNav";
import FlipText from "@/components/FlipText";
import DispatchInteractions from "@/components/DispatchInteractions";
import { DISPATCH_ESSAYS, type DispatchEssay, type EssayTopic } from "@/lib/dispatch-catalog";
import { useI18n } from "@/lib/i18n/context";
import { useIsLowEndDevice } from "@/lib/useDeviceTier";

export default function DispatchJournalPage() {
  const { lang } = useI18n();
  const isSw = lang === "SW";
  const isLowEnd = useIsLowEndDevice();

  const [essays, setEssays] = useState<DispatchEssay[]>(DISPATCH_ESSAYS);
  const [topic, setTopic] = useState<EssayTopic | "all">("all");
  const [sortBy, setSortBy] = useState<"featured" | "top">("featured");

  useEffect(() => {
    fetch("/api/dispatch", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((out: { articles?: DispatchEssay[] } | null) => {
        if (out?.articles && out.articles.length > 0) {
          setEssays(out.articles);
        }
      })
      .catch(() => {
        /* keep static catalog fallback */
      });
  }, []);

  const topics: Array<{ id: EssayTopic | "all"; label: string }> = [
    { id: "all", label: isSw ? "Insha Zote" : "All Essays" },
    { id: "field", label: isSw ? "Simulizi za Mtaa" : "Field Notes" },
    { id: "craft", label: isSw ? "Utunzaji wa Rafu" : "Craft & Practice" },
    { id: "supply", label: isSw ? "Safari ya Ugavi" : "Supply Notes" },
  ];

  const leadEssay = essays[0] ?? DISPATCH_ESSAYS[0];
  const filteredPool =
    topic === "all" && sortBy === "featured"
      ? essays.slice(1)
      : essays.filter((e) => topic === "all" || e.topic === topic);

  const visibleEssays =
    sortBy === "top"
      ? [...filteredPool].sort((a, b) => b.baseUpvotes - a.baseUpvotes)
      : filteredPool;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col selection:bg-[#1039B9] selection:text-white antialiased overflow-x-clip">
      {/* Top Bar */}
      <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] pt-2 pb-1">
        <PublicNav
          variant="light"
          ctaHref="/auth?mode=signup"
          ctaLabel={isSw ? "Anza Sasa" : "Get Started"}
          isLowEnd={isLowEnd}
        />
      </div>

      {/* Classic Centered Artistic Publication Masthead (Brand Palette + Compact Rhythm) */}
      <header className="border-b border-[#E2E8F0] bg-[#F8FAFC] py-8 sm:py-11">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 text-center space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.26em] text-[#006875]">
            CERVOS PHARMA JOURNAL &middot; {isSw ? "TOLEO LA IV" : "VOLUME IV · DAR ES SALAAM"}
          </div>
          <h1
            className="text-4xl sm:text-5xl lg:text-[60px] font-normal tracking-tight text-[#0F172A] leading-[1.04]"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            <FlipText text={isSw ? "Jarida la Cervos" : "The Dispatch"} flipKey={lang} />
          </h1>
          <p
            className="text-sm sm:text-lg text-[#475569] leading-relaxed max-w-2xl mx-auto italic"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            <FlipText
              text={
                isSw
                  ? "Simulizi za kila siku kutoka kwa wafamasia, wauzaji, na madereva wanaoendesha maduka ya jamii."
                  : "Field notes, essays, and portraits from community pharmacists, stockkeepers, and drivers across East Africa."
              }
              flipKey={lang}
              mode="words"
            />
          </p>
        </div>
      </header>

      <main className="flex-1">
        {/* Asymmetric Print-Inspired Lead Essay (Cervos White Canvas + Cobalt & Teal Accents) */}
        <section className="border-b border-[#E2E8F0] bg-white py-10 sm:py-12">
          <div className="max-w-6xl mx-auto px-5 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-7">
              <Link
                href={`/dispatch/${leadEssay.slug}`}
                className="group relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-[#E2E8F0] block shadow-sm"
              >
                {leadEssay.image.startsWith("data:") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={leadEssay.image}
                    alt={isSw ? leadEssay.titleSw : leadEssay.titleEn}
                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                  />
                ) : (
                  <Image
                    src={leadEssay.image}
                    alt={isSw ? leadEssay.titleSw : leadEssay.titleEn}
                    fill
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                    priority
                  />
                )}
              </Link>
            </div>

            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#1039B9]">
                <span>{leadEssay.issue}</span>
                <span className="text-slate-300">&middot;</span>
                <span className="text-[#006875]">
                  {isSw ? leadEssay.readTimeSw : leadEssay.readTimeEn}
                </span>
              </div>

              <h2
                className="text-2xl sm:text-3xl font-normal text-[#0F172A] leading-[1.16]"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                <Link
                  href={`/dispatch/${leadEssay.slug}`}
                  className="hover:text-[#1039B9] transition-colors"
                >
                  {isSw ? leadEssay.titleSw : leadEssay.titleEn}
                </Link>
              </h2>

              <p className="text-sm text-[#475569] leading-relaxed">
                {isSw ? leadEssay.deckSw : leadEssay.deckEn}
              </p>

              <div className="text-xs text-[#475569]">
                <span className="font-semibold text-[#0F172A]">{leadEssay.author}</span>
                {" · "}
                <span>{isSw ? leadEssay.authorRoleSw : leadEssay.authorRoleEn}</span>
              </div>

              <div className="pt-3 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3">
                <DispatchInteractions
                  slug={leadEssay.slug}
                  baseUpvotes={leadEssay.baseUpvotes}
                  title={isSw ? leadEssay.titleSw : leadEssay.titleEn}
                  isSw={isSw}
                  compact
                />

                <Link
                  href={`/dispatch/${leadEssay.slug}`}
                  className="px-5 py-2 rounded-full bg-[#0F172A] hover:bg-[#1039B9] text-white text-xs font-semibold transition-colors"
                >
                  {isSw ? "Soma Insha" : "Read Essay"} &rarr;
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Compact Votable & Shareable Essay Index */}
        <section className="py-10 sm:py-12 bg-[#F8FAFC]">
          <div className="max-w-5xl mx-auto px-5 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-[#E2E8F0]">
              <div className="flex flex-wrap gap-2">
                {topics.map((t) => {
                  const selected = topic === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTopic(t.id)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                        selected
                          ? "bg-[#0F172A] text-white"
                          : "border border-[#E2E8F0] bg-white text-[#475569] hover:text-[#0F172A]"
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              <div className="inline-flex rounded-lg bg-white p-0.5 border border-[#E2E8F0] text-xs">
                <button
                  type="button"
                  onClick={() => setSortBy("featured")}
                  className={`px-3 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                    sortBy === "featured"
                      ? "bg-[#0F172A] text-white"
                      : "text-slate-600 hover:text-[#0F172A]"
                  }`}
                >
                  {isSw ? "Zote" : "Latest"}
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy("top")}
                  className={`px-3 py-1 rounded-md font-medium cursor-pointer transition-colors ${
                    sortBy === "top"
                      ? "bg-[#1039B9] text-white"
                      : "text-slate-600 hover:text-[#0F172A]"
                  }`}
                >
                  {isSw ? "Zilizopendwa" : "Most Upvoted"}
                </button>
              </div>
            </div>

            <div className="divide-y divide-[#E2E8F0]">
              {visibleEssays.map((essay) => {
                const essayTitle = isSw ? essay.titleSw : essay.titleEn;
                const essayDeck = isSw ? essay.deckSw : essay.deckEn;
                return (
                  <article
                    key={essay.slug}
                    className="py-8 grid grid-cols-1 md:grid-cols-12 gap-7 items-center"
                  >
                    <div className="md:col-span-4">
                      <Link
                        href={`/dispatch/${essay.slug}`}
                        className="group relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-[#E2E8F0] block bg-white shadow-2xs"
                      >
                        {essay.image.startsWith("data:") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={essay.image}
                            alt={essayTitle}
                            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                          />
                        ) : (
                          <Image
                            src={essay.image}
                            alt={essayTitle}
                            fill
                            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                          />
                        )}
                      </Link>
                    </div>

                    <div className="md:col-span-8 space-y-3">
                      <div className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#006875]">
                        <span>{isSw ? essay.topicLabelSw : essay.topicLabelEn}</span>
                        <span className="text-slate-300">&middot;</span>
                        <span className="text-slate-500">
                          {isSw ? essay.dateSw : essay.dateEn}
                        </span>
                        <span className="text-slate-300">&middot;</span>
                        <span className="text-slate-500">
                          {isSw ? essay.readTimeSw : essay.readTimeEn}
                        </span>
                      </div>

                      <h3
                        className="text-xl sm:text-2xl font-normal text-[#0F172A] leading-snug"
                        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                      >
                        <Link
                          href={`/dispatch/${essay.slug}`}
                          className="hover:text-[#1039B9] transition-colors"
                        >
                          {essayTitle}
                        </Link>
                      </h3>

                      <p className="text-sm text-[#475569] leading-relaxed">{essayDeck}</p>

                      <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
                        <DispatchInteractions
                          slug={essay.slug}
                          baseUpvotes={essay.baseUpvotes}
                          title={essayTitle}
                          isSw={isSw}
                          compact
                        />

                        <Link
                          href={`/dispatch/${essay.slug}`}
                          className="text-xs font-bold text-[#1039B9] hover:text-[#0D2E94] transition-colors"
                        >
                          {isSw ? "Fungua Makala" : "Read Full Note"} &rarr;
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#0F172A] text-slate-300 py-10 border-t border-slate-800 text-xs">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 flex flex-wrap items-center justify-between gap-4">
          <span>Cervos Pharma &middot; {isSw ? "Jarida la The Dispatch" : "The Dispatch Journal"}</span>
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
            <Link href="/help" className="hover:text-white transition-colors">
              {isSw ? "Msaada" : "Help"}
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
