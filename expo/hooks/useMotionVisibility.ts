import { useIsFocused } from "@react-navigation/native";
import { useSyncExternalStore } from "react";
import { AppState } from "react-native";

const subscribe = (notify: () => void) => {
  const subscription = AppState.addEventListener("change", notify);
  return () => subscription.remove();
};
const foreground = () => AppState.currentState === "active";
/** A focused route in the foreground owns custom motion. */
export function useMotionVisibility(): boolean {
  const focused = useIsFocused();
  const active = useSyncExternalStore(subscribe, foreground, () => false);
  return focused && active;
}
