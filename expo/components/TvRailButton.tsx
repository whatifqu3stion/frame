import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { PlatformPressable } from "@react-navigation/elements";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import type { LucideIcon } from "lucide-react-native";
import Text from "@/components/FrameText";
import { fonts } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

type Props = BottomTabBarButtonProps & { title: string; icon: LucideIcon };

export default function TvRailButton({ title, icon: Icon, style, ...button }: Props) {
  const { palette } = useFrameTheme();
  const [hasFocus, setHasFocus] = useState(false);
  const selected = button["aria-selected"];
  const color = hasFocus ? palette.onAccent : selected ? palette.active : palette.inkSoft;
  return (
    <PlatformPressable
      {...button}
      android_disableSound
      nativeID={`frame-tv-rail-${title}`}
      onFocus={() => setHasFocus(true)}
      onBlur={() => setHasFocus(false)}
      android_ripple={{ borderless: false, color: palette.activeSoft }}
      style={[style, styles.row, { backgroundColor: hasFocus ? palette.active : "transparent" }]}
    >
      <Icon size={18} strokeWidth={2} color={color} />
      <Text style={[styles.label, { color }]}>{title}</Text>
      {selected && <View accessible={false} style={[styles.dot, { backgroundColor: color }]} />}
    </PlatformPressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 44, borderRadius: 10, alignItems: "center", flexDirection: "row", paddingHorizontal: 10, gap: 8 },
  label: { fontFamily: fonts.sansSemibold, fontSize: 18, lineHeight: 24, flex: 1 },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
