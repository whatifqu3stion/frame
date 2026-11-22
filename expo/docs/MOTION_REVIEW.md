# Expressive interaction pass — 2026-10-29

The user explicitly approved richer, refined motion throughout the app. The older reviews below are historical; their tight timing and restraint rules are superseded by this pass and DESIGN.md’s October 29 direction.

## Implemented

- Confirmed Today save/session feedback carries its thumbnail; restored dismissals enter and surviving rows spring into place.
- Session artwork seats on selection; queue rows enter and reorder, totals resolve, and the saved programme assembles once. Programme covers reflect real queue order and omit unavailable imagery.
- The first personalised print opens inside its matte with a stronger 720 ms reveal; first save confirms successful persistence.
- Playback preparation carries current artwork; the ending resolves into a finished print. Ready-player controls remain unobscured. Native navigation is retained; a shared-element transition across screens is not implemented.
- Viewing-time bars animate from the baseline, updated heights retarget, selection moves between days, and totals remain truthful. Day selection uses the existing haptic preference.
- Newly followed rows, choice illustrations, tab selection and help disclosures receive coordinated feedback.

## QA iterations

Initial source checks passed TypeScript and scoped ESLint. The existing suite passed 365 tests / 1,818 assertions. Interactive web QA at desktop and 390×844 exercised onboarding reveal and first save, session multi-selection and reordering, save-to-programme navigation, chart selection, and Today save feedback. It found a wrapped close action in the new thumbnail notice; the fix keeps a single action row and omits artwork at narrow widths/large text. The assembly route flag is consumed once. The return signal now tolerates route/focus update ordering.

The confirmation pass verified the corrected notice at 390 and 320 points, keyboard day selection, all seven 44-point chart targets, dark/rose appearance, the actual return transform on the originating card, a consumed assembly route flag, the shared ending artwork in the explicit fictional preview, and the finite Today completion after successive saves. The completion check found an SVG `collapsable` DOM warning; a shared AnimatedStroke now filters the native-only flag on web, and decorative check accessibility is owned by its wrapper. A targeted fresh-bundle completion run then produced no new console errors. TypeScript, scoped ESLint and diff whitespace checks pass.

Screenshots: `/Users/j/.codex/visualizations/2026/10/26/01a178a3-1bb0-75c2-8e8d-5eae3199cc25/frame-motion-qa/` (`today-desktop.png`, `save-phone.png`, `chart-dark-phone.png`, `ending-phone.png`).

The larger exploratory ideas—cross-screen shared-element morphing, full-app theme crossfading, chart scrubbing and drag-based ordering—are not included. The existing accessible reordering controls and native navigation remain. These are distinct follow-on implementations; the completed pass does not claim them. Web-native-driver fallback is expected on web; it is not evidence of native frame rate. Native simulator results are recorded below. Hardware haptics, VoiceOver, interrupted gestures, populated native player handoff and performance still require device validation.

The dev-only fictional video preview exposes “Preview ending” using the production CompletionArtwork component. It does not simulate playback, create viewing totals, or mount the official YouTube player.

## Native continuation — October 29

After the Mac was unlocked, Expo Go rendered Frame on the iPhone 17 Pro simulator (iOS 26.3). The onboarding identity, interest controls, fixed footer and selection state were inspected in the actual native app; `native-onboarding.png` records this view. This is an initial render check, not a frame-rate measurement.

The native runtime exposed a startup SQLite error: `no such column: fetchedAt`. Read-only inspection found an early native database at version 12 without the later metadata-provenance and Saved-consolidation columns. Migration 13 now adds missing provenance columns without inventing fetch dates and applies the existing atomic Watch Later merge when its marker column is missing. A regression test verifies bookmark dates, progress and queue preservation, successful retention queries, and repeat initialization. An older test adapter now reads the actual schema rather than returning stub metadata. The full suite passes 366 tests / 1,824 assertions; TypeScript, scoped lint and whitespace checks pass.

After a second unlock, the repaired bundle loaded Today successfully. Read-only database inspection confirmed version 13 and both restored Saved columns. No startup or retention errors appeared in the subsequent runtime output. No native data was reset to bypass the migration failure.

The simulator pass verified chart day/readout/selected-state changes, help disclosure, tab navigation, native Back, dark appearance, and usable chart/disclosure controls with iOS Reduce Motion enabled. Extra-extra-large Dynamic Type rendered without clipped controls after reload; changing the setting while Frame remained foreground initially left stale text widths in Expo Go. Live Dynamic Type resizing therefore remains an unresolved runtime observation, not a passed check. The empty native library has no followed sources, so populated-card motion and playback handoff were not exercised natively. Haptics, VoiceOver, gesture interruption and real-device performance remain unverified.

Restored the simulator's original `large` text category and Reduce Motion off, restored Frame to Light / Mineral blue, and left Today selected with its disclosure closed. Native screenshots: `native-onboarding.png`, `native-today-light.png`, `native-today-dark-xxl.png`, and `native-today-final.png` in the screenshot directory above.

## Text clipping and field focus follow-up

Resolved the live Dynamic Type observation above. A shared FrameText component refreshes only iOS text hosts when the system font scale changes, using one provider subscription; screens, navigation and input components retain their state. Frame's text labels now use this component, and the viewing chart lets its axis size to its label while widening day targets at larger scales. Native QA changed text size in place from large to extra-extra-large and back without reloading: headings, profile labels, help, chart days and actions remained readable. A typed Sources search draft survived the size change. The original large category was restored and the temporary native draft cleared.

The reported blue inner input box reproduced on the user's existing Sources tab: Chromium's `auto` outline still painted despite zero outline width. TextField now explicitly uses a zero-width solid outline on web, retaining the enclosing field's ink-colored focus border. Custom-interest and API-key inputs now use the same field. Browser QA confirmed editing, Tab progression, an active input with no inner outline, and the visible outer border at desktop and 390-point widths. The user's original tab and draft were preserved; the updated preview runs at localhost:8096/sources.

TypeScript and ESLint across app/components/preview pass; the full suite passes 366 tests / 1,824 assertions. Evidence: `field-focus-phone.png` and `native-live-text-field.png` in the screenshot directory above. No real channel search or API-key submission was performed.

---

# Frame motion review — 2026-09-30

Source review of the current Expo routes and shared controls. This is an
implementation review, not a claim of simulator or device observation. No native
simulator/emulator is available in this workspace.

The direction is confirmation and continuity: meaningful changes get a brief
response; browsing and reading remain steady. First save is the authored moment.

| Surface | Decision |
| --- | --- |
| Today | Keep surviving-row continuity and the finite-selection ending. Refresh persistent feedback when its message or undo target changes. |
| Sources / Discover | Keep section transitions and remaining-pick continuity. Follow confirmation now survives pending work; scope rows to the active profile. |
| Source detail | Newly followed icon settles after completion. Opening an already-followed source stays still. |
| Saved / legacy Library redirect | Keep filtering immediate, thumbnails softly resolving, and additional-session disclosure. No mass entrance or animation on every scrolled item. |
| Session editor | Keep 220ms order continuity and selection haptics. Autosave and Start remain immediate; no fabricated progress or delayed navigation. |
| Session detail / add-to-queue | Keep native navigation, task sheets, and existing busy/result states. No arrival choreography. |
| Watch | Preserve official playback surface, timing, and controls. Save confirmation now stays mounted through its spinner; keep deliberate between-video and final endings. |
| Onboarding / welcome preview | Progress segments resolve on forward and Back. First save draws one check beside the existing milestone copy. Save icons acknowledge only newly completed results. |
| Demo checkout / feature-gated Premium | Keep explicit demo disclosure, existing selection and completion transitions. Do not add purchase-like spectacle or alter feature gates. |
| Google import | Keep selected-row color feedback and native list performance. No stagger across potentially hundreds of subscriptions. |
| Settings / detail pages | Keep quiet pressed surfaces, selection color transitions, and native Back. No whole-page theme crossfade or animated text layout. |
| Profile switcher / profile controls | Keep task-sheet transitions and relevant editor disclosure. Profile changes must not replay completion feedback for stored content. |
| PIN / reset / content approvals | Keep protected decisions steady, visible, and interruptible. No shake, celebratory erasure, or delayed error copy. |
| Add source / snooze / Today session picker | Keep resolved-source preview and native/task-sheet feedback. No competing sheet and content entrances. |
| Privacy / Terms / diagnostics / unavailable links / not-found | Keep static reading and immediate recovery actions. |
| Navigation / media / loading | Keep OS stack transitions, fixed tab geometry, reduced-motion-aware image fades, and static skeletons. |

## Verification

Automated checks are recorded in the PR. Native visual, gesture, frame-time, and
hardware-haptic checks remain open in `SMOKE_TEST.md`. Existing haptic preferences
and commit gates are retained; no new haptic calls were introduced.

## Focused finishing pass — October 2, 2026

Implemented with Impeccable animate + delight, followed by a source audit and polish. The focal moment is the first real personalized preview: the matte stays stationary while a slight tonal veil clears from its image and the source context settles by three logical units within 400 ms. Save controls, counts, supporting videos, and navigation remain immediately usable. Image loading keeps its honest fallback and existing crossfade; no artificial wait or looping material effect was added.

Follow confirmations and Saved removal notices use the existing quiet 180 ms state transition. Metadata recovery keeps a readable success result mounted after Refresh disappears. Native screen-reader focus transfers to that result for the initiating, still-visible screen; delayed work cannot move focus after departure/backgrounding. The web adapter restores keyboard focus only when the disabled trigger left focus on the document body. No haptic accompanies metadata reads or removals.

MotionView and the first-save check share a presentation gate that observes route focus, foreground state, and Reduced Motion. Ordinary outcomes arriving out of view settle immediately and never celebrate on return. Only the first personalized preview may defer its first presentation until it is visible. An interrupted presentation settles rather than restarting. Choice and tab feedback also stop offscreen. Reordering samples the current native translation before retargeting; obsolete callbacks are discarded so repeated moves preserve visual position.

### Focused source audit

| Dimension | Result and remaining evidence |
| --- | --- |
| Accessibility | Existing labels and touch targets retained; success focus target and announcement added; reduced-motion path is immediate. VoiceOver/TalkBack traversal and perceived focus continuity need devices. |
| Performance | Finite effects, existing Animated only, native-driven opacity/translations. The small SVG check and selection colors retain bounded JS animation. Frame time and actuator quality are unmeasured. |
| Appearance | Existing matte, semantic colors, typography, static grain, and dark/light behavior retained. No new visual system or asset. |
| Platform conformance | OS navigation, keyboard, sheets, official player, and haptic preferences preserved. Native gesture and haptic feel remain unverified. |
| Adaptivity | No new fixed text height or page-width constraint. Success text wraps and controls remain available during effects. Large-text and expanded-window rendering need native checks. |

Validation: TypeScript passes; changed-source ESLint passes without warnings; 274 Bun tests pass across 60 files. Six new cases cover deferred first presentation, hidden completions, repeated outcomes, interrupted/reversed row movement, and invalid measurements. Existing action and haptic gates remain covered. These checks do not establish native visual or tactile quality.

Native calibration is still pending: this Linux environment has no xcrun, adb, emulator, connected device, or /dev/kvm. No browser approximation was used as sign-off. Complete smoke section 26 on iPhone and Android in one batched pass, apply concrete corrections together, then confirm once.

## Whole-app personal-edition pass — October 21, 2026

The motion thesis remains **a collection taking shape, then becoming still**. The personalized reveal and finite ending retain the longer authored moments. Browsing, thumbnails, reading, and playback keep their established behavior; a tab change does not replay a page entrance.

This pass covers the newer personal-edition surfaces:

- Today details, Add a source, Saved help, weekly-pick details, Settings help, and managed-request review use one small disclosure indicator. The arrow rotates in 180 ms, retargets from its current angle on rapid input, settles immediately when hidden or Reduce Motion is active, and is hidden from assistive technology. The labelled trigger carries expanded state.
- Newly opened supporting details use the existing nonspatial state fade. Closing unmounts immediately, so hidden content cannot keep focus or an active request. No animated heights, held exits, or delayed controls.
- A custom interest acknowledges only a confirmed `true` write: one selection haptic, a settled check, and the existing next-edition explanation. A false/no-op result no longer presents success. Errors remain readable and the control keeps its minimum touch height.
- Weekly generation messages use the shared outcome transition. Generation remains explicit, cancellable and honest; no invented progress bar or timer.

Preserved after source review: native navigation and sheet ownership, save/follow confirmations, first-save milestone, measured session reorder, Watch's deliberate final state, static skeletons/grain, haptic preferences, profile-switch privacy cover, and read-only/protected-flow restraint. No animation dependency, looping ornament, autoplay, new refresh cadence, or extra content was added.

Verification: TypeScript and scoped ESLint pass; the existing suite passes 325 tests / 1,596 assertions. Desktop and 390×844 web previews verify disclosure state/layout and a real custom-interest addition; the temporary interest was removed. Browser previews do not verify Android haptic strength, TalkBack, native frame time, or player behavior. The standalone APK path and remaining device checks are in `ANDROID_SIDELOAD.md`.

## Onboarding identity addition — October 26, 2026

The supplied four-corner logo assembles beside Frame over 640 ms on the first setup screen, using the active theme accent. Each corner translates inward five logical units with cubic ease-out and the native driver. No sound, loop, haptic, extra screen, or delayed control. Returning to the first step and restoring a saved draft keep the mark static; opening the welcome preview explicitly permits a new entrance. The shared preference subscription now exposes its unresolved state so the entrance can wait for the OS answer without assuming animation is allowed. Reduce Motion or interruption settles it immediately.

Validation: TypeScript and scoped ESLint pass; 10 existing continuity/draft tests pass. A desktop web preview confirms the supplied geometry, accent color, readable lockup, available controls, and removal on the next stage. Native timing, large text, screen-reader grouping, and background/resume behavior still require a device pass; no simulator was booted during this check.

## Remaining interaction pass — October 29

Implemented the remaining original recommendations: a measured artwork bridge between Today/Saved cards and the viewing stage, coordinated appearance changes, first-item collection arrivals, and direct chart scrubbing. The artwork bridge uses the same square print and native-driven transforms; destinations with a valid measured source use a card presentation without a competing stack animation. Deep links, unavailable measurements and Reduced Motion retain ordinary navigation. The source ref, profile, route and viewport bound each handoff. Backgrounding, changed dimensions, a different video, player readiness and expired measurement requests cancel it. The official ready player and blocked/message states always take precedence.

Only one decorative print owns each flight. The loading/preview poster yields until arrival, and the exact originating image yields during return. The production landing blends to its existing dim loading poster; the earlier independent return-card scale effect was removed. No video playback or navigation waits for the animation. Real native player/gesture acceptance remains a separate requirement.

Appearance transitions dim and restore one mounted interface around the palette change (a lighting transition, not duplicated screenshot crossfading). Controls, form state and focus survive. Repeated choices retarget; backgrounding and Reduce Motion settle immediately. First collection arrivals observe loaded, persisted empty-to-populated transitions, keep separate video/session identity, ignore initial hydration and profile changes, and consume once on visible presentation.

The chart captures deliberate single-finger horizontal drags while retaining tap/keyboard controls and vertical page scrolling. The decorative selector tracks real daily values. Narrow plots move beneath the finger and keep the selected day visible after release or resizing; all day targets retain their minimum size. Multitouch movement is ignored. Live announcements are suppressed during continuous scrubbing and restored on release.

Browser QA exercised measured opening/return transforms, chart dragging at phone width, first save after emptying only the fictional library, and light/dark/accent changes. The independent design review identified duplicate destination artwork during flight; this was corrected and visually confirmed. A 320-point check identified offscreen selection after resizing; selection-aware scrolling was added. TypeScript, scoped ESLint and all 369 tests passed before that final chart positioning correction; final confirmation results follow below. Tests include invalid geometry, aspect-ratio/centre preservation and clamped/scrolled chart coordinates. These checks do not establish native frame rate or haptic quality.

Impeccable Assessment A independently reviewed source and a desktop browser; Assessment B returned zero deterministic findings across nine bounded files. B could not obtain a browser tab because its subagent browser visibility was unavailable after an initial server-restart connection refusal; the parent supplied browser evidence. No live detector overlay was injected. Native automation resumed briefly after unlocking: startup and tap selection worked, but a drag did not change the selected day. A competing native horizontal scroll gesture was then removed; confirmation is recorded separately rather than assuming the fix passed.

Final confirmation: TypeScript and scoped ESLint pass after the positioning change. The full suite passes 369 tests / 1,835 assertions; the targeted geometry/scrubbing tests also pass on the final code. Browser confirmation at 320 points dragged from today to the earliest day and back, showing the correct 24-minute/16-minute values. Today stays visible after resizing. The corrected artwork flight was observed with one visible print, and the settled return remained coherent. Light / Mineral blue was restored, a 390-point screenshot saved as `remaining-delight-phone.png`, and the temporary viewport reset. The preview remains at localhost:8096 for review.

Native confirmation is partial: the unlocked simulator loaded the interaction build and tap selection changed the day correctly. Pointer targeting later failed again with `noWindowsAvailable`, preventing reload/confirmation of the native drag conflict fix. No claim is made that final native scrubbing, shared artwork around the real player, interactive Back, VoiceOver, hardware haptics or frame rate passed. Those are the remaining acceptance items; no native data was fabricated or reset to bypass them.
# Motion refinement — 30 October 2026

Reviewed the custom motion implementations and their call sites: setup identity,
progress and personalized reveal; choice and confirmation feedback; first-save
and collection arrivals; programme assembly and reordering; Today notices and
restored rows; viewing-time bars, selection and scrubbing; disclosure arrows;
tab selection; theme changes; artwork handoff, loading poster and completion;
and sheet presentation. Retained the existing expressive artwork durations.

Changes:

- Tabs, setup progress and disclosure indicators now share the same interrupted
  transition handling. A quick reversal continues from the current value rather
  than jumping to the previous endpoint during effect cleanup.
- Choice fills and borders use stable selected/unselected colour endpoints and
  reverse their current blend. They no longer reset the fade on each selection.
- While scrubbing viewing time, the selected backing and bar colour follow the
  gesture immediately. The readout stays steady instead of repeatedly fading
  and moving. Taps retain their short transition; releasing a drag does not
  replay a readout entrance.
- Small programme prints settle within their own bounds. Removed the sideways
  slide/tilt that could clip the final print or cross neighbouring gaps.
- Session assembly keeps the card, title and controls stationary while the
  gallery prints settle. Completion text/actions are immediately at full
  opacity; the finished print owns the ending animation.

Validation:

- Browser sample library at 320 and 390 px, plus 1280 px desktop. Checked rapid
  theme reversal, duration selection, session reorder/reverse/save, gallery
  assembly, timing disclosure, sample completion, artwork open/return, setup
  Back/Next and personalized reveal, first-save confirmation, and Sources
  filters/add-source disclosure. Restored Light / Muted rose.
- Narrow chart drag reached Saturday (24 min) and returned to Today (16 min).
  The observed partial leftmost day at 320 px is the scrollable chart viewport;
  dragging exposes the earlier days. A cropped gallery top after Back was
  confirmed to be retained scroll position, not artwork clipping.
- TypeScript and scoped ESLint pass. Full suite: 369 tests, 1,835 assertions,
  zero failures. No new browser runtime errors; React Native Web reports its
  expected native-driver-to-JS fallback warning.
- Reduce Motion, hidden-route and background settlement were reviewed in the
  shared hooks and existing continuity tests. A fresh OS-toggle visual test
  was **not** completed: native input was blocked when the Mac locked. Native
  chart drag, actual-player handoff/interactive Back, VoiceOver/haptics and
  release-build frame pacing remain unverified by this pass. The fictional web
  player is not evidence for real playback or device performance.

## Viewing-room lighting — 31 October 2026

Added a background-only lighting plane to the production watch route and its
fictional web preview. Entry uses the artwork's 520 ms cubic ease-out; return
retargets over 380 ms without postponing navigation. The original library is
immediately visible on shared-artwork return. Light mode starts at warm umber
`#443A31`, dark mode at `#24201C`, both settling at `#181512`. This deliberately
avoids fading white text over a cream background or overlaying the video.

The room follows whether a watch route is active, not the video ID, ready event,
loading status, or playback state. Back/re-entry continues from the current
light. Reduce Motion and backgrounding settle immediately; returning to the
foreground does not replay. Cold watch deep links start settled. Existing
unavailable/permission/error surfaces retain their own readable backgrounds.

Verified browser entry/return and rapid interruption, both themes, portrait and
landscape preview geometry. Observed light-layer opacity advance through 0.14,
0.33 and 0.46 to 1; every ancestor of the Back control retained opacity 1.
Completion did not restart the lighting. No player-readiness gate was added.
Light / Muted rose was restored after QA.

Automated checks: TypeScript, scoped ESLint and all 374 tests pass (2,017
assertions). Added real-hook lifecycle regression checks and contrast sampling
at 21 points through each theme's transition; all text roles remain at least
4.5:1. Native simulator interaction is available, but its library is empty;
actual-device playback, interactive dismissal and release frame pacing were
not verified using the fictional browser player. No native library data was
injected or modified for this check.

Captured browser frames and their timestamps are in
`research/viewing-room/qa/entry-0.png` through `entry-4.png` and `timing.json`.
These show the live entry progression, not a synthetic animation or frame-rate
benchmark. The final browser console check contained no errors.


## Onboarding release pass — October 31, 2026

The existing artwork reveal and first-save animation are retained. The reveal presents three videos at most, explicitly pointing to Today for the rest. Copy is shorter, direct source entry precedes optional discovery, and setup can finish without manufacturing an empty reveal. No extra entrance animations were added. Android Back is focus-aware so provider setup owns its navigation. Browser QA covered populated first save/replay and an isolated empty first run; see RELEASE_CANDIDATE.md for native acceptance limits.

## Still video entry — October 31, 2026

Supersedes the shared-artwork flight and lighting timing above. Removed the
measured thumbnail flight in both directions and the loading poster's settling
zoom. Watch navigation has no spatial transition or measurement delay. The
room dims over 1.72 seconds with a gentle start and long settling curve
(0.22, 0, 0.2, 1). Dark mode starts at `#2D2925`. Both themes settle at
charcoal `#202021`.
Back immediately shows the library, with the persistent light retargeting over
320 ms for quick re-entry. Player readiness and playback policy are unchanged.

Browser samples confirmed increasing background opacity and identity transforms
on the artwork and its ancestors in both themes. Rapid Back/re-entry works.
Hook tests cover interruption, Android/native versus web animation drivers,
Reduce Motion, backgrounding, direct entry, and no replay on player updates.
Contrast checks sample 21 points in both themes. TypeScript and scoped ESLint
pass. Native playback, interactive Back, accessibility settings, and release
frame pacing still require device acceptance; the browser player is fictional.

## Curating weekly picks

The waiting scene reuses the three studies from Frame’s opening print. Their mounts settle on an umber table while a soft band of light passes over them. The caption follows real discovery callbacks: finding creators, checking channels, reading uploads, reviewing quality, and saving. Checking and review can repeat; the arrangement is not a percentage or a promise that three videos qualified.

On arrival, the lead mount opens and the smaller prints settle beside it on one 840 ms presentation clock. Buttons and artwork are available throughout. No provider request, minimum wait, retry, autoplay, or quality-policy change is part of this animation. Cancellation, failure and empty editions have no success reveal. The light stops on unmount, backgrounding, loss of focus, or Reduce Motion; the static table keeps the live status. Phone-width visual QA uses the explicitly fictional sample rehearsal described in `expo/preview/README.md`. Native frame pacing and live provider timing require device testing.

### Touch feedback coverage — November 18, 2026

Extended the existing expo-haptics vocabulary rather than adding feedback to every press:

- Onboarding step changes use a selection tick; an actual first-discovery handoff and successful setup completion use the milestone cue. Sample discovery previews and automated story/chart animations remain silent. Replaying setup closes with the lighter commit cue.
- Verified provider keys acknowledge only after successful local storage. Failed validation and removal stay silent.
- Section switches and deliberate discovery-gallery promotions tick only when the selected item changes.
- Today’s maximum, discovery priority topics, and House lights acknowledge successful writes. Re-enabling Haptic feedback gives a single sample tick; disabling it stays silent.
- Existing saves, follows, add-to-session, session ordering/creation/start and viewing-day selection keep their existing acknowledgements without an extra generic button pulse.

All cues use the existing device-wide preference, foreground/navigation validity, one-shot completion and burst suppression. No sound, dependency, visual redesign, or feedback during automatic playback was added. Native-only output means the web preview remains silent.

Validation: TypeScript, scoped ESLint, Impeccable detector and 22 focused interaction/feedback tests pass. Browser smoke checks exercise onboarding advance and Saved’s section switch without runtime errors. Physical iOS/Android tactile strength remains unverified and should be checked in the next native build.

### Study visibility and release hardening — November 18, 2026

Study charts now keep one elapsed-time clock for their opening delay and reveal, pausing when the route or app is inactive. Resume preserves the same easing position instead of restarting it. Hidden and unmounted completion callbacks are rejected; Reduce Motion settles the data and acknowledges completion only when visible. Regression tests cover delay/reveal interruptions, queued completion, reduced motion and unmount.

Shared info and identified onboarding/help/replay targets now meet 48-unit interaction bounds. Session details virtualize their queue beneath the existing editorial cover; metadata reads are batched and cancellable. Full verification passes with 471 tests; browser layout checks are supplementary. Native motion/gesture/haptic acceptance remains pending.
