import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useMobileSession } from "../src/context/MobileSessionContext";
import { postGateAction } from "../src/services/api";
import { CERVOS_COLORS, TOUCH_MIN_HEIGHT } from "../src/theme/tokens";

export default function MobileGateScreen() {
  const router = useRouter();
  const { workspaceState, refreshWorkspace, isDark } = useMobileSession();
  const profiles = (workspaceState?.profiles as Array<{ id: string; displayName: string; role: string }>) || [];
  const [selectedProfileId, setSelectedProfileId] = useState<string>(profiles[0]?.id || "");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const bg = isDark ? CERVOS_COLORS.darkBg : CERVOS_COLORS.lightBg;
  const card = isDark ? CERVOS_COLORS.darkCard : CERVOS_COLORS.lightCard;
  const border = isDark ? CERVOS_COLORS.darkBorder : CERVOS_COLORS.lightBorder;
  const text = isDark ? CERVOS_COLORS.darkText : CERVOS_COLORS.lightText;
  const muted = isDark ? CERVOS_COLORS.darkMuted : CERVOS_COLORS.lightMuted;

  const unlockPin = async () => {
    const profileId = selectedProfileId || profiles[0]?.id;
    if (!profileId || pin.length < 4) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await postGateAction({ action: "unlock_profile", profileId, pin });
      if (!res.ok) {
        setErr(String(res.data?.error || "Invalid PIN."));
        return;
      }
      await refreshWorkspace();
      router.replace("/(tabs)");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={styles.container}>
      <Text style={[styles.tag, { color: CERVOS_COLORS.cobalt }]}>STATION SECURITY GATE</Text>
      <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
        <Text style={[styles.title, { color: text }]}>Select Profile &amp; Enter PIN</Text>

        {profiles.map((p) => (
          <TouchableOpacity
            key={p.id}
            onPress={() => setSelectedProfileId(p.id)}
            style={[
              styles.profRow,
              {
                borderColor: (selectedProfileId || profiles[0]?.id) === p.id ? CERVOS_COLORS.cobalt : border,
              },
            ]}
          >
            <Text style={{ color: text, fontWeight: "700" }}>{p.displayName}</Text>
            <Text style={{ color: muted, fontSize: 12 }}>{p.role.replace(/_/g, " ")}</Text>
          </TouchableOpacity>
        ))}

        <TextInput
          value={pin}
          onChangeText={(v: string) => setPin(v.replace(/\D/g, "").slice(0, 6))}
          placeholder="4-6 digit PIN"
          placeholderTextColor={muted}
          keyboardType="number-pad"
          secureTextEntry
          style={[styles.pinInput, { color: text, borderColor: border }]}
        />

        {err && <Text style={{ color: "#E11D48", fontWeight: "600", fontSize: 13 }}>{err}</Text>}

        <TouchableOpacity onPress={unlockPin} disabled={busy} style={[styles.btn, { backgroundColor: CERVOS_COLORS.cobalt }]}>
          <Text style={styles.btnText}>{busy ? "Unlocking..." : "Unlock Station ->"}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 64, gap: 16 },
  tag: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  card: { borderRadius: 24, borderWidth: 1, padding: 20, gap: 12 },
  title: { fontSize: 20, fontWeight: "700" },
  profRow: { minHeight: TOUCH_MIN_HEIGHT, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pinInput: { minHeight: 54, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, fontSize: 20, fontWeight: "700", letterSpacing: 6, textAlign: "center" },
  btn: { minHeight: TOUCH_MIN_HEIGHT + 4, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  btnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});
