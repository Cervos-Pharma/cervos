"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface PwaLaunchSplashProps {
  lang?: "EN" | "SW";
  isDark?: boolean;
  forceShow?: boolean;
  onDismiss?: () => void;
}

/**
 * Full-viewport animated welcome splash when launching Cervos as an installed
 * standalone PWA (or right after installation completes).
 */
export default function PwaLaunchSplash({
  lang = "EN",
  isDark = false,
  forceShow = false,
  onDismiss,
}: PwaLaunchSplashProps) {
  const [visible, setVisible] = useState(forceShow);
  const [exiting, setExiting] = useState(false);

  const isSw = lang === "SW";

  useEffect(() => {
    if (forceShow) {
      setVisible(true);
      setExiting(false);
      return;
    }
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    const pendingInstall = window.sessionStorage.getItem("cervos-pwa-splash-pending") === "1";
    const alreadyWelcomed = window.sessionStorage.getItem("cervos-pwa-welcomed") === "1";

    if ((standalone && !alreadyWelcomed) || pendingInstall) {
      window.sessionStorage.removeItem("cervos-pwa-splash-pending");
      window.sessionStorage.setItem("cervos-pwa-welcomed", "1");
      setVisible(true);
    }
  }, [forceShow]);

  const closeSplash = () => {
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, 320);
  };

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[70] flex items-center justify-center p-6 transition-all duration-300 ${
        exiting ? "opacity-0 scale-[0.98]" : "opacity-100 scale-100"
      } ${isDark ? "bg-[#0B0F17] text-white" : "bg-[#F8FAFC] text-[#0F172A]"}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: isDark
            ? "radial-gradient(circle at 50% 42%, rgba(16, 57, 185, 0.28), transparent 62%)"
            : "radial-gradient(circle at 50% 42%, rgba(16, 57, 185, 0.12), transparent 60%)",
        }}
      />

      <div className="relative z-10 max-w-sm w-full text-center space-y-6 animate-stage-pop">
        {/* Orbital Revolving Clay Crest */}
        <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
          <div
            className="absolute inset-0 rounded-full animate-orbit-ring"
            style={{
              border: isDark ? "1.5px solid rgba(56, 189, 248, 0.35)" : "1.5px solid rgba(16, 57, 185, 0.24)",
            }}
          >
            <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#1039B9] shadow-md" />
          </div>
          <div
            className="relative w-22 h-22 rounded-full p-2 animate-hardware-revolve"
            style={{
              width: "5.5rem",
              height: "5.5rem",
              background: "#FFFFFF",
              boxShadow: isDark
                ? "0 20px 40px rgba(0, 0, 0, 0.55)"
                : "12px 16px 32px rgba(16, 57, 185, 0.16), -6px -6px 18px rgba(255, 255, 255, 0.9)",
            }}
          >
            <Image
              src="/cervos-company-logo-circular.svg"
              alt="Cervos Pharma"
              fill
              className="object-contain p-1.5"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#1039B9]">
            CERVOS APP &middot; OFFLINE READY
          </div>
          <h2
            className="text-2xl sm:text-3xl font-bold tracking-tight"
            style={{ fontFamily: "Outfit, Inter, sans-serif" }}
          >
            {isSw ? "Karibu, tuanze kazi." : "Welcome, let's get started."}
          </h2>
          <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}>
            {isSw
              ? "Programu yako ya Cervos iko tayari kufanya kazi haraka na kuhifadhi mauzo hata bila mtandao."
              : "Your installed Cervos workspace is ready for fast local dispensing and offline sync."}
          </p>
        </div>

        <button
          type="button"
          onClick={closeSplash}
          className="px-7 py-3 rounded-md bg-[#1039B9] hover:bg-[#0D2E94] text-white text-xs font-bold shadow-md transition-all cursor-pointer"
        >
          {isSw ? "Tuanze Sasa" : "Let's Get Started"} &rarr;
        </button>
      </div>
    </div>
  );
}
