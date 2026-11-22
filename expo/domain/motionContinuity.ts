type PresentationKey = string | number | boolean | undefined;

/** Permit an authored first reveal to defer; never replay hidden outcome changes. */
export function createPresentationGate(initialKey: PresentationKey, enter: boolean, deferEntrance = false) {
  let previous = initialKey;
  let pendingEntrance = enter;
  return {
    update(key: PresentationKey, visible: boolean): boolean {
      const changed = previous !== key;
      previous = key;
      if (!visible) { if (!deferEntrance) pendingEntrance = false; return false; }
      const present = pendingEntrance || changed;
      pendingEntrance = false;
      return present;
    },
  };
}

/** Retarget from the row's current visual position, including an interrupted movement. */
export function continuingRowOffset(previousY: number, nextY: number, currentOffset: number): number {
  return [previousY, nextY, currentOffset].every(Number.isFinite) ? previousY + currentOffset - nextY : 0;
}
