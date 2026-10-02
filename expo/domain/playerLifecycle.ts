export type PlayerConditions = {
  resumeReady: boolean;
  contentAllowed: boolean;
  allowanceAllowed: boolean;
  focused: boolean;
  active: boolean;
  ended: boolean;
  failed: boolean;
  ready: boolean;
};

/** A load timeout belongs only to a player that is allowed to mount. */
export function playerLifecycle(state: PlayerConditions) {
  const permitted = state.contentAllowed && state.allowanceAllowed;
  const mount = permitted && state.resumeReady && state.focused && state.active && !state.ended && !state.failed;
  return { permitted, mount, loading: mount && !state.ready };
}

/** Cancels departed attempts and consumes an explicit replay request once. */
export function createPlayerAttempt() {
  let generation = 0;
  let replay = false;
  return {
    cancel() { replay = false; return ++generation; },
    restart() { replay = true; return ++generation; },
    isCurrent(ticket: number) { return ticket === generation; },
    consumeReplay(ticket: number) {
      if (ticket !== generation || !replay) return false;
      replay = false;
      return true;
    },
  };
}
