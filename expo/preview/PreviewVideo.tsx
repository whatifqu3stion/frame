import { posterForTopic } from "@/constants/onboardingPosters";
import { sampleVideoTopic } from "./interestPicks";
import Text from "@/components/FrameText";
import { useState } from "react";
import { useFinishedRoom } from "@/providers/RoomLightingProvider";
import CompletionArtwork from "@/components/motion/CompletionArtwork";
import { router } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import MediaImage from "@/components/MediaImage";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { watchPalette } from "@/constants/theme";
import { makePreviewLibrary } from "./library";

export default function PreviewVideo({ id }: { id: string }) {
  const [ending, setEnding] = useState(false);
  useFinishedRoom(ending);
  const { type } = useFrameTheme();
  const palette = watchPalette;
  const video = makePreviewLibrary(Date.now()).videos.find((item) => item.id === id);
  return <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 48 }}>
    <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")} style={{ paddingHorizontal: 20, minHeight: 56, justifyContent: "center" }}><Text style={[type.label, { color: palette.ink }]}>Back to library</Text></Pressable>
    {ending ? <View style={{ padding: 24, backgroundColor: palette.programme, alignItems: "center" }}><CompletionArtwork uri={video?.thumbnailUrl} /><Text style={[type.heading, { color: palette.onProgramme }]}>A good place to stop.</Text><Pressable accessibilityRole="button" onPress={() => router.back()} style={{ minHeight: 48, justifyContent: "center" }}><Text style={[type.label, { color: palette.onProgramme }]}>Done for now</Text></Pressable></View> : <MediaImage source={posterForTopic(sampleVideoTopic(id))} style={{ width: "100%", aspectRatio: 16 / 9 }} contentFit="contain" transition={0} />}
    <View style={{ padding: 24, gap: 16, maxWidth: 760 }}>
      <Text style={[type.caption, { color: palette.inkSoft }]}>{video?.channelTitle ?? "Sample video"}</Text>
      <Text style={[type.heading, { color: palette.ink }]}>{video?.title ?? "Preview only"}</Text>
      <Pressable accessibilityRole="button" onPress={() => setEnding((value) => !value)} style={{ minHeight: 48, justifyContent: "center" }}><Text style={[type.label, { color: palette.accent }]}>{ending ? "Back to sample artwork" : "Preview ending"}</Text></Pressable>
      <Text style={[type.bodySoft, { color: palette.inkSoft }]}>This is a fictional sample for exploring Frame’s design. Sample videos don’t play. Your real library will use YouTube videos from the creators you follow.</Text>
    </View>
  </ScrollView>;
}
