import { useCallback } from "react";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useApp } from "@/providers/AppProvider";
import { useFeedback } from "@/hooks/useFeedback";
import { useScreenAction } from "@/hooks/useScreenAction";
import { readSessionRun, resetSessionRun } from "@/db/database";
import { sessionPosition } from "@/domain/sessionFlow";
import { sessionTimeRemaining } from "@/domain/sessionTimer";
import { FRAME_PLAYBACK_ROUTE } from "@/constants/navigation";
import { notifyUser } from "@/services/notifyUser";
import type { Video, VideoQueue } from "@/types";

export function useSessionPlayback(session: VideoQueue | undefined, videoMap: ReadonlyMap<string, Video>) {
  const { activeProfileId, updateSessionPosition, requirePurchase } = useApp();
  const feedback = useFeedback();
  const { busy, run, capture } = useScreenAction(`${activeProfileId}:${session?.id ?? ""}`);
  const timerQuery = useQuery({ queryKey: ["session-run", activeProfileId, session?.id], queryFn: () => readSessionRun(activeProfileId, session!.id), enabled: Boolean(session), networkMode: "always" });
  const refreshTimer = timerQuery.refetch;
  useFocusEffect(useCallback(() => { if (session) void refreshTimer(); }, [refreshTimer, session]));
  const timeComplete = Boolean(timerQuery.data && (timerQuery.data.ended || (session?.targetMinutes && sessionTimeRemaining(timerQuery.data, session.targetMinutes) === 0)));
  const finishingCurrent = Boolean(timerQuery.data?.finishVideoId && !timerQuery.data.ended && session?.orderedVideoIds[sessionPosition(session)] === timerQuery.data.finishVideoId);
  const position = session ? sessionPosition(session) : 0;

  const startAt = useCallback(async (index: number): Promise<void> => {
    if (!session || !requirePurchase("sessions")) return;
    if (!session.targetMinutes) { router.push({ pathname: "/session", params: { id: session.id } }); return; }
    const videoId = session.orderedVideoIds[index];
    if (!videoId) return;
    const done = feedback.capture();
    await run(async () => {
      const usage = await readSessionRun(activeProfileId, session.id);
      if (usage.ended || (sessionTimeRemaining(usage, session.targetMinutes!) === 0 && usage.finishVideoId !== videoId) || position >= session.orderedVideoIds.length) await resetSessionRun(activeProfileId, session.id);
      const moved = await updateSessionPosition(session.id, videoId, index, index);
      if (!moved) throw new Error("Session changed");
    }, () => {
      done("commit");
      const video = videoMap.get(videoId);
      router.push({
        pathname: FRAME_PLAYBACK_ROUTE,
        params: { id: videoId, savedSessionId: session.id, sessionProfileId: activeProfileId, title: video?.title ?? "", channelId: video?.channelId ?? "", channelTitle: video?.channelTitle ?? "", thumbnailUrl: video?.thumbnailUrl ?? "", publishedAt: video?.publishedAt ?? "", durationSeconds: String(video?.durationSeconds ?? 0), cachedMetadata: "1", fetchedAt: String(video?.fetchedAt ?? 0) },
      });
    }, () => notifyUser("Couldn’t start session", "Check your session and try again."));
  }, [activeProfileId, feedback, requirePurchase, session, updateSessionPosition, videoMap, run, position]);

  let playLabel = "Start session";
  if (!session?.targetMinutes) playLabel = "Choose duration";
  else if (finishingCurrent) playLabel = "Finish current video";
  else if (timeComplete || position >= session.orderedVideoIds.length) playLabel = "Start a new timed session";
  else if (position > 0 || timerQuery.data?.consumedSeconds) playLabel = "Continue session";

  return { busy, run, capture, startAt, timerQuery, position, timeComplete, playLabel };
}
