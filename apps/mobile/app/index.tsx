import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";
import { getStoredTokens } from "../src/services/api";
import { useMobileSession } from "../src/context/MobileSessionContext";
import { CERVOS_COLORS } from "../src/theme/tokens";

export default function EntryBootstrap() {
  const router = useRouter();
  const { refreshWorkspace, isDark } = useMobileSession();

  useEffect(() => {
    let active = true;
    (async () => {
      const tokens = await getStoredTokens();
      if (!active) return;
      if (!tokens.accountToken) {
        router.replace("/onboarding");
        return;
      }
      const st = await refreshWorkspace();
      if (!active) return;
      if (!st) {
        router.replace("/onboarding");
        return;
      }
      if (!st.activeProfile) {
        router.replace("/gate");
        return;
      }
      router.replace("/(tabs)");
    })();
    return () => {
      active = false;
    };
  }, [refreshWorkspace, router]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: isDark ? CERVOS_COLORS.darkBg : CERVOS_COLORS.lightBg,
      }}
    >
      <ActivityIndicator size="large" color={CERVOS_COLORS.cobalt} />
    </View>
  );
}
