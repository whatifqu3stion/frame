import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useApp } from "@/providers/AppProvider";
import { useScreenAction } from "@/hooks/useScreenAction";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { spacing } from "@/constants/theme";
import { refreshStoredLibraryMetadata } from "@/db/database";
import { resolveVideoDetails } from "@/services/youtube";

/** One deliberate lookup per tap. No background polling, new save, follow, or approval. */
export default function VideoDetailsRecovery({ videoId }: { videoId: string }) {
  const { activeProfileId } = useApp();
  const client = useQueryClient();
  const { palette, type } = useFrameTheme();
  const { run, busy, capture } = useScreenAction(`${activeProfileId}:${videoId}`);
  const [message, setMessage] = useState("Your link is kept. Refresh its title and image when connected.");
  const refresh = () => {
    const current = capture();
    void run(async () => {
      const result = await resolveVideoDetails(videoId);
      if (!current()) return;
      if (result.status !== "success") { setMessage(result.message || "Details are unavailable. Your link is still kept; try again later."); return; }
      if (!result.data) { setMessage("Details are unavailable. Your link is still kept; try again later."); return; }
      await refreshStoredLibraryMetadata(activeProfileId, [result.data]);
      if (!current()) return;
      client.setQueryData(["recovered-video", activeProfileId, videoId], result.data);
      client.setQueryData<Record<string, import("@/types").Video>>(["recovered-library", activeProfileId], (previous) => ({ ...previous, [videoId]: result.data! }));
      await Promise.all([client.invalidateQueries({ queryKey: ["library", activeProfileId] }), client.invalidateQueries({ queryKey: ["session-today-media", activeProfileId] }), client.invalidateQueries({ queryKey: ["session-editor-media", activeProfileId] }), client.invalidateQueries({ queryKey: ["local-playback-video", activeProfileId, videoId] })]);
    }, () => {}, () => setMessage("Details couldn’t refresh. Your link is kept. Try again."));
  };
  return <View style={{ gap: spacing.xs, marginBottom: spacing.md }}>
    <Text style={type.bodySoft} accessibilityLiveRegion="polite">{message}</Text>
    <Pressable onPress={refresh} disabled={busy} accessibilityRole="button" accessibilityLabel={`Refresh details for saved video ${videoId}`} accessibilityState={{ busy, disabled: busy }} style={{ minHeight: 48, justifyContent: "center" }}><Text style={[type.label, { color: palette.active }]}>{busy ? "Refreshing details…" : "Refresh details"}</Text></Pressable>
  </View>;
}
