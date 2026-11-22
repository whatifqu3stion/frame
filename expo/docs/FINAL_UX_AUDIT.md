# Final hardening and native source audit — 31 October 2026

> Superseded readiness verdict: the subsequent [pre-live audit](PRE_LIVE_AUDIT.md) found a P1 startup-recovery issue, two P2 issues and the existing P3 appearance issue. The earlier hardening changes and test results below remain historical evidence; use the newer report for release decisions.

## Verdict

**Source-level pass for preparing a test APK; native release acceptance remains pending.** Frame uses a coherent four-destination navigation model, native navigation stacks, bounded scrollable sheets, semantic appearance tokens, and shared motion/accessibility behavior. No confirmed P0 or P1 defect remains in the code reviewed in this pass. This is not a claim that every interaction has passed on Android hardware.

Packaging is paused at the user's request. No packaging process was running when this pass checked, and no APK was produced or certified by this pass. The old build 1 is not evidence for this working tree.

The audit followed Impeccable's native audit playbook and Android/iOS references. Scores below are provisional source-review judgments, not measured device benchmarks or an accessibility certification.

| Dimension | Score | Evidence and limit |
| --- | --- | --- |
| Accessibility | 3/4 | Labels, busy/disabled states, expanding text, 48 dp primary controls, shared OS motion preference, and contrast tests. TalkBack traversal and large system text still need the current native build. |
| Performance | 3/4 | Saved uses FlatList; Sources and SourceLibrary paginate at 20; Today is finite; first reveal is limited to three videos. No current hardware startup/frame-time profiling. |
| Appearance & theming | 3/4 | Six appearance/accent combinations pass semantic text-contrast tests; viewing-room transitions also pass. Root crash fallback uses fixed light colors. |
| Platform conformance | 3/4 | Native stack/back behavior, safe-area handling, native Switch/alerts, keyboard-aware sheets. Android Back focus regression passes; predictive Back/IME behavior is not yet device-verified. |
| Adaptivity | 3/4 | Bounded reading/collection widths, expanded navigation rail, font-scale-aware navigation and video rows, scrollable forms/sheets. No current Android landscape, multi-window or foldable acceptance evidence. |
| **Total** | **15/20 — Good, provisional** | **Build a test candidate next; retain native acceptance gates.** |

## Hardening completed before the audit

1. **Setup status is truthful while loading.** `components/OnboardingFlow.tsx:146` distinguishes checking, error, unavailable storage, and a successfully read missing key. It no longer flashes a missing-key instruction before the read completes.
2. **Storage errors have device-appropriate recovery.** `domain/providerKeyStatus.ts:14`, `components/ProviderKeySettings.tsx:86`, and `app/(tabs)/settings.tsx:38` distinguish unsupported browser storage from unavailable native storage. Native failures offer retry; source input is preserved.
3. **Failed refreshes cannot authorize UI key changes using cached presence.** `components/ProviderKeySettings.tsx:51` and its edit/save/remove controls require a successful storage status. The settings panel now uses the shared presence-only query hook. Keys remain in SecureStore; no credentials were accessed during QA.
4. **The onboarding primary button keeps its accessible name while busy.** `components/OnboardingFlow.tsx:134` retains the next-action label when its visible text becomes a spinner.
5. **Session timing help meets Android's target-height minimum.** `app/session/[id].tsx:193` now uses 48 dp rather than 44 dp. Its existing descriptive label and expanded state remain.

## Remaining findings

Confirmed UI findings after hardening: **P0: 0; P1: 0; P2: 0; P3: 1**, within the reviewed scope. Unverified device behavior is listed separately rather than counted as a demonstrated defect.

### P3 — Root crash recovery does not retain dark appearance

- **Location:** `components/ErrorBoundary.tsx:4,26`.
- **Category:** Appearance & theming.
- **Evidence:** The boundary imports the static light palette and sits outside AppProvider. Its recovery screen therefore remains light if the main application fails while dark appearance is selected.
- **Impact:** A rare visual discontinuity during a rendering failure; the recovery action and readable content remain available. It does not block packaging a test candidate.
- **Recommendation:** If addressed later, provide the last known appearance through a failure-safe boundary input; do not make crash recovery depend on the provider that may have failed.
- **Suggested command:** `$impeccable polish` for this narrowly scoped recovery surface.

## Positive findings and rejected false positives

- Settings rows wrap their summaries, maintain a shared hierarchy and use at least 56 dp row height. Dangerous reset is separated from routine settings and requires typed confirmation plus a final decision.
- Source lookups abort on unmount; source confirmations and protected writes have operation guards. Provider transport has explicit deadlines, cancellation and sanitized errors.
- `Sheet` gives long forms a scrollable, inset-aware container. Onboarding retains a scrollable body and wrapping footer; input uses a stable focus border without changing field geometry.
- `FrameText` preserves OS font scaling; `useNavigationLayout` increases navigation clearance with font scale. Video rows stack at narrow widths or larger type.
- `MediaImage` preserves image geometry on failure. VideoCard's `Image` import is this wrapper, so its explicit transition still honors reduced motion. It is not a raw unguarded image animation.
- Sources' ScrollView is **not** an unbounded rendered library: `sourcePageItems` slices to 20. SourceLibrary also paginates; Saved uses FlatList. No virtualization rewrite was warranted.
- ProfileControlsModal's 28/40 dp icon styles flagged by text search are unused styles, not active undersized controls. Decorative swatches/avatars likewise are not standalone targets.
- Artwork is square, motion is shared and interruptible, and the viewing-room lighting changes the background rather than dimming the player or delaying playback. This pass preserved the existing design direction.
- Brand typography and the consistent Lucide icon set are established product choices. Replacing them wholesale with system faces/icons would be a redesign, not final hardening.

## Verification and scope

- Fresh `bun run verify` using pinned Node 24.22.1 and Bun 1.4.4: **377 tests pass, 0 fail, 2,037 assertions across 74 files**. TypeScript passes. ESLint: zero errors, one existing unused-disable warning in generated Supabase types.
- New regression cases cover pending reads, failed refresh with cached credentials, missing data, unavailable storage, valid present/absent keys and platform-specific recovery.
- Existing checks include all six palette combinations, viewing-room contrast throughout the transition, reduced-motion behavior, onboarding Back ownership, request cancellation/failure, PIN protection, Managed scope, session timing, retention and dependency regressions.
- The session target-height adjustment was made after the full check began; the final session file also received a focused ESLint check. `git diff --check` passed.
- Full output: `research/release-pass/qa/final-hardening-verification.log` at the repository root. Prior browser preview captures and its earlier verification output remain beside it; they are **prior evidence**, not fresh screenshots of this pass.
- A local web preview was started, but the browser tool rejected access to the existing tab under its URL security policy. No alternate browser surface or bypass was used. This pass therefore makes no new visual QA claim.
- No current Android runtime, TalkBack, physical-device performance, live API-key setup, OAuth, or real YouTube playback was certified. The earlier iOS simulator bundle was stale and is not used to certify these changes. No destructive reset was performed on user data.
- Security inventory from the earlier same-day review remains **0 high/critical, 2 moderate and 1 low**. These are outstanding tooling advisories, not fixed findings; see [security review](security/2026-10-31/review.md). This UI audit did not repeat an advisory network lookup or audit hosted legacy infrastructure.

## Acceptance gates after creating the test APK

1. Cold-launch without Metro; complete first-run setup, verify/add a real YouTube key locally, return to onboarding, follow a creator, save a video, restart and confirm persistence. Exercise unavailable/failed storage recovery on a test environment without erasing the user's device data.
2. Play a real video; pause/resume, rotate/fullscreen, use Android Back, background/resume, interrupt connectivity, finish a timed session and explicitly choose the next video. Verify Managed approval/limit behavior.
3. Check TalkBack focus/order, larger system text, keyboard/insets, light/dark appearance and Remove animations on the current Android build. ADB connectivity or a successful build alone is not an interaction pass.

These are release acceptance gates, not reasons to redesign more screens. The next appropriate step is preparing a **test APK**, then recording actual device results in [the release candidate record](RELEASE_CANDIDATE.md). Optional P3 cleanup can be handled with `$impeccable polish`; rerun `$impeccable audit` after any further fixes.
