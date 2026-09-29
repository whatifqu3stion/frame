import { Circle } from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { radii, spacing, type FramePalette, type FrameType } from "@/constants/theme";
import { useFrameTheme } from "@/constants/useFrameTheme";

type Props = { symbol?: string; compact?: boolean; title: string; body?: string; action?: { label: string; onPress: () => void } };

export default function EmptyState({ symbol, title, body, action, compact = false }: Props) {
  const { palette, type } = useFrameTheme();
  const styles = useMemo(() => createStyles(palette, type), [palette, type]);
  return (
    <View style={[styles.root, compact && { backgroundColor: "transparent", borderWidth: 0, paddingHorizontal: 0, paddingVertical: spacing.md }]}>
      {!compact ? <View style={styles.symbolWrap}>
        {symbol ? <Text style={styles.symbol}>{symbol}</Text> : <Circle size={22} color={palette.accent} strokeWidth={1.3} />}
      </View> : null}
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {action ? <Pressable accessibilityRole="button" onPress={action.onPress} style={styles.action}><Text style={[type.label, { color: palette.active }]}>{action.label}</Text></Pressable> : null}
    </View>
  );
}

function createStyles(palette: FramePalette, type: FrameType) {
  return StyleSheet.create({
    root: { marginVertical: spacing.md, paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, alignItems: "flex-start", backgroundColor: palette.surface, borderRadius: radii.card, borderWidth: 1, borderColor: palette.borderSoft },
    symbolWrap: { height: 32, alignItems: "flex-start", justifyContent: "center", marginBottom: spacing.md },
    symbol: { fontSize: 24, color: palette.accent },
    title: { ...type.heading, fontSize: 22, marginBottom: spacing.sm },
    action: { minHeight: 48, justifyContent: "center", marginTop: spacing.sm },
    body: { ...type.bodySoft, maxWidth: 290 },
  });
}

