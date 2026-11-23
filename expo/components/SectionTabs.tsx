import { useFeedback } from "@/hooks/useFeedback";
import { Platform, Pressable as NativePressable, StyleSheet, View } from "react-native";
import Pressable from "@/components/motion/ChoicePressable";
import Text from "@/components/FrameText";
import { radii } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

import type { ReactNode } from "react";

type Tab<T extends string> = { value: T; label: string; accessibilityLabel?: string; indicator?: ReactNode };

export default function SectionTabs<T extends string>({ label, tabs, value, onChange, disabled = false }: {
  label: string;
  disabled?: boolean;
  tabs: readonly Tab<T>[];
  value: T;
  onChange(value: T): void;
}) {
  const { palette, type } = useFrameTheme();
  const feedback = useFeedback(!disabled);
  const TabButton = Platform.isTV ? NativePressable : Pressable;
  return <View accessibilityRole="tablist" accessibilityLabel={label} style={[styles.track, { backgroundColor: palette.surfaceDeep }]}>
    {tabs.map((tab) => {
      const selected = value === tab.value;
      return <TabButton android_disableSound={Platform.isTV} key={tab.value} disabled={disabled} onPress={() => { if (!disabled && !selected) { onChange(tab.value); feedback.selection(); } }}
        accessibilityRole="tab" accessibilityLabel={tab.accessibilityLabel ?? tab.label} accessibilityState={{ selected, disabled }}
        style={[styles.tab, selected && { backgroundColor: palette.surfaceHigh, borderColor: palette.borderSoft, borderWidth: 1 }, Platform.isTV && selected && { backgroundColor: palette.accentDeep } ]}>
        {tab.indicator}
        <Text style={[type.label, { color: selected ? (Platform.isTV ? palette.onDark : palette.active) : palette.inkMuted }]}>{tab.label}</Text>
      </TabButton>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  track: { minHeight: 48, flexDirection: "row", padding: 3, borderRadius: radii.control, backgroundColor: "transparent" },
  tab: { flexDirection: "row", gap: 6, minHeight: 48, flex: 1, alignItems: "center", justifyContent: "center", borderRadius: radii.small },
});
