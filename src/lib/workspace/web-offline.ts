"use client";

import {
  applyOfflineMutationToSnapshot,
  createOfflinePinVerifier,
  verifyOfflinePinRecord,
  type OfflineMutationEnvelope,
  type OfflineMutationType,
  type OfflineSnapshotPatchable,
} from "@cervos/core";

export const WEB_OFFLINE_SNAPSHOT_KEY = "cervos_web_offline_snapshot_v1";
export const WEB_OFFLINE_QUEUE_KEY = "cervos_web_offline_queue_v1";
export const WEB_OFFLINE_PIN_PREFIX = "cervos_web_off_pin_v1_";
export const WEB_OFFLINE_EVENT = "cervos-web-offline-updated";

export function saveWebOfflinePin(profileId: string, pin: string): void {
  if (typeof window === "undefined" || !profileId || pin.trim().length < 4) return;
  try {
    window.localStorage.setItem(
      `${WEB_OFFLINE_PIN_PREFIX}${profileId}`,
      createOfflinePinVerifier(profileId, pin)
    );
  } catch {
    // Ignore storage quota failure
  }
}

export function verifyWebOfflinePin(profileId: string, pin: string): boolean {
  if (typeof window === "undefined" || !profileId || pin.trim().length < 4) return false;
  try {
    const rec = window.localStorage.getItem(`${WEB_OFFLINE_PIN_PREFIX}${profileId}`);
    return verifyOfflinePinRecord(rec, profileId, pin);
  } catch {
    return false;
  }
}

export function loadWebOfflineSnapshot<T>(): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(WEB_OFFLINE_SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveWebOfflineSnapshot(snapshot: unknown): void {
  if (typeof window === "undefined" || !snapshot) return;
  try {
    window.localStorage.setItem(WEB_OFFLINE_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage quota failure
  }
}

export function getWebOfflineQueue(): OfflineMutationEnvelope[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(WEB_OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OfflineMutationEnvelope[]) : [];
  } catch {
    return [];
  }
}

export function enqueueWebOfflineMutation<T extends OfflineSnapshotPatchable>(
  currentSnapshot: T | null,
  type: OfflineMutationType,
  payload: Record<string, unknown>
): { idempotencyKey: string; updatedSnapshot: T | null } {
  const idempotencyKey = `web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = new Date().toISOString();
  const envelope: OfflineMutationEnvelope = {
    ...payload,
    idempotencyKey,
    type,
    createdAt,
    centreId:
      (typeof payload.centreId === "string" && payload.centreId) ||
      currentSnapshot?.activeCentreId ||
      currentSnapshot?.activeProfile?.centreId ||
      undefined,
    profileId:
      (typeof payload.profileId === "string" && payload.profileId) ||
      currentSnapshot?.activeProfile?.id ||
      undefined,
    operatorName:
      (typeof payload.operatorName === "string" && payload.operatorName) ||
      currentSnapshot?.activeProfile?.displayName ||
      undefined,
    role:
      (typeof payload.role === "string" && payload.role) ||
      currentSnapshot?.activeProfile?.role ||
      undefined,
  };

  if (typeof window !== "undefined") {
    try {
      const queue = getWebOfflineQueue();
      queue.push(envelope);
      window.localStorage.setItem(WEB_OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch {
      // Ignore storage quota failure
    }
  }

  const base = currentSnapshot ?? loadWebOfflineSnapshot<T>();
  const updatedSnapshot = base ? applyOfflineMutationToSnapshot(base, envelope) : null;
  if (updatedSnapshot) {
    saveWebOfflineSnapshot(updatedSnapshot);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(WEB_OFFLINE_EVENT));
  }
  return { idempotencyKey, updatedSnapshot };
}

export async function flushWebOfflineQueue(): Promise<{ pushed: number; remaining: number }> {
  const queue = getWebOfflineQueue();
  if (queue.length === 0) return { pushed: 0, remaining: 0 };
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { pushed: 0, remaining: queue.length };
  }
  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mutations: queue }),
    });
    if (!res.ok) return { pushed: 0, remaining: queue.length };
    const out = (await res.json()) as { syncedKeys?: string[] };
    const syncedSet = new Set(Array.isArray(out.syncedKeys) ? out.syncedKeys : []);
    const remainingList = queue.filter((m) => !syncedSet.has(m.idempotencyKey));
    if (typeof window !== "undefined") {
      try {
        if (remainingList.length === 0) {
          window.localStorage.removeItem(WEB_OFFLINE_QUEUE_KEY);
        } else {
          window.localStorage.setItem(WEB_OFFLINE_QUEUE_KEY, JSON.stringify(remainingList));
        }
      } catch {
        // Ignore
      }
      window.dispatchEvent(new CustomEvent(WEB_OFFLINE_EVENT));
    }
    return { pushed: syncedSet.size, remaining: remainingList.length };
  } catch {
    return { pushed: 0, remaining: queue.length };
  }
}

export function isOfflineNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  return err instanceof TypeError;
}
