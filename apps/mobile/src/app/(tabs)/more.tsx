import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { FieldGroup, Host, ListItem } from "@expo/ui";
import { StationGuideModal } from "@/components/onboarding";
import { useMobileSession } from "@/context/session-context";
import { colors, spacing, typography, useBrandColors } from "@/theme";

export default function MoreHubScreen() {
  const router = useRouter();
  const { workspace, activeCentre, lang, pendingSync, syncNow, lockProfile, signOut } =
    useMobileSession();
  const [tourOpen, setTourOpen] = useState(false);
  const brand = useBrandColors(workspace?.account?.customization?.brandAccent);
  const isSw = lang === "SW";
  const profile = workspace?.activeProfile;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: brand.canvasBg }}
      contentContainerStyle={{ padding: spacing.md, paddingTop: 54, gap: spacing.md }}
    >
      <View style={{ gap: 2 }}>
        <Text style={typography.overline}>{workspace?.account?.orgName || "WORKSPACE"}</Text>
        <Text style={typography.title}>{profile?.displayName || "Operator"}</Text>
        <Text style={typography.subhead}>
          {(profile?.role || "").replace(/_/g, " ")} · {activeCentre?.name || "Main Branch"}
        </Text>
      </View>

      <Host matchContents seedColor={brand.accent}>
        <FieldGroup>
          <FieldGroup.Section title={isSw ? "Uendeshaji & Timu" : "Operations & Team"}>
            <ListItem
              supportingText={
                isSw
                  ? "Ujumbe wa tawi hili pekee & idhini"
                  : "Private chat for colleagues inside this branch"
              }
              onPress={() => router.push("/branch-chat")}
            >
              {isSw ? "Soga ya Tawi" : "Branch Chat"}
            </ListItem>
            <ListItem
              supportingText={
                isSw
                  ? "Faida, utabiri na hatari ya kuisha muda"
                  : "P&L margins, 7-day forecast & batch risk"
              }
              onPress={() => router.push("/reports")}
            >
              {isSw ? "Ripoti & Takwimu" : "Reports & Insights"}
            </ListItem>
            <ListItem
              supportingText={
                isSw
                  ? "Bohari zilizothibitishwa na maagizo ya Kasri"
                  : "Verified supplier catalog & Kasri escrow orders"
              }
              onPress={() => router.push("/wholesale")}
            >
              {isSw ? "Ununuzi wa Jumla (Wholesale)" : "Wholesale & Kasri"}
            </ListItem>
            <ListItem
              supportingText={
                isSw
                  ? "Hesabu ya droo mwisho wa zamu & rekodi ya matumizi"
                  : "Blind cash drawer count & 30d operating expenses"
              }
              onPress={() => router.push("/shift-close")}
            >
              {isSw ? "Funga Zamu & Matumizi" : "Shift Close & Expenses"}
            </ListItem>
            <ListItem
              supportingText={
                isSw
                  ? "Wahudumu, ruhusa za PIN, maombi na matawi"
                  : "Operators, permissions, Lounge approvals & branches"
              }
              onPress={() => router.push("/team")}
            >
              {isSw ? "Timu & Matawi" : "Team & Branches"}
            </ListItem>
            <ListItem
              supportingText={
                isSw
                  ? "Kifurushi cha Cervos & malipo ya PayMe USSD"
                  : "Active tier limits & PayMe mobile money checkout"
              }
              onPress={() => router.push("/billing")}
            >
              {isSw ? "Malipo & Kifurushi" : "Billing & Subscriptions"}
            </ListItem>
            <ListItem
              supportingText={
                isSw
                  ? "Vibali vya TMDA / Pharmacy Council & ukaguzi"
                  : "Submit operating permits & view compliance audit log"
              }
              onPress={() => router.push("/settings?scope=compliance")}
            >
              {isSw ? "Vibali & Ukaguzi" : "Permits & Audit Log"}
            </ListItem>
            <ListItem
              supportingText={
                pendingSync > 0
                  ? `${pendingSync} queued offline mutations`
                  : "All branch data up to date"
              }
              onPress={() => void syncNow()}
            >
              {isSw ? "Sawazisha Sasa" : "Sync Branch Data"}
            </ListItem>
          </FieldGroup.Section>

          <FieldGroup.Section title={isSw ? "Kituo & Akaunti" : "Station & Account"}>
            <ListItem
              supportingText={
                isSw
                  ? "Mwongozo wa hatua 5 za kaunta, stoo & zamu"
                  : "Interactive 5-step guide to shifts, POS & chat"
              }
              onPress={() => setTourOpen(true)}
            >
              {isSw ? "Mwongozo wa Kituo (Take the Tour)" : "Station Walkthrough"}
            </ListItem>
            <ListItem
              supportingText={
                isSw
                  ? "Printa ya risiti, sauti, PIN, na tiketi ya msaada"
                  : "Printer paper width, audio cues, PIN & HQ support"
              }
              onPress={() => router.push("/settings")}
            >
              {isSw ? "Mipangilio Yote" : "Settings & Hardware"}
            </ListItem>
            <ListItem
              supportingText={isSw ? "Badili mhudumu kwa PIN" : "Switch active operator PIN"}
              onPress={async () => {
                await lockProfile();
                router.replace("/gate");
              }}
            >
              {isSw ? "Funga Kaunta (Switch Profile)" : "Lock Station & Switch Profile"}
            </ListItem>
            <ListItem
              supportingText={workspace?.account?.email}
              onPress={async () => {
                await signOut();
                router.replace("/auth");
              }}
            >
              {isSw ? "Toka Kwenye Shirika" : "Sign Out Organization"}
            </ListItem>
          </FieldGroup.Section>
        </FieldGroup>
      </Host>
      <StationGuideModal
        isPresented={tourOpen}
        onClose={() => setTourOpen(false)}
      />
    </ScrollView>
  );
}
