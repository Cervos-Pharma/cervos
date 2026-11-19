import { type ComponentRef, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  buildLotQrPayload,
  buildReceiptQrPayload,
  matchCatalogByBarcode,
  parseScanIntent,
} from "@cervos/core";
import { PlatformIcon } from "@/components/platform-icon";
import { PrimaryButton } from "@/components/primary-button";
import { type ScanTarget, useMobileSession } from "@/context/session-context";
import { playSoundCue, triggerHaptic } from "@/services/sounds";
import { colors, radius, spacing, typography, useBrandColors } from "@/theme";

const VALID_TARGETS = new Set<ScanTarget>(["pos", "inventory", "batch", "receipts", "wholesale"]);

export default function ScannerModalScreen() {
  const router = useRouter();
  const { target: rawTarget } = useLocalSearchParams<{ target?: string }>();
  const {
    workspace,
    cloudCatalog,
    scopedBatches,
    scopedSales,
    pendingScanContext,
    setPendingScanContext,
    setPendingScannedCode,
    lang,
  } = useMobileSession();
  const brand = useBrandColors(workspace?.account?.customization?.brandAccent);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [usbAutoFocus, setUsbAutoFocus] = useState(false);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const isSw = lang === "SW";

  const effectiveTarget: ScanTarget =
    rawTarget && VALID_TARGETS.has(rawTarget as ScanTarget)
      ? (rawTarget as ScanTarget)
      : pendingScanContext ?? "pos";

  const livePreview = useMemo(() => {
    const trimmed = manualCode.trim();
    if (!trimmed) return null;
    const intent = parseScanIntent(trimmed);
    const cloudHit = matchCatalogByBarcode(cloudCatalog, trimmed);
    if (intent.kind === "receipt") {
      return isSw
        ? `Risiti QR · ${intent.receiptNumber}`
        : `Receipt QR · ${intent.receiptNumber}`;
    }
    if (intent.kind === "lot") {
      return isSw
        ? `Kundi QR · ${intent.batchNumber}`
        : `Lot QR · ${intent.batchNumber}`;
    }
    if (intent.kind === "gs1") {
      const parts = [
        intent.gtin ? `GTIN ${intent.gtin}` : null,
        intent.batchNumber ? `Lot ${intent.batchNumber}` : null,
        intent.expiryDate ? `Exp ${intent.expiryDate}` : null,
        cloudHit ? cloudHit.brandName : null,
      ].filter(Boolean);
      return `GS1 · ${parts.join(" · ")}`;
    }
    if (cloudHit) {
      return `${cloudHit.brandName} (${cloudHit.segment})`;
    }
    return null;
  }, [manualCode, cloudCatalog, isSw]);

  const commitCode = async (raw: string) => {
    const clean = raw.trim();
    if (!clean) return;
    setPendingScanContext(effectiveTarget);
    setPendingScannedCode(clean);
    await playSoundCue("scan");
    await triggerHaptic("success");
    router.back();
  };

  const targetHint =
    effectiveTarget === "receipts"
      ? isSw
        ? "Skani QR ya risiti (CERVOS:RCP:...) au andika namba ya risiti."
        : "Scan a receipt QR (CERVOS:RCP:...) or enter a receipt number."
      : effectiveTarget === "batch"
        ? isSw
          ? "Skani msimbopau wa dawa au GS1 DataMatrix kujaza fomu kiotomatiki."
          : "Scan a medicine barcode or GS1 DataMatrix to auto-fill batch details."
        : effectiveTarget === "inventory"
          ? isSw
            ? "Skani msimbopau, GS1, au QR ya kundi (CERVOS:LOT:...) kutafuta au kupokea mzigo."
            : "Scan barcode, GS1, or Lot QR (CERVOS:LOT:...) to locate or receive stock."
          : isSw
            ? "Skani msimbopau, GS1, Lot QR, au Risiti QR."
            : "Scan medicine barcode, GS1 DataMatrix, Lot QR, or Receipt QR.";

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 40 }}
    >
      <View
        style={{
          height: 250,
          borderRadius: radius.xl,
          borderCurve: "continuous",
          overflow: "hidden",
          backgroundColor: "#0B0F17",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {permission?.granted ? (
          <CameraView
            style={{ width: "100%", height: "100%" }}
            barcodeScannerSettings={{
              barcodeTypes: ["qr", "code128", "ean13", "ean8", "datamatrix"],
            }}
            onBarcodeScanned={(res) => {
              if (scanned || !res.data) return;
              setScanned(true);
              void commitCode(res.data);
            }}
          />
        ) : (
          <View style={{ padding: spacing.md, alignItems: "center", gap: spacing.sm }}>
            <Text style={{ color: "#FFFFFF", fontWeight: "600", textAlign: "center" }}>
              {isSw
                ? "Ruhusu kamera kusoma misimbopau ya dawa na QR"
                : "Allow camera access to scan barcodes, GS1 & QR codes"}
            </Text>
            <PrimaryButton
              title={isSw ? "Ruhusu Kamera" : "Enable Camera"}
              accentHex={workspace?.account?.customization?.brandAccent}
              onPress={() => void requestPermission()}
            />
          </View>
        )}
      </View>

      <Text style={typography.caption}>{targetHint}</Text>

      <View
        style={{
          padding: spacing.md,
          borderRadius: radius.xl,
          borderCurve: "continuous",
          backgroundColor: colors.secondaryGroupedBackground,
          gap: spacing.sm,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.xs }}>
          <Text style={typography.overline}>
            {isSw ? "INGIZA KWA MKONO AU SKANA YA USB" : "MANUAL OR USB / HID SCANNER"}
          </Text>
          <Pressable
            onPress={() => {
              const next = !usbAutoFocus;
              setUsbAutoFocus(next);
              if (next) inputRef.current?.focus();
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: radius.full,
              backgroundColor: usbAutoFocus ? brand.accentSoft : colors.tertiaryBackground,
            }}
          >
            <PlatformIcon
              sf="barcode.viewfinder"
              md="qr-code-scanner"
              color={usbAutoFocus ? brand.accent : colors.secondaryLabel}
              size={13}
            />
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: usbAutoFocus ? brand.accent : colors.secondaryLabel,
              }}
            >
              {usbAutoFocus ? "USB Focus ON" : "USB Auto-Focus"}
            </Text>
          </Pressable>
        </View>

        <TextInput
          ref={inputRef}
          value={manualCode}
          onChangeText={setManualCode}
          autoFocus={usbAutoFocus || !permission?.granted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          placeholder={
            effectiveTarget === "receipts"
              ? "CERVOS:RCP:RCP-... or RCP-..."
              : "GTIN / EAN-13, GS1 (01)...(17)...(10)..., CERVOS:LOT:..."
          }
          placeholderTextColor={colors.tertiaryLabel as string}
          onSubmitEditing={() => void commitCode(manualCode)}
          style={{
            minHeight: 44,
            borderRadius: radius.md,
            backgroundColor: colors.tertiaryBackground,
            paddingHorizontal: spacing.md,
            color: colors.label,
            fontSize: 14,
          }}
        />

        {livePreview && (
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: radius.md,
              backgroundColor: brand.accentSoft,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: brand.accent }}>
              {livePreview}
            </Text>
          </View>
        )}

        <PrimaryButton
          title={
            effectiveTarget === "receipts"
              ? isSw
                ? "Hakiki Risiti"
                : "Verify Receipt"
              : isSw
                ? "Tumia Msimbo"
                : "Apply Code"
          }
          accentHex={workspace?.account?.customization?.brandAccent}
          onPress={() => void commitCode(manualCode)}
        />
      </View>

      {effectiveTarget === "receipts" && scopedSales.length > 0 && (
        <View style={{ gap: spacing.xs }}>
          <Text style={typography.overline}>
            {isSw ? "RISITI ZA HIVI KARIBUNI (QR)" : "QUICK RECEIPT QR PICKS"}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
            {scopedSales.slice(0, 5).map((sale) => {
              const rcp = sale.receiptNumber || `RCP-${sale.id.slice(-6).toUpperCase()}`;
              return (
                <Pressable
                  key={sale.id}
                  onPress={() => void commitCode(buildReceiptQrPayload(rcp, sale.id))}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: radius.full,
                    backgroundColor: colors.secondaryGroupedBackground,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: brand.accent }}>
                    {rcp} · {sale.customerName || "Walk-in"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {effectiveTarget !== "receipts" && scopedBatches.length > 0 && (
        <View style={{ gap: spacing.xs }}>
          <Text style={typography.overline}>
            {isSw ? "MAKUNDI YA HARAKA (LOT QR)" : "QUICK BRANCH LOT PICKS"}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
            {scopedBatches
              .filter((b) => !b.quarantined && b.quantity > 0)
              .slice(0, 5)
              .map((b) => (
                <Pressable
                  key={b.id}
                  onPress={() =>
                    void commitCode(b.barcode || buildLotQrPayload(b.batchNumber))
                  }
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: radius.full,
                    backgroundColor: colors.secondaryGroupedBackground,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: brand.accent }}>
                    {b.brandName} ({b.batchNumber})
                  </Text>
                </Pressable>
              ))}
          </View>
        </View>
      )}

      {(effectiveTarget === "batch" || effectiveTarget === "inventory") && cloudCatalog.length > 0 && (
        <View style={{ gap: spacing.xs }}>
          <Text style={typography.overline}>
            {isSw ? "ORODHA YA WINGU (CLOUD CATALOG)" : "CLOUD CATALOG BARCODE PICKS"}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
            {cloudCatalog.slice(0, 6).map((item) => {
              const code = item.barcodes[0];
              if (!code) return null;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => void commitCode(code)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: radius.full,
                    backgroundColor: colors.secondaryGroupedBackground,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: colors.label }}>
                    {item.brandName} · {code}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </ScrollView>
  );
}
