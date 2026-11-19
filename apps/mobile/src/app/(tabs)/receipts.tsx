import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { formatTzs, parseScanIntent } from "@cervos/core";
import { PlatformIcon } from "@/components/platform-icon";
import { EmptyStateCard } from "@/components/state-views";
import { useMobileSession } from "@/context/session-context";
import { playSoundCue, triggerHaptic } from "@/services/sounds";
import { colors, radius, spacing, typography, useBrandColors } from "@/theme";

export default function ReceiptsVaultScreen() {
  const router = useRouter();
  const {
    workspace,
    lang,
    scopedSales,
    pendingScannedCode,
    setPendingScannedCode,
    pendingScanContext,
    setPendingScanContext,
  } = useMobileSession();
  const brand = useBrandColors(workspace?.account?.customization?.brandAccent);
  const isSw = lang === "SW";
  const [search, setSearch] = useState("");
  const [verifyNotice, setVerifyNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!pendingScannedCode || pendingScanContext !== "receipts") return;
    const code = pendingScannedCode;
    setPendingScannedCode(null);
    setPendingScanContext(null);

    const intent = parseScanIntent(code);
    if (intent.kind === "receipt") {
      const allSales = workspace?.sales ?? scopedSales;
      const target = allSales.find(
        (s) =>
          (intent.saleId && s.id === intent.saleId) ||
          (s.receiptNumber && s.receiptNumber.toUpperCase() === intent.receiptNumber.toUpperCase())
      );
      setSearch(target?.receiptNumber || intent.receiptNumber);
      if (target) {
        setVerifyNotice({
          ok: true,
          text: isSw
            ? `Risiti imethibitishwa: ${target.receiptNumber || intent.receiptNumber}`
            : `Verified receipt ${target.receiptNumber || intent.receiptNumber}`,
        });
        void playSoundCue("scan");
        void triggerHaptic("success");
        router.push(`/receipt-sheet?saleId=${encodeURIComponent(target.id)}`);
      } else {
        setVerifyNotice({
          ok: false,
          text: isSw
            ? `Risiti ${intent.receiptNumber} haikupatikana katika tawi hili.`
            : `Receipt ${intent.receiptNumber} not found in this branch vault.`,
        });
        void playSoundCue("alert");
        void triggerHaptic("error");
      }
      return;
    }

    setSearch(code.trim());
  }, [
    pendingScannedCode,
    pendingScanContext,
    setPendingScannedCode,
    setPendingScanContext,
    workspace?.sales,
    scopedSales,
    isSw,
    router,
  ]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return scopedSales;
    return scopedSales.filter(
      (s) =>
        (s.receiptNumber || s.id).toLowerCase().includes(q) ||
        (s.customerName || "").toLowerCase().includes(q) ||
        s.actorName.toLowerCase().includes(q) ||
        (s.lines ?? []).some((l) => l.brandName.toLowerCase().includes(q))
    );
  }, [scopedSales, search]);

  return (
    <View style={{ flex: 1, backgroundColor: brand.canvasBg }}>
      <View
        style={{
          paddingTop: 54,
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.sm,
          backgroundColor: brand.cardBg,
          borderBottomWidth: 1,
          borderBottomColor: brand.borderColor,
          gap: spacing.sm,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.xs }}>
          <Text style={typography.title}>{isSw ? "Risiti za Mauzo" : "Receipts Vault"}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Verify QR"
              onPress={() => {
                setPendingScanContext("receipts");
                router.push("/scanner-modal?target=receipts");
              }}
              style={{
                paddingHorizontal: 11,
                paddingVertical: 6,
                borderRadius: radius.full,
                backgroundColor: brand.accentSoft,
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
              }}
            >
              <PlatformIcon sf="qrcode.viewfinder" md="qr-code-scanner" color={brand.accent} size={15} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: brand.accent }}>
                {isSw ? "Skani QR" : "Verify QR"}
              </Text>
            </Pressable>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: radius.full,
                backgroundColor: brand.successSoft,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "700", color: brand.success }}>
                Immutable
              </Text>
            </View>
          </View>
        </View>

        <TextInput
          value={search}
          onChangeText={(t) => {
            setSearch(t);
            if (verifyNotice) setVerifyNotice(null);
          }}
          placeholder={isSw ? "Tafuta namba ya risiti au QR..." : "Search receipt #, customer, or cashier..."}
          placeholderTextColor={colors.tertiaryLabel as string}
          style={{
            minHeight: 42,
            borderRadius: radius.md,
            borderCurve: "continuous",
            backgroundColor: colors.tertiaryBackground,
            paddingHorizontal: spacing.md,
            color: colors.label,
            fontSize: 14,
          }}
        />

        {verifyNotice && (
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: radius.md,
              backgroundColor: verifyNotice.ok ? brand.successSoft : brand.dangerSoft,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing.xs,
            }}
          >
            <Text
              style={{
                flex: 1,
                fontSize: 12,
                fontWeight: "700",
                color: verifyNotice.ok ? brand.success : brand.danger,
              }}
            >
              {verifyNotice.text}
            </Text>
            <Pressable onPress={() => setVerifyNotice(null)}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: brand.accent }}>
                {isSw ? "Funga" : "Dismiss"}
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: 40 }}
        ListEmptyComponent={
          <EmptyStateCard
            sf="doc.text"
            md="receipt-long"
            title={isSw ? "Hakuna risiti bado" : "No receipts yet"}
            description={
              isSw
                ? "Risiti zote zinazotolewa kwenye Kaunta ya POS huhifadhiwa hapa."
                : "Completed counter sales appear here permanently and cannot be deleted."
            }
            actionLabel={isSw ? "Fungua Kaunta ya POS" : "Open Counter POS"}
            onAction={() => router.push("/(tabs)/pos")}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/receipt-sheet?saleId=${encodeURIComponent(item.id)}`)}
            style={({ pressed }) => ({
              padding: spacing.md,
              borderRadius: radius.xl,
              borderCurve: "continuous",
              backgroundColor: pressed
                ? brand.cardSubtleBg
                : brand.cardBg,
              borderWidth: 1,
              borderColor: brand.borderColor,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: spacing.sm,
            })}
          >
            <View style={{ flex: 1, gap: 3 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: brand.accent }}>
                  {item.receiptNumber || `RCP-${item.id.slice(-6).toUpperCase()}`}
                </Text>
                <Text style={typography.headline}>
                  {item.customerName || (isSw ? "Mteja wa Kaunta" : "Walk-in Patient")}
                </Text>
              </View>
              <Text style={typography.caption}>
                {item.itemCount} items · {item.paymentMethod.toUpperCase()} · {item.actorName} ·{" "}
                {item.createdAt.slice(0, 16).replace("T", " ")}
              </Text>
            </View>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.label }}>
              {formatTzs(item.totalTzs)}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}
