import { Circle } from "lucide-react-native";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

type Props = { symbol?: string; title: string; body?: string };

export default function EmptyState({ symbol, title, body }: Props) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  return (
    <View style={styles.root}>
      <View style={styles.symbolWrap}>
        {symbol ? <Text style={styles.symbol}>{symbol}</Text> : <Circle size={22} color={palette.accent} strokeWidth={1.3} />}
      </View>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    root: { marginVertical: spacing.md, paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, alignItems: "flex-start", backgroundColor: palette.surface, borderRadius: radii.card, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.borderSoft },
    symbolWrap: { width: 48, height: 48, borderRadius: radii.card, alignItems: "center", justifyContent: "center", backgroundColor: palette.surfaceDeep, marginBottom: spacing.lg },
    symbol: { fontSize: 24, color: palette.accent },
    title: { ...type.heading, fontSize: 22, marginBottom: spacing.sm },
    body: { ...type.bodySoft, maxWidth: 290 },
  });
}
