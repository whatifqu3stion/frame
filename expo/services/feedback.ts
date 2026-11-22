import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { AppState, Platform } from "react-native";
import { createFeedbackGate, type FeedbackKind } from "@/domain/feedback";

const KEY = "frame.device.haptics.v1";
let enabled = false;
let ready = false;
let loading: Promise<void> | undefined;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
export const feedbackGate = createFeedbackGate(
  () => ({ enabled: ready && enabled, active: AppState.currentState === "active", native: Platform.OS === "ios" || Platform.OS === "android" }),
  (kind: FeedbackKind) => {
    const result = Platform.OS === "android"
      ? Haptics.performAndroidHapticsAsync(kind === "selection" ? Haptics.AndroidHaptics.Segment_Tick : kind === "reject" ? Haptics.AndroidHaptics.Reject : Haptics.AndroidHaptics.Confirm)
      : kind === "selection" ? Haptics.selectionAsync()
        : kind === "commit" ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)
          : Haptics.notificationAsync(kind === "reject" ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success);
    void result.catch(() => {});
  },
);
export function loadFeedbackPreference(): Promise<void> {
  loading ??= AsyncStorage.getItem(KEY).then((value) => { enabled = value !== "off"; ready = true; notify(); }).catch(() => { ready = true; notify(); });
  return loading;
}
export function resetFeedbackPreference(): void {
  feedbackGate.invalidate(); enabled = false; ready = false; loading = undefined; notify();
  void loadFeedbackPreference();
}
export const subscribeFeedback = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const feedbackEnabled = () => enabled;
export const feedbackReady = () => ready;
export async function setFeedbackEnabled(value: boolean): Promise<void> {
  // Turning it off suppresses even a pending action immediately.
  const previous = enabled;
  if (!value) { enabled = false; feedbackGate.invalidate(); notify(); }
  try { await AsyncStorage.setItem(KEY, value ? "on" : "off"); enabled = value; ready = true; notify(); }
  catch (error) { enabled = previous; notify(); throw error; }
}
