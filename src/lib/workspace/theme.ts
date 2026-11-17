"use client";

import { useEffect, useState } from "react";

export type WorkspaceTheme = "light" | "dark";

const THEME_STORAGE_KEY = "cervos-ws-theme";

/**
 * Resolves workspace Light/Dark mode: explicit saved user choice takes priority,
 * otherwise tracks OS system preference (`prefers-color-scheme`) defaulting to Light.
 */
export function useWorkspaceTheme() {
  const [theme, setTheme] = useState<WorkspaceTheme>("light");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === "light" || saved === "dark") {
        setTheme(saved);
        return;
      }
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        setTheme("dark");
      } else {
        setTheme("light");
      }
    } catch {
      setTheme("light");
    }

    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const handleChange = (e: MediaQueryListEvent) => {
      try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        if (!saved) {
          setTheme(e.matches ? "dark" : "light");
        }
      } catch {
        // Ignore storage restrictions
      }
    };
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  const toggleTheme = () => {
    const next: WorkspaceTheme = theme === "light" ? "dark" : "light";
    setTheme(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Ignore storage restrictions
    }
  };

  return { theme, setTheme, toggleTheme, isDark: theme === "dark" };
}
