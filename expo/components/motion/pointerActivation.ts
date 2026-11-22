import { Platform, type GestureResponderEvent } from "react-native";

/** Keyboard and assistive clicks have no physical pointer. Default to instant. */
export function isPointerActivation(event: GestureResponderEvent): boolean {
  const native = event?.nativeEvent;
  if (!native) return false;
  if (Platform.OS === "web") return Number((native as unknown as MouseEvent).detail) > 0;
  return native.identifier != null || Boolean(native.changedTouches?.length);
}
