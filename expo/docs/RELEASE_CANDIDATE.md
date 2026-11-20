# Frame Android build 5 — November 20, 2026

## Current candidate

**Version 1.0.0 / Android build 5 packages the latest app updates.** Download the [signed APK and verification files](https://github.com/whatifqu3stion/frame/releases/tag/v1.0.0-android.5). This is a prerelease for native acceptance testing, not a store submission.

- APK: `Frame-1.0.0-5.apk` (107,897,068 bytes).
- Exact application source: `5616dea1704e5a4f17f12ae8b2c7e6de0e98bf28` on `codex/full-app-byok`. Subsequent documentation-only commits describe this same artifact.
- SHA-256: `996934436f7d48a7b6d84f3b8e2e6062136841dbe390177538550a057ff9ad10`.
- Signing certificate SHA-256: `be84d00d99d64dba0190af6b0b4b4596c51dd53962ab99af15bb029d13b300fc` — matches build 4.
- Package: `app.rork.vabp4o345ww8b0akdpr7p`; minimum API 24, target API 36; arm64-v8a, armeabi-v7a, x86 and x86_64.

Install over build 4 to preserve local app data. Keep the existing application ID and signing identity for future updates. The next binary must use an unused versionCode greater than 5.

## What changed

Build 5 includes the redesigned onboarding, topic/custom-interest selection, personalized discovery reveal, refined Settings and textured artwork. Playback and session hardening includes serialized accounting, stale-action cancellation, atomic session edits, batched metadata, and recoverable video-progress and session-timer saves after leaving Watch. Completion stays attached to its originating profile during a switch.

The app remains the full-access BYOK edition with retired Google account import. Recovery queues live for the current app process; they are not durable across force-quit or power loss.

## Verified

- Fresh Android prebuild and Gradle release compilation passed; release lint tasks completed.
- 506 tests pass, 3960 assertions across 97 files; TypeScript passes; JavaScript lint has zero errors and one existing generated-file warning.
- APK signature verified against the existing certificate, package/version verified, non-debuggable and backup disabled. Blocked sensitive permissions are absent.
- ZIP and all 46 packaged 64-bit native libraries pass 16 KB alignment checks.
- Hermes bundle and 22 fonts are packaged. Bundle checks confirm current onboarding, Gemini response-schema handling and session-time retry content.
- No private signing/environment files or standard Google API-key pattern found in the package.

Evidence: `research/release-pass/build-5/` at repository root contains build output, source verification, artifact verification and the JSON report. The release contains the APK, SHA-256 file, verification JSON and installation README. No uncommitted application changes were included in this build.

## Device acceptance still needed

No Android device was connected for this build. Follow [SMOKE_TEST.md](SMOKE_TEST.md) on this exact APK: clean install and upgrade, key persistence/removal, funded Gemini generation and recommendation review, real YouTube playback, fullscreen/rotation/Back, background/resume, offline recovery, profile restrictions and viewing limits. Include keyboard/insets, enlarged text, TalkBack, reduced motion and haptics.

For progress recovery, verify failed saves remain retryable outside Watch and after returning to a timed session, and that reset/deletion cannot restore old progress. Browser previews and mocked tests do not establish native acceptance.

The [technical critique and completed fixes](TECHNICAL_CRITIQUE_2026-11-20.md) documents source-level coverage. Historical build-2 notes remain in [history](history/RELEASE_CANDIDATE_2026-10-31_BUILD_2.md); old artifacts do not certify this candidate.
