import { createContext, useContext, type PropsWithChildren } from "react";
import type { SharedValue } from "react-native-reanimated";
import { usePathname } from "expo-router";
import { useRoomLighting } from "@/hooks/useRoomLighting";

const Context = createContext<SharedValue<number> | null>(null);
export const useRoomDarkness = () => useContext(Context);

export default function RoomLightingProvider({ children }: PropsWithChildren) {
  const path = usePathname();
  const darkness = useRoomLighting(path.startsWith("/watch/"));
  return <Context.Provider value={darkness}>{children}</Context.Provider>;
}
