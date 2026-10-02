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
