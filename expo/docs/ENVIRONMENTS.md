# Frame environment separation

Frame has three explicit configurations. Development bundles default to development; release bundles default to production and do not fall back to development credentials or services.

## Development

- App: `EXPO_PUBLIC_APP_ENV=development`.
- Backend: development URL; the legacy Rork functions URL is accepted only here.
- Google: development platform client IDs; legacy IDs are accepted only here.
- RevenueCat: test API key and test products only.
- Worker: `FRAME_ENV=development`; development YouTube key or legacy key fallback.
- Data: disposable local test data and non-production Google accounts.

## Staging

- App: `EXPO_PUBLIC_APP_ENV=staging`.
- Backend: staging-only URL.
- Google: staging platform client IDs and redirect URIs.
- RevenueCat: test API key/products; never production products.
- Worker: `FRAME_ENV=staging`; staging-only YouTube key and quota.
- Data: seeded QA data with no real customer records.

## Production

- App: `EXPO_PUBLIC_APP_ENV=production`.
- Backend: production-only URL; there is no fallback to the routine Rork URL.
- Google: production platform client IDs only.
- RevenueCat: platform production public SDK keys and production products.
- Worker: `FRAME_ENV=production`; production-only YouTube key and quota.
- Data: customer data. Never copied into development or staging.

## Required release rule

A production build with missing production-scoped configuration must show an unavailable state rather than fall back to development, staging, test products, or a legacy key. Secrets remain server-only. Public client identifiers and RevenueCat SDK keys may be bundled, but they must still be environment-scoped.

## Configuration names

App environment:

- `EXPO_PUBLIC_APP_ENV`
- `EXPO_PUBLIC_RORK_FUNCTIONS_URL_DEVELOPMENT`
- `EXPO_PUBLIC_RORK_FUNCTIONS_URL_STAGING`
- `EXPO_PUBLIC_RORK_FUNCTIONS_URL_PRODUCTION`
- `EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS_DEVELOPMENT`
- `EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS_STAGING`
- `EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS_PRODUCTION`
- Equivalent `ANDROID` and `WEB` Google client variables.
- `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`

Worker environment:

- `FRAME_ENV`
- `YOUTUBE_API_KEY_DEVELOPMENT`
- `YOUTUBE_API_KEY_STAGING`
- `YOUTUBE_API_KEY_PRODUCTION`

Compatibility variables `EXPO_PUBLIC_RORK_FUNCTIONS_URL`, platform Google IDs without an environment suffix, and `YOUTUBE_API_KEY` are development-only fallbacks. Remove them after all development configuration has moved to explicit names.

Google sign-in also recognizes the older `EXPO_PUBLIC_GOOGLE_{ANDROID|IOS|WEB}_CLIENT_ID` names in development. A development build can use `EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID` as a last resort; it must be an OAuth client for the platform being tested. Prefer platform-specific IDs when sharing one environment across platforms. Staging and production still require their own platform IDs.

For native testing use a development build, not Expo Go. Rebuild after changing URL schemes. Frame registers `app.rork.vabp4o345ww8b0akdpr7p:/oauthredirect` for the browser callback. Use the matching bundle/package ID and, on Android, the signing certificate fingerprint. This AuthSession flow requires an Android OAuth client that permits custom URI redirects; see [Google's Android client settings](https://support.google.com/googleapi/answer/6158849). On web, register the deployed origin as the web client's redirect URI (or the local origin and port for development). Verify that returning from consent opens the subscription picker; cancelling must leave the profile disconnected.
