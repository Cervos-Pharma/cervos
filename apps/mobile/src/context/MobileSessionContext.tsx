import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus, useColorScheme } from "react-native";
import type { AppLang } from "../theme/tokens";
import { CERVOS_COLORS } from "../theme/tokens";
import { clearAllTokens, fetchWorkspaceState, getStoredTokens } from "../services/api";
import {
  flushAndSyncOfflineQueue,
  getPendingQueueCount,
  registerNotificationChannelAndCheck,
} from "../services/offlineSync";

interface MobileSessionContextValue {
  lang: AppLang;
  setLang: (lang: AppLang) => void;
  isDark: boolean;
  workspaceState: Record<string, unknown> | null;
  pendingSync: number;
  syncing: boolean;
  lastSyncedAt: string | null;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  brandAccent: string;
  fontMultiplier: number;
  refreshWorkspace: () => Promise<Record<string, unknown> | null>;
  syncNow: () => Promise<{ pushed: number; remaining: number }>;
  schedulePromptSync: () => void;
  signOut: () => Promise<void>;
}

const MobileSessionContext = createContext<MobileSessionContextValue | null>(null);

export function MobileSessionProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const [lang, setLang] = useState<AppLang>("EN");
  const [workspaceState, setWorkspaceState] = useState<Record<string, unknown> | null>(null);
  const [pendingSync, setPendingSync] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const syncingRef = useRef(false);
  const promptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshWorkspace = useCallback(async () => {
    const tokens = await getStoredTokens();
    if (!tokens.accountToken) {
      setWorkspaceState(null);
      return null;
    }
    const res = await fetchWorkspaceState();
    if (res.ok && res.data) {
      setWorkspaceState(res.data);
      const acct = res.data.account as { lang?: AppLang } | undefined;
      if (acct?.lang === "EN" || acct?.lang === "SW") setLang(acct.lang);
      const q = await getPendingQueueCount();
      setPendingSync(q);
      return res.data;
    }
    return null;
  }, []);

  const syncNow = useCallback(async () => {
    if (syncingRef.current) {
      const remaining = await getPendingQueueCount();
      return { pushed: 0, remaining };
    }
    syncingRef.current = true;
    setSyncing(true);
    try {
      const out = await flushAndSyncOfflineQueue();
      setPendingSync(out.remaining);
      setLastSyncedAt(out.serverTime);
      await refreshWorkspace();
      return { pushed: out.pushed, remaining: out.remaining };
    } catch {
      const remaining = await getPendingQueueCount();
      setPendingSync(remaining);
      return { pushed: 0, remaining };
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [refreshWorkspace]);

  const schedulePromptSync = useCallback(() => {
    void getPendingQueueCount().then(setPendingSync).catch(() => undefined);
    if (promptTimerRef.current) clearTimeout(promptTimerRef.current);
    promptTimerRef.current = setTimeout(() => {
      promptTimerRef.current = null;
      void syncNow();
    }, 2500);
  }, [syncNow]);

  const signOut = useCallback(async () => {
    await clearAllTokens();
    setWorkspaceState(null);
  }, []);

  useEffect(() => {
    void registerNotificationChannelAndCheck();
    void getPendingQueueCount().then(setPendingSync).catch(() => undefined);
  }, []);

  // Automatic background & foreground resume sync whenever signed into a workspace profile
  const hasProfile = Boolean(workspaceState?.activeProfile);
  useEffect(() => {
    if (!hasProfile) return;

    const timer = setInterval(() => {
      void syncNow();
    }, 25000);

    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        void syncNow();
      }
    };
    const sub = AppState.addEventListener("change", handleAppState);

    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [hasProfile, syncNow]);

  const accountObj = workspaceState?.account as
    | { customization?: { brandAccent?: string; fontScale?: string; themePref?: string } }
    | undefined;
  const profileObj = workspaceState?.activeProfile as
    | { profilePrefs?: { fontScale?: string } }
    | undefined;

  const brandAccent = accountObj?.customization?.brandAccent || CERVOS_COLORS.cobalt;
  const scalePref = profileObj?.profilePrefs?.fontScale || accountObj?.customization?.fontScale || "standard";
  const fontMultiplier = scalePref === "compact" ? 0.9 : scalePref === "large" ? 1.14 : 1;
  const themePref = accountObj?.customization?.themePref;
  const isDark = themePref === "dark" ? true : themePref === "light" ? false : scheme === "dark";

  return (
    <MobileSessionContext.Provider
      value={{
        lang,
        setLang,
        isDark,
        workspaceState,
        pendingSync,
        syncing,
        lastSyncedAt,
        searchQuery,
        setSearchQuery,
        brandAccent,
        fontMultiplier,
        refreshWorkspace,
        syncNow,
        schedulePromptSync,
        signOut,
      }}
    >
      {children}
    </MobileSessionContext.Provider>
  );
}

export function useMobileSession() {
  const ctx = useContext(MobileSessionContext);
  if (!ctx) throw new Error("useMobileSession must be used inside MobileSessionProvider");
  return ctx;
}
