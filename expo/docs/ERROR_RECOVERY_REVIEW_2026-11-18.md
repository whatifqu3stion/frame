# Failure and recovery review — 18 November 2026

Result: substantial safeguards are present, but error handling is not yet fully signed off. A prolonged-buffering recovery gap was fixed. Silent playback-position persistence failures and native device acceptance remain open.

## Changes

- Added a 20-second timeout for a continuous buffering spell after the player becomes ready. It uses the existing error pathway to pause, exit fullscreen, stop allowance accounting, attempt to persist progress, and expose Retry at the current in-memory position.
- The buffering timer is cancelled when playback resumes, the player loses permission or visibility, its attempt changes, or the component unmounts. Changing the connectivity message does not restart its deadline. Recovery does not automatically restart playback.
- Added four lifecycle/timing regression tests and two discovery failure/recovery tests.

## Evidence

| Scenario | Result and scope |
| --- | --- |
| Billing denial and offline key verification | Passed in isolated Brave, mobile viewport. CDP supplied synthetic HTTP 402 and disconnected-request responses; messages differed correctly, Verify & save became usable again, and there were no automatic retries during the observed interval. |
| Explicit retry after connection failure | Passed in the same browser using a synthetic successful model response. UI correctly said generation is checked when requesting picks. No real credentials or paid provider requests were used. Reload cleared the synthetic tab-only key. |
| Provider errors and credential isolation | Automated tests pass for HTTP classification, credential-safe errors, missing keys, cancellation, malformed data, and no implicit retry. |
| Stalled response body | Automated test passes even when the underlying work ignores cancellation. |
| Failed key write | Automated test confirms the existing key remains; failed removal is surfaced. This uses injected storage, not a physical SecureStore failure. |
| Interrupted discovery | Automated tests confirm published reviewed picks survive cancellation and late quota failure; duplicate starts do not issue another run. Result-read failure does not become a successful empty edition. |
| App suspension/profile/key changes | Source review confirms discovery cancellation. Automated cancellation tests exercise the run service; real OS suspension was not performed. |
| Startup storage restoration | Automated tests keep startup blocked on failed restoration and allow retry without silently replacing existing profile data. |
| Prolonged playback buffering | New hook tests pass for timeout, recovery, visibility/permission cancellation, stale callbacks, attempt replacement, and current connectivity messaging. Native WebView buffering was not reproduced on hardware. |

Full `bun run verify`: TypeScript passes; lint has zero errors and one existing generated-types warning; **477 tests pass, zero fail** across 92 files. `git diff --check` passes. Browser runtime exception collection was empty.

## Remaining issues and acceptance work

1. **Playback-position failures are silent.** In `app/watch/[id].tsx`, failed resume reads allow playback to open without an explanation; periodic `recordResume` failures and completion position writes are swallowed. Viewing-limit persistence separately fails closed, but the user may still lose their latest resume position without knowing. Add restrained, persistent feedback and a retry path, keeping it separate from playback/network errors. Avoid claiming a position is saved until its write commits.
2. **Physical device checks remain required.** No Android device was attached and no iOS simulator was booted. Test airplane mode during playback/discovery, background/foreground, WebView termination, fullscreen recovery, and force-close during persistence on current native builds. The new timeout offers recovery; it does not prove that every native connectivity transition reports buffering.
3. **Live Gemini quality and generation access remain unverified by this pass.** Model lookup and synthetic provider responses cannot establish successful paid generation or recommendation quality. A real generation run with an authorized working account is a separate check.

No release was built or published during this review. Existing user data and real keys were not changed.
