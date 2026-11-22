import { useIsFocused } from "@react-navigation/native";
import { usePathname } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

/** Only the card that opened playback responds on return; tab switching does not replay it. */
export function useArtworkReturn() {
  const focused = useIsFocused();
  const path = usePathname();
  const armed = useRef(false);
  const departed = useRef(false);
  const [returnKey, setReturnKey] = useState(0);
  useEffect(() => {
    if (!focused && armed.current && path.startsWith("/watch/")) {
      departed.current = true;
      armed.current = false;
    }
    if (focused && departed.current) { departed.current = false; setReturnKey((value) => value + 1); }
  }, [focused, path]);
  const openArtwork = useCallback(() => { armed.current = true; }, []);
  return { returnKey, openArtwork };
}
