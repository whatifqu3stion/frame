# Frame security review — 26 October 2026

## Result

The local BYOK working tree now includes the dependency/workflow protections from merged PRs #29, #30 and #32, plus fixes for persistent PIN retry limits, Google credential-request diagnostics, native player message validation, and the video project's Zod dependency. Existing local product work was preserved. No changes were committed, pushed, deployed, or merged by this review; Git branch history remains at its previous commit. Upstream changes were reconciled at file level because this checkout contains substantial uncommitted work.

The Expo lockfile audit dropped from **29 affected package names to 3**. The remaining packages produce **three high and one moderate advisory entries**. The video audit dropped from ten affected packages (all tracing to one Zod advisory) to **zero**. These are dependency database matches, not counts of demonstrated exploitable vulnerabilities in Frame. There is no claim that the app or its deployed services are fully secure.

Audit evidence: [dependency-audit-summary.json](expo/docs/security/2026-10-26/dependency-audit-summary.json). Queries used npm's advisory service via Bun 1.4.4 and npm audit on 26 October. Package inventories are disclosed to that service; no credentials were submitted.

## Remaining dependency findings

### SEC-01 — High advisory: node-forge signature validation; no published patch

Location: `expo/bun.lock:1333` (`node-forge@1.4.0`). The Expo CLI and its code-signing certificate utilities depend on this package. [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) covers malformed RSA signature verification and lists no patched release; npm also returned 1.4.0 as latest.

Impact depends on verification of attacker-controlled signatures with the affected key/encoding conditions. No remotely reachable Frame endpoint using this verifier was established. This is principally a tooling/signing dependency in the reviewed tree. Do not treat untrusted certificates or signatures as validated by this code. Resolution requires an upstream fix or a separately tested replacement in the Expo tooling chain; a fabricated version override would not fix it.

### SEC-02 — High advisories: image-size parser denial of service

Location: `expo/bun.lock:1069` (`image-size@1.2.1`), pulled in by Metro. [JXL/HEIF advisory](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq) and [ICNS advisory](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr).

Malformed image input can hang affected parsers. Metro processes build assets; a production app endpoint accepting image uploads was not identified. Use reviewed build assets and keep the development server private. Patched 2.0.4 is available, but Metro's `src/Assets.js:17,68,173` expects a callable default export and buffer/path synchronous behavior. Version 2 changes the API ([release notes](https://github.com/image-size/image-size/releases/tag/v2.0.0)). A blind global override is unsafe. Upgrade Metro through a compatible Expo release or test a maintained adapter/backport separately.

### SEC-03 — Moderate advisory: malformed URI decoding can exhaust CPU

Location: `expo/bun.lock:781` (`decode-uri-component@0.2.2`), through `query-string@7.1.3` used by Expo Router. [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr).

Malformed URL/query input could stall code using this decoder. A Frame deep-link exploit was not exercised. Upstream recommends 0.5.0 or newer, or bounding input length. The latest 0.5.1 is ESM-only; current query-string uses the CommonJS callable export. Do not force it globally without routing/Metro compatibility tests. Resolve with a compatible routing dependency upgrade or a reviewed decoder backport, and test malformed deep links on native and web.

## Fixed findings and hardening

### SEC-04 — Medium: restarting bypassed the Owner PIN attempt limit

Evidence: `expo/domain/ownerAuthorization.ts:33` describes the UI counter as non-persistent. Previously the protected verifier stored only the salt and digest, so app restart cleared the only retry limit.

Fix: `expo/domain/ownerPinVerifier.ts:19,50` now validates and persists attempt/cooldown state inside the existing protected record, before returning a verification result. Five incorrect attempts trigger the existing 30-second cooldown across launches. Concurrent verification calls are serialized. Old records migrate lazily; storage failures do not authorize access. Tests cover recreated services, concurrent attempts, legacy records, and failed persistence.

Residual boundary: this is an in-app family control, not protection against a rooted device, app-data deletion, OS clock manipulation, or extraction of secure storage. The existing fast salted verifier is not an offline password KDF; no redesign of device-compromise protection is claimed.

### SEC-05 — Low/defense in depth: credential transport diagnostics

Locations: `expo/services/googleAuth.ts:20,87,116`. Previously all three Google request paths logged raw exception messages. Such messages can contain request details, depending on the transport. No actual credential disclosure was observed.

Fix: diagnostics are fixed strings, and Google requests explicitly request redirect rejection, omitted ambient credentials, and no caching. Tests inject a sentinel credential into exceptions and verify it never reaches returned errors or logs; all three paths are checked for transport options. Native enforcement of fetch redirect/cache options requires device validation and is not proven by these unit tests.

### SEC-06 — Medium/defense in depth: native WebView bridge accepted unchecked values

Locations: `expo/components/YouTubePlayer.native.tsx:179`, new `expo/domain/playerBridge.ts:15`. The old JSON cast did not validate numeric types, finite values, negative progress, or message size before invoking playback callbacks.

Fix: a bounded parser accepts only known message shapes, valid playback states, boolean flags, and finite nonnegative times. Invalid data is ignored. Seek commands also normalize non-finite numbers. Tests cover legitimate lifecycle messages, null/array/oversized payloads, strings in numeric fields, negative values, and overflow to Infinity.

This is input validation, not sender authentication. YouTube's remotely loaded player remains a trusted component; this does not prevent a compromised trusted script from sending valid-looking messages. Native playback still needs a smoke test.

### SEC-07 — Dependency and CI maintenance

- Applied upstream workflow pinning, disabled checkout credential persistence, preserved Bun 1.4.4 and PostCSS remediation, and reconciled the upstream lockfile with BYOK's removed paywall/toolkit packages and existing native deduplication overrides (`expo/package.json:72`).
- Pinned the remaining Deno action and Node setup action to resolved commit SHAs. CI explicitly selects Node 24.22.1 rather than relying only on a package engines declaration (`.github/workflows/verify.yml:29`). All action references were checked for full SHA pins.
- Added `.nvmrc` and retained the patched runtime engine ranges. The machine-wide executable still reports Node **23.10.0**; it was not replaced. Typechecks and builds in this review used a temporary Node **24.22.1**. Use `nvm use` after installing the specified version (or your preferred version manager) before future local builds. [Official October Node advisory](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases).
- Updated video tooling's transitive Zod 4.5.4 to 4.6.7 through a same-major override (`video/package.json:27`). [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). Added `/video` to the existing Dependabot configuration.
- Production bundling exposed a missing WASM asset extension in the existing Metro config. Added it while preserving the exclusions for signing material and APKs. [Expo SQLite web setup](https://docs.expo.dev/versions/latest/sdk/sqlite/#web-setup). The web preview continues to use its existing session-only data behavior; no web database deployment is claimed.

## Review coverage and limits

Reviewed the actual BYOK manifest/lockfile, video lockfile, CI configuration, key storage/transport, Google OAuth integration and credential persistence, PIN authorization, native/web video player code, dynamic SQL call sites, and retained backend request guards. Relevant frontend guidance was adapted to React Native; browser-only controls were not falsely treated as native vulnerabilities.

Observed protections include native SecureStore without a browser/plaintext key fallback, fixed provider HTTPS endpoints, header-based API keys, cancellation on key revisions, sanitized provider errors, validated video IDs before HTML interpolation, and parameterized application SQL. Dynamic table names inspected came from internal lists. Google uses Expo's auth-session hook; this review did not complete a live OAuth flow.

React Server Component advisories do not automatically apply to the `react@19.1.0` client package. No installed `react-server-dom-*` implementation or enabled RSC server was found in the reviewed app lockfile/configuration. Expo Router declares an optional peer with patched ranges. [React's advisory and Native guidance](https://react.dev/blog/2025/12/11/denial-of-service-and-source-code-exposure-in-react-server-components).

The retained Supabase backend has bounded JSON reads, client publishable-key checks, and separate worker authorization. A publishable key is public and is not proof of user identity. The active BYOK build bypasses much of this shared service. Backend tests passed, but no live project configuration, RLS execution, deployed function code, rate-limit operation, logs, secrets, or hosted runtime was inspected. The Deno dependency graph and deployed Rork/Firebase services were not vulnerability-scanned. Existing static schema tests are not a live database audit. [Supabase security guidance](https://supabase.com/docs/guides/security/product-security).

## Validation

- Frozen Expo dependency installation succeeded using Bun 1.4.4 with lifecycle scripts disabled.
- App tests: **351 passed**, zero failures, 1,785 assertions across 67 files.
- Retained backend tests: **87 passed**, zero failures, 429 assertions across 11 files.
- Expo and video TypeScript checks passed under Node 24.22.1.
- Full Expo ESLint: zero errors, two unused-disable warnings in generated/existing type files. Changed security files passed scoped lint after the final PIN edit.
- Production web export passed after the WASM configuration correction. Remotion video production bundling also passed with the patched Zod dependency.
- Workflow and Dependabot YAML parsed successfully; action SHA pins validated; diff whitespace check passed.
- Video audit: zero reported vulnerabilities. Expo residuals recorded above.
- No APK/iOS build, device playback, live provider credentials, live backend audit, penetration test, or compromise investigation was performed.

## Follow-up order

1. Move normal local builds onto the pinned patched Node runtime.
2. Resolve the three remaining Expo dependencies with a compatible framework update/backport; do not substitute an untested breaking override just to clear the audit output.
3. Run native acceptance for secure-storage writes, PIN cooldown after force-quit, Google sign-in/import/revocation, playback progress, session expiry, fullscreen, and background/resume.
4. If any retained shared backend is still deployed, audit its actual dependencies, access controls and quota protections before treating it as covered by this BYOK review.

Backups of pre-review tracked changes and touched manifests were retained in `/private/tmp/frame-pre-security-20261026.patch` and `/private/tmp/frame-security-before/`. They are temporary local recovery aids, not committed backups.
