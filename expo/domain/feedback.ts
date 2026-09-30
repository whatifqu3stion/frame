export type FeedbackKind = "selection" | "commit" | "milestone" | "reject";
type Environment = { enabled: boolean; active: boolean; native: boolean };

/** Each completion belongs to one foreground/navigation generation and can fire once. */
export function createFeedbackGate(environment: () => Environment, play: (kind: FeedbackKind) => void, now = Date.now) {
  let generation = 0;
  let lastPlayed = -Infinity;
  return {
    invalidate() { generation += 1; },
    capture() {
      const captured = generation;
      const started = now();
      let consumed = false;
      return (kind: FeedbackKind, changed = true) => {
        if (consumed) return;
        consumed = true;
        const state = environment();
        if (!changed || captured !== generation || !state.enabled || !state.active || !state.native || now() - started > 10_000 || now() - lastPlayed < 90) return;
        lastPlayed = now();
        try { play(kind); } catch { /* Feedback can never fail a product action. */ }
      };
    },
  };
}
