export const PRODUCT_LIMITS = {
  todayMaxItems: 12,
  maxItemsPerSource: 2,
  discoveryCadenceDays: 7,
  futureSourcesPerProfile: 100,
  futureProfilesPerHousehold: 6,
  sessionDraftMaxItems: 3,
  onboardingInterestMax: 5,
  weeklyDiscoveryDisplayMax: 3,
  todayResetHour: 4,
  sourceFeedMaxSources: 25,
  sourceFeedCandidatesPerSource: 20,
} as const;

export const TODAY_MAX_ITEMS = PRODUCT_LIMITS.todayMaxItems;
export const MAX_ITEMS_PER_SOURCE = PRODUCT_LIMITS.maxItemsPerSource;
export const ONBOARDING_INTEREST_MAX = PRODUCT_LIMITS.onboardingInterestMax;
export const WEEKLY_DISCOVERY_DISPLAY_MAX = PRODUCT_LIMITS.weeklyDiscoveryDisplayMax;
export const TODAY_RESET_HOUR = PRODUCT_LIMITS.todayResetHour;
export const SOURCE_FEED_MAX_SOURCES = PRODUCT_LIMITS.sourceFeedMaxSources;
export const SOURCE_FEED_CANDIDATES_PER_SOURCE = PRODUCT_LIMITS.sourceFeedCandidatesPerSource;

/** Central kill switches for backend-dependent or unfinished behavior. */
export const FOUNDATION_CAPABILITIES = {
  paidAccess: false,
  localLibrary: true,
  finiteSessions: true,
  youtubeDiscovery: false,
  youtubeSearch: false,
  sharedTodayFeed: true,
  weeklyDiscovery: true,
  googleSelectiveImport: true,
  automaticGoogleFollowing: false,
} as const;
