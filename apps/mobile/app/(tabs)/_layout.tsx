import { Tabs } from "expo-router";
import { MobileBottomDock, MobileTopHeader } from "../../src/components/MobileShellChrome";

export default function MobileTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        header: () => <MobileTopHeader />,
      }}
      tabBar={(props) => <MobileBottomDock {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: "Counter POS" }} />
      <Tabs.Screen name="inventory" options={{ title: "Inventory" }} />
      <Tabs.Screen name="scanner" options={{ title: "Scanner" }} />
      <Tabs.Screen name="receipts" options={{ title: "Receipts" }} />
      <Tabs.Screen name="messages" options={{ title: "Messages" }} />
      <Tabs.Screen name="permits" options={{ title: "Permits & Sync" }} />
    </Tabs>
  );
}
