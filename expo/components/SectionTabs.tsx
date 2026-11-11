import { StyleSheet, View } from "react-native";
import Pressable from "@/components/motion/ChoicePressable";
import Text from "@/components/FrameText";
import { radii } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

type Tab<T extends string> = { value: T; label: string; accessibilityLabel?: string };

export default function SectionTabs<T extends string>({ label, tabs, value, onChange }: {
  label: string;
  tabs: readonly Tab<T>[];
  value: T;
  onChange(value: T): void;
}) {
  const { palette, type } = useFrameTheme();
  return <View accessibilityRole="tablist" accessibilityLabel={label} style={[styles.track, { backgroundColor: palette.surfaceDeep }]}>
    {tabs.map((tab) => {
      const selected = value === tab.value;
      return <Pressable key={tab.value} onPress={() => { if (!selected) onChange(tab.value); }}
        accessibilityRole="tab" accessibilityLabel={tab.accessibilityLabel ?? tab.label} accessibilityState={{ selected }}
        style={[styles.tab, selected && { backgroundColor: palette.surfaceHigh, borderColor: palette.borderSoft, borderWidth: 1 }]}>
        <Text style={[type.label, { color: selected ? palette.active : palette.inkMuted }]}>{tab.label}</Text>
      </Pressable>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  track: { minHeight: 48, flexDirection: "row", padding: 3, borderRadius: radii.control, backgroundColor: "transparent" },
  tab: { minHeight: 48, flex: 1, alignItems: "center", justifyContent: "center", borderRadius: radii.small },
});
