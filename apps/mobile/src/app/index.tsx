import { useEffect } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useMobileSession } from "@/context/session-context";
import { WorkspaceSkeleton } from "@/components/state-views";
import { colors } from "@/theme";

export default function IndexGateRouter() {
  const router = useRouter();
  const { hydrated, hasAccountToken, workspace, isLoading, stationUnlocked } = useMobileSession();

  useEffect(() => {
    if (!hydrated) return;

    if (!hasAccountToken) {
      router.replace("/auth");
      return;
    }

    if (!workspace && isLoading) return;

    if (!workspace) {
      router.replace("/auth");
      return;
    }

    if (workspace.loungeOnly) {
      router.replace("/lounge");
      return;
    }

    if (!workspace.account?.onboardingDone) {
      router.replace("/onboarding");
      return;
    }

    if (!workspace.activeProfile || !stationUnlocked) {
      router.replace("/gate");
      return;
    }

    router.replace("/(tabs)");
  }, [hydrated, hasAccountToken, workspace, isLoading, stationUnlocked, router]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.groupedBackground, justifyContent: "center" }}>
      <WorkspaceSkeleton />
    </View>
  );
}
