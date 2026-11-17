"use client";

import { useEffect, useState } from "react";

export type WorkspaceTheme = "light" | "dark";

const THEME_STORAGE_KEY = "cervos-ws-theme";

/**
 * Resolves workspace Light/Dark mode: defaults to Light on fresh open so
 * auth/entry surfaces never open unexpectedly black, while honoring any
 * explicit saved user theme toggle in localStorage.
 */
export function useWorkspaceTheme() {
  const [theme, setTheme] = useState<WorkspaceTheme>("light");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === "light" || saved === "dark") {
        setTheme(saved);
      } else {
        setTheme("light");
      }
    } catch {
      setTheme("light");
    }
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
