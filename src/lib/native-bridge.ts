/**
 * @file lib/native-bridge.ts
 * @description Tier-2 PWA-side bridge listener for a Two-Tier Native Shell + PWA architecture.
 * When Cervos Web runs inside an Expo/WebView, Android Capacitor/WebView, or Tauri Desktop container,
 * this module sends typed UI/hardware commands up to the native host and listens for native hardware
 * events (barcode scans, hardware keys, push deep links, network transitions) dispatched back down.
 */

export type NativeShellHostKind = "react_native_webview" | "tauri" | "browser";

export interface PwaToNativeMessage {
  channel: "cervos-pwa-bridge";
  version: 1;
  type:
    | "hardware:scan_barcode"
    | "hardware:print_receipt"
    | "feedback:sound"
    | "feedback:haptic"
    | "auth:profile_locked"
    | "auth:org_signed_out"
    | "sync:status";
  payload?: Record<string, unknown>;
}

export interface NativeToPwaEvent {
  type:
    | "native:barcode_scanned"
    | "native:deep_link"
    | "native:open_chat"
    | "native:open_menu"
    | "native:back_pressed"
    | "native:sync_requested";
  eventId?: string;
  payload?: Record<string, unknown>;
}

export const NATIVE_BRIDGE_EVENT = "cervos:native-bridge-event";

interface NativeBridgeWindow extends Window {
  ReactNativeWebView?: {
    postMessage: (msg: string) => void;
  };
  CervosNativeBridge?: {
    postMessage?: (msg: string) => void;
    invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
  };
  __TAURI__?: unknown;
  __TAURI_INTERNALS__?: unknown;
}

export function detectNativeShellHost(): NativeShellHostKind {
  if (typeof window === "undefined") return "browser";
  const win = window as NativeBridgeWindow;
  if (win.ReactNativeWebView || win.CervosNativeBridge?.postMessage) {
    return "react_native_webview";
  }
  if (win.__TAURI__ || win.__TAURI_INTERNALS__) {
    return "tauri";
  }
  return "browser";
}

export function isNativeShellContainer(): boolean {
  return detectNativeShellHost() !== "browser";
}

/**
 * Tier-2 outbound call: send a structured command from the PWA to its wrapping native shell.
 * Returns true if a native host accepted the message, false when running in plain browser mode.
 */
export function postToNativeContainer(
  type: PwaToNativeMessage["type"],
  payload?: Record<string, unknown>
): boolean {
  if (typeof window === "undefined") return false;
  const win = window as NativeBridgeWindow;
  const envelope: PwaToNativeMessage = {
    channel: "cervos-pwa-bridge",
    version: 1,
    type,
    payload,
  };
  const serialized = JSON.stringify(envelope);

  if (win.ReactNativeWebView?.postMessage) {
    win.ReactNativeWebView.postMessage(serialized);
    return true;
  }
  if (win.CervosNativeBridge?.postMessage) {
    win.CervosNativeBridge.postMessage(serialized);
    return true;
  }
  if (win.CervosNativeBridge?.invoke) {
    void win.CervosNativeBridge.invoke(type, payload).catch(() => undefined);
    return true;
  }
  return false;
}

export function playNativeSound(kind: string, volume = 0.7): boolean {
  return postToNativeContainer("feedback:sound", { kind, volume });
}

export function triggerNativeHaptic(style: "light" | "medium" | "success" | "selection" = "selection"): boolean {
  return postToNativeContainer("feedback:haptic", { style });
}

export function requestNativeBarcodeScan(context: "pos" | "inventory" | "receipts"): boolean {
  return postToNativeContainer("hardware:scan_barcode", { context });
}

export function requestNativePrint(htmlOrText: string, paperWidthMm: 58 | 80 = 80): boolean {
  return postToNativeContainer("hardware:print_receipt", { content: htmlOrText, paperWidthMm });
}

/**
 * Tier-2 inbound listener: mounts window listeners for messages injected by the native shell
 * (via `window.postMessage` or `CustomEvent('cervos:native-bridge-event')`).
 */
export function subscribeNativeBridgeEvents(
  handler: (event: NativeToPwaEvent) => void
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const seenEventIds = new Set<string>();
  const deliver = (ev: NativeToPwaEvent, eventId?: string) => {
    if (eventId) {
      if (seenEventIds.has(eventId)) return;
      seenEventIds.add(eventId);
      if (seenEventIds.size > 200) {
        const oldest = seenEventIds.values().next().value;
        if (oldest) seenEventIds.delete(oldest);
      }
    }
    handler({ ...ev, eventId });
  };

  const onMessage = (ev: MessageEvent) => {
    try {
      const data = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
      if (data && data.channel === "cervos-native-bridge" && typeof data.type === "string") {
        const eventId = typeof data.eventId === "string" ? data.eventId : undefined;
        deliver({ type: data.type, payload: data.payload }, eventId);
      }
    } catch {
      // Ignore unrelated window messages
    }
  };

  const onCustom = (ev: Event) => {
    const detail = (ev as CustomEvent<NativeToPwaEvent & { eventId?: string }>).detail;
    if (detail && typeof detail.type === "string") {
      const eventId = typeof detail.eventId === "string" ? detail.eventId : undefined;
      deliver({ type: detail.type, payload: detail.payload }, eventId);
    }
  };

  window.addEventListener("message", onMessage);
  window.addEventListener(NATIVE_BRIDGE_EVENT, onCustom);
  return () => {
    window.removeEventListener("message", onMessage);
    window.removeEventListener(NATIVE_BRIDGE_EVENT, onCustom);
  };
}
