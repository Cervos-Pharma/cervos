import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { FieldGroup, Host, ListItem, Slider, Switch } from "@expo/ui";
import { formatTzs } from "@cervos/core";
import { PrimaryButton } from "@/components/primary-button";
import { useMobileSession } from "@/context/session-context";
import { postWorkspaceAction } from "@/services/api";
import { printReceiptNative } from "@/services/receipts";
import { playSoundCue } from "@/services/sounds";
import { colors, radius, spacing, typography, useBrandColors } from "@/theme";

type SettingsScope = "profile" | "hardware" | "support";

export default function SettingsScreen() {
  const { scope } = useLocalSearchParams<{ scope?: string }>();
  const initialScope: SettingsScope =
    scope === "hardware" ? "hardware" : scope === "support" ? "support" : "profile";
  const [activeScope, setActiveScope] = useState<SettingsScope>(initialScope);

  const { workspace, activeCentre, lang, prefs, updatePrefs, toggleLanguage, refreshState } =
    useMobileSession();
  const brand = useBrandColors(workspace?.account?.customization?.brandAccent);
  const isSw = lang === "SW";

  // Support Desk Ticket state
  const [ticketSub, setTicketSub] = useState("");
  const [ticketBody, setTicketBody] = useState("");
  const [ticketBusy, setTicketBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const submitTicket = async () => {
    if (!ticketSub.trim() || !ticketBody.trim()) {
      setNotice("Enter both subject and message.");
      return;
    }
    setTicketBusy(true);
    try {
      const res = await postWorkspaceAction({
        action: "submit_support_ticket",
        subject: ticketSub.trim(),
        message: ticketBody.trim(),
        category: "technical",
      });
      if (res.ok) {
        setTicketSub("");
        setTicketBody("");
        setNotice("Support ticket dispatched to Cervos HQ.");
        await playSoundCue("notify");
      } else {
        setNotice(res.data?.error || "Could not submit ticket.");
      }
    } finally {
      setTicketBusy(false);
    }
  };

  const inputStyle = {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.tertiaryBackground,
    paddingHorizontal: spacing.md,
    color: colors.label,
    fontSize: 14,
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 48 }}
    >
      {/* Scope Pill Switcher */}
      <View
        style={{
          flexDirection: "row",
          padding: 4,
          borderRadius: radius.full,
          backgroundColor: colors.tertiaryBackground,
          gap: 4,
        }}
      >
        {(
          [
            { id: "profile", label: isSw ? "Wasifu & Sauti" : "Profile & Audio" },
            { id: "hardware", label: isSw ? "Printa & POS" : "POS Hardware" },
            { id: "support", label: isSw ? "Msaada HQ" : "HQ Support" },
          ] as const
        ).map((tab) => {
          const active = activeScope === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => {
                setActiveScope(tab.id);
                setNotice(null);
              }}
              style={{
                flex: 1,
                minHeight: 36,
                borderRadius: radius.full,
                backgroundColor: active ? brand.accent : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: active ? colors.onTint : colors.secondaryLabel,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {notice && (
        <View
          style={{
            padding: spacing.md,
            borderRadius: radius.lg,
            backgroundColor: brand.accentSoft,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: "600", color: brand.accent }}>{notice}</Text>
        </View>
      )}

      {activeScope === "profile" && (
        <Host matchContents seedColor={brand.accent}>
          <FieldGroup>
            <FieldGroup.Section title={isSw ? "Lugha & Mhudumu" : "Identity & Language"}>
              <ListItem supportingText={workspace?.account?.orgName}>
                {workspace?.activeProfile?.displayName || "Operator"}
              </ListItem>
              <ListItem
                supportingText={lang === "SW" ? "Kiswahili" : "English"}
                onPress={() => void toggleLanguage()}
              >
                {isSw ? "Badili Lugha (EN / SW)" : "Switch Language (EN / SW)"}
              </ListItem>
            </FieldGroup.Section>

            <FieldGroup.Section title={isSw ? "Sauti & Miguso" : "Sound Effects & Haptics"}>
              <Switch
                value={!prefs.soundMuted}
                onValueChange={(enabled) => updatePrefs({ soundMuted: !enabled })}
                label={isSw ? "Sauti za Vitendo" : "Play App Sound Cues"}
              />
              <Slider
                value={prefs.soundVolume}
                min={0}
                max={1}
                onValueChange={(v) => updatePrefs({ soundVolume: v })}
              />
              <Switch
                value={prefs.hapticsEnabled}
                onValueChange={(v) => updatePrefs({ hapticsEnabled: v })}
                label={isSw ? "Mtetemo (Haptics)" : "Tactile Haptics"}
              />
              <ListItem onPress={() => void playSoundCue("sale-complete")}>
                {isSw ? "Jaribu Sauti ya Mauzo" : "Preview Sale Chime"}
              </ListItem>
            </FieldGroup.Section>
          </FieldGroup>
        </Host>
      )}

      {activeScope === "hardware" && (
        <View style={{ gap: spacing.md }}>
          <View
            style={{
              padding: spacing.md,
              borderRadius: radius.xl,
              borderCurve: "continuous",
              backgroundColor: colors.secondaryGroupedBackground,
              gap: spacing.sm,
            }}
          >
            <Text style={typography.overline}>THERMAL RECEIPT PAPER WIDTH</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {([58, 80] as const).map((mm) => (
                <Pressable
                  key={mm}
                  onPress={() => {
                    updatePrefs({ paperWidthMm: mm });
                    setNotice(`Receipt width set to ${mm}mm thermal roll.`);
                  }}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    borderRadius: radius.md,
                    backgroundColor:
                      prefs.paperWidthMm === mm ? brand.accent : colors.tertiaryBackground,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontWeight: "700",
                      color: prefs.paperWidthMm === mm ? colors.onTint : colors.label,
                    }}
                  >
                    {mm}mm Roll
                  </Text>
                </Pressable>
              ))}
            </View>

            <PrimaryButton
              title={isSw ? "Chapisha Risiti ya Majaribio" : "Print Test Receipt Slip"}
              onPress={() =>
                void printReceiptNative({
                  orgName: workspace?.account?.orgName || "Cervos Pharmacy",
                  branchName: activeCentre?.name || "Main Branch",
                  paperWidthMm: prefs.paperWidthMm,
                  sale: {
                    id: "test-print",
                    actorName: workspace?.activeProfile?.displayName || "Staff",
                    receiptNumber: "TEST-001",
                    customerName: "Printer Diagnostics",
                    totalTzs: 2500,
                    itemCount: 1,
                    paymentMethod: "cash",
                    lines: [
                      {
                        productId: "sample",
                        brandName: "Paracetamol 500mg",
                        category: "Analgesics",
                        batchNumber: "DIAG-01",
                        qty: 1,
                        unitPriceTzs: 2500,
                        unitCostTzs: 1800,
                      },
                    ],
                    createdAt: new Date().toISOString(),
                  },
                })
              }
            />
          </View>

          <View
            style={{
              padding: spacing.md,
              borderRadius: radius.xl,
              borderCurve: "continuous",
              backgroundColor: colors.secondaryGroupedBackground,
              gap: 6,
            }}
          >
            <Text style={typography.overline}>TROUBLESHOOTING</Text>
            <Text style={typography.subhead}>
              1. Pair Bluetooth thermal printer in phone OS Settings first, or enable OS Print Service.
            </Text>
            <Text style={typography.subhead}>
              2. If receipt wraps awkwardly, switch between 58mm and 80mm roll width above.
            </Text>
            <Text style={typography.subhead}>
              3. Plan status: {workspace?.account?.subscriptionPlan?.toUpperCase()} ({formatTzs(0)} local fees).
            </Text>
          </View>
        </View>
      )}

      {activeScope === "support" && (
        <View
          style={{
            padding: spacing.md,
            borderRadius: radius.xl,
            borderCurve: "continuous",
            backgroundColor: colors.secondaryGroupedBackground,
            gap: spacing.sm,
          }}
        >
          <Text style={typography.overline}>CONTACT CERVOS HQ DESK</Text>
          <TextInput
            value={ticketSub}
            onChangeText={setTicketSub}
            placeholder="Subject (e.g. Receipt printer help)"
            placeholderTextColor={colors.tertiaryLabel as string}
            style={inputStyle}
          />
          <TextInput
            value={ticketBody}
            onChangeText={setTicketBody}
            placeholder="Describe your question or issue..."
            placeholderTextColor={colors.tertiaryLabel as string}
            multiline
            numberOfLines={4}
            style={[inputStyle, { minHeight: 110, paddingTop: 12, textAlignVertical: "top" }]}
          />
          <PrimaryButton
            title={ticketBusy ? "Sending..." : "Send Support Ticket"}
            loading={ticketBusy}
            onPress={() => void submitTicket()}
          />
          <PrimaryButton
            title="Refresh Account Sync"
            variant="outline"
            onPress={() => void refreshState()}
          />
        </View>
      )}
    </ScrollView>
  );
}
