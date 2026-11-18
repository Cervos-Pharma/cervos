import { Pressable, Text, View } from "react-native";
import { PlatformIcon } from "@/components/platform-icon";
import { PrimaryButton } from "@/components/primary-button";
import { colors, radius, spacing, typography, useBrandColors } from "@/theme";

export function WorkspaceSkeleton() {
  const brand = useBrandColors();
  const blockBg = brand.isDark ? "#182030" : "#E6EAF0";
  return (
    <View style={{ padding: spacing.md, gap: spacing.md }}>
      <View style={{ height: 84, borderRadius: radius.xl, borderCurve: "continuous", backgroundColor: blockBg }} />
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <View style={{ flex: 1, height: 100, borderRadius: radius.lg, borderCurve: "continuous", backgroundColor: blockBg }} />
        <View style={{ flex: 1, height: 100, borderRadius: radius.lg, borderCurve: "continuous", backgroundColor: blockBg }} />
      </View>
      <View style={{ height: 160, borderRadius: radius.xl, borderCurve: "continuous", backgroundColor: blockBg }} />
    </View>
  );
}

export function ErrorBanner({
  message,
  onRetry,
  actionLabel = "Retry",
}: {
  message: string;
  onRetry?: () => void;
  actionLabel?: string;
}) {
  const brand = useBrandColors();
  return (
    <View
      style={{
        padding: spacing.md,
        borderRadius: radius.lg,
        borderCurve: "continuous",
        backgroundColor: brand.dangerSoft,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.sm,
      }}
    >
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <PlatformIcon sf="exclamationmark.triangle.fill" md="warning" color={brand.danger} size={18} />
        <Text style={{ flex: 1, fontSize: 13, fontWeight: "500", color: brand.danger }}>
          {message}
        </Text>
      </View>
      {onRetry && (
        <Pressable
          onPress={onRetry}
          hitSlop={10}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: radius.full,
            backgroundColor: brand.danger,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.onTint }}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function EmptyStateCard({
  sf = "tray",
  md = "inbox",
  title,
  description,
  actionLabel,
  onAction,
  accentHex,
}: {
  sf?: React.ComponentProps<typeof PlatformIcon>["sf"];
  md?: React.ComponentProps<typeof PlatformIcon>["md"];
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  accentHex?: string;
}) {
  const brand = useBrandColors(accentHex);
  return (
    <View
      style={{
        padding: spacing.lg,
        borderRadius: radius.xl,
        borderCurve: "continuous",
        backgroundColor: colors.secondaryGroupedBackground,
        alignItems: "center",
        gap: spacing.sm,
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: radius.full,
          backgroundColor: brand.accentSoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <PlatformIcon sf={sf} md={md} color={brand.accent} size={22} />
      </View>
      <Text style={[typography.headline, { textAlign: "center", marginTop: spacing.xs }]}>
        {title}
      </Text>
      <Text style={[typography.subhead, { textAlign: "center", maxWidth: 290 }]}>
        {description}
      </Text>
      {actionLabel && onAction && (
        <PrimaryButton
          title={actionLabel}
          onPress={onAction}
          accentHex={accentHex}
          style={{ marginTop: spacing.xs }}
        />
      )}
    </View>
  );
}
