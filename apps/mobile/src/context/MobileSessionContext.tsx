import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import type { AppLang } from "../theme/tokens";
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
  lastSyncedAt: string | null;
  refreshWorkspace: () => Promise<Record<string, unknown> | null>;
  syncNow: () => Promise<{ pushed: number; remaining: number }>;
  signOut: () => Promise<void>;
}

const MobileSessionContext = createContext<MobileSessionContextValue | null>(null);

export function MobileSessionProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const [lang, setLang] = useState<AppLang>("EN");
  const [workspaceState, setWorkspaceState] = useState<Record<string, unknown> | null>(null);
  const [pendingSync, setPendingSync] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

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
    const out = await flushAndSyncOfflineQueue();
    setPendingSync(out.remaining);
    setLastSyncedAt(out.serverTime);
    await refreshWorkspace();
    return { pushed: out.pushed, remaining: out.remaining };
  }, [refreshWorkspace]);

  const signOut = useCallback(async () => {
    await clearAllTokens();
    setWorkspaceState(null);
  }, []);

  useEffect(() => {
    void registerNotificationChannelAndCheck();
    void getPendingQueueCount().then(setPendingSync).catch(() => undefined);
  }, []);

  return (
    <MobileSessionContext.Provider
      value={{
        lang,
        setLang,
        isDark: scheme === "dark",
        workspaceState,
        pendingSync,
        lastSyncedAt,
        refreshWorkspace,
        syncNow,
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
