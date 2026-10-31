# Pre-live-test native audit — 31 October 2026

> **Correction status:** All four findings below have now been implemented and passed automated verification. The original findings are retained as the audit record. See the implementation and confirmation section at the end; the original hold verdict below is historical, not the current candidate status.

## Verdict

**Hold the live-test candidate for one focused startup-recovery correction.** The navigation and visual system remain coherent and product-specific, but a broader review found a failure path missed by the preceding audit. This report supersedes the earlier “no remaining blocking defect” readiness conclusion; it does not invalidate the earlier fixes or passing tests.

Platform conformance: **conditional pass at source level, final approval withheld**. Four labelled destinations, native navigation stacks, native switches/pickers and explicit playback fit a native app. The main unresolved problem is how the app enters its normal navigation after failed initialization, not its visual identity. Android runtime conformance still requires live testing.

This was Impeccable's **native technical audit**, not a visual critique or a live-device test. No application code, stored profiles, provider credentials or signing configuration was changed. No build was packaged.

## Health score

| Dimension | Score | Finding / limit |
| --- | --- | --- |
| Accessibility | 3/4 | Strong labels, wrapping choices, contrast and reduced-motion coverage; narrow chart day targets remain. TalkBack is not certified. |
| Performance | 3/4 | Main content is finite, paginated or virtualized; Managed approval administration still renders unbounded lists. No hardware profiling. |
| Appearance & theming | 3/4 | Existing light/dark palette and viewing-room contrast tests pass; root crash recovery always uses light colors. |
| Platform conformance | 2/4 | Navigation/Back guards are present; failed initialization incorrectly unlocks normal navigation and setup. |
| Adaptivity | 3/4 | Scrolling sheets, keyboard-aware editors, wrapping rows and font-scale-aware navigation; Android landscape/IME/multi-window verification remains pending. |
| **Total** | **14/20 — Good, with a required correction** | **Provisional source assessment, not a device benchmark.** |

Verified findings: **0 P0, 1 P1, 2 P2, 1 P3**. Severity is based on impact and evidence; untested runtime behavior is listed separately.

## P1 — Startup/read failure is presented as usable default state

- **Locations:** `providers/AppProvider.tsx:130` (`loadPrefs`), `:251` (initial state), `:308` (initialize), `:350` (failure catch), `:909` (`updatePrefs`); `app/_layout.tsx:49` (initial routing).
- **Category:** Platform conformance / recovery and state integrity.
- **Verified trigger:** A database initialization or active-profile read rejects during startup. The catch logs the error and calls `setReady(true)`. Profile restoration has not completed; defaults include the Owner identifier, an empty profile array and incomplete onboarding. The root routing effect then treats those preferences as genuine setup state. It has no startup-error/retry surface.
- **Related verified behavior:** `loadPrefs` returns default preferences after a rejected read, not only when no saved preferences exist. Later `updatePrefs` merges a change into the in-memory preferences and writes the whole object. If storage reads fail temporarily and writes later succeed, existing preferences can be overwritten with defaults. This is a code-supported consequence, not observed damage to user data.
- **Reproduction:** Isolated execution of the actual initialization/catch source with mocked failures produced a warning followed by `ready: true` for both failures. Execution of the actual preference reader with a rejected storage read returned the default object without reporting failure to its caller. No real storage was touched. Evidence: `research/release-pass/qa/pre-live-audit-probes.json`.
- **Impact:** Returning users can see first-run setup or an unusable profile state instead of an actionable recovery screen. Recovery currently requires restarting, and preference writes may replace values that were never successfully read.
- **Boundary check:** `getManagedContentAccess` and `getPlaybackAllowance` reject missing profiles. This finding is **not** evidence of a PIN or playback approval bypass.
- **Recommendation:** Separate loading, ready and failed initialization. Show an explicit non-destructive Retry/reopen recovery state; hold normal navigation and writes until the profile snapshot is restored. Distinguish absent preferences from read/parse failure. Preserve existing saved data; do not solve this by resetting it. Cover failed initialization, failed preference read, successful retry, first-ever launch and restored Managed profiles in regression tests.
- **Suggested command:** `$impeccable harden`.
- **Timing:** Correct before live acceptance testing.

## P2 — Viewing-time day targets can be narrower than Android's minimum

- **Location:** `components/ViewingTime.tsx:119,127`; actual day Pressables at `:101`.
- **Category:** Accessibility / touch ergonomics.
- **Evidence:** `dayWidth = Math.max(44, 32 * fontScale)` establishes a 44 dp width at default font scale. At narrow phone widths, the horizontal plot's seven targets therefore remain 44 dp wide, without added hit slop. Their height is ample; the problem is width. This is a live interactive target, not a decorative bar.
- **Guideline:** Impeccable's Android reference calls for a minimum 48 × 48 dp touch target.
- **Impact:** Individual days are less forgiving to tap. The existing horizontal scrub interaction provides an alternative, but does not replace the tap target requirement.
- **Recommendation:** Use at least 48 dp per day while retaining the existing horizontal plot and selection logic. Verify that the selected day and all seven days remain reachable with larger text and TalkBack; avoid overlapping hit slop between adjacent days.
- **Suggested command:** `$impeccable adapt`.
- **Timing:** Small correction suitable for the same pre-live pass.

## P2 — Managed approvals do not bound rendered list size

- **Locations:** `components/ManagedContentAccessEditor.tsx:40,66,70`; `services/managedContentAccessService.ts:40`; `db/database.ts:381,406,430`.
- **Category:** Performance / large-data resilience.
- **Evidence:** Requests and the active approval list render using `.map()` inside the shared scrolling sheet. The backing queries return every matching row with no limit, and these approval collections have no maximum admission count. This differs from Sources' explicit 20-row pagination and Saved's FlatList.
- **Impact:** As approvals accumulate, opening or refreshing this settings subsection creates all row views together. Slower rendering and unwieldy scrolling are credible risks; dropped frames or a specific threshold were **not measured** on hardware.
- **Recommendation:** Add bounded pages and a way to find an approval, or use a virtualized list with appropriate sheet layout. Keep every existing approval accessible and preserve authorization and stale-decision guards. Do not cap or delete approvals to solve rendering cost. Test with a large synthetic collection outside the user's live data.
- **Suggested command:** `$impeccable optimize`.
- **Timing:** Before large-library acceptance testing; not a demonstrated blocker for a small fresh test profile.

## P3 — Crash fallback does not retain dark appearance

- **Location:** `components/ErrorBoundary.tsx:4,26`.
- **Category:** Appearance & theming.
- **Evidence / impact:** The root boundary imports the static light palette, causing a light recovery surface after a crash in dark mode. Recovery remains readable and usable.
- **Recommendation:** Supply a safe last-known appearance without depending on the provider that may have failed. Preserve simple fallback rendering.
- **Suggested command:** `$impeccable polish`.
- **Timing:** Optional; does not block live tests.

## What is working well

- Onboarding is a short, optional-interest → source → real-selection flow. Source entry precedes optional discovery, missing keys have truthful status/retry behavior, and empty setup can finish without a false reveal. The first-save moment uses a real saved link.
- Settings has a consistent hierarchy and wrapping rows. API setup is ahead of optional Google import. Storage failure prevents key mutation through stale status.
- Existing-session edits use a navigation removal guard; new-session drafts report saving/error state. Profile sheets distinguish Back from Close and protect dirty edits. Google import uses keyboard avoidance and handled taps.
- Shared motion respects OS reduced-motion preferences. Viewing-room lighting affects the background rather than dimming the video or delaying playback. Six appearance/accent combinations and the light-transition contrast checks pass.
- The app maintains finite selections and explicit playback. Preview fixtures are restricted to web development mode. Sources and SourceLibrary paginate; Saved uses FlatList. No broad redesign or animation rewrite is justified by this audit.
- The existing source guards continue to reject missing profile approval/allowance state. Failure recovery should preserve that behavior.

## Verification and limits

- Fresh targeted verification: **37 tests, 422 assertions, zero failures across 9 files** covering themes, storage-status decisions, exit decisions, Managed access, artwork/chart geometry, player lifecycle, onboarding Back and room lighting. Output: `research/release-pass/qa/pre-live-audit-tests.log`.
- Startup/preference failure probes executed source with injected failures and no real storage. These expose a gap in the otherwise passing suite; a passing suite is not proof that this recovery path works.
- The preceding full run remains **377 tests / 2,037 assertions**, TypeScript passing, zero lint errors and one existing generated-file warning. Application code has not been edited in this audit, so the full run was not needlessly repeated.
- `git diff --check` passes. SHA-256 fingerprints for the four finding locations are stored in `research/release-pass/qa/pre-live-audit-source-sha256.txt`.
- No new browser/simulator/device visual claim is made. The native audit is source-based; no browser workaround was attempted after the preceding access-policy rejection. Existing screenshots are prior evidence only.
- No current Android TalkBack, font-scale, native picker appearance, keyboard/inset, predictive Back, startup performance or live provider playback sign-off exists. Those remain the purpose of the next live-test stage.
- This is not a fresh dependency advisory lookup or hosted-service penetration test. The earlier same-day security report still records three outstanding tooling advisories; see `security/2026-10-31/review.md`.

## Recommended order

1. **P1 — `$impeccable harden`:** startup and preference-read recovery, with regression tests.
2. **P2 — `$impeccable adapt`:** chart target width and selected-day reachability.
3. **P2 — `$impeccable optimize`:** approval-list rendering before large-library testing.
4. **P3 — `$impeccable polish`:** optional crash-appearance consistency.

These can be run separately or together. Re-run `$impeccable audit` after corrections, then use the Android acceptance sequence in `RELEASE_CANDIDATE.md`: cold launch and setup; save/restart; real playback and interruptions; Managed limits; TalkBack, large type, theme and Remove animations.

## Implementation and confirmation — 31 October 2026

**Current verdict: the four audited code defects are corrected; ready for live acceptance testing of a new candidate build.** This is source/automated confirmation, not native visual or hardware certification. Packaging has not run in this pass.

| Finding | Correction | Confirmation |
| --- | --- | --- |
| P1 startup/read recovery | `StartupGate` keeps navigation and feature screens unmounted until the profile snapshot is restored. Failed initialization shows a non-destructive retry screen; repeated retry presses coalesce. Preference and Owner-action callbacks refuse work before restoration. `loadProfilePreferences` defaults only for an absent record, propagating failed reads and malformed records. | Actual startup effect tested with database, active-profile and snapshot failures; successful retry restores an existing Managed profile. Tests cover fresh setup, departed initialization, gate rendering, repeated retries, protected early actions, read failure without writes, malformed records and successful preference retry. Existing SQLite initialization already clears rejected cached opens, so retry can attempt a new open. |
| P2 chart target width | Day columns now have a 48 dp minimum. Focusing a day scrolls it into view without changing the selection or starting an animation. | Source and TypeScript verification. Existing chart geometry/selection tests pass; native TalkBack traversal and finger targeting remain live-test checks. |
| P2 approval collection rendering | Requests and approvals each render at most 20 rows, with separate search and page controls. Empty searches explain the result. Pages clamp when records disappear; profile/mode changes remount the editor to reset its search/page scope. Busy mutations disable search/page changes. | Actual editor render tested against 1,003 requests and approvals: 20 rows per list, final-page access and search for the last entry. Collection tests cover complete traversal without dropped records, Unicode/case-insensitive search, empty results and final-page removal. |
| P3 crash appearance | Shared `RecoveryScreen` uses a memory-only copy of the last committed appearance, with system appearance as the initial fallback. It imports neither AppProvider nor storage. Root crash and startup recovery use this independent surface. | Tests verify system fallback, dark/rose retention despite light system appearance, later light/green updates and protection against mutation of the remembered value. |

Approval pagination bounds rendered views; it does not introduce database pagination or change the approval/access model. Existing records are retained and remain searchable. Runtime performance at very large database sizes is still a live profiling question.

Verification: **390 tests pass, 0 fail, 2,156 assertions across 79 files**. TypeScript passes; lint has zero errors and only the existing unused-disable warning in generated Supabase types. `git diff --check` passes. Full log: `research/release-pass/qa/pre-live-fixes-verification.log` at the repository root. No new dependency or plugin was needed, and no user library data or credentials were used for failure tests.

### Browser confirmation after user reload

The user reloaded the preview and confirmed Frame was visible. The existing localhost tab then became accessible through the browser tool; the earlier access-policy rejection was not bypassed.

- Normal startup reached Sources, and navigation through Today, Settings and Appearance worked. No browser console errors were returned during this check.
- At 390 × 844, all seven chart buttons measured **48 × 107 CSS pixels**. At 320 × 740, keyboard traversal brought the first and last day fully inside the chart viewport; Enter changed the selected day. The document remained 320 pixels wide, with chart overflow confined to its intended horizontal scrolling region.
- At 320 × 740, light and dark Appearance controls remained readable without clipping. Settings summaries wrapped, and the Profiles & boundaries sheet opened and closed. The original Light / Mineral blue appearance and default viewport were restored; the preview was returned to Sources.
- Evidence: `research/release-pass/qa/pre-live-fixes-appearance-light-320.png`, `pre-live-fixes-appearance-dark-320.png`, and `pre-live-fixes-settings-dark-320.png`.

No further code correction was needed in this browser confirmation. This preview contains only an Owner profile, so approval paging/search retains automated component coverage rather than a live interaction sign-off. Recovery failures were not induced in the user's data; their confirmation remains isolated regression testing. Confirm the new recovery surfaces, approval paging/search and chart focus on the current Android build alongside playback, Back, keyboard/insets, font scaling and TalkBack. Browser CSS dimensions do not certify native touch behavior.
