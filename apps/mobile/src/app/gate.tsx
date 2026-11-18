import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import Storage from "expo-sqlite/kv-store";
import { useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { PlatformIcon } from "@/components/platform-icon";
import { PrimaryButton } from "@/components/primary-button";
import { useMobileSession } from "@/context/session-context";
import { getStoredTokens, postGateAction } from "@/services/api";
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
  const { workspace, lang, refreshState, signOut, setStationUnlocked } = useMobileSession();
  const brand = useBrandColors(workspace?.account?.customization?.brandAccent);
  const isSw = lang === "SW";

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

  const completeUnlock = async (profileId: string) => {
    try {
      Storage.setItemSync(LAST_PROFILE_KEY, profileId);
    } catch {
      // Ignore storage error
    }
    setStationUnlocked(true);
    await playSoundCue("scan");
    await triggerHaptic("success");
    await refreshState();
    router.replace("/(tabs)");
  };

  const handleUnlockPin = async () => {
    const targetId = selectedProfile?.id || selectedId;
    if (!targetId || pin.length < 4) {
      setError(
        isSw
          ? "Chagua wasifu na weka PIN yako ya tarakimu 4-6."
          : "Select your profile and tap your 4-6 digit PIN on the keypad."
      );
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (needSecCheck) {
        if (!secAnswer.trim()) {
          setError(isSw ? "Jibu swali la usalama kwanza." : "Enter your security answer first.");
          return;
        }
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
        setNeedSecCheck(false);
      }

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

      await completeUnlock(targetId);
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
      if (tokens.profileToken) {
        await completeUnlock(target.id);
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

  return (
    <KeyboardAwareScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 48 }}
    >
      <View style={{ gap: spacing.xs }}>
        <Text style={[typography.overline, { color: brand.accent }]}>
          {workspace?.account?.orgName || "CERVOS WORKSPACE"}
        </Text>
        <Text style={typography.title}>
          {isSw ? "Nani yupo kwenye kaunta?" : "Station PIN Lock"}
        </Text>
        <Text style={typography.subhead}>
          {isSw
            ? "Gusa jina lako kisha weka PIN kwenye kipad kufungua kituo."
            : "Select your operator profile and tap your PIN on the keypad to resume."}
        </Text>
      </View>

      {/* Operator Profile Selector */}
      <View style={{ gap: spacing.xs }}>
        {profiles.map((prof) => {
          const active = (selectedProfile?.id || selectedId) === prof.id;
          const branch = workspace?.centres?.find((c) => c.id === prof.centreId)?.name;
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
                paddingHorizontal: spacing.md,
                paddingVertical: 12,
                borderRadius: radius.lg,
                borderCurve: "continuous",
                backgroundColor: active ? brand.accentSoft : colors.secondaryGroupedBackground,
                borderWidth: active ? 1.5 : 1,
                borderColor: active ? brand.accent : brand.staticBorder,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ gap: 2 }}>
                <Text style={typography.headline}>{prof.displayName}</Text>
                <Text style={typography.caption}>
                  {prof.role.replace(/_/g, " ")} {branch ? `· ${branch}` : ""}
                </Text>
              </View>
              {active && (
                <PlatformIcon sf="checkmark.circle.fill" md="check-circle" color={brand.accent} size={22} />
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Tactile PIN Pad Card */}
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
        <View style={{ alignItems: "center", gap: spacing.sm }}>
          <Text style={typography.overline}>
            {selectedProfile
              ? `${isSw ? "PIN YA" : "PIN FOR"} ${selectedProfile.displayName.toUpperCase()}`
              : isSw ? "WEKA PIN" : "ENTER OPERATOR PIN"}
          </Text>

          {/* 6 PIN Dot Indicators */}
          <View
            style={{
              flexDirection: "row",
              gap: 14,
              paddingVertical: 12,
              paddingHorizontal: 24,
              borderRadius: radius.lg,
              backgroundColor: colors.tertiaryBackground,
            }}
          >
            {Array.from({ length: 6 }).map((_, idx) => {
              const filled = idx < pin.length;
              return (
                <View
                  key={idx}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: filled ? brand.accent : brand.staticBorder,
                  }}
                />
              );
            })}
          </View>
        </View>

        {needSecCheck && workspace?.account?.securityQuestion && (
          <View style={{ gap: 6 }}>
            <Text style={typography.caption}>{workspace.account.securityQuestion}</Text>
            <TextInput
              value={secAnswer}
              onChangeText={setSecAnswer}
              placeholder={isSw ? "Jibu la usalama" : "Security check answer"}
              placeholderTextColor={colors.tertiaryLabel as string}
              style={{
                minHeight: 44,
                borderRadius: radius.md,
                borderCurve: "continuous",
                backgroundColor: colors.tertiaryBackground,
                paddingHorizontal: spacing.md,
                color: colors.label,
                fontSize: 14,
              }}
            />
          </View>
        )}

        {/* 3x4 PIN Pad */}
        <View style={{ gap: 8 }}>
          {PIN_ROWS.map((row, rIdx) => (
            <View key={rIdx} style={{ flexDirection: "row", gap: 8 }}>
              {row.map((key) => {
                const isUtil = key === "CLEAR" || key === "DEL";
                return (
                  <Pressable
                    key={key}
                    onPress={() => onPadPress(key)}
                    style={({ pressed }) => ({
                      flex: 1,
                      minHeight: 54,
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
                    })}
                  >
                    <Text
                      style={{
                        fontSize: isUtil ? 12 : 20,
                        fontWeight: isUtil ? "700" : "600",
                        color: isUtil ? colors.secondaryLabel : colors.label,
                      }}
                    >
                      {key === "CLEAR" ? (isSw ? "Futa" : "Clear") : key === "DEL" ? (isSw ? "Nyuma" : "Del") : key}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {error && (
          <Text style={{ color: brand.danger, fontSize: 13, fontWeight: "600", textAlign: "center" }}>
            {error}
          </Text>
        )}

        <PrimaryButton
          title={isSw ? "Fungua Kituo" : "Unlock Station"}
          loading={busy}
          disabled={pin.length < 4}
          accentHex={workspace?.account?.customization?.brandAccent}
          onPress={() => void handleUnlockPin()}
        />

        {biometricsAvail && (
          <PrimaryButton
            title={isSw ? "Fungua kwa Biometria / Face ID" : "Unlock with Face ID / Biometrics"}
            variant="secondary"
            onPress={() => void handleBiometricPrompt()}
          />
        )}
      </View>

      <PrimaryButton
        title={isSw ? "Toka Kwenye Shirika" : "Switch / Sign Out Organization"}
        variant="outline"
        onPress={async () => {
          await signOut();
          router.replace("/auth");
        }}
      />
    </KeyboardAwareScrollView>
  );
}
