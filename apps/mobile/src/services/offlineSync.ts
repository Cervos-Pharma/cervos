import * as Notifications from "expo-notifications";
import * as SQLite from "expo-sqlite";
import { pullDeltaSync, pushDeltaSync } from "./api";

export interface QueuedMutation {
  idempotencyKey: string;
  type: "sale" | "shift_clock";
  payloadJson: string;
  createdAt: string;
  synced: number;
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
  const row = await db.getFirstAsync<{ cnt: number }>("SELECT COUNT(*) as cnt FROM sync_queue WHERE synced = 0");
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
    const mutations = pendingRows.map((r: QueuedMutation) => JSON.parse(r.payloadJson) as Record<string, unknown>);
    const pushRes = await pushDeltaSync(mutations);
    if (pushRes.ok && Array.isArray(pushRes.data.syncedKeys)) {
      for (const k of pushRes.data.syncedKeys) {
        await db.runAsync("UPDATE sync_queue SET synced = 1 WHERE idempotencyKey = ?", [k]);
        pushed += 1;
      }
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
}

export async function triggerLocalAlertNotification(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: "default" },
    trigger: null,
  }).catch(() => undefined);
}
