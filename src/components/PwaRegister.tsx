"use client";

/**
 * @file src/components/PwaRegister.tsx
 * @description Registers the service worker and handles two iOS-specific gaps:
 *
 * 1. **Service worker registration.** Only in production — a worker in dev
 *    would cache the dev server's output and make hot reload confusing.
 * 2. **Install guidance on iOS.** Safari fires no `beforeinstallprompt` event,
 *    so there is nothing to hook for an automatic install button. iPhone users
 *    have to be told to use Share → Add to Home Screen, which is why this hint
 *    exists at all.
 *
 * Rendered once from the root layout.
 */
import { useEffect, useState } from "react";

/** True when running as an installed home-screen app (iOS and Android). */
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone =
    "standalone" in window.navigator && (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia("(display-mode: standalone)").matches;
}

function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  // iPadOS 13+ reports a desktop UA, so also probe touch + maxTouchPoints.
  const ua = window.navigator.userAgent;
  const iPhoneOrPod = /iPhone|iPod/.test(ua);
  const iPad = /iPad/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return iPhoneOrPod || iPad;
}

export default function PwaRegister() {
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | undefined;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        registration = reg;

        // A previously-installed worker may already be waiting to take over
        // (e.g. the tab was opened before a deploy).
        if (reg.waiting && navigator.serviceWorker.controller) setUpdateReady(true);

        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            // "installed" + an existing controller means this is an update,
            // not the very first install.
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateReady(true);
            }
          });
        });
      })
      .catch((err) => {
        // Registration failing must never break the app — it only costs the
        // offline/install features, so log and move on.
        console.warn("[pwa] service worker registration failed:", err);
      });

    // Fires when the new worker calls clients.claim(). At that point the page
    // may be running assets from the previous build, so offer a reload rather
    // than silently swapping the runtime under the user.
    const onControllerChange = () => setUpdateReady(true);
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    // iOS only: show the Add-to-Home-Screen hint once per session, and only
    // when the app is genuinely not already installed.
    if (isIOS() && !isStandalone()) {
      const dismissed = window.sessionStorage.getItem("cervos-ios-hint-dismissed");
      if (!dismissed) setShowIOSHint(true);
    }

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      registration?.update?.();
    };
  }, []);

  if (!updateReady && !showIOSHint) return null;

  return (
    <>
      {updateReady && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-4 z-[60] mx-auto flex w-[min(92vw,26rem)] items-center gap-3 rounded-xl border border-outline-variant bg-surface-base px-4 py-3 shadow-lg"
        >
          <span className="material-symbols-outlined text-primary" aria-hidden="true">
            system_update
          </span>
          <p className="flex-1 text-sm text-on-surface">A new version of Cervos is ready.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Reload
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setUpdateReady(false)}
            className="rounded-lg p-1.5 text-on-surface-variant hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-lg" aria-hidden="true">
              close
            </span>
          </button>
        </div>
      )}

      {showIOSHint && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-4 z-[60] mx-auto flex w-[min(92vw,26rem)] items-start gap-3 rounded-xl border border-outline-variant bg-surface-base px-4 py-3 shadow-lg"
        >
          <span className="material-symbols-outlined text-primary" aria-hidden="true">
            add_to_home_screen
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-on-surface">Install Cervos on your iPhone</p>
            <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
              Tap the <strong>Share</strong> button in Safari, then choose{" "}
              <strong>Add to Home Screen</strong>. It opens full-screen and works offline.
            </p>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              window.sessionStorage.setItem("cervos-ios-hint-dismissed", "1");
              setShowIOSHint(false);
            }}
            className="rounded-lg p-1.5 text-on-surface-variant hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-lg" aria-hidden="true">
              close
            </span>
          </button>
        </div>
      )}
    </>
  );
}
