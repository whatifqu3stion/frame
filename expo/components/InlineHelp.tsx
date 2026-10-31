import Text from "@/components/FrameText";
import MotionView from "@/components/motion/MotionView";
import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import DisclosureIndicator from "@/components/motion/DisclosureIndicator";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { spacing } from "@/constants/theme";

/** Tap-accessible secondary guidance; never depends on hover. */
export default function InlineHelp({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { palette, type } = useFrameTheme();
  return <View>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
      <Text style={[type.label, { color: palette.active, flexShrink: 1 }]}>{label}</Text>
      <DisclosureIndicator expanded={open} color={palette.active} />
    </Pressable>
    {open ? <MotionView enter distance={-6} style={{ paddingBottom: spacing.md, gap: spacing.sm }}>{children}</MotionView> : null}
  </View>;
}
