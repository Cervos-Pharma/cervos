export type PlatformBuildId = "pwa" | "windows" | "linux" | "mac";

export function detectClientPlatform(): PlatformBuildId {
  if (typeof navigator === "undefined") return "windows";
  const ua = (navigator.userAgent || "").toLowerCase();
  const plat = (
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ||
    navigator.platform ||
    ""
  ).toLowerCase();

  if (/android|iphone|ipad|ipod/.test(ua)) return "pwa";
  if (plat.includes("mac") || ua.includes("macintosh") || ua.includes("mac os")) return "mac";
  if (plat.includes("linux") || (ua.includes("linux") && !ua.includes("android"))) return "linux";
  return "windows";
}

export function getDownloadBuilds(isSw: boolean) {
  return [
    {
      id: "pwa" as const,
      eyebrow: isSw ? "Simu ya Android (APK)" : "Android Native APK",
      title: "Android APK",
      desc: isSw
        ? "Programu kamili ya Android yenye skana ya kamera, stoo ya FEFO, risiti, vibali na sync ya moja kwa moja."
        : "Full native Android app with camera barcode/QR scanner, FEFO stockroom, receipts, permits & offline sync.",
      cta: isSw ? "Pakua Android APK" : "Download Android APK",
      href: "https://github.com/Cervos-Pharma/cervos/releases/latest",
      featured: true,
    },
    {
      id: "windows" as const,
      eyebrow: "Windows (NSIS)",
      title: "Windows Desktop",
      desc: isSw
        ? "Kisakinishi cha Windows (NSIS .exe) kwa kaunta ya kasi hata mtandao ukikatika na kutoa risiti papo hapo."
        : "Native Windows NSIS installer (.exe) for offline counter checkout, thermal printing & multi-branch sync.",
      cta: isSw ? "Pakua Kwa Windows (.exe)" : "Download Windows Installer",
      href: "https://github.com/Cervos-Pharma/cervos/releases/latest",
      featured: true,
    },
    {
      id: "mac" as const,
      eyebrow: isSw ? "Apple (iPhone / iPad / Mac)" : "Apple Ecosystem (PWA)",
      title: "iOS, iPadOS & macOS",
      desc: isSw
        ? "Kwa sasa tumia Cervos PWA kwenye Safari: bonyeza Share kisha Add to Home Screen au Dock kufanya kazi nje ya mtandao."
        : "Install Cervos directly as a zero-install Web App (PWA) via Safari: Share -> Add to Home Screen or Dock.",
      cta: isSw ? "Weka Apple PWA" : "Install Apple PWA",
      href: "/auth?mode=signin",
      featured: false,
    },
    {
      id: "linux" as const,
      eyebrow: "Linux & Web PWA",
      title: "Linux / Browser PWA",
      desc: isSw
        ? "Utulivu wa hali ya juu kwa vituo vya Ubuntu Linux au kivinjari cha Chromium chenye hifadhi ya ndani."
        : "Steady touchscreen station for Ubuntu Linux or Chromium PWA with full local offline storage.",
      cta: isSw ? "Fungua PWA au Pakua" : "Launch PWA / Linux Build",
      href: "/auth?mode=signin",
      featured: false,
    },
  ];
}
