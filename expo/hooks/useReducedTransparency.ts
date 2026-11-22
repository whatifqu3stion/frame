import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

export function useReducedTransparency() {
  const [reduceTransparency, setReduceTransparency] = useState(Platform.OS === "ios");
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let mounted = true;
    let observed = false;
    const subscription = AccessibilityInfo.addEventListener("reduceTransparencyChanged", (value) => {
      observed = true;
      setReduceTransparency(value);
    });
    void AccessibilityInfo.isReduceTransparencyEnabled().then((value) => {
      if (mounted && !observed) setReduceTransparency(value);
    }).catch(() => {});
    return () => { mounted = false; subscription.remove(); };
  }, []);

  return reduceTransparency;
}
