/**
 * @file components/hq/hqSurface.ts
 * @description Shared Cervos HQ claymorphic & soft neumorphic surface helper tokens
 * plus verified static media paths in `public/`.
 */

export const CERVOS_HQ_ASSETS = {
  companyLogoCircular: "/cervos-company-logo-circular.svg",
  companyLogoCircularDark: "/cervos-company-logo-circular-dark.svg",
  companyLogoTransparent: "/cervos-company-logo-transparent.svg",
  productLogoCircular: "/cervos-product-logo-circular.svg",
  productLogoTransparent: "/cervos-product-logo-transparent.svg",
  hardwareDesktop: "/cervos-hardware-desktop.jpg",
  hardwareTablet: "/cervos-hardware-tablet.jpg",
  hardwarePhone: "/cervos-hardware-phone.jpg",
  peopleCounter: "/cervos-people-counter.jpg",
  peopleStockroom: "/cervos-people-stockroom.jpg",
  peopleDelivery: "/cervos-people-delivery.jpg",
  dispensaryDesk: "/cervos-dispensary-desk.jpg",
  counterStation: "/cervos-counter-station.jpg",
  fleetVan: "/cervos-fleet-van.jpg",
} as const;

export function hqSurfaceTokens(isDark: boolean) {
  return {
    canvasCls: isDark ? "hq-canvas-dark" : "hq-canvas-light",
    panelCls: isDark ? "hq-clay-panel-dark" : "hq-clay-panel-light",
    wellCls: isDark ? "hq-neu-well-dark" : "hq-neu-well-light",
    inputCls: `${
      isDark
        ? "hq-neu-input-dark placeholder:text-slate-500"
        : "hq-neu-input-light placeholder:text-slate-400"
    } focus:outline-none focus:ring-2 focus:ring-[#1039B9]/30`,
    pillCls: isDark ? "hq-clay-pill-dark" : "hq-clay-pill-light",
    primaryBtnCls: isDark ? "hq-clay-btn-dark" : "hq-clay-btn",
    mutedCls: isDark ? "text-slate-400" : "text-slate-600",
    subtleBorderCls: isDark ? "border-white/10" : "border-slate-300/60",
  };
}
