import * as ScreenOrientation from "expo-screen-orientation";

import { resolveOrientationLock, type OrientationOwner } from "@/domain/orientationPolicy";

const requests = new Map<OrientationOwner, ScreenOrientation.OrientationLock>();
let transitionChain: Promise<void> = Promise.resolve();
let transitionVersion = 0;

function scheduleTransition(): Promise<void> {
  const version = ++transitionVersion;
  const lock = resolveOrientationLock(requests, ScreenOrientation.OrientationLock.DEFAULT);
  transitionChain = transitionChain
    .catch(() => {})
    .then(async (): Promise<void> => {
      if (version !== transitionVersion) return;
      try {
        const supported = await ScreenOrientation.supportsOrientationLockAsync(lock);
        if (!supported || version !== transitionVersion) return;
        await ScreenOrientation.lockAsync(lock);
      } catch {
        // Browsers and device policies may reject orientation locking. The layout
        // still responds to the physical window dimensions in that case.
      }
    });
  return transitionChain;
}

/** Sets an orientation request. Higher-priority fullscreen and watch requests override the app default. */
export function setOrientationRequest(
  owner: OrientationOwner,
  lock: ScreenOrientation.OrientationLock,
): Promise<void> {
  requests.set(owner, lock);
  return scheduleTransition();
}

/** Removes an orientation request and applies the highest-priority remaining policy. */
export function clearOrientationRequest(owner: OrientationOwner): Promise<void> {
  requests.delete(owner);
  return scheduleTransition();
}
