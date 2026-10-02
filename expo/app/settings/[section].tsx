import { Redirect, Stack, router, useLocalSearchParams, useNavigation } from "expo-router";
import { Pressable, Text } from "react-native";
import SettingsDetails from "@/components/SettingsDetails";
import { FEATURE_FLAGS } from "@/constants/config";
import { isSettingsSection, SETTINGS_TITLES } from "@/constants/settings";
import { useFrameTheme } from "@/constants/useFrameTheme";

export default function SettingsDetailScreen() {
  const { section } = useLocalSearchParams<{ section: string | string[] }>();
  const { palette, type } = useFrameTheme();
  const navigation = useNavigation();
  const key = Array.isArray(section) ? section[0] : section;
  if (!isSettingsSection(key) || (key === "premium" && !FEATURE_FLAGS.paidAccess)) {
    return <Redirect href="/(tabs)/settings" />;
  }
  return <>
    <Stack.Screen options={{
      title: SETTINGS_TITLES[key],
      headerLeft: navigation.canGoBack() ? undefined : () => <Pressable onPress={() => router.replace("/(tabs)/settings")} accessibilityRole="button" accessibilityLabel="Back to Settings" style={{ minHeight: 48, justifyContent: "center" }}><Text style={[type.label, { color: palette.active }]}>Settings</Text></Pressable>,
    }} />
    <SettingsDetails key={key} section={key} />
  </>;
}
