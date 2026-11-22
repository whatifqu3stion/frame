# Frame environment separation

Frame has three explicit configurations. Development bundles default to development; release bundles default to production and do not fall back to development credentials or services.

## Current mobile edition

Frame uses user-supplied YouTube and optional Gemini keys, entered in the app and stored on the device. Do not bundle provider keys in `EXPO_PUBLIC_*` variables. Google OAuth sign-in/subscription import and RevenueCat purchases are retired; their old configuration is not required and does not enable them. Legacy credential cleanup remains available for older installations.

The environment-scoped backend and worker settings below apply only when working on those services; they do not replace the mobile BYOK setup. See [BYOK.md](BYOK.md).

## Development

- App: `EXPO_PUBLIC_APP_ENV=development`.
- Backend: development URL; the legacy Rork functions URL is accepted only here.
- Worker: `FRAME_ENV=development`; development YouTube key or legacy key fallback.
- Data: disposable local test data and non-production Google accounts.

## Staging

- App: `EXPO_PUBLIC_APP_ENV=staging`.
- Backend: staging-only URL.
- Worker: `FRAME_ENV=staging`; staging-only YouTube key and quota.
- Data: seeded QA data with no real customer records.

## Production

- App: `EXPO_PUBLIC_APP_ENV=production`.
- Backend: production-only URL; there is no fallback to the routine Rork URL.
- Worker: `FRAME_ENV=production`; production-only YouTube key and quota.
- Data: customer data. Never copied into development or staging.

## Required release rule

A production build with missing production-scoped configuration must show an unavailable state rather than fall back to development, staging, or a legacy key. Backend secrets remain server-only. User-supplied mobile provider keys stay in device secure storage and are sent directly to the matching provider.

## Configuration names

App environment:

- `EXPO_PUBLIC_APP_ENV`
- `EXPO_PUBLIC_RORK_FUNCTIONS_URL_DEVELOPMENT`
- `EXPO_PUBLIC_RORK_FUNCTIONS_URL_STAGING`
- `EXPO_PUBLIC_RORK_FUNCTIONS_URL_PRODUCTION`

Worker environment:

- `FRAME_ENV`
- `YOUTUBE_API_KEY_DEVELOPMENT`
- `YOUTUBE_API_KEY_STAGING`
- `YOUTUBE_API_KEY_PRODUCTION`

Compatibility variables `EXPO_PUBLIC_RORK_FUNCTIONS_URL` and `YOUTUBE_API_KEY` are development-only backend/worker fallbacks. Remove them after all development configuration has moved to explicit names.
