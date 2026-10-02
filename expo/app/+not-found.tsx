import { Link, Stack } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Pressable, Text, ScrollView } from "react-native";
import { spacing, type FramePalette } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

export default function NotFoundScreen() {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  return (
    <>
      <Stack.Screen options={{ title: "" }} />
      <ScrollView style={{ flex: 1, backgroundColor: palette.wall }} contentContainerStyle={styles.container}>
        <Text style={[type.title, { marginTop: spacing.sm }]} accessibilityRole="header">This screen isn’t available</Text>
        <Text style={[type.bodySoft, { marginTop: spacing.md, maxWidth: 280 }]}>
          Return to Today to choose a video or open another part of Frame.
        </Text>
        <Link href="/" asChild><Pressable style={styles.link} accessibilityRole="button">
          <Text style={[type.caption, { color: palette.accent }]}>Back to Today</Text>
        </Pressable></Link>
      </ScrollView>
    </>
  );
}

function createStyles(palette: FramePalette) {
  return StyleSheet.create({
    container: { flexGrow: 1, padding: spacing.lg, paddingTop: spacing.xxl, backgroundColor: palette.wall },
    link: { marginTop: spacing.xl, minHeight: 48, justifyContent: "center", alignSelf: "flex-start", paddingHorizontal: spacing.md },
  });
}

