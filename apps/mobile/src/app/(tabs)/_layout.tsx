import { Platform } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { NativeTabs } from "expo-router/native-tabs";
import type { SFSymbol } from "expo-symbols";
import type { ComponentProps } from "react";
import { useMobileSession } from "@/context/session-context";
import { useBrandColors } from "@/theme";

function tabIcon(
  sf: SFSymbol,
  mdName: ComponentProps<typeof MaterialIcons>["name"]
) {
  if (Platform.OS === "ios") {
    return { sf };
  }
  return {
    src: MaterialIcons.getImageSource(mdName, 24, "#60646C"),
    renderingMode: "template" as const,
  };
}

export default function AppTabsLayout() {
  const { workspace, capabilities } = useMobileSession();
  const brand = useBrandColors(workspace?.account?.customization?.brandAccent);

  return (
    <NativeTabs minimizeBehavior="onScrollDown" tintColor={brand.accent}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon {...tabIcon("house.fill", "home")} />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="pos" hidden={!capabilities.canSellPos}>
        <NativeTabs.Trigger.Icon {...tabIcon("cart.fill", "point-of-sale")} />
        <NativeTabs.Trigger.Label>POS</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="inventory">
        <NativeTabs.Trigger.Icon {...tabIcon("pills.fill", "inventory-2")} />
        <NativeTabs.Trigger.Label>Stock</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="receipts">
        <NativeTabs.Trigger.Icon {...tabIcon("doc.text.fill", "receipt-long")} />
        <NativeTabs.Trigger.Label>Receipts</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Icon {...tabIcon("square.grid.2x2.fill", "grid-view")} />
        <NativeTabs.Trigger.Label>More</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
