import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { formatTzs } from "@cervos/core";
import { PlatformIcon } from "@/components/platform-icon";
import { EmptyStateCard } from "@/components/state-views";
import { useMobileSession } from "@/context/session-context";
import { postWorkspaceAction } from "@/services/api";
import { playSoundCue, triggerHaptic } from "@/services/sounds";
import { colors, radius, spacing, typography, useBrandColors } from "@/theme";

type WholesaleTab = "catalog" | "orders";

export default function WholesaleScreen() {
  const router = useRouter();
  const {
    workspace,
    lang,
    capabilities,
    activeCentre,
    pendingScannedCode,
    pendingScanContext,
    setPendingScannedCode,
    setPendingScanContext,
    refreshState,
  } = useMobileSession();
  const brand = useBrandColors(workspace?.account?.customization?.brandAccent);
  const isSw = lang === "SW";

  const [tab, setTab] = useState<WholesaleTab>("catalog");
  const [search, setSearch] = useState("");
  const [gs1Input, setGs1Input] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!pendingScannedCode || pendingScanContext !== "wholesale") return;
    setTab("orders");
    setGs1Input(pendingScannedCode);
    setPendingScannedCode(null);
    setPendingScanContext(null);
    void playSoundCue("scan");
    void triggerHaptic("success");
  }, [pendingScannedCode, pendingScanContext, setPendingScannedCode, setPendingScanContext]);

  const catalog = workspace?.supplierCatalog ?? [];
  const orders = workspace?.wholesaleOrders ?? [];
  const networkUnlocked = Boolean(workspace?.account?.networkUnlocked);
  const canOrderDirect = capabilities.canManageWholesale;

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (item) =>
        item.productName.toLowerCase().includes(q) ||
        item.genericName.toLowerCase().includes(q) ||
        item.supplierName.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [catalog, search]);

  const placeOrderOrEscalate = async (catalogId: string, minQty: number) => {
    setBusyId(catalogId);
    setNotice(null);
    try {
      const action = canOrderDirect ? "place_wholesale_order" : "request_wholesale_approval";
      const res = await postWorkspaceAction<{
        orderReference?: string;
        escalatedToChat?: boolean;
        message?: string;
      }>({
        action,
        catalogId,
        quantity: minQty,
      });

      if (!res.ok) {
        await playSoundCue("alert");
        await triggerHaptic("error");
        setNotice({ ok: false, text: res.data?.error || "Could not process wholesale request." });
        return;
      }

      await playSoundCue("sale-complete");
      await triggerHaptic("success");
      setNotice({
        ok: true,
        text: res.data?.escalatedToChat
          ? res.data.message || "Sent to your manager in Branch Chat for approval."
          : `Order ${res.data?.orderReference || ""} placed in Kasri escrow.`,
      });
      await refreshState();
      if (!res.data?.escalatedToChat) {
        setTab("orders");
      }
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelivery = async (orderId: string) => {
    setBusyId(orderId);
    setNotice(null);
    try {
      const res = await postWorkspaceAction({
        action: "confirm_grn_delivery",
        orderId,
        ...(gs1Input.trim() ? { gs1Barcode: gs1Input.trim() } : {}),
      });
      if (!res.ok) {
        await playSoundCue("alert");
        await triggerHaptic("error");
        setNotice({ ok: false, text: res.data?.error || "Delivery confirmation failed." });
        return;
      }
      setGs1Input("");
      await playSoundCue("sale-complete");
      await triggerHaptic("success");
      setNotice({
        ok: true,
        text: isSw
          ? "Mzigo umepokelewa stooni na malipo ya Kasri yameachiliwa."
          : "Delivery stocked into inventory and Kasri escrow released.",
      });
      await refreshState();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.groupedBackground }}>
      {/* Segment + Status Header */}
      <View
        style={{
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          backgroundColor: colors.secondaryGroupedBackground,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
          gap: spacing.sm,
        }}
      >
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
              { id: "catalog", label: isSw ? `Bohari (${catalog.length})` : `Suppliers (${catalog.length})` },
              { id: "orders", label: isSw ? `Maagizo (${orders.length})` : `Kasri Orders (${orders.length})` },
            ] as const
          ).map((t) => {
            const active = tab === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => {
                  setTab(t.id);
                  setNotice(null);
                }}
                style={{
                  flex: 1,
                  minHeight: 36,
                  borderRadius: radius.full,
                  backgroundColor: active ? brand.accent : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: active ? colors.onTint : colors.secondaryLabel,
                  }}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tab === "catalog" && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: colors.tertiaryBackground,
              borderRadius: radius.md,
              paddingHorizontal: spacing.sm,
              gap: spacing.xs,
            }}
          >
            <PlatformIcon sf="magnifyingglass" md="search" color={colors.tertiaryLabel} size={18} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={isSw ? "Tafuta dawa au bohari..." : "Search medicine or verified supplier..."}
              placeholderTextColor={colors.tertiaryLabel as string}
              style={{ flex: 1, minHeight: 40, color: colors.label, fontSize: 14 }}
            />
          </View>
        )}

        {tab === "orders" && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <TextInput
              value={gs1Input}
              onChangeText={setGs1Input}
              placeholder={isSw ? "Skani au weka GS1 GRN (hiari)..." : "GS1 / Lot Barcode for GRN receipt (optional)..."}
              placeholderTextColor={colors.tertiaryLabel as string}
              style={{
                flex: 1,
                minHeight: 40,
                backgroundColor: colors.tertiaryBackground,
                borderRadius: radius.md,
                paddingHorizontal: spacing.sm,
                color: colors.label,
                fontSize: 13,
              }}
            />
            <Pressable
              onPress={() => {
                setPendingScanContext("wholesale");
                router.push("/scanner-modal?target=wholesale");
              }}
              style={{
                height: 40,
                paddingHorizontal: 11,
                borderRadius: radius.md,
                backgroundColor: brand.accentSoft,
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
              }}
            >
              <PlatformIcon sf="barcode.viewfinder" md="qr-code-scanner" color={brand.accent} size={17} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: brand.accent }}>
                {isSw ? "Skani GS1" : "Scan GS1"}
              </Text>
            </Pressable>
          </View>
        )}

        {!networkUnlocked && canOrderDirect && (
          <Pressable
            onPress={() => router.push("/settings?scope=compliance")}
            style={{
              padding: spacing.sm,
              borderRadius: radius.md,
              backgroundColor: brand.warningSoft,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
            }}
          >
            <PlatformIcon sf="exclamationmark.shield" md="verified-user" color={brand.warning} size={18} />
            <Text style={{ flex: 1, fontSize: 12, fontWeight: "600", color: brand.warning }}>
              {isSw
                ? "Pakia vibali vya uendeshaji kwenye Mipangilio kufungua uagizaji wa jumla."
                : "Upload operating permits in web Settings to unlock direct wholesale dispatch."}
            </Text>
          </Pressable>
        )}

        {notice && (
          <View
            style={{
              padding: spacing.sm,
              borderRadius: radius.md,
              backgroundColor: notice.ok ? brand.successSoft : brand.dangerSoft,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "600", color: notice.ok ? brand.success : brand.danger }}>
              {notice.text}
            </Text>
          </View>
        )}
      </View>

      {tab === "catalog" ? (
        <FlatList
          data={filteredCatalog}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: 40 }}
          ListEmptyComponent={
            <EmptyStateCard
              sf="shippingbox"
              md="local-shipping"
              title={isSw ? "Hakuna bidhaa za jumla zilizopatikana" : "No wholesale catalog items"}
              description={
                isSw
                  ? "Jaribu neno lingine au vuta chini kusawazisha orodha ya bohari."
                  : "Try another medicine name or refresh workspace data."
              }
            />
          }
          renderItem={({ item }) => {
            const busy = busyId === item.id;
            const totalMin = item.unitPriceTzs * item.minOrderQty;
            return (
              <View
                style={{
                  padding: spacing.md,
                  borderRadius: radius.xl,
                  borderCurve: "continuous",
                  backgroundColor: colors.secondaryGroupedBackground,
                  gap: spacing.xs,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Text style={typography.headline}>{item.productName}</Text>
                    <Text style={typography.caption}>
                      {item.genericName} · {item.packSize} · {item.supplierName}
                      {item.supplierCity ? ` (${item.supplierCity})` : ""}
                    </Text>
                  </View>
                  {item.verified && (
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: radius.full,
                        backgroundColor: brand.accentSoft,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "700", color: brand.accent }}>
                        {isSw ? "Imethibitishwa" : "Verified"}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                  <View>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: brand.accent }}>
                      {formatTzs(item.unitPriceTzs)} / pack
                    </Text>
                    <Text style={typography.caption}>
                      Min {item.minOrderQty} ({formatTzs(totalMin)}) · {item.leadTimeDays}d delivery ·{" "}
                      {item.stockAvailable} in stock
                    </Text>
                  </View>
                  <Pressable
                    disabled={busy}
                    onPress={() => void placeOrderOrEscalate(item.id, item.minOrderQty)}
                    style={{
                      minHeight: 38,
                      paddingHorizontal: 14,
                      borderRadius: radius.full,
                      backgroundColor: brand.accent,
                      justifyContent: "center",
                      opacity: busy ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "700", color: colors.onTint }}>
                      {busy
                        ? "..."
                        : canOrderDirect
                          ? isSw
                            ? `Agiza ${item.minOrderQty}`
                            : `Order ${item.minOrderQty}`
                          : isSw
                            ? "Omba Idhini"
                            : "Ask Owner"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, paddingBottom: 40 }}
          ListEmptyComponent={
            <EmptyStateCard
              sf="doc.text"
              md="inventory"
              title={isSw ? "Hakuna maagizo ya Kasri bado" : "No wholesale orders yet"}
              description={
                isSw
                  ? `Maagizo yaliyowekwa kwa ${activeCentre?.name || "tawi hili"} yataonekana hapa na ulinzi wa Kasri.`
                  : `Orders placed for ${activeCentre?.name || "this branch"} appear here with delivery release protection.`
              }
              actionLabel={isSw ? "Tazama Bohari" : "Browse Suppliers"}
              onAction={() => setTab("catalog")}
            />
          }
          renderItem={({ item }) => {
            const busy = busyId === item.id;
            const delivered = item.orderStatus === "delivered";
            return (
              <View
                style={{
                  padding: spacing.md,
                  borderRadius: radius.xl,
                  borderCurve: "continuous",
                  backgroundColor: colors.secondaryGroupedBackground,
                  gap: spacing.xs,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={typography.headline}>{item.orderReference}</Text>
                  <View
                    style={{
                      paddingHorizontal: 9,
                      paddingVertical: 3,
                      borderRadius: radius.full,
                      backgroundColor: delivered ? brand.successSoft : brand.warningSoft,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: delivered ? brand.success : brand.warning,
                      }}
                    >
                      {delivered
                        ? isSw ? "Imepokelewa" : "Delivered"
                        : item.orderStatus === "in_transit"
                          ? isSw ? "Njiani (Kasri)" : "In Transit · Escrow"
                          : isSw ? "Inasubiri" : "Pending · Escrow"}
                    </Text>
                  </View>
                </View>

                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.label }}>
                  {item.productName} ({item.quantity}x)
                </Text>
                <Text style={typography.caption}>
                  {item.supplierName}
                  {item.routeLabel ? ` · ${item.routeLabel}` : ""} · {formatTzs(item.totalTzs)}
                </Text>

                {!delivered && (capabilities.canManageWholesale || capabilities.canEditInventory) && (
                  <Pressable
                    disabled={busy}
                    onPress={() => void confirmDelivery(item.id)}
                    style={{
                      marginTop: 4,
                      minHeight: 40,
                      borderRadius: radius.full,
                      backgroundColor: brand.accent,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: busy ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "700", color: colors.onTint }}>
                      {busy
                        ? "..."
                        : isSw
                          ? "Thibitisha Kupokea & Achilia Malipo"
                          : "Confirm Delivery & Stock Batch"}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
