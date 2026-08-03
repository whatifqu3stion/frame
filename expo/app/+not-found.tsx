import { Link, Stack } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { spacing, type FramePalette } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

export default function NotFoundScreen() {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette), [palette]);
  return (
    <>
      <Stack.Screen options={{ title: "" }} />
      <View style={styles.container}>
        <Text style={type.caption}>404</Text>
        <Text style={[type.title, { marginTop: spacing.sm }]}>Empty frame.</Text>
        <Text style={[type.bodySoft, { marginTop: spacing.md, maxWidth: 280 }]}>
          The page you were looking for is not here.
        </Text>
        <Link href="/" style={styles.link}>
          <Text style={[type.caption, { color: palette.accent }]}>← Back home</Text>
        </Link>
      </View>
    </>
  );
}

function createStyles(palette: FramePalette) {
  return StyleSheet.create({
    container: { flex: 1, padding: spacing.lg, paddingTop: spacing.xxl, backgroundColor: palette.wall },
    link: { marginTop: spacing.xl },
  });
}
