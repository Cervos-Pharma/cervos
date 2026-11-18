import * as Notifications from "expo-notifications";
import * as SQLite from "expo-sqlite";
import Storage from "expo-sqlite/kv-store";
import type { WorkspaceStateResponse } from "@/types/workspace";
import { pullDeltaSync, pushDeltaSync } from "@/services/api";

export interface QueuedMutation {
  idempotencyKey: string;
  type: "sale" | "shift_clock";
  payloadJson: string;
  createdAt: string;
  synced: number;
}

export interface MobileStationPrefs {
  paperWidthMm: 58 | 80;
  soundMuted: boolean;
  soundVolume: number;
  hapticsEnabled: boolean;
  orgScope: "all" | "branch";
  printerName: string;
  lastActiveMs: number;
}

const PREFS_KEY = "cervos_station_prefs_v1";
const TOUR_SEEN_PREFIX = "cervos_mobile_tour_v1_";

export const DEFAULT_STATION_PREFS: MobileStationPrefs = {
  paperWidthMm: 80,
  soundMuted: false,
  soundVolume: 0.75,
  hapticsEnabled: true,
  orgScope: "branch",
  printerName: "Mobile Print / Share PDF",
  lastActiveMs: Date.now(),
};

export function loadStationPrefs(): MobileStationPrefs {
  try {
    const raw = Storage.getItemSync(PREFS_KEY);
    if (!raw) return { ...DEFAULT_STATION_PREFS };
    const parsed = JSON.parse(raw) as Partial<MobileStationPrefs>;
    return {
      paperWidthMm: parsed.paperWidthMm === 58 ? 58 : 80,
      soundMuted: Boolean(parsed.soundMuted),
      soundVolume:
        typeof parsed.soundVolume === "number" && parsed.soundVolume >= 0 && parsed.soundVolume <= 1
          ? parsed.soundVolume
          : 0.75,
      hapticsEnabled: parsed.hapticsEnabled !== false,
      orgScope: parsed.orgScope === "all" ? "all" : "branch",
      printerName:
        typeof parsed.printerName === "string" && parsed.printerName.trim()
          ? parsed.printerName
          : DEFAULT_STATION_PREFS.printerName,
      lastActiveMs: typeof parsed.lastActiveMs === "number" ? parsed.lastActiveMs : Date.now(),
    };
  } catch {
    return { ...DEFAULT_STATION_PREFS };
  }
}

export function saveStationPrefs(patch: Partial<MobileStationPrefs>): MobileStationPrefs {
  const next = { ...loadStationPrefs(), ...patch };
  try {
    Storage.setItemSync(PREFS_KEY, JSON.stringify(next));
  } catch {
    // Ignore synchronous kv failure
  }
  return next;
}

export function hasSeenMobileTour(profileId: string): boolean {
  try {
    return Storage.getItemSync(`${TOUR_SEEN_PREFIX}${profileId}`) === "1";
  } catch {
    return false;
  }
}

export function markMobileTourSeen(profileId: string): void {
  try {
    Storage.setItemSync(`${TOUR_SEEN_PREFIX}${profileId}`, "1");
  } catch {
    // Ignore
  }
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync("cervos_pharma_offline.db");
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS sync_queue (
          idempotencyKey TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          payloadJson TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          synced INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS kv_meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);
      return db;
    })();
  }
  return dbPromise;
}

export async function cacheWorkspaceSnapshot(snapshot: WorkspaceStateResponse): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO kv_meta (key, value) VALUES ('cached_workspace', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [JSON.stringify(snapshot)]
  );
}

export async function loadCachedWorkspaceSnapshot(): Promise<WorkspaceStateResponse | null> {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM kv_meta WHERE key = 'cached_workspace'"
    );
    if (!row?.value) return null;
    return JSON.parse(row.value) as WorkspaceStateResponse;
  } catch {
    return null;
  }
}

export async function enqueueOfflineMutation(
  type: "sale" | "shift_clock",
  payload: Record<string, unknown>
): Promise<string> {
  const db = await getDb();
  const idempotencyKey = `mob_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = new Date().toISOString();
  await db.runAsync(
    "INSERT OR IGNORE INTO sync_queue (idempotencyKey, type, payloadJson, createdAt, synced) VALUES (?, ?, ?, ?, 0)",
    [idempotencyKey, type, JSON.stringify({ ...payload, idempotencyKey, type, createdAt }), createdAt]
  );
  return idempotencyKey;
}

export async function getPendingQueueCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM sync_queue WHERE synced = 0"
  );
  return row?.cnt ?? 0;
}

export async function flushAndSyncOfflineQueue(): Promise<{
  pushed: number;
  remaining: number;
  serverTime: string;
  pulled: boolean;
}> {
  const db = await getDb();
  const pendingRows = await db.getAllAsync<QueuedMutation>(
    "SELECT idempotencyKey, type, payloadJson, createdAt, synced FROM sync_queue WHERE synced = 0 ORDER BY createdAt ASC LIMIT 50"
  );

  let pushed = 0;
  if (pendingRows.length > 0) {
    const mutations = pendingRows.map(
      (r: QueuedMutation) => JSON.parse(r.payloadJson) as Record<string, unknown>
    );
    const pushRes = await pushDeltaSync(mutations);
    if (pushRes.ok && Array.isArray(pushRes.data.syncedKeys)) {
      await db.withTransactionAsync(async () => {
        for (const k of pushRes.data.syncedKeys || []) {
          await db.runAsync("UPDATE sync_queue SET synced = 1 WHERE idempotencyKey = ?", [k]);
          pushed += 1;
        }
      });
    }
  }

  const lastRow = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM kv_meta WHERE key = 'last_synced_at'"
  );
  const since = lastRow?.value || "1970-01-01T00:00:00.000Z";
  const pullRes = await pullDeltaSync(since);
  const serverTime =
    typeof pullRes.data.serverTime === "string"
      ? pullRes.data.serverTime
      : new Date().toISOString();

  if (pullRes.ok) {
    await db.runAsync(
      "INSERT INTO kv_meta (key, value) VALUES ('last_synced_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [serverTime]
    );
  }

  const remaining = await getPendingQueueCount();
  return { pushed, remaining, serverTime, pulled: pullRes.ok };
}

export async function registerNotificationChannelAndCheck(): Promise<boolean> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    await Notifications.setNotificationChannelAsync("cervos-alerts", {
      name: "Cervos Pharmacy Alerts",
      importance: Notifications.AndroidImportance.HIGH,
    }).catch(() => undefined);
    return status === "granted";
  } catch {
    return false;
  }
}

export async function triggerLocalAlertNotification(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: "default" },
    trigger: null,
  }).catch(() => undefined);
}
