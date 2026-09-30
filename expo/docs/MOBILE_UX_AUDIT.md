# Frame mobile UX audit — September 30, 2026

Implementation update: all eight findings below were addressed in the September 30 correction pass. The original audit and scores remain as a baseline; native acceptance checks are still pending. See the implementation record at the end.

## Verdict

Frame has an appropriate native mobile foundation: four labelled destinations, native stack navigation, self-contained tasks, native switches/pickers, explicit playback, and deliberate stopping points. It is not a website-shaped navigation system. **Full platform-conformance approval is withheld** because Back behavior, edit preservation and several control details need correction. Preserve the established typography, palette, matte media and restrained motion.

This is a source-based Impeccable native audit of mobile interaction patterns, not a hands-on usability or performance test. Reviewed baseline: remote draft PR #18 at `851acdbe848b5cdb90edb1517914e655bc4d582b`, corresponding local implementation commit `f817a74`. The PR was freshly verified as open, draft and unmerged. No application code was changed for this audit; Impeccable's native audit is review-only. Earlier implementation authorization permits a subsequent focused harden/adapt pass.

Scope: route configuration; tab shell; Today/Sources/Saved; onboarding and Premium preview; session creation/editing/detail; subscription import; shared sheets, source setup, profile switching/administration, PIN/reset; Watch close/back/orientation and allowance warnings. Route/control searches supplement focused source reads. This does not claim a fresh line-by-line re-audit of every provider or platform-owned control. No current simulator screenshots were available; neither `adb` nor `xcrun` is installed. Browser substitutes were not used.

## Provisional source health

| Dimension | Score / 4 | Evidence and limitation |
| --- | --- | --- |
| Accessibility | 2 | Widespread roles, labels, minimum heights and reduced-motion handling; several 44-unit targets remain on Android, plus legacy press scales. Actual screen-reader traversal is untested. |
| Performance | 3 | Main Saved/import/session lists are virtualized, Today and weekly selections are bounded. Followed sources render together up to the configured 100-source cap. No frame-time measurement available. |
| Appearance/theming | 4 | Six token-based appearances, brand consistency and existing contrast coverage. This score describes the source system, not visual sign-off. |
| Platform conformance | 2 | Appropriate navigation structure; inconsistent Back behavior, misleading sheet grabbers and unprotected unsaved edits. |
| Adaptivity | 2 | Shared safe-area/keyboard handling and landscape player layout; import keyboard accommodation and large-text dock/tab behavior need work or verification. |
| **Total** | **13 / 20** | **Acceptable source foundation; targeted mobile corrections needed.** |

Eight findings: **0 P0, 3 P1, 5 P2, 0 P3**. Scores are editorial prioritization, not benchmark measurements. No P0 was established from source; runtime blockers cannot be excluded without a build.

## Priority findings

### P1-1 — Existing session edits can be lost despite the saved-draft promise

- **Location:** `expo/app/session.tsx:47–54`, `:147`; navigation setup in `expo/app/_layout.tsx`.
- **Category:** Platform conformance / error prevention.
- **Verified:** draft persistence explicitly returns when an existing-session `id` is present. The subtitle still says the draft is saved. No route-removal/dirty-edit guard exists in the reviewed route.
- **Impact:** a person can rename or reorder an existing session, use Back/dismiss, and lose changes without warning. The reassurance about saving is inaccurate for this mode.
- **Recommendation:** distinguish new-session draft persistence from explicit editing. Add a dirty-edit exit decision covering header Back, Android Back and native dismissal. Preserve the edit if they stay; only discard after an explicit choice. Suppress the guard after successful Save and during authorized profile/reset teardown. Do not auto-write protected changes just to simplify navigation. Use truthful copy for editing and failed saves.
- **Suggested command:** `$impeccable harden`.

### P1-2 — Android Back exits the entire profile workflow

- **Location:** `expo/components/ProfileControlsModal.tsx:71–74`, `:261–277`; `expo/components/Sheet.tsx:28`.
- **Category:** Platform conformance / navigation.
- **Verified:** the visible Back control uses `back()`, while the Sheet passes its `onClose` directly to the native Modal's `onRequestClose`. That callback clears all editor state, closes the panel and relocks Owner access. React Native routes Android modal Back through `onRequestClose` rather than screen-level BackHandler [1].
- **Impact:** the hardware/gesture Back action differs from the on-screen action, losing context and potentially edits, and may require another PIN entry.
- **Recommendation:** allow the sheet to distinguish Back from Close. Resolve editor → profile detail → profile list → dismiss. Add an unsaved-edit decision where appropriate. Keep explicit X as Close with the same dirty-state protection; keep authorization expiry and privacy teardown immediate.
- **Suggested command:** `$impeccable harden`.

### P1-3 — First-run welcome consumes Android Back without doing anything

- **Location:** `expo/components/OnboardingFlow.tsx:74–82`.
- **Category:** Platform conformance / navigation.
- **Verified:** at the first step, outside replay, the handler returns `true` through `return !replay`, with no resulting navigation or visible explanation. Later steps and the demo correctly step back.
- **Impact:** Android's expected exit/back affordance appears broken. Skip remains available, so this is not a total task blocker.
- **Recommendation:** define a truthful first-run root-back behavior: allow system exit at a true root, or explicitly resolve to an appropriate route when there is navigation history. Do not silently mark onboarding complete or expose an unintended underlying route. Preserve the current busy-write guard.
- **Suggested command:** `$impeccable harden`.

### P2-1 — Import search lacks the keyboard interaction policy used elsewhere

- **Location:** `expo/app/google-import.tsx:108–163`.
- **Category:** Adaptivity / input handling.
- **Verified:** this FlatList lacks `keyboardShouldPersistTaps` and `keyboardDismissMode`; its dock is a sibling outside a KeyboardAvoidingView. `contentInsetAdjustmentBehavior="automatic"` handles navigation insets, not automatic keyboard adjustment. ScrollView's default tap policy consumes the first outside-input tap to dismiss the keyboard [2].
- **Impact:** selecting a searched result can require a second tap. Dock occlusion on iOS is a source-supported risk, not an observed screenshot finding.
- **Recommendation:** use handled taps and deliberate keyboard dismissal, and give the list/dock a shared keyboard-safe layout. Measure the actual native header offset rather than copying a guessed height. Verify select → search → select another → import with the keyboard open on both platforms.
- **Suggested command:** `$impeccable adapt`.

### P2-2 — Several live controls use 44-unit targets on Android

- **Location:** `expo/app/session.tsx:274`; `expo/app/(tabs)/saved.tsx:177–179`; `expo/components/AddChannelModal.tsx:188`; `ProfileSwitcherModal.tsx:80`; `OwnerPinModal.tsx:110,120`; `SnoozeModal.tsx:27`.
- **Category:** Accessibility / touch ergonomics.
- **Verified:** reorder/remove controls, Saved clear/filter controls, several Close buttons and Forgot PIN have 44-unit bounds/minimums without expanding hit slop at those uses. Android recommends at least 48×48 dp [3].
- **Impact:** these small secondary controls are less forgiving for one-handed use or limited dexterity. They satisfy the common iPhone size floor but should use the larger shared target for this adaptive app.
- **Recommendation:** standardize live custom targets to at least 48 logical units with spacing that prevents overlap. Icons can keep their present visual size. Do not count a decorative 32-unit checkbox or 44×28 tab icon as a separate touch target when its parent row/tab is the actual control. Unused small-icon style declarations in ProfileControls are not reported as live defects.
- **Suggested command:** `$impeccable adapt`.

### P2-3 — Grabber decorations imply a drag gesture that does not exist

- **Location:** `expo/components/AddChannelModal.tsx:114`; `ProfileSwitcherModal.tsx:39`; `OwnerPinModal.tsx:57`; shared `Sheet.tsx`.
- **Category:** Platform conformance / affordances.
- **Verified:** the short top handles are plain Views. The shared shell is a transparent fading Modal with no drag gesture or swipe-dismiss configuration; it has explicit Close controls [1].
- **Impact:** a familiar sheet gesture is visually promised but unavailable. Scrolling instead of dismissing makes this especially confusing on a long panel.
- **Recommendation:** for this small finishing pass, remove the decorative grabbers and retain clear dismissal controls. A true draggable sheet is a separate implementation with dirty-state, keyboard and authorization implications; it is not required merely to preserve a decoration. Add/accessibility-test the escape action without bypassing dirty or busy guards.
- **Suggested command:** `$impeccable polish`.

### P2-4 — Session Save is visually an unexplained icon beside Save & begin

- **Location:** `expo/app/session.tsx:231–236`.
- **Category:** Accessibility / task clarity.
- **Verified:** Save has a correct accessibility label but renders only a disk icon. The prominent neighboring action reads Save & begin.
- **Impact:** sighted first-time users who only want to plan for later must infer the icon. The earlier completion notes overstated this as a visibly named Save action.
- **Recommendation:** visibly label the two outcomes, such as Save session and Save & begin, in a wrapping or stacked footer that accommodates enlarged text. Neither outcome should require knowing the disk metaphor.
- **Suggested command:** `$impeccable clarify`, followed by `$impeccable adapt`.

### P2-5 — Legacy pressed scales remain outside the new reduced-motion layer

- **Location:** examples include `expo/components/TodayVideoCard.tsx:37`, `ScreenHeader.tsx:40`, `OwnerPinModal.tsx:119`, `expo/app/session.tsx:277`; equivalent styles remain in Saved/import/source cards.
- **Category:** Accessibility / interaction consistency.
- **Verified:** new Animated effects use the shared preference, and ordinary VideoCard scaling was removed, but these older `pressed` transforms still apply directly without checking it.
- **Impact:** the new reduced-motion story is incomplete. These are small immediate transforms, not continuous animation or an established medical hazard; this is a minor consistency/accessibility issue.
- **Recommendation:** use tonal/opacity press feedback for text-heavy surfaces, or explicitly gate necessary scaling. Do not add another animation subsystem.
- **Suggested command:** `$impeccable animate`.

## Positive findings and false positives ruled out

- Four top-level tabs are destinations rather than actions. Labels and selected-state backing make navigation understandable; controls do not depend on hover.
- Today exposes Watch/Save/Session/More with wrapping 48-unit actions. Finite selections and explicit continuation support the intended calm experience.
- Native stack detail navigation, system switches/pickers and native alerts remain. Watch's Android Back first exits full-screen and then closes with pause/persistence; close has a fallback if there is no history.
- Shared sheets already account for safe areas, scrolling and the keyboard. PIN uses numeric secure entry and a visible submit button; it does not rely on a number-pad return key.
- Source setup previews before following, import offers individual selection, and bulk import requires an explicit commit. Demo plans remain clearly illustrative, optional and disconnected from billing.
- Today dismissal has persistent Undo. Full erase still requires typed confirmation plus a final destructive decision. Profile switching uses an opaque cover.
- **Today More is not an Android button-count bug.** It has exactly Snooze, Dismiss and Cancel, within the supported three-button limit [4]. Its alert presentation could be reconsidered later, but is not a release defect established here.
- **Do not redesign the typefaces or icon family simply to imitate system defaults.** Frame's coherent brand is an approved constraint. Numeric React Native text sizes do not alone prove font scaling is disabled; no global scaling opt-out was found.
- **iPad is explicitly disabled** in app config. Do not charge this phone-focused review with a missing iPad split-view design. Android expanded-window behavior remains a future device-coverage question.
- Sources can contain 100 rows and render in a ScrollView. Continue watching is capped at 24 records by the database. These merit device measurement, not an unsupported claim of actual jank or an infinite feed.

## Device-only acceptance checks

- First-run Android Back, iOS back/dismiss, editing a saved session then leaving, saving then leaving, and closing a dirty profile editor. Confirm authorization teardown cannot be blocked by a draft prompt.
- Search and select in import with keyboard open; confirm the import dock remains reachable. Check session keyboard offset, short-height phones, large text and native modal headers.
- 320–360 logical-unit phone widths and enlarged text: footer labels, tabs, source names, profile names, first-save card and persistent Today notices.
- VoiceOver/TalkBack heading focus after onboarding steps, entry/exit focus in sheets and PIN, Back/Close labels, checkbox/radio states and disabled targets.
- Light/dark and all accent choices; texture strength; reduced motion while effects are active; tactile feedback on supported hardware.
- Portrait/landscape player, protected interruptions, explicit next-video action and final ending. Observe actual smoothness with a long Saved/import/source collection before optimizing.

## Recommended sequence and Rork handoff

1. `$impeccable harden`: P1 session dirty-state and Back fixes, including profile teardown exceptions.
2. `$impeccable adapt`: keyboard behavior, real header offsets, 48-unit targets and labelled session footer.
3. `$impeccable animate`: remove/gate legacy pressed scales.
4. `$impeccable polish`: remove misleading grabbers and verify the corrected surfaces as one bounded pass.

These can be applied together as one focused correction batch. Re-run the affected audit checks after fixing them; device acceptance remains separate from source verification.

The previous design/copy/onboarding/motion work is already pushed to `codex/frame-design-refinement`. It is not merged into `main`. Pushing another commit to that draft branch alone does not establish that Rork will display it. After corrections and automated verification, merge/update the branch actually tracked by Rork and refresh/rebuild there. The live Rork branch/sync configuration has not been inspected in this audit, so automatic synchronization is not promised.

The existing `RORK_HANDOFF.md` still lists graphic design and broad copy as deferred, even though subsequent passes implemented them. This audit reports that documentation drift; it does not silently change the ownership agreement. Update the handoff when preparing the actual Rork transfer, including the exact commit and native acceptance checklist. Keep billing disabled and the repository private as currently configured.

## Primary references

1. React Native 0.81, Modal: https://reactnative.dev/docs/0.81/modal — native Back callback and swipe-dismiss behavior.
2. React Native 0.81, ScrollView: https://reactnative.dev/docs/0.81/scrollview — tap handling, keyboard dismissal and keyboard insets.
3. Android Developers, Make apps more accessible: https://developer.android.com/guide/topics/ui/accessibility/apps — 48×48 dp custom touch targets.
4. React Native 0.81, Alert: https://reactnative.dev/docs/0.81/alert — Android supports at most three actions.

Sources checked September 30, 2026. Recommendations combine verified source facts with explicit design judgment. Prior 218-test results establish the earlier implementation checkpoint; no tests were rerun solely for this documentation-only audit.


## Implementation record — September 30, 2026

Implemented after the user approved the findings. These are source corrections, not a new platform-conformance score or native visual sign-off.

| Finding | Implemented correction |
| --- | --- |
| P1-1 | Existing-session edits now use the navigation removal guard with Keep editing / Discard changes. Saving blocks user exits while the write finishes; successful save renders the guard off before navigation. Profile switching, reset state and unmount invalidate outstanding decisions. Existing-edit and failed-save copy no longer promise an automatically saved draft. |
| P1-2 | Shared Sheet accepts a separate Back handler. Profile Back and accessibility escape step from editor to detail to list to close. Back, Cancel and X protect changed names, allowances, schedules and PIN fields. Authorization timeout still closes directly. Hidden PIN fields are cleared. |
| P1-3 | Android Back closes the Premium preview, then moves through setup steps. At the first first-run step it exits the Android app without completing setup or revealing a tab underneath. Replay delegates its root Back to navigation. |
| P2-1 | Import list uses handled keyboard taps and drag dismissal. Its list and action dock share keyboard avoidance. Import and session offsets use the actual navigation header height. |
| P2-2 | Audited controls use 48-unit touch targets; the same live 44-unit pattern was corrected in settings, source segments, session detail, allowance/pause choices, reset and the dormant purchase surface. Decorative avatars and tab icon artwork retain their dimensions. |
| P2-3 | Removed decorative grabbers from three non-draggable sheets. Shared sheets route accessibility escape through their Back/close callback. |
| P2-4 | Session footer includes visible Save session and Save & begin actions. Buttons can wrap and grow vertically with their labels. |
| P2-5 | Removed remaining legacy press-scale styles across the app, retaining quiet opacity feedback. Purposeful custom motion still respects the existing Reduced Motion setting. |

The new shared exit-confirmation gate prevents duplicate prompts and makes old alert callbacks inert after their editor scope ends, saving starts, authorization expires, or a profile changes. Tests cover staying, discarding once, duplicate Back attempts and stale decisions. React Navigation hooks are declared direct dependencies using the versions already installed for Expo Router; no new navigation system was introduced.

Validation: TypeScript passes; lint has zero errors and the single preexisting generated Supabase types warning; all 220 tests pass across 48 files (1,089 assertions); whitespace checks pass. iOS/Android gesture behavior, accessibility escape, hardware Back, keyboard positioning, large-text wrapping and tactile feel remain the native acceptance gates above. PR #18 stays draft and unmerged; Rork's tracked branch has not been verified.
