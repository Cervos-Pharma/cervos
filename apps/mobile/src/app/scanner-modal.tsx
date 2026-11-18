import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { PrimaryButton } from "@/components/primary-button";
import { useMobileSession } from "@/context/session-context";
import { playSoundCue, triggerHaptic } from "@/services/sounds";
import { colors, radius, spacing, typography, useBrandColors } from "@/theme";

export default function ScannerModalScreen() {
  const router = useRouter();
  const { workspace, scopedBatches, setPendingScannedCode, lang } = useMobileSession();
  const brand = useBrandColors(workspace?.account?.customization?.brandAccent);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const isSw = lang === "SW";

  const commitCode = async (raw: string) => {
    const clean = raw.trim();
    if (!clean) return;
    setPendingScannedCode(clean);
    await playSoundCue("scan");
    await triggerHaptic("success");
    router.back();
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
    >
      <View
        style={{
          height: 260,
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
                ? "Ruhusu kamera kusoma misimbopau ya dawa"
                : "Allow camera access to scan medicine barcodes"}
            </Text>
            <PrimaryButton
              title={isSw ? "Ruhusu Kamera" : "Enable Camera"}
              onPress={() => void requestPermission()}
            />
          </View>
        )}
      </View>

      <View
        style={{
          padding: spacing.md,
          borderRadius: radius.xl,
          borderCurve: "continuous",
          backgroundColor: colors.secondaryGroupedBackground,
          gap: spacing.sm,
        }}
      >
        <Text style={typography.overline}>MANUAL OR EXTERNAL SCANNER</Text>
        <TextInput
          value={manualCode}
          onChangeText={setManualCode}
          placeholder="Type lot number, drug name, or GS1 code"
          placeholderTextColor={colors.tertiaryLabel as string}
          onSubmitEditing={() => void commitCode(manualCode)}
          style={{
            minHeight: 44,
            borderRadius: radius.md,
            backgroundColor: colors.tertiaryBackground,
            paddingHorizontal: spacing.md,
            color: colors.label,
          }}
        />
        <PrimaryButton title={isSw ? "Weka Kikapuni" : "Apply Code"} onPress={() => void commitCode(manualCode)} />
      </View>

      {scopedBatches.length > 0 && (
        <View style={{ gap: spacing.xs }}>
          <Text style={typography.overline}>QUICK LOT PICKS</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
            {scopedBatches
              .filter((b) => !b.quarantined && b.quantity > 0)
              .slice(0, 5)
              .map((b) => (
                <Pressable
                  key={b.id}
                  onPress={() => void commitCode(b.batchNumber)}
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
    </ScrollView>
  );
}
