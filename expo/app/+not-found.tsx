import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { palette, spacing, type } from "@/constants/theme";

export default function NotFoundScreen() {
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

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, paddingTop: spacing.xxl, backgroundColor: palette.wall },
  link: { marginTop: spacing.xl },
});
