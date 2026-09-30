import { router, Stack } from "expo-router";
import { Pressable, Text, ScrollView } from "react-native";
import { useFrameTheme } from "@/constants/useFrameTheme";

export default function LinkUnavailable() {
  const { palette, type } = useFrameTheme();
  return <ScrollView style={{ flex: 1, backgroundColor: palette.wall }} contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: "center", gap: 16 }}>
    <Stack.Screen options={{ title: "Link unavailable" }} />
    <Text style={type.title} accessibilityRole="header">This link couldn’t open</Text>
    <Text style={type.bodySoft}>Open Frame to choose a video, or paste a supported video or source link in Sources.</Text>
    <Pressable onPress={() => router.replace("/(tabs)")} accessibilityRole="button" style={{ minHeight: 48, padding: 16, borderRadius: 10, backgroundColor: palette.accentDeep, alignItems: "center" }}><Text style={[type.label, { color: palette.onDark }]}>Open Today</Text></Pressable>
  </ScrollView>;
}
