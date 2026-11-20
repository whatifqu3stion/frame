> Historical build-2 report. See [current handoff](../RELEASE_CANDIDATE.md) for source and artifact status.

# Frame Android release candidate — 31 October 2026

## Status

Version 1.0.0 / Android build 2. **The signed test APK is built and verified, ready for sideload acceptance testing.** Artifact: `artifacts/Frame-1.0.0-2.apk` (93,626,822 bytes). Gradle release compilation and release lint passed. The APK matches the existing signing certificate, is non-debuggable with backup disabled, excludes the blocked sensitive permissions and private build files, and contains the Hermes bundle and 21 font files. ZIP and all 44 packaged 64-bit native libraries pass 16 KB alignment checks. Four architectures are included, with minimum Android API 24 and target API 36. This is artifact verification; current-build phone interaction acceptance remains pending.

APK SHA-256: `3397162d0182258ceda1b2015a9863566954589b16e221403128c7e107f59ced`.
Signing certificate SHA-256: `be84d00d99d64dba0190af6b0b4b4596c51dd53962ab99af15bb029d13b300fc`.
Evidence: `research/release-pass/qa/android-build-2.log`, `android-build-2-verification.json`, and `android-build-2-source-verification.log` at the repository root. The latter records 397 passing tests, passing TypeScript, and zero lint errors (one existing generated-file warning).

## Final UX changes

- Setup explains the daily selection briefly. Interests are optional, and the next action clearly leads to choosing a source.
- Direct creator entry is ahead of optional weekly discovery. Discovery details are behind a disclosure. Missing native YouTube-key setup is explained beside source entry; an already configured key is not presented as missing.
- Finishing without a source goes directly to Sources, avoiding an empty reveal. Saved choices and the existing useful completion destinations remain intact.
- The first selection presents up to three videos, with a leading image, concise source/title/duration, and a real save action. Larger selections are explicitly continued in Today. First-save confirmation remains, with shorter copy and accurate local-link storage information.
- Android Back is only intercepted while onboarding is focused; it cannot consume Back from API-key settings above it. Busy operations remain protected and first-run Back does not mark onboarding complete.
- Settings keeps its established three groups. Required API setup comes before optional Google import and shows current setup status. About displays the app version and Android build from configuration.

## QA performed

- Tester preparation: **397 tests, 2,208 assertions, zero failures across 82 files**; TypeScript passes, lint has zero errors and the existing generated-types warning. Production diagnostics opens and shares only on explicit action; its allowlisted report excludes private app-state fields. Native and release builds cannot enable the sample library even with a stale preview flag. Browser QA covers the diagnostics entry, Back navigation, report disclosure, hidden unconfigured Google entry, dark 390 × 844 and light 320 × 740 layouts. Native share-sheet behavior and launcher rendering still require the new APK. Full output for this local pass: `/private/tmp/frame-tester-prep-verification.log`.

## Tester-facing preparation

- Settings → About & help → Device diagnostics is available in release builds. Testers can inspect the report before opening the native share sheet. It contains version/build, platform/API level, environment, database/storage state, thumbnail-cleanup state and whether Google import is configured. It excludes keys, PINs, account details, profile identifiers and viewing history; nothing is sent automatically.
- Unconfigured Google connection entries are hidden in Settings and policy-page shortcuts; connected accounts retain access to disconnect controls.
- Setup replay and privacy/reset copy no longer refer to the design preview or former Watch Later feature. Source-upload wording now clearly refers to reading creators' videos.
- Launcher, adaptive icon, splash and favicon assets now use the existing onboarding mark in mineral blue. Android adaptive foreground is transparent with the mark inside the central safe area. The reproducible vector renderer is `scripts/render-brand-assets.swift`.
- Build 2 regenerated the native project with the new brand background before compilation. The initial sandboxed Gradle attempt could not open its local lock socket; compilation then succeeded with build permissions using the freshly generated project. Future app-configuration changes still require prebuild.

## Earlier QA evidence

- Populated browser preview: optional interest selection, direct source field, three-video reveal, first save and confirmation, replay completion back to Settings.
- Isolated browser origin with no onboarding state: skipped interests, empty source step, Finish setup for now → Sources. No empty reveal and no fabricated content.
- Phone-sized light/dark review at 390 × 844 and 320 × 740: onboarding, settings index, appearance, daily selection/help, key-storage unavailable state, privacy and destructive-action disclosure. Fixed footers remain reachable; long settings summaries wrap. This is browser layout evidence, not Android rendering certification.
- Full TypeScript and ESLint: no errors; one pre-existing generated Supabase-types unused-disable warning.
- Full suite after dependency update: **375 tests, 2,028 assertions, zero failures**, including the Android Back focus regression and published forge fix.
- Final hardening suite: **377 tests, 2,037 assertions, zero failures**; truthful key-loading/error states, native storage retry, cached-status mutation guards, a stable busy-button accessible label, and a 48 dp session-help target. TypeScript passes; lint retains only the existing generated-file warning. This final pass has no fresh visual/native runtime sign-off; see the audit for the browser-tool restriction and remaining phone checks.
- Pre-live audit corrections: **390 tests, 2,156 assertions, zero failures across 79 files**; TypeScript passes and lint has zero errors. Isolated failure injection verifies startup recovery and preference preservation; actual component rendering verifies bounded approval pages with 1,003 synthetic entries. See `research/release-pass/qa/pre-live-fixes-verification.log`.
- Browser confirmation after the user reloaded the preview: normal startup/navigation, 48 × 107 CSS-pixel chart buttons, keyboard reachability of both chart ends at 320 pixels, and light/dark Appearance layout passed. Settings summaries wrap and the profile sheet opens/closes. No browser console errors were returned. Evidence and exact limits are recorded in `PRE_LIVE_AUDIT.md`; recovery failure visuals, live approval paging and current-build native acceptance remain pending.
- Security findings and residual tooling advisories: [hardening review](../security/2026-10-31/review.md).
- Screenshots and verification output: `research/release-pass/qa/` at the repository root.

## Before treating this as a finished phone release

1. Install the candidate on a physical Android phone and cold-launch without Metro. Complete setup, add a YouTube key, return to the preserved setup step, follow a creator and save a real video. Restart and confirm library/key persistence. Do not send credentials in chat.
2. Watch a long-form video: pause/resume, fullscreen rotation, Android Back, background/resume, network interruption, session ending and explicit next-video choice. Verify a Managed profile cannot bypass approvals or limits.
3. Check keyboard/insets, larger system text and TalkBack; turn Android Remove animations on, then off; confirm haptic preference on a physical phone.

The automated Android UI controller cannot attach to the installed emulator’s Qt window. A connected ADB device or successful installation alone does not prove these interactions. The existing iOS simulator was available but running an older bundle, so it is not counted as verification of this candidate. No live provider key or OAuth credential was supplied. Optional Google subscription import remains unavailable unless production OAuth client configuration is supplied.

## Local build recovery

The initial build could not delete old generated splash/JNI/CMake files. Existing generated output was preserved under `.local/android-before-release-20261031`, `.local/codegen-before-release-20261031`, and `.local/native-generated-before-release-20261031`; package sources and the private signing identity were preserved. Gradle also had missing transform-cache metadata; its incomplete transform directory was preserved in `.local/gradle-transforms-before-release-20261031` and regenerated from dependencies. Compilation was retried after a successful fresh prebuild using `--skip-prebuild`. The script checks native package/version identity before signing. These ignored backups are recovery material, not APK contents.
