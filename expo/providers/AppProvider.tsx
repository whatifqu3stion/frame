import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState } from "react-native";
import type { AccentMode, AddChannelResult, FollowedChannel, InterestId, InterestTopic, ThemeMode, UserPreferences, Video, VideoQueue } from "@/types";
import { DEFAULT_OWNER_PROFILE_ID, type Profile } from "@/models/profile";
import { INTEREST_LIBRARY } from "@/constants/interests";
import { ONBOARDING_INTEREST_MAX, PRODUCT_LIMITS } from "@/constants/productConfig";
import { APP_ENV, GOOGLE_CONFIG, GOOGLE_SCOPES, isGoogleConfigured, isGooglePlatformConfigured } from "@/constants/config";
import { canonicalizeInterestIds, toggleInterestId } from "@/domain/interests";
import { resolveActiveProfileId } from "@/domain/profiles";
import { OwnerAuthorizationSession } from "@/domain/ownerAuthorization";
import { fetchGoogleEmail, revokeGoogleAccess } from "@/services/googleAuth";
import { getGoogleImportAvailability, GOOGLE_SELECTIVE_IMPORT_UNAVAILABLE_MESSAGE } from "@/services/googleImportPolicy";
import { clearProfileGoogleCredential, readProfileGoogleCredential, writeProfileGoogleCredential } from "@/storage/googleCredentialStorage";
import { clearProfileStorage, readProfileStorage, writeProfileStorage } from "@/storage/profileStorage";
import { readActiveProfileId, writeActiveProfileId } from "@/storage/activeProfileStorage";
import {
  getOwnerPinAvailability,
  readOwnerPinRecord,
  removeOwnerPin,
  setOwnerPin,
  verifyOwnerPin,
  type OwnerPinAvailability,
} from "@/storage/ownerPinStorage";
import { sourceLeaseTokenStore } from "@/storage/sourceLeaseTokenStorage";
import { followedSourceRepository } from "@/repositories/followedSourceRepository";
import { profileRepository } from "@/repositories/profileRepository";
import { createSourceLeaseClient } from "@/services/sourceLeaseClient";
import { createSourceLeaseCoordinator, createSourceLeaseStateStore, type SourceLeaseReconciliationReason } from "@/services/sourceLeaseCoordinator";
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
  isVideoSaved as dbIsVideoSaved,
  listQueues,
  listResume,
  listSavedVideos,
  listWatchLater,
  removeWatchLater,
  saveVideo,
  unsaveVideo,
  upsertQueue,
  upsertResume,
} from "@/db/database";

const MAX_RECENT_SEARCHES = 8;
const sourceLeaseClient = createSourceLeaseClient({
  supabaseUrl: APP_ENV === "development" ? process.env.EXPO_PUBLIC_SUPABASE_URL : undefined,
  publishableKey: APP_ENV === "development"
    ? process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    : undefined,
});
const sourceLeaseCoordinator = createSourceLeaseCoordinator({
  followedSources: followedSourceRepository,
  stateStore: createSourceLeaseStateStore(AsyncStorage),
  tokenStore: sourceLeaseTokenStore,
  client: sourceLeaseClient,
});

function queueSourceLeaseReconciliation(reason: SourceLeaseReconciliationReason): void {
  void sourceLeaseCoordinator.reconcile(reason).catch(() => {});
}

export type PremiumAccessState = "checking" | "active" | "inactive" | "unavailable" | "misconfigured";
export type PremiumFeature = "library" | "save" | "watchLater" | "resume" | "interests" | "creators" | "import" | "sessions" | "discovery";

const PREMIUM_FEATURE_MESSAGES: Record<PremiumFeature, string> = {
  library: "Premium unlocks playback from your personal library.",
  save: "Premium lets you save this video to your private library.",
  watchLater: "Premium keeps a calm Watch Later list on this device.",
  resume: "Premium remembers where you stopped across your library.",
  interests: "Premium uses your chosen interests to build quiet Explore collections.",
  creators: "Premium lets you follow trusted creators on your shelf.",
  import: "Premium supports optional Google connection. Selective source import is not available yet.",
  sessions: "Premium lets you create and edit reusable one-to-three-video sessions.",
  discovery: "Premium unlocks interest-led browsing without an endless feed.",
};

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

async function loadPrefs(profileId: string): Promise<UserPreferences> {
  try {
    const raw = await readProfileStorage(AsyncStorage, "preferences", profileId);
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

async function savePrefs(profileId: string, p: UserPreferences): Promise<void> {
  try {
    await writeProfileStorage(AsyncStorage, "preferences", profileId, JSON.stringify(p));
  } catch (err) {
    console.warn("[prefs] save failed", err);
  }
}

async function loadRecentSearches(profileId: string): Promise<string[]> {
  try {
    const raw = await readProfileStorage(AsyncStorage, "recentSearches", profileId);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

async function persistRecentSearches(profileId: string, items: string[]): Promise<void> {
  try {
    await writeProfileStorage(AsyncStorage, "recentSearches", profileId, JSON.stringify(items));
  } catch (err) {
    console.warn("[recent] save failed", err);
  }
}

async function loadInterests(profileId: string): Promise<InterestTopic[]> {
  try {
    const raw = await readProfileStorage(AsyncStorage, "interests", profileId);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const ids = canonicalizeInterestIds(parsed);
    return ids.map((id) => INTEREST_LIBRARY.find((interest) => interest.id === id)).filter((item): item is InterestTopic => Boolean(item));
  } catch {
    return [];
  }
}

async function saveInterests(profileId: string, items: InterestTopic[]): Promise<void> {
  try {
    await writeProfileStorage(AsyncStorage, "interests", profileId, JSON.stringify(items.map((item) => item.id)));
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

type ProfileSnapshot = {
  prefs: UserPreferences;
  interests: InterestTopic[];
  recentSearches: string[];
  googleCredential: GoogleCredential | null;
  rawGoogleCredential: string | null;
  savedVideos: Awaited<ReturnType<typeof listSavedVideos>>;
  resumeList: Awaited<ReturnType<typeof listResume>>;
  sessions: Awaited<ReturnType<typeof listQueues>>;
  watchLater: Awaited<ReturnType<typeof listWatchLater>>;
  followedChannels: FollowedChannel[];
};

async function loadProfileSnapshot(profileId: string): Promise<ProfileSnapshot> {
  const [prefs, interests, recentSearches, rawGoogleCredential, savedVideos, resumeList, sessions, watchLater, followedChannels] = await Promise.all([
    loadPrefs(profileId),
    loadInterests(profileId),
    loadRecentSearches(profileId),
    readProfileGoogleCredential(SecureStore, profileId).catch(() => null),
    listSavedVideos(profileId),
    listResume(profileId),
    listQueues(profileId),
    listWatchLater(profileId),
    followedSourceRepository.listForProfile(profileId),
  ]);
  const parsedCredential = parseGoogleCredential(rawGoogleCredential);
  const googleCredential = parsedCredential && parsedCredential.expiresAt > Date.now() ? parsedCredential : null;
  return {
    prefs: googleCredential ? prefs : { ...prefs, googleEmail: null, googleConnectedAt: null },
    interests,
    recentSearches,
    googleCredential,
    rawGoogleCredential,
    savedVideos,
    resumeList,
    sessions,
    watchLater,
    followedChannels,
  };
}

export const [AppProvider, useApp] = createContextHook(() => {
  const [activeProfileId, setActiveProfileId] = useState<string>(DEFAULT_OWNER_PROFILE_ID);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileSwitching, setProfileSwitching] = useState<boolean>(false);
  const [prefs, setPrefs] = useState<UserPreferences>(defaultPrefs);
  const [interests, setInterests] = useState<InterestTopic[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [ready, setReady] = useState<boolean>(false);
  const [paywallOpen, setPaywallOpen] = useState<boolean>(false);
  const [paywallMessage, setPaywallMessage] = useState<string>(PREMIUM_FEATURE_MESSAGES.library);
  const [googleCredential, setGoogleCredential] = useState<GoogleCredential | null>(null);
  const [ownerPinAvailability, setOwnerPinAvailability] = useState<OwnerPinAvailability>("unavailable");
  const [hasOwnerPin, setHasOwnerPin] = useState<boolean>(false);
  const [ownerPinPromptOpen, setOwnerPinPromptOpen] = useState<boolean>(false);
  const [ownerPinPromptError, setOwnerPinPromptError] = useState<string | null>(null);
  const [ownerPinCooldownUntil, setOwnerPinCooldownUntil] = useState<number>(0);
  const [isOwnerAuthorized, setIsOwnerAuthorized] = useState<boolean>(false);
  const importing = false;
  const activeProfileIdRef = useRef<string>(DEFAULT_OWNER_PROFILE_ID);
  const prefsRef = useRef<UserPreferences>(defaultPrefs);
  const interestsRef = useRef<InterestTopic[]>([]);
  const recentSearchesRef = useRef<string[]>([]);
  const storageGenerationRef = useRef<number>(0);
  const prefsWriteRef = useRef<Promise<void>>(Promise.resolve());
  const interestsWriteRef = useRef<Promise<void>>(Promise.resolve());
  const searchesWriteRef = useRef<Promise<void>>(Promise.resolve());
  const authorizationSessionRef = useRef<OwnerAuthorizationSession>(new OwnerAuthorizationSession());
  const authorizationResolverRef = useRef<((authorized: boolean) => void) | null>(null);
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
    const initialize = async (): Promise<void> => {
      await followedSourceRepository.initialize();
      const [availableProfiles, savedProfileId, pinAvailability] = await Promise.all([
        profileRepository.list(),
        readActiveProfileId(AsyncStorage),
        getOwnerPinAvailability(),
      ]);
      const resolvedProfileId = resolveActiveProfileId(savedProfileId, availableProfiles);
      const [snapshot, pinRecord] = await Promise.all([
        loadProfileSnapshot(resolvedProfileId),
        pinAvailability === "available" ? readOwnerPinRecord().catch(() => null) : Promise.resolve(null),
      ]);
      if (!mounted) return;
      if (savedProfileId !== resolvedProfileId) await writeActiveProfileId(AsyncStorage, resolvedProfileId);
      activeProfileIdRef.current = resolvedProfileId;
      prefsRef.current = snapshot.prefs;
      interestsRef.current = snapshot.interests;
      recentSearchesRef.current = snapshot.recentSearches;
      queryClient.setQueryData(["library", resolvedProfileId, "saved"], snapshot.savedVideos);
      queryClient.setQueryData(["library", resolvedProfileId, "resume"], snapshot.resumeList);
      queryClient.setQueryData(["library", resolvedProfileId, "queues"], snapshot.sessions);
      queryClient.setQueryData(["library", resolvedProfileId, "watchLater"], snapshot.watchLater);
      queryClient.setQueryData(["library", resolvedProfileId, "channels"], snapshot.followedChannels);
      setProfiles(availableProfiles);
      setActiveProfileId(resolvedProfileId);
      setPrefs(snapshot.prefs);
      setInterests(snapshot.interests);
      setRecentSearches(snapshot.recentSearches);
      setGoogleCredential(snapshot.googleCredential);
      setOwnerPinAvailability(pinAvailability);
      setHasOwnerPin(Boolean(pinRecord));
      if (!snapshot.googleCredential && snapshot.rawGoogleCredential) {
        void clearProfileGoogleCredential(SecureStore, resolvedProfileId).catch(() => {});
      }
      setReady(true);
    };
    void initialize().catch((err: unknown) => {
      console.warn("[app] init failed", err instanceof Error ? err.message : "unknown error");
      if (mounted) setReady(true);
    });
    return () => {
      mounted = false;
      authorizationResolverRef.current?.(false);
      authorizationResolverRef.current = null;
    };
  }, [queryClient]);

  const relockOwnerAccess = useCallback((): void => {
    authorizationSessionRef.current.relock();
    setIsOwnerAuthorized(false);
    setOwnerPinPromptOpen(false);
    setOwnerPinPromptError(null);
    authorizationResolverRef.current?.(false);
    authorizationResolverRef.current = null;
  }, []);

  const requestOwnerAuthorization = useCallback(async (): Promise<boolean> => {
    if (authorizationSessionRef.current.isAuthorized()) return true;
    if (!hasOwnerPin || ownerPinAvailability !== "available") {
      authorizationSessionRef.current.authorizeWithoutPin();
      setIsOwnerAuthorized(true);
      return true;
    }
    if (authorizationResolverRef.current) return false;
    setOwnerPinPromptError(null);
    setOwnerPinCooldownUntil(authorizationSessionRef.current.getCooldownUntil());
    setOwnerPinPromptOpen(true);
    return new Promise<boolean>((resolve) => {
      authorizationResolverRef.current = resolve;
    });
  }, [hasOwnerPin, ownerPinAvailability]);

  const cancelOwnerAuthorization = useCallback((): void => {
    setOwnerPinPromptOpen(false);
    setOwnerPinPromptError(null);
    authorizationResolverRef.current?.(false);
    authorizationResolverRef.current = null;
  }, []);

  const submitOwnerAuthorization = useCallback(async (pin: string): Promise<void> => {
    const now = Date.now();
    if (authorizationSessionRef.current.getCooldownUntil() > now) {
      setOwnerPinCooldownUntil(authorizationSessionRef.current.getCooldownUntil());
      setOwnerPinPromptError("Too many attempts. Wait a moment, then try again.");
      return;
    }
    const isCorrect = await verifyOwnerPin(pin).catch(() => false);
    const result = authorizationSessionRef.current.attempt(isCorrect, now);
    if (result.status === "authorized") {
      setIsOwnerAuthorized(true);
      setOwnerPinPromptOpen(false);
      setOwnerPinPromptError(null);
      authorizationResolverRef.current?.(true);
      authorizationResolverRef.current = null;
      return;
    }
    if (result.status === "cooldown") {
      setOwnerPinCooldownUntil(result.retryAt);
      setOwnerPinPromptError("Too many attempts. Wait 30 seconds, then try again.");
      return;
    }
    setOwnerPinPromptError(`That PIN didn’t match. ${result.remainingAttempts} ${result.remainingAttempts === 1 ? "try" : "tries"} left.`);
  }, []);

  const applyProfileSnapshot = useCallback((profileId: string, snapshot: ProfileSnapshot): void => {
    activeProfileIdRef.current = profileId;
    prefsRef.current = snapshot.prefs;
    interestsRef.current = snapshot.interests;
    recentSearchesRef.current = snapshot.recentSearches;
    queryClient.setQueryData(["library", profileId, "saved"], snapshot.savedVideos);
    queryClient.setQueryData(["library", profileId, "resume"], snapshot.resumeList);
    queryClient.setQueryData(["library", profileId, "queues"], snapshot.sessions);
    queryClient.setQueryData(["library", profileId, "watchLater"], snapshot.watchLater);
    queryClient.setQueryData(["library", profileId, "channels"], snapshot.followedChannels);
    setPrefs(snapshot.prefs);
    setInterests(snapshot.interests);
    setRecentSearches(snapshot.recentSearches);
    setGoogleCredential(snapshot.googleCredential);
    setActiveProfileId(profileId);
  }, [queryClient]);

  const switchProfile = useCallback(async (profileId: string): Promise<AddChannelResult> => {
    if (profileId === activeProfileIdRef.current) return { ok: true, message: "Already using this profile." };
    const target = profiles.find((profile) => profile.id === profileId);
    if (!target) return { ok: false, message: "That profile is no longer available." };
    if (target.role === "owner" && activeProfileIdRef.current !== DEFAULT_OWNER_PROFILE_ID) {
      const authorized = await requestOwnerAuthorization();
      if (!authorized) return { ok: false, message: "Profile switch cancelled." };
    }
    setProfileSwitching(true);
    const previousProfileId = activeProfileIdRef.current;
    storageGenerationRef.current += 1;
    try {
      await Promise.all([prefsWriteRef.current, interestsWriteRef.current, searchesWriteRef.current]);
      await queryClient.cancelQueries({ queryKey: ["library", previousProfileId] });
      const snapshot = await loadProfileSnapshot(profileId);
      await writeActiveProfileId(AsyncStorage, profileId);
      applyProfileSnapshot(profileId, snapshot);
      queryClient.removeQueries({ queryKey: ["today"] });
      if (!snapshot.googleCredential && snapshot.rawGoogleCredential) {
        void clearProfileGoogleCredential(SecureStore, profileId).catch(() => {});
      }
      relockOwnerAccess();
      return { ok: true, message: `Switched to ${target.name}.` };
    } catch (error) {
      console.warn("[profiles] switch failed", error instanceof Error ? error.message : "unknown error");
      return { ok: false, message: "Frame couldn’t switch profiles. Try again." };
    } finally {
      setProfileSwitching(false);
    }
  }, [applyProfileSnapshot, profiles, queryClient, relockOwnerAccess, requestOwnerAuthorization]);

  const createStandardProfile = useCallback(async (name: string): Promise<AddChannelResult> => {
    if (!authorizationSessionRef.current.isAuthorized()) return { ok: false, message: "Open protected controls again to continue." };
    let createdProfile: Profile | null = null;
    try {
      createdProfile = await profileRepository.createStandard(name);
      await writeProfileStorage(AsyncStorage, "preferences", createdProfile.id, JSON.stringify({ ...defaultPrefs, hasCompletedOnboarding: true }));
      setProfiles(await profileRepository.list());
      return { ok: true, message: `${createdProfile.name} is ready.` };
    } catch (error) {
      if (createdProfile) await profileRepository.deleteStandard(createdProfile.id).catch(() => {});
      return { ok: false, message: error instanceof Error ? error.message : "Frame couldn’t create that profile." };
    }
  }, []);

  const renameStandardProfile = useCallback(async (profileId: string, name: string): Promise<AddChannelResult> => {
    if (!authorizationSessionRef.current.isAuthorized()) return { ok: false, message: "Open protected controls again to continue." };
    try {
      const updated = await profileRepository.renameStandard(profileId, name);
      setProfiles((current) => current.map((profile) => profile.id === updated.id ? updated : profile));
      return { ok: true, message: "Profile renamed." };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Frame couldn’t rename that profile." };
    }
  }, []);

  const deleteLocalProfile = useCallback(async (profileId: string): Promise<AddChannelResult> => {
    if (!authorizationSessionRef.current.isAuthorized()) return { ok: false, message: "Open protected controls again to continue." };
    const target = profiles.find((profile) => profile.id === profileId);
    if (!target || target.role !== "standard") return { ok: false, message: "Only Standard profiles can be deleted." };
    if (activeProfileIdRef.current === profileId) {
      const switchResult = await switchProfile(DEFAULT_OWNER_PROFILE_ID);
      if (!switchResult.ok) return switchResult;
      authorizationSessionRef.current.authorizeWithoutPin();
      setIsOwnerAuthorized(true);
    }
    try {
      await profileRepository.deleteStandard(profileId);
      await Promise.all([
        clearProfileStorage(AsyncStorage, profileId),
        clearProfileGoogleCredential(SecureStore, profileId).catch(() => {}),
      ]);
      setProfiles(await profileRepository.list());
      queryClient.removeQueries({ queryKey: ["library", profileId] });
      return { ok: true, message: `${target.name} was removed.` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Frame couldn’t delete that profile." };
    }
  }, [profiles, queryClient, switchProfile]);

  const saveOwnerPin = useCallback(async (pin: string): Promise<AddChannelResult> => {
    if (!authorizationSessionRef.current.isAuthorized()) return { ok: false, message: "Open protected controls again to continue." };
    if (ownerPinAvailability !== "available") return { ok: false, message: "Set an Owner PIN in the iPhone or Android app." };
    try {
      await setOwnerPin(pin);
      setHasOwnerPin(true);
      return { ok: true, message: hasOwnerPin ? "Owner PIN changed." : "Owner PIN added." };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Frame couldn’t save the PIN." };
    }
  }, [hasOwnerPin, ownerPinAvailability]);

  const clearOwnerPin = useCallback(async (): Promise<AddChannelResult> => {
    if (!authorizationSessionRef.current.isAuthorized()) return { ok: false, message: "Open protected controls again to continue." };
    if (ownerPinAvailability !== "available") return { ok: false, message: "PIN controls require the iPhone or Android app." };
    try {
      await removeOwnerPin();
      setHasOwnerPin(false);
      return { ok: true, message: "Owner PIN removed." };
    } catch {
      return { ok: false, message: "Frame couldn’t remove the PIN." };
    }
  }, [ownerPinAvailability]);

  useEffect(() => {
    if (!ready) return;
    let previousState = AppState.currentState;
    queueSourceLeaseReconciliation("launch");
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && previousState !== "active") queueSourceLeaseReconciliation("foreground");
      if (nextState !== "active") relockOwnerAccess();
      previousState = nextState;
    });
    return () => subscription.remove();
  }, [ready, relockOwnerAccess]);

  const updatePrefs = useCallback(async (patch: Partial<UserPreferences>): Promise<void> => {
    const next = { ...prefsRef.current, ...patch };
    const generation = storageGenerationRef.current;
    prefsRef.current = next;
    setPrefs(next);
    const write = prefsWriteRef.current.then(async () => {
      if (storageGenerationRef.current === generation) await savePrefs(activeProfileId, next);
    });
    prefsWriteRef.current = write.catch(() => {});
    await write;
  }, [activeProfileId]);

  const setTheme = useCallback((mode: ThemeMode) => updatePrefs({ theme: mode }), [updatePrefs]);
  const setAccent = useCallback((accent: AccentMode) => updatePrefs({ accent }), [updatePrefs]);
  const finishOnboarding = useCallback(() => updatePrefs({ hasCompletedOnboarding: true }), [updatePrefs]);

  const persistInterests = useCallback(async (items: InterestTopic[]): Promise<void> => {
    const generation = storageGenerationRef.current;
    interestsRef.current = items;
    setInterests(items);
    const write = interestsWriteRef.current.then(async () => {
      if (storageGenerationRef.current === generation) await saveInterests(activeProfileId, items);
    });
    interestsWriteRef.current = write.catch(() => {});
    await write;
  }, [activeProfileId]);

  const persistSearches = useCallback(async (items: string[]): Promise<void> => {
    const generation = storageGenerationRef.current;
    recentSearchesRef.current = items;
    setRecentSearches(items);
    const write = searchesWriteRef.current.then(async () => {
      if (storageGenerationRef.current === generation) await persistRecentSearches(activeProfileId, items);
    });
    searchesWriteRef.current = write.catch(() => {});
    await write;
  }, [activeProfileId]);

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
  const premiumAccessState = useMemo<PremiumAccessState>(() => {
    if (!isRevenueCatConfigured) return "misconfigured";
    if (customerInfoQuery.isLoading) return "checking";
    if (customerInfoQuery.isError) return "unavailable";
    return isPremium ? "active" : "inactive";
  }, [customerInfoQuery.isError, customerInfoQuery.isLoading, isPremium]);

  useEffect(() => {
    return subscribeToRevenueCatCustomerInfo((customerInfo) => {
      queryClient.setQueryData(REVENUECAT_CUSTOMER_INFO_KEY, customerInfo);
    });
  }, [queryClient]);

  const refreshPremiumAccess = useCallback(async (): Promise<void> => {
    await customerInfoQuery.refetch();
  }, [customerInfoQuery]);

  const openPremium = useCallback((feature: PremiumFeature = "library"): void => {
    setPaywallMessage(PREMIUM_FEATURE_MESSAGES[feature]);
    setPaywallOpen(true);
  }, []);

  const requirePurchase = useCallback((feature: PremiumFeature = "library"): boolean => {
    if (premiumAccessState === "active") return true;
    if (premiumAccessState === "inactive") {
      openPremium(feature);
      return false;
    }
    if (premiumAccessState === "checking") {
      Alert.alert("Checking Premium", "Frame is still confirming your access. Try again in a moment.");
      return false;
    }
    if (premiumAccessState === "misconfigured") {
      Alert.alert("Premium unavailable", "Premium is not configured for this build yet.");
      return false;
    }
    Alert.alert(
      "Couldn’t verify Premium",
      "Frame couldn’t confirm your access. Check your connection, then try once more.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Try again", onPress: () => { void refreshPremiumAccess(); } },
      ],
    );
    return false;
  }, [openPremium, premiumAccessState, refreshPremiumAccess]);

  const replaceInterests = useCallback(async (items: InterestTopic[]): Promise<void> => {
    await persistInterests(items);
  }, [persistInterests]);

  const toggleInterest = useCallback(
    (id: string): void => {
      const validIds = new Set<InterestId>(INTEREST_LIBRARY.map((item) => item.id));
      const nextIds = toggleInterestId(interestsRef.current.map((item) => item.id), id, validIds, ONBOARDING_INTEREST_MAX);
      const next = nextIds.map((interestId) => INTEREST_LIBRARY.find((item) => item.id === interestId)).filter((item): item is InterestTopic => Boolean(item));
      void persistInterests(next);
    },
    [persistInterests],
  );

  // Library queries
  const savedQuery = useQuery({
    queryKey: ["library", activeProfileId, "saved"],
    queryFn: () => listSavedVideos(activeProfileId),
    enabled: ready,
  });

  const resumeQuery = useQuery({
    queryKey: ["library", activeProfileId, "resume"],
    queryFn: () => listResume(activeProfileId),
    enabled: ready,
  });

  const recordResume = useCallback(async (video: Video, timestampSeconds: number): Promise<void> => {
    if (premiumAccessState !== "active") return;
    await upsertResume(activeProfileId, video, timestampSeconds);
    await queryClient.invalidateQueries({ queryKey: ["library", activeProfileId, "resume"] });
  }, [activeProfileId, premiumAccessState, queryClient]);

  const clearVideoResume = useCallback(async (videoId: string): Promise<void> => {
    await clearResume(activeProfileId, videoId);
    await queryClient.invalidateQueries({ queryKey: ["library", activeProfileId, "resume"] });
  }, [activeProfileId, queryClient]);

  const queuesQuery = useQuery({
    queryKey: ["library", activeProfileId, "queues"],
    queryFn: () => listQueues(activeProfileId),
    enabled: ready,
  });

  const watchLaterQuery = useQuery({
    queryKey: ["library", activeProfileId, "watchLater"],
    queryFn: () => listWatchLater(activeProfileId),
    enabled: ready,
  });

  const channelsQuery = useQuery({
    queryKey: ["library", activeProfileId, "channels"],
    queryFn: () => followedSourceRepository.listForProfile(activeProfileId),
    enabled: ready,
  });

  const invalidateLibrary = useCallback(async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ["library", activeProfileId] });
  }, [activeProfileId, queryClient]);

  const saveMutation = useMutation({
    mutationFn: async (video: Video) => {
      await saveVideo(activeProfileId, video);
    },
    onSuccess: invalidateLibrary,
  });

  const unsaveMutation = useMutation({
    mutationFn: async (videoId: string) => {
      await unsaveVideo(activeProfileId, videoId);
    },
    onSuccess: invalidateLibrary,
  });

  const updateSessionVideos = useCallback(
    async (sessionId: string, videoIds: string[]): Promise<void> => {
      if (!requirePurchase("sessions")) return;
      const existing = queuesQuery.data?.find((session) => session.id === sessionId);
      if (!existing) return;
      const uniqueIds = Array.from(new Set(videoIds)).slice(0, PRODUCT_LIMITS.sessionDraftMaxItems);
      await upsertQueue(activeProfileId, { ...existing, orderedVideoIds: uniqueIds, updatedAt: Date.now() });
      await invalidateLibrary();
    },
    [activeProfileId, queuesQuery.data, invalidateLibrary, requirePurchase],
  );

  const renameSession = useCallback(
    async (id: string, name: string): Promise<void> => {
      if (!requirePurchase("sessions")) return;
      const existing = queuesQuery.data?.find((session) => session.id === id);
      if (!existing) return;
      await upsertQueue(activeProfileId, { ...existing, name: name.trim() || existing.name, updatedAt: Date.now() });
      await invalidateLibrary();
    },
    [activeProfileId, queuesQuery.data, invalidateLibrary, requirePurchase],
  );

  const watchLaterMutation = useMutation({
    mutationFn: async (video: Video) => {
      await addWatchLater(activeProfileId, video);
    },
    onSuccess: invalidateLibrary,
  });

  const removeWatchLaterMutation = useMutation({
    mutationFn: async (videoId: string) => {
      await removeWatchLater(activeProfileId, videoId);
    },
    onSuccess: invalidateLibrary,
  });

  const followMutation = useMutation({
    mutationFn: async (channel: FollowedChannel) => {
      await followedSourceRepository.follow(activeProfileId, channel);
      queueSourceLeaseReconciliation("local_change");
    },
    onSuccess: invalidateLibrary,
  });

  const unfollowMutation = useMutation({
    mutationFn: async (id: string) => {
      await followedSourceRepository.unfollow(activeProfileId, id);
      queueSourceLeaseReconciliation("local_change");
    },
    onSuccess: invalidateLibrary,
  });

  const createSession = useCallback(
    async (name: string, videoIds: string[] = []): Promise<VideoQueue | null> => {
      if (!requirePurchase("sessions")) return null;
      const session: VideoQueue = {
        id: `session_${Math.random().toString(36).slice(2, 10)}`,
        name: name.trim() || "Untitled session",
        orderedVideoIds: Array.from(new Set(videoIds)).slice(0, PRODUCT_LIMITS.sessionDraftMaxItems),
        updatedAt: Date.now(),
      };
      await upsertQueue(activeProfileId, session);
      await invalidateLibrary();
      return session;
    },
    [activeProfileId, invalidateLibrary, requirePurchase],
  );

  const duplicateSession = useCallback(
    async (id: string): Promise<VideoQueue | null> => {
      if (!requirePurchase("sessions")) return null;
      const existing = queuesQuery.data?.find((session) => session.id === id);
      if (!existing) return null;
      return createSession(`${existing.name} copy`, existing.orderedVideoIds);
    },
    [createSession, queuesQuery.data, requirePurchase],
  );

  const removeSession = useCallback(
    async (id: string): Promise<void> => {
      if (!requirePurchase("sessions")) return;
      await deleteQueue(activeProfileId, id);
      await invalidateLibrary();
    },
    [activeProfileId, invalidateLibrary, requirePurchase],
  );

  // Google authorization is separate from following. Round 1 never imports automatically.
  const signInWithGoogle = useCallback(async (): Promise<AddChannelResult> => {
    if (!requirePurchase("import")) return { ok: false, message: "Google connection is part of Frame Premium." };
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
      const expiresInSeconds = result.authentication?.expiresIn ?? 3600;
      const credential = {
        accessToken: token,
        expiresAt: Date.now() + Math.max(60, expiresInSeconds - 60) * 1000,
      };
      await writeProfileGoogleCredential(SecureStore, activeProfileId, JSON.stringify(credential));
      setGoogleCredential(credential);
      await updatePrefs({ googleEmail: emailResult.data, googleConnectedAt: Date.now() });
      return { ok: true, message: GOOGLE_SELECTIVE_IMPORT_UNAVAILABLE_MESSAGE };
    } catch (err) {
      console.warn("[google] sign-in failed", err instanceof Error ? err.message : "unknown error");
      return { ok: false, message: "Sign-in failed. Please try again." };
    }
  }, [activeProfileId, promptGoogle, requirePurchase, updatePrefs]);

  const refreshSubscriptions = useCallback(async (): Promise<AddChannelResult> => {
    if (!requirePurchase("import")) return { ok: false, message: "Google connection is part of Frame Premium." };
    if (!googleCredential || googleCredential.expiresAt <= Date.now()) {
      setGoogleCredential(null);
      await clearProfileGoogleCredential(SecureStore, activeProfileId).catch(() => {});
      await updatePrefs({ googleEmail: null, googleConnectedAt: null });
      return { ok: false, message: "Your Google connection expired. Sign in again to refresh." };
    }
    return getGoogleImportAvailability();
  }, [activeProfileId, googleCredential, requirePurchase, updatePrefs]);

  const signOutGoogle = useCallback(async (): Promise<AddChannelResult> => {
    if (googleCredential) {
      const result = await revokeGoogleAccess(googleCredential.accessToken);
      if (result.status !== "success") return { ok: false, message: result.message ?? "Google couldn't revoke access. Try again." };
    }
    setGoogleCredential(null);
    await clearProfileGoogleCredential(SecureStore, activeProfileId).catch(() => {});
    await updatePrefs({ googleEmail: null, googleConnectedAt: null });
    return { ok: true, message: "Google access was revoked. Imported creators remain on this device." };
  }, [activeProfileId, googleCredential, updatePrefs]);

  const addChannelByLink = useCallback(
    async (input: string): Promise<AddChannelResult> => {
      const result = await resolveChannelFromLink(parseYouTubeLink(input));
      if (result.status !== "success") {
        return { ok: false, message: result.message ?? "That creator could not be verified." };
      }
      await followedSourceRepository.follow(activeProfileId, { ...result.data, followedAt: Date.now(), source: "link" });
      queueSourceLeaseReconciliation("local_change");
      invalidateLibrary();
      return { ok: true, message: `Added ${result.data.title}.` };
    },
    [activeProfileId, invalidateLibrary],
  );

  const wipeAllData = useCallback(async (): Promise<void> => {
    const authorized = await requestOwnerAuthorization();
    if (!authorized) return;
    storageGenerationRef.current += 1;
    await Promise.all([prefsWriteRef.current, interestsWriteRef.current, searchesWriteRef.current]);
    await clearAllData(activeProfileId);
    queueSourceLeaseReconciliation("local_change");
    await clearProfileStorage(AsyncStorage, activeProfileId);
    await clearProfileGoogleCredential(SecureStore, activeProfileId).catch(() => {});
    prefsRef.current = defaultPrefs;
    interestsRef.current = [];
    recentSearchesRef.current = [];
    setGoogleCredential(null);
    setPrefs(defaultPrefs);
    setInterests([]);
    setRecentSearches([]);
    invalidateLibrary();
  }, [activeProfileId, invalidateLibrary, requestOwnerAuthorization]);

  return useMemo(
    () => ({
      ready,
      activeProfileId,
      activeProfile: profiles.find((profile) => profile.id === activeProfileId) ?? profiles.find((profile) => profile.role === "owner") ?? null,
      profiles,
      profileSwitching,
      switchProfile,
      createStandardProfile,
      renameStandardProfile,
      deleteLocalProfile,
      requestOwnerAuthorization,
      relockOwnerAccess,
      ownerPinAvailability,
      hasOwnerPin,
      isOwnerAuthorized,
      ownerPinPromptOpen,
      ownerPinPromptError,
      ownerPinCooldownUntil,
      submitOwnerAuthorization,
      cancelOwnerAuthorization,
      saveOwnerPin,
      clearOwnerPin,
      prefs,
      interests,
      paywallOpen,
      paywallMessage,
      setPaywallOpen,
      openPremium,
      setTheme,
      setAccent,
      finishOnboarding,
      isPremium,
      premiumAccessState,
      subscriptionStatusLoading: customerInfoQuery.isLoading,
      subscriptionStatusError: customerInfoQuery.isError,
      refreshPremiumAccess,
      libraryLoading: !ready
        || savedQuery.isLoading
        || resumeQuery.isLoading
        || queuesQuery.isLoading
        || watchLaterQuery.isLoading
        || channelsQuery.isLoading,
      sourcesLoading: !ready || channelsQuery.isLoading,
      sourcesError: channelsQuery.isError,
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
      sessions: queuesQuery.data ?? [],
      watchLater: watchLaterQuery.data ?? [],
      followedChannels: channelsQuery.data ?? [],
      isVideoSaved: (id: string) => (savedQuery.data ?? []).some((v) => v.id === id),
      isInWatchLater: (id: string) => (watchLaterQuery.data ?? []).some((v) => v.id === id),
      isChannelFollowed: (id: string) => (channelsQuery.data ?? []).some((c) => c.id === id),
      checkIsVideoSaved: (id: string) => dbIsVideoSaved(activeProfileId, id),
      saveVideo: async (v: Video): Promise<void> => {
        if (!requirePurchase("save")) return;
        await saveMutation.mutateAsync(v);
      },
      unsaveVideo: (id: string) => unsaveMutation.mutateAsync(id),
      addToWatchLater: async (v: Video): Promise<void> => {
        if (!requirePurchase("watchLater")) return;
        await watchLaterMutation.mutateAsync(v);
      },
      removeFromWatchLater: (id: string) => removeWatchLaterMutation.mutateAsync(id),
      followChannel: async (c: FollowedChannel): Promise<void> => {
        await followMutation.mutateAsync(c);
      },
      unfollowChannel: (id: string) => unfollowMutation.mutateAsync(id),
      createSession,
      duplicateSession,
      renameSession,
      removeSession,
      updateSessionVideos,
      recordResume,
      clearVideoResume,
      wipeAllData,
    }),
    [
      ready,
      activeProfileId,
      profiles,
      profileSwitching,
      switchProfile,
      createStandardProfile,
      renameStandardProfile,
      deleteLocalProfile,
      requestOwnerAuthorization,
      relockOwnerAccess,
      ownerPinAvailability,
      hasOwnerPin,
      isOwnerAuthorized,
      ownerPinPromptOpen,
      ownerPinPromptError,
      ownerPinCooldownUntil,
      submitOwnerAuthorization,
      cancelOwnerAuthorization,
      saveOwnerPin,
      clearOwnerPin,
      prefs,
      interests,
      paywallOpen,
      paywallMessage,
      openPremium,
      setTheme,
      setAccent,
      finishOnboarding,
      isPremium,
      premiumAccessState,
      customerInfoQuery.isLoading,
      customerInfoQuery.isError,
      refreshPremiumAccess,
      savedQuery.isLoading,
      resumeQuery.isLoading,
      queuesQuery.isLoading,
      watchLaterQuery.isLoading,
      channelsQuery.isLoading,
      channelsQuery.isError,
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
      createSession,
      duplicateSession,
      renameSession,
      removeSession,
      updateSessionVideos,
      recordResume,
      clearVideoResume,
      wipeAllData,
    ],
  );
});
