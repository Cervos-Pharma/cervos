"use client";

import { useCallback, useEffect, useState } from "react";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

/**
 * Tracks browser PWA installability, standalone launch mode, and triggers
 * the celebratory PWA welcome reveal immediately after installation or cold launch.
 */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    if (standalone) {
      setIsInstalled(true);
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
        window.sessionStorage.setItem("cervos-pwa-splash-pending", "1");
      } catch {
        // Ignore
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
          window.sessionStorage.setItem("cervos-pwa-splash-pending", "1");
        } catch {
          // Ignore
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
    triggerInstall,
  };
}
