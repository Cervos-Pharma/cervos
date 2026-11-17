import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useMobileSession } from "../../src/context/MobileSessionContext";
import { postWorkspaceAction } from "../../src/services/api";
import { triggerLocalAlertNotification } from "../../src/services/offlineSync";
import { CERVOS_COLORS, TOUCH_MIN_HEIGHT } from "../../src/theme/tokens";

export default function MobilePermitsSyncScreen() {
  const router = useRouter();
  const { workspaceState, lang, setLang, isDark, pendingSync, lastSyncedAt, syncNow, signOut } = useMobileSession();
  const isSw = lang === "SW";
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const account = (workspaceState?.account as {
    orgName?: string;
    verificationStatus?: string;
    certificates?: Array<{ id: string; docType: string; licenseNumber: string; uploadedAt: string }>;
  } | undefined) || {};

  const bg = isDark ? CERVOS_COLORS.darkBg : CERVOS_COLORS.lightBg;
  const card = isDark ? CERVOS_COLORS.darkCard : CERVOS_COLORS.lightCard;
  const border = isDark ? CERVOS_COLORS.darkBorder : CERVOS_COLORS.lightBorder;
  const text = isDark ? CERVOS_COLORS.darkText : CERVOS_COLORS.lightText;
  const muted = isDark ? CERVOS_COLORS.darkMuted : CERVOS_COLORS.lightMuted;

  const runSync = async () => {
    const out = await syncNow();
    setSyncMsg(`Synced cleanly (${out.pushed} pushed, ${out.remaining} pending).`);
  };

  const toggleLanguage = async () => {
    const next = lang === "SW" ? "EN" : "SW";
    setLang(next);
    await postWorkspaceAction({ action: "update_lang", lang: next }).catch(() => undefined);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: text }]}>
        {isSw ? "Leseni, Sync & Mwongozo" : "Permits, Sync & Help"}
      </Text>

      <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
        <Text style={[styles.tag, { color: CERVOS_COLORS.cobalt }]}>OFFLINE SYNC &amp; NOTIFICATIONS</Text>
        <Text style={{ color: text, fontWeight: "700" }}>
          {pendingSync === 0 ? "All records synced cleanly" : `${pendingSync} offline transaction(s) queued`}
        </Text>
        <Text style={{ color: muted, fontSize: 12 }}>
          Last sync: {lastSyncedAt ? lastSyncedAt.slice(11, 19) : "Ready"} &middot; Daily 18:00 SMS digest sender: Nama
        </Text>
        {syncMsg && <Text style={{ color: CERVOS_COLORS.emerald, fontWeight: "600", fontSize: 12 }}>{syncMsg}</Text>}
        <TouchableOpacity onPress={runSync} style={[styles.btn, { backgroundColor: CERVOS_COLORS.cobalt }]}>
          <Text style={styles.btnText}>{isSw ? "Sawazisha Sasa (Sync)" : "Sync Queue Now"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => void triggerLocalAlertNotification("Cervos Pharma", "Alert channel healthy on this phone.")}
          style={[styles.secondaryBtn, { borderColor: border }]}
        >
          <Text style={{ color: text, fontWeight: "700", fontSize: 13 }}>
            {isSw ? "Jaribu Arifa (Notification)" : "Test Push Notification"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
        <Text style={[styles.tag, { color: CERVOS_COLORS.cobalt }]}>TMDA / OPERATING PERMITS</Text>
        <Text style={{ color: text, fontWeight: "700" }}>
          Status: {account.verificationStatus === "verified" ? "Verified" : "Pending Upload"}
        </Text>
        {(account.certificates || []).map((c) => (
          <Text key={c.id} style={{ color: muted, fontSize: 12 }}>
            &bull; {c.docType} ({c.licenseNumber})
          </Text>
        ))}
      </View>

      <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
        <TouchableOpacity onPress={toggleLanguage} style={[styles.secondaryBtn, { borderColor: border }]}>
          <Text style={{ color: text, fontWeight: "700" }}>
            {isSw ? "Badili Lugha: Kiswahili -> English" : "Switch Language: English -> Kiswahili"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/onboarding")} style={[styles.secondaryBtn, { borderColor: border }]}>
          <Text style={{ color: text, fontWeight: "700" }}>
            {isSw ? "Fungua Mwongozo wa Matumizi" : "Open App Tutorial & Guide"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={async () => {
            await signOut();
            router.replace("/onboarding");
          }}
          style={[styles.secondaryBtn, { borderColor: CERVOS_COLORS.rose }]}
        >
          <Text style={{ color: CERVOS_COLORS.rose, fontWeight: "700" }}>{isSw ? "Toka Nje" : "Sign Out"}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 18, paddingTop: 54, paddingBottom: 32, gap: 14 },
  title: { fontSize: 22, fontWeight: "700" },
  card: { borderRadius: 20, borderWidth: 1, padding: 18, gap: 10 },
  tag: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  btn: { minHeight: TOUCH_MIN_HEIGHT, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  btnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  secondaryBtn: { minHeight: TOUCH_MIN_HEIGHT, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
