# Personal Android build

Current release-candidate status and device acceptance: [RELEASE_CANDIDATE.md](RELEASE_CANDIDATE.md). Build 8 adds profile transfer on phone and TV. Historical build-1/build-2 verification below does not certify this candidate.

Frame's sideload build is a standalone, release-mode APK. It bundles the app and fonts, uses the existing `app.rork.vabp4o345ww8b0akdpr7p` application ID, and needs neither Expo Go nor Metro. Internet remains necessary for YouTube playback and provider requests. Your YouTube and Gemini keys are entered during onboarding or in Settings → YouTube & Gemini and stored by native SecureStore.

## Build locally

Requirements: the installed Java 17 JDK, Node, project dependencies, and Android SDK (Expo SDK 54 currently generates compile/target SDK 36 and NDK 27.1.12297006). The first build downloads Gradle and Maven dependencies from their normal repositories. No Expo login, paid build service, or upload is required.

From `expo/`, on this Mac:

```sh
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
npm run android:apk
```

For a **first installation on a new signing identity only**, add `-- --init-key`. The current workspace already has its private signing identity; do not regenerate it. The script fails instead of silently substituting Android's public debug key. It regenerates Android project configuration, applies private release signing, builds all configured Android architectures, and copies the result to `artifacts/Frame-<version>-<versionCode>.apk`. Allocate a new versionCode before the next release; do not overwrite a previously published build with different source.

The generated `android/` project is disposable. Use this script for signed release builds; do not rely on the generated template's default signing. The script ignores `.env` and inherited `EXPO_PUBLIC_*` values except the two explicitly supported production Google OAuth client IDs. YouTube and Gemini API keys must never be build variables. Google account import is retired; following channels and BYOK discovery do not require OAuth setup.

If prebuild succeeded and only compilation failed, `npm run android:apk -- --skip-prebuild` retries against the generated project. Use this only with unchanged app configuration; the script checks the generated package, version, and versionCode before signing. A normal build still runs prebuild.

## Keep the signing identity

Securely back up the entire ignored `.local/android-signing/` directory, including its keystore and credentials JSON. Both are needed for updates. This directory is private to this workspace, excluded from Git and Metro, and contains no YouTube/Gemini keys. Treat it as a credential and do not upload it with the APK. Gradle caches are separate in `.local/gradle/` and are disposable.

Before each subsequent release, increment `expo.android.versionCode` in `app.json`. Keep the application ID and signing identity unchanged, then run the same build command. Installing with `adb install -r` preserves local app data when the installed package has the same signing certificate. An older Rork/store build signed with a different key cannot be updated by this private build; restore its signing key if you need in-place compatibility. Do not uninstall an existing app merely to bypass a signature mismatch—uninstalling removes its local data and API keys.

## Install

1. Copy the APK to your Android phone, open it in Files, and allow that file manager to install this app when Android asks. That per-source permission can be turned off again afterward.
2. Open Frame and complete setup. Add and verify your YouTube key, then Gemini if you want weekly discovery.
3. Alternatively, with USB debugging already enabled and the phone authorized, use `adb install -r artifacts/Frame-<version>-<versionCode>.apk` with the actual verified candidate filename from `expo/`. If multiple devices are connected, specify the intended serial using `adb -s SERIAL install -r ...`.

Verify an APK before sharing with Android's `apksigner verify --verbose --print-certs <apk>`. Keep the certificate fingerprint with release notes. An APK is the installable artifact; an AAB is for store distribution. [Expo APK guidance](https://docs.expo.dev/build-reference/apk/).

## Device acceptance

For friends testing this build, use Settings → About & help → Device diagnostics → Share diagnostic report. Ask them to include what they expected, what happened, and the steps to reproduce it; a screenshot or short recording can help. The report contains technical status only, with no keys, PINs, account details or viewing history. They choose the recipient in Android's share sheet; Frame does not send reports automatically. Review screenshots for personal content before sharing.

Check cold launch without Metro; native key verification and persistence across restart; a long-form video's playback and orientation; system Back/keyboard/insets; save, undo and session reordering; explicit session ending; light/dark and larger text; Android Remove animations; haptics on/off; managed-profile/PIN boundaries. No automatic content refresh or following should occur. Follow the broader `SMOKE_TEST.md` plan for provider failures and protected actions.

Android backup is disabled. The generated manifest removes unused camera, microphone, location, media/storage and overlay permissions inherited from libraries. Internet and haptic support remain. Release signing, package permissions, and device behavior must be verified against the produced APK; a successful web preview alone does not establish native acceptance.

## Historical build 2 — October 31, 2026

`artifacts/Frame-1.0.0-2.apk` was the October 31 test artifact and is superseded: version 1.0.0 / build 2, 93.6 MB, Android 7.0 / API 24 minimum and target API 36. It includes arm64-v8a, armeabi-v7a, x86 and x86_64.

- Release compilation and release lint passed; the preceding app verification has 397 passing tests, passing TypeScript and zero lint errors.
- Signature verified against the same private signing certificate as build 1. ZIP alignment and all 44 packaged 64-bit native libraries pass 16 KB alignment checks.
- Packaged manifest is non-debuggable with backup disabled; blocked sensitive permissions are absent. Exact permissions are listed in `artifacts/Frame-1.0.0-2-verification.json`.
- Compiled Hermes JavaScript, diagnostic-report/share strings and 21 font files are present. No `.env`, signing keystore, credentials JSON or `.local` files are packaged.
- No phone installation or native interaction sign-off is claimed for build 2. Complete the acceptance checks above.

APK SHA-256: `3397162d0182258ceda1b2015a9863566954589b16e221403128c7e107f59ced`.
Signing certificate SHA-256: `be84d00d99d64dba0190af6b0b4b4596c51dd53962ab99af15bb029d13b300fc`.

## Historical build 1 — October 21, 2026

Produced `artifacts/Frame-1.0.0-1.apk` (about 90 MB), version 1.0.0 / code 1, for arm64-v8a, armeabi-v7a, x86 and x86_64. Android 7.0 / API 24 minimum; target API 36.

- Gradle `assembleRelease` succeeded, including release lint.
- `apksigner verify --verbose --print-certs` passed with one private RSA-3072 signer and APK v2 signing.
- `zipalign -c -P 16 4` passed.
- The archive contains the compiled JavaScript bundle and font assets; no `.env`, signing keystore, credentials JSON or `.local` build files were present.
- Packaged release manifest: `debuggable=false`, `allowBackup=false`; the blocked sensitive permissions are absent.
- App TypeScript and scoped ESLint pass; 325 automated tests pass. The web layout/action review is recorded in `MOTION_REVIEW.md`.
- No Android phone/emulator was connected for installation. Native playback, SecureStore behavior, gestures, accessibility and haptic feel remain device acceptance items.

APK SHA-256: `e4ce68f5abdccd25fed77f800a913954ea8717d2c3569d3d688849495963d1cf`.

Signing certificate SHA-256: `be84d00d99d64dba0190af6b0b4b4596c51dd53962ab99af15bb029d13b300fc`.
