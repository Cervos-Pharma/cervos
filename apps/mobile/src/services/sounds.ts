import { createAudioPlayer, type AudioPlayer } from "expo-audio";
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
  scan: require("../../assets/sounds/scan.mp3"),
  "cart-add": require("../../assets/sounds/cart-add.mp3"),
  "sale-complete": require("../../assets/sounds/sale-complete.mp3"),
  alert: require("../../assets/sounds/alert.mp3"),
  notify: require("../../assets/sounds/notify.mp3"),
  "shift-clock": require("../../assets/sounds/shift-clock.mp3"),
  switch: require("../../assets/sounds/switch.mp3"),
  tap: require("../../assets/sounds/tap.mp3"),
};

const playerCache = new Map<AppSoundName, AudioPlayer>();

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
    let player = playerCache.get(name);
    if (!player) {
      player = createAudioPlayer(SOUND_SOURCES[name]);
      playerCache.set(name, player);
    }
    player.volume = prefs.soundVolume;
    await player.seekTo(0);
    player.play();
  } catch {
    // Fail gracefully if audio hardware is busy
  }
}
