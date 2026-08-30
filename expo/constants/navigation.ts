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

export const PLAYER_AND_RECOVERY_ROUTES = [
  "/watch/[id]",
  "/session",
  "/session/[id]",
  "/add-to-queue",
] as const;

export const ONBOARDING_STEPS = ["approach", "interests", "trusted-source", "enter-today"] as const;
