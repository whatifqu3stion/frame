# Android test build 3 — 2 November 2026

Version 1.0.0 / versionCode 3. Signed standalone APK: `artifacts/Frame-1.0.0-3.apk` (93634922 bytes).

Published as a private GitHub prerelease: https://github.com/whatifqu3stion/frame/releases/tag/v1.0.0-android.3. The uploaded APK digest matches the verified local SHA-256. Build 2 remains unchanged. The release includes the APK, README, checksum and verification JSON.

SHA-256: `5f39c45dbe3c4ef2d3b49d5bb1b01a3c828db264d9e33464095890c8088594b7`.

The release reuses build 2's package and signing certificate. APK signature, 16 KB ZIP alignment, all 44 packaged 64-bit libraries, non-debuggable state, disabled backup, blocked-permission exclusion, bundled JavaScript and 21 fonts passed verification. The bundled JavaScript includes the Gemini hardening. No private build files or Google API-key-shaped strings were found in the bundle checks.

427 automated tests pass across 86 files, with 3,116 assertions. TypeScript and scoped lint pass. Gradle release compilation and release lint pass; generated Kotlin/Gradle deprecation warnings remain. Local logs are in `.local/build3-tests.log` and `.local/build3-android.log`; the artifact's companion verification JSON and checksum are in `artifacts/`.

This APK includes the current uncommitted UI and Gemini refinements on base `8af5800d5d62942c7cc1e4aad57e3756706493be`. Its release tag/source archives alone do not reproduce it. Source was not committed or pushed for this upload.

Physical-phone acceptance and live provider testing remain pending. Test Gemini generation and safe failure diagnostics, Android source labels, onboarding, small-screen Today, playback dimming in both themes, landscape/fullscreen spacing, and in-place update persistence. Never share API keys. See the artifact README for tester instructions.
