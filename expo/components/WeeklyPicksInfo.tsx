import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import Text from "@/components/FrameText";
import InfoDisclosure from "@/components/InfoDisclosure";
import InlineHelp from "@/components/InlineHelp";
import { spacing } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

export default function WeeklyPicksInfo({ anchor, onSetUpKeys }: { anchor: ReactNode; onSetUpKeys?(): void }) {
  const { palette, type } = useFrameTheme();
  return <InfoDisclosure label="How weekly picks work" anchor={anchor}>
    <View style={{ gap: spacing.md }}>
      <View style={{ gap: spacing.xs }}>
        <Text style={type.label}>Find new creators to follow</Text>
        <Text style={type.bodySoft}>Start a weekly search based on your interests. Frame suggests up to 12 creators, shown 3 at a time. Preview a video, then follow anyone you like.</Text>
      </View>
      <View style={{ gap: spacing.xs }}>
        <Text style={type.label}>Build your daily selection</Text>
        <Text style={type.bodySoft}>Following adds a creator to your library. Include them in Today to let Frame pick from their videos for your daily selection.</Text>
      </View>
      <View style={{ gap: spacing.xs }}>
        <Text style={type.label}>Changing your interests</Text>
        <Text style={type.bodySoft}>Your current weekly picks stay the same. Updated interests guide your next weekly search.</Text>
      </View>
    </View>
    <InlineHelp label="How the search uses your API keys">
      <Text style={type.bodySoft}>Gemini uses your interests and public video titles and descriptions to suggest and assess creators. YouTube checks that the channels and videos are available. Suggested videos are at least 4 minutes long.</Text>
      <Text style={type.bodySoft}>One search can make up to 25 Gemini requests, plus YouTube API requests. These count toward your provider quotas and may incur charges. Browsing the saved suggestions does not run another AI search.</Text>
      <Text style={type.bodySoft}>If a provider error interrupts the search, Frame saves any suggestions it has finished checking. If a completed search returns no suggestions, you can try once more that week. Frame never retries automatically.</Text>
      <Pressable accessibilityRole="button" onPress={onSetUpKeys ?? (() => router.push("/settings/keys"))}
        style={{ minHeight: 48, alignSelf: "flex-start", justifyContent: "center" }}>
        <Text style={[type.label, { color: palette.active }]}>Manage API keys</Text>
      </Pressable>
    </InlineHelp>
  </InfoDisclosure>;
}
