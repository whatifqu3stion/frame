import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { progressRecovery } from "@/services/progressRecoveryInstance";
import { readSessionRun, saveSessionRun } from "@/db/database";
import { createSessionClock, emptySessionRun, sessionAllowsVideo, sessionCanFinish, sessionTimeRemaining, sessionDisplayChanged, type SessionRun } from "@/domain/sessionTimer";

export function useSessionTimer(profileId: string, sessionId: string | undefined, minutes: number | null, videoId: string, playing: boolean, onStop: () => void) {
  const identity = `${profileId}:${sessionId ?? ""}`;
  const [state, setState] = useState<{ identity: string; run: SessionRun; ready: boolean; error: boolean; retrying: boolean }>({ identity, run: emptySessionRun(), ready: !sessionId, error: false, retrying: false });
  const clock = useRef<ReturnType<typeof createSessionClock> | null>(null);
  const stop = useRef(onStop); stop.current = onStop;
  const published = useRef(state.run); published.current = state.run;
  const writer = useMemo(() => sessionId ? progressRecovery.getWriter(profileId, sessionId, "session") : null, [profileId, sessionId]);
  const reload = useRef<() => Promise<void>>(async () => {});
  const persist = useRef<(run: SessionRun) => Promise<void>>(async () => {});
  useEffect(() => {
    let alive = true;
    clock.current = null;
    setState({ identity, run: emptySessionRun(), ready: !sessionId, error: false, retrying: false });
    if (!sessionId || !writer) return;
    const release = writer.retain();
    const write = async (run: SessionRun) => {
      // Capture the run, including runId. The database rejects checkpoints from a reset run.
      const checkpoint = { ...run };
      await writer.write(() => saveSessionRun(profileId, sessionId, checkpoint));
      try { await writer.flush(); }
      catch (error) {
        if (alive) { setState(s => ({ ...s, error: true })); stop.current(); }
        throw error;
      }
    };
    persist.current = write;
    let loading = false;
    const load = async (retry = false) => {
      if (!alive || loading) return;
      loading = true;
      if (retry) setState(s => ({ ...s, retrying: true }));
      try {
        if (retry) await writer.retry();
        // Never reload an older timer while a departed route's checkpoint is pending/failed.
        await writer.flush();
        const run = await readSessionRun(profileId, sessionId);
        if (!alive) return;
        clock.current = createSessionClock(run, () => performance.now());
        setState({ identity, run, ready: true, error: false, retrying: false });
      } catch {
        if (alive) setState(s => ({ ...s, identity, ready: true, error: true, retrying: false }));
      } finally { loading = false; }
    };
    reload.current = () => load(true);
    void load();
    return () => {
      alive = false;
      if (clock.current) void write(clock.current.playing(false)).catch(() => {});
      clock.current = null;
      release();
    };
  }, [identity, profileId, sessionId, writer]);
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
      if (sessionDisplayChanged(published.current, next, minutes)) {
        published.current = next;
        setState((s) => ({ ...s, run: next }));
      }
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
  const retry = useCallback(() => reload.current(), []);
  return { ready, allowed, retry, retrying: state.identity === identity && state.retrying, canFinish: minutes !== null && !state.error && sessionCanFinish(run, minutes, videoId), run, error: state.error, finish, end, remaining: minutes ? sessionTimeRemaining(run, minutes) : null };
}
