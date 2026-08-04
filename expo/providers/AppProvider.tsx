import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AccentMode, AddChannelResult, FollowedChannel, InterestTopic, ThemeMode, UserPreferences, Video, VideoQueue } from "@/types";
import { INTEREST_LIBRARY } from "@/constants/interests";
import { GOOGLE_CONFIG, GOOGLE_SCOPES, isGoogleConfigured, isGooglePlatformConfigured } from "@/constants/config";
import { fetchGoogleEmail, fetchSubscriptions, revokeGoogleAccess } from "@/services/googleAuth";
import { parseYouTubeLink, resolveChannelFromLink } from "@/services/youtube";
import {
  getRevenueCatCustomerInfo,
  hasPremiumEntitlement,
  isRevenueCatConfigured,
  REVENUECAT_CUSTOMER_INFO_KEY,
  subscribeToRevenueCatCustomerInfo,
} from "@/services/revenueCat";

WebBrowser.maybeCompleteAuthSession();
import {
  addWatchLater,
  clearAllData,
  clearResume,
  deleteQueue,
  followChannel,
  followChannels,
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
  upsertResume,
} from "@/db/database";

const PREFS_KEY = "frame.preferences.v1";
const INTERESTS_KEY = "frame.interests.v1";
const RECENT_SEARCHES_KEY = "frame.recentSearches.v1";
const GOOGLE_TOKEN_KEY = "frame.google.token.v1";
const MAX_RECENT_SEARCHES = 8;

type GoogleCredential = {
  accessToken: string;
  expiresAt: number;
};

const defaultPrefs: UserPreferences = {
  theme: "warm",
  accent: "blue",
  hasCompletedOnboarding: false,
  googleEmail: null,
  googleConnectedAt: null,
};

async function loadPrefs(): Promise<UserPreferences> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return defaultPrefs;
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return {
      theme: parsed.theme === "ink" ? "ink" : "warm",
      accent: parsed.accent === "green" || parsed.accent === "rose" ? parsed.accent : "blue",
      hasCompletedOnboarding: parsed.hasCompletedOnboarding === true,
      googleEmail: typeof parsed.googleEmail === "string" ? parsed.googleEmail : null,
      googleConnectedAt: typeof parsed.googleConnectedAt === "number" && Number.isFinite(parsed.googleConnectedAt)
        ? parsed.googleConnectedAt
        : null,
    };
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
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const validIds = new Set(INTEREST_LIBRARY.map((interest) => interest.id));
    return parsed
      .filter(
        (item): item is InterestTopic =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as InterestTopic).id === "string" &&
          validIds.has((item as InterestTopic).id),
      )
      .map((item) => INTEREST_LIBRARY.find((interest) => interest.id === item.id)!)
      .filter(Boolean);
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

function parseGoogleCredential(raw: string | null): GoogleCredential | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GoogleCredential>;
    if (typeof parsed.accessToken !== "string" || typeof parsed.expiresAt !== "number") return null;
    return { accessToken: parsed.accessToken, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

export const [AppProvider, useApp] = createContextHook(() => {
  const [prefs, setPrefs] = useState<UserPreferences>(defaultPrefs);
  const [interests, setInterests] = useState<InterestTopic[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [ready, setReady] = useState<boolean>(false);
  const [paywallOpen, setPaywallOpen] = useState<boolean>(false);
  const [googleCredential, setGoogleCredential] = useState<GoogleCredential | null>(null);
  const [importing, setImporting] = useState<boolean>(false);
  const prefsRef = useRef<UserPreferences>(defaultPrefs);
  const interestsRef = useRef<InterestTopic[]>([]);
  const recentSearchesRef = useRef<string[]>([]);
  const storageGenerationRef = useRef<number>(0);
  const prefsWriteRef = useRef<Promise<void>>(Promise.resolve());
  const interestsWriteRef = useRef<Promise<void>>(Promise.resolve());
  const searchesWriteRef = useRef<Promise<void>>(Promise.resolve());
  const queryClient = useQueryClient();

  // `expo-auth-session` throws if the active platform's client ID is missing, so we
  // only start the auth request when this platform is actually configured. The
  // condition is derived from build-time env + platform, so it's constant for the
  // whole session and safe to gate the hook on.
  let promptGoogle: ReturnType<typeof Google.useAuthRequest>[2] | null = null;
  if (isGooglePlatformConfigured()) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [request, , prompt] = Google.useAuthRequest({
      iosClientId: GOOGLE_CONFIG.iosClientId,
      androidClientId: GOOGLE_CONFIG.androidClientId,
      webClientId: GOOGLE_CONFIG.webClientId,
      scopes: GOOGLE_SCOPES,
    });
    promptGoogle = prompt;
    // Surface the exact redirect URI Google expects to be whitelisted. This is the
    // value you must add under "Authorized redirect URIs" in the Google Cloud console
    // for your OAuth client to resolve `redirect_uri_mismatch`.
    if (request?.redirectUri) {
      console.log("[google] redirectUri to whitelist:", request.redirectUri);
    }
  }

  useEffect(() => {
    let mounted = true;
    Promise.all([loadPrefs(), loadInterests(), loadRecentSearches(), SecureStore.getItemAsync(GOOGLE_TOKEN_KEY).catch(() => null)])
      .then(([p, i, r, rawCredential]) => {
        if (!mounted) return;
        const credential = parseGoogleCredential(rawCredential);
        const activeCredential = credential && credential.expiresAt > Date.now() ? credential : null;
        const nextPrefs = activeCredential ? p : { ...p, googleEmail: null, googleConnectedAt: null };
        prefsRef.current = nextPrefs;
        interestsRef.current = i;
        recentSearchesRef.current = r;
        setPrefs(nextPrefs);
        setInterests(i);
        setRecentSearches(r);
        setGoogleCredential(activeCredential);
        if (!activeCredential && rawCredential) void SecureStore.deleteItemAsync(GOOGLE_TOKEN_KEY).catch(() => {});
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

  const updatePrefs = useCallback(async (patch: Partial<UserPreferences>): Promise<void> => {
    const next = { ...prefsRef.current, ...patch };
    const generation = storageGenerationRef.current;
    prefsRef.current = next;
    setPrefs(next);
    const write = prefsWriteRef.current.then(async () => {
      if (storageGenerationRef.current === generation) await savePrefs(next);
    });
    prefsWriteRef.current = write.catch(() => {});
    await write;
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => updatePrefs({ theme: mode }), [updatePrefs]);
  const setAccent = useCallback((accent: AccentMode) => updatePrefs({ accent }), [updatePrefs]);
  const finishOnboarding = useCallback(() => updatePrefs({ hasCompletedOnboarding: true }), [updatePrefs]);

  const replaceInterests = useCallback(async (items: InterestTopic[]): Promise<void> => {
    const generation = storageGenerationRef.current;
    interestsRef.current = items;
    setInterests(items);
    const write = interestsWriteRef.current.then(async () => {
      if (storageGenerationRef.current === generation) await saveInterests(items);
    });
    interestsWriteRef.current = write.catch(() => {});
    await write;
  }, []);

  const toggleInterest = useCallback(
    (id: string) => {
      const interest = INTEREST_LIBRARY.find((item) => item.id === id);
      if (!interest) return;
      const current = interestsRef.current;
      const next = current.some((item) => item.id === id)
        ? current.filter((item) => item.id !== id)
        : [...current, interest];
      void replaceInterests(next);
    },
    [replaceInterests],
  );

  const persistSearches = useCallback(async (items: string[]): Promise<void> => {
    const generation = storageGenerationRef.current;
    recentSearchesRef.current = items;
    setRecentSearches(items);
    const write = searchesWriteRef.current.then(async () => {
      if (storageGenerationRef.current === generation) await persistRecentSearches(items);
    });
    searchesWriteRef.current = write.catch(() => {});
    await write;
  }, []);

  const addRecentSearch = useCallback((term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const current = recentSearchesRef.current;
    const next = [trimmed, ...current.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENT_SEARCHES);
    void persistSearches(next);
  }, [persistSearches]);

  const clearRecentSearches = useCallback(() => {
    void persistSearches([]);
  }, [persistSearches]);

  const customerInfoQuery = useQuery({
    queryKey: REVENUECAT_CUSTOMER_INFO_KEY,
    queryFn: getRevenueCatCustomerInfo,
    enabled: ready && isRevenueCatConfigured,
    staleTime: 1000 * 60 * 5,
  });
  const isPremium = hasPremiumEntitlement(customerInfoQuery.data);

  useEffect(() => {
    return subscribeToRevenueCatCustomerInfo((customerInfo) => {
      queryClient.setQueryData(REVENUECAT_CUSTOMER_INFO_KEY, customerInfo);
    });
  }, [queryClient]);

  const requirePurchase = useCallback((): boolean => {
    if (isPremium) return true;
    setPaywallOpen(true);
    return false;
  }, [isPremium]);

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

  const recordResume = useCallback(async (video: Video, timestampSeconds: number): Promise<void> => {
    await upsertResume(video, timestampSeconds);
    await queryClient.invalidateQueries({ queryKey: ["library", "resume"] });
  }, [queryClient]);

  const clearVideoResume = useCallback(async (videoId: string): Promise<void> => {
    await clearResume(videoId);
    await queryClient.invalidateQueries({ queryKey: ["library", "resume"] });
  }, [queryClient]);

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
    async (token: string): Promise<AddChannelResult> => {
      setImporting(true);
      try {
        const result = await fetchSubscriptions(token);
        if (result.status !== "success" && result.status !== "empty" && result.status !== "partial") {
          return { ok: false, message: result.message };
        }
        await followChannels(result.data);
        invalidateLibrary();
        if (result.status === "partial") return { ok: true, message: result.message };
        if (result.status === "empty") return { ok: true, message: result.message ?? "No YouTube subscriptions were found." };
        const count = result.data.length;
        return { ok: true, message: `Imported ${count} channel${count === 1 ? "" : "s"}.` };
      } finally {
        setImporting(false);
      }
    },
    [invalidateLibrary],
  );

  const signInWithGoogle = useCallback(async (): Promise<AddChannelResult> => {
    if (!requirePurchase()) return { ok: false, message: "Following creators is part of Frame Premium." };
    if (!isGoogleConfigured()) return { ok: false, message: "Google sign-in isn't configured for this build yet." };
    if (!promptGoogle) return { ok: false, message: "Google sign-in isn't configured for this platform yet." };
    try {
      const result = await promptGoogle();
      if (result?.type !== "success") return { ok: false, message: "Sign-in cancelled." };
      const token = result.authentication?.accessToken ?? null;
      if (!token) return { ok: false, message: "Google didn't return a usable credential." };

      const emailResult = await fetchGoogleEmail(token);
      if (emailResult.status !== "success") {
        return {
          ok: false,
          message: emailResult.status === "empty"
            ? emailResult.message ?? "Google did not return an email address."
            : emailResult.message,
        };
      }
      const importResult = await importSubscriptions(token);
      if (!importResult.ok) return importResult;

      const expiresInSeconds = result.authentication?.expiresIn ?? 3600;
      const credential = {
        accessToken: token,
        expiresAt: Date.now() + Math.max(60, expiresInSeconds - 60) * 1000,
      };
      await SecureStore.setItemAsync(GOOGLE_TOKEN_KEY, JSON.stringify(credential));
      setGoogleCredential(credential);
      await updatePrefs({ googleEmail: emailResult.data, googleConnectedAt: Date.now() });
      return importResult;
    } catch (err) {
      console.warn("[google] sign-in failed", err instanceof Error ? err.message : "unknown error");
      return { ok: false, message: "Sign-in failed. Please try again." };
    }
  }, [promptGoogle, requirePurchase, updatePrefs, importSubscriptions]);

  const refreshSubscriptions = useCallback(async (): Promise<AddChannelResult> => {
    if (!googleCredential || googleCredential.expiresAt <= Date.now()) {
      setGoogleCredential(null);
      await SecureStore.deleteItemAsync(GOOGLE_TOKEN_KEY).catch(() => {});
      await updatePrefs({ googleEmail: null, googleConnectedAt: null });
      return { ok: false, message: "Your Google connection expired. Sign in again to refresh." };
    }
    return importSubscriptions(googleCredential.accessToken);
  }, [googleCredential, importSubscriptions, updatePrefs]);

  const signOutGoogle = useCallback(async (): Promise<AddChannelResult> => {
    if (googleCredential) {
      const result = await revokeGoogleAccess(googleCredential.accessToken);
      if (result.status !== "success") return { ok: false, message: result.message ?? "Google couldn't revoke access. Try again." };
    }
    setGoogleCredential(null);
    await SecureStore.deleteItemAsync(GOOGLE_TOKEN_KEY).catch(() => {});
    await updatePrefs({ googleEmail: null, googleConnectedAt: null });
    return { ok: true, message: "Google access was revoked. Imported creators remain on this device." };
  }, [googleCredential, updatePrefs]);

  const addChannelByLink = useCallback(
    async (input: string): Promise<AddChannelResult> => {
      if (!requirePurchase()) return { ok: false, message: "Following creators is part of Frame Premium." };
      const result = await resolveChannelFromLink(parseYouTubeLink(input));
      if (result.status !== "success") {
        return { ok: false, message: result.message ?? "That creator could not be verified." };
      }
      await followChannel({ ...result.data, followedAt: Date.now(), source: "link" });
      invalidateLibrary();
      return { ok: true, message: `Added ${result.data.title}.` };
    },
    [requirePurchase, invalidateLibrary],
  );

  const wipeAllData = useCallback(async (): Promise<void> => {
    storageGenerationRef.current += 1;
    await Promise.all([prefsWriteRef.current, interestsWriteRef.current, searchesWriteRef.current]);
    await clearAllData();
    await AsyncStorage.multiRemove([PREFS_KEY, INTERESTS_KEY, RECENT_SEARCHES_KEY]);
    await SecureStore.deleteItemAsync(GOOGLE_TOKEN_KEY).catch(() => {});
    prefsRef.current = defaultPrefs;
    interestsRef.current = [];
    recentSearchesRef.current = [];
    setGoogleCredential(null);
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
      setAccent,
      finishOnboarding,
      isPremium,
      subscriptionStatusLoading: customerInfoQuery.isLoading,
      subscriptionStatusError: customerInfoQuery.isError,
      libraryLoading: !ready
        || savedQuery.isLoading
        || resumeQuery.isLoading
        || queuesQuery.isLoading
        || watchLaterQuery.isLoading
        || channelsQuery.isLoading,
      replaceInterests,
      toggleInterest,
      requirePurchase,
      recentSearches,
      addRecentSearch,
      clearRecentSearches,
      googleConfigured: isGoogleConfigured(),
      googleConnected: Boolean(googleCredential && googleCredential.expiresAt > Date.now() && prefs.googleConnectedAt),
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
      recordResume,
      clearVideoResume,
      wipeAllData,
    }),
    [
      ready,
      prefs,
      interests,
      paywallOpen,
      setTheme,
      setAccent,
      finishOnboarding,
      isPremium,
      customerInfoQuery.isLoading,
      customerInfoQuery.isError,
      savedQuery.isLoading,
      resumeQuery.isLoading,
      queuesQuery.isLoading,
      watchLaterQuery.isLoading,
      channelsQuery.isLoading,
      replaceInterests,
      toggleInterest,
      requirePurchase,
      recentSearches,
      addRecentSearch,
      clearRecentSearches,
      googleCredential,
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
      recordResume,
      clearVideoResume,
      wipeAllData,
    ],
  );
});
