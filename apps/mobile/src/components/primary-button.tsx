import { ActivityIndicator, Pressable, Text, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, spacing, useBrandColors } from "@/theme";
import { triggerHaptic } from "@/services/sounds";

type ButtonVariant = "primary" | "secondary" | "outline" | "destructive";

export function PrimaryButton({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  accentHex,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  accentHex?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const brand = useBrandColors(accentHex);
  const bg =
    variant === "primary"
      ? brand.accent
      : variant === "destructive"
        ? brand.danger
        : variant === "secondary"
          ? colors.tertiaryBackground
          : "transparent";

  const ink =
    variant === "primary" || variant === "destructive" ? colors.onTint : colors.label;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      pressRetentionOffset={{ top: 12, bottom: 12, left: 12, right: 12 }}
      onPress={() => {
        void triggerHaptic("light");
        onPress();
      }}
      style={({ pressed }) => [
        {
          minHeight: 46,
          paddingHorizontal: spacing.md,
          paddingVertical: 12,
          borderRadius: radius.full,
          backgroundColor: bg,
          borderWidth: variant === "outline" ? 1 : 0,
          borderColor: colors.separator,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.sm,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && !disabled && !loading ? 0.97 : 1 }],
        },
        style,
      ]}
    >
      {loading && <ActivityIndicator size="small" color={ink} />}
      <Text
        style={{
          color: ink,
          fontSize: 15,
          fontWeight: "600",
          letterSpacing: -0.1,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
