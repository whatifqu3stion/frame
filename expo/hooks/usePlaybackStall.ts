import { useLayoutEffect, useRef } from "react";

export const PLAYBACK_STALL_TIMEOUT_MS = 20_000;

/** One recovery per continuous buffering spell, only while the player is visible and permitted. */
export function usePlaybackStall(watching: boolean, attempt: number, onStall: () => void) {
  const recover = useRef(onStall);
  useLayoutEffect(() => { recover.current = onStall; }, [onStall]);
  useLayoutEffect(() => {
    if (!watching) return;
    let current = true;
    const timer = setTimeout(() => { if (current) recover.current(); }, PLAYBACK_STALL_TIMEOUT_MS);
    return () => { current = false; clearTimeout(timer); };
  }, [watching, attempt]);
}
