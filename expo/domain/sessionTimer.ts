export type SessionRun = { runId: number; consumedSeconds: number; ended: boolean; finishVideoId: string | null; lastVideoId: string | null };
export const emptySessionRun = (): SessionRun => ({ runId: 0, consumedSeconds: 0, ended: false, finishVideoId: null, lastVideoId: null });

/** Monotonic elapsed playback: seeking, video duration and pauses never change usage. */
export function createSessionClock(initial: SessionRun, now: () => number) {
  let value = { ...initial };
  let started: number | null = null;
  const checkpoint = () => {
    if (started !== null) {
      const current = now();
      value.consumedSeconds += Math.max(0, current - started) / 1000;
      started = current;
    }
    return { ...value };
  };
  return {
    snapshot: checkpoint,
    playing(on: boolean, videoId?: string) { checkpoint(); if (on && videoId) value.lastVideoId = videoId; started = on && !value.ended ? now() : null; return { ...value }; },
    finish(videoId: string) { checkpoint(); if (!value.ended && !value.finishVideoId && value.lastVideoId === videoId) value.finishVideoId = videoId; return { ...value }; },
    end() { checkpoint(); started = null; value.ended = true; value.finishVideoId = null; return { ...value }; },
  };
}

export function sessionTimeRemaining(run: SessionRun, minutes: number): number {
  return Math.max(0, minutes * 60 - run.consumedSeconds);
}

export function sessionAllowsVideo(run: SessionRun, minutes: number, videoId: string): boolean {
  return !run.ended && (sessionTimeRemaining(run, minutes) > 0 || run.finishVideoId === videoId);
}

export function sessionCanFinish(run: SessionRun, minutes: number, videoId: string): boolean {
  return !run.ended && sessionTimeRemaining(run, minutes) === 0 && run.lastVideoId === videoId && !run.finishVideoId;
}
