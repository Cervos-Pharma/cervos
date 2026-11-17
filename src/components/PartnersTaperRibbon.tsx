"use client";

import { useEffect, useRef, useState } from "react";
import FlipText from "@/components/FlipText";
import { useIsLowEndDevice } from "@/lib/useDeviceTier";

export interface PartnerDef {
  id: string;
  name: string;
  roleEn: string;
  roleSw: string;
  mark: React.ReactNode;
}

export const CERVOS_PARTNERS: PartnerDef[] = [
  {
    id: "kasri",
    name: "Kasri\u2122",
    roleEn: "Protected Clearing",
    roleSw: "Malipo Salama",
    mark: (
      <svg viewBox="0 0 36 36" className="w-8 h-8" fill="none">
        <rect x="3" y="3" width="30" height="30" rx="8" stroke="currentColor" strokeWidth="2" />
        <path d="M11 18.5L15.5 23L25 13.5" stroke="#1039B9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "keko",
    name: "Keko Wholesale",
    roleEn: "Licensed Supply Hub",
    roleSw: "Msambazaji Mkuu",
    mark: (
      <svg viewBox="0 0 36 36" className="w-8 h-8" fill="none">
        <polygon points="18,4 30,11 30,25 18,32 6,25 6,11" stroke="currentColor" strokeWidth="2" />
        <circle cx="18" cy="18" r="5" fill="#006875" />
      </svg>
    ),
  },
  {
    id: "zanzibar-med",
    name: "Zanzibar MedSupply",
    roleEn: "Island Cold-Chain",
    roleSw: "Usafiri wa Baridi",
    mark: (
      <svg viewBox="0 0 36 36" className="w-8 h-8" fill="none">
        <circle cx="18" cy="18" r="13" stroke="currentColor" strokeWidth="2" />
        <path d="M10 20C14 14 22 22 26 16" stroke="#00542C" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "kilimanjaro-freight",
    name: "Kilimanjaro Freight",
    roleEn: "Northern Dispatch",
    roleSw: "Msafirishaji Kaskazini",
    mark: (
      <svg viewBox="0 0 36 36" className="w-8 h-8" fill="none">
        <path d="M5 26L14 11L20 19L24 14L31 26H5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="25" cy="9" r="2.5" fill="#1039B9" />
      </svg>
    ),
  },
  {
    id: "dar-labs",
    name: "Dar Clinical Labs",
    roleEn: "Reference Diagnostics",
    roleSw: "Maabara ya Rufaa",
    mark: (
      <svg viewBox="0 0 36 36" className="w-8 h-8" fill="none">
        <path d="M18 6V30M6 18H30" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <rect x="13" y="13" width="10" height="10" rx="2" fill="#006875" fillOpacity="0.18" stroke="#006875" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    id: "mwanza-hub",
    name: "Mwanza Pharma Hub",
    roleEn: "Lake Zone Reserve",
    roleSw: "Ghala la Ziwa",
    mark: (
      <svg viewBox="0 0 36 36" className="w-8 h-8" fill="none">
        <rect x="6" y="8" width="24" height="20" rx="4" stroke="currentColor" strokeWidth="2" />
        <path d="M6 18H30M18 8V28" stroke="#00542C" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    id: "dodoma-stores",
    name: "Dodoma Corridor",
    roleEn: "Central Distribution",
    roleSw: "Usambazaji Kati",
    mark: (
      <svg viewBox="0 0 36 36" className="w-8 h-8" fill="none">
        <circle cx="12" cy="18" r="5" stroke="currentColor" strokeWidth="2" />
        <circle cx="24" cy="18" r="5" stroke="#1039B9" strokeWidth="2" />
        <path d="M17 18H19" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: "arusha-guild",
    name: "Arusha Guild",
    roleEn: "Dispensary Network",
    roleSw: "Mtandao wa Maduka",
    mark: (
      <svg viewBox="0 0 36 36" className="w-8 h-8" fill="none">
        <path d="M18 5L29 10V18C29 24.5 24 29 18 31C12 29 7 24.5 7 18V10L18 5Z" stroke="currentColor" strokeWidth="2" />
        <circle cx="18" cy="17" r="3.5" fill="#006875" />
      </svg>
    ),
  },
];

const RIBBON_ITEMS = [...CERVOS_PARTNERS, ...CERVOS_PARTNERS];
const CARD_WIDTH = 236;
const CARD_GAP = 24;
const STEP_PX = CARD_WIDTH + CARD_GAP;
const LOOP_PX = CERVOS_PARTNERS.length * STEP_PX;

interface Props {
  lang: string;
  isSw: boolean;
}

export default function PartnersTaperRibbon({ lang, isSw }: Props) {
  const isLowEnd = useIsLowEndDevice();
  const stageRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const hoveredRef = useRef(false);
  const speedRef = useRef(64);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || isLowEnd) return;

    let frameId = 0;
    let offsetPx = 0;
    let lastTs = performance.now();

    const animate = (now: number) => {
      const dt = Math.min(40, Math.max(0, now - lastTs)) / 1000;
      lastTs = now;

      // Smooth velocity lerp for snappy yet liquid deceleration on hover
      const targetSpeed = hoveredRef.current ? 14 : 66;
      speedRef.current += (targetSpeed - speedRef.current) * Math.min(1, dt * 8);
      offsetPx = (offsetPx + dt * speedRef.current) % LOOP_PX;

      const stage = stageRef.current;
      if (stage) {
        const width = stage.clientWidth || 1024;
        const center = width / 2;
        const halfSpan = Math.max(260, width * 0.48);

        for (let i = 0; i < RIBBON_ITEMS.length; i++) {
          const el = itemRefs.current[i];
          if (!el) continue;

          let x = ((i * STEP_PX - offsetPx) % LOOP_PX + LOOP_PX) % LOOP_PX;
          if (x > LOOP_PX - STEP_PX * 2) {
            x -= LOOP_PX;
          }

          const cardCenter = x + CARD_WIDTH / 2;
          const d = (cardCenter - center) / halfSpan;

          // Clean, snappy optical taper curve (no background lines)
          const focus = Math.exp(-1.15 * d * d);
          const scale = 0.8 + 0.25 * focus;
          const arcY = (1 - focus) * 10;
          const rotY = Math.max(-14, Math.min(14, -d * 11));
          const opacity = Math.max(0.42, 0.42 + 0.58 * focus);

          el.style.transform = `translate3d(${x.toFixed(2)}px, ${arcY.toFixed(2)}px, 0) scale(${scale.toFixed(3)}) perspective(950px) rotateY(${rotY.toFixed(2)}deg)`;
          el.style.opacity = opacity.toFixed(3);
          el.style.zIndex = String(Math.round(10 + focus * 20));
        }
      }

      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [mounted, isLowEnd]);

  return (
    <section
      id="partners"
      className="py-16 sm:py-20 bg-[#F8FAFC] border-t border-b border-[#E2E8F0] overflow-hidden"
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-6 mb-10 text-center">
        <div className="text-[11px] font-bold tracking-[0.22em] uppercase text-[#006875] mb-2">
          <FlipText text={isSw ? "WADAU WETU" : "OUR PARTNERS"} flipKey={lang} />
        </div>
        <h2
          className="text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight"
          style={{ fontFamily: "Outfit, Inter, sans-serif" }}
        >
          <FlipText
            text={isSw ? "Tunafanya kazi na wadau wa kuaminika" : "Trusted across the medicine supply chain"}
            flipKey={lang}
            mode="words"
          />
        </h2>
      </div>

      {!mounted || isLowEnd ? (
        <div className="max-w-6xl mx-auto px-5 sm:px-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {CERVOS_PARTNERS.map((partner) => (
            <div
              key={partner.id}
              className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-4 flex items-center gap-3 shadow-xs"
            >
              <div className="text-[#0F172A] shrink-0">{partner.mark}</div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#0F172A] truncate">{partner.name}</div>
                <div className="text-[10px] font-semibold text-[#006875] truncate mt-0.5">
                  {isSw ? partner.roleSw : partner.roleEn}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          ref={stageRef}
          onMouseEnter={() => {
            hoveredRef.current = true;
          }}
          onMouseLeave={() => {
            hoveredRef.current = false;
          }}
          className="relative max-w-[1380px] mx-auto h-[112px] select-none"
          style={{
            maskImage: "linear-gradient(90deg, transparent 0%, black 10%, black 90%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(90deg, transparent 0%, black 10%, black 90%, transparent 100%)",
          }}
        >
          {RIBBON_ITEMS.map((partner, idx) => (
            <div
              key={`${partner.id}-${idx}`}
              ref={(node) => {
                itemRefs.current[idx] = node;
              }}
              style={{ width: `${CARD_WIDTH}px`, willChange: "transform, opacity" }}
              className="absolute left-0 top-3 rounded-xl border border-[#CBD5E1] bg-white px-4 py-3.5 shadow-sm hover:border-[#1039B9]/55 transition-colors cursor-default"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#0F172A] shrink-0">
                  {partner.mark}
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-[13px] font-bold text-[#0F172A] truncate">
                    {partner.name}
                  </div>
                  <div className="text-[11px] font-semibold tracking-wide text-[#006875] truncate mt-0.5">
                    {isSw ? partner.roleSw : partner.roleEn}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
