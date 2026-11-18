import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clampProfileCapabilities,
  type ProfileCapabilities,
  type WorkspaceProfileRole,
} from "@/utils/permissions";
import {
  fetchWorkspaceState,
  getStoredTokens,
  postWorkspaceAction,
  signOutWorkspace,
} from "@/services/api";
import {
  cacheWorkspaceSnapshot,
  flushAndSyncOfflineQueue,
  getPendingQueueCount,
  loadCachedWorkspaceSnapshot,
  loadStationPrefs,
  registerNotificationChannelAndCheck,
  saveStationPrefs,
  type MobileStationPrefs,
} from "@/services/offline-db";
import { playSoundCue, triggerHaptic } from "@/services/sounds";
import type {
  AppLang,
  BranchChatMessage,
  SavedCustomerPreset,
  WorkspaceBatch,
  WorkspaceCentre,
  WorkspaceExpense,
  WorkspaceSale,
  WorkspaceShiftLog,
  WorkspaceStateResponse,
} from "@/types/workspace";

const AUTO_CLOCK_OUT_IDLE_MS = 4 * 60 * 60 * 1000;

interface SessionContextValue {
  hydrated: boolean;
  isOnline: boolean;
  hasAccountToken: boolean;
  workspace: WorkspaceStateResponse | null;
  isLoading: boolean;
  isFetching: boolean;
  loadError: string | null;
  lang: AppLang;
  canManageAdmin: boolean;
  capabilities: ProfileCapabilities;
  orgScope: "all" | "branch";
  setOrgScope: (scope: "all" | "branch") => void;
  activeCentre: WorkspaceCentre | undefined;
  scopedBatches: WorkspaceBatch[];
  scopedSales: WorkspaceSale[];
  scopedExpenses: WorkspaceExpense[];
  scopedCustomers: SavedCustomerPreset[];
  scopedShifts: WorkspaceShiftLog[];
  scopedMessages: BranchChatMessage[];
  activeShift: WorkspaceShiftLog | undefined;
  autoClockOutNotice: string | null;
  dismissAutoClockOutNotice: () => void;
  pendingSync: number;
  syncing: boolean;
  lastSyncedAt: string | null;
  stationUnlocked: boolean;
  setStationUnlocked: (unlocked: boolean) => void;
  prefs: MobileStationPrefs;
  updatePrefs: (patch: Partial<MobileStationPrefs>) => void;
  pendingScannedCode: string | null;
  setPendingScannedCode: (code: string | null) => void;
  refreshState: () => Promise<WorkspaceStateResponse | null>;
  syncNow: () => Promise<{ pushed: number; remaining: number }>;
  switchCentre: (centreId: string) => Promise<void>;
  toggleLanguage: () => Promise<void>;
  lockProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function MobileSessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [hydrated, setHydrated] = useState(false);
  const [hasAccountToken, setHasAccountToken] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSync, setPendingSync] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [stationUnlocked, setStationUnlocked] = useState(false);
  const [prefs, setPrefs] = useState<MobileStationPrefs>(() => loadStationPrefs());
  const [autoClockOutNotice, setAutoClockOutNotice] = useState<string | null>(null);
  const [pendingScannedCode, setPendingScannedCode] = useState<string | null>(null);
  const syncingRef = useRef(false);
  const autoClockCheckedRef = useRef(false);

  const updatePrefs = useCallback((patch: Partial<MobileStationPrefs>) => {
    const next = saveStationPrefs(patch);
    setPrefs(next);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      await registerNotificationChannelAndCheck();
      const [tokens, pending, cached] = await Promise.all([
        getStoredTokens(),
        getPendingQueueCount(),
        loadCachedWorkspaceSnapshot(),
      ]);
      if (!active) return;
      setHasAccountToken(Boolean(tokens.accountToken));
      setPendingSync(pending);
      if (tokens.accountToken && cached) {
        queryClient.setQueryData(["workspaceState"], cached);
      }
      setHydrated(true);
    })();

    const unsubNet = NetInfo.addEventListener((state) => {
      setIsOnline(Boolean(state.isConnected ?? true));
    });

    return () => {
      active = false;
      unsubNet();
    };
  }, [queryClient]);

  const query = useQuery<WorkspaceStateResponse | null, Error>({
    queryKey: ["workspaceState"],
    enabled: hydrated && hasAccountToken,
    staleTime: 25_000,
    retry: 1,
    queryFn: async () => {
      const tokens = await getStoredTokens();
      if (!tokens.accountToken) {
        setHasAccountToken(false);
        return null;
      }
      const res = await fetchWorkspaceState();
      if (res.status === 401) {
        await signOutWorkspace();
        setHasAccountToken(false);
        return null;
      }
      if (!res.ok) {
        throw new Error(res.data?.error || "Could not refresh workspace");
      }
      await cacheWorkspaceSnapshot(res.data);
      return res.data;
    },
  });

  const refreshState = useCallback(async () => {
    const tokens = await getStoredTokens();
    const hasToken = Boolean(tokens.accountToken);
    setHasAccountToken(hasToken);
    if (!hasToken) {
      queryClient.setQueryData(["workspaceState"], null);
      return null;
    }
    const res = await query.refetch();
    const q = await getPendingQueueCount();
    setPendingSync(q);
    return res.data ?? null;
  }, [query, queryClient]);

  const syncNow = useCallback(async () => {
    if (syncingRef.current) {
      const rem = await getPendingQueueCount();
      return { pushed: 0, remaining: rem };
    }
    syncingRef.current = true;
    setSyncing(true);
    try {
      const out = await flushAndSyncOfflineQueue();
      setPendingSync(out.remaining);
      setLastSyncedAt(out.serverTime);
      await refreshState();
      return { pushed: out.pushed, remaining: out.remaining };
    } catch {
      const rem = await getPendingQueueCount();
      setPendingSync(rem);
      return { pushed: 0, remaining: rem };
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [refreshState]);

  const workspace = query.data ?? null;
  const activeProfile = workspace?.activeProfile ?? null;

  // Background + foreground sync when active profile is unlocked
  useEffect(() => {
    if (!activeProfile) return;
    const timer = setInterval(() => {
      if (isOnline) void syncNow();
    }, 30_000);

    const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active") {
        saveStationPrefs({ lastActiveMs: Date.now() });
        if (isOnline) void syncNow();
      } else if (nextState === "background") {
        saveStationPrefs({ lastActiveMs: Date.now() });
      }
    });

    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [activeProfile, isOnline, syncNow]);

  const lang: AppLang =
    activeProfile?.profilePrefs?.preferredLang === "SW" || workspace?.account?.lang === "SW"
      ? "SW"
      : "EN";

  const canManageAdmin = Boolean(
    activeProfile &&
      (activeProfile.isMasterAdmin ||
        activeProfile.role === "pharmacy_owner" ||
        activeProfile.role === "supplier_admin")
  );

  const capabilities = useMemo(
    () =>
      clampProfileCapabilities(
        (activeProfile?.role || "pos_cashier") as WorkspaceProfileRole,
        activeProfile?.capabilities,
        canManageAdmin
      ),
    [activeProfile?.role, activeProfile?.capabilities, canManageAdmin]
  );

  const orgScope: "all" | "branch" =
    canManageAdmin && prefs.orgScope === "all" ? "all" : "branch";

  const setOrgScope = useCallback(
    (scope: "all" | "branch") => {
      updatePrefs({ orgScope: scope });
      void playSoundCue("switch");
      void triggerHaptic("selection");
    },
    [updatePrefs]
  );

  const centres = workspace?.centres ?? [];
  const activeCentre = useMemo(
    () =>
      centres.find((c) => c.id === (workspace?.activeCentreId || activeProfile?.centreId)) ??
      centres[0],
    [centres, workspace?.activeCentreId, activeProfile?.centreId]
  );

  const activeCentreId = activeCentre?.id;

  const scopeMatches = useCallback(
    (cid?: string) => orgScope === "all" || !activeCentreId || !cid || cid === activeCentreId,
    [orgScope, activeCentreId]
  );

  const scopedBatches = useMemo(
    () => (workspace?.batches ?? []).filter((b) => scopeMatches(b.centreId)),
    [workspace?.batches, scopeMatches]
  );

  const scopedSales = useMemo(
    () => (workspace?.sales ?? []).filter((s) => scopeMatches(s.centreId)),
    [workspace?.sales, scopeMatches]
  );

  const scopedExpenses = useMemo(
    () => (workspace?.expenses ?? []).filter((e) => scopeMatches(e.centreId)),
    [workspace?.expenses, scopeMatches]
  );

  const scopedCustomers = useMemo(
    () => (workspace?.savedCustomers ?? []).filter((c) => scopeMatches(c.centreId)),
    [workspace?.savedCustomers, scopeMatches]
  );

  const scopedShifts = useMemo(
    () => (workspace?.shiftLogs ?? []).filter((s) => scopeMatches(s.centreId)),
    [workspace?.shiftLogs, scopeMatches]
  );

  const scopedMessages = useMemo(
    () =>
      (workspace?.branchMessages ?? []).filter(
        (m) => !activeCentreId || m.centreId === activeCentreId
      ),
    [workspace?.branchMessages, activeCentreId]
  );

  const activeShift = useMemo(
    () =>
      (workspace?.shiftLogs ?? []).find(
        (s) => s.profileId === activeProfile?.id && !s.clockOutAt
      ),
    [workspace?.shiftLogs, activeProfile?.id]
  );

  // Automatic shift clock-out if away from app for >= 4 hours
  useEffect(() => {
    if (autoClockCheckedRef.current || !activeProfile?.id) return;
    autoClockCheckedRef.current = true;
    const elapsed = Date.now() - prefs.lastActiveMs;
    if (activeShift && elapsed >= AUTO_CLOCK_OUT_IDLE_MS) {
      void postWorkspaceAction({ action: "shift_clock", clockType: "out" }).then((r) => {
        if (r.ok) {
          setAutoClockOutNotice(
            lang === "SW"
              ? "Zamu yako ilifungwa kiotomatiki baada ya kuwa nje ya programu kwa muda mrefu."
              : "Your previous shift was clocked out automatically after being away over 4 hours."
          );
          void playSoundCue("notify");
          void refreshState();
        }
      });
    }
    saveStationPrefs({ lastActiveMs: Date.now() });
  }, [activeProfile?.id, activeShift, prefs.lastActiveMs, lang, refreshState]);

  const switchCentre = useCallback(
    async (centreId: string) => {
      await postWorkspaceAction({ action: "switch_centre", centreId });
      updatePrefs({ orgScope: "branch" });
      await playSoundCue("switch");
      await triggerHaptic("selection");
      await refreshState();
    },
    [refreshState, updatePrefs]
  );

  const toggleLanguage = useCallback(async () => {
    const nextLang: AppLang = lang === "SW" ? "EN" : "SW";
    await postWorkspaceAction({ action: "update_lang", lang: nextLang });
    await triggerHaptic("selection");
    await refreshState();
  }, [lang, refreshState]);

  const lockProfile = useCallback(async () => {
    setStationUnlocked(false);
    const { postGateAction, saveTokens } = await import("@/services/api");
    await postGateAction({ action: "lock_profile" }).catch(() => undefined);
    await saveTokens({ profileToken: null });
    await refreshState();
  }, [refreshState]);

  const signOut = useCallback(async () => {
    setStationUnlocked(false);
    await signOutWorkspace();
    setHasAccountToken(false);
    queryClient.setQueryData(["workspaceState"], null);
  }, [queryClient]);

  return (
    <SessionContext.Provider
      value={{
        hydrated,
        isOnline,
        hasAccountToken,
        workspace,
        isLoading: query.isLoading,
        isFetching: query.isFetching,
        loadError: query.error ? query.error.message : null,
        lang,
        canManageAdmin,
        capabilities,
        orgScope,
        setOrgScope,
        activeCentre,
        scopedBatches,
        scopedSales,
        scopedExpenses,
        scopedCustomers,
        scopedShifts,
        scopedMessages,
        activeShift,
        autoClockOutNotice,
        dismissAutoClockOutNotice: () => setAutoClockOutNotice(null),
        pendingSync,
        syncing,
        lastSyncedAt,
        stationUnlocked,
        setStationUnlocked,
        prefs,
        updatePrefs,
        pendingScannedCode,
        setPendingScannedCode,
        refreshState,
        syncNow,
        switchCentre,
        toggleLanguage,
        lockProfile,
        signOut,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useMobileSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useMobileSession must be used inside MobileSessionProvider");
  return ctx;
}
