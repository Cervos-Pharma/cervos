import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { BottomSheet, Column, Host, Text as UiText } from "@expo/ui";
import { PrimaryButton } from "@/components/primary-button";
import { PlatformIcon } from "@/components/platform-icon";
import { useMobileSession } from "@/context/session-context";
import { buildMobileTourSteps, computeStationChecklist } from "@/components/onboarding/steps";
import { triggerHaptic } from "@/services/sounds";
import { colors, radius, spacing, useBrandColors } from "@/theme";

interface StationGuideModalProps {
  isPresented: boolean;
  onClose: (markCompleted: boolean) => void;
}

export function StationGuideModal({ isPresented, onClose }: StationGuideModalProps) {
  const router = useRouter();
  const {
    workspace,
    activeCentre,
    lang,
    capabilities,
    activeShift,
    scopedBatches,
    scopedSales,
  } = useMobileSession();
  const brand = useBrandColors(workspace?.account?.customization?.brandAccent);
  const isSw = lang === "SW";
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    if (!isPresented) {
      setStepIdx(0);
    }
  }, [isPresented]);

  const steps = buildMobileTourSteps({
    orgName: workspace?.account?.orgName || "Cervos Pharma",
    branchName: activeCentre?.name || workspace?.account?.region || "Main Branch",
    lang,
    capabilities,
  });
  const current = steps[stepIdx] ?? steps[0];
  const isLast = stepIdx >= steps.length - 1;

  const checklist = computeStationChecklist({
    lang,
    capabilities,
    activeShift: activeShift ?? null,
    batchCount: scopedBatches.length,
    saleCount: scopedSales.length,
  });

  return (
    <Host seedColor={brand.accent}>
      <BottomSheet
        isPresented={isPresented}
        onDismiss={() => onClose(false)}
        snapPoints={["full"]}
      >
        <Column spacing={12}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: radius.full,
                backgroundColor: brand.accentSoft,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "700", color: brand.accent }}>
                {current.badge}
              </Text>
            </View>
            <Pressable onPress={() => onClose(true)}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.secondaryLabel }}>
                {isSw ? "Funga" : "Skip"}
              </Text>
            </Pressable>
          </View>

          <UiText textStyle={{ fontSize: 20, fontWeight: "700" }}>{current.title}</UiText>
          <Text style={{ fontSize: 14, color: colors.secondaryLabel, lineHeight: 20 }}>
            {current.body}
          </Text>

          <View
            style={{
              padding: spacing.sm,
              borderRadius: radius.md,
              backgroundColor: brand.accentSoft,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
            }}
          >
            <PlatformIcon sf="lightbulb.fill" md="tips-and-updates" color={brand.accent} size={16} />
            <Text style={{ flex: 1, fontSize: 12, fontWeight: "600", color: colors.label }}>
              {current.tip}
            </Text>
          </View>

          {current.actionLabel && current.route && (
            <Pressable
              onPress={() => {
                onClose(true);
                router.push(current.route!);
              }}
              style={{
                padding: spacing.sm,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: brand.accent,
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "700", color: brand.accent }}>
                {current.actionLabel}
              </Text>
            </Pressable>
          )}

          {/* Compact Getting Started Checklist */}
          <View
            style={{
              padding: spacing.sm,
              borderRadius: radius.lg,
              backgroundColor: colors.tertiaryBackground,
              gap: 6,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: colors.secondaryLabel }}>
              {isSw ? "HATUA ZA MWANZO" : "STATION READINESS"}
            </Text>
            {checklist.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  onClose(true);
                  router.push(item.route);
                }}
                style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 }}
              >
                <PlatformIcon
                  sf={item.done ? "checkmark.circle.fill" : "circle"}
                  md={item.done ? "check-circle" : "radio-button-unchecked"}
                  color={item.done ? brand.success : colors.tertiaryLabel}
                  size={16}
                />
                <Text
                  style={{
                    flex: 1,
                    fontSize: 12,
                    color: item.done ? colors.secondaryLabel : colors.label,
                    textDecorationLine: item.done ? "line-through" : "none",
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs }}>
            {stepIdx > 0 && (
              <Pressable
                onPress={() => {
                  void triggerHaptic("selection");
                  setStepIdx((s) => Math.max(0, s - 1));
                }}
                style={{
                  flex: 1,
                  minHeight: 46,
                  borderRadius: radius.full,
                  backgroundColor: colors.tertiaryBackground,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.label }}>
                  {isSw ? "Nyuma" : "Back"}
                </Text>
              </Pressable>
            )}
            <View style={{ flex: 2 }}>
              <PrimaryButton
                title={isLast ? (isSw ? "Maliza Mwongozo" : "Finish Tour") : (isSw ? "Inayofuata" : "Next Step")}
                onPress={() => {
                  void triggerHaptic("selection");
                  if (isLast) {
                    onClose(true);
                  } else {
                    setStepIdx((s) => s + 1);
                  }
                }}
              />
            </View>
          </View>
        </Column>
      </BottomSheet>
    </Host>
  );
}
