import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useMobileSession } from "../../src/context/MobileSessionContext";
import { CERVOS_COLORS, MOBILE_COPY } from "../../src/theme/tokens";

export default function MobileTabsLayout() {
  const { lang, isDark } = useMobileSession();
  const copy = MOBILE_COPY[lang];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: CERVOS_COLORS.cobalt,
        tabBarInactiveTintColor: isDark ? CERVOS_COLORS.darkMuted : CERVOS_COLORS.lightMuted,
        tabBarStyle: {
          backgroundColor: isDark ? CERVOS_COLORS.darkCard : CERVOS_COLORS.lightCard,
          borderTopColor: isDark ? CERVOS_COLORS.darkBorder : CERVOS_COLORS.lightBorder,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: copy.counter,
          tabBarIcon: ({ color }: { color: string }) => <Text style={{ color, fontWeight: "800", fontSize: 14 }}>POS</Text>,
        }}
      />
      <Tabs.Screen
        name="scanner"
        options={{
          title: copy.scanner,
          tabBarIcon: ({ color }: { color: string }) => <Text style={{ color, fontWeight: "800", fontSize: 14 }}>QR</Text>,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: copy.inventory,
          tabBarIcon: ({ color }: { color: string }) => <Text style={{ color, fontWeight: "800", fontSize: 14 }}>FEFO</Text>,
        }}
      />
      <Tabs.Screen
        name="receipts"
        options={{
          title: copy.receipts,
          tabBarIcon: ({ color }: { color: string }) => <Text style={{ color, fontWeight: "800", fontSize: 14 }}>RCP</Text>,
        }}
      />
      <Tabs.Screen
        name="permits"
        options={{
          title: copy.permits,
          tabBarIcon: ({ color }: { color: string }) => <Text style={{ color, fontWeight: "800", fontSize: 14 }}>SYNC</Text>,
        }}
      />
    </Tabs>
  );
}
