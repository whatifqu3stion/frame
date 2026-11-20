# Frame mobile app

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

Last verified November 20, 2026: **506 passing tests, 3960 assertions across 97 files**, passing TypeScript and zero lint errors (one existing generated-file warning). [The latest technical review](docs/TECHNICAL_CRITIQUE_2026-11-20.md) records the session-completion and timer-recovery fixes and their regression coverage.

Open `/welcome-preview` in the local web app to review onboarding. Its research animations, phone demonstration, interest selection and final discovery reveal are part of the current source. Provider-backed results require working keys; a browser demonstration is not native acceptance evidence.

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

The signed **1.0.0 / build 5 APK** includes the November 20 app updates and is available from the [GitHub prerelease](https://github.com/whatifqu3stion/frame/releases/tag/v1.0.0-android.5). It uses the same signing identity as build 4. See [release status](docs/RELEASE_CANDIDATE.md) for the source revision, checksum and outstanding native/live-provider checks.
