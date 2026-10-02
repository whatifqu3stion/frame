import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { useApp } from "@/providers/AppProvider";
import { useScreenAction } from "@/hooks/useScreenAction";
import type { Video } from "@/types";

/** One reversible removal at a time; undo restores the same profile-owned link. */
export function useSavedRemoval(scope = "saved") {
  const { activeProfileId, saveVideo, unsaveVideo, savedVideos } = useApp();
  const { busy, run } = useScreenAction(`${activeProfileId}:${scope}`);
  const [removed, setRemoved] = useState<Video | null>(null);
  useEffect(() => { setRemoved(null); }, [activeProfileId, scope]);
  const remove = async (video: Video) => {
    await run(() => unsaveVideo(video.id), () => setRemoved(video), () => Alert.alert("Couldn’t remove video", "Your Saved list couldn’t be updated. Try again."));
  };
  const undo = async () => {
    if (!removed) return;
    await run(async () => { if (!savedVideos.some((video) => video.id === removed.id)) await saveVideo(removed); }, () => setRemoved(null), () => Alert.alert("Couldn’t restore video", "Your Undo is still available. Try again."));
  };
  return { removed, busy, remove, undo, dismiss: () => setRemoved(null) };
}
