import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { formatTzs } from "@cervos/core";
import { PlatformIcon } from "@/components/platform-icon";
import { radius, spacing, useBrandColors } from "@/theme";
import type {
  WorkspaceBatch,
  WorkspaceCentre,
  WorkspaceNotificationItem,
  WorkspaceProfileSummary,
  WorkspaceSale,
} from "@/types/workspace";

export function GlobalQuickJumpBar({
  centres,
  batches,
  sales,
  profiles,
  isSw,
  accentHex,
  onSelectBranch,
}: {
  centres: WorkspaceCentre[];
  batches: WorkspaceBatch[];
  sales: WorkspaceSale[];
  profiles: WorkspaceProfileSummary[];
  isSw: boolean;
  accentHex?: string;
  onSelectBranch: (centreId: string) => void;
}) {
  const router = useRouter();
  const brand = useBrandColors(accentHex);
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return {
      branches: centres
        .filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.region.toLowerCase().includes(q) ||
            c.address.toLowerCase().includes(q)
        )
        .slice(0, 4),
      batches: batches
        .filter(
          (b) =>
            b.brandName.toLowerCase().includes(q) ||
            b.genericName.toLowerCase().includes(q) ||
            b.batchNumber.toLowerCase().includes(q) ||
            (b.barcode || "").toLowerCase().includes(q)
        )
        .slice(0, 5),
      sales: sales
        .filter(
          (s) =>
            (s.receiptNumber || s.id).toLowerCase().includes(q) ||
            (s.customerName || "").toLowerCase().includes(q) ||
            s.actorName.toLowerCase().includes(q)
        )
        .slice(0, 4),
      staff: profiles
        .filter(
          (p) =>
            p.displayName.toLowerCase().includes(q) ||
            (p.username || "").toLowerCase().includes(q) ||
            p.role.toLowerCase().includes(q)
        )
        .slice(0, 4),
    };
  }, [query, centres, batches, sales, profiles]);

  const totalHits = results
    ? results.branches.length + results.batches.length + results.sales.length + results.staff.length
    : 0;

  return (
    <View style={{ gap: spacing.xs }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.xs,
          backgroundColor: brand.cardBg,
          borderWidth: 1,
          borderColor: brand.borderColor,
          borderRadius: radius.lg,
          paddingHorizontal: 12,
          minHeight: 44,
        }}
      >
        <PlatformIcon sf="magnifyingglass" md="search" color={brand.textMuted} size={17} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={
            isSw
              ? "Tafuta tawi, dawa, risiti au mhudumu..."
              : "Quick-jump: branch, medicine, receipt, staff..."
          }
          placeholderTextColor={brand.textMuted}
          style={{ flex: 1, fontSize: 14, color: brand.textPrimary }}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery("")} hitSlop={8}>
            <PlatformIcon sf="xmark.circle.fill" md="cancel" color={brand.textMuted} size={17} />
          </Pressable>
        )}
      </View>

      {results && (
        <View
          style={{
            padding: spacing.sm,
            borderRadius: radius.lg,
            backgroundColor: brand.cardBg,
            borderWidth: 1,
            borderColor: brand.accent,
            gap: 8,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: brand.accent }}>
              {totalHits} MATCHES
            </Text>
            <Pressable onPress={() => setQuery("")}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: brand.textMuted }}>Clear</Text>
            </Pressable>
          </View>

          {totalHits === 0 ? (
            <Text style={{ fontSize: 12, color: brand.textMuted }}>
              {isSw ? "Hakuna matokeo yanayolingana." : "No matching branches, batches, receipts, or staff."}
            </Text>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {results.branches.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    onSelectBranch(c.id);
                    setQuery("");
                  }}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: radius.full,
                    backgroundColor: brand.accentSoft,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: brand.accent }}>
                    Branch: {c.name}
                  </Text>
                </Pressable>
              ))}
              {results.batches.map((b) => (
                <Pressable
                  key={b.id}
                  onPress={() => {
                    setQuery("");
                    router.push(`/batch-detail?id=${encodeURIComponent(b.id)}`);
                  }}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: radius.full,
                    backgroundColor: brand.successSoft,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: brand.success }}>
                    {b.brandName} ({b.quantity} left)
                  </Text>
                </Pressable>
              ))}
              {results.sales.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    setQuery("");
                    router.push("/(tabs)/receipts");
                  }}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: radius.full,
                    backgroundColor: brand.warningSoft,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: brand.warning }}>
                    {s.receiptNumber || s.id.slice(-6)} · {formatTzs(s.totalTzs, { compact: true })}
                  </Text>
                </Pressable>
              ))}
              {results.staff.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    setQuery("");
                    router.push("/team");
                  }}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: radius.full,
                    backgroundColor: brand.tealSoft,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: brand.teal }}>
                    {p.displayName}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export function NotificationsSheetModal({
  visible,
  onClose,
  notifications,
  isSw,
  accentHex,
  onMarkAllRead,
}: {
  visible: boolean;
  onClose: () => void;
  notifications: WorkspaceNotificationItem[];
  isSw: boolean;
  accentHex?: string;
  onMarkAllRead: () => void;
}) {
  const brand = useBrandColors(accentHex);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: brand.canvasBg, padding: spacing.md, gap: spacing.md }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 12,
          }}
        >
          <View>
            <Text style={{ fontSize: 10, fontWeight: "700", letterSpacing: 1, color: brand.accent }}>
              STATION NOTIFICATIONS
            </Text>
            <Text style={{ fontSize: 20, fontWeight: "800", color: brand.textPrimary }}>
              {isSw ? "Arifa za Kituo" : "Activity & Alerts"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {notifications.some((n) => !n.read) && (
              <Pressable
                onPress={onMarkAllRead}
                style={{
                  paddingHorizontal: 11,
                  paddingVertical: 7,
                  borderRadius: radius.full,
                  backgroundColor: brand.accentSoft,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: brand.accent }}>
                  {isSw ? "Soma Zote" : "Mark All Read"}
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={onClose}
              style={{
                paddingHorizontal: 11,
                paddingVertical: 7,
                borderRadius: radius.full,
                backgroundColor: brand.cardBg,
                borderWidth: 1,
                borderColor: brand.borderColor,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "700", color: brand.textPrimary }}>Close</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ gap: spacing.xs, paddingBottom: 32 }}>
          {notifications.length === 0 ? (
            <View
              style={{
                padding: spacing.lg,
                borderRadius: radius.xl,
                backgroundColor: brand.cardBg,
                borderWidth: 1,
                borderColor: brand.borderColor,
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "600", color: brand.textMuted }}>
                {isSw ? "Hakuna arifa mpya kwa sasa." : "You are completely caught up."}
              </Text>
            </View>
          ) : (
            notifications.map((n) => (
              <View
                key={n.id}
                style={{
                  padding: spacing.md,
                  borderRadius: radius.lg,
                  backgroundColor: brand.cardBg,
                  borderWidth: 1,
                  borderColor: n.read ? brand.borderColor : brand.accent,
                  gap: 4,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: brand.textPrimary, flex: 1 }}>
                    {n.title}
                  </Text>
                  {!n.read && (
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: brand.accent,
                      }}
                    />
                  )}
                </View>
                <Text style={{ fontSize: 13, color: brand.textSecondary }}>{n.body}</Text>
                <Text style={{ fontSize: 11, color: brand.textMuted }}>
                  {n.createdAt.slice(0, 16).replace("T", " ")}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
