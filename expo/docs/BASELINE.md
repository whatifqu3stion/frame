# Frame structural baseline

Captured: August 4, 2026

## Checkpoint

- Requested source: `2555fe9`.
- Result: the requested object is not available in this workspace's Git history, so no branch or Rork version was fabricated from it.
- Verifiable repository baseline at the start of this pass: `88e17a6674af6a1eda1131c7a110c2d4e6997004` on `main`.
- Rork manages repository synchronization. A checkpoint should be created from `2555fe9` only after that object is restored or made reachable.
- Structural work is stopped: the player and schema remain protected until their later passes.

## Validation baseline

- TypeScript: no pre-existing errors reported by Rork checks.
- ESLint: no pre-existing errors. Baseline lint did report four warnings: three import-order/duplicate-import warnings in the tab layout and one WebView ref cleanup warning in the protected native player. The tab-layout warnings were repaired; the protected player warning remains deferred to Pass 8.
- Project structure: no pre-existing errors reported by Rork checks.
- Automated behavior tests: no test files existed. The test script now reports this honestly and exits successfully when the suite is empty; it will run future Bun tests normally.
- New regressions from this baseline pass: none after final validation.

Keep pre-existing failures separate from regressions in future passes. Do not amend this section to make a later failure look pre-existing.

## Routes

- `/(tabs)` — tab shell.
- `/(tabs)/index` — Home, pasted-link entry, resume and finite library sections.
- `/(tabs)/explore` — interest-led verified YouTube discovery.
- `/(tabs)/library` — saved videos, Watch Later, queues, and followed creators.
- `/(tabs)/settings` — Premium, appearance, Google import, interests, privacy, wipe, and development diagnostics entry.
- `/onboarding` — first-run interests and optional creator setup.
- `/watch/[id]` — protected watch/player route.
- `/channel/[id]` — followed channel details and recent verified uploads.
- `/add-to-queue` — queue selection modal.
- `/session` — finite session builder.
- `/privacy` and `/terms` — legal copy.
- `/diagnostics` — development-only non-secret runtime diagnostics; production redirects to Settings.
- `+native-intent` — native incoming URL handling.
- `+not-found` — unmatched route fallback.

## Components

- `AddChannelModal` — creator-link entry.
- `EmptyState` — shared empty-state presentation.
- `ErrorBoundary` — root rendering failure fallback.
- `PaywallSheet` — offerings, purchase, restore, and legal links.
- `ScreenHeader` — editorial screen heading.
- `VideoCard` — video navigation, thumbnail state, duration, and progress.
- `VideoChapters` — creator-provided chapter navigation.
- `VideoSkeleton` — feed and thumbnail loading placeholders.
- `YouTubePlayer.native` — protected native WebView player bridge.
- `YouTubePlayer.web` — web embed player.
- `YouTubePlayer` and `YouTubePlayer.types` — platform export and player contract.

## Local persistence

### SQLite database

Database file: `frame.db` on iOS and Android. Web preview uses an in-memory fallback and is not persistent.

Formal migration version: **0 / unversioned**. There is no migration ledger and `PRAGMA user_version` was never advanced. The one compatibility migration checks whether `followed_channels.source` exists and adds it if missing. This fact is the schema stop condition: do not restructure tables until a migration plan starts from version 0.

- `saved_videos`: `id`, `title`, `channelId`, `channelTitle`, `thumbnailUrl`, `publishedAt`, `durationSeconds`, nullable `description`, `savedAt`.
- `resume_positions`: `videoId`, `timestampSeconds`, `updatedAt`, nullable `title`, `channelTitle`, `thumbnailUrl`, `durationSeconds`.
- `queues`: `id`, `name`, JSON-encoded `orderedVideoIds`, `updatedAt`.
- `watch_later`: video metadata plus `addedAt`.
- `followed_channels`: `id`, `title`, nullable `description`, `thumbnailUrl`, `followedAt`, `source` with default `manual`.

### AsyncStorage

- `frame.preferences.v1` — appearance, accent, onboarding state, and non-secret Google connection metadata.
- `frame.interests.v1` — explicit selected interests.
- `frame.recentSearches.v1` — up to eight local searches.

### SecureStore

- `frame.google.token.v1` — expiring Google access credential. Never displayed by diagnostics.

### Profiles

There is no account/profile table or backend profile model. The active profile identifier is explicitly reported as `local-device`; Google is an optional import connection, not Frame identity.

## Services and integrations

### Real and credential-dependent

- YouTube discovery and metadata: real Cloudflare Worker calls to YouTube Data API v3; requires a server-only YouTube key and a configured app backend URL.
- Google OAuth/import: real Expo AuthSession plus Google userinfo, bounded YouTube subscription pages, deliberate local selection, and revoke endpoints; requires a client ID for the active platform and is available without Premium during the MVP.
- RevenueCat: real native SDK; requires configured products, offering `frame_premium`, entitlement `premium`, and environment-appropriate public SDK key. Web purchases are intentionally unavailable.
- Native YouTube playback: real YouTube iframe inside WebView with official controls and user-initiated playback.
- SQLite, SecureStore, orientation, keep-awake, haptics, and image caching: real native integrations.

### Mocked or preview-only

- Web database operations use process-memory maps and reset on reload.
- Web player uses the web embed implementation rather than the native WebView bridge.
- No fake YouTube metadata, fake entitlement, fake sign-in, or fake purchase success path is present.

### Installed but currently unused by Frame source

- `expo-image-picker`, `expo-location`, `expo-symbols`, `expo-crypto`, `zustand`, `@expo/vector-icons`, `@stardazed/streams-text-encoding`, and `@ungap/structured-clone` have no direct source import in the current inventory.
- Rork toolkit dependencies may use additional project/toolkit environment variables internally; Frame application code does not read them directly.

## App environment variables

Values are intentionally omitted.

Used by Frame application code:

- `EXPO_PUBLIC_APP_ENV`: `development`, `staging`, or `production`; unset development bundles use development, while release bundles require production-scoped configuration.
- Backend URLs: `EXPO_PUBLIC_RORK_FUNCTIONS_URL_DEVELOPMENT`, `_STAGING`, `_PRODUCTION`. Legacy `EXPO_PUBLIC_RORK_FUNCTIONS_URL` is development-only fallback.
- Google client IDs per platform and environment: `EXPO_PUBLIC_GOOGLE_CLIENT_ID_{IOS|ANDROID|WEB}_{DEVELOPMENT|STAGING|PRODUCTION}`. Legacy platform variables are development-only fallback.
- RevenueCat: `EXPO_PUBLIC_REVENUECAT_TEST_API_KEY` outside production; `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` and `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` only in production.

Present in the Rork project but unused directly by Frame source: `EXPO_PUBLIC_PROJECT_ID`, `EXPO_PUBLIC_TEAM_ID`, `EXPO_PUBLIC_RORK_APP_KEY`, `EXPO_PUBLIC_RORK_AUTH_URL`, `EXPO_PUBLIC_RORK_API_BASE_URL`, `EXPO_PUBLIC_TOOLKIT_URL`, and `EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY`.

Server-only variables:

- `FRAME_ENV`: `development`, `staging`, or `production`; missing/unknown fails to development.
- `YOUTUBE_API_KEY_DEVELOPMENT`, `YOUTUBE_API_KEY_STAGING`, `YOUTUBE_API_KEY_PRODUCTION`.
- Legacy `YOUTUBE_API_KEY` is accepted only as the development fallback.

## Backend endpoints

All endpoints return a typed JSON envelope and currently allow cross-origin requests. Non-ping routes use an in-memory per-instance IP limit of 60 requests per minute.

- `GET /ping` — deployment health and server timestamp; no YouTube credential needed.
- `GET /youtube/search?q=` — safe-search video discovery; YouTube credential required.
- `POST /youtube/resolve` — resolve channel ID, handle, or video to a creator; YouTube credential required.
- `GET /youtube/videos/:videoId` — verified public embeddable video metadata; YouTube credential required.
- `GET /youtube/channels/:channelId` — channel metadata; YouTube credential required.
- `GET /youtube/channels/:channelId/videos` — up to 24 recent verified uploads; YouTube credential required.
- `OPTIONS *` — CORS preflight.
- Every other route returns `404`.

There is no backend database, profile API, payment webhook, auth endpoint, analytics endpoint, or synchronization endpoint in this worker.

## Protected player contract

Do not structurally edit the player before Pass 8. Preserve:

- `PLAYER_TIMEOUT_MS = 18000`.
- `RESUME_WRITE_INTERVAL_MS = 15000`.
- `FINAL_PROGRESS_DELAY_MS = 250`.
- Keep-awake tag `frame-video-playback`.
- `mediaPlaybackRequiresUserAction` enabled.
- Official YouTube controls, explicit user start, lifecycle persistence, fullscreen/orientation behavior, and intentional completion.
- Chapters only when at least three ascending creator timestamps begin at `0:00`.

## Native evidence

No simulator-control or screenshot-capture interface was available to this code session. Existing `dist-ios` and `dist-android` folders are export artifacts, not visual evidence. iOS and Android baseline screenshots/recordings therefore remain an explicit manual evidence task; they must not be marked captured until attached and reviewed.
