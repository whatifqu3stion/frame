import Heading from "@/components/Heading";
import { radii, spacing } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

export default function SettingsGroup({ label, children }: { label: string; children: ReactNode }) {
  const { palette, type } = useFrameTheme();
  return <View style={styles.group}>
    <Heading style={[type.caption, styles.label]}>{label}</Heading>
    <View style={[styles.rows, { backgroundColor: palette.surfaceHigh }]}>{children}</View>
  </View>;
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  label: { paddingHorizontal: spacing.sm, fontSize: 13 },
  rows: { borderRadius: radii.card, borderCurve: "continuous", overflow: "hidden" },
});
