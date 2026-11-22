# Android release hardening — 31 October 2026

## Result

The release-candidate review covers Frame’s local Expo/React Native application and its build pipeline. It does not cover any separately deployed legacy service or prove the absence of vulnerabilities. No user API keys were read, entered, logged, or embedded. No hosted service was deployed.

A fresh npm advisory lookup reported 15 advisory entries across four packages. Updating `node-forge` from the locally patched 1.4.0 to published 1.4.1 removed all 12 forge matches, including the six high-severity entries. The previous patch registration was removed; its RSA regression test still passes against the upstream release. This is a compatible tooling update, pinned in `expo/package.json` and `expo/bun.lock`. [Upstream release](https://github.com/digitalbazaar/forge/releases/tag/v1.4.1).

The final inventory has **zero high/critical, two moderate, and one low advisory entries**. These three are accepted as build-tool maintenance items for this private sideload candidate, not claimed fixed. Raw before/after evidence is beside this report. Audit queries submit package names/versions to npm, not application data or credentials.

## Remaining findings

### REL-01 — Moderate: glob cancellation may continue traversal

`glob@13.0.6` is used by Expo CLI/configuration/fingerprinting/build tools. The vulnerable path accepts filesystem patterns and a cancellation signal; the APK does not expose a filesystem glob service. Build inputs come from this local repository. No remotely reachable app path was found. Patched 14.0.2 changes the dependency major version; avoid a blind override across Expo tooling. Resolve through a compatible supported toolchain update. [Advisory](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4).

### REL-02 — Moderate: minimatch pattern amplification

The lockfile includes minimatch 3.x, 9.x and 10.x through linting, coverage and Expo tooling. The demonstrated vulnerable preprocessing path uses optimization level 2 and hostile glob patterns. No application import or user-controlled pattern path was found. Patched 11.0.1 is a major/API change for older callable consumers. Keep builds restricted to reviewed repositories and update through compatible parents. This remains a scanner finding, not a demonstrated Frame exploit. [Advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249).

### REL-03 — Low: deepmerge returned-object prototype poisoning

`deepmerge@4.3.1` is pulled in by `@expo/config`. Expo merges the checked-in build configuration; Frame does not merge provider responses using this package. The advisory lists no patched release. Do not load untrusted dynamic Expo config. Revisit when an upstream fix is available. [Advisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4).

## Application boundaries checked

- `expo/storage/providerKeyStore.ts:5`: native SecureStore with device-only keychain accessibility; no plaintext/browser fallback. The new status hook exposes only credential presence.
- `expo/services/providerRequest.ts:15`: fixed HTTPS provider destinations, keys in headers, redirect rejection, cancellation on key revisions, sanitized errors and request deadlines.
- `expo/components/ProviderKeySettings.tsx:30`: protected edits, verified replacement, drafts cleared on background/route/profile transitions. Failed replacement leaves the existing key intact.
- `expo/components/YouTubePlayer.native.tsx:179`: bounded bridge parser; trusted navigation checks; user-action playback. Playback still needs a real device and live provider acceptance run.
- `expo/scripts/build-android-apk.mjs:17`: ignores developer dotenv and unrelated public environment variables, reuses private signing identity, refuses debug signing. Signing material and artifacts are excluded from Metro.
- Owner PIN persistence, managed-profile scope, finite selections, session timer and provider failure tests remain in the full suite. The new Android Back regression verifies that a settings screen above onboarding owns navigation.

## Verification

After the dependency change: TypeScript passes; ESLint has zero errors and one existing generated Supabase-types unused-disable warning; **375 tests / 2,028 assertions pass**. The RSA malformed-signature regression passes against node-forge 1.4.1. Android package checks and device limitations are recorded in `expo/docs/RELEASE_CANDIDATE.md`.
