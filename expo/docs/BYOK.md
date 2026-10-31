# Full-access BYOK edition

This branch replaces the subscription/demo-paywall product with one full-access app. No RevenueCat SDK, purchases, subscription checks, or plan selection remain in the active runtime. Standard Expo tooling replaces the Rork Metro wrapper, which injected analytics and development providers. Local library, playback, sessions, profile controls, and selective Google import remain available. Product boundaries (finite Today, source/profile caps, sessions with endings, and Managed profile approvals) remain independent of payment.

The personal-use limits and search boundaries are documented in [PERSONAL_USE.md](./PERSONAL_USE.md).

## Setup

1. Use the native iPhone or Android app. Open **Settings → Your API keys** as the Owner, or follow the key-setup link during onboarding.
2. In Google Cloud, enable **YouTube Data API v3**. Create a dedicated key and restrict its API access to YouTube Data API v3. Paste it into Frame and choose **Verify & save**.
3. For optional AI suggestions, create a separate Gemini key restricted to the **Generative Language API**. Set appropriate provider quotas, review billing, then verify and save it in Frame. Budget alerts do not impose a spending cap.
4. Select interests. In **Sources → Discover**, choose **Generate picks with my keys**. One bounded Gemini request proposes up to six handles. Frame verifies each source through YouTube, inspects its latest 12 upload entries, then makes at most one Gemini quality-review request per eligible source (at most seven Gemini calls total). The current weekly focus of interests (including custom topic labels) and bounded public channel/video metadata go to Gemini; no profile identity, history, or saved library is sent. Sources without enough substantive long-form evidence are omitted. AI judgments are based on metadata, not watching full videos, and are not a safety or quality certification. See DISCOVERY_QUALITY.md for the versioned rubric.

YouTube verifies a key with one channels request. Gemini verifies API access with a models-list request; this does not generate content or guarantee generation entitlement, available quota, or access to the configured model. The configured model is `gemini-3.5-flash-lite`.

Google account import remains optional and requires platform OAuth client configuration. It is separate from API keys. Keys cannot grant access to private subscriptions or replace OAuth.

## Storage and requests

- Keys use Expo SecureStore with a separate keychain service and `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. The Expo SecureStore plugin excludes its Android entries from backup. There is no plaintext or browser-storage fallback.
- This browser preview disables key entry/storage. Real keys must be entered in a native build. Do not paste keys into source, environment files, support status, screenshots, or test fixtures.
- Keys are device-wide and Owner-managed; all local profiles can use YouTube metadata within their existing content permissions. Only the Owner can generate AI suggestions or change keys. Stored values are never displayed or loaded into React Query state.
- Direct requests use fixed HTTPS Google endpoints, `x-goog-api-key` headers, no URL credentials, no cookies, redirect rejection, bounded timeouts, and no automatic retries. Provider error bodies and transport exceptions are not surfaced or logged.
- YouTube source feeds deduplicate requests and cache metadata in memory for 15 minutes; source IDs, result sizes, and concurrency are bounded. Existing database metadata-retention rules still apply.
- Reading onboarding or Discover never generates AI content. An explicit generation action is required. A generated pool is reused for its profile throughout the UTC week, including after interest edits. Interest selections are unlimited; at most 12 topics rotate into each weekly request. Custom labels are treated as untrusted topic data and cannot override the quality rubric. Attempts have a 60-second cooldown, capped output, and no tools or automatic continuation. This is not a provider billing cap.
- Replace/remove cancels requests and invalidates the in-memory feed cache. Successful validation is required before replacing an existing key. Removing a key affects future requests, not work already accepted by Google. Existing library links and local metadata remain.
- Erase all Frame data removes provider keys before resetting the library. A native secure-storage failure prevents the reset from claiming success. Revoking the provider key is a separate action in Google Cloud/AI Studio. iOS keychain values can survive app uninstall; use in-app removal or provider revocation.

## Security boundary and release checks

BYOK credentials are the user's credentials, not bundled developer secrets. Device secure storage protects persistence; the app must temporarily hold a key in memory to call Google. A compromised device, debugger, or malicious app update can extract it. No mobile BYOK implementation can promise otherwise. Use dedicated, restricted, revocable keys. Never distribute shared app-owned provider secrets in the client.

Before shipping, verify on physical iOS and Android devices: secure save/restart/remove; restricted YouTube and Gemini keys; invalid, revoked, quota-exhausted keys; offline and stalled requests; backgrounding while editing/generating; profile switch and Owner PIN; full reset including secure-storage errors; backup/restore behavior; native redirect handling; generated-source verification; and provider billing visibility. Automated tests use fake keys and mocked provider responses; they do not establish live API or device acceptance.

Official references: [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/), [Google API key headers](https://docs.cloud.google.com/docs/authentication/api-keys-use), [Gemini key guidance](https://ai.google.dev/gemini-api/docs/api-key), [Gemini model](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), [YouTube channels](https://developers.google.com/youtube/v3/docs/channels/list), [YouTube uploads](https://developers.google.com/youtube/v3/docs/playlistItems/list).
