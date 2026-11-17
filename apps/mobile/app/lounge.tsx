import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useMobileSession } from "../src/context/MobileSessionContext";
import { fetchLoungeState, postLoungeAction } from "../src/services/api";
import { CERVOS_COLORS, TOUCH_MIN_HEIGHT } from "../src/theme/tokens";

export default function MobileLoungeScreen() {
  const router = useRouter();
  const { refreshWorkspace, signOut, isDark } = useMobileSession();
  const [reqInfo, setReqInfo] = useState<{
    status?: string;
    targetOrgName?: string;
    allocatedCentreName?: string;
    allocatedPinPreview?: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await fetchLoungeState();
    if (res.ok && res.data.joinRequest) {
      setReqInfo(res.data.joinRequest as typeof reqInfo);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const acceptAllocation = async () => {
    setBusy(true);
    try {
      const res = await postLoungeAction({ action: "accept_allocation" });
      if (res.ok) {
        await refreshWorkspace();
        router.replace("/(tabs)");
      }
    } finally {
      setBusy(false);
    }
  };

  const bg = isDark ? CERVOS_COLORS.darkBg : CERVOS_COLORS.lightBg;
  const card = isDark ? CERVOS_COLORS.darkCard : CERVOS_COLORS.lightCard;
  const border = isDark ? CERVOS_COLORS.darkBorder : CERVOS_COLORS.lightBorder;
  const text = isDark ? CERVOS_COLORS.darkText : CERVOS_COLORS.lightText;
  const muted = isDark ? CERVOS_COLORS.darkMuted : CERVOS_COLORS.lightMuted;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={styles.container}>
      <Text style={[styles.tag, { color: CERVOS_COLORS.cobalt }]}>CERVOS WELCOME LOUNGE</Text>
      <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
        <Text style={[styles.title, { color: text }]}>
          {reqInfo?.status === "approved"
            ? `Approved for ${reqInfo.allocatedCentreName}`
            : `Waiting for ${reqInfo?.targetOrgName || "Owner Review"}`}
        </Text>
        <Text style={{ color: muted, fontSize: 14, lineHeight: 20 }}>
          {reqInfo?.status === "approved"
            ? `Your station PIN is ready (${reqInfo.allocatedPinPreview || "****"}). Tap below to enter your pharmacy station.`
            : "The pharmacy owner can approve and assign your branch right from their Action Trail. Tap Refresh anytime."}
        </Text>

        {reqInfo?.status === "approved" ? (
          <TouchableOpacity onPress={acceptAllocation} disabled={busy} style={[styles.btn, { backgroundColor: CERVOS_COLORS.cobalt }]}>
            <Text style={styles.btnText}>{busy ? "Opening..." : "Accept & Enter Station ->"}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={load} style={[styles.btn, { backgroundColor: CERVOS_COLORS.cobalt }]}>
            <Text style={styles.btnText}>Refresh Status</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={async () => {
            await signOut();
            router.replace("/onboarding");
          }}
          style={[styles.secondaryBtn, { borderColor: border }]}
        >
          <Text style={{ color: text, fontWeight: "700" }}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 64, gap: 16 },
  tag: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  card: { borderRadius: 24, borderWidth: 1, padding: 22, gap: 14 },
  title: { fontSize: 22, fontWeight: "700" },
  btn: { minHeight: TOUCH_MIN_HEIGHT + 4, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  btnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  secondaryBtn: { minHeight: TOUCH_MIN_HEIGHT, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
