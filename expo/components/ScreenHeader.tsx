import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

type Props = { eyebrow?: string; title: string; subtitle?: string };

export default function ScreenHeader({ eyebrow, title, subtitle }: Props) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  return (
    <View style={styles.root}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    root: { paddingTop: spacing.xl, paddingBottom: spacing.lg, paddingRight: spacing.xxl },
    eyebrow: { ...type.caption, color: palette.accent },
    title: { ...type.display, marginTop: spacing.sm },
    subtitle: { ...type.bodySoft, marginTop: spacing.md, maxWidth: 320 },
  });
}
