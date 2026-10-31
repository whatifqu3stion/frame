import Text from "@/components/FrameText";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { fonts, spacing } from "@/constants/theme";
import { ChevronRight } from "lucide-react-native";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

/** A consistent, wrapping row for settings destinations and labelled actions. */
export default function SettingsRow({ title, summary, onPress, busy = false, disabled = false, destructive = false, navigation = true, leading, testID, accessibilityRole = "button" }: {
  title: string; summary?: string; onPress(): void; busy?: boolean; disabled?: boolean;
  destructive?: boolean; navigation?: boolean; leading?: ReactNode; testID?: string;
  accessibilityRole?: "button" | "link";
}) {
  const { palette, type } = useFrameTheme();
  const unavailable = busy || disabled;
  const color = destructive ? palette.danger : palette.ink;
  return <Pressable onPress={onPress} disabled={unavailable} accessibilityRole={accessibilityRole} accessibilityState={{ busy, disabled: unavailable }} testID={testID} style={({ pressed }) => [styles.row, { borderBottomColor: palette.borderSoft, backgroundColor: pressed ? palette.activeSoft : "transparent" }, disabled && styles.disabled]}>
    {leading ? <View accessible={false}>{leading}</View> : null}
    <View style={styles.copy}>
      <Text style={[type.body, styles.title, { color }]}>{title}</Text>
      {summary ? <Text style={[type.bodySoft, styles.summary]}>{summary}</Text> : null}
    </View>
    {busy ? <ActivityIndicator color={palette.active} /> : navigation ? <ChevronRight size={18} color={palette.inkMuted} /> : null}
  </Pressable>;
}

const styles = StyleSheet.create({
  row: { minHeight: 56, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.sm, marginHorizontal: -spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  copy: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.sansMedium },
  summary: { marginTop: spacing.xs },
  disabled: { opacity: 0.5 },
});
