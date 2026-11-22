/** Serialize a screen's actions and ignore completions from an obsolete screen. */
export function createActionGate() {
  let generation = 0;
  let enabled = false;
  let pending = false;
  return {
    reset(active: boolean) { generation += 1; enabled = active; pending = false; },
    capture() {
      const captured = generation;
      return () => enabled && captured === generation;
    },
    begin() {
      if (!enabled || pending) return null;
      pending = true;
      const captured = generation;
      let finished = false;
      const isCurrent = () => !finished && enabled && captured === generation;
      return {
        isCurrent,
        finish() { if (isCurrent()) pending = false; finished = true; },
      };
    },
  };
}
