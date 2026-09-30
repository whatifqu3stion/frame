import { useSyncExternalStore } from "react";
import { AccessibilityInfo } from "react-native";

let reduced = true;
const listeners = new Set<() => void>();
let subscription: ReturnType<typeof AccessibilityInfo.addEventListener> | undefined;
let generation = 0;
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!subscription) {
    const request = ++generation;
    const update = (value: boolean) => { reduced = value; listeners.forEach((notify) => notify()); };
    let observed = false;
    subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => { observed = true; update(value); });
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (!observed && request === generation) update(value); }).catch(() => {});
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) { subscription?.remove(); subscription = undefined; generation += 1; reduced = true; }
  };
}
/** One conservative OS preference subscription shared by all animated surfaces. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => reduced, () => true);
}
