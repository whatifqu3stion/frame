import { useEffect } from "react";
import { useIsFocused } from "@react-navigation/native";
import { BackHandler } from "react-native";

export function useOnboardingBack(replay: boolean, step: number, busy: () => boolean, previous: () => void, hasReturnTarget = false) {
  const focused = useIsFocused();
  useEffect(() => {
    // A key-setup screen above onboarding must own Android Back.
    if (!focused) return;
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (busy()) return true;
      if (step > 0 || hasReturnTarget) { previous(); return true; }
      if (!replay) { BackHandler.exitApp(); return true; }
      return false;
    });
    return () => handler.remove();
  }, [focused, replay, step, busy, previous, hasReturnTarget]);
}
