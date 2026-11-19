import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import Storage from "expo-sqlite/kv-store";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PlatformIcon } from "@/components/platform-icon";
import { PrimaryButton } from "@/components/primary-button";
import { useMobileSession } from "@/context/session-context";
import { getStoredTokens, postGateAction } from "@/services/api";
import { saveOfflinePinVerifier, verifyOfflinePin } from "@/services/offline-db";
import { playSoundCue, triggerHaptic } from "@/services/sounds";
import { colors, radius, spacing, typography, useBrandColors } from "@/theme";

const LAST_PROFILE_KEY = "cervos_last_gate_profile_v1";

const PIN_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["CLEAR", "0", "DEL"],
] as const;

export default function GateLockScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { workspace, lang, isOnline, refreshState, signOut, setStationUnlocked } = useMobileSession();
  const brand = useBrandColors(workspace?.account?.customization?.brandAccent);
  const isSw = lang === "SW";
  const isCompactViewport = windowHeight < 710;
  const keyHeight = isCompactViewport ? 46 : 54;

  const [selectedId, setSelectedId] = useState<string>(() => {
    try {
      return Storage.getItemSync(LAST_PROFILE_KEY) || workspace?.profiles?.[0]?.id || "";
    } catch {
      return workspace?.profiles?.[0]?.id || "";
    }
  });
  const [pin, setPin] = useState("");
  const [secAnswer, setSecAnswer] = useState("");
  const [needSecCheck, setNeedSecCheck] = useState(false);
  const [biometricsAvail, setBiometricsAvail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profiles = workspace?.profiles ?? [];
  const selectedProfile = profiles.find((p) => p.id === selectedId) ?? profiles[0];

  useEffect(() => {
    if (!profiles.length) return;
    if (!selectedId || !profiles.some((p) => p.id === selectedId)) {
      let restored = profiles[0].id;
      try {
        const saved = Storage.getItemSync(LAST_PROFILE_KEY);
        if (saved && profiles.some((p) => p.id === saved)) {
          restored = saved;
        }
      } catch {
        // Ignore storage error
      }
      setSelectedId(restored);
    }
  }, [profiles, selectedId]);

  useEffect(() => {
    void (async () => {
      const [hw, enrolled, tokens] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        getStoredTokens(),
      ]);
      setBiometricsAvail(Boolean(hw && enrolled && tokens.profileToken));
      if (workspace?.account?.requireSecurityEveryTime || !tokens.trustToken) {
        setNeedSecCheck(Boolean(workspace?.account?.securityQuestion));
      } else {
        setNeedSecCheck(false);
      }
    })();
  }, [workspace?.account?.requireSecurityEveryTime, workspace?.account?.securityQuestion]);

  const completeUnlock = async (profileId: string, skipRefresh = false) => {
    try {
      Storage.setItemSync(LAST_PROFILE_KEY, profileId);
    } catch {
      // Ignore storage error
    }
    setStationUnlocked(true);
    await playSoundCue("scan");
    await triggerHaptic("success");
    if (!skipRefresh && isOnline) {
      await refreshState().catch(() => undefined);
    }
    router.replace("/(tabs)");
  };

  const handleVerifySecurity = async () => {
    if (!secAnswer.trim()) {
      setError(isSw ? "Jibu swali la usalama kwanza." : "Enter your security answer first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const secRes = await postGateAction({
        action: "verify_security",
        answer: secAnswer.trim(),
        rememberBrowser: true,
        directUnlock: false,
      });
      if (!secRes.ok) {
        await playSoundCue("alert");
        await triggerHaptic("error");
        setError(secRes.data?.error || "Security check did not match.");
        return;
      }
      await triggerHaptic("success");
      setNeedSecCheck(false);
    } finally {
      setBusy(false);
    }
  };

  const handleUnlockPin = async () => {
    const targetId = selectedProfile?.id || selectedId;
    if (!targetId || pin.length < 4) {
      setError(
        isSw
          ? "Chagua wasifu na weka PIN yako ya tarakimu 4-6."
          : "Select your profile and tap your 4-6 digit PIN."
      );
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (isOnline) {
        try {
          const res = await postGateAction({
            action: "unlock_profile",
            centreId: selectedProfile?.centreId || workspace?.activeCentreId || undefined,
            profileId: targetId,
            pin,
          });

          if (!res.ok) {
            await playSoundCue("alert");
            await triggerHaptic("error");
            setPin("");
            setError(res.data?.error || (isSw ? "PIN si sahihi. Jaribu tena." : "Incorrect PIN. Try again."));
            return;
          }

          await saveOfflinePinVerifier(targetId, pin);
          await completeUnlock(targetId);
          return;
        } catch {
          // Fall through to offline verifier if network timed out or unreachable
        }
      }

      const okOffline = await verifyOfflinePin(targetId, pin);
      if (!okOffline) {
        await playSoundCue("alert");
        await triggerHaptic("error");
        setPin("");
        setError(
          isSw
            ? "Nje ya mtandao: tumia PIN iliyokwisha fungua kifaa hiki."
            : "Offline unlock failed. Enter the PIN previously used on this device."
        );
        return;
      }
      await completeUnlock(targetId, true);
    } finally {
      setBusy(false);
    }
  };

  const handleBiometricPrompt = async () => {
    const target = selectedProfile;
    if (!target) return;
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: isSw ? `Fungua ${target.displayName}` : `Unlock ${target.displayName}`,
      cancelLabel: isSw ? "Tumia PIN" : "Use PIN Pad",
    });
    if (res.success) {
      const tokens = await getStoredTokens();
      if (tokens.profileToken || (!isOnline && workspace?.profiles?.some((p) => p.id === target.id))) {
        await completeUnlock(target.id, !isOnline);
      } else {
        setError(
          isSw
            ? "Weka PIN yako mara moja kuunganisha kifaa hiki."
            : "Enter your PIN once on the keypad to bind this device session."
        );
      }
    }
  };

  const onPadPress = (key: string) => {
    if (busy) return;
    setError(null);
    void triggerHaptic("selection");
    if (key === "CLEAR") {
      setPin("");
      return;
    }
    if (key === "DEL") {
      setPin((cur) => cur.slice(0, -1));
      return;
    }
    setPin((cur) => (cur.length < 6 ? `${cur}${key}` : cur));
  };

  const adaptiveDotCount = Math.max(4, Math.min(6, pin.length));

  const renderHeader = () => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.sm,
      }}
    >
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[typography.overline, { color: brand.accent }]} numberOfLines={1}>
          {workspace?.account?.orgName || "CERVOS WORKSPACE"}
        </Text>
        <Text style={{ fontSize: 20, fontWeight: "700", color: colors.label, letterSpacing: -0.3 }} numberOfLines={1}>
          {isSw ? "Fungua Kituo" : "Station PIN Lock"}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isSw ? "Toka Kwenye Shirika" : "Switch Organization"}
        onPress={async () => {
          await signOut();
          router.replace("/auth");
        }}
        style={({ pressed }) => ({
          minHeight: 36,
          paddingHorizontal: 12,
          borderRadius: radius.full,
          borderWidth: 1,
          borderColor: colors.separator,
          backgroundColor: pressed ? colors.tertiaryBackground : colors.secondaryGroupedBackground,
          alignItems: "center",
          justifyContent: "center",
        })}
      >
        <Text style={{ fontSize: 12, fontWeight: "600", color: colors.secondaryLabel }}>
          {isSw ? "Badili Shirika" : "Switch Org"}
        </Text>
      </Pressable>
    </View>
  );

  if (needSecCheck && workspace?.account?.securityQuestion) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{
          flex: 1,
          backgroundColor: colors.groupedBackground,
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
          paddingBottom: Math.max(insets.bottom, spacing.md),
          justifyContent: "space-between",
        }}
      >
        {renderHeader()}

        <View
          style={{
            padding: spacing.md,
            borderRadius: radius.xl,
            borderCurve: "continuous",
            backgroundColor: colors.secondaryGroupedBackground,
            borderWidth: 1,
            borderColor: brand.staticBorder,
            gap: spacing.md,
          }}
        >
          <View style={{ gap: 4 }}>
            <Text style={[typography.overline, { color: brand.accent }]}>
              {isSw ? "HATUA YA USALAMA" : "DEVICE SECURITY CHECK"}
            </Text>
            <Text style={typography.headline}>{workspace.account.securityQuestion}</Text>
          </View>

          <TextInput
            value={secAnswer}
            onChangeText={(val) => {
              setSecAnswer(val);
              if (error) setError(null);
            }}
            placeholder={isSw ? "Jibu la usalama" : "Enter security answer"}
            placeholderTextColor={colors.tertiaryLabel as string}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => void handleVerifySecurity()}
            style={{
              minHeight: 46,
              borderRadius: radius.md,
              borderCurve: "continuous",
              backgroundColor: colors.tertiaryBackground,
              paddingHorizontal: spacing.md,
              color: colors.label,
              fontSize: 15,
            }}
          />

          {error && (
            <Text style={{ color: brand.danger, fontSize: 13, fontWeight: "600" }}>{error}</Text>
          )}

          <PrimaryButton
            title={isSw ? "Thibitisha & Endelea" : "Verify & Continue"}
            loading={busy}
            disabled={!secAnswer.trim()}
            accentHex={workspace?.account?.customization?.brandAccent}
            onPress={() => void handleVerifySecurity()}
          />
        </View>

        <View />
      </KeyboardAvoidingView>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.groupedBackground,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.xs,
        paddingBottom: Math.max(insets.bottom, spacing.sm),
        justifyContent: "space-between",
        gap: isCompactViewport ? spacing.xs : spacing.sm,
      }}
    >
      {renderHeader()}

      {/* Horizontal Operator Profile Chips (no vertical stack overflow) */}
      {profiles.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ gap: spacing.xs, paddingVertical: 2 }}
        >
          {profiles.map((prof) => {
            const active = (selectedProfile?.id || selectedId) === prof.id;
            const initials = prof.displayName
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            return (
              <Pressable
                key={prof.id}
                onPress={() => {
                  setSelectedId(prof.id);
                  setPin("");
                  setError(null);
                  void triggerHaptic("selection");
                }}
                style={{
                  minHeight: 44,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: radius.full,
                  backgroundColor: active ? brand.accentSoft : colors.secondaryGroupedBackground,
                  borderWidth: active ? 1.5 : 1,
                  borderColor: active ? brand.accent : brand.staticBorder,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: active ? brand.accent : colors.tertiaryBackground,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: active ? colors.onTint : colors.secondaryLabel,
                    }}
                  >
                    {initials || "OP"}
                  </Text>
                </View>
                <View>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: active ? brand.accent : colors.label,
                    }}
                    numberOfLines={1}
                  >
                    {prof.displayName}
                  </Text>
                  <Text
                    style={{
                      fontSize: 10,
                      color: colors.secondaryLabel,
                      textTransform: "capitalize",
                    }}
                    numberOfLines={1}
                  >
                    {prof.role.replace(/_/g, " ")}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Tactile Single-Viewport PIN Pad Card */}
      <View
        style={{
          flex: 1,
          maxHeight: 500,
          justifyContent: "space-between",
          padding: isCompactViewport ? 12 : spacing.md,
          borderRadius: radius.xl,
          borderCurve: "continuous",
          backgroundColor: colors.secondaryGroupedBackground,
          borderWidth: 1,
          borderColor: brand.staticBorder,
          gap: isCompactViewport ? 8 : spacing.sm,
        }}
      >
        <View style={{ alignItems: "center", gap: 6 }}>
          <Text style={typography.overline} numberOfLines={1}>
            {selectedProfile
              ? `${isSw ? "PIN YA" : "PIN FOR"} ${selectedProfile.displayName.toUpperCase()}`
              : isSw ? "WEKA PIN" : "ENTER OPERATOR PIN"}
          </Text>

          {/* Adaptive 4-to-6 Digit PIN Indicator (never shows trailing empty boxes at 4 digits) */}
          <View
            accessibilityLabel={
              isSw ? `Tarakimu ${pin.length} za PIN zimeingizwa` : `${pin.length} PIN digits entered`
            }
            style={{
              minHeight: 38,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              paddingHorizontal: 22,
              borderRadius: radius.full,
              backgroundColor: colors.tertiaryBackground,
            }}
          >
            {Array.from({ length: adaptiveDotCount }).map((_, idx) => {
              const filled = idx < pin.length;
              return (
                <View
                  key={idx}
                  style={{
                    width: filled ? 13 : 11,
                    height: filled ? 13 : 11,
                    borderRadius: 7,
                    backgroundColor: filled ? brand.accent : "transparent",
                    borderWidth: filled ? 0 : 1.5,
                    borderColor: filled ? brand.accent : brand.staticMuted,
                  }}
                />
              );
            })}
          </View>

          <Text style={{ fontSize: 11, color: error ? brand.danger : colors.tertiaryLabel, fontWeight: error ? "600" : "400", textAlign: "center" }} numberOfLines={1}>
            {error || (isSw ? "Tarakimu 4 hadi 6" : "4 to 6 digits")}
          </Text>
        </View>

        {/* Responsive 3x4 Numeric Keypad */}
        <View style={{ width: "100%", maxWidth: 320, alignSelf: "center", gap: isCompactViewport ? 6 : 8 }}>
          {PIN_ROWS.map((row, rIdx) => (
            <View key={rIdx} style={{ flexDirection: "row", gap: isCompactViewport ? 6 : 8 }}>
              {row.map((key) => {
                const isClear = key === "CLEAR";
                const isDel = key === "DEL";
                const isUtil = isClear || isDel;
                const utilDisabled = isUtil && pin.length === 0;
                return (
                  <Pressable
                    key={key}
                    disabled={utilDisabled || busy}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isClear
                        ? isSw ? "Futa PIN" : "Clear PIN"
                        : isDel
                          ? isSw ? "Futa tarakimu" : "Backspace"
                          : key
                    }
                    onPress={() => onPadPress(key)}
                    style={({ pressed }) => ({
                      flex: 1,
                      height: keyHeight,
                      borderRadius: radius.lg,
                      borderCurve: "continuous",
                      backgroundColor: pressed
                        ? brand.accentSoft
                        : isUtil
                          ? colors.groupedBackground
                          : colors.tertiaryBackground,
                      borderWidth: 1,
                      borderColor: brand.staticBorder,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: utilDisabled ? 0.45 : 1,
                      transform: [{ scale: pressed && !utilDisabled ? 0.96 : 1 }],
                    })}
                  >
                    {isDel ? (
                      <PlatformIcon
                        sf="delete.left"
                        md="backspace"
                        color={colors.secondaryLabel}
                        size={20}
                      />
                    ) : (
                      <Text
                        style={{
                          fontSize: isClear ? 12 : 21,
                          fontWeight: isClear ? "700" : "600",
                          color: isClear ? colors.secondaryLabel : colors.label,
                        }}
                      >
                        {isClear ? (isSw ? "Futa" : "Clear") : key}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* Bottom Unlock + Optional Biometric Row */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          <PrimaryButton
            title={isSw ? "Fungua Kituo" : "Unlock Station"}
            loading={busy}
            disabled={pin.length < 4}
            accentHex={workspace?.account?.customization?.brandAccent}
            onPress={() => void handleUnlockPin()}
            style={{ flex: 1 }}
          />
          {biometricsAvail && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isSw ? "Fungua kwa Biometria" : "Unlock with Biometrics"}
              disabled={busy}
              onPress={() => void handleBiometricPrompt()}
              style={({ pressed }) => ({
                width: 48,
                height: 46,
                borderRadius: radius.full,
                backgroundColor: pressed ? brand.accentSoft : colors.tertiaryBackground,
                borderWidth: 1,
                borderColor: brand.staticBorder,
                alignItems: "center",
                justifyContent: "center",
              })}
            >
              <PlatformIcon
                sf="faceid"
                md="fingerprint"
                color={brand.accent}
                size={22}
              />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}
