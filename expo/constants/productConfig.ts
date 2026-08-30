export const PRODUCT_LIMITS = {
  todayMaxItems: 12,
  maxItemsPerSource: 2,
  discoveryCadenceDays: 7,
  futureSourcesPerProfile: 100,
  futureProfilesPerHousehold: 6,
  sessionDraftMaxItems: 3,
} as const;

export const TODAY_MAX_ITEMS = PRODUCT_LIMITS.todayMaxItems;
export const MAX_ITEMS_PER_SOURCE = PRODUCT_LIMITS.maxItemsPerSource;

/** Round 1 kill switches for backend-dependent or unfinished behavior. */
export const FOUNDATION_CAPABILITIES = {
  localLibrary: true,
  finiteSessions: true,
  youtubeDiscovery: false,
  youtubeSearch: false,
  sharedTodayFeed: false,
  weeklyDiscovery: false,
  googleSelectiveImport: false,
  automaticGoogleFollowing: false,
} as const;
