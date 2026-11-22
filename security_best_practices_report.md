# Frame security closeout — 26 October 2026

## Current status

The identified local code and dependency fixes are implemented, including the three items left open in the first pass. The active Frame Development database's security warning was also corrected and rechecked. Device acceptance remains pending because ADB reports no connected device/emulator. This is not a claim of comprehensive penetration testing or universal security.

Application changes remain **uncommitted and unpushed** in `codex/full-app-byok`, alongside the existing BYOK product changes. Upstream PRs #29, #30 and #32 were reconciled into the working files without discarding local work or changing branch history. The only remote mutation in this review was applying the existing search-path hardening migration to Frame Development.

## Dependency findings — addressed

| Finding | Treatment | Status |
| --- | --- | --- |
| SEC-01: node-forge RSA signature validation | Local Bun patch validates nested DigestAlgorithm element count | Tested local fix; still flagged by version-only audit |
| SEC-02: image-size parser denial of service | Upgrade to 2.0.4; small Metro patch converts filename inputs to bytes | Fixed and compatibility-tested |
| SEC-03: decode-uri-component CPU exhaustion | Upgrade to 0.5.1; query-string patch adapts its ESM default export | Fixed and compatibility-tested |
| Zod in video tooling | Same-major override to 4.6.7 | npm audit reports zero vulnerabilities |

The first Expo audit matched 29 package names. After final changes, the audit reports only `node-forge@1.4.0`, because the published package version has not changed. The vulnerable nested validation behavior is patched locally and tested; the advisory is **not suppressed**. Do not report this as a zero-alert Expo audit. Replace the local patch with an upstream fixed release when available.

All three patches are declared in `expo/package.json` under `patchedDependencies`, stored in `expo/patches/`, and included in the Bun lockfile. A fresh temporary installation using `bun install --frozen-lockfile --ignore-scripts` reapplied the patches and passed all four installed-dependency regression tests. No package lifecycle script is required to apply the fixes.

The initial assumption that upgrading image-size required a broad framework migration was too conservative. Its default export is compatible; Metro's filename input needed a narrow adaptation. Similarly, the ESM URI decoder works with a small consumer interop patch. Both are now tested rather than left as unresolved compatibility risks.

Sources and maintenance:

- [node-forge advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv); [proposed upstream fix #1152](https://github.com/digitalbazaar/forge/pull/1152). This proposed PR is still open; the checked-in change is a local backport, not an official patched release.
- [image-size JXL/HEIF advisory](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq), [ICNS advisory](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr).
- [URI decoder advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr), [single-pass decoder release](https://github.com/SamVerschueren/decode-uri-component/releases/tag/v0.5.0).
- [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
- Patch rationale and removal instructions: [expo/patches/README.md](expo/patches/README.md).
- Raw final audit: [final-dependency-audit.json](expo/docs/security/2026-10-26/final-dependency-audit.json). Earlier measurements: [dependency-audit-summary.json](expo/docs/security/2026-10-26/dependency-audit-summary.json).

## Application fixes completed

- **SEC-04 — PIN retry bypass (medium):** `expo/domain/ownerPinVerifier.ts:50` persists failed-attempt and cooldown state inside the existing protected verifier record. Restarting no longer clears the guessing limit. Concurrent verification is serialized; old records remain compatible; failure to save retry state does not authorize access.
- **SEC-05 — Credential diagnostics (defense in depth):** `expo/services/googleAuth.ts:20` and the subscription/revocation paths no longer log raw exception strings. Requests explicitly ask for redirect rejection, omitted ambient cookies and no cache. Tests confirm that sentinel credentials in exceptions do not reach logs or results. Native transport enforcement still requires device testing.
- **SEC-06 — Player bridge validation (defense in depth):** `expo/domain/playerBridge.ts:15` rejects malformed, oversized, unknown, negative and non-finite messages before invoking playback callbacks. Native seek commands normalize non-finite values. This validates data; it does not authenticate a compromised trusted YouTube script.
- CI actions are pinned to full SHAs and checkout does not persist credentials. Node setup explicitly selects 24.22.1; Bun is pinned to 1.4.4. The repo has `.nvmrc` and patched runtime engine ranges. Video tooling is included in Dependabot.
- Metro now includes the SQLite WASM asset extension needed for web production bundling. Existing signing/artifact exclusions were preserved.

## Live backend check and correction

The connected account contains an active **Frame Development** project (`gzzazhqlphomzjndzrfm`) with six deployed Edge Functions. BYOK's active feed and weekly-discovery clients use the personal-key transport, and source-lease reconciliation explicitly returns early when BYOK is enabled. The retained shared backend nevertheless exists and was checked rather than assumed absent.

The Supabase security advisor reported one warning: `public.user_id()` had a mutable search path. Its live definition was inspected: it reads the request JWT subject using built-in functions. Applied the existing repository migration `supabase/migrations/20260924170000_harden_user_id_search_path.sql` through the migration API, setting its search path to the empty string. A transaction-local test JWT subject still resolved correctly afterwards. A fresh advisor check no longer reports the warning.

The remaining advisor output consists of 12 **informational** “RLS enabled, no policy” notices on backend tables. No permissive policies were added: absent client policies deny row access to ordinary client roles. Those notices are not evidence of public data exposure. [Supabase explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). The corrected search-path issue is described [here](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).

Limits: deployed Edge Function source, all RPC authorization paths, runtime dependencies, and provider quota behavior have not undergone a comprehensive live audit. The advisor check and static backend tests do not establish all of those properties. No deployed functions, secrets, user rows, or RLS policies were modified.

## Verification

- **355 app tests pass**, zero failures, 1,796 assertions across 68 files. This includes four installed-dependency checks for URI decoding, real images, Metro filename input, and valid/malformed RSA signatures.
- **87 backend tests passed** in the first pass; backend source was not subsequently changed.
- A clean frozen installation passed all four dependency regressions independently.
- Expo and video TypeScript checks passed; the final Expo check also passed after dependency changes.
- Full first-pass ESLint had zero errors and two unused-disable warnings in existing/generated type files; new dependency regression file passed scoped lint.
- Production Android, iOS and web exports passed with the final patches. Native exports generated Hermes bytecode. Video production bundling also passed in the first pass.
- Workflow/Dependabot YAML parsed, action SHA pins checked, and whitespace checks passed.
- Video audit is clean; Expo retains the one locally patched node-forge version advisory described above.
- Live database helper test passed and the security warning cleared.

## Release boundary

The requested fixes are saved locally. They are not yet in a new installed APK/iOS app or a pushed application commit. Before distributing a build, run device acceptance for PIN cooldown after force-quit, SecureStore errors, OAuth import/revocation, video progress/fullscreen/backgrounding and session expiry. No Android device/emulator was connected when checked. Native JavaScript bundles do not substitute for an installed-device test.

Use the repository's Node 24.22.1 version for subsequent local builds. The machine-wide Node executable still reports 23.10.0; this review used a temporary patched runtime and did not replace the user's global installation. [Node October advisory](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases).

No quarantined files were restored, and the unidentified security-app alert was not diagnosed. The source files and backups checked remained present.

The [initial review](expo/docs/security/2026-10-26/initial-review.md) is retained as historical evidence. Its statements that three dependencies and the live backend check are still outstanding are superseded by this closeout.
