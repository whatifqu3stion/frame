# Frame release handoff — November 20, 2026

## Current status

**The source on `codex/full-app-byok` is newer than the available APK. There is no binary containing the latest fixes yet.** Do not use the existing APK as acceptance evidence for this source.

- Current configuration: version 1.0.0, Android versionCode 4.
- Build-4 source revision: `b5bebe376c2893335c2ac3e47f53da3341d39841`. Later source commits on this branch contain the November onboarding, Settings and recovery updates; record the exact checked-out commit when building the next candidate.
- Latest existing local APK: `artifacts/Frame-1.0.0-4.apk`, built from the build-4 revision without those later changes.
- Next candidate: allocate an unused versionCode greater than 4, commit or otherwise record the exact source snapshot, then build and verify it. No new version code or signing identity has been assigned in this pass.

## Existing build 4 — historical artifact evidence

Version 1.0.0 / build 4, 104,549,040 bytes. Its SHA-256 was rechecked on November 20:

`bcbc276e1c0a3639a54c4ced688ddc354f14cb0ad0ec8eb43186ea4e5b4b78e1`

The accompanying `artifacts/Frame-1.0.0-4-verification.json` records release signing, non-debuggable packaging, backup disabled, 16 KB alignment, API 24 minimum / API 36 target, and the source revision above. The signing certificate is `be84d00d99d64dba0190af6b0b4b4596c51dd53962ab99af15bb029d13b300fc`. Those packaging checks are historical, not repeated here. Its README and checksum remain beside the APK. Physical-device acceptance and live-provider testing were recorded as pending.

The superseded build-2 report is retained in [history](history/RELEASE_CANDIDATE_2026-10-31_BUILD_2.md).

## Current source verification

See [technical review and follow-up](FINAL_TECHNICAL_REVIEW_2026-11-19.md) and the [resolved session-recovery critique](TECHNICAL_CRITIQUE_2026-11-20.md). The latest verification passes 506 tests, TypeScript, and lint with zero errors (one existing generated-file warning). Resume and session-timer save recovery now survive leaving Watch; session completion remains attached to its originating profile during a switch; retry state is profile-scoped and cleared safely before data deletion. Recovery is in memory for the current app process, not a guarantee across force-quit or power loss.

The current UI uses BYOK setup, retired Google account import, a personalized first selection, and the four main tabs. Older build notes describing optional Google import or the earlier onboarding route are not the current product contract.

## Next candidate acceptance

1. Run `bun run verify` in `expo/`. Record the output and exact source snapshot. Increment Android versionCode before building; preserve the current application ID and private signing identity.
2. Run `npm run android:apk`. Record APK filename, hash, signing certificate, packaged version/permissions, release status and alignment checks. Update this document only with evidence from that artifact.
3. Follow [SMOKE_TEST.md](SMOKE_TEST.md) on the exact candidate: clean install and upgrade, key persistence/removal, funded Gemini generation and resulting recommendations, real YouTube playback, rotation/fullscreen/Back, background/resume, offline recovery, profile restrictions and viewing limits.
4. Exercise native large text, keyboard/insets, TalkBack/VoiceOver, reduced motion and haptics. For progress recovery, inject a failed final save after leaving Watch, confirm Retry is available outside Watch, then recover storage and retry. Confirm reset/deletion cannot restore old progress.

On November 20, `adb devices` listed no connected devices and no iOS simulator was booted. No new physical-device or live-provider acceptance is claimed. Browser previews and mocked tests do not establish native acceptance. This pass did not build, upload or publish an APK/AAB/IPA.
