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
