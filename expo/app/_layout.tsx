import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { AppProvider, useApp } from "@/providers/AppProvider";
import { palette } from "@/constants/theme";
import ErrorBoundary from "@/components/ErrorBoundary";
import PaywallSheet from "@/components/PaywallSheet";
import { clearOrientationRequest, setOrientationRequest } from "@/services/orientation";
import * as ScreenOrientation from "expo-screen-orientation";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } },
});

function AppContent() {
  const { ready, prefs } = useApp();
  const router = useRouter();
  const segments = useSegments();
  const hasNavigated = React.useRef(false);

  useEffect(() => {
    void setOrientationRequest("app", ScreenOrientation.OrientationLock.PORTRAIT_UP);
    return () => { void clearOrientationRequest("app"); };
  }, []);

  useEffect(() => {
    if (!ready || hasNavigated.current) return;
    const first = segments[0];
    if (!prefs.hasCompletedOnboarding && first !== "onboarding") {
      hasNavigated.current = true;
      router.replace("/onboarding");
    } else if (prefs.hasCompletedOnboarding && first === "onboarding") {
      hasNavigated.current = true;
      router.replace("/(tabs)");
    }
  }, [ready, prefs.hasCompletedOnboarding, segments, router]);

  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Back",
        contentStyle: { backgroundColor: palette.wall },
        headerStyle: { backgroundColor: palette.wall },
        headerTintColor: palette.ink,
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: "Georgia", fontSize: 17 },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="watch/[id]" options={{ headerShown: false, presentation: "fullScreenModal" }} />
      <Stack.Screen name="channel/[id]" options={{ title: "" }} />
      <Stack.Screen name="privacy" options={{ title: "Privacy" }} />
      <Stack.Screen name="terms" options={{ title: "Terms" }} />
      <Stack.Screen name="add-to-queue" options={{ presentation: "modal", title: "Add to Queue" }} />
      <Stack.Screen name="session" options={{ presentation: "modal", title: "Session" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const segments = useSegments();
  const isWatching = segments[0] === "watch";

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <View style={{ flex: 1, backgroundColor: palette.wall }}>
            <StatusBar style={isWatching ? "light" : "dark"} />
            <AppContent />
            <PaywallSheet />
          </View>
        </AppProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
