import Text from "@/components/FrameText";
import { useFeedback } from "@/hooks/useFeedback";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";
import TodaySessionModal from "@/components/TodaySessionModal";
import { PRODUCT_LIMITS } from "@/constants/productConfig";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { notifyUser } from "@/services/notifyUser";
import { useApp } from "@/providers/AppProvider";

/** Compatibility route: use the same named-session picker as Today. */
export default function AddToSessionModal() {
  const touch = useFeedback();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { palette, type } = useFrameTheme();
  const { activeProfileId, sessions, savedVideos, updateSessionVideos, createSession, requirePurchase } = useApp();
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const run = async (action: () => Promise<{ id: string; name: string; count: number } | null>) => {
    if (!id || locked.current || !requirePurchase("sessions")) return null;
    locked.current = true; setBusy(true);
    const done = touch.capture();
    try {
      const result = await action();
      if (result) done("commit");
      return result;
    } catch {
      notifyUser("Couldn’t update session", "Check your sessions in Saved before trying again.");
      return null;
    } finally { locked.current = false; setBusy(false); }
  };
  return <View style={{ flex: 1, backgroundColor: palette.wall }}>
    {id ? <TodaySessionModal key={`${activeProfileId}:${id}`} nestedRoute videoId={id} title={savedVideos.find((video) => video.id === id)?.title ?? "Choose a session for this video"} sessions={sessions} busy={busy} onClose={() => router.back()}
      onOpen={(sessionId, addedVideoId) => router.replace({ pathname: "/session/[id]", params: { id: sessionId, addedVideoId } })}
      onPick={(sessionId) => run(async () => {
        const session = sessions.find((item) => item.id === sessionId);
        if (!session || session.orderedVideoIds.includes(id) || session.orderedVideoIds.length >= PRODUCT_LIMITS.sessionDraftMaxItems) return null;
        const ids = [...session.orderedVideoIds, id];
        await updateSessionVideos(session.id, ids);
        return { id: session.id, name: session.name, count: ids.length };
      })}
      onCreate={(name) => run(async () => {
        const session = await createSession(name, [id]);
        return session ? { id: session.id, name: session.name, count: session.orderedVideoIds.length } : null;
      })} /> : <Text style={[type.body, { padding: 24 }]}>This video link is unavailable. Go back and choose a video.</Text>}
  </View>;
}
