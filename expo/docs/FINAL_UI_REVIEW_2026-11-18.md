# Frame — final prepublication UI review

November 18, 2026. Impeccable native audit, read-only application review.

## Verdict

**Preserve the current visual direction; hold public-release sign-off pending the items below.** The implementation reads as a deliberately designed native app, not a generic website shell: four destinations, adaptive navigation, safe-area handling, real native fields/sheets, explicit playback, grouped Settings, and consistent editorial materials. No redesign is recommended.

The source-level platform verdict is a qualified pass. Some Android targets are undersized, and this pass did not establish runtime gesture, screen-reader, keyboard, or playback acceptance. No simulator was booted and `adb devices` found no connected Android device. Existing six-theme session screenshots were inspected as historical visual evidence, not new native captures. This is not a full App Store/Play compliance audit or approval guarantee.

## Provisional audit score

Scores describe inspected implementation, not measured physical-device performance or certified accessibility.

| Dimension | Score / 4 | Evidence and limit |
| --- | --- | --- |
| Accessibility | 3 | Named controls, selected states, scalable native text, and static benefits alternative; some Android targets remain 44 dp. VoiceOver/TalkBack traversal not exercised. |
| Performance | 2 | Saved uses FlatList and Sources is paged; session detail eagerly renders up to 500 entries. Native frame pacing not measured. |
| Appearance & theming | 4 | Coherent six-theme tokens and accent galleries. Checked primary/secondary gallery text pairs exceed 4.5:1; this is not an exhaustive composited contrast test. |
| Platform conformance | 3 | Native stack/sheets, explicit playback and platform haptics; hardware Back, rotation, and fullscreen remain acceptance gates. |
| Adaptivity | 3 | Bounded reading/collection widths, adaptive navigation, text-aware choices and keyboard handling in source. Large-text/landscape behavior needs native confirmation. |
| **Total** | **15 / 20** | **Good implementation; release verification remains incomplete.** |

## Confirmed findings

### P1 — People cannot clearly contact Frame support

- **Location:** `expo/components/SettingsDetails.tsx:148`, `expo/app/terms.tsx:12`, `expo/app/privacy.tsx:11`.
- **Category:** Implementation integrity / recovery UX.
- Help & about provides instructions and diagnostics, but no Frame support destination. Terms links to YouTube's terms; Privacy does not identify a contact route. A diagnostic share sheet does not tell a viewer whom to contact when keys, billing, or playback fail.
- **Fix:** Add a real Contact support row with a monitored address or support form. Match the public Support URL; make the privacy contact discoverable. Do not invent a contact address.
- **Store relevance:** Apple's guideline 1.5 asks for an easy contact method in the app and Support URL. [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/#developer-information).
- **Suggested command:** `$impeccable harden`.

### P1 — Release checks and the acceptance guide still describe retired behavior

- **Location:** `expo/services/foundationSafety.test.ts:49`, `expo/services/releaseHandoff.test.ts:7`, `expo/docs/SMOKE_TEST.md:5`, `expo/eslint.config.js:7`.
- **Category:** Implementation integrity / release validation.
- Full test run: **462 passed, 2 failed, 464 total, 89 files, 3,342 assertions**. One assertion requires Google selective import to be enabled even though the product retired it. The other requires old import language in the smoke guide. The guide also retains sample-checkout, beta billing, and shared-service-era instructions despite a superseding note.
- A broad ESLint run fails on generated `dist-render` bundles because only `dist/*` is ignored. Application-source lint has **zero errors and two warnings**. Generated-bundle errors are not evidence of thousands of application defects.
- **Fix:** Assert that new Google import is unavailable while testing legacy cleanup, refresh the actual BYOK acceptance contract, and exclude generated build output from lint. Preserve behavioral coverage instead of merely deleting failing assertions. Make the documented release command green before distribution.
- **Suggested command:** `$impeccable harden`.

### P2 — Shared information and secondary controls undershoot Android touch guidance

- **Location:** `expo/components/InfoButton.tsx:17`; also `expo/components/WelcomePhone.tsx:260`, `expo/components/ConnectionWalkthrough.tsx:136`, `expo/components/OnboardingFlow.tsx:336`.
- **Category:** Accessibility / platform conformance.
- The shared info control is exactly 44 × 44 with no enlarged hit area. The phone preview replay is also 44 × 44; some secondary links use a 44 minimum height. This meets the iOS size convention but falls below the 48 dp Android target used elsewhere in Frame.
- **Fix:** Use at least 48 × 48 interaction bounds without enlarging the visible icon. Keep adjacent hit areas distinct. The compact Today stepper is not a defect: its 32-unit visual face sits inside a 48-unit target.
- **Suggested command:** `$impeccable adapt`.

### P2 — Long session detail pages are not virtualized

- **Location:** `expo/app/session/[id].tsx:42`, `expo/app/session/[id].tsx:92`, `expo/app/session/[id].tsx:130`; limit in `expo/constants/productConfig.ts:7`.
- **Category:** Performance.
- Session detail fetches all item records with Promise.all and maps every row, thumbnail and recovery component into a ScrollView. The product permits 500 items. A small demonstration session does not exercise this path; mounting all entries creates avoidable work and memory pressure.
- **Fix:** Use a FlatList with the editorial cover as its header, stable item keys, and bounded initial rendering. Consider batching local metadata reads. Preserve queue order, current position, and unavailable-item recovery. Profile on a representative Android phone; no dropped-frame rate was measured here.
- **Suggested command:** `$impeccable optimize`.

### P2 — Study animations lack the app's visibility guard

- **Location:** `expo/hooks/useStudyReveal.ts:14`.
- **Category:** Motion / lifecycle consistency.
- The study hook respects Reduce Motion and unmount cancellation, but does not observe route focus or app foreground state. In contrast, the benefits timeline uses `useMotionVisibility`. The code does not guarantee that a chart waits for the viewer when they background the app; exact suspension behavior needs device reproduction.
- **Fix:** Apply the shared visibility boundary, retaining elapsed progress so foreground return continues coherently. Do not restart every chart or remove the existing static reduced-motion result. Verify that completion callbacks cannot mark a hidden stage finished unexpectedly.
- **Suggested command:** `$impeccable animate`.

**Count:** 0 P0, 2 P1, 3 P2. No cosmetic P3 backlog proposed.

## What should remain

- The paper/ink material, Caslon/Hanken pairing, and accent-specific session galleries form a coherent identity. Preserve them.
- The first-discoveries composition gives actual content priority. Generation requires an explicit action, exposes costs/data use, offers cancellation, and retains accepted partial results.
- Videos / Sessions and Followed / Discover are understandable sibling switches; grouped Settings and contextual information controls are materially clearer than persistent explanatory blocks.
- Benefits provide a static Reduce Motion/screen-reader alternative. Native text scaling is retained in real UI; small noninteractive phone-demo labels are intentionally illustrative.
- The centralized haptic gate avoids web vibration, stale callbacks, no-op feedback, and rapid bursts.
- Checked gallery text contrast: ivory primary 8.30–11.79:1, secondary 5.47–7.77:1 across all six grounds. Sampled light-theme action text and primary muted text also pass 4.5:1. These calculations exclude image/texture compositing and do not certify every control state.

## Required release evidence, not confirmed bugs

1. **Current native build:** clean install and upgrade, onboarding, key save/relaunch/remove, keyboard and large text, VoiceOver/TalkBack, offline/retry, and profile switching. Include real iPhone and Android playback entry, rotation/fullscreen, Back, background/resume, House lights on/off, and haptics on/off.
2. **Live providers:** a real Gemini generation with a funded/eligible test key, verified YouTube results, first-three reveal, continued completion, cancellation, empty results and provider failure. Passing mocks or model lookup does not prove the complete recommendation journey.
3. **Reviewer access:** supply an explicit, workable review procedure and necessary resources for BYOK features. Do not expect reviewers to establish and fund their own Google projects. The existing development-only sample reveal is not a full-featured production review path. Apple requires full review access; exact submission arrangements remain to be confirmed in the console. [App Review Guidelines, Before You Submit](https://developer.apple.com/app-store/review/guidelines/#before-you-submit).
4. **Submission records:** this pass did not inspect App Store Connect/Play Console declarations, public privacy/support URLs, asset licences, or the final signed binary. Their status is unknown, not passed.

## Validation record

- TypeScript: passed (`tsc --noEmit`).
- Full Bun suite: 462 passed / 2 failed as classified above.
- Source ESLint: 0 errors / 2 warnings (`ActionReveal` cleanup ref and unused `Alert` import).
- Broad ESLint: failed on generated web bundles; tooling scope needs correction.
- No UI, source behavior, credentials, or deployment state changed during this audit.

Prioritize support/release-check fixes, then hit areas and study lifecycle, then long-session performance. Finish with one `$impeccable polish` confirmation pass on the release candidate. The next useful investment is release evidence and these bounded corrections, not another visual redesign.

## Implementation follow-up — November 18, 2026

Authorized fixes applied after this audit:

- Release tests now assert retired import is disabled. The current BYOK smoke checklist replaces conflicting historical instructions, preserved in `docs/history/SMOKE_TEST_BEFORE_2026-11-18.md`. ESLint excludes generated web output; the two application-source warnings were addressed.
- Info, phone replay and identified secondary onboarding/help targets now use 48-unit interaction bounds, preserving the icon sizes.
- Session detail uses FlatList with the editorial header retained, eight initially rendered rows, and bounded render batches. Session detail and programme metadata reads are capped at 20 concurrent local reads and stop subsequent batches on cancellation.
- Study animation uses a foreground/route-visible elapsed-time clock, preserving opening delay and eased progress across interruptions. Completion is once-only and generation-guarded; Reduce Motion settles without completing a hidden stage.
- Contact support remains pending a confirmed email address or public support page. No placeholder or unconfirmed destination was added.

Validation: `bun run verify` passed through TypeScript, Expo lint (zero errors; one pre-existing generated Supabase type-file lint-directive warning), and **471 tests / 0 failures**. New regressions cover 500-item ordering/concurrency, cancelled/failed metadata reads, chart pause/resume, hidden completion, Reduce Motion, and unmount. A fresh browser check exercised onboarding and Saved → Sessions → session detail; the editorial layout remains intact. These checks do not replace the physical-device and live-provider gates above. No publication or new signed build occurred.
