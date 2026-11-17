# Cervos POS — Release Notes

**Version:** 0.3.1  
**Release Date:** 16 October 2026  
**Components:**
- Cervos POS Desktop (Windows x64 Setup: `Cervos POS_0.3.1_x64-setup.exe`)
- Cervos POS Android (ARM64 APK: `cervos-pos-0.3.1-arm64.apk`)
- Cervos Web Platform & Portals (Pharmacy Dashboard, Supplier Portal, HQ Admin Console)

---

## Executive Summary

Release **0.3.1** introduces comprehensive UI/UX responsiveness improvements across desktop, tablet, and mobile displays, updates animations on public web entrypoints, enhances the offline synchronization pipeline, and cleanses all internal server diagnostics from user-facing screens.

---

## What's New & Improved

### 1. Applications & POS Endpoints (`cervos-desktop`)
* **Responsive Layouts for Terminal & Mobile:**
  * Shell and screen layouts adapt seamlessly across desktop monitors (1280px+), POS touch displays (1024px), tablets, and phone screens.
  * Added device safe-area insets (`env(safe-area-inset-top)`) for Android notch/camera cutouts.
* **Full Bilingual Support (English ⇄ Kiswahili):**
  * Complete translations across Login, Dashboard, POS checkout, Inventory, Shifts, Records, Alerts, Reports, and Settings.
  * Persistent device-level language memory.
* **Offline-First Synchronization Engine:**
  * Resilient two-way synchronization for stock, orders, and operational directives.
  * Background auto-sync with batched payload compression.

### 2. Web Portals & Landing Page
* **Visual Polish & Modern Animations:**
  * Ambient radial glow and Ken Burns settle animation (`landing-image-settle`) on the hero section.
  * Micro-interactions on action buttons with smooth `.btn-shimmer` hover light sweeps and `gaming-snap` physical feedback.
  * Interactive First-Expired-First-Out (FEFO) dispensing demo with live urgent expiry indicators.
  * Live status beacon on the national network map showcasing active node synchronization.
* **Screen Size & Mobile Responsiveness:**
  * Replaced fixed viewports with fluid responsive boundaries (`min-h-[100svh] lg:h-screen`).
  * Optimized OS selection controls and app mockup window chrome to prevent text clipping and horizontal scrolling on narrow viewports (320px–390px).
* **Security & Clean User Interface:**
  * Removed internal server error digests (`Error ID: {error.digest}`) from all user-facing error boundaries.
  * Cleared all internal technical database and cookie mentions from administrative overview panels.
  * Purged stale merge reject files and dead code.

---

## Verification & Test Results

* **Authentication & Role Mapping:** Verified live authentication with `user@gmail.com` (`user1234`), confirming active pharmacy tier status, 2 linked operational branches (`branch1`, `branch2`), 20 pharmaceutical inventory batches, and 6 active orders.
* **Static Analysis:** TypeScript compilation clean with 0 errors (`npm run lint`).
* **Unit & Integration Tests:** 4 test suites, 23/23 tests passing (`npm test`).

---

## Release Artifacts

The generated release binaries are available in:
```
c:\Users\user\Desktop\crv\hq-drop\
```

* **Windows Installer:** `Cervos POS_0.3.1_x64-setup.exe` (NSIS Installer, 9.98 MB)
* **Android APK:** `cervos-pos-0.3.1-arm64.apk` (ARM64 Universal, 18.72 MB)

### Upload Instructions (HQ Admin)
1. Go to **HQ Admin Console** (`/hq/downloads`).
2. Select target platform (Windows / Android).
3. Specify version `0.3.1`.
4. Upload the corresponding file from `c:\Users\user\Desktop\crv\hq-drop\`.
5. Click **"Set as current"** to activate the build for all downloading pharmacies.
