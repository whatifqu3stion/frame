import PrimaryAction from "@/components/PrimaryAction";
import Text from "@/components/FrameText";
import { ActivityIndicator, ScrollView, StyleSheet, useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";
import { createPalette, createType, radii, spacing } from "@/constants/theme";
import { recoveryAppearance } from "@/services/recoveryAppearance";

/** Deliberately independent of AppProvider and its storage, navigation and animation dependencies. */
export default function RecoveryScreen({ loading = false, title, message, onRetry }: {
  loading?: boolean; title: string; message?: string; onRetry?(): void;
}) {
  const appearance = recoveryAppearance(useColorScheme() === "dark");
  const dark = appearance.theme === "ink";
  const palette = createPalette(dark, appearance.accent);
  const type = createType(palette);
  return <ScrollView style={{ flex: 1, backgroundColor: palette.wall }} contentContainerStyle={styles.content}>
    <StatusBar style={dark ? "light" : "dark"} />
    {loading ? <ActivityIndicator color={palette.active} accessibilityLabel={title} /> : null}
    <Text accessibilityRole="header" style={[type.heading, styles.copy]}>{title}</Text>
    {message ? <Text style={[type.bodySoft, styles.copy]}>{message}</Text> : null}
    {onRetry && !loading ? <PrimaryAction depth={palette.primaryButtonDepth} accessibilityRole="button" onPress={onRetry} testID="recovery-retry" style={[styles.retry, { backgroundColor: palette.accentDeep }]}><Text style={[type.label, { color: palette.onDark, textAlign: "center" }]}>Try again</Text></PrimaryAction> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: "center", alignItems: "center", gap: spacing.lg, paddingHorizontal: spacing.xl, paddingVertical: 64 },
  copy: { width: "100%", maxWidth: 480, textAlign: "center" },
  retry: { minHeight: 48, maxWidth: 480, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, justifyContent: "center", borderRadius: radii.control },
});
