import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AddChannelResult, FollowedChannel, InterestTopic, ThemeMode, UserPreferences, Video, VideoQueue } from "@/types";
import { INTEREST_LIBRARY } from "@/constants/interests";
import { GOOGLE_CONFIG, GOOGLE_SCOPES, isGoogleConfigured } from "@/constants/config";
import { fetchGoogleEmail, fetchSubscriptions } from "@/services/googleAuth";
import { parseYouTubeLink, resolveChannelFromLink } from "@/services/youtube";

WebBrowser.maybeCompleteAuthSession();
import {
  addWatchLater,
  clearAllData,
  deleteQueue,
  followChannel,
  isVideoSaved as dbIsVideoSaved,
  listFollowedChannels,
  listQueues,
  listResume,
  listSavedVideos,
  listWatchLater,
  removeWatchLater,
  saveVideo,
  unfollowChannel,
  unsaveVideo,
  upsertQueue,
} from "@/db/database";

const PREFS_KEY = "frame.preferences.v1";
const INTERESTS_KEY = "frame.interests.v1";
const RECENT_SEARCHES_KEY = "frame.recentSearches.v1";
const GOOGLE_TOKEN_KEY = "frame.google.token.v1";
const MAX_RECENT_SEARCHES = 8;
const MAX_ONBOARDING_SEARCHES = 3;

const defaultPrefs: UserPreferences = {
  theme: "warm",
  hasCompletedOnboarding: false,
  youtubeApiKey: null,
  hasPurchased: false,
  onboardingSearchCount: 0,
  googleEmail: null,
  googleConnectedAt: null,
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

async function loadRecentSearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

async function persistRecentSearches(items: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn("[recent] save failed", err);
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
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [ready, setReady] = useState<boolean>(false);
  const [paywallOpen, setPaywallOpen] = useState<boolean>(false);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [importing, setImporting] = useState<boolean>(false);
  const queryClient = useQueryClient();

  const [, , promptGoogle] = Google.useAuthRequest({
    iosClientId: GOOGLE_CONFIG.iosClientId,
    androidClientId: GOOGLE_CONFIG.androidClientId,
    webClientId: GOOGLE_CONFIG.webClientId,
    scopes: GOOGLE_SCOPES,
  });

  useEffect(() => {
    let mounted = true;
    Promise.all([loadPrefs(), loadInterests(), loadRecentSearches(), SecureStore.getItemAsync(GOOGLE_TOKEN_KEY).catch(() => null)])
      .then(([p, i, r, token]) => {
        if (!mounted) return;
        setPrefs(p);
        setInterests(i);
        setRecentSearches(r);
        setGoogleToken(token);
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

  const addRecentSearch = useCallback((term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const next = [trimmed, ...prev.filter((t) => t.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENT_SEARCHES);
      void persistRecentSearches(next);
      return next;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    void persistRecentSearches([]);
  }, []);

  const consumeSearchCredit = useCallback(() => {
    setPrefs((prev) => {
      const next = { ...prev, onboardingSearchCount: Math.min(MAX_ONBOARDING_SEARCHES, prev.onboardingSearchCount + 1) };
      void savePrefs(next);
      return next;
    });
  }, []);

  const searchCreditsRemaining = Math.max(0, MAX_ONBOARDING_SEARCHES - prefs.onboardingSearchCount);

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

  const watchLaterQuery = useQuery({
    queryKey: ["library", "watchLater"],
    queryFn: listWatchLater,
    enabled: ready,
  });

  const channelsQuery = useQuery({
    queryKey: ["library", "channels"],
    queryFn: listFollowedChannels,
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

  const renameQueue = useCallback(
    async (id: string, name: string) => {
      const existing = queuesQuery.data?.find((q) => q.id === id);
      if (!existing) return;
      await upsertQueue({ ...existing, name: name.trim() || existing.name, updatedAt: Date.now() });
      invalidateLibrary();
    },
    [queuesQuery.data, invalidateLibrary],
  );

  const removeFromQueue = useCallback(
    async (queueId: string, videoId: string) => {
      const existing = queuesQuery.data?.find((q) => q.id === queueId);
      if (!existing) return;
      await upsertQueue({
        ...existing,
        orderedVideoIds: existing.orderedVideoIds.filter((v) => v !== videoId),
        updatedAt: Date.now(),
      });
      invalidateLibrary();
    },
    [queuesQuery.data, invalidateLibrary],
  );

  const watchLaterMutation = useMutation({
    mutationFn: async (video: Video) => {
      await addWatchLater(video);
    },
    onSuccess: invalidateLibrary,
  });

  const removeWatchLaterMutation = useMutation({
    mutationFn: async (videoId: string) => {
      await removeWatchLater(videoId);
    },
    onSuccess: invalidateLibrary,
  });

  const followMutation = useMutation({
    mutationFn: async (channel: FollowedChannel) => {
      await followChannel(channel);
    },
    onSuccess: invalidateLibrary,
  });

  const unfollowMutation = useMutation({
    mutationFn: async (id: string) => {
      await unfollowChannel(id);
    },
    onSuccess: invalidateLibrary,
  });

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

  // --- Google account / subscription import ---
  const importSubscriptions = useCallback(
    async (token: string): Promise<number> => {
      setImporting(true);
      try {
        const subs = await fetchSubscriptions(token);
        for (const channel of subs) {
          await followChannel(channel);
        }
        invalidateLibrary();
        return subs.length;
      } finally {
        setImporting(false);
      }
    },
    [invalidateLibrary],
  );

  const signInWithGoogle = useCallback(async (): Promise<AddChannelResult> => {
    if (!isGoogleConfigured()) {
      return { ok: false, message: "Google sign-in needs setup. Add your keys in Settings to enable it." };
    }
    try {
      const result = await promptGoogle();
      if (result?.type !== "success") {
        return { ok: false, message: "Sign-in cancelled." };
      }
      const token = result.authentication?.accessToken ?? null;
      if (!token) return { ok: false, message: "Couldn't complete sign-in." };
      setGoogleToken(token);
      await SecureStore.setItemAsync(GOOGLE_TOKEN_KEY, token).catch(() => {});
      const email = await fetchGoogleEmail(token);
      await updatePrefs({ googleEmail: email, googleConnectedAt: Date.now() });
      const count = await importSubscriptions(token);
      return { ok: true, message: count > 0 ? `Imported ${count} channel${count === 1 ? "" : "s"}.` : "Signed in. No subscriptions found." };
    } catch (err) {
      console.warn("[google] sign-in failed", err);
      return { ok: false, message: "Sign-in failed. Please try again." };
    }
  }, [promptGoogle, updatePrefs, importSubscriptions]);

  const refreshSubscriptions = useCallback(async (): Promise<AddChannelResult> => {
    if (!googleToken) return { ok: false, message: "Sign in with Google first." };
    try {
      const count = await importSubscriptions(googleToken);
      return { ok: true, message: count > 0 ? `Synced ${count} channel${count === 1 ? "" : "s"}.` : "Nothing new to sync." };
    } catch {
      return { ok: false, message: "Couldn't refresh. Your session may have expired — sign in again." };
    }
  }, [googleToken, importSubscriptions]);

  const signOutGoogle = useCallback(async () => {
    setGoogleToken(null);
    await SecureStore.deleteItemAsync(GOOGLE_TOKEN_KEY).catch(() => {});
    await updatePrefs({ googleEmail: null, googleConnectedAt: null });
  }, [updatePrefs]);

  const addChannelByLink = useCallback(
    async (input: string): Promise<AddChannelResult> => {
      const parsed = parseYouTubeLink(input);
      const { channel, error } = await resolveChannelFromLink(parsed, prefs.youtubeApiKey);
      if (error || !channel) {
        return { ok: false, message: error ?? "Couldn't add that link." };
      }
      await followChannel({ ...channel, followedAt: Date.now() });
      invalidateLibrary();
      return { ok: true, message: `Added ${channel.title}.` };
    },
    [prefs.youtubeApiKey, invalidateLibrary],
  );

  const wipeAllData = useCallback(async () => {
    await clearAllData();
    await AsyncStorage.multiRemove([PREFS_KEY, INTERESTS_KEY, RECENT_SEARCHES_KEY]);
    await SecureStore.deleteItemAsync(GOOGLE_TOKEN_KEY).catch(() => {});
    setGoogleToken(null);
    setPrefs(defaultPrefs);
    setInterests([]);
    setRecentSearches([]);
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
      recentSearches,
      addRecentSearch,
      clearRecentSearches,
      searchCreditsRemaining,
      consumeSearchCredit,
      googleConfigured: isGoogleConfigured(),
      googleConnected: Boolean(prefs.googleConnectedAt),
      googleEmail: prefs.googleEmail,
      importing,
      signInWithGoogle,
      signOutGoogle,
      refreshSubscriptions,
      addChannelByLink,
      savedVideos: savedQuery.data ?? [],
      resumeList: resumeQuery.data ?? [],
      queues: queuesQuery.data ?? [],
      watchLater: watchLaterQuery.data ?? [],
      followedChannels: channelsQuery.data ?? [],
      isVideoSaved: (id: string) => (savedQuery.data ?? []).some((v) => v.id === id),
      isInWatchLater: (id: string) => (watchLaterQuery.data ?? []).some((v) => v.id === id),
      isChannelFollowed: (id: string) => (channelsQuery.data ?? []).some((c) => c.id === id),
      checkIsVideoSaved: (id: string) => dbIsVideoSaved(id),
      saveVideo: (v: Video) => saveMutation.mutateAsync(v),
      unsaveVideo: (id: string) => unsaveMutation.mutateAsync(id),
      addToWatchLater: (v: Video) => watchLaterMutation.mutateAsync(v),
      removeFromWatchLater: (id: string) => removeWatchLaterMutation.mutateAsync(id),
      followChannel: (c: FollowedChannel) => followMutation.mutateAsync(c),
      unfollowChannel: (id: string) => unfollowMutation.mutateAsync(id),
      addToQueue,
      createQueue,
      renameQueue,
      removeQueue,
      removeFromQueue,
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
      recentSearches,
      addRecentSearch,
      clearRecentSearches,
      searchCreditsRemaining,
      consumeSearchCredit,
      importing,
      signInWithGoogle,
      signOutGoogle,
      refreshSubscriptions,
      addChannelByLink,
      savedQuery.data,
      resumeQuery.data,
      queuesQuery.data,
      watchLaterQuery.data,
      channelsQuery.data,
      saveMutation,
      unsaveMutation,
      watchLaterMutation,
      removeWatchLaterMutation,
      followMutation,
      unfollowMutation,
      addToQueue,
      createQueue,
      renameQueue,
      removeQueue,
      removeFromQueue,
      wipeAllData,
    ],
  );
});
