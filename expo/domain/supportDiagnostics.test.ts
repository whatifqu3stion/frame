import { expect, test } from "bun:test";
import { buildSupportReport, type SupportDiagnostics } from "./supportDiagnostics";

const status: SupportDiagnostics = {
  version: "1.0.0", build: "2", platform: "android", systemVersion: "34", environment: "production",
  databaseVersion: 9, storage: "sqlite", cleanup: "succeeded", googleConfigured: false,
};

test("support report identifies the installed build and platform without collecting app state", () => {
  const report = buildSupportReport({ ...status, apiKey: "SECRET_KEY", profileId: "PRIVATE_ID", email: "PRIVATE_EMAIL", history: ["PRIVATE_VIDEO"], error: new Error("PRIVATE_ERROR") } as SupportDiagnostics);
  expect(report).toContain("Version: 1.0.0 · Build: 2");
  expect(report).toContain("Android API level: 34");
  expect(report).toContain("Environment: production");
  expect(report).toContain("Google import configured: no");
  for (const privateValue of ["SECRET_KEY", "PRIVATE_ID", "PRIVATE_EMAIL", "PRIVATE_VIDEO", "PRIVATE_ERROR"]) expect(report).not.toContain(privateValue);
});

test("support report describes failed storage and preview state without inventing success", () => {
  const report = buildSupportReport({ ...status, platform: "web", systemVersion: "browser preview", databaseVersion: null, storage: "unavailable", cleanup: "pending" });
  expect(report).toContain("Database version: unavailable");
  expect(report).toContain("Storage: unavailable");
  expect(report).toContain("Thumbnail cleanup: pending");
  expect(report).toContain("System version: browser preview");
  expect(report).not.toContain("Android API level");
});
