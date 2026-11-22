export type SupportDiagnostics = {
  version: string;
  build: string;
  platform: string;
  systemVersion: string;
  environment: string;
  databaseVersion: number | null;
  storage: "sqlite" | "memory-web-preview" | "unavailable";
  cleanup: "not-run" | "running" | "succeeded" | "pending" | "web-unmanaged" | "unavailable";
  googleConfigured: boolean;
};

/** Explicit allowlist: never serialize app state, credentials, identifiers, or errors. */
export function buildSupportReport(status: SupportDiagnostics): string {
  return [
    "Frame diagnostic report",
    `Version: ${status.version} · Build: ${status.build}`,
    `Platform: ${status.platform}`,
    `${status.platform === "android" ? "Android API level" : "System version"}: ${status.systemVersion}`,
    `Environment: ${status.environment}`,
    `Database version: ${status.databaseVersion ?? "unavailable"}`,
    `Storage: ${status.storage}`,
    `Thumbnail cleanup: ${status.cleanup}`,
    `Google import configured: ${status.googleConfigured ? "yes" : "no"}`,
  ].join("\n");
}
