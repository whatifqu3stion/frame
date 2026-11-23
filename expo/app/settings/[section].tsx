import Text from "@/components/FrameText";
import { Redirect, Stack, router, useLocalSearchParams, useNavigation } from "expo-router";
import { Platform, Pressable } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { spacing } from "@/constants/theme";
import SettingsDetails from "@/components/SettingsDetails";
import { isSettingsSection, SETTINGS_TITLES } from "@/constants/settings";
import { useFrameTheme } from "@/constants/useFrameTheme";

export default function SettingsDetailScreen() {
  const { section, setup, after } = useLocalSearchParams<{ section: string | string[]; setup?: string; after?: string }>();
  const { palette, type } = useFrameTheme();
  const navigation = useNavigation();
  const key = Array.isArray(section) ? section[0] : section;
  if (!isSettingsSection(key)) {
    return <Redirect href="/(tabs)/settings" />;
  }
  const topicEditor = key === "topics" || key === "priorities" || key === "brief";
  return <>
    <Stack.Screen options={{
      title: SETTINGS_TITLES[key],
      ...(key === "channels" && Platform.OS === "android" && !Platform.isTV ? { headerBackground: undefined, headerTransparent: false } : {}),
      headerLeft: navigation.canGoBack() ? undefined : () => <Pressable onPress={() => router.replace(topicEditor ? "/settings/interests" : "/(tabs)/settings")} accessibilityRole="button" accessibilityLabel={topicEditor ? "Back to Weekly interests" : "Back to Settings"} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, marginRight: spacing.md }}><ArrowLeft size={20} color={palette.ink} /><Text style={[type.label, { color: palette.ink }]}>{topicEditor ? "Weekly interests" : "Settings"}</Text></Pressable>,
    }} />
    <SettingsDetails key={key} section={key} onYouTubeConnected={key === "keys" && Platform.isTV && setup === "youtube" ? () => {
      if (after === "find-source") router.replace("/add-source");
      else if (router.canGoBack()) router.back();
      else router.replace("/(tabs)");
    } : undefined} />
  </>;
}
