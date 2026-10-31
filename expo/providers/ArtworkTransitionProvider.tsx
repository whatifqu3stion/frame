import { useApp } from "@/providers/AppProvider";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren, type RefObject } from "react";
import { Animated, AppState, Easing, Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { usePathname } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import MediaImage from "@/components/MediaImage";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { artworkTransform, validArtworkRect, type ArtworkRect } from "@/domain/artworkGeometry";
import { motion } from "@/constants/motion";
import { useRoomLighting } from "@/hooks/useRoomLighting";

type Entry = { id: string; uri: string; from: ArtworkRect; origin: string; width: number; height: number; stage?: ArtworkRect; arrived: boolean; source: RefObject<View | null>; ready?: boolean };
type Flight = { uri: string; from: ArtworkRect; to: ArtworkRect; returning: boolean; endOpacity: number };
type Bridge = { roomDarkness: Animated.Value; shared: boolean; openingId: string | null; returningSource: RefObject<View | null> | null; prepare(id: string, uri: string, ref: RefObject<View | null>, navigate: () => void): void; arrive(id: string, ref: RefObject<View | null>, ready: boolean, posterOpacity?: number): void; returnTo(id: string, ref: RefObject<View | null>): void; clear(): void };
const Context = createContext<Bridge>({ roomDarkness: new Animated.Value(1), shared: false, openingId: null, returningSource: null, prepare: (_id, _uri, _ref, go) => go(), arrive: () => {}, returnTo: () => {}, clear: () => {} });
export const useArtworkTransition = () => useContext(Context);

export default function ArtworkTransitionProvider({ children }: PropsWithChildren) {
  const { activeProfileId } = useApp();
  const host = useRef<View>(null);
  const entry = useRef<Entry | null>(null);
  const [shared, setShared] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [flight, setFlight] = useState<Flight | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const path = usePathname();
  // Lighting follows the viewing route, not player readiness or video ID.
  // It never postpones playback, replays between session videos, or dims children.
  const roomDarkness = useRoomLighting(path.startsWith("/watch/"));
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = useCallback(() => { generation.current++; if (timer.current) clearTimeout(timer.current); progress.stopAnimation(); entry.current = null; setShared(false); setOpeningId(null); setFlight(null); }, [progress]);
  const animate = useCallback((uri: string, from: ArtworkRect, to: ArtworkRect, returning: boolean, endOpacity = 1) => {
    const ticket = ++generation.current;
    host.current?.measureInWindow((x, y) => {
      if (ticket !== generation.current) return;
      progress.stopAnimation(); progress.setValue(0);
      setFlight({ uri, from: { ...from, x: from.x - x, y: from.y - y }, to: { ...to, x: to.x - x, y: to.y - y }, returning, endOpacity });
      Animated.timing(progress, { toValue: 1, duration: returning ? motion.artworkReturn : motion.artwork, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== "web", isInteraction: false }).start(({ finished }) => {
        if (!finished || ticket !== generation.current) return;
        setFlight(null); setOpeningId(null);
        if (returning) clear();
      });
    });
  }, [clear, progress]);
  const prepare = useCallback<Bridge["prepare"]>((id, uri, ref, navigate) => {
    clear();
    if (reduced || !uri || !ref.current) { navigate(); return; }
    const ticket = generation.current;
    let navigated = false;
    const go = () => { if (!navigated && ticket === generation.current) { navigated = true; navigate(); } };
    const fallback = setTimeout(go, 80);
    ref.current.measureInWindow((x, y, w, h) => {
      clearTimeout(fallback);
      if (navigated || ticket !== generation.current) return;
      const from = { x, y, width: w, height: h };
      if (validArtworkRect(from) && y < height && y + h > 0) {
        entry.current = { id, uri, from, origin: path, width, height, arrived: false, source: ref };
        setShared(true); setOpeningId(id);
        timer.current = setTimeout(clear, 1800);
      }
      go();
    });
  }, [clear, height, path, reduced, width]);
  const arrive = useCallback<Bridge["arrive"]>((id, ref, ready, posterOpacity = 1) => {
    const selected = entry.current;
    if (!selected || selected.id !== id) return;
    selected.ready = ready;
    if (ready) { generation.current++; progress.stopAnimation(); setOpeningId(null); setFlight(null); }
    ref.current?.measureInWindow((x, y, w, h) => {
      if (entry.current !== selected) return;
      const to = { x, y, width: w, height: h };
      if (!validArtworkRect(to)) return;
      selected.stage = to;
      if (selected.arrived) return;
      selected.arrived = true;
      if (timer.current) clearTimeout(timer.current);
      if (!selected.ready && !reduced) animate(selected.uri, selected.from, to, false, posterOpacity);
    });
  }, [animate, progress, reduced]);
  const returnTo = useCallback<Bridge["returnTo"]>((id, ref) => {
    const selected = entry.current;
    if (!selected || selected.id !== id || selected.source !== ref || selected.origin !== path || !selected.arrived || !selected.stage) return;
    if (reduced || selected.width !== width || selected.height !== height) { clear(); return; }
    ref.current?.measureInWindow((x, y, w, h) => {
      if (entry.current !== selected) return;
      const to = { x, y, width: w, height: h };
      if (!validArtworkRect(to) || y >= height || y + h <= 0) { clear(); return; }
      animate(selected.uri, selected.stage!, to, true);
    });
  }, [animate, clear, height, path, reduced, width]);
  useEffect(() => {
    const item = entry.current;
    if (!item?.arrived) return;
    if (path.startsWith("/watch/") && path !== `/watch/${item.id}`) clear();
    else if (!path.startsWith("/watch/") && path !== item.origin) clear();
    else if (path === item.origin) {
      // The card may have disappeared while watching; never keep a stale handoff.
      const expiry = setTimeout(clear, 700);
      return () => clearTimeout(expiry);
    }
  }, [clear, path]);
  useEffect(() => { clear(); }, [activeProfileId, clear]);
  useEffect(() => { if (reduced) clear(); }, [clear, reduced]);
  useEffect(() => { const sub = AppState.addEventListener("change", state => { if (state !== "active") clear(); }); return () => { sub.remove(); clear(); }; }, [clear]);
  useEffect(() => { const item = entry.current; if (item && (item.width !== width || item.height !== height)) clear(); }, [clear, width, height]);
  const transform = flight ? artworkTransform(flight.from, flight.to) : null;
  return <Context.Provider value={{ roomDarkness, shared, openingId, returningSource: flight?.returning ? entry.current?.source ?? null : null, prepare, arrive, returnTo, clear }}><View ref={host} collapsable={false} style={{ flex: 1 }}>{children}{flight && transform ? <Animated.View testID="artwork-flight" pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: "absolute", left: flight.to.x, top: flight.to.y, width: flight.to.width, height: flight.to.height, opacity: progress.interpolate({ inputRange: [0, 0.72, 1], outputRange: [1, 1, flight.endOpacity] }), transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [transform.x, 0] }) }, { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [transform.y, 0] }) }, { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [transform.scale, 1] }) }] }}><MediaImage source={{ uri: flight.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} cachePolicy="none" /></Animated.View> : null}</View></Context.Provider>;
}

export function useArtworkLink(id: string, uri: string) {
  const ref = useRef<View>(null);
  const { prepare, returnTo, returningSource } = useArtworkTransition();
  const focused = useIsFocused();
  const active = useRef(focused); active.current = focused;
  useEffect(() => () => { active.current = false; }, []);
  useEffect(() => { if (focused) returnTo(id, ref); }, [focused, id, returnTo]);
  return { ref, hidden: returningSource === ref, open: (navigate: () => void) => prepare(id, uri, ref, () => { if (active.current) navigate(); }) };
}

export function ArtworkDestination({ id, ready = false, posterOpacity = 1, children }: PropsWithChildren<{ id: string; ready?: boolean; posterOpacity?: number }>) {
  const ref = useRef<View>(null);
  const { arrive } = useArtworkTransition();
  useEffect(() => { arrive(id, ref, ready, posterOpacity); }, [arrive, id, ready, posterOpacity]);
  return <View ref={ref} collapsable={false} style={{ flex: 1 }} onLayout={() => arrive(id, ref, ready, posterOpacity)}>{children}</View>;
}

/** Only the decorative poster yields to the traveling print; player and controls remain live. */
export function ArtworkPoster({ id, children }: PropsWithChildren<{ id: string }>) {
  const { openingId } = useArtworkTransition();
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: openingId === id ? 0 : 1 }]}>{children}</View>;
}
