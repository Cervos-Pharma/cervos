import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Host, Switch } from "@expo/ui";
import { PrimaryButton } from "@/components/primary-button";
import { useMobileSession } from "@/context/session-context";
import { submitOnboarding } from "@/services/api";
import { playSoundCue, triggerHaptic } from "@/services/sounds";
import { colors, radius, spacing, typography, useBrandColors } from "@/theme";

export default function OnboardingScreen() {
  const router = useRouter();
  const { workspace, refreshState, setStationUnlocked } = useMobileSession();
  const brand = useBrandColors();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [orgName, setOrgName] = useState(workspace?.account?.orgName || "");
  const [branchName, setBranchName] = useState("Main Dispensary");
  const [branchAddress, setBranchAddress] = useState("");
  const [branchPhone, setBranchPhone] = useState("");
  const [region, setRegion] = useState(workspace?.account?.region || "Dar es Salaam");
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);

  // Optional settlement channels (never pre-filled)
  const [mpesaPaybill, setMpesaPaybill] = useState("");
  const [tigoLipaNumber, setTigoLipaNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [vatRegistered, setVatRegistered] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputCls = {
    minHeight: 46,
    borderRadius: radius.md,
    borderCurve: "continuous" as const,
    backgroundColor: colors.tertiaryBackground,
    paddingHorizontal: spacing.md,
    color: colors.label,
    fontSize: 15,
  };

  const snapGps = async () => {
    const p = await Location.requestForegroundPermissionsAsync();
    if (p.status !== "granted") {
      setError("Location permission required to capture GPS.");
      return;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setGps({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    void triggerHaptic("success");
  };

  const completeOnboarding = async () => {
    setBusy(true);
    setError(null);
    try {
      const hasPayout =
        mpesaPaybill.trim() || tigoLipaNumber.trim() || bankName.trim() || bankAccount.trim();
      const res = await submitOnboarding({
        orgName: orgName.trim(),
        region: region.trim(),
        centres: [
          {
            name: branchName.trim() || "Main Branch",
            address: branchAddress.trim() || region.trim(),
            phone: branchPhone.trim(),
            region: region.trim(),
            lat: gps?.lat,
            lng: gps?.lng,
          },
        ],
        paymentSettings: hasPayout
          ? {
              mpesaPaybill: mpesaPaybill.trim(),
              tigoLipaNumber: tigoLipaNumber.trim(),
              bankName: bankName.trim(),
              bankAccount: bankAccount.trim(),
              settlementCycle: "daily",
              vatRegistered,
            }
          : undefined,
      });

      if (!res.ok) {
        await playSoundCue("alert");
        setError(res.data?.error || "Could not complete onboarding.");
        return;
      }

      await playSoundCue("sale-complete");
      await triggerHaptic("success");
      setStationUnlocked(true);
      await refreshState();
      router.replace("/");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAwareScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 48 }}
    >
      <Text style={typography.overline}>STEP {step} OF 3</Text>
      <Text style={typography.title}>
        {step === 1
          ? "Confirm Organization Identity"
          : step === 2
            ? "Set Up Your First Branch"
            : "Optional Settlement Channels"}
      </Text>

      {error && <Text style={{ color: brand.danger, fontSize: 13 }}>{error}</Text>}

      <View
        style={{
          padding: spacing.md,
          borderRadius: radius.xl,
          borderCurve: "continuous",
          backgroundColor: colors.secondaryGroupedBackground,
          gap: spacing.sm,
        }}
      >
        {step === 1 && (
          <>
            <TextInput
              value={orgName}
              onChangeText={setOrgName}
              placeholder="Pharmacy Name"
              placeholderTextColor={colors.tertiaryLabel as string}
              style={inputCls}
            />
            <TextInput
              value={region}
              onChangeText={setRegion}
              placeholder="Primary Region"
              placeholderTextColor={colors.tertiaryLabel as string}
              style={inputCls}
            />
            <PrimaryButton title="Continue" onPress={() => setStep(2)} />
          </>
        )}

        {step === 2 && (
          <>
            <TextInput
              value={branchName}
              onChangeText={setBranchName}
              placeholder="Primary Branch Name"
              placeholderTextColor={colors.tertiaryLabel as string}
              style={inputCls}
            />
            <TextInput
              value={branchAddress}
              onChangeText={setBranchAddress}
              placeholder="Street / District"
              placeholderTextColor={colors.tertiaryLabel as string}
              style={inputCls}
            />
            <TextInput
              value={branchPhone}
              onChangeText={setBranchPhone}
              placeholder="Branch Contact Phone"
              placeholderTextColor={colors.tertiaryLabel as string}
              keyboardType="phone-pad"
              style={inputCls}
            />
            <Pressable
              onPress={snapGps}
              style={{
                minHeight: 44,
                borderRadius: radius.md,
                borderCurve: "continuous",
                backgroundColor: gps ? brand.successSoft : colors.tertiaryBackground,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontWeight: "600", color: gps ? brand.success : brand.accent }}>
                {gps ? `Coordinates Pinned (${gps.lat.toFixed(3)}, ${gps.lng.toFixed(3)})` : "Capture Branch GPS Coordinates"}
              </Text>
            </Pressable>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <PrimaryButton title="Back" variant="outline" onPress={() => setStep(1)} />
              <PrimaryButton title="Continue" onPress={() => setStep(3)} style={{ flex: 1 }} />
            </View>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={typography.subhead}>
              Leave empty if you prefer to configure Kasri wholesale payouts later in Settings.
            </Text>
            <TextInput
              value={mpesaPaybill}
              onChangeText={setMpesaPaybill}
              placeholder="M-Pesa Paybill / Till (optional)"
              placeholderTextColor={colors.tertiaryLabel as string}
              style={inputCls}
            />
            <TextInput
              value={tigoLipaNumber}
              onChangeText={setTigoLipaNumber}
              placeholder="Mixx / Tigo Lipa Number (optional)"
              placeholderTextColor={colors.tertiaryLabel as string}
              style={inputCls}
            />
            <TextInput
              value={bankName}
              onChangeText={setBankName}
              placeholder="Bank Name (optional)"
              placeholderTextColor={colors.tertiaryLabel as string}
              style={inputCls}
            />
            <TextInput
              value={bankAccount}
              onChangeText={setBankAccount}
              placeholder="Bank Account Number (optional)"
              placeholderTextColor={colors.tertiaryLabel as string}
              style={inputCls}
            />
            <Host matchContents seedColor={brand.accent}>
              <Switch
                value={vatRegistered}
                onValueChange={setVatRegistered}
                label="TRA VAT Registered"
              />
            </Host>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs }}>
              <PrimaryButton title="Back" variant="outline" onPress={() => setStep(2)} />
              <PrimaryButton
                title="Finish & Open Workspace"
                loading={busy}
                onPress={completeOnboarding}
                style={{ flex: 1 }}
              />
            </View>
          </>
        )}
      </View>
    </KeyboardAwareScrollView>
  );
}
