import { feedbackGate, loadFeedbackPreference } from "@/services/feedback";
import { HankenGrotesk_400Regular, HankenGrotesk_500Medium, HankenGrotesk_600SemiBold } from "@expo-google-fonts/hanken-grotesk";
import { LibreCaslonText_400Regular, LibreCaslonText_700Bold } from "@expo-google-fonts/libre-caslon-text";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments, usePathname } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { ActivityIndicator, AppState, Text, View } from "react-native";
import ErrorBoundary from "@/components/ErrorBoundary";
import PaywallSheet from "@/components/PaywallSheet";
import OwnerPinModal from "@/components/OwnerPinModal";
import { FEATURE_FLAGS } from "@/constants/config";
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
    hasNavigated.current = true;
    const first = segments[0];
    if (!prefs.hasCompletedOnboarding && first !== "onboarding") {
      router.replace("/onboarding");
    } else if (prefs.hasCompletedOnboarding && first === "onboarding") {
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
      <Stack.Screen name="welcome-preview" options={{ headerShown: false }} />
      <Stack.Screen name="watch/[id]" options={{ headerShown: false, presentation: "fullScreenModal" }} />
      <Stack.Screen name="channel/[id]" options={{ title: "" }} />
      <Stack.Screen name="privacy" options={{ title: "Privacy" }} />
      <Stack.Screen name="terms" options={{ title: "Terms" }} />
      <Stack.Screen name="diagnostics" options={{ title: "Beta Support" }} />
      <Stack.Screen name="google-import" options={{ title: "Import subscriptions", presentation: "modal" }} />
      <Stack.Screen name="add-to-queue" options={{ presentation: "modal", title: "Add to session" }} />
      <Stack.Screen name="session" options={{ presentation: "modal", title: "Session" }} />
      <Stack.Screen name="session/[id]" options={{ title: "" }} />
    </Stack>
  );
}

function ThemedApp() {
  const pathname = usePathname();
  React.useLayoutEffect(() => { feedbackGate.invalidate(); }, [pathname]);
  React.useEffect(() => {
    void loadFeedbackPreference();
    const listener = AppState.addEventListener("change", () => feedbackGate.invalidate());
    return () => listener.remove();
  }, []);
  const segments = useSegments();
  const { isDark, palette } = useFrameTheme();
  const { profileSwitching, activeProfileId } = useApp();
  const isWatching = segments[0] === "watch";

  return (
    <View style={{ flex: 1, backgroundColor: isWatching ? watchPalette.wall : palette.wall }}>
      <StatusBar style={isWatching || isDark ? "light" : "dark"} />
      <View key={activeProfileId} style={{ flex: 1 }}><AppContent /></View>
      {profileSwitching ? <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", backgroundColor: palette.wall }} accessible accessibilityLabel="Switching profile"><ActivityIndicator color={palette.active} /><Text style={{ color: palette.ink, marginTop: 16 }}>Switching profile…</Text></View> : null}
      {FEATURE_FLAGS.paidAccess ? <PaywallSheet /> : null}
      <OwnerPinModal />
    </View>
  );
}

export default function RootLayout() {
  const [fontWaitExpired, setFontWaitExpired] = React.useState(false);
  React.useEffect(() => { const timer = setTimeout(() => setFontWaitExpired(true), 8000); return () => clearTimeout(timer); }, []);
  const [fontsLoaded, fontError] = useFonts({
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    LibreCaslonText_400Regular,
    LibreCaslonText_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError || fontWaitExpired) SplashScreen.hideAsync().catch(() => {});
  }, [fontError, fontsLoaded, fontWaitExpired]);

  if (!fontsLoaded && !fontError && !fontWaitExpired) return null;

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

