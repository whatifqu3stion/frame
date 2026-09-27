import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clearLegacyThumbnailCaches } from "@/services/thumbnailRetention";
import { expireVideo, expireChannel, expireResume } from "@/domain/metadataRetention";
import { Alert, AppState } from "react-native";
import type { AccentMode, AddChannelResult, FollowedChannel, GoogleImportResult, GoogleSubscriptionPage, InterestId, InterestTopic, ServiceResult, SourceResolution, ThemeMode, UserPreferences, Video, VideoQueue, SessionDraft } from "@/types";
import { DEFAULT_OWNER_PROFILE_ID, type Profile } from "@/models/profile";
import type { ManagedAllowance } from "@/models/dailyAllowance";
import type { TodaySourceRule } from "@/models/today";
import type { ViewingAllowance, ViewingAllowanceStatus } from "@/models/viewingAllowance";
import type { ManagedPlaybackControls, PlaybackControlStatus } from "@/models/playbackControls";
import type { ManagedApprovalRequest, ManagedContentAccessStatus, ManagedContentMode, ManagedContentOverview } from "@/models/managedContentAccess";
import { INTEREST_LIBRARY } from "@/constants/interests";
import { ONBOARDING_INTEREST_MAX, PRODUCT_LIMITS } from "@/constants/productConfig";
import { canUseFeature, capabilitiesFor, type PremiumFeature } from "@/domain/capabilities";
import { APP_ENV, FEATURE_FLAGS, GOOGLE_CONFIG, GOOGLE_SCOPES, isGoogleConfigured, isGooglePlatformConfigured } from "@/constants/config";
import { canonicalizeInterestIds, toggleInterestId } from "@/domain/interests";
import { resolveActiveProfileId } from "@/domain/profiles";
import { normalizeSessionIds, positionAfterEdit } from "@/domain/sessionFlow";
import { authorizeForCurrentProfile, OwnerAuthorizationSession } from "@/domain/ownerAuthorization";
import { performFullReset } from "@/domain/fullReset";
import { fetchGoogleEmail, fetchSubscriptions, revokeGoogleAccess } from "@/services/googleAuth";
import { planSelectiveGoogleImport } from "@/services/googleImportPolicy";
import { clearProfileGoogleCredential, LEGACY_GOOGLE_TOKEN_KEY, readProfileGoogleCredential, writeProfileGoogleCredential } from "@/storage/googleCredentialStorage";
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
import { installationIdentityStore } from "@/storage/installationIdentityStorage";
import { followedSourceRepository } from "@/repositories/followedSourceRepository";
import { profileRepository } from "@/repositories/profileRepository";
import { viewingAllowanceService } from "@/services/viewingAllowanceService";
import { playbackControlsService } from "@/services/playbackControlsService";
import { managedContentAccessService } from "@/services/managedContentAccessService";
import { createSourceLeaseClient } from "@/services/sourceLeaseClient";
import { createSourceLeaseCoordinator, createSourceLeaseStateStore, type SourceLeaseReconciliationReason } from "@/services/sourceLeaseCoordinator";
import { checkSourceCapacity, confirmSourceFollow } from "@/services/sourceResolutionFlow";
import { resolveSourceFromInput } from "@/services/youtube";
import {
  getRevenueCatCustomerInfo,
  hasPremiumEntitlement,
  isRevenueCatConfigured,
  REVENUECAT_CUSTOMER_INFO_KEY,
  subscribeToRevenueCatCustomerInfo,
} from "@/services/revenueCat";

WebBrowser.maybeCompleteAuthSession();
import {
  expireLocalTodayMetadata,
  clearAllData,
  clearResume,
  deleteQueue,
  isVideoSaved as dbIsVideoSaved,
  listQueues,
  upsertTodaySourceRule,
  readSessionDraft,
  writeSessionDraft,
  deleteSessionDraft,
  setQueuePosition,
  listResume,
  listSavedVideos,
  resetAllFrameDatabaseData,
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

function combinePlaybackStatus(allowance: ViewingAllowanceStatus, controls: PlaybackControlStatus): ViewingAllowanceStatus {
  if (!controls.canPlay) {
    if (controls.kind === "ownerReview") return { kind: "ownerReview", canPlay: false, remainingSeconds: 0, reason: controls.reason };
    return { kind: "restricted", canPlay: false, remainingSeconds: 0, restriction: controls.kind, reason: controls.reason, ...(controls.availableAt ? { availableAt: controls.availableAt } : {}) };
  }
  if (!allowance.canPlay || controls.sessionRemainingSeconds === undefined) return allowance;
  return { ...allowance, sessionRemainingSeconds: controls.sessionRemainingSeconds };
}

export type PremiumAccessState = "checking" | "active" | "inactive" | "unavailable" | "misconfigured";
export type { PremiumFeature } from "@/domain/capabilities";

const PREMIUM_FEATURE_MESSAGES: Record<PremiumFeature, string> = {
  library: "Premium adds more room for trusted sources and profiles.",
  save: "Premium adds more room for trusted sources and profiles.",
  watchLater: "Premium adds more room for trusted sources and profiles.",
  resume: "Premium adds more room for trusted sources and profiles.",
  interests: "Premium adds more room for trusted sources and profiles.",
  creators: "Premium lets you follow more trusted sources.",
  import: "Premium lets you import more of your chosen subscriptions.",
  sessions: "Premium adds more room for trusted sources and profiles.",
  discovery: "Premium adds more room for trusted sources and profiles.",
  additionalProfiles: "Premium unlocks up to three profiles on this device.",
  managedControls: "Premium unlocks Managed profiles and protected controls.",
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
  sessionDraft: SessionDraft | null;
  followedChannels: FollowedChannel[];
};

async function loadProfileSnapshot(profileId: string): Promise<ProfileSnapshot> {
  await expireLocalTodayMetadata();
  const [prefs, interests, recentSearches, rawGoogleCredential, savedVideos, resumeList, sessions, sessionDraft, followedChannels] = await Promise.all([
    loadPrefs(profileId),
    loadInterests(profileId),
    loadRecentSearches(profileId),
    readProfileGoogleCredential(SecureStore, profileId).catch(() => null),
    listSavedVideos(profileId),
    listResume(profileId),
    listQueues(profileId),
    readSessionDraft(profileId),
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
    sessionDraft,
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
  const [ownerPinProtectionError, setOwnerPinProtectionError] = useState<boolean>(false);
  const [ownerPinPromptOpen, setOwnerPinPromptOpen] = useState<boolean>(false);
  const [ownerPinPromptError, setOwnerPinPromptError] = useState<string | null>(null);
  const [ownerPinCooldownUntil, setOwnerPinCooldownUntil] = useState<number>(0);
  const [isOwnerAuthorized, setIsOwnerAuthorized] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);
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
  const customerInfoQuery = useQuery({
    queryKey: REVENUECAT_CUSTOMER_INFO_KEY,
    queryFn: getRevenueCatCustomerInfo,
    enabled: ready && FEATURE_FLAGS.paidAccess && isRevenueCatConfigured,
    staleTime: 1000 * 60 * 5,
  });
  const isPremium = !customerInfoQuery.isError && hasPremiumEntitlement(customerInfoQuery.data);
  const premiumAccessState = useMemo<PremiumAccessState>(() => {
    if (!isRevenueCatConfigured) return "misconfigured";
    if (customerInfoQuery.isLoading) return "checking";
    if (customerInfoQuery.isError) return "unavailable";
    return isPremium ? "active" : "inactive";
  }, [customerInfoQuery.isError, customerInfoQuery.isLoading, isPremium]);
  const capabilities = useMemo(() => capabilitiesFor(isPremium), [isPremium]);
  const draftWritesRef = useRef<Map<string, Promise<void>>>(new Map());
  const switchingRef = useRef<boolean>(false);
  const pinVerificationRef = useRef<boolean>(false);
  const pinPromptGenerationRef = useRef<number>(0);

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
      await clearLegacyThumbnailCaches().catch(() => console.warn("[retention] Thumbnail cleanup pending; retrying on foreground."));
      await followedSourceRepository.initialize();
      const [availableProfiles, savedProfileId, pinAvailability] = await Promise.all([
        profileRepository.list(),
        readActiveProfileId(AsyncStorage),
        getOwnerPinAvailability(),
      ]);
      const resolvedProfileId = resolveActiveProfileId(savedProfileId, availableProfiles);
      let pinReadFailed = false;
      const pinRecordPromise = pinAvailability === "available"
        ? readOwnerPinRecord().catch(() => { pinReadFailed = true; return null; })
        : Promise.resolve(null);
      const [snapshot, pinRecord] = await Promise.all([
        loadProfileSnapshot(resolvedProfileId),
        pinRecordPromise,
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
      queryClient.setQueryData(["library", resolvedProfileId, "draft"], snapshot.sessionDraft);
      queryClient.setQueryData(["library", resolvedProfileId, "channels"], snapshot.followedChannels);
      setProfiles(availableProfiles);
      setActiveProfileId(resolvedProfileId);
      setPrefs(snapshot.prefs);
      setInterests(snapshot.interests);
      setRecentSearches(snapshot.recentSearches);
      setGoogleCredential(snapshot.googleCredential);
      setOwnerPinAvailability(pinAvailability);
      setHasOwnerPin(Boolean(pinRecord));
      setOwnerPinProtectionError(pinReadFailed || pinAvailability === "unavailable");
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
      void viewingAllowanceService.stopPlaying();
      authorizationResolverRef.current?.(false);
      authorizationResolverRef.current = null;
    };
  }, [queryClient]);

  const relockOwnerAccess = useCallback((): void => {
    pinPromptGenerationRef.current += 1;
    authorizationSessionRef.current.relock();
    setIsOwnerAuthorized(false);
    setOwnerPinPromptOpen(false);
    setOwnerPinPromptError(null);
    authorizationResolverRef.current?.(false);
    authorizationResolverRef.current = null;
  }, []);

  const requestOwnerAuthorization = useCallback(async (fresh: boolean = false): Promise<boolean> => {
    if (ownerPinProtectionError) {
      Alert.alert("Protected controls unavailable", "Frame can’t safely read protected PIN storage right now. Restart the app and try again.");
      return false;
    }
    if (!fresh && authorizationSessionRef.current.isAuthorized()) return true;
    if (!hasOwnerPin && ownerPinAvailability !== "unavailable") {
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
  }, [hasOwnerPin, ownerPinAvailability, ownerPinProtectionError]);

  const cancelOwnerAuthorization = useCallback((): void => {
    pinPromptGenerationRef.current += 1;
    setOwnerPinPromptOpen(false);
    setOwnerPinPromptError(null);
    authorizationResolverRef.current?.(false);
    authorizationResolverRef.current = null;
  }, []);

  const submitOwnerAuthorization = useCallback(async (pin: string): Promise<void> => {
    if (!authorizationResolverRef.current || pinVerificationRef.current) return;
    const generation = pinPromptGenerationRef.current;
    const now = Date.now();
    if (authorizationSessionRef.current.getCooldownUntil() > now) {
      setOwnerPinCooldownUntil(authorizationSessionRef.current.getCooldownUntil());
      setOwnerPinPromptError("Too many attempts. Wait a moment, then try again.");
      return;
    }
    let isCorrect: boolean;
    pinVerificationRef.current = true;
    try {
      isCorrect = await verifyOwnerPin(pin);
    } catch {
      pinVerificationRef.current = false;
      if (generation !== pinPromptGenerationRef.current) return;
      setOwnerPinProtectionError(true);
      setOwnerPinPromptOpen(false);
      setOwnerPinPromptError(null);
      authorizationResolverRef.current?.(false);
      authorizationResolverRef.current = null;
      pinVerificationRef.current = false;
      Alert.alert("Protected controls unavailable", "Frame can’t safely read protected PIN storage right now. Restart the app and try again.");
      return;
    }
    pinVerificationRef.current = false;
    if (generation !== pinPromptGenerationRef.current || !authorizationResolverRef.current) return;
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

  // Shared authorization boundary for every sensitive provider action.
  const authorizeProtectedAction = useCallback(async (expectedProfileId: string = activeProfileIdRef.current, fresh: boolean = false): Promise<boolean> => {
    return authorizeForCurrentProfile(expectedProfileId, () => activeProfileIdRef.current, () => switchingRef.current, () => requestOwnerAuthorization(fresh));
  }, [requestOwnerAuthorization]);

  const applyProfileSnapshot = useCallback((profileId: string, snapshot: ProfileSnapshot): void => {
    activeProfileIdRef.current = profileId;
    prefsRef.current = snapshot.prefs;
    interestsRef.current = snapshot.interests;
    recentSearchesRef.current = snapshot.recentSearches;
    queryClient.setQueryData(["library", profileId, "saved"], snapshot.savedVideos);
    queryClient.setQueryData(["library", profileId, "resume"], snapshot.resumeList);
    queryClient.setQueryData(["library", profileId, "queues"], snapshot.sessions);
    queryClient.setQueryData(["library", profileId, "draft"], snapshot.sessionDraft);
    queryClient.setQueryData(["library", profileId, "channels"], snapshot.followedChannels);
    setPrefs(snapshot.prefs);
    setInterests(snapshot.interests);
    setRecentSearches(snapshot.recentSearches);
    setGoogleCredential(snapshot.googleCredential);
    setActiveProfileId(profileId);
  }, [queryClient]);

  const switchProfile = useCallback(async (profileId: string): Promise<AddChannelResult> => {
    if (switchingRef.current) return { ok: false, message: "Profile switch already in progress." };
    if (profileId === activeProfileIdRef.current) return { ok: true, message: "Already using this profile." };
    const target = profiles.find((profile) => profile.id === profileId);
    if (!target) return { ok: false, message: "That profile is no longer available." };
    const fromProfileId = activeProfileIdRef.current;
    if (target.role === "owner" && fromProfileId !== DEFAULT_OWNER_PROFILE_ID) {
      const authorized = await authorizeProtectedAction(fromProfileId);
      if (!authorized) return { ok: false, message: "Profile switch cancelled." };
    }
    if (switchingRef.current || fromProfileId !== activeProfileIdRef.current) return { ok: false, message: "Profile changed. Try again." };
    switchingRef.current = true;
    setProfileSwitching(true);
    const previousProfileId = activeProfileIdRef.current;
    try {
      await Promise.all([prefsWriteRef.current, interestsWriteRef.current, searchesWriteRef.current, draftWritesRef.current.get(previousProfileId)]);
      storageGenerationRef.current += 1;
      await Promise.all([viewingAllowanceService.stopPlaying(), playbackControlsService.stopPlaying()]);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["library", previousProfileId] }),
        queryClient.cancelQueries({ queryKey: ["today", previousProfileId] }),
        queryClient.cancelQueries({ queryKey: ["today-rules", previousProfileId] }),
        queryClient.cancelQueries({ queryKey: ["weekly-picks", previousProfileId] }),
      ]);
      const [snapshot] = await Promise.all([
        loadProfileSnapshot(profileId),
        viewingAllowanceService.getStatus(target),
      ]);
      await writeActiveProfileId(AsyncStorage, profileId);
      applyProfileSnapshot(profileId, snapshot);
      queryClient.removeQueries({ queryKey: ["today", previousProfileId] });
      queryClient.removeQueries({ queryKey: ["today-rules", previousProfileId] });
      if (!snapshot.googleCredential && snapshot.rawGoogleCredential) {
        void clearProfileGoogleCredential(SecureStore, profileId).catch(() => {});
      }
      relockOwnerAccess();
      return { ok: true, message: `Switched to ${target.name}.` };
    } catch (error) {
      console.warn("[profiles] switch failed", error instanceof Error ? error.message : "unknown error");
      return { ok: false, message: "Frame couldn’t switch profiles. Try again." };
    } finally {
      switchingRef.current = false;
      setProfileSwitching(false);
    }
  }, [applyProfileSnapshot, profiles, queryClient, relockOwnerAccess, authorizeProtectedAction]);

  const createStandardProfile = useCallback(async (name: string): Promise<AddChannelResult> => {
    if (profiles.length >= capabilities.profileLimit) return { ok: false, message: `Premium lets you use up to ${PRODUCT_LIMITS.premiumProfilesPerHousehold} profiles.` };
    if (!await authorizeProtectedAction()) return { ok: false, message: "Owner authorization is required." };
    let createdProfile: Profile | null = null;
    try {
      createdProfile = await profileRepository.createStandard(name);
      await writeProfileStorage(AsyncStorage, "preferences", createdProfile.id, JSON.stringify({ ...defaultPrefs, hasCompletedOnboarding: true }));
      setProfiles(await profileRepository.list());
      return { ok: true, message: `${createdProfile.name} is ready.` };
    } catch (error) {
      if (createdProfile) await profileRepository.deleteLocal(createdProfile.id).catch(() => {});
      return { ok: false, message: error instanceof Error ? error.message : "Frame couldn’t create that profile." };
    }
  }, [authorizeProtectedAction, capabilities.profileLimit, profiles.length]);

  const createManagedProfile = useCallback(async (name: string, allowance: ManagedAllowance): Promise<AddChannelResult> => {
    if (!isPremium) return { ok: false, message: "Managed profiles are part of Premium." };
    if (profiles.length >= capabilities.profileLimit) return { ok: false, message: `Frame supports up to ${capabilities.profileLimit} profiles.` };
    if (!await authorizeProtectedAction()) return { ok: false, message: "Owner authorization is required to create a Managed profile." };
    let createdProfile: Profile | null = null;
    try {
      createdProfile = await profileRepository.createManaged(name, allowance);
      await writeProfileStorage(AsyncStorage, "preferences", createdProfile.id, JSON.stringify({ ...defaultPrefs, hasCompletedOnboarding: true }));
      setProfiles(await profileRepository.list());
      return { ok: true, message: `${createdProfile.name} is ready with explicit Daily Frame time.` };
    } catch (error) {
      if (createdProfile) await profileRepository.deleteLocal(createdProfile.id).catch(() => {});
      return { ok: false, message: error instanceof Error ? error.message : "Frame couldn’t create that Managed profile." };
    }
  }, [authorizeProtectedAction, capabilities.profileLimit, isPremium, profiles.length]);

  const renameLocalProfile = useCallback(async (profileId: string, name: string): Promise<AddChannelResult> => {
    if (!await authorizeProtectedAction()) return { ok: false, message: "Owner authorization is required." };
    try {
      const updated = await profileRepository.renameLocal(profileId, name);
      setProfiles((current) => current.map((profile) => profile.id === updated.id ? updated : profile));
      return { ok: true, message: "Profile renamed." };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Frame couldn’t rename that profile." };
    }
  }, [authorizeProtectedAction]);

  const reorderLocalProfile = useCallback(async (profileId: string, direction: "up" | "down"): Promise<AddChannelResult> => {
    if (!await authorizeProtectedAction()) return { ok: false, message: "Owner authorization is required." };
    try {
      setProfiles(await profileRepository.reorderLocal(profileId, direction));
      return { ok: true, message: "Profile order updated." };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Frame couldn’t reorder that profile." };
    }
  }, [authorizeProtectedAction]);

  const deleteLocalProfile = useCallback(async (profileId: string): Promise<AddChannelResult> => {
    if (!await authorizeProtectedAction()) return { ok: false, message: "Owner authorization is required." };
    const target = profiles.find((profile) => profile.id === profileId);
    if (!target || target.role === "owner") return { ok: false, message: "Only Standard or Managed profiles can be deleted." };
    if (activeProfileIdRef.current === profileId) {
      const switchResult = await switchProfile(DEFAULT_OWNER_PROFILE_ID);
      if (!switchResult.ok) return switchResult;
    }
    try {
      await profileRepository.deleteLocal(profileId);
      setProfiles(await profileRepository.list());
      queryClient.removeQueries({ queryKey: ["library", profileId] });
      queryClient.removeQueries({ queryKey: ["weekly-picks", profileId] });
      const cleanupSucceeded = await Promise.all([
        clearProfileStorage(AsyncStorage, profileId),
        clearProfileGoogleCredential(SecureStore, profileId),
      ]).then(() => true).catch(() => false);
      return { ok: true, message: cleanupSucceeded ? `${target.name} was removed.` : `${target.name} was removed. Some inactive auxiliary storage will be retried on cleanup.` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Frame couldn’t delete that profile." };
    }
  }, [profiles, queryClient, switchProfile, authorizeProtectedAction]);

  const setProfileViewingAllowance = useCallback(async (profileId: string, allowance: ViewingAllowance): Promise<AddChannelResult> => {
    if (!await authorizeProtectedAction()) return { ok: false, message: "Owner authorization is required to change a daily viewing allowance." };
    if (!hasOwnerPin) return { ok: false, message: "Create an Owner PIN before enabling or changing viewing allowances." };
    const profile = profiles.find((candidate) => candidate.id === profileId);
    if (!profile) return { ok: false, message: "That profile is no longer available." };
    try {
      const status = await viewingAllowanceService.setAllowance(profile, allowance);
      if ("pendingChange" in status && status.pendingChange) return { ok: true, message: "This Owner relaxation will take effect after the 24-hour waiting period." };
      return { ok: true, message: allowance.mode === "unlimited" ? "Daily viewing is now Unlimited." : `Daily viewing is now ${allowance.minutes} minutes.` };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Frame couldn’t update that allowance." };
    }
  }, [hasOwnerPin, profiles, authorizeProtectedAction]);

  const getManagedPlaybackControls = useCallback(async (profileId: string): Promise<ManagedPlaybackControls> => {
    if (profileId !== activeProfileIdRef.current && !authorizationSessionRef.current.isAuthorized()) throw new Error("Owner authorization is required to view another profile’s controls.");
    const profile = profiles.find((candidate) => candidate.id === profileId);
    if (!profile || profile.role !== "managed") throw new Error("Managed profile unavailable.");
    return playbackControlsService.getControls(profile);
  }, [profiles]);

  const setManagedPlaybackControls = useCallback(async (profileId: string, controls: ManagedPlaybackControls): Promise<AddChannelResult> => {
    if (!await authorizeProtectedAction()) return { ok: false, message: "Owner authorization is required to change Managed playback controls." };
    if (!hasOwnerPin) return { ok: false, message: "Create an Owner PIN before enabling Managed playback controls." };
    const profile = profiles.find((candidate) => candidate.id === profileId);
    if (!profile || profile.role !== "managed") return { ok: false, message: "That Managed profile is no longer available." };
    try {
      await playbackControlsService.setControls(profile, controls);
      return { ok: true, message: "Managed playback controls updated." };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Frame couldn’t update those controls." };
    }
  }, [authorizeProtectedAction, hasOwnerPin, profiles]);

  const getManagedContentOverview = useCallback(async (profileId: string): Promise<ManagedContentOverview> => {
    if (profileId !== activeProfileIdRef.current && !authorizationSessionRef.current.isAuthorized()) throw new Error("Owner authorization is required to view another profile’s content controls.");
    const profile = profiles.find((candidate) => candidate.id === profileId);
    if (!profile || profile.role !== "managed") throw new Error("Managed profile unavailable.");
    return managedContentAccessService.getOverview(profile);
  }, [profiles]);

  const setManagedContentMode = useCallback(async (profileId: string, mode: ManagedContentMode): Promise<AddChannelResult> => {
    if (!await authorizeProtectedAction()) return { ok: false, message: "Owner authorization is required to change Managed content access." };
    if (!hasOwnerPin) return { ok: false, message: "Create an Owner PIN before changing Managed content access." };
    const profile = profiles.find((candidate) => candidate.id === profileId);
    if (!profile || profile.role !== "managed") return { ok: false, message: "That Managed profile is no longer available." };
    try {
      await managedContentAccessService.setMode(profile, mode);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["managed-content", profileId] }),
        queryClient.invalidateQueries({ queryKey: ["today", profileId] }),
      ]);
      return { ok: true, message: mode === "selectedVideos" ? "Only Owner-selected videos are available." : "Only videos from Owner-approved sources are available." };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Frame couldn’t update content access." };
    }
  }, [authorizeProtectedAction, hasOwnerPin, profiles, queryClient]);

  const getManagedContentAccess = useCallback(async (video: Video): Promise<ManagedContentAccessStatus> => {
    const profile = profiles.find((candidate) => candidate.id === activeProfileIdRef.current);
    if (!profile) return { kind: "ownerReview", canPlay: false, reason: "This profile needs Owner review before playback can continue." };
    try {
      return await managedContentAccessService.getAccess(profile, video);
    } catch {
      return { kind: "ownerReview", canPlay: false, reason: "Managed content access could not be verified. Ask the Owner to review it." };
    }
  }, [profiles]);

  const requestManagedContentAccess = useCallback(async (video: Video): Promise<AddChannelResult> => {
    const profile = profiles.find((candidate) => candidate.id === activeProfileIdRef.current);
    if (!profile || profile.role !== "managed") return { ok: false, message: "This profile does not use approval requests." };
    try {
      const request = await managedContentAccessService.request(profile, video);
      await queryClient.invalidateQueries({ queryKey: ["managed-content", profile.id] });
      return { ok: true, message: request.kind === "video" ? "Video request sent to the Owner on this device." : "Source request sent to the Owner on this device." };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Frame couldn’t save that request." };
    }
  }, [profiles, queryClient]);

  const approveManagedContent = useCallback(async (video: Video): Promise<AddChannelResult> => {
    const profileId = activeProfileIdRef.current;
    if (!await authorizeProtectedAction(profileId)) return { ok: false, message: "Owner approval cancelled." };
    if (!hasOwnerPin) return { ok: false, message: "Create an Owner PIN before approving Managed content." };
    const profile = profiles.find((candidate) => candidate.id === profileId);
    if (!profile || profile.role !== "managed") return { ok: false, message: "Managed profile unavailable." };
    try {
      const overview = await managedContentAccessService.getOverview(profile);
      if (overview.policy.mode === "approvedSources") {
        const capacity = await checkSourceCapacity(profile.id, video.channelId, followedSourceRepository, capabilities.sourceLimit);
        if (!capacity.allowed) return { ok: false, message: capacity.message ?? "Source limit reached." };
      }
      const approvedSource = await managedContentAccessService.approveVideo(profile, video);
      if (approvedSource) {
        await followedSourceRepository.follow(profile.id, approvedSource);
        queueSourceLeaseReconciliation("local_change");
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["managed-content", profile.id] }),
        queryClient.invalidateQueries({ queryKey: ["library", profile.id] }),
        queryClient.invalidateQueries({ queryKey: ["today", profile.id] }),
      ]);
      return { ok: true, message: approvedSource ? "Source approved for this Managed profile." : "Video approved for this Managed profile." };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Frame couldn’t approve that content." };
    }
  }, [authorizeProtectedAction, capabilities.sourceLimit, hasOwnerPin, profiles, queryClient]);

  const reviewManagedApprovalRequest = useCallback(async (profileId: string, request: ManagedApprovalRequest, decision: "approve" | "deny"): Promise<AddChannelResult> => {
    if (!await authorizeProtectedAction()) return { ok: false, message: "Owner authorization is required." };
    if (!hasOwnerPin) return { ok: false, message: "Create an Owner PIN before reviewing Managed content requests." };
    const profile = profiles.find((candidate) => candidate.id === profileId);
    if (!profile || profile.role !== "managed") return { ok: false, message: "Managed profile unavailable." };
    try {
      if (decision === "approve") {
        if (request.kind === "source") {
          const capacity = await checkSourceCapacity(profile.id, request.sourceId, followedSourceRepository, capabilities.sourceLimit);
          if (!capacity.allowed) return { ok: false, message: capacity.message ?? "Source limit reached." };
        }
        const approvedSource = await managedContentAccessService.approveRequest(profile, request);
        if (approvedSource) {
          await followedSourceRepository.follow(profile.id, approvedSource);
          queueSourceLeaseReconciliation("local_change");
        }
      } else {
        await managedContentAccessService.rejectRequest(profile, request);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["managed-content", profile.id] }),
        queryClient.invalidateQueries({ queryKey: ["library", profile.id] }),
        queryClient.invalidateQueries({ queryKey: ["today", profile.id] }),
      ]);
      return { ok: true, message: decision === "approve" ? "Request approved." : "Request removed." };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Frame couldn’t review that request." };
    }
  }, [authorizeProtectedAction, capabilities.sourceLimit, hasOwnerPin, profiles, queryClient]);

  const revokeManagedContent = useCallback(async (profileId: string, kind: "video" | "source", targetId: string): Promise<AddChannelResult> => {
    if (!await authorizeProtectedAction()) return { ok: false, message: "Owner authorization is required." };
    if (!hasOwnerPin) return { ok: false, message: "Create an Owner PIN before changing Managed content approvals." };
    const profile = profiles.find((candidate) => candidate.id === profileId);
    if (!profile || profile.role !== "managed") return { ok: false, message: "Managed profile unavailable." };
    try {
      if (kind === "video") await managedContentAccessService.revokeVideo(profile, targetId);
      else await managedContentAccessService.revokeSource(profile, targetId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["managed-content", profile.id] }),
        queryClient.invalidateQueries({ queryKey: ["today", profile.id] }),
      ]);
      return { ok: true, message: kind === "video" ? "Video removed from Selected Videos." : "Source approval removed." };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Frame couldn’t remove that approval." };
    }
  }, [authorizeProtectedAction, hasOwnerPin, profiles, queryClient]);

  const cancelPendingOwnerAllowance = useCallback(async (): Promise<AddChannelResult> => {
    if (!await authorizeProtectedAction()) return { ok: false, message: "Owner authorization is required." };
    const owner = profiles.find((candidate) => candidate.role === "owner");
    if (!owner) return { ok: false, message: "The Owner profile is unavailable." };
    try {
      await viewingAllowanceService.cancelPendingOwnerChange(owner);
      return { ok: true, message: "Pending Owner allowance change cancelled." };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Frame couldn’t cancel that change." };
    }
  }, [profiles, authorizeProtectedAction]);

  const getPlaybackAllowance = useCallback(async (profileId?: string): Promise<ViewingAllowanceStatus> => {
    if (profileId && profileId !== activeProfileIdRef.current && !authorizationSessionRef.current.isAuthorized()) return { kind: "ownerReview", canPlay: false, remainingSeconds: 0, reason: "Owner authorization is required to view another profile’s allowance." };
    const profile = profiles.find((candidate) => candidate.id === (profileId ?? activeProfileIdRef.current));
    if (!profile) return { kind: "ownerReview", canPlay: false, remainingSeconds: 0, reason: "This profile needs Owner review before playback can continue." };
    const controls = await playbackControlsService.getStatus(profile);
    if (!controls.canPlay) return combinePlaybackStatus({ kind: "unlimited", canPlay: true }, controls);
    return combinePlaybackStatus(await viewingAllowanceService.getStatus(profile), controls);
  }, [profiles]);

  const beginAllowancePlayback = useCallback(async (): Promise<ViewingAllowanceStatus> => {
    const profile = profiles.find((candidate) => candidate.id === activeProfileIdRef.current);
    if (!profile) return { kind: "ownerReview", canPlay: false, remainingSeconds: 0, reason: "This profile needs Owner review before playback can continue." };
    const controls = await playbackControlsService.beginPlaying(profile);
    if (!controls.canPlay) return combinePlaybackStatus({ kind: "unlimited", canPlay: true }, controls);
    const allowance = await viewingAllowanceService.beginPlaying(profile);
    if (!allowance.canPlay) await playbackControlsService.stopPlaying();
    return combinePlaybackStatus(allowance, controls);
  }, [profiles]);

  const checkpointAllowancePlayback = useCallback(async (): Promise<ViewingAllowanceStatus> => {
    const controls = await playbackControlsService.checkpoint();
    if (!controls.canPlay) {
      await viewingAllowanceService.stopPlaying();
      return combinePlaybackStatus({ kind: "unlimited", canPlay: true }, controls);
    }
    const allowance = await viewingAllowanceService.checkpoint();
    if (!allowance.canPlay) await playbackControlsService.stopPlaying();
    return combinePlaybackStatus(allowance, controls);
  }, []);
  const stopAllowancePlayback = useCallback(async (): Promise<ViewingAllowanceStatus | null> => {
    const [allowance, controls] = await Promise.all([viewingAllowanceService.stopPlaying(), playbackControlsService.stopPlaying()]);
    if (!allowance && !controls) return null;
    return combinePlaybackStatus(allowance ?? { kind: "unlimited", canPlay: true }, controls ?? { kind: "available", canPlay: true });
  }, []);

  const verifyCurrentPinForChange = useCallback(async (pin: string): Promise<boolean> => {
    if (!pin || authorizationSessionRef.current.getCooldownUntil() > Date.now() || pinVerificationRef.current) return false;
    pinVerificationRef.current = true;
    try {
      return await authorizationSessionRef.current.verifyCurrentPin(pin, verifyOwnerPin);
    } finally {
      pinVerificationRef.current = false;
    }
  }, []);

  const changeSourceRule = useCallback(async (rule: TodaySourceRule): Promise<boolean> => {
    if (!await authorizeProtectedAction(rule.profileId)) return false;
    await upsertTodaySourceRule(rule);
    await queryClient.invalidateQueries({ queryKey: ["today-rules", rule.profileId] });
    await queryClient.invalidateQueries({ queryKey: ["today", rule.profileId] });
    return true;
  }, [authorizeProtectedAction, queryClient]);

  const saveOwnerPin = useCallback(async (pin: string, currentPin?: string): Promise<AddChannelResult> => {
    if (!await authorizeProtectedAction()) return { ok: false, message: "Owner authorization is required." };
    if (hasOwnerPin && !await verifyCurrentPinForChange(currentPin ?? "")) return { ok: false, message: "Current PIN did not match, or too many attempts. Try again shortly." };
    if (ownerPinAvailability !== "available") return { ok: false, message: "Set an Owner PIN in the iPhone or Android app." };
    try {
      await setOwnerPin(pin);
      relockOwnerAccess();
      setHasOwnerPin(true);
      setOwnerPinProtectionError(false);
      return { ok: true, message: hasOwnerPin ? "Owner PIN changed." : "Owner PIN added." };
    } catch (error) {
      return { ok: false, message: "Frame couldn’t save the PIN. Check the new PIN and try again." };
    }
  }, [hasOwnerPin, ownerPinAvailability, authorizeProtectedAction, verifyCurrentPinForChange, relockOwnerAccess]);

  const clearOwnerPin = useCallback(async (currentPin: string): Promise<AddChannelResult> => {
    if (!await authorizeProtectedAction()) return { ok: false, message: "Owner authorization is required." };
    if (!hasOwnerPin || !await verifyCurrentPinForChange(currentPin)) return { ok: false, message: "Current PIN did not match, or too many attempts. Try again shortly." };
    if (ownerPinAvailability !== "available") return { ok: false, message: "PIN controls require the iPhone or Android app." };
    try {
      await removeOwnerPin();
      relockOwnerAccess();
      setHasOwnerPin(false);
      setOwnerPinProtectionError(false);
      return { ok: true, message: "Owner PIN removed." };
    } catch {
      return { ok: false, message: "Frame couldn’t remove the PIN." };
    }
  }, [ownerPinAvailability, hasOwnerPin, authorizeProtectedAction, verifyCurrentPinForChange, relockOwnerAccess]);

  useEffect(() => {
    if (!ready) return;
    let previousState = AppState.currentState;
    queueSourceLeaseReconciliation("launch");
    const refreshRetention = (): void => {
      const now = Date.now();
      queryClient.setQueriesData<Video[]>({ queryKey: ["library"], predicate: (query) => query.queryKey[2] === "saved" }, (items) => items?.map((item) => expireVideo(item, now)));
      queryClient.setQueriesData<FollowedChannel[]>({ queryKey: ["library"], predicate: (query) => query.queryKey[2] === "channels" }, (items) => items?.map((item) => expireChannel(item, now)));
      queryClient.setQueriesData<Awaited<ReturnType<typeof listResume>>>({ queryKey: ["library"], predicate: (query) => query.queryKey[2] === "resume" }, (items) => items?.map((item) => expireResume(item, now)));
      void expireLocalTodayMetadata().then(() => queryClient.invalidateQueries({ queryKey: ["library"] })).catch(() => console.warn("[retention] Local metadata cleanup will retry on the next read."));
    };
    const timer = setInterval(() => { if (AppState.currentState === "active") refreshRetention(); }, 60_000);
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && previousState !== "active") {
        queueSourceLeaseReconciliation("foreground");
        if (FEATURE_FLAGS.paidAccess && isRevenueCatConfigured) void queryClient.invalidateQueries({ queryKey: REVENUECAT_CUSTOMER_INFO_KEY });
        refreshRetention();
        void clearLegacyThumbnailCaches().catch(() => console.warn("[retention] Thumbnail cleanup pending; retrying on foreground."));
      }
      if (nextState !== "active") {
        void viewingAllowanceService.stopPlaying();
        relockOwnerAccess();
      }
      previousState = nextState;
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [ready, relockOwnerAccess, queryClient]);

  const updatePrefs = useCallback(async (patch: Partial<UserPreferences>): Promise<void> => {
    if (switchingRef.current || activeProfileId !== activeProfileIdRef.current) return;
    const profileId = activeProfileId;
    const next = { ...prefsRef.current, ...patch };
    const generation = storageGenerationRef.current;
    prefsRef.current = next;
    setPrefs(next);
    const write = prefsWriteRef.current.then(async () => {
      if (storageGenerationRef.current === generation) await savePrefs(profileId, next);
    });
    prefsWriteRef.current = write.catch(() => {});
    await write;
  }, [activeProfileId]);

  const setTheme = useCallback((mode: ThemeMode) => updatePrefs({ theme: mode }), [updatePrefs]);
  const setAccent = useCallback((accent: AccentMode) => updatePrefs({ accent }), [updatePrefs]);
  const finishOnboarding = useCallback(() => updatePrefs({ hasCompletedOnboarding: true }), [updatePrefs]);

  const persistInterests = useCallback(async (items: InterestTopic[]): Promise<void> => {
    if (switchingRef.current || activeProfileId !== activeProfileIdRef.current) return;
    const profileId = activeProfileId;
    const generation = storageGenerationRef.current;
    interestsRef.current = items;
    setInterests(items);
    const write = interestsWriteRef.current.then(async () => {
      if (storageGenerationRef.current === generation) await saveInterests(profileId, items);
    });
    interestsWriteRef.current = write.catch(() => {});
    await write;
  }, [activeProfileId]);

  const persistSearches = useCallback(async (items: string[]): Promise<void> => {
    if (switchingRef.current || activeProfileId !== activeProfileIdRef.current) return;
    const profileId = activeProfileId;
    const generation = storageGenerationRef.current;
    recentSearchesRef.current = items;
    setRecentSearches(items);
    const write = searchesWriteRef.current.then(async () => {
      if (storageGenerationRef.current === generation) await persistRecentSearches(profileId, items);
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

  useEffect(() => {
    if (!FEATURE_FLAGS.paidAccess) return;
    return subscribeToRevenueCatCustomerInfo((customerInfo) => {
      queryClient.setQueryData(REVENUECAT_CUSTOMER_INFO_KEY, customerInfo);
    });
  }, [queryClient]);

  const refreshPremiumAccess = useCallback(async (): Promise<void> => {
    if (!FEATURE_FLAGS.paidAccess) return;
    await customerInfoQuery.refetch();
  }, [customerInfoQuery]);

  const openPremium = useCallback((feature: PremiumFeature = "library"): void => {
    if (!FEATURE_FLAGS.paidAccess) return;
    setPaywallMessage(PREMIUM_FEATURE_MESSAGES[feature]);
    setPaywallOpen(true);
  }, []);

  const requirePurchase = useCallback((feature: PremiumFeature = "library"): boolean => {
    if (!FEATURE_FLAGS.paidAccess || canUseFeature(feature, isPremium)) return true;
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
  }, [isPremium, openPremium, premiumAccessState, refreshPremiumAccess]);

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
    await upsertResume(activeProfileId, video, timestampSeconds);
    await queryClient.invalidateQueries({ queryKey: ["library", activeProfileId, "resume"] });
  }, [activeProfileId, queryClient]);

  const clearVideoResume = useCallback(async (videoId: string): Promise<void> => {
    await clearResume(activeProfileId, videoId);
    await queryClient.invalidateQueries({ queryKey: ["library", activeProfileId, "resume"] });
  }, [activeProfileId, queryClient]);

  const queuesQuery = useQuery({
    queryKey: ["library", activeProfileId, "queues"],
    queryFn: () => listQueues(activeProfileId),
    enabled: ready,
  });

  const draftQuery = useQuery({
    queryKey: ["library", activeProfileId, "draft"],
    queryFn: () => readSessionDraft(activeProfileId),
    enabled: ready,
  });

  const saveSessionDraft = useCallback((draft: Pick<SessionDraft, "name" | "orderedVideoIds">): Promise<void> => {
    const profileId = activeProfileId;
    if (switchingRef.current || profileId !== activeProfileIdRef.current) return Promise.resolve();
    const next: SessionDraft = { name: draft.name.slice(0, 64), orderedVideoIds: normalizeSessionIds(draft.orderedVideoIds), updatedAt: Date.now() };
    const previous = draftWritesRef.current.get(profileId) ?? Promise.resolve();
    const write = previous.catch(() => {}).then(async () => {
      await writeSessionDraft(profileId, next);
      queryClient.setQueryData(["library", profileId, "draft"], next);
    });
    draftWritesRef.current.set(profileId, write);
    return write;
  }, [activeProfileId, queryClient]);

  const clearSessionDraft = useCallback((): Promise<void> => {
    const profileId = activeProfileId;
    if (switchingRef.current || profileId !== activeProfileIdRef.current) return Promise.resolve();
    const previous = draftWritesRef.current.get(profileId) ?? Promise.resolve();
    const write = previous.catch(() => {}).then(async () => {
      await deleteSessionDraft(profileId);
      queryClient.setQueryData(["library", profileId, "draft"], null);
    });
    draftWritesRef.current.set(profileId, write);
    return write;
  }, [activeProfileId, queryClient]);

  const channelsQuery = useQuery({
    queryKey: ["library", activeProfileId, "channels"],
    queryFn: () => followedSourceRepository.listForProfile(activeProfileId),
    enabled: ready,
  });

  const invalidateLibrary = useCallback(async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["library", activeProfileId] }),
      queryClient.invalidateQueries({ queryKey: ["managed-content", activeProfileId] }),
      queryClient.invalidateQueries({ queryKey: ["today", activeProfileId] }),
    ]);
  }, [activeProfileId, queryClient]);

  const saveMutation = useMutation({
    mutationFn: async ({ profileId, video }: { profileId: string; video: Video }) => {
      if (switchingRef.current || profileId !== activeProfileIdRef.current) throw new Error("Profile changed. Try again.");
      await saveVideo(profileId, video);
    },
    onSuccess: async (_, { profileId }) => { await queryClient.invalidateQueries({ queryKey: ["library", profileId] }); await queryClient.invalidateQueries({ queryKey: ["managed-content", profileId] }); await queryClient.invalidateQueries({ queryKey: ["today", profileId] }); },
  });

  const unsaveMutation = useMutation({
    mutationFn: async ({ profileId, videoId }: { profileId: string; videoId: string }) => {
      if (switchingRef.current || profileId !== activeProfileIdRef.current) throw new Error("Profile changed. Try again.");
      await unsaveVideo(profileId, videoId);
    },
    onSuccess: async (_, { profileId }) => { await queryClient.invalidateQueries({ queryKey: ["library", profileId] }); await queryClient.invalidateQueries({ queryKey: ["managed-content", profileId] }); await queryClient.invalidateQueries({ queryKey: ["today", profileId] }); },
  });

  const updateSessionVideos = useCallback(
    async (sessionId: string, videoIds: string[]): Promise<void> => {
      if (!requirePurchase("sessions")) return;
      const existing = (await listQueues(activeProfileId)).find((session) => session.id === sessionId);
      if (!existing) throw new Error("Session no longer available.");
      const uniqueIds = normalizeSessionIds(videoIds);
      await upsertQueue(activeProfileId, { ...existing, orderedVideoIds: uniqueIds, currentIndex: positionAfterEdit(existing, uniqueIds), updatedAt: Date.now() });
      await invalidateLibrary();
    },
    [activeProfileId, queuesQuery.data, invalidateLibrary, requirePurchase],
  );

  const renameSession = useCallback(
    async (id: string, name: string): Promise<void> => {
      if (!requirePurchase("sessions")) return;
      const existing = (await listQueues(activeProfileId)).find((session) => session.id === id);
      if (!existing) throw new Error("Session no longer available.");
      await upsertQueue(activeProfileId, { ...existing, name: name.trim() || existing.name, updatedAt: Date.now() });
      await invalidateLibrary();
    },
    [activeProfileId, queuesQuery.data, invalidateLibrary, requirePurchase],
  );

  const followMutation = useMutation({
    mutationFn: async ({ profileId, channel }: { profileId: string; channel: FollowedChannel }) => {
      if (!await authorizeProtectedAction(profileId)) throw new Error("Source change cancelled.");
      const profile = profiles.find((candidate) => candidate.id === profileId);
      const overview = profile?.role === "managed" ? await managedContentAccessService.getOverview(profile) : null;
      if (overview?.policy.mode === "approvedSources" && !hasOwnerPin) throw new Error("Create an Owner PIN before approving sources for a Managed profile.");
      const capacity = await checkSourceCapacity(profileId, channel.id, followedSourceRepository, capabilities.sourceLimit);
      if (!capacity.allowed) throw new Error(capacity.message);
      await followedSourceRepository.follow(profileId, channel);
      if (profile?.role === "managed") {
        if (overview?.policy.mode === "approvedSources") await managedContentAccessService.approveSource(profile, channel);
      }
      queueSourceLeaseReconciliation("local_change");
    },
    onSuccess: async (_, { profileId }) => { await queryClient.invalidateQueries({ queryKey: ["library", profileId] }); await queryClient.invalidateQueries({ queryKey: ["managed-content", profileId] }); await queryClient.invalidateQueries({ queryKey: ["today", profileId] }); },
  });

  const unfollowMutation = useMutation({
    mutationFn: async ({ profileId, id }: { profileId: string; id: string }) => {
      if (!await authorizeProtectedAction(profileId)) throw new Error("Source change cancelled.");
      await followedSourceRepository.unfollow(profileId, id);
      const profile = profiles.find((candidate) => candidate.id === profileId);
      if (profile?.role === "managed") await managedContentAccessService.revokeSource(profile, id);
      queueSourceLeaseReconciliation("local_change");
    },
    onSuccess: async (_, { profileId }) => { await queryClient.invalidateQueries({ queryKey: ["library", profileId] }); await queryClient.invalidateQueries({ queryKey: ["managed-content", profileId] }); await queryClient.invalidateQueries({ queryKey: ["today", profileId] }); },
  });

  const createSession = useCallback(
    async (name: string, videoIds: string[] = []): Promise<VideoQueue | null> => {
      if (!requirePurchase("sessions")) return null;
      const session: VideoQueue = {
        id: `session_${Math.random().toString(36).slice(2, 10)}`,
        name: name.trim() || "Untitled session",
        orderedVideoIds: normalizeSessionIds(videoIds),
        currentIndex: 0,
        updatedAt: Date.now(),
      };
      await upsertQueue(activeProfileId, session);
      await invalidateLibrary();
      return session;
    },
    [activeProfileId, invalidateLibrary, requirePurchase],
  );

  const updateSessionPosition = useCallback(async (sessionId: string, videoId: string, atIndex: number, nextIndex: number): Promise<boolean> => {
    const profileId = activeProfileId;
    if (profileId !== activeProfileIdRef.current) return false;
    const changed = await setQueuePosition(profileId, sessionId, videoId, atIndex, nextIndex);
    if (changed && profileId === activeProfileIdRef.current) await queryClient.invalidateQueries({ queryKey: ["library", profileId, "queues"] });
    return changed;
  }, [activeProfileId, queryClient]);

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

  // Google authorization is separate from following. Import always requires explicit selection.
  const signInWithGoogle = useCallback(async (): Promise<AddChannelResult> => {
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
      return { ok: true, message: "Google connected. Choose the subscriptions you want in Frame." };
    } catch (err) {
      console.warn("[google] sign-in failed", err instanceof Error ? err.message : "unknown error");
      return { ok: false, message: "Sign-in failed. Please try again." };
    }
  }, [activeProfileId, promptGoogle, updatePrefs]);

  const loadGoogleSubscriptions = useCallback(async (pageToken?: string): Promise<ServiceResult<GoogleSubscriptionPage>> => {
    if (!googleCredential || googleCredential.expiresAt <= Date.now()) {
      setGoogleCredential(null);
      await clearProfileGoogleCredential(SecureStore, activeProfileId).catch(() => {});
      await updatePrefs({ googleEmail: null, googleConnectedAt: null });
      return { status: "unauthorized", message: "Your Google connection expired. Sign in again to continue." };
    }
    const result = await fetchSubscriptions(googleCredential.accessToken, pageToken);
    if (result.status === "unauthorized") {
      setGoogleCredential(null);
      await clearProfileGoogleCredential(SecureStore, activeProfileId).catch(() => {});
      await updatePrefs({ googleEmail: null, googleConnectedAt: null });
    }
    return result;
  }, [activeProfileId, googleCredential, updatePrefs]);

  const importGoogleSubscriptions = useCallback(async (selected: FollowedChannel[]): Promise<GoogleImportResult> => {
    if (selected.length === 0) return { ok: false, importedCount: 0, message: "Choose at least one subscription." };
    const profileId = activeProfileId;
    if (!await authorizeProtectedAction(profileId)) return { ok: false, importedCount: 0, message: "Source change cancelled." };
    if (profileId !== activeProfileIdRef.current) return { ok: false, importedCount: 0, message: "The active profile changed. Review your choices and try again." };
    const profile = profiles.find((candidate) => candidate.id === profileId);
    const managedOverview = profile?.role === "managed" ? await managedContentAccessService.getOverview(profile) : null;
    if (managedOverview?.policy.mode === "approvedSources" && !hasOwnerPin) return { ok: false, importedCount: 0, message: "Create an Owner PIN before approving sources for a Managed profile." };
    setImporting(true);
    try {
      const existing = await followedSourceRepository.listForProfile(profileId);
      const plan = planSelectiveGoogleImport(selected, new Set(existing.map((source) => source.id)), capabilities.sourceLimit);
      if (plan.overflowCount > 0) {
        return { ok: false, importedCount: 0, message: `This profile can follow up to ${capabilities.sourceLimit} sources. Choose fewer subscriptions.` };
      }
      if (plan.channels.length === 0) {
        return { ok: true, importedCount: 0, message: plan.alreadyFollowedCount > 0 ? "Those subscriptions are already followed in Frame." : "No new subscriptions were selected." };
      }
      const followedAt = Date.now();
      const channels = plan.channels.map((channel) => ({ ...channel, followedAt, source: "google" as const }));
      await followedSourceRepository.followMany(profileId, channels);
      if (profile?.role === "managed") {
        if (managedOverview?.policy.mode === "approvedSources") {
          for (const channel of channels) await managedContentAccessService.approveSource(profile, channel);
        }
      }
      queueSourceLeaseReconciliation("local_change");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["library", profileId] }),
        queryClient.invalidateQueries({ queryKey: ["today", profileId] }),
      ]);
      const count = plan.channels.length;
      return { ok: true, importedCount: count, message: `${count} ${count === 1 ? "source" : "sources"} added to Frame.` };
    } catch (error) {
      console.warn("[google] import failed", error instanceof Error ? error.message : "unknown error");
      return { ok: false, importedCount: 0, message: "Frame couldn't add those sources. Nothing was removed; try again." };
    } finally {
      setImporting(false);
    }
  }, [activeProfileId, authorizeProtectedAction, capabilities.sourceLimit, hasOwnerPin, profiles, queryClient]);

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

  const resolveSourceInput = useCallback(
    async (input: string): Promise<ServiceResult<SourceResolution>> => resolveSourceFromInput(input),
    [],
  );

  const confirmSource = useCallback(
    async (resolution: SourceResolution): Promise<AddChannelResult> => {
      if (!await authorizeProtectedAction(activeProfileId)) return { ok: false, message: "Source change cancelled." };
      const profile = profiles.find((candidate) => candidate.id === activeProfileId);
      const managedOverview = profile?.role === "managed" ? await managedContentAccessService.getOverview(profile) : null;
      if (managedOverview?.policy.mode === "approvedSources" && !hasOwnerPin) return { ok: false, message: "Create an Owner PIN before approving sources for a Managed profile." };
      const result = await confirmSourceFollow(activeProfileId, resolution, {
        followedSources: followedSourceRepository,
        reconcile: () => queueSourceLeaseReconciliation("local_change"),
        maxSources: capabilities.sourceLimit,
      });
      if (result.ok && profile?.role === "managed") {
        if (managedOverview?.policy.mode === "approvedSources") {
          await managedContentAccessService.approveSource(profile, {
            id: resolution.source.providerSourceId,
            title: resolution.source.displayName,
            description: resolution.source.description,
            thumbnailUrl: resolution.source.thumbnailUrl ?? "",
            followedAt: Date.now(),
            source: "link",
            fetchedAt: resolution.fetchedAt,
          });
        }
      }
      await invalidateLibrary();
      return result;
    },
    [activeProfileId, invalidateLibrary, authorizeProtectedAction, capabilities.sourceLimit, hasOwnerPin, profiles],
  );

  const wipeAllData = useCallback(async (): Promise<void> => {
    if (!await authorizeProtectedAction(activeProfileId)) return;
    storageGenerationRef.current += 1;
    await Promise.all([prefsWriteRef.current, interestsWriteRef.current, searchesWriteRef.current]);
    await draftWritesRef.current.get(activeProfileId)?.catch(() => {});
    await clearAllData(activeProfileId);
    queueSourceLeaseReconciliation("local_change");
    await clearProfileStorage(AsyncStorage, activeProfileId);
    queryClient.removeQueries({ queryKey: ["weekly-picks", activeProfileId] });
    await clearProfileGoogleCredential(SecureStore, activeProfileId).catch(() => {});
    prefsRef.current = defaultPrefs;
    interestsRef.current = [];
    recentSearchesRef.current = [];
    setGoogleCredential(null);
    setPrefs(defaultPrefs);
    setInterests([]);
    setRecentSearches([]);
    invalidateLibrary();
  }, [activeProfileId, invalidateLibrary, authorizeProtectedAction, queryClient]);

  const eraseAllFrameData = useCallback(async (confirmedRecovery: boolean = false): Promise<void> => {
    // Forgotten-PIN recovery is a separately reviewed, typed, irreversible local wipe.
    if (!confirmedRecovery && !await authorizeProtectedAction()) throw new Error("Owner authorization required before erasing local data.");
    storageGenerationRef.current += 1;
    await performFullReset({
      stopPlayback: async () => { await Promise.all([viewingAllowanceService.stopPlaying(), playbackControlsService.stopPlaying()]); },
      flushPendingWrites: async () => { await Promise.all([prefsWriteRef.current, interestsWriteRef.current, searchesWriteRef.current, ...draftWritesRef.current.values()]); },
      clearProtectedCredentials: async () => {
        if (ownerPinAvailability !== "available") return;
        const [existingProfiles, sources] = await Promise.all([profileRepository.list(), followedSourceRepository.listDistinctSources()]);
        await Promise.all([
          ...existingProfiles.map((profile) => clearProfileGoogleCredential(SecureStore, profile.id)),
          ...sources.map((source) => sourceLeaseTokenStore.remove(source)),
          SecureStore.deleteItemAsync(LEGACY_GOOGLE_TOKEN_KEY),
          installationIdentityStore.remove(),
          removeOwnerPin(),
        ]);
      },
      resetDatabase: resetAllFrameDatabaseData,
      clearKeyValueStorage: async () => { await AsyncStorage.clear(); },
      restoreOwnerSelection: async () => { await writeActiveProfileId(AsyncStorage, DEFAULT_OWNER_PROFILE_ID); },
    });
    const cleanOwner: Profile = { id: DEFAULT_OWNER_PROFILE_ID, name: "Owner", role: "owner", sortOrder: 0, createdAt: 0, updatedAt: 0 };
    activeProfileIdRef.current = DEFAULT_OWNER_PROFILE_ID;
    prefsRef.current = defaultPrefs;
    interestsRef.current = [];
    recentSearchesRef.current = [];
    authorizationSessionRef.current.relock();
    queryClient.clear();
    setProfiles([cleanOwner]);
    setActiveProfileId(DEFAULT_OWNER_PROFILE_ID);
    setPrefs(defaultPrefs);
    setInterests([]);
    setRecentSearches([]);
    setGoogleCredential(null);
    setHasOwnerPin(false);
    setIsOwnerAuthorized(false);
    setOwnerPinPromptOpen(false);
    setOwnerPinPromptError(null);
  }, [ownerPinAvailability, queryClient, authorizeProtectedAction]);

  return useMemo(
    () => ({
      ready,
      activeProfileId,
      activeProfile: profiles.find((profile) => profile.id === activeProfileId) ?? profiles.find((profile) => profile.role === "owner") ?? null,
      profiles,
      profileSwitching,
      switchProfile,
      createStandardProfile,
      createManagedProfile,
      renameLocalProfile,
      reorderLocalProfile,
      deleteLocalProfile,
      setProfileViewingAllowance,
      getManagedPlaybackControls,
      setManagedPlaybackControls,
      getManagedContentOverview,
      setManagedContentMode,
      getManagedContentAccess,
      requestManagedContentAccess,
      approveManagedContent,
      reviewManagedApprovalRequest,
      revokeManagedContent,
      cancelPendingOwnerAllowance,
      getPlaybackAllowance,
      beginAllowancePlayback,
      checkpointAllowancePlayback,
      stopAllowancePlayback,
      requestOwnerAuthorization,
      authorizeProtectedAction,
      changeSourceRule,
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
      canUseLibrary: true,
      capabilities,
      subscriptionStatusLoading: customerInfoQuery.isLoading,
      subscriptionStatusError: customerInfoQuery.isError,
      refreshPremiumAccess,
      libraryLoading: !ready
        || savedQuery.isLoading
        || resumeQuery.isLoading
        || queuesQuery.isLoading
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
      loadGoogleSubscriptions,
      importGoogleSubscriptions,
      resolveSourceInput,
      confirmSource,
      savedVideos: savedQuery.data ?? [],
      resumeList: resumeQuery.data ?? [],
      sessions: queuesQuery.data ?? [],
      sessionDraft: draftQuery.data ?? null,
      sessionDraftLoading: !ready || draftQuery.isLoading,
      followedChannels: channelsQuery.data ?? [],
      isVideoSaved: (id: string) => (savedQuery.data ?? []).some((v) => v.id === id),
      isChannelFollowed: (id: string) => (channelsQuery.data ?? []).some((c) => c.id === id),
      checkIsVideoSaved: (id: string) => dbIsVideoSaved(activeProfileId, id),
      saveVideo: async (v: Video): Promise<void> => {
        if (!requirePurchase("save")) return;
        await saveMutation.mutateAsync({ profileId: activeProfileId, video: v });
      },
      unsaveVideo: (id: string) => unsaveMutation.mutateAsync({ profileId: activeProfileId, videoId: id }),
      followChannel: async (c: FollowedChannel): Promise<void> => {
        await followMutation.mutateAsync({ profileId: activeProfileId, channel: c });
      },
      unfollowChannel: (id: string) => unfollowMutation.mutateAsync({ profileId: activeProfileId, id }),
      createSession,
      duplicateSession,
      renameSession,
      removeSession,
      updateSessionVideos,
      updateSessionPosition,
      saveSessionDraft,
      clearSessionDraft,
      recordResume,
      clearVideoResume,
      wipeAllData,
      eraseAllFrameData,
    }),
    [
      ready,
      activeProfileId,
      profiles,
      profileSwitching,
      switchProfile,
      createStandardProfile,
      createManagedProfile,
      renameLocalProfile,
      reorderLocalProfile,
      deleteLocalProfile,
      setProfileViewingAllowance,
      getManagedPlaybackControls,
      setManagedPlaybackControls,
      getManagedContentOverview,
      setManagedContentMode,
      getManagedContentAccess,
      requestManagedContentAccess,
      approveManagedContent,
      reviewManagedApprovalRequest,
      revokeManagedContent,
      cancelPendingOwnerAllowance,
      getPlaybackAllowance,
      beginAllowancePlayback,
      checkpointAllowancePlayback,
      stopAllowancePlayback,
      requestOwnerAuthorization,
      authorizeProtectedAction,
      changeSourceRule,
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
      capabilities,
      customerInfoQuery.isLoading,
      customerInfoQuery.isError,
      refreshPremiumAccess,
      savedQuery.isLoading,
      resumeQuery.isLoading,
      queuesQuery.isLoading,
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
      loadGoogleSubscriptions,
      importGoogleSubscriptions,
      resolveSourceInput,
      confirmSource,
      savedQuery.data,
      resumeQuery.data,
      queuesQuery.data,
      draftQuery.data,
      draftQuery.isLoading,
      channelsQuery.data,
      saveMutation,
      unsaveMutation,
      followMutation,
      unfollowMutation,
      createSession,
      duplicateSession,
      renameSession,
      removeSession,
      updateSessionVideos,
      updateSessionPosition,
      saveSessionDraft,
      clearSessionDraft,
      recordResume,
      clearVideoResume,
      wipeAllData,
      eraseAllFrameData,
    ],
  );
});
