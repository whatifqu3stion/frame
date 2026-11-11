# Frame mobile app

This folder contains Frame's React Native application. For the product overview and project status, start with the [root README](../README.md).

## Local development

Requires Node.js and Bun. From the repository root:

```bash
cd expo
bun install
bun run start-web
```

This is the full-access BYOK edition. Start scripts use standard Expo tooling. Configure YouTube and optional Gemini keys inside the native app; see [BYOK setup and security](docs/BYOK.md). Google subscription import additionally requires platform OAuth client configuration.

For the native development server:

```bash
bun run start
```

A web preview can help review layout and interaction, but native playback, secure key storage, authentication, and device behavior require their own compatible builds and acceptance checks.

For hosting the browser preview, see the [Render deployment guide](docs/RENDER.md) and the root `render.yaml`.

## Automated checks

```bash
bun run verify
```

This runs the configured typecheck, lint, and test commands. The [native acceptance plan](docs/SMOKE_TEST.md) remains a separate release requirement.

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
