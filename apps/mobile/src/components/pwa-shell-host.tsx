import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import NetInfo from "@react-native-community/netinfo";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Print from "expo-print";
import WebView, {
  type WebViewMessageEvent,
  type WebViewNavigation,
  type WebViewProps,
} from "react-native-webview";
import { playSoundCue, triggerHaptic, type AppSoundName } from "@/services/sounds";
import { STATIC_BRAND_LIGHT, radius } from "@/theme";

// react-native-webview@14 declares `WebView<P = undefined>`, which intersects
// `WebViewProps & undefined` to `never` under strictNullChecks; instantiate `P = object`.
type CervosWebViewHandle = WebView<object>;
const CervosWebView = WebView as unknown as new (props: WebViewProps) => CervosWebViewHandle;

const API_BASE = (process.env.EXPO_PUBLIC_API_URL || "https://cervos.online").replace(/\/$/, "");
const START_URL = `${API_BASE}/app`;

const VALID_SOUNDS = new Set<AppSoundName>([
  "scan",
  "cart-add",
  "sale-complete",
  "alert",
  "notify",
  "shift-clock",
  "switch",
  "tap",
]);

interface BridgeEnvelope {
  channel?: string;
  version?: number;
  type?: string;
  payload?: Record<string, unknown>;
}

const PRE_LOAD_BRIDGE_JS = `
(function() {
  window.__CERVOS_NATIVE_SHELL__ = true;
  window.CervosNativeBridge = {
    postMessage: function(msg) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }
    }
  };
})();
true;
`;

export function PwaShellHost() {
  const webViewRef = useRef<CervosWebViewHandle>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(START_URL);
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const prevOnlineRef = useRef(true);

  // Native Hardware Barcode / GS1 Camera Scanner Modal
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanContext, setScanContext] = useState<"pos" | "inventory" | "receipts">("pos");
  const [torchOn, setTorchOn] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const dispatchToPwa = useCallback((type: string, payload?: Record<string, unknown>) => {
    const serialized = JSON.stringify({
      channel: "cervos-native-bridge",
      eventId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      payload: payload ?? {},
    });
    const script = `
      (function() {
        try {
          window.dispatchEvent(new CustomEvent('cervos:native-bridge-event', { detail: ${serialized} }));
        } catch (e) {}
      })();
      true;
    `;
    webViewRef.current?.injectJavaScript(script);
  }, []);

  // Watch network connectivity; trigger PWA queue flush on reconnect
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const next = Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(next);
      if (!prevOnlineRef.current && next) {
        dispatchToPwa("native:sync_requested");
      }
      prevOnlineRef.current = next;
    });
    return () => unsub();
  }, [dispatchToPwa]);

  // Android hardware back handler: scanner -> PWA drawers -> WebView history -> exit
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (scannerOpen) {
        setScannerOpen(false);
        setTorchOn(false);
        return true;
      }
      dispatchToPwa("native:back_pressed");
      const cleanPath = currentUrl.split("?")[0].replace(/\/$/, "");
      const isRootWorkspace = cleanPath === `${API_BASE}/app` || cleanPath === `${API_BASE}/auth` || cleanPath === `${API_BASE}/app/gate`;
      if (canGoBack && !isRootWorkspace) {
        webViewRef.current?.goBack();
        return true;
      }
      return true;
    });
    return () => sub.remove();
  }, [scannerOpen, canGoBack, currentUrl, dispatchToPwa]);

  const openNativeScanner = useCallback(
    async (ctx: "pos" | "inventory" | "receipts") => {
      setScanContext(ctx);
      if (!permission?.granted) {
        const res = await requestPermission();
        if (!res.granted) {
          void playSoundCue("alert");
          return;
        }
      }
      setScanLocked(false);
      setScannerOpen(true);
    },
    [permission?.granted, requestPermission]
  );

  const handleBridgeMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      let msg: BridgeEnvelope | null = null;
      try {
        msg = JSON.parse(event.nativeEvent.data) as BridgeEnvelope;
      } catch {
        return;
      }
      if (!msg || msg.channel !== "cervos-pwa-bridge" || !msg.type) return;

      switch (msg.type) {
        case "hardware:scan_barcode": {
          const ctx =
            msg.payload?.context === "inventory" || msg.payload?.context === "receipts"
              ? msg.payload.context
              : "pos";
          await openNativeScanner(ctx);
          break;
        }
        case "feedback:sound": {
          const rawKind = String(msg.payload?.kind || "") as AppSoundName;
          if (VALID_SOUNDS.has(rawKind)) {
            await playSoundCue(rawKind);
          }
          break;
        }
        case "feedback:haptic": {
          const style = msg.payload?.style;
          const mapped =
            style === "light" || style === "medium" || style === "success" || style === "selection"
              ? style
              : "selection";
          await triggerHaptic(mapped);
          break;
        }
        case "hardware:print_receipt": {
          const html = typeof msg.payload?.content === "string" ? msg.payload.content : "";
          if (html.trim()) {
            await Print.printAsync({ html }).catch(() => undefined);
          }
          break;
        }
        case "auth:profile_locked":
        case "auth:org_signed_out": {
          await triggerHaptic("selection");
          break;
        }
        default:
          break;
      }
    },
    [openNativeScanner]
  );

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanLocked || !data) return;
    setScanLocked(true);
    void triggerHaptic("success");
    void playSoundCue("scan");
    setScannerOpen(false);
    setTorchOn(false);
    dispatchToPwa("native:barcode_scanned", {
      code: data.trim(),
      context: scanContext,
    });
  };

  const handleNavChange = (navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
    if (navState.url) setCurrentUrl(navState.url);
  };

  const handleShouldStartLoad = (request: { url: string }) => {
    const url = request.url || "";
    if (
      url.startsWith(API_BASE) ||
      url.startsWith("about:") ||
      url.startsWith("blob:") ||
      url.startsWith("data:")
    ) {
      return true;
    }
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("tel:") || url.startsWith("mailto:")) {
      void Linking.openURL(url).catch(() => undefined);
      return false;
    }
    return true;
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" />

      {!isOnline && (
        <View style={styles.offlineBar}>
          <View style={styles.offlineDot} />
          <Text style={styles.offlineText}>Offline Mode · Counter receipts queued locally</Text>
          <Pressable onPress={() => dispatchToPwa("native:sync_requested")}>
            <Text style={styles.offlineAction}>Retry Sync</Text>
          </Pressable>
        </View>
      )}

      <CervosWebView
        ref={webViewRef}
        source={{ uri: START_URL }}
        style={styles.webview}
        applicationNameForUserAgent="CervosNativeShell/1.0"
        injectedJavaScriptBeforeContentLoaded={PRE_LOAD_BRIDGE_JS}
        onMessage={(ev: WebViewMessageEvent) => void handleBridgeMessage(ev)}
        onNavigationStateChange={handleNavChange}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onLoadStart={() => {
          setLoadError(null);
        }}
        onLoadEnd={() => {
          setLoading(false);
        }}
        onError={(syntheticEvent: { nativeEvent?: { description?: string } }) => {
          setLoading(false);
          setLoadError(syntheticEvent.nativeEvent?.description || "Unable to connect to Cervos server.");
        }}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled
        cacheMode={isOnline ? "LOAD_DEFAULT" : "LOAD_CACHE_ELSE_NETWORK"}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        allowsBackForwardNavigationGestures
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        setSupportMultipleWindows={false}
        bounces={false}
        overScrollMode="never"
      />

      {loading && (
        <View style={styles.overlay}>
          <View style={styles.loaderBadge}>
            <ActivityIndicator color={STATIC_BRAND_LIGHT} size="large" />
            <Text style={styles.loaderTitle}>Opening Cervos Workspace...</Text>
            <Text style={styles.loaderSub}>Syncing encrypted counter shell</Text>
          </View>
        </View>
      )}

      {loadError && (
        <View style={styles.overlay}>
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Connection Interrupted</Text>
            <Text style={styles.errorBody}>{loadError}</Text>
            <Pressable
              style={styles.retryBtn}
              onPress={() => {
                setLoadError(null);
                setLoading(true);
                webViewRef.current?.reload();
              }}
            >
              <Text style={styles.retryBtnText}>Reload Workspace</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Native Tier-1 Hardware Barcode & GS1 Camera Modal */}
      <Modal
        visible={scannerOpen}
        animationType="slide"
        onRequestClose={() => {
          setScannerOpen(false);
          setTorchOn(false);
        }}
      >
        <View style={styles.scannerRoot}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torchOn}
            barcodeScannerSettings={{
              barcodeTypes: ["qr", "ean13", "ean8", "code128", "code39", "datamatrix", "upc_a", "upc_e"],
            }}
            onBarcodeScanned={scanLocked ? undefined : handleBarcodeScanned}
          />
          <SafeAreaView style={styles.scannerOverlay} edges={["top", "bottom"]}>
            <View style={styles.scannerTopBar}>
              <Pressable
                style={styles.scannerPill}
                onPress={() => {
                  setScannerOpen(false);
                  setTorchOn(false);
                }}
              >
                <Text style={styles.scannerPillText}>Close</Text>
              </Pressable>
              <Pressable style={styles.scannerPill} onPress={() => setTorchOn((v) => !v)}>
                <Text style={styles.scannerPillText}>{torchOn ? "Torch On" : "Torch"}</Text>
              </Pressable>
            </View>
            <View style={styles.reticle} />
            <View style={styles.scannerFooter}>
              <Text style={styles.scannerHint}>
                Point camera at GS1 QR, pack barcode, or receipt QR ({scanContext.toUpperCase()})
              </Text>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F5F6F8",
  },
  webview: {
    flex: 1,
    backgroundColor: "#F5F6F8",
  },
  offlineBar: {
    backgroundColor: "#FEF3C7",
    borderBottomWidth: 1,
    borderBottomColor: "#FCD34D",
    paddingHorizontal: 14,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  offlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D97706",
  },
  offlineText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "600",
    color: "#92400E",
  },
  offlineAction: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1039B9",
  },
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "#F5F6F8",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loaderBadge: {
    alignItems: "center",
    gap: 10,
  },
  loaderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  loaderSub: {
    fontSize: 12,
    color: "#64748B",
  },
  errorCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: radius.xl,
    padding: 22,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
    alignItems: "center",
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  errorBody: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 6,
    backgroundColor: "#1039B9",
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 999,
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  scannerRoot: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scannerOverlay: {
    flex: 1,
    justifyContent: "space-between",
    padding: 20,
  },
  scannerTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scannerPill: {
    backgroundColor: "rgba(15,23,42,0.75)",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  scannerPillText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  reticle: {
    alignSelf: "center",
    width: 240,
    height: 240,
    borderRadius: 24,
    borderWidth: 2.5,
    borderColor: "#38BDF8",
    backgroundColor: "rgba(56,189,248,0.06)",
  },
  scannerFooter: {
    alignItems: "center",
    paddingBottom: 12,
  },
  scannerHint: {
    backgroundColor: "rgba(15,23,42,0.8)",
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    overflow: "hidden",
    textAlign: "center",
  },
});
