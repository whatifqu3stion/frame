# Frame Android build 6 · November 21, 2026

[Download the signed APK and verification files](https://github.com/whatifqu3stion/frame/releases/tag/v1.0.0-android.6).

Build 6 fixes the Android crash when opening custom interests. If build 5 keeps showing “Frame couldn’t open this screen” after selecting interests, install this APK over it. Keep Frame installed to preserve your library, interests and keys.

Setup now takes four steps. The research and “Great videos” screens are available under Why Frame, and the launcher icon uses Frame’s four accent colors.

On an Android 14 emulator, build 5 failed on the custom-interest step and failed again after a cold start. Installing the signed build 6 APK in place recovered the three selected interests. Adding a custom interest, opening Today and reopening Today after a force-stop all passed with both API keys blank.

One emulator run recorded an Android input timeout while multiple system services also timed out. Repeating the transition succeeded. A separate first-run test with empty app data also reached Today and survived a cold start.

TypeScript and all 506 tests passed. Lint reported zero errors and one existing generated-file warning. APK signing and 16 KB alignment checks passed. Physical-device playback and live Gemini generation remain unverified on this build.

## Build identity

- Version 1.0.0, Android versionCode 6, package `app.rork.vabp4o345ww8b0akdpr7p`.
- Application source `8726a0ebfce15e77b229f0a6790518e8b8c799c8` on `codex/full-app-byok`.
- APK SHA-256 `9cdff6aac00ed9fdeff37ca9511d68e8611ddf223b5bd71585cae6f75137f498`.
- Signing certificate SHA-256 `be84d00d99d64dba0190af6b0b4b4596c51dd53962ab99af15bb029d13b300fc`, matching build 5.
- Minimum API 24, target API 36. All 46 packaged 64-bit libraries passed alignment verification.

See the [device acceptance plan](SMOKE_TEST.md) for the remaining playback, accessibility and live-provider checks.
