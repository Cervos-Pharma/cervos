import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { PrimaryButton } from "@/components/primary-button";
import { PlatformIcon } from "@/components/platform-icon";
import { useMobileSession } from "@/context/session-context";
import { searchOrgs, signInWorkspace, signUpWorkspace } from "@/services/api";
import { playSoundCue, triggerHaptic } from "@/services/sounds";
import { colors, radius, spacing, typography, useBrandColors } from "@/theme";

type AuthMode = "signin" | "signup" | "join";

const ROLES = [
  { id: "pharmacy", label: "Pharmacy" },
  { id: "supplier", label: "Supplier" },
  { id: "dispensary", label: "Dispensary" },
  { id: "other", label: "Health Partner" },
] as const;

export default function AuthScreen() {
  const router = useRouter();
  const { refreshState, setStationUnlocked } = useMobileSession();
  const brand = useBrandColors();

  const [mode, setMode] = useState<AuthMode>("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sign In
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  // Sign Up
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [region, setRegion] = useState("Dar es Salaam");
  const [roleType, setRoleType] = useState<(typeof ROLES)[number]["id"]>("pharmacy");
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Request Join
  const [orgQuery, setOrgQuery] = useState("");
  const [orgResults, setOrgResults] = useState<
    Array<{ id: string; orgName: string; region: string; ownerName: string }>
  >([]);
  const [selectedOrg, setSelectedOrg] = useState<{ id: string; orgName: string } | null>(null);
  const [joinUsername, setJoinUsername] = useState("");
  const [joinRoleLabel, setJoinRoleLabel] = useState("Counter Cashier");

  const inputStyle = {
    minHeight: 46,
    borderRadius: radius.md,
    borderCurve: "continuous" as const,
    backgroundColor: colors.tertiaryBackground,
    paddingHorizontal: spacing.md,
    color: colors.label,
    fontSize: 15,
  };

  const handleCaptureGps = async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setError("Location permission denied. You can continue with manual region.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      await triggerHaptic("success");
    } catch {
      setError("Could not acquire GPS fix on this device.");
    }
  };

  const handleSearchOrgs = async (text: string) => {
    setOrgQuery(text);
    if (text.trim().length < 2) {
      setOrgResults([]);
      return;
    }
    const res = await searchOrgs(text.trim()).catch(() => null);
    if (res?.ok) {
      setOrgResults(res.data.organizations || []);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        const res = await signInWorkspace({
          action: "signin",
          identifier: identifier.trim(),
          password,
        });
        if (!res.ok) {
          await playSoundCue("alert");
          await triggerHaptic("error");
          setError(res.data?.error || "Sign in failed. Verify credentials.");
          return;
        }
        await playSoundCue("scan");
        setStationUnlocked(true);
        await refreshState();
        router.replace("/");
        return;
      }

      if (password !== confirmPassword) {
        setError("Password and confirmation do not match.");
        return;
      }

      if (mode === "signup") {
        const res = await signUpWorkspace({
          action: "signup",
          fullName: fullName.trim(),
          orgName: orgName.trim(),
          email: email.trim(),
          sex: "prefer_not_to_say",
          region: region.trim(),
          role: roleType,
          password,
          confirmPassword,
          signupGeo: {
            region: region.trim(),
            lat: gpsCoords?.lat,
            lng: gpsCoords?.lng,
            source: gpsCoords ? "gps" : "manual",
          },
          lang: "EN",
        });
        if (!res.ok) {
          await playSoundCue("alert");
          await triggerHaptic("error");
          setError(res.data?.error || "Registration failed.");
          return;
        }
        await playSoundCue("sale-complete");
        setStationUnlocked(true);
        await refreshState();
        router.replace("/");
        return;
      }

      // Join Request
      if (!selectedOrg) {
        setError("Search and select your pharmacy organization first.");
        return;
      }
      const res = await signUpWorkspace({
        action: "request_join",
        targetAccountId: selectedOrg.id,
        fullName: fullName.trim(),
        username: joinUsername.trim(),
        email: email.trim(),
        sex: "prefer_not_to_say",
        region: region.trim(),
        requestedRoleLabel: joinRoleLabel.trim(),
        password,
        confirmPassword,
        lang: "EN",
      });
      if (!res.ok) {
        await playSoundCue("alert");
        setError(res.data?.error || "Join request failed.");
        return;
      }
      await playSoundCue("notify");
      await refreshState();
      router.replace("/lounge");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAwareScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
      contentContainerStyle={{ padding: spacing.md, paddingTop: 56, paddingBottom: 48, gap: spacing.lg }}
    >
      <View style={{ alignItems: "center", gap: spacing.sm }}>
        <Image
          source={require("../../assets/images/icon.png")}
          style={{ width: 64, height: 64, borderRadius: 16 }}
          contentFit="cover"
        />
        <Text style={typography.title}>Cervos Pharma</Text>
        <Text style={[typography.subhead, { textAlign: "center" }]}>
          Clinical Counter, Stock Safety &amp; Multi-Branch Sync
        </Text>
      </View>

      {/* Native Segmented Mode Selector */}
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
            { id: "signin", label: "Sign In" },
            { id: "signup", label: "New Pharmacy" },
            { id: "join", label: "Join Team" },
          ] as const
        ).map((m) => {
          const active = mode === m.id;
          return (
            <Pressable
              key={m.id}
              onPress={() => {
                setMode(m.id);
                setError(null);
                void triggerHaptic("selection");
              }}
              style={{
                flex: 1,
                minHeight: 38,
                borderRadius: radius.full,
                backgroundColor: active ? brand.accent : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: active ? colors.onTint : colors.secondaryLabel,
                }}
              >
                {m.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error && (
        <View
          style={{
            padding: spacing.md,
            borderRadius: radius.lg,
            borderCurve: "continuous",
            backgroundColor: brand.dangerSoft,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          <PlatformIcon sf="exclamationmark.circle.fill" md="error" color={brand.danger} size={18} />
          <Text style={{ flex: 1, fontSize: 13, color: brand.danger }}>{error}</Text>
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
        {mode === "signin" && (
          <>
            <Text style={typography.overline}>ORGANIZATION ACCESS</Text>
            <TextInput
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="Username or organization email"
              placeholderTextColor={colors.tertiaryLabel as string}
              autoCapitalize="none"
              keyboardType="email-address"
              style={inputStyle}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={colors.tertiaryLabel as string}
              secureTextEntry
              style={inputStyle}
            />
          </>
        )}

        {mode === "signup" && (
          <>
            <Text style={typography.overline}>ORGANIZATION REGISTRATION</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
              {ROLES.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => setRoleType(r.id)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: radius.full,
                    backgroundColor: roleType === r.id ? brand.accent : colors.tertiaryBackground,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: roleType === r.id ? colors.onTint : colors.secondaryLabel,
                    }}
                  >
                    {r.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Owner Full Name"
              placeholderTextColor={colors.tertiaryLabel as string}
              style={inputStyle}
            />
            <TextInput
              value={orgName}
              onChangeText={setOrgName}
              placeholder="Pharmacy / Organization Name"
              placeholderTextColor={colors.tertiaryLabel as string}
              style={inputStyle}
            />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Work Email"
              placeholderTextColor={colors.tertiaryLabel as string}
              autoCapitalize="none"
              keyboardType="email-address"
              style={inputStyle}
            />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <TextInput
                value={region}
                onChangeText={setRegion}
                placeholder="Region (e.g. Dar es Salaam)"
                placeholderTextColor={colors.tertiaryLabel as string}
                style={[inputStyle, { flex: 1 }]}
              />
              <Pressable
                onPress={handleCaptureGps}
                style={{
                  minHeight: 46,
                  paddingHorizontal: 14,
                  borderRadius: radius.md,
                  borderCurve: "continuous",
                  backgroundColor: gpsCoords ? brand.successSoft : colors.tertiaryBackground,
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: gpsCoords ? brand.success : brand.accent }}>
                  {gpsCoords ? "GPS Pinned" : "Pin GPS"}
                </Text>
              </Pressable>
            </View>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Create Account Password (min 8 chars)"
              placeholderTextColor={colors.tertiaryLabel as string}
              secureTextEntry
              style={inputStyle}
            />
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm Password"
              placeholderTextColor={colors.tertiaryLabel as string}
              secureTextEntry
              style={inputStyle}
            />
          </>
        )}

        {mode === "join" && (
          <>
            <Text style={typography.overline}>JOIN EXISTING WORKSPACE</Text>
            <TextInput
              value={orgQuery}
              onChangeText={handleSearchOrgs}
              placeholder="Search pharmacy name..."
              placeholderTextColor={colors.tertiaryLabel as string}
              style={inputStyle}
            />
            {orgResults.map((org) => (
              <Pressable
                key={org.id}
                onPress={() => {
                  setSelectedOrg(org);
                  setOrgResults([]);
                  setOrgQuery(org.orgName);
                }}
                style={{
                  padding: 12,
                  borderRadius: radius.md,
                  borderCurve: "continuous",
                  backgroundColor:
                    selectedOrg?.id === org.id ? brand.accentSoft : colors.tertiaryBackground,
                }}
              >
                <Text style={{ fontWeight: "600", color: colors.label }}>{org.orgName}</Text>
                <Text style={typography.caption}>
                  {org.region} · {org.ownerName}
                </Text>
              </Pressable>
            ))}
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your Full Name"
              placeholderTextColor={colors.tertiaryLabel as string}
              style={inputStyle}
            />
            <TextInput
              value={joinUsername}
              onChangeText={setJoinUsername}
              placeholder="Desired Username (e.g. neema.pos)"
              placeholderTextColor={colors.tertiaryLabel as string}
              autoCapitalize="none"
              style={inputStyle}
            />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Your Email"
              placeholderTextColor={colors.tertiaryLabel as string}
              autoCapitalize="none"
              keyboardType="email-address"
              style={inputStyle}
            />
            <TextInput
              value={joinRoleLabel}
              onChangeText={setJoinRoleLabel}
              placeholder="Role (Counter Cashier, Pharmacist...)"
              placeholderTextColor={colors.tertiaryLabel as string}
              style={inputStyle}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Personal Password"
              placeholderTextColor={colors.tertiaryLabel as string}
              secureTextEntry
              style={inputStyle}
            />
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm Password"
              placeholderTextColor={colors.tertiaryLabel as string}
              secureTextEntry
              style={inputStyle}
            />
          </>
        )}

        <PrimaryButton
          title={
            mode === "signin"
              ? "Sign In to Workspace"
              : mode === "signup"
                ? "Launch Pharmacy Workspace"
                : "Submit Access Request"
          }
          loading={busy}
          onPress={handleSubmit}
          style={{ marginTop: spacing.xs }}
        />
      </View>
    </KeyboardAwareScrollView>
  );
}
