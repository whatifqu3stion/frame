/** One outstanding decision; stale alerts cannot navigate a new editor or profile. */
export function createExitConfirmation() {
  let generation = 0;
  let pending = false;
  return {
    invalidate() { generation += 1; pending = false; },
    request(present: (decide: (discard: boolean) => void) => void, proceed: () => void) {
      if (pending) return;
      pending = true;
      const captured = generation;
      present((discard) => {
        if (!pending || captured !== generation) return;
        pending = false;
        generation += 1;
        if (discard) proceed();
      });
    },
  };
}
