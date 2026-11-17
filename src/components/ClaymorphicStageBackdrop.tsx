"use client";

import Image from "next/image";

interface ClaymorphicStageBackdropProps {
  isDark?: boolean;
}

/**
 * Architectural 3D claymorphic background featuring gently orbiting soft spheres
 * and a revolving circular Cervos Pharma crest tailored for Light or Dark mode.
 */
export default function ClaymorphicStageBackdrop({ isDark = false }: ClaymorphicStageBackdropProps) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden z-0">
      {/* Base Ambient Atmospheric Wash */}
      <div
        className="absolute inset-0 transition-colors duration-500"
        style={{
          background: isDark
            ? "radial-gradient(circle at 22% 18%, rgba(16, 57, 185, 0.22), transparent 52%), radial-gradient(circle at 82% 76%, rgba(14, 116, 144, 0.16), transparent 55%)"
            : "radial-gradient(circle at 18% 20%, rgba(16, 57, 185, 0.08), transparent 50%), radial-gradient(circle at 84% 78%, rgba(0, 104, 117, 0.07), transparent 55%)",
        }}
      />

      {/* Fine Architectural Dot Field */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: isDark
            ? "radial-gradient(rgba(148, 163, 184, 0.14) 1px, transparent 1px)"
            : "radial-gradient(rgba(15, 23, 42, 0.08) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Claymorphic Orbital System & Revolving Emblem */}
      <div className="absolute -right-24 -top-24 sm:right-[-6%] sm:top-[6%] w-[440px] h-[440px] sm:w-[600px] sm:h-[600px] opacity-85">
        {/* Outer Revolving Clay Ring */}
        <div
          className="absolute inset-6 rounded-full animate-orbit-ring"
          style={{
            border: isDark ? "1px solid rgba(56, 189, 248, 0.16)" : "1px solid rgba(16, 57, 185, 0.12)",
            boxShadow: isDark
              ? "inset 0 0 40px rgba(16, 57, 185, 0.12)"
              : "inset 0 0 40px rgba(255, 255, 255, 0.8)",
          }}
        >
          {/* Orbiting Clay Node 1 */}
          <div
            className="absolute -top-4 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full"
            style={{
              background: isDark
                ? "radial-gradient(circle at 32% 28%, #60A5FA, #1039B9 70%, #091E63 100%)"
                : "radial-gradient(circle at 32% 28%, #DBEAFE, #60A5FA 58%, #1039B9 100%)",
              boxShadow: isDark
                ? "0 14px 28px -6px rgba(16, 57, 185, 0.55), inset 0 2px 4px rgba(255,255,255,0.45)"
                : "0 14px 26px -6px rgba(16, 57, 185, 0.25), inset 0 3px 6px rgba(255,255,255,0.85)",
            }}
          />
        </div>

        {/* Counter-Revolving Inner Tilted Ring */}
        <div
          className="absolute inset-20 sm:inset-24 rounded-full animate-orbit-ring-reverse"
          style={{
            border: isDark ? "1px dashed rgba(148, 163, 184, 0.2)" : "1px dashed rgba(100, 116, 139, 0.2)",
          }}
        >
          {/* Orbiting Clay Teal Capsule */}
          <div
            className="absolute bottom-4 right-8 w-7 h-7 rounded-full"
            style={{
              background: isDark
                ? "radial-gradient(circle at 35% 30%, #5EEAD4, #006875 72%, #042F2E 100%)"
                : "radial-gradient(circle at 35% 30%, #CCFBF1, #2DD4BF 62%, #006875 100%)",
              boxShadow: isDark
                ? "0 12px 24px -4px rgba(0, 104, 117, 0.45), inset 0 2px 4px rgba(255,255,255,0.4)"
                : "0 12px 22px -4px rgba(0, 104, 117, 0.22), inset 0 2px 5px rgba(255,255,255,0.9)",
            }}
          />
        </div>

        {/* Center Sculpted Claymorphic Medallion with Gently Revolving Cervos Logo */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-44 h-44 sm:w-56 sm:h-56 rounded-full flex items-center justify-center animate-hardware-revolve"
            style={{
              background: isDark
                ? "radial-gradient(circle at 30% 25%, #1E293B, #0F172A 68%, #020617 100%)"
                : "radial-gradient(circle at 30% 25%, #FFFFFF, #EFF6FF 65%, #DBEAFE 100%)",
              boxShadow: isDark
                ? "20px 28px 60px rgba(0, 0, 0, 0.55), -10px -10px 30px rgba(56, 189, 248, 0.08), inset 0 4px 12px rgba(255, 255, 255, 0.08)"
                : "22px 28px 54px rgba(15, 23, 42, 0.1), -12px -12px 32px rgba(255, 255, 255, 0.95), inset 0 6px 16px rgba(255, 255, 255, 0.95)",
              border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0.9)",
            }}
          >
            <div
              className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full p-2"
              style={{
                background: isDark ? "rgba(255,255,255,0.96)" : "#FFFFFF",
                boxShadow: isDark
                  ? "0 10px 25px rgba(0,0,0,0.4)"
                  : "8px 10px 24px rgba(16, 57, 185, 0.14), inset 0 2px 6px rgba(255,255,255,0.9)",
              }}
            >
              <Image
                src="/cervos-company-logo-circular.svg"
                alt=""
                fill
                className="object-contain p-1.5"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Counter-balanced Sculpted Clay Orb Bottom-Left */}
      <div
        className="hidden sm:block absolute -left-16 bottom-12 w-56 h-56 rounded-full animate-float-gentle opacity-80"
        style={{
          background: isDark
            ? "radial-gradient(circle at 35% 30%, #1E293B, #0F172A 72%, #020617 100%)"
            : "radial-gradient(circle at 35% 30%, #FFFFFF, #F1F5F9 68%, #E2E8F0 100%)",
          boxShadow: isDark
            ? "16px 24px 48px rgba(0,0,0,0.5), inset 0 4px 10px rgba(255,255,255,0.06)"
            : "18px 24px 44px rgba(15,23,42,0.08), -8px -8px 24px rgba(255,255,255,0.95), inset 0 4px 12px rgba(255,255,255,0.95)",
        }}
      />
    </div>
  );
}
