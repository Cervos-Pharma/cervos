import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { MobileSessionProvider } from "../src/context/MobileSessionContext";

export default function RootLayout() {
  return (
    <MobileSessionProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="gate" />
        <Stack.Screen name="lounge" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </MobileSessionProvider>
  );
}
