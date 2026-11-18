import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { PrimaryButton } from "@/components/primary-button";
import { useMobileSession } from "@/context/session-context";
import { fetchLoungeState, postLoungeAction } from "@/services/api";
import { playSoundCue, triggerHaptic } from "@/services/sounds";
import { colors, radius, spacing, typography, useBrandColors } from "@/theme";

interface LoungeData {
  joinRequest?: {
    id: string;
    targetOrgName: string;
    requesterFullName: string;
    status: "pending" | "approved" | "declined" | "accepted";
    allocatedCentreName?: string;
    allocatedRole?: string;
    allocatedPinPreview?: string;
    declineReason?: string;
  };
}

export default function LoungeScreen() {
  const router = useRouter();
  const { refreshState, signOut, setStationUnlocked } = useMobileSession();
  const brand = useBrandColors();

  const [data, setData] = useState<LoungeData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await fetchLoungeState().catch(() => null);
    if (res?.ok) setData(res.data as LoungeData);
  };

  useEffect(() => {
    void load();
  }, []);

  const req = data?.joinRequest;

  const acceptAllocation = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await postLoungeAction({ action: "accept_allocation" });
      if (!res.ok) {
        setError(res.data?.error || "Could not accept allocation.");
        return;
      }
      await playSoundCue("sale-complete");
      await triggerHaptic("success");
      setStationUnlocked(true);
      await refreshState();
      router.replace("/(tabs)");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
    >
      <Text style={typography.overline}>STAFF ACCESS STATUS</Text>
      <Text style={typography.title}>Welcome Lounge</Text>

      <View
        style={{
          padding: spacing.md,
          borderRadius: radius.xl,
          borderCurve: "continuous",
          backgroundColor: colors.secondaryGroupedBackground,
          gap: spacing.sm,
        }}
      >
        <Text style={typography.headline}>
          {req?.targetOrgName || "Pharmacy Organization"}
        </Text>
        <Text style={typography.subhead}>
          {req?.status === "approved"
            ? `Your access has been approved for ${req.allocatedCentreName} (${req.allocatedRole}).${
                req.allocatedPinPreview ? ` Counter PIN: ${req.allocatedPinPreview}` : ""
              }`
            : req?.status === "declined"
              ? `Request declined${req.declineReason ? `: ${req.declineReason}` : "."}`
              : "Waiting for your Pharmacy Owner or HQ Desk to assign your branch and station PIN."}
        </Text>

        {error && <Text style={{ color: brand.danger, fontSize: 13 }}>{error}</Text>}

        {req?.status === "approved" ? (
          <PrimaryButton
            title="Enter Station Workspace"
            loading={busy}
            onPress={acceptAllocation}
          />
        ) : (
          <PrimaryButton title="Check Approval Status" variant="secondary" onPress={load} />
        )}
      </View>

      <PrimaryButton
        title="Sign Out"
        variant="outline"
        onPress={async () => {
          await signOut();
          router.replace("/auth");
        }}
      />
    </ScrollView>
  );
}
