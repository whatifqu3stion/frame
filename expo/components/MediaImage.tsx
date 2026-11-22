import { Image, type ImageProps } from "expo-image";
import { ImageOff } from "lucide-react-native";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/** Keep the image's geometry when a URL is missing or fails; never refetch on error. */
export default function MediaImage({ source, style, onError, transition = 140, fallbackSource, ...props }: ImageProps & { fallbackSource?: ImageProps["source"] }) {
  const { palette } = useFrameTheme();
  const reduced = useReducedMotion();
  const [failed, setFailed] = useState(false);
  const identity = typeof source === "object" && source && "uri" in source ? source.uri : source;
  useEffect(() => setFailed(false), [identity]);
  if ((!source || failed) && fallbackSource) return <Image {...props} source={fallbackSource} style={style} transition={0} />;
  if (!source || failed) return <View style={[style, styles.fallback, { backgroundColor: palette.surfaceDeep }]} accessibilityLabel={props.accessibilityLabel || "Image unavailable"}><ImageOff size={20} color={palette.inkMuted} /></View>;
  return <Image {...props} source={source} style={style} transition={reduced ? 0 : transition} onError={(event) => { setFailed(true); onError?.(event); }} />;
}
const styles = StyleSheet.create({ fallback: { alignItems: "center", justifyContent: "center" } });
