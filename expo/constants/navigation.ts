export type PrimaryTabRoute = "index" | "sources" | "saved" | "settings";

export type PrimaryTabDefinition = {
  route: PrimaryTabRoute;
  title: "Today" | "Sources" | "Saved" | "Settings";
};

/** Visible product shell. The index route makes Today the default tab. */
export const PRIMARY_TABS: readonly PrimaryTabDefinition[] = [
  { route: "index", title: "Today" },
  { route: "sources", title: "Sources" },
  { route: "saved", title: "Saved" },
  { route: "settings", title: "Settings" },
] as const;

export const DEFAULT_TAB_ROUTE: PrimaryTabRoute = "index";

/** Kept reachable for old links and local-data recovery. */
export const LEGACY_COMPATIBILITY_ROUTES = {
  explore: "/(tabs)/sources",
  library: "/(tabs)/saved",
} as const;

export const FRAME_PLAYBACK_ROUTE = "/watch/[id]" as const;

export const FRAME_PLAYBACK_ENTRY_PATHS = ["pastedLink", "sources", "saved", "continueWatching", "today", "session", "deepLink", "resumedPlayback"] as const;

export const PLAYER_AND_RECOVERY_ROUTES = [
  FRAME_PLAYBACK_ROUTE,
  "/session",
  "/session/[id]",
  "/add-to-queue",
] as const;

export const ONBOARDING_STEPS = ["welcome", "keys", "source", "your-frame"] as const;

