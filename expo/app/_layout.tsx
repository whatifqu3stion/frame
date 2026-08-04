import { HankenGrotesk_400Regular, HankenGrotesk_500Medium, HankenGrotesk_600SemiBold } from "@expo-google-fonts/hanken-grotesk";
import { LibreCaslonText_400Regular, LibreCaslonText_700Bold } from "@expo-google-fonts/libre-caslon-text";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { View } from "react-native";
import ErrorBoundary from "@/components/ErrorBoundary";
import PaywallSheet from "@/components/PaywallSheet";
import { fonts, watchPalette } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { AppProvider, useApp } from "@/providers/AppProvider";
import { clearOrientationRequest, setOrientationRequest } from "@/services/orientation";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } },
});

function AppContent() {
  const { ready, prefs } = useApp();
  const { palette } = useFrameTheme();
  const router = useRouter();
  const segments = useSegments();
  const hasNavigated = React.useRef<boolean>(false);

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
        headerTitleStyle: { fontFamily: fonts.serif, fontSize: 17 },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="watch/[id]" options={{ headerShown: false, presentation: "fullScreenModal" }} />
      <Stack.Screen name="channel/[id]" options={{ title: "" }} />
      <Stack.Screen name="privacy" options={{ title: "Privacy" }} />
      <Stack.Screen name="terms" options={{ title: "Terms" }} />
      <Stack.Screen name="diagnostics" options={{ title: "Diagnostics" }} />
      <Stack.Screen name="add-to-queue" options={{ presentation: "modal", title: "Add to Queue" }} />
      <Stack.Screen name="session" options={{ presentation: "modal", title: "Session" }} />
    </Stack>
  );
}

function ThemedApp() {
  const segments = useSegments();
  const { isDark, palette } = useFrameTheme();
  const isWatching = segments[0] === "watch";

  return (
    <View style={{ flex: 1, backgroundColor: isWatching ? watchPalette.wall : palette.wall }}>
      <StatusBar style={isWatching || isDark ? "light" : "dark"} />
      <AppContent />
      <PaywallSheet />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    LibreCaslonText_400Regular,
    LibreCaslonText_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <ThemedApp />
        </AppProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
