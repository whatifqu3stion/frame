import { useIsFocused } from "@react-navigation/native";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { createActionGate } from "@/domain/actionGate";

/** Writes can finish, but a departed screen must not navigate or present alerts. */
export function useScreenAction(scope: string) {
  const focused = useIsFocused();
  const gate = useRef(createActionGate()).current;
  const [busy, setBusy] = useState(false);
  useLayoutEffect(() => {
    gate.reset(focused);
    setBusy(false);
    return () => gate.reset(false);
  }, [focused, gate, scope]);
  const run = useCallback(async <T,>(action: () => Promise<T>, onSuccess: (value: T) => void, onError: () => void): Promise<void> => {
    const ticket = gate.begin();
    if (!ticket) return;
    setBusy(true);
    try {
      const value = await action();
      if (ticket.isCurrent()) onSuccess(value);
    } catch {
      if (ticket.isCurrent()) onError();
    } finally {
      if (ticket.isCurrent()) setBusy(false);
      ticket.finish();
    }
  }, [gate]);
  return { busy, run, capture: gate.capture };
}
