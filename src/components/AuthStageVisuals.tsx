"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import AuthOrthographicGlobe from "@/components/AuthOrthographicGlobe";
import FlipText from "@/components/FlipText";
import { IconBolt, IconShield, IconLock, IconCheck } from "@/components/LandingIcons";
import { useIsLowEndDevice } from "@/lib/useDeviceTier";

export type BusinessRole =
  | "pharmacy"
  | "supplier"
  | "dispensary"
  | "researcher"
  | "investor"
  | "other"
  | null;

interface Props {
  mode: "signin" | "signup";
  role: BusinessRole;
  customRoleLabel?: string;
  lang: string;
  isSw: boolean;
}

const AUTH_PINGS = [
  { lat: -6.8137, lng: 39.2819 },
  { lat: -6.79, lng: 39.208 },
  { lat: -3.3961, lng: 36.7904 },
  { lat: -2.5166, lng: 32.9017 },
  { lat: -6.163, lng: 35.7516 },
  { lat: -5.0667, lng: 39.1 },
];

export default function AuthStageVisuals({
  mode,
  role,
  customRoleLabel,
  lang,
  isSw,
}: Props) {
  const isLowEnd = useIsLowEndDevice();
  const showGlobe =
    mode === "signin" || role === null || role === "supplier";
  const isInvertedSupplier = mode === "signup" && role === "supplier";

  // Waylay pulse + background readiness coordination for silky globe & copy fade-in
  const [globeReady, setGlobeReady] = useState(false);
  const [pulseSettled, setPulseSettled] = useState(false);

  useEffect(() => {
    if (!showGlobe || isLowEnd) {
      setPulseSettled(true);
      return;
    }

    setPulseSettled(false);
    // Longer waylay beat for dark Supplier radial swallow -> brief pulse -> reveal
    const holdMs = isInvertedSupplier ? 920 : 480;
    const holdTimer = setTimeout(() => setPulseSettled(true), holdMs);
    // Safety release if WebGL readiness takes unusually long
    const fallbackTimer = setTimeout(() => setGlobeReady(true), 1600);

    return () => {
      clearTimeout(holdTimer);
      clearTimeout(fallbackTimer);
    };
  }, [showGlobe, isInvertedSupplier, isLowEnd]);

  const revealGlobeStage = isLowEnd || (globeReady && pulseSettled);

  // 1. Tilted Rotating Globe: Radial dark swallow -> waylay pulse while WebGL mounts -> smooth fade-in of globe + words
  if (showGlobe) {
    return (
      <div className="relative w-full h-full flex flex-col justify-between pt-20 pb-6 px-6 sm:pt-24 sm:pb-8 sm:px-10 overflow-hidden bg-[#F8FAFC] text-[#0F172A]">
        {/* Beat 1: Smooth radial dark swallow when switching to Supplier */}
        {isInvertedSupplier && (
          <div
            key="dark-swallow-wave"
            className={`pointer-events-none absolute inset-0 bg-[#09090B] z-0 ${isLowEnd ? "" : "animate-radial-swallow"
              }`}
          />
        )}

        {/* Beat 2: Waylay Breathing Pulse Ring holds focus while WebGL settles */}
        {!isLowEnd && (
          <div
            className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${revealGlobeStage ? "opacity-0 scale-110" : "opacity-100 scale-100"
              }`}
          >
            <div className="relative flex items-center justify-center">
              <div
                className={`w-48 h-48 sm:w-64 sm:h-64 rounded-full border animate-waylay-pulse ${isInvertedSupplier
                  ? "border-white/25 bg-white/[0.03]"
                  : "border-[#1039B9]/20 bg-[#1039B9]/[0.03]"
                  }`}
              />
              <div
                className={`absolute w-28 h-28 sm:w-36 sm:h-36 rounded-full border ${isInvertedSupplier
                  ? "border-white/40 bg-white/[0.05]"
                  : "border-[#1039B9]/30 bg-blue-100/20"
                  } animate-waylay-pulse`}
                style={{ animationDelay: "0.35s" }}
              />
              <span
                className={`w-2.5 h-2.5 rounded-full ${isInvertedSupplier ? "bg-white/80" : "bg-[#1039B9]/75"
                  }`}
              />
            </div>
          </div>
        )}

        {/* Heading Copy (Desktop split view only, avoids overlapping mobile form) */}
        <div
          className={`hidden lg:block relative z-20 max-w-md transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${isInvertedSupplier ? "text-white" : "text-[#0F172A]"
            } ${revealGlobeStage
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-3"
            }`}
        >
          <div
            className={`text-[11px] font-bold uppercase tracking-[0.2em] mb-1.5 transition-colors duration-700 ${isInvertedSupplier ? "text-neutral-400" : "text-[#1039B9]"
              }`}
          >
            <FlipText
              text={
                isInvertedSupplier
                  ? isSw
                    ? "WASAMBAZAJI"
                    : "SUPPLIERS"
                  : "CERVOS NETWORK"
              }
              flipKey={`${lang}-${isInvertedSupplier ? "sup" : "std"}`}
            />
          </div>
          <h2
            className="text-xl sm:text-3xl font-bold tracking-tight leading-snug"
            style={{ fontFamily: "Outfit, Inter, sans-serif" }}
          >
            <FlipText
              text={
                isInvertedSupplier
                  ? isSw
                    ? "Sambaza dawa moja kwa moja kwa maduka Tanzania."
                    : "Supply pharmacies directly across Tanzania."
                  : isSw
                    ? "Tukihudumia jamii kote Tanzania."
                    : "Serving pharmacies across Tanzania."
              }
              flipKey={`${lang}-${isInvertedSupplier ? "sup" : "std"}`}
            />
          </h2>
        </div>

        {/* Beat 3: Large Horizon-Offset Globe on Mobile (like Home #network), Full Stage on Desktop */}
        <div
          className={`relative z-10 flex-1 flex items-end justify-end lg:items-center lg:justify-center min-h-[300px] transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] ${revealGlobeStage
            ? isLowEnd
              ? "opacity-100"
              : isInvertedSupplier
                ? "opacity-100 animate-globe-drop-pop"
                : "opacity-100 animate-globe-appear"
            : "opacity-0 scale-95 pointer-events-none"
            }`}
        >
          <div className="w-[460px] h-[460px] translate-x-16 translate-y-24 sm:w-[580px] sm:h-[580px] sm:translate-x-24 sm:translate-y-20 lg:translate-x-0 lg:translate-y-0 lg:w-[580px] lg:h-[580px] xl:w-[660px] xl:h-[660px]">
            <AuthOrthographicGlobe
              activePoints={AUTH_PINGS}
              autoRotate={true}
              autoRotateSpeed={isInvertedSupplier ? 0.85 : 0.55}
              invertTheme={isInvertedSupplier}
              onReady={() => setGlobeReady(true)}
            />
          </div>
        </div>

        <div className="h-1 shrink-0" />
      </div>
    );
  }

  // 2a. Dispensary / Clinic: Patient-Centered Care, Prescription Safety & Follow-Up Stage
  if (role === "dispensary") {
    return (
      <div
        key="stage-dispensary-patient"
        className={`relative w-full h-full bg-[#F8FAFC] text-[#0F172A] pt-20 pb-6 px-6 sm:pt-24 sm:pb-8 sm:px-10 flex flex-col justify-between overflow-hidden ${isLowEnd ? "" : "animate-stage-pop"
          }`}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage: "radial-gradient(#99F6E4 1.3px, transparent 1.3px)",
            backgroundSize: "26px 26px",
          }}
        />

        <div className="hidden lg:block relative z-10 max-w-md">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#006875] mb-1.5">
            <FlipText
              text={isSw ? "ZAHANATI NA KLINIKI" : "CLINICS & DISPENSARIES"}
              flipKey={`${lang}-dispensary`}
            />
          </div>
          <h2
            className="text-xl sm:text-3xl font-bold tracking-tight leading-snug"
            style={{ fontFamily: "Outfit, Inter, sans-serif" }}
          >
            <FlipText
              text={
                isSw
                  ? "Huduma inayomtanguliza mgonjwa na dozi sahihi kila ziara."
                  : "Patient-centered care, clean prescriptions, zero guesswork."
              }
              flipKey={`${lang}-dispensary`}
              mode="words"
            />
          </h2>
        </div>

        <div className="relative flex-1 flex items-end justify-end lg:items-center lg:justify-center my-4 translate-y-16 translate-x-10 opacity-50 lg:translate-y-0 lg:translate-x-0 lg:opacity-100">
          <div
            className={`${isLowEnd ? "" : "animate-float-gentle"
              } hidden sm:flex absolute left-6 lg:left-14 top-6 rounded-xl bg-white border border-teal-200 shadow-lg px-4 py-3 z-20 items-center gap-3`}
          >
            <div className="w-9 h-9 rounded-full bg-teal-50 text-[#006875] flex items-center justify-center">
              <IconShield className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-[#0F172A]">
                {isSw ? "Dozi Imehakikiwa" : "Safe Dose Verified"}
              </div>
              <div className="text-[10px] text-[#006875] font-medium">
                {isSw ? "Kundi Salama" : "Fresh Batch Assigned"}
              </div>
            </div>
          </div>

          {/* Floating Cold-Chain Monitor Pill */}
          <div
            className={`${isLowEnd ? "" : "animate-float-gentle"
              } hidden sm:flex absolute right-6 lg:right-14 bottom-6 rounded-xl bg-white border border-emerald-200 shadow-lg px-4 py-3 z-20 items-center gap-3`}
            style={{ animationDelay: "1.2s" }}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <div className="text-[11px] font-bold text-[#0F172A]">
                {isSw ? "Chanjo & Dawa Baridi" : "Cold Storage Monitor"}
              </div>
              <div className="text-[10px] font-mono text-[#00542C] font-semibold">
                2&deg;C &ndash; 8&deg;C &middot; Stable
              </div>
            </div>
          </div>

          {/* Main Patient Care Journey Card */}
          <div className="relative w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 z-10">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="relative w-9 h-9 rounded-full overflow-hidden border border-slate-200 bg-white">
                  <Image
                    src="/cervos-company-logo-circular.svg"
                    alt="Cervos Care"
                    fill
                    className="object-contain p-0.5"
                  />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0F172A]">
                    {isSw ? "Ziara ya Mgonjwa" : "Patient Care Record"}
                  </div>
                  <div className="text-[11px] text-[#006875] font-medium">
                    {isSw ? "Chumba cha Dawa" : "Outpatient Dispensary"}
                  </div>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-teal-50 text-[#006875] text-[10px] font-bold">
                Rx
              </span>
            </div>

            <div className="space-y-3">
              {[
                {
                  step: "01",
                  title: isSw ? "Mapokezi & Ushauri" : "Consultation & Prescription",
                  status: isSw ? "Imepokelewa" : "Logged",
                },
                {
                  step: "02",
                  title: isSw ? "Uchaguzi wa Dawa Salama" : "Earliest Valid Batch Pick",
                  status: isSw ? "Imehakikiwa" : "Verified",
                },
                {
                  step: "03",
                  title: isSw ? "Maelekezo & Ufuatiliaji" : "Patient Guidance & Refill",
                  status: isSw ? "Tayari" : "Ready",
                },
              ].map((row) => (
                <div
                  key={row.step}
                  className="flex items-center justify-between p-3 rounded-lg bg-[#F8FAFC] border border-slate-100"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-mono font-bold text-[#006875]">
                      {row.step}
                    </span>
                    <span className="text-xs font-semibold text-[#0F172A]">{row.title}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#00542C]">
                    <IconCheck className="w-3 h-3" />
                    <span>{row.status}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="h-1 shrink-0" />
      </div>
    );
  }

  // 2b. Pharmacy: Coin, Banknotes & Counter POS with Cervos Product Logo + Morph Pop
  if (role === "pharmacy") {
    return (
      <div
        key="stage-pharmacy"
        className={`relative w-full h-full bg-[#F8FAFC] text-[#0F172A] pt-20 pb-6 px-6 sm:pt-24 sm:pb-8 sm:px-10 flex flex-col justify-between overflow-hidden ${isLowEnd ? "" : "animate-stage-pop"
          }`}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-45"
          style={{
            backgroundImage: "radial-gradient(#CBD5E1 1.25px, transparent 1.25px)",
            backgroundSize: "26px 26px",
          }}
        />

        <div className="hidden lg:block relative z-10 max-w-md">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#006875] mb-1.5">
            <FlipText
              text={isSw ? "DUKA LA DAWA" : "PHARMACY"}
              flipKey={`${lang}-pharmacy`}
            />
          </div>
          <h2
            className="text-xl sm:text-3xl font-bold tracking-tight leading-snug"
            style={{ fontFamily: "Outfit, Inter, sans-serif" }}
          >
            <FlipText
              text={
                isSw
                  ? "Kaunta yenye kasi, sarafu na risiti safi kila siku."
                  : "Every coin, mobile payment, and safe medicine in one place."
              }
              flipKey={`${lang}-pharmacy`}
            />
          </h2>
        </div>

        <div className="relative flex-1 flex items-end justify-end lg:items-center lg:justify-center my-4 translate-y-16 translate-x-10 opacity-50 lg:translate-y-0 lg:translate-x-0 lg:opacity-100">
          <div
            className={`${isLowEnd ? "" : "animate-float-gentle"
              } hidden sm:flex absolute left-6 lg:left-12 top-8 w-16 h-16 lg:w-20 lg:h-20 rounded-full bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 p-1 shadow-xl z-20 items-center justify-center`}
          >
            <div className="w-full h-full rounded-full border-2 border-amber-100/70 flex flex-col items-center justify-center bg-amber-300/30">
              <div className="relative w-8 h-8 lg:w-9 lg:h-9 rounded-full overflow-hidden bg-white shadow-2xs">
                <Image
                  src="/cervos-product-logo-circular.svg"
                  alt="Cervos Coin"
                  fill
                  className="object-contain p-0.5"
                />
              </div>
              <span className="text-[8px] font-bold text-amber-950 tracking-wider mt-0.5">
                TZS
              </span>
            </div>
          </div>

          <div
            className={`${isLowEnd ? "" : "animate-float-gentle"
              } hidden sm:flex absolute right-4 lg:right-10 top-6 w-40 h-22 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-100 border border-teal-300 shadow-lg p-3 flex-col justify-between z-20 rotate-6`}
            style={{ animationDelay: "1.1s" }}
          >
            <div className="flex items-center justify-between">
              <div className="relative w-6 h-6 rounded-full overflow-hidden bg-white">
                <Image
                  src="/cervos-product-logo-circular.svg"
                  alt="Cervos"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="text-[10px] font-mono font-bold text-[#00542C]">
                10,000 TZS
              </span>
            </div>
            <div className="text-[10px] font-semibold text-[#006875]">
              {isSw ? "Malipo ya Kaunta" : "Cash & M-Pesa"}
            </div>
          </div>

          <div className="relative w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 sm:p-6 z-10">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
              <div className="flex items-center gap-3">
                <div className="relative w-9 h-9 rounded-full overflow-hidden border border-slate-200 bg-white">
                  <Image
                    src="/cervos-product-logo-circular.svg"
                    alt="Cervos Product Mark"
                    fill
                    className="object-contain p-0.5"
                  />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0F172A]">Cervos Counter</div>
                  <div className="text-[11px] text-emerald-700 font-medium">
                    {isSw ? "Tayari bila mtandao" : "Always ready"}
                  </div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#EFF6FF] text-[#1039B9] text-[10px] font-bold">
                POS
              </span>
            </div>

            <div className="space-y-2.5 mb-4">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#F8FAFC] border border-slate-100 text-xs">
                <span className="font-semibold text-[#0F172A]">
                  {isSw ? "Mauzo ya Sasa" : "Counter Sale"}
                </span>
                <span className="font-mono font-bold text-[#1039B9]">TZS 24,500</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200/70 text-xs">
                <span className="font-medium text-[#00542C] flex items-center gap-1.5">
                  <IconShield className="w-4 h-4" />
                  <span>{isSw ? "Dawa Salama" : "Fresh Stock Checked"}</span>
                </span>
                <span className="font-bold text-[#00542C]">OK</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
              <span className="text-slate-500">
                {isSw ? "Risiti & Droo" : "Receipt & Drawer"}
              </span>
              <span className="font-bold text-[#1039B9] flex items-center gap-1">
                <IconBolt className="w-3.5 h-3.5" />
                <span>{isSw ? "Haraka" : "Instant"}</span>
              </span>
            </div>
          </div>

          <div
            className={`${isLowEnd ? "" : "animate-float-gentle"
              } hidden sm:flex absolute right-8 lg:right-16 bottom-4 w-12 h-12 rounded-full bg-gradient-to-br from-slate-100 via-slate-300 to-slate-400 p-1 shadow-lg z-20 items-center justify-center`}
            style={{ animationDelay: "1.9s" }}
          >
            <div className="w-full h-full rounded-full border border-white flex items-center justify-center">
              <div className="relative w-6 h-6">
                <Image
                  src="/cervos-company-logo-circular.svg"
                  alt="Cervos"
                  fill
                  className="object-contain"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="h-2 shrink-0" />
      </div>
    );
  }

  // 3. Researcher: Pharmacy Access Insights + Morph Pop
  if (role === "researcher") {
    return (
      <div
        key="stage-researcher"
        className={`relative w-full h-full bg-[#F8FAFC] text-[#0F172A] pt-20 pb-6 px-6 sm:pt-24 sm:pb-8 sm:px-10 flex flex-col justify-between overflow-hidden ${isLowEnd ? "" : "animate-stage-pop"
          }`}
      >
        <div className="hidden lg:block relative z-10 max-w-md">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#006875] mb-1.5">
            <FlipText
              text={isSw ? "UTAFITI WA AFYA" : "RESEARCHERS"}
              flipKey={`${lang}-res`}
            />
          </div>
          <h2
            className="text-xl sm:text-3xl font-bold tracking-tight leading-snug"
            style={{ fontFamily: "Outfit, Inter, sans-serif" }}
          >
            <FlipText
              text={
                isSw
                  ? "Uelewa halisi wa upatikanaji wa dawa Afrika Mashariki."
                  : "Understand medicine availability across East African communities."
              }
              flipKey={`${lang}-res`}
            />
          </h2>
        </div>

        <div className="relative flex-1 flex items-end justify-end lg:items-center lg:justify-center my-4 translate-y-16 translate-x-10 opacity-50 lg:translate-y-0 lg:translate-x-0 lg:opacity-100">
          <div className="relative w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="relative w-9 h-9 rounded-full overflow-hidden border border-slate-200">
                  <Image
                    src="/cervos-company-logo-circular.svg"
                    alt="Cervos Pharma"
                    fill
                    className="object-contain p-0.5"
                  />
                </div>
                <span className="text-xs font-bold text-[#0F172A]">
                  {isSw ? "Mwenendo wa Dawa" : "Availability Trends"}
                </span>
              </div>
            </div>

            <svg viewBox="0 0 360 120" className="w-full h-32 overflow-visible">
              <defs>
                <linearGradient id="resFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1039B9" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#1039B9" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M 0 100 C 60 85, 110 40, 175 55 C 235 70, 290 22, 360 15 L 360 120 L 0 120 Z"
                fill="url(#resFill)"
              />
              <path
                d="M 0 100 C 60 85, 110 40, 175 55 C 235 70, 290 22, 360 15"
                fill="none"
                stroke="#1039B9"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d="M 0 110 C 70 102, 130 78, 195 82 C 260 86, 305 56, 360 44"
                fill="none"
                stroke="#10B981"
                strokeWidth="2.5"
                strokeDasharray="5 5"
                strokeLinecap="round"
              />
              <circle cx="175" cy="55" r="5" fill="#1039B9" />
              <circle cx="360" cy="15" r="5" fill="#10B981" />
            </svg>

            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-center text-xs">
              <div>
                <div className="font-bold text-[#0F172A]">98.4%</div>
                <div className="text-[10px] text-slate-500">Safe Stock</div>
              </div>
              <div>
                <div className="font-bold text-[#1039B9]">0.0%</div>
                <div className="text-[10px] text-slate-500">Expired Sold</div>
              </div>
              <div>
                <div className="font-bold text-[#006875]">5 Regions</div>
                <div className="text-[10px] text-slate-500">Coverage</div>
              </div>
            </div>
          </div>
        </div>

        <div className="h-2 shrink-0" />
      </div>
    );
  }

  // 4. Investor: Expansion Matrix + Morph Pop
  if (role === "investor") {
    const bars = [28, 42, 55, 71, 86, 100];
    return (
      <div
        key="stage-investor"
        className={`relative w-full h-full bg-[#F8FAFC] text-[#0F172A] pt-20 pb-6 px-6 sm:pt-24 sm:pb-8 sm:px-10 flex flex-col justify-between overflow-hidden ${isLowEnd ? "" : "animate-stage-pop"
          }`}
      >
        <div className="hidden lg:block relative z-10 max-w-md">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#1039B9] mb-1.5">
            <FlipText
              text={isSw ? "WAWEKEZAJI" : "INVESTORS"}
              flipKey={`${lang}-inv`}
            />
          </div>
          <h2
            className="text-xl sm:text-3xl font-bold tracking-tight leading-snug"
            style={{ fontFamily: "Outfit, Inter, sans-serif" }}
          >
            <FlipText
              text={
                isSw
                  ? "Kukuza huduma za afya kote Afrika Mashariki."
                  : "Backing everyday healthcare across East Africa."
              }
              flipKey={`${lang}-inv`}
            />
          </h2>
        </div>

        <div className="relative flex-1 flex items-end justify-end lg:items-center lg:justify-center my-4 translate-y-16 translate-x-10 opacity-50 lg:translate-y-0 lg:translate-x-0 lg:opacity-100">
          <div className="relative w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="relative w-9 h-9 rounded-full overflow-hidden border border-slate-200">
                  <Image
                    src="/cervos-company-logo-circular.svg"
                    alt="Cervos Pharma"
                    fill
                    className="object-contain p-0.5"
                  />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0F172A]">Cervos Pharma</div>
                  <div className="text-[10px] text-slate-500">
                    {isSw ? "Ukuaji wa Huduma" : "Regional Reach"}
                  </div>
                </div>
              </div>
              <IconLock className="w-4 h-4 text-[#1039B9]" />
            </div>

            <div className="flex items-end justify-between gap-3 h-32 px-2 pb-2 border-b border-slate-100">
              {bars.map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-[#1039B9] to-[#38BDF8]"
                    style={{ height: `${h}%` }}
                  />
                  <span className="text-[9px] font-mono text-slate-400">
                    Q{i + 1}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 text-[11px] text-slate-500">
              <span>{isSw ? "Mikoa" : "Corridors"}</span>
              <span className="font-semibold text-[#1039B9]">
                Dar · Arusha · Mwanza · Dodoma
              </span>
            </div>
          </div>
        </div>

        <div className="h-2 shrink-0" />
      </div>
    );
  }

  // 5. Other Custom Partner + Morph Pop
  return (
    <div
      key="stage-other"
      className={`relative w-full h-full bg-[#F8FAFC] text-[#0F172A] pt-20 pb-6 px-6 sm:pt-24 sm:pb-8 sm:px-10 flex flex-col justify-between overflow-hidden ${isLowEnd ? "" : "animate-stage-pop"
        }`}
    >
      <div className="hidden lg:block relative z-10 max-w-md">
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#1039B9] mb-1.5">
          <FlipText
            text={customRoleLabel?.trim() ? customRoleLabel : isSw ? "USHIRIKA" : "PARTNERS"}
            flipKey={`${lang}-other-${customRoleLabel || ""}`}
          />
        </div>
        <h2
          className="text-xl sm:text-3xl font-bold tracking-tight leading-snug"
          style={{ fontFamily: "Outfit, Inter, sans-serif" }}
        >
          <FlipText
            text={
              isSw
                ? "Karibu kushirikiana na Cervos Pharma."
                : "Tailored access with Cervos Pharma."
            }
            flipKey={`${lang}-other`}
          />
        </h2>
      </div>

      <div className="relative flex-1 flex items-end justify-end lg:items-center lg:justify-center translate-y-16 translate-x-10 opacity-50 lg:translate-y-0 lg:translate-x-0 lg:opacity-100">
        <div className={`${isLowEnd ? "" : "animate-orbit-ring"} relative w-56 h-56 rounded-full border border-dashed border-slate-300 flex items-center justify-center`}>
          <div className={`${isLowEnd ? "" : "animate-orbit-upright"} absolute -top-4 w-8 h-8 rounded-full bg-white shadow border border-slate-200 flex items-center justify-center text-[#1039B9]`}>
            <IconBolt className="w-4 h-4" />
          </div>
          <div className={`${isLowEnd ? "" : "animate-orbit-upright"} absolute -bottom-4 w-8 h-8 rounded-full bg-white shadow border border-slate-200 flex items-center justify-center text-[#006875]`}>
            <IconShield className="w-4 h-4" />
          </div>
        </div>
        <div className="absolute w-22 h-22 rounded-full bg-white shadow-xl border border-slate-200 flex items-center justify-center p-4">
          <div className="relative w-14 h-14">
            <Image
              src="/cervos-company-logo-circular.svg"
              alt="Cervos Pharma"
              fill
              className="object-contain"
            />
          </div>
        </div>
      </div>

      <div className="h-2 shrink-0" />
    </div>
  );
}
