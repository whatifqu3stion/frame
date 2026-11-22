# Technical critique — November 20, 2026

## Platform conformance verdict

Source-level pass with native acceptance outstanding. Frame has native navigation, safe-area handling, keyboard-aware forms, explicit playback recovery and accessible control semantics. This review did not confirm a new navigation/inset violation or justify a visual redesign. It does not certify hardware Back/fullscreen, VoiceOver/TalkBack, native rendering, haptics or frame-time performance.

Impeccable's native technical audit was applied to the current working tree. This was a review only: application code was not changed. The context loaded earlier in this session was reused.

## Executive assessment (initial review)

Two confirmed P2 persistence findings; no new P0/P1 defect confirmed in this bounded pass. These are adjacent to, but separate from, the resume-progress recovery fixed earlier today. The existing save/retry behavior and updated release handoff remain improvements.

The next release also requires an exact new binary and device/live-provider acceptance. That is a verification gap, not evidence that Gemini or native playback is currently broken.

## Findings

### P2 — Resolved in the follow-up below: Session completion can silently skip advancement during a profile switch

- **Location:** `providers/AppProvider.tsx:1189–1194`; `app/watch/[id].tsx:651–654`.
- **Category:** Implementation integrity / data recovery.
- **Trigger:** A session video ends, its completion operation waits for `clearVideoResume`, and the user leaves Watch and switches profiles before that wait settles.
- **Behavior:** `updateSessionPosition` returns `false` because the captured profile is no longer active. The completion callback ignores that result. The writer sees a successful operation and clears recovery state even though the saved session cursor never advanced.
- **User impact:** On returning to that profile, the session can still point at the completed video. There is no Retry notice for the skipped advancement. This does not write the other profile’s data or establish a permissions bypass.
- **Evidence:** Executed the actual extracted `handleEnded` and `updateSessionPosition` callbacks with a deferred resume-clear operation and the real recovery registry. Result: `resumeCleared: true`, `positionWrites: 0`, `recoveryFailures: 0`.
- **Recommendation:** Distinguish a superseded queue edit from a profile-switch cancellation. Either finish the authorized completion against its captured profile with deletion/reset protection, or retain a retryable completion until that profile is active. Do not treat every `false` compare-and-set result as an error: reordered/deleted sessions legitimately make an old cursor update obsolete.
- **Suggested command:** `impeccable harden`.

### P2 — Resolved in the follow-up below: Timed-session final checkpoints still lose recovery after unmount

- **Location:** `hooks/useSessionTimer.ts:18–32`.
- **Category:** Implementation integrity / error feedback.
- **Trigger:** Leaving a timed session queues its final `saveSessionRun` write, and that write rejects after cleanup has set `alive = false`.
- **Behavior:** The timer uses its own component-owned write chain. Its error handler only updates state while mounted; cleanup catches and discards the rejection. It is not part of the app-level progress recovery registry.
- **User impact:** The latest elapsed time, or a failed session-ending update, may be absent when the session is reopened, with no retry available outside Watch. Normal five-second checkpoints limit the typical elapsed-time loss. This finding is about the selected session’s timer, not the independently stored daily/Managed viewing allowance.
- **Evidence:** Executed the actual timer hook’s storage effect and cleanup with an injected rejected final save. Result: one attempted write, no error-state signal after unmount and no app recovery entry. The hook harness substitutes React hook primitives to isolate persistence behavior; this is not a device disk-failure test.
- **Recommendation:** Give timed-session checkpoints/end operations app-owned recovery keyed by profile, session and run. Preserve existing monotonic/run-ID safeguards and integrate deletion/reset disposal. Add an integration regression for navigation during a failed final timer save.
- **Suggested command:** `impeccable harden`.

## Evidence and scope

Reproduction source: `research/technical-review/2026-11-20-audit/reproduce.ts` at repository root. Output: `reproduction.log` in the same folder. It executes callbacks extracted from current source and injects only storage delays/failures; no real provider keys, network generation or user data are involved.

The most recent verification of this unchanged application source passed **496 tests, 3927 assertions across 96 files**, with TypeScript passing and zero lint errors (one existing generated-file warning). The new reproductions exercise scenarios absent from that suite. Passing tests alone did not expose these two cases. Full-suite evidence remains `research/technical-review/2026-11-20-verification.log`.

Inspected playback lifecycle and native bridge error handling; progress and timer queues; profile switching/deletion/reset; provider-key mutation and cancellation; bounded provider transport; discovery checkpoints and edition handling; list bounds; and representative onboarding accessibility/reduced-motion code. This is a bounded source audit, not exhaustive formal verification or a fresh device visual audit.

## Audit health score

Provisional source-based assessment, unchanged from the last native audit:

| Dimension | Score | Assessment |
| --- | --- | --- |
| Accessibility | 3/4 | Named actions, static screen-reader benefits content, text scaling and reduced-motion paths; native traversal still unverified. |
| Performance | 3/4 | Batched metadata, virtualized/paged collections and reduced timer publications; no native profiling evidence. |
| Appearance and theming | 3/4 | Existing semantic palette and typography retained; no new visual claim in this source-only pass. |
| Platform conformance | 3/4 | Native navigation and recovery mechanisms; the two persistence edge cases weaken task continuity. |
| Adaptivity | 3/4 | Safe-area and keyboard-aware structure; native rotation, enlarged text and multitasking require acceptance. |
| Total | **15/20 — Good** | Not a store-approval or release-readiness certification. |

## Positive findings

- Final resume-position failures now survive leaving Watch, remain profile-scoped, and are retryable. Data resets drain/retire those operations before deleting records.
- Playback authorization and accounting are serialized; departing/backgrounded playback invalidates stale starts.
- API keys stay out of request URLs and public error content. Requests are time-bounded, key changes cancel requests, and quota/billing/access failures have explicit handling.
- Discovery validates provider responses and verified YouTube metadata, checkpoints reviewed results, and limits requests rather than retrying indefinitely. This establishes defensive implementation, not live recommendation quality.
- Session edits commit together; missing metadata reads are batched. The native resume list is bounded to 24 records; session collections are paged or virtualized.
- Release documentation now identifies build 4 as historical and explicitly states that the current working source is not represented by a new binary.

## Recommended next actions

1. **P2 — `impeccable harden`:** Address both session persistence paths together, with actual-callback/integration regressions for departure and profile switching.
2. **`impeccable audit`:** Confirm those scenarios and the normal save/retry tests after changes. Keep the existing successful recovery behavior intact.
3. Build and identify the exact candidate, then test funded Gemini generation, real YouTube playback, restart/key persistence, fullscreen/Back/background transitions, profile controls and native accessibility on that build. A model lookup is not proof of successful generation.
4. **`impeccable polish`:** One bounded confirmation of any recovery UI changes; no new visual redesign is warranted by these findings.


## Authorized implementation and confirmation — November 20

Both findings are resolved in the current working source:

1. Watch completion now uses `completeSessionPosition`, which captures the originating profile. Switching profiles does not turn an authorized completion into a false success. Manual Next/Replay still uses the active-profile guard. The existing queue comparison treats a concurrently edited/deleted session as obsolete, while genuine storage failures remain retryable. The recovery registry drains/retires completion writes before profile deletion/reset.
2. The actual timed-session hook now uses the same app-owned registry, in a separate session namespace. Each operation captures its run ID and checkpoint, preserving the database’s monotonic/reset protections. Failed writes survive departure; reopening waits for pending writes and blocks stale playback if saving failed. Retry is available in Watch and through the global notice outside it. Read failures also have a local retry. The End session action is hidden while time is unavailable, so it cannot imply a successful ending when the timer could not load.

Eight new regressions cover actual completion callbacks and timer effects; two additional checks cover failed timer reads and separation of video/session identifiers. The hook harness executes the current source with deterministic hook scheduling and injected storage failures. Existing SQLite tests independently verify monotonic timer writes and rejection of stale run IDs.

**Final verification:** 506 tests pass, zero failures, 3960 assertions across 97 files. TypeScript passes. Lint has zero errors and the existing generated-types warning. `git diff --check` passes. Log: `research/technical-review/2026-11-20-session-recovery-verification.log` at repository root.

**Bounded UI confirmation:** In an isolated 320 × 844 browser context, injected a session-time failure into the actual recovery registry. The correct timer-specific notice appeared on Today without horizontal overflow; Retry saved the operation and dismissed the notice. No page errors occurred. Screenshot: `research/technical-review/2026-11-20-session-recovery/session-recovery-320.png`. Watch’s local retry uses the existing state-panel/button styles; its recovery behavior is covered by the hook tests. This is not a physical-device visual or disk-failure certification.

The earlier reproduction script/log records the pre-fix audit; current regression tests supersede that diagnostic. No native performance/a11y score increase is claimed from these source tests. No new APK was built or published. Live-provider and exact-candidate device acceptance remain required. Recovery remains app-process memory rather than durable storage across force-quit.
