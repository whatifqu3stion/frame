import { Component, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { palette, spacing, type as typography } from "@/constants/theme";

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error) {
    console.warn("[ErrorBoundary]", error.message);
  }

  override render() {
    if (this.state.error) {
      return (
        <ScrollView style={{ flex: 1, backgroundColor: palette.wall }} contentContainerStyle={styles.root}>
          <Text style={typography.heading} accessibilityRole="header">Frame couldn’t open this screen</Text>
          <Text style={[typography.body, { marginTop: spacing.md }]}>
            Frame couldn’t show this screen. Try again. If this keeps happening, close and reopen Frame.
          </Text>
          <Pressable onPress={() => this.setState({ error: null })} style={styles.retry} accessibilityRole="button"><Text style={[typography.label, { color: palette.onDark }]}>Try again</Text></Pressable>
        </ScrollView>
      );
    }
    return <View style={styles.wrapper}>{this.props.children}</View>;
  }
}

const styles = StyleSheet.create({
  retry: { minHeight: 48, paddingHorizontal: spacing.lg, alignItems: "center", justifyContent: "center", backgroundColor: palette.accentDeep, borderRadius: 10, marginTop: spacing.lg },
  wrapper: {
    flex: 1,
  },
  root: {
    flexGrow: 1,
    backgroundColor: palette.wall,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    paddingVertical: spacing.xxxl,
  },
});

