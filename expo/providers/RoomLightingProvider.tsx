import { createContext, useCallback, useContext, useState, type PropsWithChildren } from "react";
import type { SharedValue } from "react-native-reanimated";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import { useApp } from "@/providers/AppProvider";
import { usePathname } from "expo-router";
import { useRoomLighting } from "@/hooks/useRoomLighting";

const Context = createContext<SharedValue<number> | null>(null);
export const useRoomDarkness = () => useContext(Context);

const EndContext = createContext<React.Dispatch<React.SetStateAction<string | null>> | null>(null);

/** Only the focused screen owns the end cue. Replay or leaving releases it. */
export function useFinishedRoom(finished: boolean) {
  const setEnding = useContext(EndContext);
  const { key } = useRoute();
  useFocusEffect(useCallback(() => {
    if (!finished || !setEnding) return;
    setEnding(key);
    return () => setEnding(owner => owner === key ? null : owner);
  }, [finished, key, setEnding]));
}

export default function RoomLightingProvider({ children }: PropsWithChildren) {
  const path = usePathname();
  const { prefs } = useApp();
  const [ending, setEnding] = useState<string | null>(null);
  const darkness = useRoomLighting(path.startsWith("/watch/"), ending !== null, prefs.houseLights);
  return <EndContext.Provider value={setEnding}><Context.Provider value={darkness}>{children}</Context.Provider></EndContext.Provider>;
}
