"use client";

import { useCallback, useEffect, useState } from "react";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const INSTALLED_STORAGE_KEY = "cervos-pwa-installed-at";

/**
 * Tracks browser PWA installability, native desktop/mobile wrapper runtime,
 * standalone launch mode, and triggers the welcome splash after install.
 */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);
  const [deviceKind, setDeviceKind] = useState<"mobile" | "desktop">("desktop");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ua = (window.navigator.userAgent || "").toLowerCase();
    setDeviceKind(/android|iphone|ipad|ipod/.test(ua) ? "mobile" : "desktop");

    const isTauri = Boolean(
      (window as Window & { __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown }).__TAURI__ ||
        (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
    );
    const standalone =
      isTauri ||
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);

    let previouslyInstalled = false;
    try {
      previouslyInstalled = Boolean(window.localStorage.getItem(INSTALLED_STORAGE_KEY));
    } catch {
      /* ignore */
    }

    if (standalone || previouslyInstalled) {
      setIsInstalled(true);
      if (standalone) {
        try {
          window.localStorage.setItem(INSTALLED_STORAGE_KEY, new Date().toISOString());
        } catch {
          /* ignore */
        }
      }
    }

    const nav = window.navigator as Navigator & {
      getInstalledRelatedApps?: () => Promise<Array<{ platform: string }>>;
    };
    if (typeof nav.getInstalledRelatedApps === "function") {
      nav
        .getInstalledRelatedApps()
        .then((apps) => {
          if (Array.isArray(apps) && apps.length > 0) {
            setIsInstalled(true);
            try {
              window.localStorage.setItem(INSTALLED_STORAGE_KEY, new Date().toISOString());
            } catch {
              /* ignore */
            }
          }
        })
        .catch(() => {
          /* ignore unsupported contexts */
        });
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setJustInstalled(true);
      try {
        window.localStorage.setItem(INSTALLED_STORAGE_KEY, new Date().toISOString());
        window.sessionStorage.setItem("cervos-pwa-splash-pending", "1");
      } catch {
        /* ignore */
      }
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const triggerInstall = useCallback(async (): Promise<"installed" | "dismissed" | "manual"> => {
    if (!deferredPrompt) {
      return "manual";
    }
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
        setJustInstalled(true);
        try {
          window.localStorage.setItem(INSTALLED_STORAGE_KEY, new Date().toISOString());
          window.sessionStorage.setItem("cervos-pwa-splash-pending", "1");
        } catch {
          /* ignore */
        }
        return "installed";
      }
      return "dismissed";
    } finally {
      setInstalling(false);
    }
  }, [deferredPrompt]);

  return {
    canPromptNative: Boolean(deferredPrompt),
    isInstalled,
    installing,
    justInstalled,
    deviceKind,
    triggerInstall,
  };
}
