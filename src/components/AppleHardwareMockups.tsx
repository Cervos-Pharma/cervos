"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import ForegroundModal from "@/components/ForegroundModal";
import { IconCheck } from "@/components/LandingIcons";

export function ScrollRevealBand({
  children,
  className = "",
  isLowEnd = false,
}: {
  children: React.ReactNode;
  className?: string;
  isLowEnd?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(isLowEnd);

  useEffect(() => {
    if (isLowEnd || !ref.current) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isLowEnd]);

  return (
    <div
      ref={ref}
      className={`transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        } ${className}`}
    >
      {children}
    </div>
  );
}

/* Pure seamless right-bleeding desktop workstation photograph (no frame, no overlay caption) */
export function DesktopStudioBezel({ isLowEnd }: { isLowEnd: boolean }) {
  return (
    <div className="relative lg:-mr-28 xl:-mr-44">
      <div
        className={`relative aspect-[16/10] w-full ${isLowEnd ? "" : "transition-transform duration-700 ease-out hover:-translate-y-1"
          }`}
        style={{
          maskImage:
            "linear-gradient(to right, transparent 0%, black 12%, black 96%, black 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 12%, black 96%, black 100%)",
        }}
      >
        <Image
          src="/cervos-hardware-desktop.jpg"
          alt="Cervos running across MacBook and HP desktop workstations"
          fill
          className="object-cover object-center mix-blend-multiply"
          priority
        />
      </div>
    </div>
  );
}

/* Uniform white-screen pharmacy app rendered identically inside both tilted phones */
function UniformPhoneScreen({
  isSw,
  isLowEnd,
}: {
  isSw: boolean;
  isLowEnd: boolean;
}) {
  return (
    <div className="flex-1 flex flex-col justify-between pt-3.5 pb-2.5 px-1 relative overflow-hidden">
      {!isLowEnd && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-12 bottom-0 w-16 bg-gradient-to-r from-transparent via-white/80 to-transparent animate-screen-glimmer z-20"
        />
      )}

      {/* Brand Header with Cervos Circular Logo */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-1.5">
          <div className="relative w-5 h-5 rounded-full overflow-hidden ring-1 ring-slate-200 bg-white shrink-0">
            <Image
              src="/cervos-company-logo-circular.svg"
              alt="Cervos Pharma"
              fill
              className="object-contain p-0.5"
            />
          </div>
          <span
            className="text-[11px] font-bold text-[#0F172A] tracking-tight"
            style={{ fontFamily: "Outfit, Inter, sans-serif" }}
          >
            Cervos
          </span>
        </div>
        <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-700">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </span>
      </div>

      <div className="space-y-2.5 my-auto py-2">
        <div className="rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] p-3">
          <div className="text-[10px] font-medium text-slate-500 mb-0.5">
            {isSw ? "Mauzo ya Leo" : "Counter Today"}
          </div>
          <div
            className="text-base font-bold text-[#0F172A] tracking-tight tabular-nums"
            style={{ fontFamily: "Outfit, Inter, sans-serif" }}
          >
            TZS 1,840,000
          </div>
        </div>

        <div className="rounded-xl bg-white border border-[#E2E8F0] shadow-2xs p-3 relative overflow-hidden">
          {!isLowEnd && (
            <div className="pointer-events-none absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-[#1039B9] to-transparent animate-scan-beam" />
          )}
          <div className="text-[9px] font-bold uppercase tracking-wider text-[#1039B9] mb-0.5">
            FEFO Verified
          </div>
          <div className="text-xs font-bold text-[#0F172A] leading-snug">
            Amoxicillin 500mg
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5 tabular-nums">
            Lot TZ-408 &middot; Safe
          </div>
        </div>

        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2.5">
          <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-800 mb-0.5">
            {isSw ? "Rafu Salama" : "Shelf Shield"}
          </div>
          <div className="text-[11px] font-semibold text-emerald-950">
            {isSw ? "0 zilizopitwa muda" : "0 expired packs cleared"}
          </div>
        </div>
      </div>

      <div className="mx-auto w-14 h-1 rounded-full bg-slate-300" />
    </div>
  );
}

/* Tilted, floating Apple iPhone Titanium frame (crisp white screen, zero undercaptions) */
export function AppleIPhoneMockup({
  isSw = false,
  isLowEnd,
}: {
  isSw?: boolean;
  isLowEnd: boolean;
}) {
  return (
    <div className={`relative mx-auto w-[214px] sm:w-[230px] ${isLowEnd ? "" : "animate-revolve-left"}`}>
      <div className="relative rounded-[40px] p-[8px] bg-gradient-to-b from-slate-200 via-slate-400 to-slate-600 shadow-[0_30px_70px_-15px_rgba(56,189,248,0.28)]">
        <div className="relative rounded-[32px] bg-white text-[#0F172A] overflow-hidden aspect-[9/19.2] flex flex-col p-3.5 border border-slate-200">
          <div className="mx-auto w-16 h-4 rounded-full bg-[#0F172A] shrink-0" />
          <UniformPhoneScreen isSw={isSw} isLowEnd={isLowEnd} />
        </div>
      </div>
    </div>
  );
}

/* Tilted, floating Samsung Galaxy Ultra Titanium frame (identical scale & crisp white UI) */
export function TitaniumPhoneMockup({
  isSw = false,
  isLowEnd,
}: {
  isSw?: boolean;
  isLowEnd: boolean;
}) {
  return (
    <div className={`relative mx-auto w-[214px] sm:w-[230px] ${isLowEnd ? "" : "animate-revolve-right"}`}>
      <div className="relative rounded-[20px] p-[7px] bg-gradient-to-b from-stone-200 via-stone-400 to-stone-600 shadow-[0_30px_70px_-15px_rgba(16,57,185,0.34)]">
        <div className="relative rounded-[14px] bg-white text-[#0F172A] overflow-hidden aspect-[9/19.2] flex flex-col p-3.5 border border-slate-200">
          <div className="mx-auto w-2.5 h-2.5 rounded-full bg-[#0F172A] shrink-0 mt-0.5" />
          <UniformPhoneScreen isSw={isSw} isLowEnd={isLowEnd} />
        </div>
      </div>
    </div>
  );
}

/* Pure seamless left-bleeding tablet photograph (no frame, no overlay caption) */
export function AluminumTabletMockup({ isLowEnd }: { isLowEnd: boolean }) {
  return (
    <div className="relative lg:-ml-28 xl:-ml-44">
      <div
        className={`relative aspect-[16/10] w-full ${isLowEnd ? "" : "animate-float-gentle"
          }`}
        style={{
          maskImage:
            "linear-gradient(to left, transparent 0%, black 12%, black 96%, black 100%)",
          WebkitMaskImage:
            "linear-gradient(to left, transparent 0%, black 12%, black 96%, black 100%)",
        }}
      >
        <Image
          src="/cervos-hardware-tablet.jpg"
          alt="Cervos wholesale dispatch on landscape tablet"
          fill
          className="object-cover object-center mix-blend-multiply"
        />
      </div>
    </div>
  );
}

/* Uniform live dashboard interior rendered identically across Ubuntu Kiosk & MacBook */
function UniformWorkspaceScreen({
  isSw,
  dark,
}: {
  isSw: boolean;
  dark: boolean;
}) {
  const cardBg = dark
    ? "bg-white/6 border-white/10 text-white"
    : "bg-[#F8FAFC] border-[#E2E8F0] text-[#0F172A]";
  const labelText = dark ? "text-zinc-400" : "text-zinc-500";
  const accentText = dark ? "text-emerald-400" : "text-emerald-700";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-xl border p-3.5 ${cardBg}`}>
          <div className={`text-[10px] ${labelText}`}>
            {isSw ? "Mauzo ya Leo" : "Counter Today"}
          </div>
          <div
            className="text-base sm:text-lg font-semibold mt-0.5 tabular-nums tracking-tight"
            style={{ fontFamily: "Outfit, Inter, sans-serif" }}
          >
            TZS 1,840,000
          </div>
        </div>
        <div className={`rounded-xl border p-3.5 ${cardBg}`}>
          <div className={`text-[10px] ${labelText}`}>
            {isSw ? "Usalama wa Rafu" : "Shelf Safety"}
          </div>
          <div
            className={`text-base sm:text-lg font-semibold mt-0.5 tabular-nums tracking-tight ${accentText}`}
            style={{ fontFamily: "Outfit, Inter, sans-serif" }}
          >
            100% FEFO
          </div>
        </div>
      </div>

      <div className={`rounded-xl border p-3 flex items-center justify-between text-xs ${cardBg}`}>
        <span>{isSw ? "Kasri\u2122 Imehakikiwa" : "Kasri\u2122 Dispatches"}</span>
        <span className="font-semibold tabular-nums">4 / 4</span>
      </div>
    </div>
  );
}

/* Touchscreen Kiosk Frame (left bleed, no undercaption) */
export function UbuntuKioskBezel({
  isSw = false,
  isLowEnd,
}: {
  isSw?: boolean;
  isLowEnd: boolean;
}) {
  return (
    <div className={`relative lg:-ml-16 xl:-ml-24 ${isLowEnd ? "" : "transition-transform duration-700 hover:-translate-y-1"}`}>
      <div className="rounded-r-2xl rounded-l-2xl lg:rounded-l-none bg-[#18181B] p-3.5 sm:p-5 border border-zinc-800 shadow-xl">
        <div className="rounded-xl bg-[#0B0D12] p-4 sm:p-5 border border-white/10">
          <UniformWorkspaceScreen isSw={isSw} dark />
        </div>
      </div>
    </div>
  );
}

/* Anodized Aluminum Laptop Frame (right bleed, no undercaption) */
export function MacBookOwnerBezel({
  isSw = false,
  isLowEnd,
}: {
  isSw?: boolean;
  isLowEnd: boolean;
}) {
  return (
    <div className={`relative lg:-mr-16 xl:-mr-24 ${isLowEnd ? "" : "transition-transform duration-700 hover:-translate-y-1"}`}>
      <div className="rounded-l-2xl rounded-r-2xl lg:rounded-r-none bg-gradient-to-b from-zinc-200 to-zinc-300 p-3.5 sm:p-5 border border-zinc-300 shadow-xl">
        <div className="rounded-xl bg-white p-4 sm:p-5 border border-zinc-200">
          <UniformWorkspaceScreen isSw={isSw} dark={false} />
        </div>
      </div>
    </div>
  );
}

export interface WalkthroughGuide {
  id: "counter" | "shelf" | "wholesale";
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaHref: string;
  ctaLabel: string;
  scenes: Array<{
    step: string;
    durationSec: number;
    caption: string;
    detail: string;
    image: string;
  }>;
  setupSteps: string[];
}

export function ProductWalkthroughModal({
  guide,
  onClose,
  isSw,
}: {
  guide: WalkthroughGuide | null;
  onClose: () => void;
  isSw: boolean;
}) {
  const [sceneIdx, setSceneIdx] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    setSceneIdx(0);
    setPlaying(true);
  }, [guide?.id]);

  useEffect(() => {
    if (!guide || !playing) return;
    const timer = setInterval(() => {
      setSceneIdx((prev) => (prev + 1) % guide.scenes.length);
    }, 3400);
    return () => clearInterval(timer);
  }, [guide, playing]);

  useEffect(() => {
    if (!guide) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [guide, onClose]);

  const scene = guide ? guide.scenes[sceneIdx] ?? guide.scenes[0] : null;

  return (
    <ForegroundModal
      open={Boolean(guide && scene)}
      onClose={onClose}
      ariaLabel={guide?.title}
      panelClassName="max-w-4xl w-full max-h-[92vh] overflow-y-auto bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl"
    >
      {guide && scene && (
        <div>
          <div className="p-6 sm:p-8 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#1039B9] mb-1">
              {guide.eyebrow}
            </div>
            <h3
              className="text-xl sm:text-2xl font-bold text-[#0F172A]"
              style={{ fontFamily: "Outfit, Inter, sans-serif" }}
            >
              {guide.title}
            </h3>
            <p className="text-xs sm:text-sm text-[#475569] mt-1">{guide.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close walkthrough"
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-[#0F172A] flex items-center justify-center shrink-0 cursor-pointer"
          >
            &times;
          </button>
        </div>

        <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 space-y-4">
            <div className="relative aspect-[16/10] rounded-2xl overflow-hidden bg-[#0F172A] border border-slate-200 shadow-lg">
              <Image
                key={scene.image + scene.step}
                src={scene.image}
                alt={scene.caption}
                fill
                className="object-cover opacity-90 transition-opacity duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A]/90 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#38BDF8] mb-1">
                  {scene.step}
                </div>
                <div className="text-sm sm:text-base font-bold">{scene.caption}</div>
                <div className="text-xs text-slate-200 mt-0.5">{scene.detail}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                className="px-3.5 py-1.5 rounded-full bg-[#0F172A] text-white text-xs font-semibold cursor-pointer shrink-0"
              >
                {playing ? (isSw ? "Simamisha" : "Pause") : (isSw ? "Cheza" : "Play")}
              </button>
              <div className="flex-1 grid grid-cols-4 gap-1.5">
                {guide.scenes.map((sc, i) => (
                  <button
                    key={sc.step}
                    type="button"
                    onClick={() => {
                      setSceneIdx(i);
                      setPlaying(false);
                    }}
                    className={`h-2 rounded-full transition-all cursor-pointer ${i === sceneIdx
                      ? "bg-[#1039B9]"
                      : i < sceneIdx
                        ? "bg-[#1039B9]/40"
                        : "bg-slate-200"
                      }`}
                    title={sc.caption}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#006875] mb-3">
                {isSw ? "JINSI YA KUTUMIA" : "HOW TO GET RUNNING"}
              </div>
              <ol className="space-y-3">
                {guide.setupSteps.map((stepText, idx) => (
                  <li key={stepText} className="flex items-start gap-2.5 text-xs sm:text-sm text-[#475569]">
                    <span className="w-5 h-5 rounded-full bg-emerald-50 text-[#00542C] flex items-center justify-center shrink-0 mt-0.5">
                      <IconCheck className="w-3 h-3" />
                    </span>
                    <span>
                      <strong className="text-[#0F172A] mr-1">0{idx + 1}.</strong>
                      {stepText}
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-3">
              <Link
                href={guide.ctaHref}
                onClick={onClose}
                className="flex-1 py-2.5 px-4 rounded-full bg-[#1039B9] hover:bg-[#0D2E94] text-white text-xs font-semibold text-center transition-all"
              >
                {guide.ctaLabel} &rarr;
              </Link>
              <Link
                href="/downloads"
                onClick={onClose}
                className="py-2.5 px-4 rounded-full border border-[#E2E8F0] hover:bg-slate-50 text-xs font-semibold text-[#0F172A] text-center transition-colors"
              >
                {isSw ? "Pakua" : "Downloads"}
              </Link>
            </div>
          </div>
        </div>
      </div>
      )}
    </ForegroundModal>
  );
}
