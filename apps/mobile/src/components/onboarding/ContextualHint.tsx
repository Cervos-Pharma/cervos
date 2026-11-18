import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Storage from "expo-sqlite/kv-store";
import { PlatformIcon } from "@/components/platform-icon";
import { colors, radius, spacing } from "@/theme";

interface ContextualHintProps {
  id: string;
  text: string;
  accentColor: string;
  tintBackground: string;
}

export function ContextualHint({ id, text, accentColor, tintBackground }: ContextualHintProps) {
  const key = `cervos_hint_${id}`;
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return Storage.getItemSync(key) === "1";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const dismiss = () => {
    try {
      Storage.setItemSync(key, "1");
    } catch {
      // Ignore kv failure
    }
    setDismissed(true);
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: 8,
        borderRadius: radius.md,
        borderCurve: "continuous",
        backgroundColor: tintBackground,
      }}
    >
      <PlatformIcon sf="lightbulb.fill" md="tips-and-updates" color={accentColor} size={16} />
      <Text style={{ flex: 1, fontSize: 12, color: colors.label, lineHeight: 16 }}>{text}</Text>
      <Pressable onPress={dismiss} hitSlop={8}>
        <PlatformIcon sf="xmark.circle.fill" md="close" color={colors.secondaryLabel} size={16} />
      </Pressable>
    </View>
  );
}
