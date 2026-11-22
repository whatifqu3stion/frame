import { Alert, Platform } from "react-native";

export function notifyUser(title: string, message: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

/** Use an explicit decision on both platforms, including cancellation by dismissal. */
export function confirmUser(title: string, message: string, action: string, decide: (accepted: boolean) => void, destructive = false) {
  if (Platform.OS === "web") {
    decide(typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`));
    return;
  }
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel", onPress: () => decide(false) },
    { text: action, style: destructive ? "destructive" : "default", onPress: () => decide(true) },
  ], { cancelable: true, onDismiss: () => decide(false) });
}
