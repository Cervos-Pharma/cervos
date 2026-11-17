"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import PublicNav from "@/components/PublicNav";
import FlipText from "@/components/FlipText";
import { detectClientPlatform, getDownloadBuilds, type PlatformBuildId } from "@/lib/landing-data";
import {
  IconApple,
  IconCheck,
  IconDownload,
  IconLinux,
  IconMobile,
  IconWindows,
} from "@/components/LandingIcons";
import { useI18n } from "@/lib/i18n/context";
import { useIsLowEndDevice } from "@/lib/useDeviceTier";

export default function DownloadsPage() {
  const { lang } = useI18n();
  const isSw = lang === "SW";
  const isLowEnd = useIsLowEndDevice();

  const [detected, setDetected] = useState<PlatformBuildId>("windows");
  const heroRef = useRef<HTMLElement>(null);
  const [heroMesh, setHeroMesh] = useState({ x: 64, y: 38, active: false });

  useEffect(() => {
    setDetected(detectClientPlatform());
  }, []);

  const builds = getDownloadBuilds(isSw);

  const platformIcon = (id: PlatformBuildId) => {
    if (id === "pwa") return <IconMobile className="w-6 h-6" />;
    if (id === "windows") return <IconWindows className="w-6 h-6" />;
    if (id === "linux") return <IconLinux className="w-6 h-6" />;
    return <IconApple className="w-6 h-6" />;
  };

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
            src="/cervos-counter-station.jpg"
            alt="Cervos Pharma Desktop and Mobile Downloads"
            fill
            className="object-cover object-center opacity-75"
            priority
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(100deg, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.82) 55%, rgba(15, 23, 42, 0.4) 100%)",
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
              <FlipText text={isSw ? "VIFAA VYOTE" : "ALL PLATFORMS"} flipKey={lang} />
            </div>
            <h1
              className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-[1.08] mb-4"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              <FlipText
                text={isSw ? "Pakua Cervos kwa Kila Kifaa" : "Download Cervos for Every Device"}
                flipKey={lang}
                mode="words"
              />
            </h1>
            <p className="text-sm sm:text-lg text-slate-200 leading-relaxed max-w-xl">
              <FlipText
                text={
                  isSw
                    ? "Chagua toleo la Windows, Ubuntu Linux, Mac, au simu ya mkononi. Kila toleo linahifadhi mauzo hata mtandao ukikatika."
                    : "Choose your workstation or mobile build. Every installer saves sales locally on the counter and syncs automatically."
                }
                flipKey={lang}
                mode="words"
              />
            </p>
          </div>
        </div>
      </section>

      <main className="flex-1 py-16 sm:py-24">
        <div className="max-w-6xl mx-auto px-5 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {builds.map((b) => {
              const isCurrent = b.id === detected;
              return (
                <div
                  key={b.id}
                  className={`rounded-2xl border p-6 flex flex-col justify-between transition-all ${
                    isCurrent
                      ? "bg-[#0F172A] text-white border-[#0F172A] shadow-xl ring-2 ring-[#38BDF8]/40"
                      : "bg-white text-[#0F172A] border-[#E2E8F0] hover:border-[#1039B9]/40 shadow-2xs"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-5">
                      <span className={isCurrent ? "text-[#38BDF8]" : "text-[#1039B9]"}>
                        {platformIcon(b.id)}
                      </span>
                      {isCurrent && (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#38BDF8]/15 text-[#38BDF8] text-[10px] font-bold">
                          {isSw ? "Kifaa Chako" : "Your Device"}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-wider opacity-75 mb-1">
                      {b.eyebrow}
                    </div>
                    <h2
                      className="font-bold text-lg mb-2"
                      style={{ fontFamily: "Outfit, Inter, sans-serif" }}
                    >
                      {b.title}
                    </h2>
                    <p className={`text-xs leading-relaxed mb-6 ${isCurrent ? "text-slate-300" : "text-[#475569]"}`}>
                      <FlipText text={b.desc} flipKey={lang} mode="words" />
                    </p>
                  </div>

                  {b.id === "pwa" ? (
                    <Link
                      href={b.href}
                      className="w-full py-2.5 px-4 rounded-full bg-[#1039B9] hover:bg-[#0D2E94] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <IconDownload className="w-3.5 h-3.5" />
                      <span>{b.cta}</span>
                    </Link>
                  ) : (
                    <a
                      href={b.href}
                      download
                      className="w-full py-2.5 px-4 rounded-full bg-[#1039B9] hover:bg-[#0D2E94] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <IconDownload className="w-3.5 h-3.5" />
                      <span>{b.cta}</span>
                    </a>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-14 rounded-2xl border border-[#E2E8F0] bg-white p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#006875]">
                {isSw ? "TAYARI KWA KAUNTA" : "COUNTER READY"}
              </div>
              <div className="text-base font-bold text-[#0F172A]">
                {isSw
                  ? "Mashine za risiti na skana zako zinaanza kufanya kazi mara moja bila usanidi mgumu."
                  : "Plug in your receipt printer and scanner to start serving patients in minutes."}
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-xs font-semibold text-[#00542C]">
              <span className="inline-flex items-center gap-1.5">
                <IconCheck className="w-4 h-4" />
                <span>{isSw ? "Mauzo Bila Intaneti" : "Offline Counter Sync"}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <IconCheck className="w-4 h-4" />
                <span>{isSw ? "Tayari Kwa Risiti" : "Plug-and-Play Receipts"}</span>
              </span>
            </div>
          </div>
        </div>
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
            <Link href="/contact" className="hover:text-white transition-colors">
              {isSw ? "Mawasiliano" : "Contacts"}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
