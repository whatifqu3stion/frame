import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, AppState, findNodeHandle, Platform, Pressable, Text, View } from "react-native";
import MotionView from "@/components/motion/MotionView";
import { useMotionVisibility } from "@/hooks/useMotionVisibility";
import { useApp } from "@/providers/AppProvider";
import { useScreenAction } from "@/hooks/useScreenAction";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { spacing } from "@/constants/theme";
import { refreshStoredLibraryMetadata } from "@/db/database";
import { resolveVideoDetails } from "@/services/youtube";
import type { Video } from "@/types";

/** Keep a successful result mounted so replacing Refresh never drops accessibility focus. */
export default function VideoDetailsRecovery({ videoId, expired }: { videoId: string; expired: boolean }) {
  const { activeProfileId } = useApp();
  const client = useQueryClient();
  const { palette, type } = useFrameTheme();
  const { run, busy, capture } = useScreenAction(`${activeProfileId}:${videoId}`);
  const visible = useMotionVisibility();
  const resultRef = useRef<View>(null);
  const keyboardFocused = useRef(false);
  const restoreKeyboardFocus = useRef(false);
  const announced = useRef<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [message, setMessage] = useState("Your link is kept. Refresh its title and image when connected.");

  useEffect(() => {
    if (!success || expired || announced.current === success) return;
    announced.current = success;
    if (!visible) return;
    let current = true;
    let frame: number | undefined;
    const focusResult = () => {
      frame = requestAnimationFrame(() => {
        if (!current || AppState.currentState !== "active") return;
        if (Platform.OS === "web") resultRef.current?.focus();
        else {
          const node = findNodeHandle(resultRef.current);
          if (node) AccessibilityInfo.setAccessibilityFocus(node);
          else AccessibilityInfo.announceForAccessibility(success);
        }
      });
    };
    if (Platform.OS === "web") {
      // A disabled trigger may leave keyboard focus on the document body. Never steal it from another control.
      if (restoreKeyboardFocus.current && typeof document !== "undefined" && (!document.activeElement || document.activeElement === document.body)) focusResult();
    }
    else void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => { if (enabled && current) focusResult(); }).catch(() => {});
    return () => { current = false; if (frame !== undefined) cancelAnimationFrame(frame); };
  }, [expired, success, visible]);

  const refresh = () => {
    const current = capture();
    restoreKeyboardFocus.current = keyboardFocused.current;
    void run(async () => {
      const result = await resolveVideoDetails(videoId);
      if (!current()) return;
      if (result.status !== "success") { setMessage(result.message || "Details are unavailable. Your link is still kept; try again later."); return; }
      if (!result.data) { setMessage("Details are unavailable. Your link is still kept; try again later."); return; }
      await refreshStoredLibraryMetadata(activeProfileId, [result.data]);
      if (!current()) return;
      setSuccess(`Details refreshed for ${result.data.title}. Your place is kept.`);
      client.setQueryData(["recovered-video", activeProfileId, videoId], result.data);
      client.setQueryData<Record<string, Video>>(["recovered-library", activeProfileId], (previous) => ({ ...previous, [videoId]: result.data! }));
      // The metadata commit already succeeded. A later list refresh must not reverse its feedback.
      await Promise.all([client.invalidateQueries({ queryKey: ["library", activeProfileId] }), client.invalidateQueries({ queryKey: ["session-today-media", activeProfileId] }), client.invalidateQueries({ queryKey: ["session-editor-media", activeProfileId] }), client.invalidateQueries({ queryKey: ["local-playback-video", activeProfileId, videoId] })]).catch(() => {});
    }, () => {}, () => setMessage("Details couldn’t refresh. Your link is kept. Try again."));
  };
  if (!expired) return success ? <MotionView enter style={{ marginBottom: spacing.md }}>
    <View ref={resultRef} accessible focusable tabIndex={-1} accessibilityRole="text" accessibilityLabel={success} accessibilityLiveRegion={Platform.OS === "web" ? "polite" : "none"} style={{ minHeight: 48, justifyContent: "center" }}>
      <Text style={type.bodySoft}>{success}</Text>
    </View>
  </MotionView> : null;
  return <View style={{ gap: spacing.xs, marginBottom: spacing.md }}>
    <Text style={type.bodySoft} accessibilityLiveRegion="polite">{message}</Text>
    <Pressable onPress={refresh} onFocus={() => { keyboardFocused.current = true; }} onBlur={() => { keyboardFocused.current = false; }} disabled={busy} accessibilityRole="button" accessibilityLabel={`Refresh details for saved video ${videoId}`} accessibilityState={{ busy, disabled: busy }} style={{ minHeight: 48, justifyContent: "center" }}><Text style={[type.label, { color: palette.active }]}>{busy ? "Refreshing details…" : "Refresh details"}</Text></Pressable>
  </View>;
}
