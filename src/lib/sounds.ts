/**
 * @file lib/sounds.ts
 * @description Clean audio feedback manager powered by curated CC0 interface audio
 * assets stored in `public/sounds/*.mp3` (no harsh synthetic oscillator tones).
 */

export type AppSoundKind =
  | "tap"
  | "scan"
  | "cart-add"
  | "sale-complete"
  | "notify"
  | "alert"
  | "shift-clock"
  | "switch";

const SOUND_FILES: Record<AppSoundKind, string> = {
  tap: "/sounds/tap.mp3",
  scan: "/sounds/scan.mp3",
  "cart-add": "/sounds/cart-add.mp3",
  "sale-complete": "/sounds/sale-complete.mp3",
  notify: "/sounds/notify.mp3",
  alert: "/sounds/alert.mp3",
  "shift-clock": "/sounds/shift-clock.mp3",
  switch: "/sounds/switch.mp3",
};

const MUTE_KEY = "cervos-sound-muted";
const VOLUME_KEY = "cervos-sound-volume";

const audioCache = new Map<AppSoundKind, HTMLAudioElement>();

export function isSoundMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // Ignore storage quota errors
  }
}

export function getSoundVolume(): number {
  if (typeof window === "undefined") return 0.7;
  try {
    const raw = Number(window.localStorage.getItem(VOLUME_KEY));
    if (Number.isFinite(raw) && raw >= 0 && raw <= 1) return raw;
  } catch {
    // Fallback
  }
  return 0.7;
}

export function setSoundVolume(volume: number): void {
  if (typeof window === "undefined") return;
  const clamped = Math.max(0, Math.min(1, volume));
  try {
    window.localStorage.setItem(VOLUME_KEY, String(clamped));
  } catch {
    // Ignore
  }
}

export function playAppSound(kind: AppSoundKind): void {
  if (typeof window === "undefined" || typeof Audio === "undefined") return;
  if (isSoundMuted()) return;
  try {
    const base = audioCache.get(kind) ?? new Audio(SOUND_FILES[kind]);
    if (!audioCache.has(kind)) {
      base.preload = "auto";
      audioCache.set(kind, base);
    }
    const instance = base.cloneNode(true) as HTMLAudioElement;
    instance.volume = getSoundVolume();
    void instance.play().catch(() => {
      // Autoplay restriction before first gesture; safely ignored
    });
  } catch {
    // Ignore audio decode failures in restricted runtimes
  }
}
