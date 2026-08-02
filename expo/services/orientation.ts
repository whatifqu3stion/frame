import * as ScreenOrientation from "expo-screen-orientation";

type OrientationOwner = "app" | "watch" | "fullscreen";

type OrientationRequest = {
  lock: ScreenOrientation.OrientationLock;
  priority: number;
};

const requests = new Map<OrientationOwner, OrientationRequest>();
let transitionChain: Promise<void> = Promise.resolve();
let transitionVersion = 0;

function effectiveLock(): ScreenOrientation.OrientationLock {
  let selected: OrientationRequest = {
    lock: ScreenOrientation.OrientationLock.PORTRAIT_UP,
    priority: 0,
  };
  for (const request of requests.values()) {
    if (request.priority > selected.priority) selected = request;
  }
  return selected.lock;
}

function scheduleTransition(): Promise<void> {
  const version = ++transitionVersion;
  const lock = effectiveLock();
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
  const priority = owner === "fullscreen" ? 2 : owner === "watch" ? 1 : 0;
  requests.set(owner, { lock, priority });
  return scheduleTransition();
}

/** Removes an orientation request and applies the highest-priority remaining policy. */
export function clearOrientationRequest(owner: OrientationOwner): Promise<void> {
  requests.delete(owner);
  return scheduleTransition();
}
