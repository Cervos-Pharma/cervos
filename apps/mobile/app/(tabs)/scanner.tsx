import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { parseGs1Barcode } from "../../lib/core";
import { useMobileSession } from "../../src/context/MobileSessionContext";
import { CERVOS_COLORS, TOUCH_MIN_HEIGHT } from "../../src/theme/tokens";

export default function MobileBarcodeScannerScreen() {
  const { lang, isDark } = useMobileSession();
  const isSw = lang === "SW";
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedRaw, setScannedRaw] = useState<string | null>(null);
  const [parsedInfo, setParsedInfo] = useState<{ batchNumber?: string; expiryDate?: string; gtin?: string } | null>(null);

  const bg = isDark ? CERVOS_COLORS.darkBg : CERVOS_COLORS.lightBg;
  const card = isDark ? CERVOS_COLORS.darkCard : CERVOS_COLORS.lightCard;
  const border = isDark ? CERVOS_COLORS.darkBorder : CERVOS_COLORS.lightBorder;
  const text = isDark ? CERVOS_COLORS.darkText : CERVOS_COLORS.lightText;
  const muted = isDark ? CERVOS_COLORS.darkMuted : CERVOS_COLORS.lightMuted;

  const handleBarcode = ({ data }: { data: string }) => {
    if (data === scannedRaw) return;
    setScannedRaw(data);
    const parsed = parseGs1Barcode(data);
    if (parsed.format === "gs1") {
      setParsedInfo({
        batchNumber: parsed.batchNumber ?? undefined,
        expiryDate: parsed.expiryDate ?? undefined,
        gtin: parsed.gtin ?? undefined,
      });
    } else {
      setParsedInfo({ gtin: data });
    }
  };

  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: bg }} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: bg }]}>
        <Text style={[styles.title, { color: text }]}>
          {isSw ? "Ruhusu Kamera kwa Skana ya Dawa" : "Camera Access Needed for Barcode / QR Scans"}
        </Text>
        <Text style={{ color: muted, textAlign: "center", fontSize: 13 }}>
          {isSw ? "Skani boksi za dawa kusoma namba ya toleo na tarehe ya mwisho." : "Point at any medicine pack GS1/QR code to read lot numbers & expiry instantly."}
        </Text>
        <TouchableOpacity onPress={requestPermission} style={[styles.btn, { backgroundColor: CERVOS_COLORS.cobalt }]}>
          <Text style={styles.btnText}>{isSw ? "Washa Kamera" : "Enable Camera"}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{ barcodeTypes: ["qr", "code128", "ean13", "datamatrix"] }}
        onBarcodeScanned={handleBarcode}
      />
      <View style={[styles.resultCard, { backgroundColor: card, borderColor: border }]}>
        <Text style={[styles.tag, { color: CERVOS_COLORS.cobalt }]}>
          {isSw ? "SKANA YA DAWA (GS1 / QR)" : "MEDICINE BARCODE / QR SCANNER"}
        </Text>
        <Text style={[styles.title, { color: text }]}>
          {scannedRaw ? parsedInfo?.batchNumber || scannedRaw : isSw ? "Elekeza kamera kwenye msimbo..." : "Point camera at package barcode..."}
        </Text>
        {parsedInfo && (
          <Text style={{ color: muted, fontSize: 13 }}>
            GTIN: {parsedInfo.gtin || "-"} &middot; Exp: {parsedInfo.expiryDate || "Inspect box"}
          </Text>
        )}
        {scannedRaw && (
          <TouchableOpacity
            onPress={() => {
              setScannedRaw(null);
              setParsedInfo(null);
            }}
            style={[styles.btn, { backgroundColor: CERVOS_COLORS.cobalt }]}
          >
            <Text style={styles.btnText}>{isSw ? "Skani Nyingine" : "Scan Next Pack"}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, padding: 24, justifyContent: "center", alignItems: "center", gap: 14 },
  camera: { flex: 1 },
  resultCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, padding: 20, gap: 10 },
  tag: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  title: { fontSize: 17, fontWeight: "700" },
  btn: { minHeight: TOUCH_MIN_HEIGHT, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 22 },
  btnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
});
