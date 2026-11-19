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

type SettingsScope = "profile" | "hardware" | "compliance" | "support";

export default function SettingsScreen() {
  const { scope } = useLocalSearchParams<{ scope?: string }>();
  const initialScope: SettingsScope =
    scope === "hardware"
      ? "hardware"
      : scope === "compliance"
        ? "compliance"
        : scope === "support"
          ? "support"
          : "profile";
  const [activeScope, setActiveScope] = useState<SettingsScope>(initialScope);

  const { workspace, activeCentre, capabilities, lang, prefs, updatePrefs, toggleLanguage, refreshState } =
    useMobileSession();
  const brand = useBrandColors(workspace?.account?.customization?.brandAccent);
  const isSw = lang === "SW";

  // Compliance permit state
  const [certDocType, setCertDocType] = useState("Pharmacy Council Operating Permit");
  const [certLicense, setCertLicense] = useState("");
  const [certFileName, setCertFileName] = useState("");
  const [certBusy, setCertBusy] = useState(false);

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
      style={{ flex: 1, backgroundColor: brand.canvasBg }}
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
            { id: "profile", label: isSw ? "Wasifu" : "Profile" },
            { id: "hardware", label: isSw ? "Printa" : "POS" },
            { id: "compliance", label: isSw ? "Vibali" : "Permits" },
            { id: "support", label: isSw ? "Msaada" : "Support" },
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
        <View style={{ gap: spacing.md }}>
          <View
            style={{
              padding: spacing.md,
              borderRadius: radius.xl,
              borderCurve: "continuous",
              backgroundColor: brand.cardBg,
              borderWidth: 1,
              borderColor: brand.borderColor,
              gap: spacing.sm,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: "800", letterSpacing: 1, color: brand.accent }}>
              {isSw ? "MUONEKANO & MAANDISHI" : "APPEARANCE & TEXT SCALE"}
            </Text>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {(
                [
                  { id: "light", label: "Light" },
                  { id: "dark", label: "Dark" },
                  { id: "system", label: "Auto" },
                ] as const
              ).map((m) => {
                const active = prefs.themePref === m.id;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => {
                      updatePrefs({ themePref: m.id });
                      void postWorkspaceAction({ action: "update_profile_settings", themePref: m.id }).catch(() => undefined);
                    }}
                    style={{
                      flex: 1,
                      minHeight: 38,
                      borderRadius: radius.full,
                      backgroundColor: active ? brand.accent : brand.cardSubtleBg,
                      borderWidth: 1,
                      borderColor: active ? brand.accent : brand.borderColor,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "700", color: active ? "#FFFFFF" : brand.textPrimary }}>
                      {m.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ flexDirection: "row", gap: 6 }}>
              {(
                [
                  { id: "compact", label: "Compact" },
                  { id: "standard", label: "Standard" },
                  { id: "large", label: "Large" },
                ] as const
              ).map((fs) => {
                const active = prefs.fontScale === fs.id;
                return (
                  <Pressable
                    key={fs.id}
                    onPress={() => {
                      updatePrefs({ fontScale: fs.id });
                      void postWorkspaceAction({ action: "update_profile_settings", fontScale: fs.id }).catch(() => undefined);
                    }}
                    style={{
                      flex: 1,
                      minHeight: 38,
                      borderRadius: radius.full,
                      backgroundColor: active ? brand.teal : brand.cardSubtleBg,
                      borderWidth: 1,
                      borderColor: active ? brand.teal : brand.borderColor,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "700", color: active ? "#FFFFFF" : brand.textPrimary }}>
                      {fs.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

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
        </View>
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

      {activeScope === "compliance" && (
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
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={typography.overline}>OPERATING PERMITS & NETWORK ACCESS</Text>
              <View
                style={{
                  paddingHorizontal: 9,
                  paddingVertical: 3,
                  borderRadius: radius.full,
                  backgroundColor: workspace?.account?.networkUnlocked ? brand.successSoft : brand.warningSoft,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: workspace?.account?.networkUnlocked ? brand.success : brand.warning,
                  }}
                >
                  {workspace?.account?.networkUnlocked ? "VERIFIED" : "PENDING PERMIT"}
                </Text>
              </View>
            </View>

            {(workspace?.account?.certificates ?? []).length === 0 ? (
              <Text style={typography.caption}>
                {isSw
                  ? "Hakuna kibali kilichopakiwa bado. Pakia hapa kufungua mtandao wa jumla."
                  : "No operating permit submitted yet. Register your Pharmacy Council or TMDA license to unlock wholesale."}
              </Text>
            ) : (
              (workspace?.account?.certificates ?? []).map((cert) => (
                <View
                  key={cert.id}
                  style={{
                    padding: spacing.sm,
                    borderRadius: radius.md,
                    backgroundColor: colors.tertiaryBackground,
                    gap: 2,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "700", color: colors.label }}>{cert.docType}</Text>
                  <Text style={typography.caption}>
                    License {cert.licenseNumber} · {cert.fileName} · {cert.status.toUpperCase()}
                  </Text>
                </View>
              ))
            )}

            {capabilities.canManageTeam && (
              <View style={{ gap: spacing.xs, paddingTop: 4 }}>
                <TextInput
                  value={certDocType}
                  onChangeText={setCertDocType}
                  placeholder="Permit Type (e.g. Pharmacy Council Permit)"
                  placeholderTextColor={colors.tertiaryLabel as string}
                  style={inputStyle}
                />
                <TextInput
                  value={certLicense}
                  onChangeText={setCertLicense}
                  placeholder="License Number (e.g. PC-TZ-4821)"
                  placeholderTextColor={colors.tertiaryLabel as string}
                  style={inputStyle}
                />
                <TextInput
                  value={certFileName}
                  onChangeText={setCertFileName}
                  placeholder="Document Reference / Filename (e.g. permit-2026.pdf)"
                  placeholderTextColor={colors.tertiaryLabel as string}
                  style={inputStyle}
                />
                <PrimaryButton
                  title={certBusy ? "..." : isSw ? "Wasilisha Kibali" : "Submit Operating Permit"}
                  loading={certBusy}
                  onPress={async () => {
                    if (certLicense.trim().length < 3 || certFileName.trim().length < 3) {
                      setNotice("Enter valid license number and document reference.");
                      return;
                    }
                    setCertBusy(true);
                    setNotice(null);
                    try {
                      const res = await postWorkspaceAction({
                        action: "upload_certificates",
                        docType: certDocType.trim() || "Operating Permit",
                        licenseNumber: certLicense.trim(),
                        fileName: certFileName.trim(),
                      });
                      if (!res.ok) {
                        setNotice(res.data?.error || "Could not submit certificate.");
                        return;
                      }
                      setCertLicense("");
                      setCertFileName("");
                      await playSoundCue("sale-complete");
                      setNotice("Operating permit registered & verified.");
                      await refreshState();
                    } finally {
                      setCertBusy(false);
                    }
                  }}
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
              gap: spacing.xs,
            }}
          >
            <Text style={typography.overline}>ORGANIZATION AUDIT TRAIL</Text>
            {(workspace?.auditLogs ?? []).length === 0 ? (
              <Text style={typography.caption}>
                {isSw ? "Rekodi za ukaguzi huonekana kwa akaunti ya mmiliki." : "Audit logs are visible in active owner sessions."}
              </Text>
            ) : (
              (workspace?.auditLogs ?? []).slice(0, 12).map((log) => (
                <View
                  key={log.id}
                  style={{
                    paddingVertical: 6,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.separator,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.label }}>
                    [{log.category}] {log.action}
                  </Text>
                  <Text style={typography.caption}>
                    {log.actor} · {log.createdAt.slice(0, 16).replace("T", " ")}
                  </Text>
                </View>
              ))
            )}
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
