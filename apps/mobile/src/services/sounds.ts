import {
  createAudioPlayer,
  preload,
  setAudioModeAsync,
  type AudioPlayer,
} from "expo-audio";
import * as Haptics from "expo-haptics";
import { loadStationPrefs } from "@/services/offline-db";

export type AppSoundName =
  | "scan"
  | "cart-add"
  | "sale-complete"
  | "alert"
  | "notify"
  | "shift-clock"
  | "switch"
  | "tap";

const SOUND_SOURCES: Record<AppSoundName, number> = {
  scan: require("../../assets/sounds/scan.wav"),
  "cart-add": require("../../assets/sounds/cart-add.wav"),
  "sale-complete": require("../../assets/sounds/sale-complete.wav"),
  alert: require("../../assets/sounds/alert.wav"),
  notify: require("../../assets/sounds/notify.wav"),
  "shift-clock": require("../../assets/sounds/shift-clock.wav"),
  switch: require("../../assets/sounds/switch.wav"),
  tap: require("../../assets/sounds/tap.wav"),
};

const POOL_SIZE = 2;

interface SoundPoolEntry {
  players: AudioPlayer[];
  nextIdx: number;
}

const playerPool = new Map<AppSoundName, SoundPoolEntry>();
let audioModePromise: Promise<void> | null = null;
let preloaded = false;

async function ensureAudioSession(): Promise<void> {
  if (!audioModePromise) {
    audioModePromise = setAudioModeAsync({
      playsInSilentMode: false,
      interruptionMode: "mixWithOthers",
      shouldPlayInBackground: false,
      allowsRecording: false,
      shouldRouteThroughEarpiece: false,
    }).catch(() => {
      audioModePromise = null;
    });
  }
  await audioModePromise;

  if (!preloaded) {
    preloaded = true;
    for (const source of Object.values(SOUND_SOURCES)) {
      void Promise.resolve(preload(source)).catch(() => undefined);
    }
  }
}

function acquirePlayer(name: AppSoundName): { player: AudioPlayer; isFresh: boolean } {
  let entry = playerPool.get(name);
  if (!entry) {
    entry = { players: [], nextIdx: 0 };
    playerPool.set(name, entry);
  }

  // Prefer an idle slot so rapid cues overlap cleanly without clipping
  const idle = entry.players.find((p) => !p.playing);
  if (idle) {
    return { player: idle, isFresh: false };
  }

  if (entry.players.length < POOL_SIZE) {
    const fresh = createAudioPlayer(SOUND_SOURCES[name], {
      updateInterval: 250,
      keepAudioSessionActive: false,
    });
    entry.players.push(fresh);
    return { player: fresh, isFresh: true };
  }

  const player = entry.players[entry.nextIdx % entry.players.length];
  entry.nextIdx = (entry.nextIdx + 1) % entry.players.length;
  return { player, isFresh: false };
}

export async function triggerHaptic(kind: "selection" | "light" | "medium" | "success" | "error") {
  const prefs = loadStationPrefs();
  if (!prefs.hapticsEnabled) return;
  try {
    if (kind === "selection") await Haptics.selectionAsync();
    else if (kind === "light") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else if (kind === "medium") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else if (kind === "success") await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (kind === "error") await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {
    // Haptics disabled or unsupported
  }
}

export async function playSoundCue(name: AppSoundName) {
  const prefs = loadStationPrefs();
  if (prefs.soundMuted || prefs.soundVolume <= 0) return;

  try {
    await ensureAudioSession();
    const { player, isFresh } = acquirePlayer(name);
    player.volume = Math.max(0, Math.min(1, prefs.soundVolume));
    if (!isFresh) {
      if (player.playing) {
        player.pause();
      }
      if (player.isLoaded) {
        await player.seekTo(0).catch(() => undefined);
      }
    }
    player.play();
  } catch {
    // Fail gracefully if audio hardware is busy
  }
}
