import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { COMMERCIAL_PLAN_CATALOG, formatTzs, type CommercialTierSpec } from "@cervos/core";
import { PlatformIcon } from "@/components/platform-icon";
import { PrimaryButton } from "@/components/primary-button";
import { useMobileSession } from "@/context/session-context";
import { postWorkspaceAction } from "@/services/api";
import { playSoundCue, triggerHaptic } from "@/services/sounds";
import { colors, radius, spacing, typography, useBrandColors } from "@/theme";

const MOBILE_CHANNELS = [
  "M-Pesa (Vodacom)",
  "Mixx by Yas / Tigo",
  "Airtel Money",
  "Halopesa",
] as const;

export default function BillingPlansScreen() {
  const { workspace, lang, isOnline, refreshState } = useMobileSession();
  const brand = useBrandColors(workspace?.account?.customization?.brandAccent);
  const isSw = lang === "SW";
  const account = workspace?.account;
  const centres = workspace?.centres ?? [];

  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const [channel, setChannel] = useState<string>(MOBILE_CHANNELS[0]);
  const [phoneInput, setPhoneInput] = useState("");
  const [selectedPlanName, setSelectedPlanName] = useState<string>(
    account?.subscriptionPlan || COMMERCIAL_PLAN_CATALOG[1].name
  );
  const [pendingRef, setPendingRef] = useState<string | null>(
    workspace?.pendingSubscription?.status === "pending"
      ? workspace.pendingSubscription.reference
      : null
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const visiblePlans = useMemo<CommercialTierSpec[]>(() => {
    const isSupplier = account?.roleType === "supplier";
    return COMMERCIAL_PLAN_CATALOG.filter((p) =>
      isSupplier ? p.audience === "supplier" : p.audience !== "supplier"
    );
  }, [account?.roleType]);

  const activeTier = useMemo(() => {
    const cur = (account?.subscriptionPlan || "").toLowerCase();
    return (
      COMMERCIAL_PLAN_CATALOG.find(
        (p) => p.id.toLowerCase() === cur || p.name.toLowerCase() === cur
      ) ?? COMMERCIAL_PLAN_CATALOG[0]
    );
  }, [account?.subscriptionPlan]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const checkPendingPayment = async (reference: string) => {
    try {
      const res = await postWorkspaceAction<{
        status?: string;
        planName?: string;
        message?: string;
      }>({ action: "check_subscription_payment", reference });
      if (!res.ok) {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
        setPendingRef(null);
        await playSoundCue("alert");
        setNotice({ ok: false, text: res.data?.error || "Payment prompt expired or declined." });
        return;
      }
      if (res.data?.status === "completed") {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
        setPendingRef(null);
        await playSoundCue("sale-complete");
        await triggerHaptic("success");
        setNotice({
          ok: true,
          text: isSw
            ? `Malipo yamethibitishwa! Kifurushi ${res.data.planName || selectedPlanName} kimewashwa.`
            : `Payment confirmed! ${res.data.planName || selectedPlanName} is now active.`,
        });
        await refreshState();
      }
    } catch {
      // Transient polling hiccup - keep interval alive
    }
  };

  const initiateCheckout = async () => {
    if (!isOnline) {
      setNotice({
        ok: false,
        text: isSw ? "Muunganisho wa intaneti unahitajika kulipia kifurushi." : "Internet connection is required to initiate PayMe USSD checkout.",
      });
      return;
    }
    if (phoneInput.trim().length < 9 || busy) {
      setNotice({
        ok: false,
        text: isSw ? "Weka namba halali ya simu (mf. 0712 345 678)." : "Enter a valid Tanzanian mobile money number (e.g. 0712 345 678).",
      });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const res = await postWorkspaceAction<{
        pending?: boolean;
        reference?: string;
        receiptNumber?: string;
        message?: string;
        amountTzs?: number;
      }>({
        action: "activate_subscription",
        planName: selectedPlanName,
        paymentChannel: channel,
        billingCycle: cycle,
        payerPhoneOrRef: phoneInput.trim(),
      });
      if (!res.ok) {
        await playSoundCue("alert");
        await triggerHaptic("error");
        setNotice({ ok: false, text: res.data?.error || "Checkout could not be started." });
        return;
      }
      if (res.data?.pending && res.data.reference) {
        const ref = res.data.reference;
        setPendingRef(ref);
        setNotice({
          ok: true,
          text:
            res.data.message ||
            "USSD prompt sent to your phone. Enter your mobile money PIN to confirm.",
        });
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        pollTimerRef.current = setInterval(() => {
          void checkPendingPayment(ref);
        }, 4500);
      } else {
        await playSoundCue("sale-complete");
        await triggerHaptic("success");
        setNotice({
          ok: true,
          text: `Activated ${selectedPlanName} (Receipt ${res.data?.receiptNumber || "OK"}).`,
        });
        await refreshState();
      }
    } finally {
      setBusy(false);
    }
  };

  const cardStyle = {
    padding: spacing.md,
    borderRadius: radius.xl,
    borderCurve: "continuous" as const,
    backgroundColor: colors.secondaryGroupedBackground,
    gap: spacing.sm,
  };

  return (
    <KeyboardAwareScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: colors.groupedBackground }}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 48 }}
    >
      {/* Current Plan & Seat Meters */}
      <View style={cardStyle}>
        <Text style={[typography.overline, { color: brand.accent }]}>
          {isSw ? "KIFURUSHI CHA SASA" : "ACTIVE SUBSCRIPTION TIER"}
        </Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={typography.title}>{activeTier.name}</Text>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: radius.full,
              backgroundColor: account?.billingOverdue ? brand.dangerSoft : brand.successSoft,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: account?.billingOverdue ? brand.danger : brand.success,
              }}
            >
              {account?.billingOverdue
                ? "OVERDUE"
                : account?.subscriptionActive
                  ? `${account?.subscriptionDaysLeft ?? 30}d left`
                  : "TRIAL"}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <View style={{ flex: 1, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.tertiaryBackground }}>
            <Text style={typography.caption}>{isSw ? "Matawi" : "Branches"}</Text>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.label }}>
              {centres.length} / {activeTier.maxBranches ?? "Unlimited"}
            </Text>
          </View>
          <View style={{ flex: 1, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.tertiaryBackground }}>
            <Text style={typography.caption}>{isSw ? "Wahudumu" : "Operators"}</Text>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.label }}>
              {(workspace?.profiles ?? []).length} / {activeTier.maxOperators ?? "Unlimited"}
            </Text>
          </View>
        </View>
      </View>

      {notice && (
        <View
          style={{
            padding: spacing.md,
            borderRadius: radius.lg,
            backgroundColor: notice.ok ? brand.successSoft : brand.dangerSoft,
            gap: spacing.xs,
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: "600", color: notice.ok ? brand.success : brand.danger }}>
            {notice.text}
          </Text>
          {pendingRef && (
            <PrimaryButton
              title={isSw ? "Hakiki Malipo Sasa" : "Verify Payment Status Now"}
              variant="outline"
              onPress={() => void checkPendingPayment(pendingRef)}
            />
          )}
        </View>
      )}

      {/* Cycle Toggle */}
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
            { id: "monthly", label: isSw ? "Kila Mwezi" : "Monthly" },
            { id: "annual", label: isSw ? "Kwa Mwaka (Okoa ~17%)" : "Annual (Save ~17%)" },
          ] as const
        ).map((c) => (
          <Pressable
            key={c.id}
            onPress={() => setCycle(c.id)}
            style={{
              flex: 1,
              minHeight: 36,
              borderRadius: radius.full,
              backgroundColor: cycle === c.id ? brand.accent : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: cycle === c.id ? colors.onTint : colors.secondaryLabel }}>
              {c.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Plan Cards */}
      {visiblePlans.map((tier) => {
        const selected = selectedPlanName.toLowerCase() === tier.name.toLowerCase();
        const price = cycle === "annual" ? tier.priceAnnualTzs : tier.priceMonthlyTzs;
        return (
          <Pressable
            key={tier.id}
            onPress={() => {
              setSelectedPlanName(tier.name);
              void triggerHaptic("selection");
            }}
            style={{
              padding: spacing.md,
              borderRadius: radius.xl,
              borderCurve: "continuous",
              backgroundColor: colors.secondaryGroupedBackground,
              borderWidth: selected ? 2 : 1,
              borderColor: selected ? brand.accent : brand.staticBorder,
              gap: 6,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={typography.headline}>{tier.name}</Text>
              <Text style={{ fontSize: 16, fontWeight: "700", color: brand.accent }}>
                {formatTzs(price)}{cycle === "annual" ? "/yr" : "/mo"}
              </Text>
            </View>
            <Text style={typography.caption}>
              {tier.maxBranches ?? "Unlimited"} branches · {tier.maxOperators ?? "Unlimited"} operators
            </Text>
            {tier.features.map((feat) => (
              <View key={feat} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <PlatformIcon sf="checkmark.circle.fill" md="check-circle" color={brand.success} size={14} />
                <Text style={{ fontSize: 13, color: colors.secondaryLabel }}>{feat}</Text>
              </View>
            ))}
          </Pressable>
        );
      })}

      {/* Mobile Money USSD PayMe Form */}
      <View style={cardStyle}>
        <Text style={[typography.overline, { color: brand.accent }]}>
          {isSw ? "LIPA KWA SIMU (USSD PUSH)" : "PAYME MOBILE MONEY CHECKOUT"}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {MOBILE_CHANNELS.map((ch) => (
            <Pressable
              key={ch}
              onPress={() => setChannel(ch)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 7,
                borderRadius: radius.full,
                backgroundColor: channel === ch ? brand.accent : colors.tertiaryBackground,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "600", color: channel === ch ? colors.onTint : colors.label }}>
                {ch}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          value={phoneInput}
          onChangeText={setPhoneInput}
          keyboardType="phone-pad"
          placeholder="0712 345 678 / +2557..."
          placeholderTextColor={colors.tertiaryLabel as string}
          style={{
            minHeight: 44,
            borderRadius: radius.md,
            backgroundColor: colors.tertiaryBackground,
            paddingHorizontal: spacing.md,
            color: colors.label,
            fontSize: 15,
          }}
        />

        <PrimaryButton
          title={busy ? "..." : isSw ? `Lipa ${selectedPlanName}` : `Subscribe · ${selectedPlanName}`}
          loading={busy}
          onPress={() => void initiateCheckout()}
        />
      </View>
    </KeyboardAwareScrollView>
  );
}
