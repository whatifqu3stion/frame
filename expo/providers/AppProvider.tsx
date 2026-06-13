import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { InterestTopic, ThemeMode, UserPreferences, Video, VideoQueue } from "@/types";
import { INTEREST_LIBRARY } from "@/constants/interests";
import {
  clearAllData,
  deleteQueue,
  isVideoSaved as dbIsVideoSaved,
  listQueues,
  listResume,
  listSavedVideos,
  saveVideo,
  unsaveVideo,
  upsertQueue,
} from "@/db/database";

const PREFS_KEY = "frame.preferences.v1";
const INTERESTS_KEY = "frame.interests.v1";

const defaultPrefs: UserPreferences = {
  theme: "warm",
  hasCompletedOnboarding: false,
  youtubeApiKey: null,
  hasPurchased: false,
};

async function loadPrefs(): Promise<UserPreferences> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return defaultPrefs;
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return { ...defaultPrefs, ...parsed };
  } catch (err) {
    console.warn("[prefs] load failed", err);
    return defaultPrefs;
  }
}

async function savePrefs(p: UserPreferences): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch (err) {
    console.warn("[prefs] save failed", err);
  }
}

async function loadInterests(): Promise<InterestTopic[]> {
  try {
    const raw = await AsyncStorage.getItem(INTERESTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InterestTopic[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveInterests(items: InterestTopic[]): Promise<void> {
  try {
    await AsyncStorage.setItem(INTERESTS_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn("[interests] save failed", err);
  }
}

export const [AppProvider, useApp] = createContextHook(() => {
  const [prefs, setPrefs] = useState<UserPreferences>(defaultPrefs);
  const [interests, setInterests] = useState<InterestTopic[]>([]);
  const [ready, setReady] = useState<boolean>(false);
  const [paywallOpen, setPaywallOpen] = useState<boolean>(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;
    Promise.all([loadPrefs(), loadInterests()])
      .then(([p, i]) => {
        if (!mounted) return;
        setPrefs(p);
        setInterests(i);
        setReady(true);
      })
      .catch((err) => {
        console.warn("[app] init failed", err);
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const updatePrefs = useCallback(async (patch: Partial<UserPreferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      void savePrefs(next);
      return next;
    });
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => updatePrefs({ theme: mode }), [updatePrefs]);
  const setApiKey = useCallback((key: string | null) => updatePrefs({ youtubeApiKey: key && key.trim() ? key.trim() : null }), [updatePrefs]);
  const finishOnboarding = useCallback(() => updatePrefs({ hasCompletedOnboarding: true }), [updatePrefs]);
  const markPurchased = useCallback(() => updatePrefs({ hasPurchased: true }), [updatePrefs]);

  const replaceInterests = useCallback(async (items: InterestTopic[]) => {
    setInterests(items);
    await saveInterests(items);
  }, []);

  const toggleInterest = useCallback(
    (id: string) => {
      setInterests((prev) => {
        const exists = prev.some((i) => i.id === id);
        const next = exists ? prev.filter((i) => i.id !== id) : [...prev, INTEREST_LIBRARY.find((x) => x.id === id)!].filter(Boolean);
        void saveInterests(next);
        return next;
      });
    },
    [],
  );

  const requirePurchase = useCallback((): boolean => {
    if (prefs.hasPurchased) return true;
    setPaywallOpen(true);
    return false;
  }, [prefs.hasPurchased]);

  // Library queries
  const savedQuery = useQuery({
    queryKey: ["library", "saved"],
    queryFn: listSavedVideos,
    enabled: ready,
  });

  const resumeQuery = useQuery({
    queryKey: ["library", "resume"],
    queryFn: listResume,
    enabled: ready,
  });

  const queuesQuery = useQuery({
    queryKey: ["library", "queues"],
    queryFn: listQueues,
    enabled: ready,
  });

  const invalidateLibrary = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["library"] });
  }, [queryClient]);

  const saveMutation = useMutation({
    mutationFn: async (video: Video) => {
      await saveVideo(video);
    },
    onSuccess: invalidateLibrary,
  });

  const unsaveMutation = useMutation({
    mutationFn: async (videoId: string) => {
      await unsaveVideo(videoId);
    },
    onSuccess: invalidateLibrary,
  });

  const addToQueue = useCallback(
    async (queueId: string, videoId: string) => {
      const existing = queuesQuery.data?.find((q) => q.id === queueId);
      if (!existing) return;
      const ids = existing.orderedVideoIds.includes(videoId)
        ? existing.orderedVideoIds
        : [...existing.orderedVideoIds, videoId];
      await upsertQueue({ ...existing, orderedVideoIds: ids, updatedAt: Date.now() });
      invalidateLibrary();
    },
    [queuesQuery.data, invalidateLibrary],
  );

  const createQueue = useCallback(
    async (name: string, firstVideoId?: string): Promise<VideoQueue> => {
      const q: VideoQueue = {
        id: `q_${Math.random().toString(36).slice(2, 10)}`,
        name: name.trim() || "Untitled Queue",
        orderedVideoIds: firstVideoId ? [firstVideoId] : [],
        updatedAt: Date.now(),
      };
      await upsertQueue(q);
      invalidateLibrary();
      return q;
    },
    [invalidateLibrary],
  );

  const removeQueue = useCallback(
    async (id: string) => {
      await deleteQueue(id);
      invalidateLibrary();
    },
    [invalidateLibrary],
  );

  const wipeAllData = useCallback(async () => {
    await clearAllData();
    await AsyncStorage.multiRemove([PREFS_KEY, INTERESTS_KEY]);
    setPrefs(defaultPrefs);
    setInterests([]);
    invalidateLibrary();
  }, [invalidateLibrary]);

  return useMemo(
    () => ({
      ready,
      prefs,
      interests,
      paywallOpen,
      setPaywallOpen,
      setTheme,
      setApiKey,
      finishOnboarding,
      markPurchased,
      replaceInterests,
      toggleInterest,
      requirePurchase,
      savedVideos: savedQuery.data ?? [],
      resumeList: resumeQuery.data ?? [],
      queues: queuesQuery.data ?? [],
      isVideoSaved: (id: string) => (savedQuery.data ?? []).some((v) => v.id === id),
      checkIsVideoSaved: (id: string) => dbIsVideoSaved(id),
      saveVideo: (v: Video) => saveMutation.mutateAsync(v),
      unsaveVideo: (id: string) => unsaveMutation.mutateAsync(id),
      addToQueue,
      createQueue,
      removeQueue,
      wipeAllData,
    }),
    [
      ready,
      prefs,
      interests,
      paywallOpen,
      setTheme,
      setApiKey,
      finishOnboarding,
      markPurchased,
      replaceInterests,
      toggleInterest,
      requirePurchase,
      savedQuery.data,
      resumeQuery.data,
      queuesQuery.data,
      saveMutation,
      unsaveMutation,
      addToQueue,
      createQueue,
      removeQueue,
      wipeAllData,
    ],
  );
});
