import { useCallback, useLayoutEffect, useRef } from "react";
import { Alert } from "react-native";
import { createExitConfirmation } from "@/domain/exitConfirmation";

/** Only user exits are guarded. Authorization loss and profile teardown bypass this hook. */
export function useDiscardChanges(dirty: boolean, scope: string, enabled = true) {
  const gate = useRef(createExitConfirmation()).current;
  useLayoutEffect(() => {
    gate.invalidate();
    return () => gate.invalidate();
  }, [gate, scope, enabled, dirty]);
  return useCallback((proceed: () => void) => {
    if (!enabled) return;
    if (!dirty) { proceed(); return; }
    gate.request((decide) => Alert.alert("Discard changes?", "Your changes haven’t been saved.", [
      { text: "Keep editing", style: "cancel", onPress: () => decide(false) },
      { text: "Discard changes", style: "destructive", onPress: () => decide(true) },
    ], { cancelable: true, onDismiss: () => decide(false) }), proceed);
  }, [dirty, enabled, gate]);
}
