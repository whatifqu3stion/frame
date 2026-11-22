import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { feedbackGate, feedbackEnabled, feedbackReady, loadFeedbackPreference, subscribeFeedback } from "@/services/feedback";
import type { FeedbackKind } from "@/domain/feedback";

/** Capture before async work; call only for a confirmed, changed result. */
export function useFeedback(enabled = true) {
  const alive = useRef(true);
  const allowed = useRef(enabled);
  const scope = useRef(0);
  useLayoutEffect(() => { scope.current += 1; }, [enabled]);
  allowed.current = enabled;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const capture = useCallback(() => {
    const complete = feedbackGate.capture();
    const capturedScope = scope.current;
    return (kind: FeedbackKind, changed = true) => { if (alive.current && allowed.current && scope.current === capturedScope) complete(kind, changed); };
  }, []);
  return useMemo(() => ({ capture, selection: () => capture()("selection") }), [capture]);
}
export function useFeedbackPreference() {
  const enabled = useSyncExternalStore(subscribeFeedback, feedbackEnabled, () => false);
  const ready = useSyncExternalStore(subscribeFeedback, feedbackReady, () => false);
  useEffect(() => { void loadFeedbackPreference(); }, []);
  return { enabled, ready };
}
