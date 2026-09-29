import { useFeedback } from "@/hooks/useFeedback";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Alert, Text, View } from "react-native";
import TodaySessionModal from "@/components/TodaySessionModal";
import { PRODUCT_LIMITS } from "@/constants/productConfig";
import { useFrameTheme } from "@/constants/useFrameTheme";
import { useApp } from "@/providers/AppProvider";

/** Compatibility route: use the same named-session picker as Today. */
export default function AddToSessionModal() {
  const touch = useFeedback();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { palette, type } = useFrameTheme();
  const { sessions, savedVideos, updateSessionVideos, createSession, requirePurchase } = useApp();
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const run = async (action: () => Promise<boolean>): Promise<void> => {
    if (!id || locked.current || !requirePurchase("sessions")) return;
    locked.current = true; setBusy(true);
    const done = touch.capture();
    try { if (await action()) { done("commit"); router.back(); } }
    catch { Alert.alert("Couldn’t update session", "Check your sessions in Saved before trying again."); }
    finally { locked.current = false; setBusy(false); }
  };
  return <View style={{ flex: 1, backgroundColor: palette.wall }}>
    {!id ? <Text style={[type.body, { padding: 24 }]}>This video link is unavailable. Go back and choose a video.</Text> : null}
    <TodaySessionModal nestedRoute visible={Boolean(id)} videoId={id ?? ""} title={savedVideos.find((video) => video.id === id)?.title ?? "Choose a session for this video"} sessions={sessions} busy={busy} onClose={() => router.back()} onPick={(sessionId) => { void run(async () => {
      const session = sessions.find((item) => item.id === sessionId);
      if (!session || !id || session.orderedVideoIds.includes(id) || session.orderedVideoIds.length >= PRODUCT_LIMITS.sessionDraftMaxItems) return false;
      await updateSessionVideos(session.id, [...session.orderedVideoIds, id]); return true;
    }); }} onCreate={(name) => { void run(async () => Boolean(id && await createSession(name, [id]))); }} />
  </View>;
}
