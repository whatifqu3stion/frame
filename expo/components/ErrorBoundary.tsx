import RecoveryScreen from "@/components/RecoveryScreen";
import { Component, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

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
      return <RecoveryScreen title="Frame couldn’t open this screen" message="Try again. If this continues, close and reopen Frame." onRetry={() => this.setState({ error: null })} />;
    }
    return <View style={styles.wrapper}>{this.props.children}</View>;
  }
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
});

