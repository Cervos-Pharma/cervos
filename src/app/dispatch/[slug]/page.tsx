"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import PublicNav from "@/components/PublicNav";
import DispatchInteractions from "@/components/DispatchInteractions";
import { DISPATCH_ESSAYS, getDispatchEssayBySlug } from "@/lib/dispatch-catalog";
import { useI18n } from "@/lib/i18n/context";
import { useIsLowEndDevice } from "@/lib/useDeviceTier";

export default function DispatchArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const essay = getDispatchEssayBySlug(slug);
  if (!essay) notFound();

  const { lang } = useI18n();
  const isSw = lang === "SW";
  const isLowEnd = useIsLowEndDevice();

  const currentIdx = DISPATCH_ESSAYS.findIndex((e) => e.slug === essay.slug);
  const nextEssay = DISPATCH_ESSAYS[(currentIdx + 1) % DISPATCH_ESSAYS.length];

  const title = isSw ? essay.titleSw : essay.titleEn;
  const deck = isSw ? essay.deckSw : essay.deckEn;
  const quote = isSw ? essay.quoteSw : essay.quoteEn;
  const paragraphs = isSw ? essay.paragraphsSw : essay.paragraphsEn;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col selection:bg-[#1039B9] selection:text-white antialiased overflow-x-clip">
      <div className="bg-white border-b border-[#E2E8F0] pt-2 pb-1">
        <PublicNav
          variant="light"
          ctaHref="/auth?mode=signup"
          ctaLabel={isSw ? "Anza Sasa" : "Get Started"}
          isLowEnd={isLowEnd}
        />
      </div>

      <main className="flex-1 py-10 sm:py-14">
        <article className="max-w-3xl mx-auto px-5 sm:px-6 space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/dispatch"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1039B9] hover:text-[#0D2E94] transition-colors"
            >
              <span>&larr;</span>
              <span>{isSw ? "Rudi Kwenye Jarida" : "Back to The Dispatch"}</span>
            </Link>

            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#006875]">
              {isSw ? essay.topicLabelSw : essay.topicLabelEn} &middot;{" "}
              {isSw ? essay.readTimeSw : essay.readTimeEn}
            </div>
          </div>

          <header className="space-y-4">
            <h1
              className="text-3xl sm:text-4xl font-bold text-[#0F172A] tracking-tight leading-[1.12]"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              {title}
            </h1>
            <p className="text-base sm:text-lg text-[#475569] leading-relaxed">{deck}</p>

            <div className="pt-4 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs text-[#475569]">
                <span className="font-bold text-[#0F172A]">{essay.author}</span>
                {" · "}
                <span>{isSw ? essay.authorRoleSw : essay.authorRoleEn}</span>
                {" · "}
                <span>{isSw ? essay.dateSw : essay.dateEn}</span>
              </div>

              <DispatchInteractions
                slug={essay.slug}
                baseUpvotes={essay.baseUpvotes}
                title={title}
                isSw={isSw}
                compact
              />
            </div>
          </header>

          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-md">
            <Image
              src={essay.image}
              alt={title}
              fill
              className="object-cover"
              priority
            />
          </div>

          <blockquote
            className="pl-5 border-l-3 border-[#1039B9] text-lg sm:text-xl italic text-[#0F172A] leading-relaxed"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            &ldquo;{quote}&rdquo;
          </blockquote>

          <div className="space-y-5 text-base sm:text-[17px] text-[#334155] leading-[1.8]">
            {paragraphs.map((p, idx) => (
              <p
                key={p}
                className={
                  idx === 0
                    ? "first-letter:float-left first-letter:mr-3 first-letter:text-5xl first-letter:font-bold first-letter:leading-[0.9] first-letter:text-[#0F172A]"
                    : ""
                }
              >
                {p}
              </p>
            ))}
          </div>

          <div className="pt-8 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-6">
            <DispatchInteractions
              slug={essay.slug}
              baseUpvotes={essay.baseUpvotes}
              title={title}
              isSw={isSw}
            />

            <Link
              href={`/dispatch/${nextEssay.slug}`}
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-[#1039B9] hover:text-[#0D2E94] transition-colors"
            >
              <span>
                {isSw ? "Insha Inayofuata" : "Next Essay"}:{" "}
                {isSw ? nextEssay.titleSw : nextEssay.titleEn}
              </span>
              <span>&rarr;</span>
            </Link>
          </div>
        </article>
      </main>

      <footer className="bg-[#0F172A] text-slate-300 py-10 border-t border-slate-800 text-xs">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 flex flex-wrap items-center justify-between gap-4">
          <span>Cervos Pharma &middot; {isSw ? "Jarida la The Dispatch" : "The Dispatch"}</span>
          <div className="flex items-center gap-6">
            <Link href="/" className="hover:text-white transition-colors">
              {isSw ? "Mwanzo" : "Home"}
            </Link>
            <Link href="/dispatch" className="hover:text-white transition-colors">
              {isSw ? "Jarida" : "The Dispatch"}
            </Link>
            <Link href="/products" className="hover:text-white transition-colors">
              {isSw ? "Bidhaa" : "Products"}
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
