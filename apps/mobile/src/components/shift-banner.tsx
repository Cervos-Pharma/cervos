import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { PrimaryButton } from "@/components/primary-button";
import { PlatformIcon } from "@/components/platform-icon";
import { useMobileSession } from "@/context/session-context";
import { postWorkspaceAction } from "@/services/api";
import { enqueueOfflineMutation } from "@/services/offline-db";
import { playSoundCue, triggerHaptic } from "@/services/sounds";
import { colors, radius, spacing, typography, useBrandColors } from "@/theme";

export function ShiftLaunchBanner() {
  const {
    workspace,
    lang,
    isOnline,
    activeCentre,
    activeShift,
    autoClockOutNotice,
    dismissAutoClockOutNotice,
    refreshState,
    syncNow,
  } = useMobileSession();

  const accentHex = workspace?.account?.customization?.brandAccent;
  const brand = useBrandColors(accentHex);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const isSw = lang === "SW";
  const branchName = activeCentre?.name || workspace?.account?.orgName || "Station";

  const handleClock = async (clockType: "in" | "out") => {
    if (busy) return;
    setBusy(true);
    try {
      if (!isOnline) {
        await enqueueOfflineMutation("shift_clock", {
          clockType,
          centreId: activeCentre?.id,
        });
        await playSoundCue("shift-clock");
        await triggerHaptic("success");
        if (clockType === "in") setDismissed(true);
        void syncNow();
        return;
      }

      const res = await postWorkspaceAction({ action: "shift_clock", clockType });
      if (res.ok) {
        await playSoundCue("shift-clock");
        await triggerHaptic("success");
        await refreshState();
      } else {
        await playSoundCue("alert");
        await triggerHaptic("error");
      }
    } finally {
      setBusy(false);
    }
  };

  if (dismissed && !activeShift && !autoClockOutNotice) {
    return null;
  }

  return (
    <View style={{ gap: spacing.sm }}>
      {autoClockOutNotice && (
        <View
          style={{
            padding: spacing.md,
            borderRadius: radius.lg,
            borderCurve: "continuous",
            backgroundColor: brand.warningSoft,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          <PlatformIcon sf="clock.badge.exclamationmark" md="schedule" color={brand.warning} size={18} />
          <Text style={{ flex: 1, fontSize: 13, color: colors.label }}>{autoClockOutNotice}</Text>
          <Pressable onPress={dismissAutoClockOutNotice} hitSlop={10}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: brand.warning }}>
              {isSw ? "Sawa" : "Dismiss"}
            </Text>
          </Pressable>
        </View>
      )}

      <View
        style={{
          padding: spacing.md,
          borderRadius: radius.xl,
          borderCurve: "continuous",
          backgroundColor: colors.secondaryGroupedBackground,
          gap: spacing.sm,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={[typography.overline, { color: brand.accent }]}>
            {activeShift
              ? isSw ? "ZAMU INAENDELEA" : "ON SHIFT"
              : isSw ? "UKAGUZI WA ZAMU" : "SHIFT CHECK-IN"}
          </Text>
          {activeShift && (
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: radius.full,
                backgroundColor: brand.successSoft,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "700", color: brand.success }}>
                {isSw ? "Tangu " : "In "}
                {activeShift.clockInAt.slice(11, 16)}
              </Text>
            </View>
          )}
        </View>

        <Text style={typography.headline}>
          {activeShift
            ? isSw
              ? `Uko kazini katika tawi la ${branchName}`
              : `Clocked in at ${branchName}`
            : isSw
              ? `Je, uko zamu sasa hivi katika ${branchName}?`
              : `Are you on shift right now at ${branchName}?`}
        </Text>

        <Text style={typography.subhead}>
          {activeShift
            ? isSw
              ? "Ukiacha app kwa saa 4+ bila shughuli, zamu hufungwa kiotomatiki."
              : "Staying away over 4 hours automatically clocks out your shift."
            : isSw
              ? "Anza zamu yako hapa nyumbani kabla ya kuuza kaunta."
              : "Clock in right here before selling at the counter."}
        </Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs }}>
          {activeShift ? (
            <PrimaryButton
              title={isSw ? "Maliza Zamu (Clock Out)" : "Clock Out Now"}
              variant="secondary"
              loading={busy}
              onPress={() => handleClock("out")}
              style={{ flex: 1 }}
            />
          ) : (
            <>
              <PrimaryButton
                title={isSw ? "Ndiyo, Anza Zamu" : "Yes, Clock In"}
                loading={busy}
                accentHex={accentHex}
                onPress={() => handleClock("in")}
                style={{ flex: 1 }}
              />
              <PrimaryButton
                title={isSw ? "Sipo Zamu" : "Not Now"}
                variant="outline"
                onPress={() => setDismissed(true)}
              />
            </>
          )}
        </View>
      </View>
    </View>
  );
}
