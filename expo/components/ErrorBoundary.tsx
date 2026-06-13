import { Component, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
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
        <View style={styles.root}>
          <Text style={typography.caption}>Something went wrong</Text>
          <Text style={[typography.body, { marginTop: spacing.md }]}>
            {this.state.error.message}
          </Text>
        </View>
      );
    }
    return <View style={styles.wrapper}>{this.props.children}</View>;
  }
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  root: {
    flex: 1,
    backgroundColor: palette.wall,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
});
