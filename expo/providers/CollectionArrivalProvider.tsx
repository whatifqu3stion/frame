import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { useApp } from "@/providers/AppProvider";
import { useMotionVisibility } from "@/hooks/useMotionVisibility";
import MotionView from "@/components/motion/MotionView";

type Kind = "video" | "session";
type Arrival = { video: string | null; session: string | null };
const Context = createContext<{ pending: Arrival; consume(kind: Kind, id: string): void }>({ pending: { video: null, session: null }, consume: () => {} });
/** Observe persisted collection changes, not filtered results or a loading placeholder. */
export default function CollectionArrivalProvider({ children }: PropsWithChildren) {
  const { ready, activeProfileId, libraryLoading, libraryError, savedVideos, sessions } = useApp();
  const before = useRef<{ profile: string; videos: number; sessions: number } | null>(null);
  const [pending, setPending] = useState<Arrival>({ video: null, session: null });
  useEffect(() => {
    if (!ready || libraryLoading || libraryError) return;
    const old = before.current;
    if (!old || old.profile !== activeProfileId) setPending({ video: null, session: null });
    else setPending(p => ({ video: old.videos === 0 && savedVideos.length > 0 ? savedVideos[0].id : savedVideos.some(video => video.id === p.video) ? p.video : null, session: old.sessions === 0 && sessions.length > 0 ? sessions[0].id : sessions.some(session => session.id === p.session) ? p.session : null }));
    before.current = { profile: activeProfileId, videos: savedVideos.length, sessions: sessions.length };
  }, [ready, activeProfileId, libraryError, libraryLoading, savedVideos, sessions]);
  const consume = useCallback((kind: Kind, id: string) => setPending(p => p[kind] === id ? { ...p, [kind]: null } : p), []);
  return <Context.Provider value={{ pending, consume }}>{children}</Context.Provider>;
}
export function CollectionArrival({ kind, id, children }: PropsWithChildren<{ kind: Kind; id: string }>) {
  const { pending, consume } = useContext(Context);
  const visible = useMotionVisibility();
  const [reveal, setReveal] = useState(0);
  useEffect(() => { if (visible && pending[kind] === id) { setReveal(n => n + 1); consume(kind, id); } }, [consume, id, kind, pending, visible]);
  return <MotionView changeKey={reveal} duration={620} distance={24} fromScale={0.96}>{children}</MotionView>;
}
