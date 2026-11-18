import { useEffect } from "react";
import { Platform, useColorScheme } from "react-native";
import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router/react-navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { MobileSessionProvider, useMobileSession } from "@/context/session-context";
import { colors } from "@/theme";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 3,
      retry: 1,
    },
  },
});

function RootNavigator() {
  const { hydrated } = useMobileSession();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  useEffect(() => {
    if (hydrated) {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [hydrated]);

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: colors.groupedBackground },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="gate" options={{ title: "Station Unlock", headerBackVisible: false }} />
        <Stack.Screen name="onboarding" options={{ title: "Workspace Setup", headerBackVisible: false }} />
        <Stack.Screen name="lounge" options={{ title: "Welcome Lounge", headerBackVisible: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: "fade" }} />
        <Stack.Screen
          name="scanner-modal"
          options={{
            presentation: "modal",
            title: "Scan Barcode / QR",
          }}
        />
        <Stack.Screen
          name="receipt-sheet"
          options={{
            presentation: Platform.OS === "ios" ? "formSheet" : "modal",
            sheetGrabberVisible: true,
            sheetAllowedDetents: [0.75, 1.0],
            title: "Receipt",
          }}
        />
        <Stack.Screen
          name="batch-sheet"
          options={{
            presentation: Platform.OS === "ios" ? "formSheet" : "modal",
            sheetGrabberVisible: true,
            sheetAllowedDetents: [0.85, 1.0],
            title: "Stock Batch",
          }}
        />
        <Stack.Screen name="branch-chat" options={{ title: "Branch Chat" }} />
        <Stack.Screen name="wholesale" options={{ title: "Wholesale & Kasri" }} />
        <Stack.Screen
          name="reports"
          options={{
            title: "Reports & Insights",
            headerLargeTitleEnabled: Platform.OS === "ios",
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            title: "Settings",
            headerLargeTitleEnabled: Platform.OS === "ios",
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <QueryClientProvider client={queryClient}>
          <MobileSessionProvider>
            <RootNavigator />
          </MobileSessionProvider>
        </QueryClientProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
