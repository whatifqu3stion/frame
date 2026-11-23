# Frame for mobile and TV

This folder contains Frame's React Native application. For the product overview and project status, start with the [root README](../README.md).

## Local development

Requires Node.js and Bun. From the repository root:

```bash
cd expo
bun install
bun run start-web
```

This is the full-access BYOK edition. Start scripts use standard Expo tooling. Configure YouTube and optional Gemini keys inside the native app; see [BYOK setup and security](docs/BYOK.md). Google account sign-in and subscription import are retired; add sources by channel link or @handle.

For the native development server:

```bash
bun run start
```

A web preview can help review layout and interaction, but native playback, secure key storage, Owner PIN controls, and device behavior require their own compatible builds and acceptance checks.

For hosting the browser preview, see the [Render deployment guide](docs/RENDER.md) and the root `render.yaml`.

## Automated checks

```bash
bun run verify
```

This runs the configured typecheck, lint, and test commands. The [native acceptance plan](docs/SMOKE_TEST.md) remains a separate release requirement.

Last verified November 21, 2026: **507 passing tests, 3973 assertions across 97 files**, passing TypeScript and zero lint errors (one existing generated-file warning). [The latest technical review](docs/TECHNICAL_CRITIQUE_2026-11-20.md) records the session-completion and timer-recovery fixes and their regression coverage.

Open `/welcome-preview` in the local web app to review onboarding. The current source uses four main steps: connections, the phone demonstration, interests (with optional specifics), and the final discovery reveal. “Why Frame?” on the demonstration screen opens the three research animations and the “Great videos” sequence, then returns to setup. Existing saved setup positions migrate into the shorter flow. Provider-backed results require working keys; a browser demonstration is not native acceptance evidence.

## Find your way around

- [app/](app): screens and navigation.
- [components/](components): shared presentation and controls.
- [domain/](domain): daily selection, session flow, and other testable rules.
- [repositories/](repositories): persistence and data access.
- [services/](services): feature orchestration and service integration.
- [docs/](docs): environment guidance, design reviews, and acceptance work.

The app began with Rork tooling. This guide describes the actual project rather than the generic template's optional features or deployment claims.

## Android sideload

Use `npm run android:apk` with your Android SDK configured to produce a standalone release APK. See [Android sideload and signing guide](docs/ANDROID_SIDELOAD.md) for installation, preserving the signing key, and device checks.

The signed **1.0.0 / build 8 APK** runs on Android phones and compatible TVs and updates build 7 in place. [Download the GitHub prerelease and verification files](https://github.com/whatifqu3stion/frame/releases/tag/v1.0.0-android.8).

### Hisense Google TV and Android TV

Build 7 adds a TV launcher banner, a left navigation rail and remote focus indicators. Check **Settings → System → About** (or **Device Preferences → About**) on the TV for the Android TV OS version. The APK requires Android 7.0 or later.

With an authorized TV connected to ADB, run `adb -s TV_SERIAL install -r artifacts/Frame-1.0.0-8.apk` from this directory. Open **Frame** from Apps. Use the arrow pad to move focus, OK to choose, and Back to return. Keys stay on each device. Use **Settings → Transfer profile** to merge channels and interests and choose discovery wording from another device. You can skip key setup to explore the menus. Pair the Google TV phone remote on the same Wi-Fi, select a key field on the TV and paste from the phone keyboard.
