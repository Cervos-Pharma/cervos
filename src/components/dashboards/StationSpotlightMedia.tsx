"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface StationSpotlightMediaProps {
  brandLogoUrl?: string;
  orgName: string;
  centreName: string;
  profileName?: string;
  address?: string;
  region: string;
  lat?: number;
  lng?: number;
  todaySalesTzs?: number;
  validLotsCount?: number;
  nearExpiryCount?: number;
  escrowHeldTzs?: number;
  accent: string;
  isDark: boolean;
  isSw?: boolean;
}

function tileCoords(lat: number, lng: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const xFloat = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const yFloat = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const tileX = Math.floor(xFloat);
  const tileY = Math.floor(yFloat);
  return {
    tileX,
    tileY,
    offsetX: (xFloat - tileX) * 256,
    offsetY: (yFloat - tileY) * 256,
  };
}

/**
 * Full-bleed edge-to-edge Spotlight visual layer (zero card-inside-card boxes).
 * Greets the operator on launch with a revolving 3D brand coin/crest, then smoothly
 * cross-fades across a real geo-positioned street map and a live operational snapshot.
 */
export default function StationSpotlightMedia({
  brandLogoUrl,
  orgName,
  centreName,
  profileName,
  address,
  region,
  lat = -6.8217,
  lng = 39.2834,
  todaySalesTzs = 0,
  validLotsCount = 0,
  nearExpiryCount = 0,
  escrowHeldTzs = 0,
  accent,
  isDark,
  isSw = false,
}: StationSpotlightMediaProps) {
  const [slide, setSlide] = useState<0 | 1 | 2>(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setSlide((s) => ((s + 1) % 3) as 0 | 1 | 2);
    }, 4600);
    return () => clearInterval(t);
  }, [paused]);

  const zoom = 15;
  const { tileX, tileY, offsetX, offsetY } = tileCoords(lat, lng, zoom);
  const mapTheme = isDark ? "dark_all" : "light_all";
  const tileSize = 256;
  // Center the exact branch lat/lng pixel at 50% / 50% of the 3x3 tile canvas
  const shiftX = tileSize + offsetX;
  const shiftY = tileSize + offsetY;

  const firstName = (profileName || "").split(" ")[0] || orgName;
  const hour = new Date().getHours();
  const greeting = isSw
    ? hour < 12
      ? "Habari za asubuhi"
      : hour < 17
        ? "Habari za mchana"
        : "Habari za jioni"
    : hour < 12
      ? "Good morning"
      : hour < 17
        ? "Good afternoon"
        : "Good evening";

  return (
    <div
      className="absolute inset-0 overflow-hidden select-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* ============================================================ */}
      {/* SLIDE 0: LAUNCH GREETING + REVOLVING 3D ORGANIZATION EMBLEM  */}
      {/* ============================================================ */}
      <div
        className={`absolute inset-0 transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          slide === 0 ? "opacity-100 scale-100" : "opacity-0 scale-105 pointer-events-none"
        }`}
      >
        <Image
          src="/cervos-counter-station.jpg"
          alt=""
          fill
          className="object-cover opacity-30 dark:opacity-20 scale-105"
          priority
        />
        <div
          className="absolute inset-0"
          style={{
            background: isDark
              ? "linear-gradient(180deg, rgba(13,17,26,0.82) 0%, rgba(16,24,38,0.58) 45%, rgba(11,15,23,0.96) 100%)"
              : "linear-gradient(180deg, rgba(226,233,243,0.86) 0%, rgba(235,241,248,0.62) 45%, rgba(214,224,236,0.97) 100%)",
          }}
        />

        <div className="relative z-10 h-full flex flex-col items-center justify-center px-6 pb-16 pt-12 text-center">
          {/* 3D Revolving Crest / Uploaded Brand Logo */}
          <div className="relative flex flex-col items-center" style={{ perspective: "900px" }}>
            <div
              className="relative w-28 h-28 rounded-full flex items-center justify-center animate-hardware-revolve"
              style={{
                transformStyle: "preserve-3d",
                background: isDark
                  ? `radial-gradient(circle at 30% 25%, #263147, #0F1522 70%)`
                  : `radial-gradient(circle at 30% 25%, #FFFFFF, #DDE6F2 74%)`,
                boxShadow: isDark
                  ? `0 22px 46px rgba(0,0,0,0.55), 0 0 0 2px ${accent}55, inset 0 2px 10px rgba(255,255,255,0.18)`
                  : `0 20px 44px rgba(15,23,42,0.14), 0 0 0 2px rgba(255,255,255,0.9), inset 0 -6px 14px rgba(15,23,42,0.08)`,
              }}
            >
              {brandLogoUrl ? (
                <div className="relative w-20 h-20 rounded-full overflow-hidden bg-white shadow-inner">
                  <Image src={brandLogoUrl} alt={orgName} fill className="object-contain p-2" unoptimized />
                </div>
              ) : (
                <svg viewBox="0 0 64 64" className="w-16 h-16" aria-hidden="true">
                  <defs>
                    <linearGradient id="crestCross" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={accent} />
                      <stop offset="100%" stopColor="#38BDF8" />
                    </linearGradient>
                  </defs>
                  <rect x="26" y="12" width="12" height="40" rx="6" fill="url(#crestCross)" />
                  <rect x="12" y="26" width="40" height="12" rx="6" fill="url(#crestCross)" />
                  <circle cx="32" cy="32" r="5" fill="#E2F575" />
                </svg>
              )}
            </div>
            <div
              aria-hidden="true"
              className="mt-3 w-20 h-2.5 rounded-full blur-xs opacity-60"
              style={{ backgroundColor: isDark ? "#000000" : "#64748B" }}
            />
          </div>

          <div className="mt-3 space-y-0.5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-75">
              {greeting}, {firstName}
            </div>
            <div className="text-base font-bold tracking-tight" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
              {centreName}
            </div>
            <div className="text-[11px] opacity-75">{region}</div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* SLIDE 1: FULL-BLEED REAL STATION STREET MAP                  */}
      {/* ============================================================ */}
      <div
        className={`absolute inset-0 transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          slide === 1 ? "opacity-100 scale-100" : "opacity-0 scale-105 pointer-events-none"
        }`}
      >
        {/* Clean offline vector underlay + live Carto tile mosaic centered on branch [lat, lng] */}
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: isDark ? "#0B111B" : "#E8EEF5",
          }}
        >
          <div
            className="absolute left-1/2 top-1/2 grid grid-cols-3"
            style={{
              width: `${tileSize * 3}px`,
              height: `${tileSize * 3}px`,
              transform: `translate(-${shiftX}px, -${shiftY}px)`,
            }}
          >
            {[-1, 0, 1].flatMap((dy) =>
              [-1, 0, 1].map((dx) => (
                <img
                  key={`${dx}_${dy}`}
                  src={`https://a.basemaps.cartocdn.com/${mapTheme}/${zoom}/${tileX + dx}/${tileY + dy}.png`}
                  alt=""
                  width={tileSize}
                  height={tileSize}
                  loading="lazy"
                  onError={(e) => {
                    const el = e.currentTarget;
                    if (!el.dataset.osmFallback) {
                      el.dataset.osmFallback = "1";
                      el.src = `https://tile.openstreetmap.org/${zoom}/${tileX + dx}/${tileY + dy}.png`;
                    }
                  }}
                  className="w-[256px] h-[256px] block opacity-95"
                />
              ))
            )}
          </div>
        </div>

        {/* Protective top & bottom readability scrim */}
        <div
          className="absolute inset-0"
          style={{
            background: isDark
              ? "linear-gradient(180deg, rgba(11,15,23,0.88) 0%, rgba(11,15,23,0.18) 45%, rgba(11,15,23,0.95) 100%)"
              : "linear-gradient(180deg, rgba(240,244,249,0.88) 0%, rgba(240,244,249,0.14) 45%, rgba(226,232,240,0.96) 100%)",
          }}
        />

        {/* Crisp centered station GPS pin */}
        <div className="relative z-10 h-full flex flex-col items-center justify-center pb-12">
          <div className="relative flex items-center justify-center">
            <span
              className="absolute w-14 h-14 rounded-full animate-ping opacity-25"
              style={{ backgroundColor: accent }}
            />
            <span
              className="relative w-10 h-10 rounded-full text-white flex items-center justify-center shadow-xl ring-4 ring-white/85 dark:ring-slate-900/90"
              style={{ backgroundColor: accent }}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" />
              </svg>
            </span>
          </div>
          <div
            className={`mt-2.5 px-3 py-1 rounded-full text-[11px] font-bold shadow-sm backdrop-blur-md ${
              isDark ? "bg-slate-900/85 text-white border border-slate-700" : "bg-white/90 text-[#111317] border border-white"
            }`}
          >
            {address || centreName}
          </div>
          <div className="mt-1 font-mono text-[10px] opacity-75">
            {lat.toFixed(4)}, {lng.toFixed(4)}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* SLIDE 2: LIVE STATION PULSE OVER STOCKROOM PHOTOGRAPHY       */}
      {/* ============================================================ */}
      <div
        className={`absolute inset-0 transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          slide === 2 ? "opacity-100 scale-100" : "opacity-0 scale-105 pointer-events-none"
        }`}
      >
        <Image src="/cervos-people-stockroom.jpg" alt={centreName} fill className="object-cover" />
        <div
          className="absolute inset-0"
          style={{
            background: isDark
              ? "linear-gradient(180deg, rgba(11,15,23,0.82) 0%, rgba(11,15,23,0.45) 45%, rgba(11,15,23,0.96) 100%)"
              : "linear-gradient(180deg, rgba(226,233,243,0.92) 0%, rgba(15,23,42,0.35) 48%, rgba(226,232,240,0.98) 100%)",
          }}
        />
        <div className="relative z-10 h-full flex flex-col justify-center items-center px-6 pb-14 pt-10 text-center">
          <div className="grid grid-cols-3 gap-2 w-full">
            <div
              className={`rounded-2xl px-2.5 py-2.5 backdrop-blur-md border ${
                isDark ? "bg-slate-950/75 border-slate-700/80 text-white" : "bg-white/88 border-white text-[#111317]"
              }`}
            >
              <div className="text-[9px] uppercase tracking-wider opacity-70">{isSw ? "Zamu" : "Takings"}</div>
              <div className="text-xs font-bold tabular-nums mt-0.5">
                TZS {(todaySalesTzs / 1000).toFixed(0)}k
              </div>
            </div>
            <div
              className={`rounded-2xl px-2.5 py-2.5 backdrop-blur-md border ${
                isDark ? "bg-slate-950/75 border-slate-700/80 text-white" : "bg-white/88 border-white text-[#111317]"
              }`}
            >
              <div className="text-[9px] uppercase tracking-wider opacity-70">FEFO Lots</div>
              <div className="text-xs font-bold tabular-nums mt-0.5">
                {validLotsCount} ({nearExpiryCount} &le;30d)
              </div>
            </div>
            <div
              className={`rounded-2xl px-2.5 py-2.5 backdrop-blur-md border ${
                isDark ? "bg-slate-950/75 border-slate-700/80 text-white" : "bg-white/88 border-white text-[#111317]"
              }`}
            >
              <div className="text-[9px] uppercase tracking-wider opacity-70">Kasri</div>
              <div className="text-xs font-bold tabular-nums mt-0.5">
                TZS {(escrowHeldTzs / 1000).toFixed(0)}k
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subtle Interactive Story Progress Bars */}
      <div className="absolute top-12 left-6 right-6 z-20 flex items-center gap-1.5">
        {[0, 1, 2].map((idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setSlide(idx as 0 | 1 | 2)}
            aria-label={`View snapshot ${idx + 1}`}
            className="h-1 flex-1 rounded-full overflow-hidden bg-slate-500/25 cursor-pointer"
          >
            <span
              className="block h-full rounded-full transition-all duration-500"
              style={{
                width: slide === idx ? "100%" : slide > idx ? "100%" : "0%",
                backgroundColor: slide === idx ? accent : "rgba(255,255,255,0.45)",
              }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
