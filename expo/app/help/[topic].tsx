import { Redirect, Stack, router, useLocalSearchParams } from "expo-router";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Text from "@/components/FrameText";
import SettingsRow from "@/components/SettingsRow";
import { HELP_TOPICS } from "@/constants/helpTopics";
import { boundedReading } from "@/constants/layout";
import { spacing } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";

export default function HelpTopicScreen() {
  const { topic } = useLocalSearchParams<{ topic: string }>();
  const { activeProfile } = useApp();
  const guide = HELP_TOPICS.find(item => item.id === topic);
  const { type } = useFrameTheme();
  const insets = useSafeAreaInsets();
  if (!guide || (guide.id === "interests" && activeProfile?.role === "managed")) return <Redirect href="/settings/about" />;
  return <>
    <Stack.Screen options={{ title: guide.title, headerBackTitle: "Help" }} />
    <ScrollView contentContainerStyle={[boundedReading, { paddingLeft: insets.left + spacing.page, paddingRight: insets.right + spacing.page, paddingVertical: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.lg }]}>
      <Text style={type.body}>{guide.body}</Text>
      <SettingsRow title={guide.action} onPress={() => router.push(guide.href)} />
    </ScrollView>
  </>;
}
