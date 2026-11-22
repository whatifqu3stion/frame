import { Platform } from "react-native";

const KEY = "frame.visual-preview.v1";
export const CAN_PREVIEW_LIBRARY = Platform.OS === "web" && typeof __DEV__ !== "undefined" && __DEV__;
export const PREVIEW_LIBRARY_ENABLED = (() => {
  if (!CAN_PREVIEW_LIBRARY || typeof window === "undefined") return false;
  try { return window.sessionStorage.getItem(KEY) === "on"; } catch { return false; }
})();

export function setPreviewLibrary(enabled: boolean): void {
  if (!CAN_PREVIEW_LIBRARY || typeof window === "undefined") return;
  if (enabled) window.sessionStorage.setItem(KEY, "on");
  else window.sessionStorage.removeItem(KEY);
  window.location.assign("/sources");
}
