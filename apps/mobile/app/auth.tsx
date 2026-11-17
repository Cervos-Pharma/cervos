import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMobileSession } from "../src/context/MobileSessionContext";
import { searchOrgs, signInWorkspace, signUpWorkspace } from "../src/services/api";
import { CERVOS_COLORS, TOUCH_MIN_HEIGHT } from "../src/theme/tokens";

export default function MobileAuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { lang, refreshWorkspace, isDark } = useMobileSession();
  const isSw = lang === "SW";

  const [mode, setMode] = useState<"signin" | "signup">(params.mode === "signup" ? "signup" : "signin");
  const [identifier, setIdentifier] = useState("");
  const [secret, setSecret] = useState("");
  const [usePinLogin, setUsePinLogin] = useState(false);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sex, setSex] = useState<"female" | "male" | "prefer_not_to_say">("female");
  const [orgName, setOrgName] = useState("");
  const [region, setRegion] = useState("Dar es Salaam");
  const [orgQuery, setOrgQuery] = useState("");
  const [orgMatches, setOrgMatches] = useState<Array<{ id: string; orgName: string; region: string }>>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const bg = isDark ? CERVOS_COLORS.darkBg : CERVOS_COLORS.lightBg;
  const card = isDark ? CERVOS_COLORS.darkCard : CERVOS_COLORS.lightCard;
  const border = isDark ? CERVOS_COLORS.darkBorder : CERVOS_COLORS.lightBorder;
  const text = isDark ? CERVOS_COLORS.darkText : CERVOS_COLORS.lightText;
  const muted = isDark ? CERVOS_COLORS.darkMuted : CERVOS_COLORS.lightMuted;

  const handleSearchOrgs = async (q: string) => {
    setOrgQuery(q);
    if (q.trim().length < 2) {
      setOrgMatches([]);
      return;
    }
    const res = await searchOrgs(q.trim());
    if (res.ok) setOrgMatches(res.data.organizations || []);
  };

  const snapGps = async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") return;
    const pos = await Location.getCurrentPositionAsync({});
    setRegion(`GPS ${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)}`);
  };

  const handleSignIn = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await signInWorkspace({
        action: "signin",
        identifier: identifier.trim(),
        ...(usePinLogin ? { pin: secret.trim() } : { password: secret }),
      });
      if (!res.ok) {
        setErrorMsg(res.data.error || "Sign in failed.");
        return;
      }
      await refreshWorkspace();
      if (res.data.redirectTo?.includes("lounge")) router.replace("/lounge");
      else if (res.data.redirectTo?.includes("gate")) router.replace("/gate");
      else router.replace("/(tabs)");
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const payload = selectedOrgId
        ? {
            action: "request_join" as const,
            targetAccountId: selectedOrgId,
            fullName: fullName.trim(),
            username: username.trim() || fullName.trim().toLowerCase().replace(/[^a-z0-9]/g, "."),
            email: email.trim(),
            password,
            confirmPassword: password,
            sex,
            lang,
            region,
          }
        : {
            action: "signup" as const,
            fullName: fullName.trim(),
            username: username.trim() || fullName.trim().toLowerCase().replace(/[^a-z0-9]/g, "."),
            email: email.trim(),
            password,
            confirmPassword: password,
            sex,
            lang,
            role: "pharmacy" as const,
            orgName: orgName.trim() || `${fullName.trim()} Pharmacy`,
            region,
          };
      const res = await signUpWorkspace(payload);
      if (!res.ok) {
        setErrorMsg(res.data.error || "Sign up failed.");
        return;
      }
      await refreshWorkspace();
      if (selectedOrgId || res.data.redirectTo?.includes("lounge")) router.replace("/lounge");
      else router.replace("/gate");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={{ color: CERVOS_COLORS.cobalt, fontWeight: "700" }}>
          {isSw ? "<- Rudi" : "<- Back"}
        </Text>
      </TouchableOpacity>

      <View style={styles.tabs}>
        {(["signin", "signup"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => {
              setMode(t);
              setErrorMsg(null);
            }}
            style={[
              styles.tabBtn,
              { backgroundColor: mode === t ? CERVOS_COLORS.cobalt : card, borderColor: border },
            ]}
          >
            <Text style={{ color: mode === t ? "#FFFFFF" : text, fontWeight: "700" }}>
              {t === "signin" ? (isSw ? "Ingia" : "Sign In") : isSw ? "Jiunge" : "Get Started"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {errorMsg && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {mode === "signin" ? (
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.label, { color: muted }]}>Username or Email (@amani, @neema.kariakoo)</Text>
          <TextInput
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="@username or email"
            placeholderTextColor={muted}
            autoCapitalize="none"
            style={[styles.input, { color: text, borderColor: border }]}
          />

          <View style={styles.tabs}>
            <TouchableOpacity
              onPress={() => setUsePinLogin(false)}
              style={[styles.smallChip, { borderColor: !usePinLogin ? CERVOS_COLORS.cobalt : border }]}
            >
              <Text style={{ color: text, fontSize: 12, fontWeight: "600" }}>Password</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setUsePinLogin(true)}
              style={[styles.smallChip, { borderColor: usePinLogin ? CERVOS_COLORS.cobalt : border }]}
            >
              <Text style={{ color: text, fontSize: 12, fontWeight: "600" }}>Quick Station PIN</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { color: muted }]}>{usePinLogin ? "4-6 Digit PIN" : "Password"}</Text>
          <TextInput
            value={secret}
            onChangeText={setSecret}
            placeholder={usePinLogin ? "e.g. 2468" : "Password"}
            placeholderTextColor={muted}
            secureTextEntry
            keyboardType={usePinLogin ? "number-pad" : "default"}
            style={[styles.input, { color: text, borderColor: border }]}
          />

          <TouchableOpacity
            onPress={handleSignIn}
            disabled={busy}
            style={[styles.primaryBtn, { backgroundColor: CERVOS_COLORS.cobalt }]}
          >
            <Text style={styles.primaryBtnText}>{busy ? "Connecting..." : isSw ? "Ingia Kazini" : "Sign In"}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[styles.label, { color: muted }]}>{isSw ? "Jina Kamili" : "Full Name"}</Text>
          <TextInput value={fullName} onChangeText={setFullName} placeholder="Neema Mushi" placeholderTextColor={muted} style={[styles.input, { color: text, borderColor: border }]} />

          <Text style={[styles.label, { color: muted }]}>@username</Text>
          <TextInput value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="neema.pharmacy" placeholderTextColor={muted} style={[styles.input, { color: text, borderColor: border }]} />

          <Text style={[styles.label, { color: muted }]}>Email</Text>
          <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="neema@pharmacy.co.tz" placeholderTextColor={muted} style={[styles.input, { color: text, borderColor: border }]} />

          <Text style={[styles.label, { color: muted }]}>Password</Text>
          <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Min 8 chars" placeholderTextColor={muted} style={[styles.input, { color: text, borderColor: border }]} />

          <View style={styles.tabs}>
            {(["female", "male", "prefer_not_to_say"] as const).map((sx) => (
              <TouchableOpacity
                key={sx}
                onPress={() => setSex(sx)}
                style={[styles.smallChip, { borderColor: sex === sx ? CERVOS_COLORS.cobalt : border }]}
              >
                <Text style={{ color: text, fontSize: 11, fontWeight: "600" }}>{sx.replace(/_/g, " ")}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: muted }]}>{isSw ? "Tafuta Duka Lililopo (Hiari)" : "Is your workplace already on Cervos?"}</Text>
          <TextInput
            value={orgQuery}
            onChangeText={handleSearchOrgs}
            placeholder="Search workplace name..."
            placeholderTextColor={muted}
            style={[styles.input, { color: text, borderColor: border }]}
          />
          {orgMatches.map((m) => (
            <TouchableOpacity
              key={m.id}
              onPress={() => setSelectedOrgId(selectedOrgId === m.id ? null : m.id)}
              style={[
                styles.orgRow,
                { borderColor: selectedOrgId === m.id ? CERVOS_COLORS.cobalt : border },
              ]}
            >
              <Text style={{ color: text, fontWeight: "700" }}>{m.orgName}</Text>
              <Text style={{ color: muted, fontSize: 12 }}>{m.region}</Text>
            </TouchableOpacity>
          ))}

          {!selectedOrgId && (
            <>
              <Text style={[styles.label, { color: muted }]}>New Pharmacy / Org Name</Text>
              <TextInput value={orgName} onChangeText={setOrgName} placeholder="e.g. Amani Care Pharmacy" placeholderTextColor={muted} style={[styles.input, { color: text, borderColor: border }]} />
              <TouchableOpacity onPress={snapGps} style={[styles.smallChip, { borderColor: border }]}>
                <Text style={{ color: CERVOS_COLORS.cobalt, fontWeight: "700", fontSize: 12 }}>
                  Snap Device GPS ({region})
                </Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            onPress={handleSignUp}
            disabled={busy}
            style={[styles.primaryBtn, { backgroundColor: CERVOS_COLORS.cobalt }]}
          >
            <Text style={styles.primaryBtnText}>
              {busy ? "Creating..." : selectedOrgId ? "Request Access ->" : "Launch Workspace ->"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 52, paddingBottom: 40, gap: 16 },
  backBtn: { minHeight: 40, justifyContent: "center" },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tabBtn: { flex: 1, minHeight: TOUCH_MIN_HEIGHT, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  smallChip: { minHeight: 40, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, justifyContent: "center" },
  card: { borderRadius: 24, borderWidth: 1, padding: 18, gap: 12 },
  label: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  input: { minHeight: TOUCH_MIN_HEIGHT, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, fontSize: 15 },
  orgRow: { borderWidth: 1, borderRadius: 14, padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  errorBox: { borderRadius: 14, padding: 12, backgroundColor: "rgba(244,63,94,0.14)" },
  errorText: { color: "#E11D48", fontWeight: "600", fontSize: 13 },
  primaryBtn: { minHeight: TOUCH_MIN_HEIGHT + 4, borderRadius: 999, alignItems: "center", justifyContent: "center", marginTop: 6 },
  primaryBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});
