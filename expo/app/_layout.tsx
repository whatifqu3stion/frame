import { useDiscoveryRunLifecycle } from "@/hooks/useDiscoveryRun";
import CollectionArrivalProvider from "@/providers/CollectionArrivalProvider";
import ThemeTransitionProvider from "@/providers/ThemeTransitionProvider";
import RoomLightingProvider from "@/providers/RoomLightingProvider";
import Text, { FontScaleProvider } from "@/components/FrameText";
import ProgrammeGrain from "@/components/ProgrammeGrain";
import PaperSurface from "@/components/PaperSurface";
import PreviewLibraryBar from "@/preview/PreviewLibraryBar";
import ProgressRecoveryNotice from "@/components/ProgressRecoveryNotice";
import { keepPendingWatch, takePendingWatch } from "@/storage/pendingWatchStorage";
import { feedbackGate, loadFeedbackPreference } from "@/services/feedback";
import { HankenGrotesk_400Regular, HankenGrotesk_500Medium, HankenGrotesk_600SemiBold } from "@expo-google-fonts/hanken-grotesk";
import { LibreCaslonText_400Regular, LibreCaslonText_400Regular_Italic, LibreCaslonText_700Bold } from "@expo-google-fonts/libre-caslon-text";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments, usePathname } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { ActivityIndicator, AppState, Platform, View } from "react-native";
import ErrorBoundary from "@/components/ErrorBoundary";
import StartupGate from "@/components/StartupGate";
import { rememberRecoveryAppearance } from "@/services/recoveryAppearance";
import OwnerPinModal from "@/components/OwnerPinModal";
import { fonts, watchPalette } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { AppProvider, useApp } from "@/providers/AppProvider";
import { clearOrientationRequest, setOrientationRequest } from "@/services/orientation";

SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { ready, prefs, activeProfileId } = useApp();
  const entryPath = usePathname();
  const { palette } = useFrameTheme();
  const router = useRouter();
  const segments = useSegments();
  const hasNavigated = React.useRef<boolean>(false);

  useEffect(() => {
    void setOrientationRequest("app", ScreenOrientation.OrientationLock.DEFAULT);
    return () => { void clearOrientationRequest("app"); };
  }, []);

  const mounted = React.useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (Platform.isTV || !ready || hasNavigated.current) return;
    hasNavigated.current = true;
    const first = segments[0];
    if (!prefs.hasCompletedOnboarding && first !== "onboarding") {
      void keepPendingWatch(activeProfileId, entryPath).catch(() => {}).finally(() => { if (mounted.current) router.replace("/onboarding"); });
    } else if (prefs.hasCompletedOnboarding && first === "onboarding") {
      void takePendingWatch(activeProfileId).catch(() => null).then((id) => { if (mounted.current) router.replace(id ? { pathname: "/watch/[id]", params: { id } } : "/(tabs)"); });
    }
  }, [activeProfileId, entryPath, ready, prefs.hasCompletedOnboarding, segments, router]);

  return (
    <Stack
      screenLayout={({ children, route }) => Platform.isTV || route.name === "watch/[id]" || route.name === "(tabs)" ? <>{children}</> : <PaperSurface>{children}</PaperSurface>}
      screenOptions={{
        headerBackTitle: "Back",
        contentStyle: { backgroundColor: Platform.isTV ? "transparent" : palette.wall },
        headerStyle: { backgroundColor: Platform.isTV ? "transparent" : palette.wall },
        // Native-stack treats a custom Android header background as translucent.
        // Keep the native header opaque so the first content row receives taps.
        headerBackground: Platform.OS === "android" || Platform.isTV ? undefined : () => <PaperSurface />,
        headerTintColor: palette.ink,
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: fonts.serif, fontSize: 17 },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Protected guard={!Platform.isTV}>
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="welcome-preview" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Screen name="watch/[id]" options={{ headerShown: false, presentation: "card", animation: "none", contentStyle: { backgroundColor: watchPalette.wall } }} />
      <Stack.Screen name="channel/[id]" options={{ title: "" }} />
      <Stack.Screen name="privacy" options={{ title: "Privacy" }} />
      <Stack.Screen name="terms" options={{ title: "Terms" }} />
      <Stack.Screen name="settings/[section]" options={{ title: "Settings" }} />
      <Stack.Screen name="diagnostics" options={{ title: "Device diagnostics" }} />
      <Stack.Screen name="add-source" options={{ headerShown: false }} />
      <Stack.Screen name="google-import" options={{ title: "Import subscriptions", presentation: "modal" }} />
      <Stack.Screen name="add-to-queue" options={{ presentation: "modal", title: "Add to session" }} />
      <Stack.Screen name="session" options={{ presentation: "modal", title: "Session", headerTitle: () => null }} />
      <Stack.Screen name="session/[id]" options={{ title: "Session", headerTitle: () => null }} />
    </Stack>
  );
}

function ThemedApp() {
  useDiscoveryRunLifecycle();
  const pathname = usePathname();
  React.useLayoutEffect(() => { feedbackGate.invalidate(); }, [pathname]);
  React.useEffect(() => {
    void loadFeedbackPreference();
    const listener = AppState.addEventListener("change", () => feedbackGate.invalidate());
    return () => listener.remove();
  }, []);
  const segments = useSegments();
  const { isDark, palette } = useFrameTheme();
  const { profileSwitching, activeProfileId, prefs } = useApp();
  React.useLayoutEffect(() => { rememberRecoveryAppearance(prefs.theme, prefs.accent); }, [prefs.theme, prefs.accent]);
  const isWatching = segments[0] === "watch";
  const wall = isWatching ? watchPalette.wall : palette.wall;
  React.useLayoutEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", wall);
    document.body.style.backgroundColor = wall;
    document.documentElement.style.colorScheme = isWatching || isDark ? "dark" : "light";
  }, [isDark, isWatching, wall]);

  return (
    <View nativeID={Platform.isTV ? `frame-tv-palette:${palette.active}:${palette.onAccent}` : undefined} style={{ flex: 1, backgroundColor: wall }}>
      {Platform.isTV && !isWatching && <ProgrammeGrain finish="sheet" />}
      <StatusBar hidden={Platform.isTV} style={isWatching || isDark ? "light" : "dark"} />
      {pathname !== "/onboarding" && pathname !== "/welcome-preview" && <PreviewLibraryBar />}
      <View key={activeProfileId} style={[{ flex: 1 }, Platform.isTV && !isWatching && { paddingHorizontal: 32, paddingVertical: 18 }]}><AppContent /></View>
      <ProgressRecoveryNotice profileId={activeProfileId} hidden={isWatching || profileSwitching} />
      {profileSwitching ? <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", backgroundColor: palette.wall }} accessible accessibilityLabel="Switching profile"><ActivityIndicator color={palette.active} /><Text style={{ color: palette.ink, marginTop: 16 }}>Switching profile…</Text></View> : null}
      <OwnerPinModal />
    </View>
  );
}

export default function RootLayout() {
  // Keep the provider and mounted query observers on the same cache during Fast Refresh.
  const [queryClient] = React.useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: false } },
  }));
  const [fontWaitExpired, setFontWaitExpired] = React.useState(false);
  React.useEffect(() => { const timer = setTimeout(() => setFontWaitExpired(true), 8000); return () => clearTimeout(timer); }, []);
  const [fontsLoaded, fontError] = useFonts({
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    LibreCaslonText_400Regular,
    LibreCaslonText_400Regular_Italic,
    LibreCaslonText_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError || fontWaitExpired) SplashScreen.hideAsync().catch(() => {});
  }, [fontError, fontsLoaded, fontWaitExpired]);

  if (!fontsLoaded && !fontError && !fontWaitExpired) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <FontScaleProvider><AppProvider>
          <StartupGate><ThemeTransitionProvider><CollectionArrivalProvider><RoomLightingProvider><ThemedApp /></RoomLightingProvider></CollectionArrivalProvider></ThemeTransitionProvider></StartupGate>
        </AppProvider></FontScaleProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

