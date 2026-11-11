import { useCallback, useLayoutEffect, useRef } from "react";
import { confirmUser } from "@/services/notifyUser";
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
    gate.request((decide) => confirmUser("Discard changes?", "Your changes haven’t been saved.", "Discard changes", decide, true), proceed);
  }, [dirty, enabled, gate]);
}
