import { StyleSheet, Text, View } from "react-native";
import { palette, spacing, type } from "@/constants/theme";

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
};

export default function ScreenHeader({ eyebrow, title, subtitle }: Props) {
  return (
    <View style={styles.root}>
      {eyebrow ? <Text style={[type.caption, { color: palette.accent }]}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    paddingRight: spacing.xxl,
  },
  title: {
    ...type.display,
    marginTop: spacing.sm,
  },
  subtitle: {
    ...type.bodySoft,
    marginTop: spacing.md,
    maxWidth: 320,
  },
});
