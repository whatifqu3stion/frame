import { useCallback, useEffect, useRef, useState } from "react";
import { readSessionRun, saveSessionRun } from "@/db/database";
import { createSessionClock, emptySessionRun, sessionAllowsVideo, sessionCanFinish, sessionTimeRemaining, type SessionRun } from "@/domain/sessionTimer";

export function useSessionTimer(profileId: string, sessionId: string | undefined, minutes: number | null, videoId: string, playing: boolean, onStop: () => void) {
  const identity = `${profileId}:${sessionId ?? ""}`;
  const [state, setState] = useState<{ identity: string; run: SessionRun; ready: boolean; error: boolean }>({ identity, run: emptySessionRun(), ready: !sessionId, error: false });
  const clock = useRef<ReturnType<typeof createSessionClock> | null>(null);
  const stop = useRef(onStop); stop.current = onStop;
  const writes = useRef(Promise.resolve());
  const persist = useRef<(run: SessionRun) => Promise<void>>(async () => {});
  useEffect(() => {
    let alive = true;
    clock.current = null;
    setState({ identity, run: emptySessionRun(), ready: !sessionId, error: false });
    if (!sessionId) return;
    const write = (run: SessionRun) => {
      const next = writes.current.then(() => saveSessionRun(profileId, sessionId, run));
      writes.current = next.catch(() => { if (alive) { setState((s) => ({ ...s, error: true })); stop.current(); } });
      return next;
    };
    persist.current = write;
    void writes.current.then(() => readSessionRun(profileId, sessionId)).then((run) => {
      if (!alive) return;
      clock.current = createSessionClock(run, () => performance.now());
      setState({ identity, run, ready: true, error: false });
    }).catch(() => { if (alive) setState({ identity, run: emptySessionRun(), ready: true, error: true }); });
    return () => {
      alive = false;
      if (clock.current) void write(clock.current.playing(false)).catch(() => {});
      clock.current = null;
    };
  }, [identity, profileId, sessionId]);
  const ready = !sessionId || (state.identity === identity && state.ready);
  const run = state.identity === identity ? state.run : emptySessionRun();
  const allowed = !sessionId || (ready && !state.error && minutes !== null && sessionAllowsVideo(run, minutes, videoId));
  useEffect(() => {
    const timer = clock.current;
    if (!sessionId || !timer || !ready) return;
    timer.playing(playing && allowed, videoId);
    let checkpoints = 0;
    const tick = () => {
      let next = timer.snapshot();
      if (minutes !== null && !sessionAllowsVideo(next, minutes, videoId)) {
        next = timer.playing(false);
        stop.current();
        void persist.current(next).catch(() => {});
      } else if (++checkpoints % 20 === 0) void persist.current(next).catch(() => {});
      setState((s) => ({ ...s, run: next }));
    };
    const interval = playing && allowed ? setInterval(tick, 250) : undefined;
    return () => {
      if (interval) clearInterval(interval);
      const next = timer.playing(false);
      void persist.current(next).catch(() => {});
    };
  }, [allowed, minutes, playing, ready, sessionId, videoId]);
  const finish = useCallback(async () => {
    if (!clock.current || !minutes || state.error || !sessionCanFinish(clock.current.snapshot(), minutes, videoId)) return false;
    const next = clock.current.finish(videoId);
    await persist.current(next);
    setState((s) => ({ ...s, run: next }));
    return true;
  }, [minutes, state.error, videoId]);
  const end = useCallback(async () => {
    if (!clock.current) return;
    const next = clock.current.end();
    await persist.current(next);
    setState((s) => ({ ...s, run: next }));
  }, []);
  return { ready, allowed, canFinish: minutes !== null && !state.error && sessionCanFinish(run, minutes, videoId), run, error: state.error, finish, end, remaining: minutes ? sessionTimeRemaining(run, minutes) : null };
}
