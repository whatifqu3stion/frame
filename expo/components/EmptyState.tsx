import { StyleSheet, Text, View } from "react-native";
import { palette, spacing, type } from "@/constants/theme";

type Props = {
  symbol?: string;
  title: string;
  body?: string;
};

export default function EmptyState({ symbol = "◯", title, body }: Props) {
  return (
    <View style={styles.root}>
      <Text style={styles.symbol}>{symbol}</Text>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.md,
    alignItems: "flex-start",
  },
  symbol: {
    fontSize: 32,
    color: palette.accent,
    marginBottom: spacing.lg,
  },
  title: { ...type.heading, fontSize: 22, marginBottom: spacing.sm },
  body: { ...type.bodySoft, maxWidth: 280 },
});
