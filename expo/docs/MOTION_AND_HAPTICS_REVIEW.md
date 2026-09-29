# Frame: motion and haptics review

Reviewed September 29, 2026. Source baseline: draft PR #18, commit `4e132d5272f17f8d8ab53aa41994c710eb8bb3df`.

**Recommendation:** make choosing, keeping, arranging, and finishing feel considered. Frame should respond with a little weight and precision, then become still. The personality belongs in a few meaningful transitions, not continuous activity.

**Status:** design review and proposed implementation specification only. No application behavior was changed in this pass. This is a source-based review of all 22 route files and 37 component files, including native/web variants, plus the relevant provider handlers and installed SDK. It is not a real-device motion or haptic assessment. Timing, perceived strength, navigation behavior, and performance still need hardware validation. No conversion improvement is claimed.

## 1. The strongest opportunities

| Priority | Moment | Proposed experience | Why it belongs |
| --- | --- | --- | --- |
| First | First personalized selection | The actual selection resolves within its matte surround; the source and count settle into a readable composition. One restrained sequence, about 360–420 ms. | Makes the relationship between the user's choices and Frame's result perceptible. |
| First | First save, then everyday saves | The bookmark becomes solid; the saved state arrives with one tactile confirmation. The first save also introduces “Your library has begun.” | Makes keeping something feel consequential. |
| First | Session order | Two rows visibly exchange places and their order numbers update; one small tick acknowledges the accepted change. | Makes arranging a personal programme tangible and easy to follow. |
| First | Session ending | Once playback has stopped, the dark stage resolves to “A good place to stop.” The controls are available immediately. | Gives Frame's deliberate ending as much care as its beginning. |
| Supporting | Selections and sheets | Consistent selected-state transitions, quiet sheet arrivals, and stable controls. | Makes the whole app feel precise without competing with the content. |

The material metaphor is the care of placing something in a collection. Do not simulate literal curtains, turning paper, marble reflections, wood, spotlights, film flicker, or physical bookmark ribbons. Keep the existing grain static.

## 2. What exists today

These are verified code observations, not impressions from a running build.

| Finding | Evidence | Decision |
| --- | --- | --- |
| Motion is already present. | `MediaImage` crossfades at 140 ms by default; `VideoCard` requests 160 ms. Both use the reduced-motion-aware wrapper, including `TodayVideoCard`. `Sheet` uses a modal fade. Native stack navigation supplies system transitions. | Preserve and unify these foundations. Do not add a second entrance to every page. |
| Haptics have no shared vocabulary. | Direct calls appear in `VideoCard`, Today, Watch, Session Builder, and Session Detail. Source following and onboarding saves have no direct haptic calls. | Centralize semantic feedback; move emphasis from navigation to meaningful changes. |
| Routine playback navigation currently vibrates. | `VideoCard.onPress`, Watch close/retry/external link/next, and medium impacts on session start and rewatch. | Remove navigation/close/retry/external-link impacts. Use one soft cue for explicit session start only; no automatic next-video pulse. |
| Save feedback is inconsistent. | Today and Watch use success notifications; Add Source and Onboarding save paths do not. | Ordinary saves receive one modest commit cue; reserve the fuller success pattern for a real milestone. |
| The current thumbnail skeleton creates a loop for each mounted thumbnail. | `VideoSkeleton.usePulseAnimation`: opacity 0.52–0.92, 760 ms each way. It honors Reduce Motion and unmount cleanup, but has no focus/AppState guard or `isInteraction: false`. | Prefer static thumbnail placeholders. If retaining a feed pulse, share one subtle pulse for the visible loading group, stop it when inactive, and make it non-interactive. This is a potential list-performance risk, not a measured defect. |
| Reduced-motion support is a useful but incomplete foundation. | `useReducedMotion` defaults conservatively to true. `Sheet` and skeletons repeat their own listener logic. `VideoCard` has an immediate pressed scale of 0.987 regardless of preference. Stack behavior is not explicitly configured against this hook. | Consolidate preference handling; remove press scaling under reduced motion. Verify actual OS navigation behavior before overriding native transitions. |
| Successful mutations can immediately unmount their visual source. | Today reloads after disposition changes; source confirmation clears the preview; onboarding inserts a success panel above the selection. | Add continuity without delaying writes, keeping stale interactive copies, or moving controls away from the user's finger. |
| Profile changes intentionally cover/remount the app. | `_layout` keys content by `activeProfileId` and displays an opaque switching cover. `AppProvider.switchProfile` cancels old queries, loads the new snapshot, and applies it. | Preserve the privacy boundary. Never crossfade libraries from two profiles. |
| Selection haptics in the session editor run before the updater determines whether the order/selection changed. | `SessionBuilder.move` and `toggle`; visible controls disable many invalid actions. | Trigger feedback only for an accepted change, including rapid input and stale-state cases. |
| Billing surfaces have distinct status. | `demoPaywall: true`, `paidAccess: false`; the real `PaywallSheet` exists but is not mounted in this configuration. | Review both; keep the real purchase path dormant. Demo completion must remain visibly a preview. |

## 3. A small motion vocabulary

All timings below are starting values for device tuning, not measured optima. Use native stack/keyboard/picker timing where the OS owns the interaction.

| Pattern | Starting treatment | Reduced-motion alternative |
| --- | --- | --- |
| Press | Immediate tonal response; 100–120 ms release. At most 0.99 scale on a small custom action where it adds tactility. No scaling text-heavy cards or entire pages. | Tone/border feedback only. |
| Choice | 140–180 ms selected-surface/check transition. Keep text opaque and reserve check space so chips do not rewrap. | Immediate check and state; optional short nonspatial surface fade. |
| Small state change | 160–220 ms icon/status transition. Fixed button geometry across idle, busy, and complete states. | Immediate state or at most 100 ms crossfade. |
| Ordered change | 200–240 ms measured row exchange, no overshoot. Keep focus and order numbers associated with the correct item. | Instant new order plus an accessible announcement. |
| Shared sheet | Approximately 240–280 ms arrival and 160–200 ms dismissal; up to 16–20 pt of travel with a backdrop fade. Keep one owner of the animation. | No translation; short fade or instant presentation. |
| Onboarding step | 180–220 ms local content transition, at most 8–12 pt directional travel. Stable wordmark and footer. | Instant content change or short crossfade; focus the new heading. |
| Authored moment | 360–420 ms total composition; only first selection and deliberate ending earn this extra space. | Show the complete composition immediately. |

Use a smooth deceleration such as `Easing.out(Easing.cubic)` for arrivals and a shorter ease-in exit. If a spring helps the reorder interaction, clamp overshoot; no bouncy settlement. Avoid queued transitions: repeated input should update or interrupt the current movement.

Visible busy states begin immediately. Never add a fake minimum loading period to make an animation feel intentional. Feedback must not gate writes, authorization, playback stopping, navigation, or screen-reader access.

### First selection: one authored sequence

1. Keep the heading, source context, and actions readable while real data loads. Use the existing honest loading/error/empty paths.
2. Once a valid selection is available, resolve the first image within the existing matte mount over roughly 240 ms. The mount itself stays still. If the image is slow or unavailable, show the fallback and continue; do not wait for it to unlock the page.
3. The source/count group settles into its final position with no more than 4 pt of movement, completing within 360–420 ms. The remaining titles appear as one group, not a twelve-item cascade.
4. Run once per first valid reveal in this setup flow. Back navigation, returning from Premium, cache updates, and additional saves do not replay it. The explicitly requested Settings preview may replay it once.

No haptic on automatic content arrival. The user earns the tactile moment through the first save.

### First save: meaningful, brief, and true

After the save/disposition action confirms its outcome, transition bookmark to saved/check state over 160–180 ms. Introduce the existing umber confirmation without pushing the tapped control out of reach: preferably place it adjacent to the selected item or preserve the visible scroll anchor when inserting the current panel. Keep the saved card visible throughout onboarding.

Use one success haptic for the first real save in this setup flow. Later saves use the quieter commit cue. Do not fire both. A failed follow-up refresh must not reverse a confirmed save or emit an error vibration for the save itself. Partial failures need truthful copy and no unearned completion choreography.

### The ending: resolve to stillness

Immediately stop/unmount playback as required by the current state machine. Once the player is gone, let the existing dark Frame surface and end copy resolve over approximately 300–360 ms. “Done for now,” “Continue,” and “Watch again” remain accessible immediately. Do not animate over the live embedded player, interfere with its controls, or retain a playing snapshot to bridge the transition.

Between videos, use a smaller 180–220 ms state change. There is no countdown, automatic advance, completion confetti, progress trophy, or automatic vibration when a video ends. The satisfaction comes from an orderly ending that stays still.

## 4. Haptic vocabulary and feasibility

`expo-haptics` ~15.0.8 is already installed; its installed declarations include `selectionAsync`, `ImpactFeedbackStyle.Soft`, and Android's action-oriented haptic API. No new library is needed for this scope. Hardware support and strength vary. Expo notes that iOS can suppress haptics under conditions including Low Power Mode and user settings. Android guidance favors clear, consistent effects and recommends silence over a buzzy fallback. [1][2]

| Meaning | Where | Suggested native mapping |
| --- | --- | --- |
| Selection | Custom interest chips, plan change, a valid session reorder, a changed viewing preset | iOS selection; Android `Segment_Tick` or appropriate toggle constant. Only when the value changes. |
| Commit | A confirmed ordinary save, follow, snooze, restore-to-Today, or add-to-session | iOS soft impact; Android `Confirm`, calibrated on device. One event per operation. |
| Milestone | First real onboarding save, saving a newly composed session, successful selected-source import | iOS success notification; Android `Confirm`. Not stacked with commit feedback. |
| Rejection | A submitted incorrect PIN or explicit failed protected action when helpful | One restrained error/reject event, with visible explanation. Never on every keystroke, timer tick, cancellation, or background failure. |
| Silence | Navigation, tab changes, opening/closing sheets, typing, scrolling, refresh completion, automatic playback events, empty states, disabled controls, destructive completion | No custom vibration. |

Explicit **Start session / Save & begin** may use one soft commit cue because it marks a deliberate viewing choice. Do not add a second navigation cue or a medium impact. Demo checkout may use a soft acknowledgement paired with “Preview complete”; do not give it a purchase-success celebration.

Implementation policy:

- Add one native feedback helper; replace scattered direct calls rather than layering on new ones.
- Use Android `performAndroidHapticsAsync` for action-oriented feedback instead of adding generic vibration patterns. [1]
- Make web a deliberate no-op for Frame's custom haptics. Use visual feedback there.
- Add one device-wide “Haptic feedback” preference, on/off. This comfort preference should survive profile switches and default to following system availability. No intensity menu. It must never override an OS setting.
- Reduce Motion and haptic preference are separate concerns; reduced visual movement does not automatically remove tactile confirmation.
- Respect foreground/focused state, drop stale async completions after navigation/profile change, and deduplicate each action. Haptic failures must never fail a product action.
- Give native switches, system date/time pickers, keyboards, store sheets, and system alerts ownership of their built-in feedback. Do not double it.
- For provider methods that currently return `void` or resolve on a rejected attempt, do not infer success from promise completion. Use a real changed/confirmed result or a stable action outcome. This matters for `toggleInterest` and `submitOwnerAuthorization`.

## 5. Page-by-page and interaction review

“Quiet” means existing native navigation, ordinary press states, and accessible feedback remain; it does not mean an inert interface. All custom movement below inherits the reduced-motion alternatives above.

### App shell and onboarding

| Surface / interaction | Recommendation | Haptic | Priority |
| --- | --- | --- | --- |
| `_layout`: launch/fonts/loading | Keep the platform splash; transition directly to ready content. No extra logo performance or artificial hold. | None | Preserve |
| `_layout`: stack pushes, modal routes, dismissal | Preserve system hierarchy and back gestures. Avoid simultaneous screen and child entrances. Verify Reduce Motion on native hardware. | None | Foundation |
| `_layout`: profile switch | Cover immediately; clear old profile visuals and pending effects; reveal new content only once its snapshot is ready. A brief fade of the cover is acceptable then. | One commit after successful switch, owned above remounted children | Foundation |
| `(tabs)/_layout`: Today/Sources/Saved/Settings | Fade the active icon's tonal backing over about 140 ms. Keep all icons and labels fixed. No traveling capsule, bouncing icon, or whole-screen slide between tabs. | None | Supporting |
| `ScreenHeader`: profile chooser | Ordinary press state and shared sheet arrival. Header text stays still. | None | Supporting |
| `/onboarding`: welcome, next/back, skip/finish | Stable shell; restrained step continuity. Fill progress segments only for real stage changes. Skip stays immediate; no effect delays leaving. | None for navigation | First |
| Onboarding interest choices | Selected surface/check settles; reserve icon space. No chip scaling or grid reflow on every choice. At-limit/disabled taps stay silent. | Selection after accepted change | First |
| Onboarding source suggestion → review | Keep source identity legible across a short content transition. Do not attempt a full shared-element flight from the list. Choose another reverses the local change. | None for preview | Supporting |
| Onboarding resolve/retry/follow | Inline busy state; result replaces it without resizing the button. Followed row/check resolves only on confirmed follow; error stays readable. | Commit for a new follow only | First |
| Onboarding personal reveal / first save | Use the two authored specifications above; zero-source, Managed, offline, stale, empty, error, and retry states get plain state feedback. | First-save milestone; later-save commit | First |
| Onboarding → Premium / back / continue to Saved | Short transition in the stable shell; keep continue visible and usable. Do not animate the offer more strongly than the value moment. | None | Supporting |
| `DemoPaywall`: choose plan | Ease selected border/background/check, not the price numerals. Label and price change immediately together. | Selection for changed plan | Supporting |
| `DemoPaywall`: preview complete / review plans | Brief confirmation-state transition; persistent demo disclosure. No fake processing time or celebratory purchase treatment. | Optional soft acknowledgement, once | Supporting |
| `/welcome-preview` | Reuse exactly the same flow and replay guards. Existing profile data must not produce fresh save/follow pulses on mount. | Only new explicit actions | First |

### Today, Sources, and discovery

| Surface / interaction | Recommendation | Haptic | Priority |
| --- | --- | --- | --- |
| Today (`(tabs)/index`): initial feed | Stable geometry, quiet placeholder-to-content transition. No card-by-card arrival on every visit. | None | Foundation |
| Today: Watch / thumbnail | Press feedback and normal player navigation. | None | Supporting |
| Today: Save / add to session | Confirm local change; fade handled card and close the resulting gap over 180–220 ms while preserving scroll position. Show the existing Saved shortcut. Keep any exiting visual noninteractive and inaccessible. | One commit from the action owner | First |
| Today: More / Snooze / Dismiss | Native action alert plus shared snooze sheet. After confirmed disposition, same orderly card removal. Snooze feedback must name the real return time. | Commit for snooze; silence for dismiss | First |
| Today: Undo / notice close | Restore the item to its true position without replaying the whole feed. Notice appears/disappears with a small opacity transition; retain its existing actionable lifetime. | Commit for successful Undo; none for close | First |
| Today: refresh / offline / stale / no cache | Native refresh affordance; preserve existing content during refresh. No re-entry or success pulse on refetch. | None | Preserve |
| Today: genuinely caught up | One quiet transition from the last acted-on item to the end state. Do not animate it every mount. Approved-content, no-source, snoozed-only, and no-new-video states are not achievement moments. | None | First |
| Today: Open Sources / saved-notice shortcut | Ordinary navigation. | None | Quiet |
| Sources: Followed ↔ Discover | Transition the selected segment and use a short content crossfade. No horizontal swipe gesture implied by the visuals. | None, consistent with navigation | Supporting |
| Sources: open channel / add source / account connect | Native route/sheet or external authorization presentation. No additional hero or avatar motion. | None | Quiet |
| Add Source: type/find/result/choose Watch | Stable field/button; reveal verified preview locally. Keep keyboard movement owned by the keyboard layout. | None for resolution or navigation | Supporting |
| Add Source: follow/save | Consistent check/status transition after the outcome; preserve a readable result when the preview clears. Managed approval requests must say “requested,” not “followed.” | Commit for actual saved/followed/requested result | First |
| Weekly picks: preview/follow/not for me/more | Preview uses normal navigation. Follow gets the common commit state. Dismiss closes the gap. “More” updates the bounded group without a slot-machine-style shuffle or new-content pulse. | Commit for follow only | Supporting |
| Weekly picks: first-use interests / all failure and end states | Reuse chip feedback; all other states remain quietly readable. No animated weekly countdown. | Selection on accepted interest change | Supporting |
| Channel `/channel/[id]`: follow/unfollow | Plus-to-check state transition on follow; unfollow retains confirmation and readable outcome. | Commit for follow; no celebratory unfollow pulse | Supporting |
| Channel: video list / refresh / unavailable / Premium gate | Reuse media loading and navigation. Preserve scroll and existing data on refresh; gate action opens its configured offer without attention loops. | None | Quiet |
| `/google-import`: selection and count | Reserved check geometry with a short state transition. Update count directly, without rolling numerals. No animation for each search keystroke. | Small selection cue; suppress rapid duplicate bursts | Supporting |
| Import: load 50 more / retry / import result | Append without cascades, keep dock fixed, show real partial/failed/success outcomes. Successful import may resolve the selected group together. | One milestone for successful batch; never one pulse per source | Supporting |

### Saved, sessions, and Watch

| Surface / interaction | Recommendation | Haptic | Priority |
| --- | --- | --- | --- |
| Saved: current session/draft/open/create | Keep the umber programme still; press response and system navigation suffice. Progress is truthful on return, not animated from zero. | None | Quiet |
| Saved: other sessions disclosure | Short content reveal with measured geometry; preserve reading position. Do not animate arbitrary height while text wraps. | None | Supporting |
| Saved: Continue watching / saved cards | Common card press state, no whole-card scale. Continue indicator remains static until real progress changes. | Remove existing navigation impact | Foundation |
| Saved: filters/search/clear | Selected filter transitions; results update without a list-wide cascade. Typing and count updates remain immediate. | Selection for a changed filter; none for text | Supporting |
| Saved: remove and empty/no matches | After confirmed removal, close the gap and retain focus near the removed item. Empty/search states stay still. | None | Supporting |
| `/session`: select/unselect | Order badge resolves in reserved space; tray adds/removes a row coherently. Keep selected identity stable in search results. | Selection only for an accepted change | First |
| Session Builder: move earlier/later | Visibly exchange measured row positions in about 220 ms. Update order and accessible announcement together. Keep existing accessible buttons; no new drag-only behavior. | One selection tick | First |
| Session Builder: name/search/autosave | No keystroke feedback or pulse for every draft write. Keep footer geometry stable. | None | Quiet |
| Session Builder: Save / Save & begin / validation | Save resolves to the programme detail through ordinary navigation. Save & begin goes straight to the player. No duplicate success-plus-impact. Invalid/incomplete form gets clear text/focus. | Milestone for Save; single soft cue for Save & begin | First |
| Session detail `/session/[id]`: start/restart/from a row | Use the standard playback presentation; the programme remains still. No simulated curtain or zooming grain. | One soft start cue after accepted position update | Supporting |
| Session detail: edit/duplicate/delete | Edit uses native navigation. Duplicate resolves to the new title/status after success. Delete retains confirmation and normal return. | Commit for duplicate; none for navigation/delete | Supporting |
| `/add-to-queue` compatibility route | Reuse `TodaySessionModal` feedback. Avoid animating both the route modal and nested sheet as independent entrances. | One commit from the successful add/create owner | Foundation |
| `TodaySessionModal`: existing/new/full/already included | Stable button, busy state, and short completion/dismissal. No feedback for disabled or already-included rows. | Commit once, not both in sheet and parent | First |
| Watch `/watch/[id]`: enter/load/buffer/retry | Preserve official player behavior, fixed stage, and native presentation. Animate Frame's own status elements only. No re-entry for buffering. | None | Foundation |
| Watch: Save/remove | Small bookmark fill/state transition; keep control width stable. | Commit for save; none for removal | First |
| Watch: manual chapter seek | Small active-row highlight transition; active chapter updates caused by playback are quieter. No scrolling/highlight sweeps through all rows. | Selection for explicit seek only | Supporting |
| Watch: next/rewatch/close/Today/Saved/source/external link | Normal route or state transition. Never hide controls pending a flourish. Remove routine light/medium impacts. | None, except explicit session-start policy above | Foundation |
| Watch: between videos / session complete | Use the authored ending treatment. No automatic haptic on video end; no preference for Continue over Done through motion. | None | First |
| Watch: approval request / PIN approval | Reuse protected-action feedback. No lock-burst animation; playback remains gated until real authorization and access checks complete. | One commit for accepted request/approval, deduplicated against PIN | Supporting |
| Watch: time exhausted / quiet hours / required break / offline/error | Stable, immediate explanation and recovery actions. Do not shake, buzz, count down theatrically, or celebrate a restriction. | None for automatic limits/errors | Quiet |
| Watch: fullscreen / rotation / system back | Keep OS/player ownership. Cancel in-flight decorative movement before layout/orientation changes; do not animate the WebView dimensions manually. | None | Foundation |

### Settings, profiles, and utility pages

| Surface / interaction | Recommendation | Haptic | Priority |
| --- | --- | --- | --- |
| Settings: interests | Same chip treatment as onboarding/discovery. Confirm actual change; current provider is fire-and-forget, so a completed-save signal needs an outcome contract. | Selection only for accepted value change | Supporting |
| Settings: light/dark/accent | Animate the local selection indicator only initially. Change the full palette atomically to preserve contrast. Consider a short global theme dissolve only after device review proves it helps. | One selection cue after accepted change | Supporting |
| Settings: connect/import/disconnect | Native authorization/import; keep confirmation and real connection state. No welcome-back confetti. | None | Quiet |
| Settings: Profiles & boundaries / Demo / Privacy / Terms / support | Native navigation or shared sheet. No icon animation on every settings row. | None | Quiet |
| Settings: Premium states / restore entry | Quiet status and correctly configured purchase sheet. Disabled in this build. | None for checking or navigation | Deferred |
| Profile switcher: choose/cancel/current/busy | Selection remains readable under the opaque switching cover. Keep current/disabled rows silent. No staggered avatar arrivals. | One commit for completed switch | Supporting |
| Profiles & boundaries: list → detail → editor → back | Same sheet remains in place; brief local crossfade/directional content transition. Use `contentKey` intentionally; do not reset fields merely to replay an effect. | None for navigation | Supporting |
| Profile: create/rename/reorder | New/renamed row resolves after persistence. Reorder uses the same row-continuity pattern when visible; otherwise clear status suffices. | Commit for create/rename; selection for changed order | Supporting |
| Profile: delete / PIN add/change/remove | Retain native confirmation and exact consequences. No celebratory deletion or flying-away profile. PIN confirmation gets a restrained verified state. | One commit for PIN setup/change; none for deletion/removal | Supporting |
| Allowance: preset/custom/unlimited | Same reserved selected state; custom field appears without pushing focus away. Save outcome must distinguish active change from pending Owner increase. | Selection for choices, one commit when saved | Supporting |
| Owner allowance delay / cancel pending | Static activation date and clear accepted cancellation. Never animate a pending value as already active. | Commit for accepted cancellation only | Quiet |
| Schedule: switches/time pickers/minutes | Leave built-in control motion and tactile behavior to the OS. Brief reveal of dependent fields; numeric editing stays still. | No custom feedback on native controls | Supporting |
| Pause Frame / resume choices / save | Choice feedback reflects the draft; only Save confirms the real boundary change. No effect implies an unsaved pause is already active. | Selection on choice; commit on saved change | Supporting |
| Content mode / requests / approval details | Quiet selected state and detail expansion. Request removal closes its gap after review; approvals update together. Stale metadata explanation remains readable. | Commit for successful approval/mode change; none for opening details or denial | Supporting |
| Content revoke / deny | Retain confirmation where present and neutral outcome copy. Avoid “rewarding” denial. | No celebratory cue | Quiet |
| Owner PIN prompt: submit/error/cooldown/cancel | Stable input; short error-text appearance. Do not shake the panel. No per-digit custom haptic or countdown pulse. Honor authorization expiry immediately. | One reject for a submitted wrong PIN; avoid success duplication with the ensuing action | Supporting |
| Full reset: review → type RESET → final alert → erase | Still, deliberate steps; native confirmation. No delight treatment or “fresh start” celebration around data destruction. | None | Quiet |
| `PaywallSheet` real purchase/restore/legal links | If later enabled, reuse shared sheet/plan treatment. Await verified entitlement for success. Pending/cancel/no subscription found are not success. Do not animate blur intensity or the purchase CTA. | One verified success event only, avoiding duplicate store feedback | Deferred |
| `/privacy`, `/terms` | Still reading surfaces with native push/back; links keep ordinary press feedback. | None | Quiet |
| `/diagnostics` | Data updates stay direct; no animated numbers or pulses on its two-second status polling. System share sheet owns its interaction. | None | Quiet |
| `/+not-found`, `/link-unavailable`, `ErrorBoundary` | Immediate legible recovery, no sad-character or error animation. | None | Quiet |
| `/+native-intent`, `/explore`, `/library` aliases | Routing only; never introduce an intermediate animated page. | None | Quiet |

## 6. Shared component coverage

The route tables above include all visible component families. This index makes the implementation boundary explicit.

| Component files | Responsibility |
| --- | --- |
| `Sheet` | One shared overlay/content transition with safe keyboard behavior and interrupted exit handling. |
| `ScreenHeader`, `ProfileSwitcherModal`, `ProfileControlsModal`, `OwnerPinModal`, `FullResetModal` | Header stillness, sheet continuity, privacy-safe switching, protected state confirmation, restrained error handling. |
| `AllowancePicker`, `ManagedPlaybackControlsEditor`, `ManagedContentAccessEditor` | Selections, dependent-field expansion, accepted changes; no custom feedback on native controls. |
| `ClockTimePicker`, `.native`, `.web`; `SnoozePicker`, `.native`, `.web` | Preserve platform pickers and web inputs. Wrappers add no independent choreography. |
| `SnoozeModal`, `TodaySessionModal`, `AddChannelModal` | Shared sheet language and mutation feedback, with one event owner. |
| `OnboardingFlow`, `OnboardingReveal`, `DemoPaywall` | First-selection and first-save moments, stable stages, restrained offer interaction. |
| `InterestChoices`, inline onboarding/settings interest choices | Shared selection behavior; fixed check space and no hydration pulses. |
| `TodayVideoCard`, `VideoCard`, `WeeklyPickCard` | Local control feedback and handled-item continuity; no scrolling entrances or whole-card scale. |
| `SessionProgramme` | Programme stays still; status follows real session state. |
| `MediaImage`, `MediaMount`, `ProgrammeGrain` | Keep reduced-motion-aware image crossfade, fixed matte geometry, and entirely static grain. |
| `VideoSkeleton` | Reduce repeated motion; static thumbnail placeholders; optional bounded, non-interactive feed pulse. |
| `VideoChapters` | Local active-state feedback; haptic only on user-initiated seek. |
| `YouTubePlayer`, `.native`, `.web` | Integration surfaces retain their provider-controlled behavior; no custom branding or decorative overlays added. |
| `PaywallSheet` | Reviewed but dormant. No billing activation as part of motion work. |
| `EmptyState`, `ErrorBoundary` | Readable stillness and standard recovery controls. |

## 7. Implementation constraints

1. **Create shared primitives, not a motion framework.** Proposed additions: `constants/motion.ts`, a small `services/feedback.ts`, a device preference for haptics, and reusable selected/commit state transitions where they remove duplication. Keep native navigation. Existing React Native `Animated` is sufficient for most proposed effects; `react-native-reanimated` is not a direct dependency and should not be added by default.
2. **Do not make list data wait for motion.** Writes and query invalidation happen when they should. Any short exiting presentation must be keyed to the same profile, noninteractive, inaccessible to assistive technology, and cleared on navigation/profile switch/metadata expiry. Preserve scroll anchors and never present removed content as actionable.
3. **Keep user intent separate from cache changes.** Animate confirmed direct actions, not query hydration, refresh, profile loading, or repeated effects. One success signal per action. Capture profile identity and cancel stale completion effects.
4. **Keep safety state immediate.** Authorization expiry, revoked approval, exhausted allowance, app backgrounding, and invalid-session states must stop/block playback immediately. They never wait for an exit transition.
5. **Protect the player.** Do not animate the iframe/WebView itself, wrap live playback in scale/blur/mask effects, remount it for decoration, or obstruct provider controls. Only Frame-owned surrounding or post-playback surfaces receive custom effects.
6. **Bound layout work.** The session tray is at most three items: measured transforms are feasible there. Test long titles and font scaling. Avoid global layout animations that incidentally animate a modal, unrelated list, or profile boundary. Fall back to an immediate layout update if correct measurement is unavailable.
7. **Respect focus.** Only one active onboarding/editor stage is accessible. Outgoing views cannot retain focus or accept input. Announce completed mutations and reorder results once; do not announce animation progress. Keyboard timing is owned by the OS.
8. **Protect rendering budgets.** Use native-driven opacity/transforms where applicable, no animated texture/blur/shadow fields, and no JS timer per card. React Native documents that looping animations can interfere with virtualized-list rendering; retained loading loops need `isInteraction: false`. [3]
9. **Keep contrast and content stable.** Prefer animating selection backings/checks while text changes atomically. Check all six theme combinations. No whole-app opacity fade exposing an obsolete profile or producing a flash between light/dark palettes.
10. **No new sound.** Haptics supplement visual and accessible feedback. Video and native system audio remain the only sound sources in this scope.

## 8. Recommended delivery order

| Pass | Concrete scope | Acceptance evidence |
| --- | --- | --- |
| A — Foundation | Shared reduced-motion handling and semantic haptics; device-wide toggle; remove navigation impacts; quiet skeletons; consistent press/selection feedback; verify modal ownership. | Actual iPhone and Android behavior, OS motion settings, haptics disabled, no list starvation or doubled feedback. |
| B — Brand moments | First selection + first save; Today handled-item/Undo continuity; session tray reorder/save; Watch between-video and completion surfaces. | Short recordings of the real app, including first-run, repeated use, empty/offline, long content, and interrupted actions. |
| C — Supporting consistency | Follow/import; disclosures; profile editors; boundaries; demo plan selection. Keep real billing dormant. | Same interaction gives the same response across entry points; all recovery paths remain immediate. |

Start with A and B. If C adds noticeable activity without improving comprehension, keep that interaction quiet. Shared-element thumbnail-to-player transitions, a custom draggable sheet system, drag-and-drop session editing, shaders, Lottie/Rive assets, and a theme-transition engine are unnecessary for this phase.

## 9. Device review and bounded verification

This review did not run or visually approve the native app; no substitute mockups were produced. Haptic quality cannot be judged in screenshots or a desktop browser. Existing unit tests do not establish smoothness or perceived quality.

For implementation, do one batched device pass, fix its concrete findings together, then one confirmation pass:

- Real iPhone and a representative Android phone; test a weaker actuator if available. Check release-build playback and list scrolling, not only development mode.
- Standard and reduced motion; all six themes; large text; VoiceOver/TalkBack; keyboard open; portrait/landscape; haptics toggled off.
- Rapid repeat taps, mid-animation back, background/foreground, failed writes, offline/slow responses, cache arrival, and profile changes during an action.
- Onboarding: suggestions absent, Managed path, selection empty, first save, save succeeded but refresh failed, returning from Premium, and explicit replay.
- Today: Save/add/snooze/dismiss/Undo; last item handled; refresh without new items. Preserve position and actionable notice.
- Session: three long titles, reorder interruption, removal, save failure, next/rewatch/final ending; no unintended playback or duplicate completion.
- Protected flows: PIN error/cooldown, cancelled authorization, permission expiry, revoked content, automatic viewing limit, and reset cancellation.
- Track dropped frames and delay between accepted action and visible confirmation. No forced waits, duplicate haptics, touch-target movement during a press, hidden controls, or old-profile content during transitions.

Use focused tests for the new behavioral contracts: haptic preference/platform/foreground gates, one event per confirmed action, no feedback for no-op or failed writes, reduced-motion fallback, replay deduplication, and immediate protected-state changes. Do not write snapshot tests merely to assert the chosen milliseconds.

## References and limits

[1] [Expo SDK 54: Haptics](https://docs.expo.dev/versions/v54.0.0/sdk/haptics/). Checked against Frame's installed `expo-haptics` declarations and source. Supports the feasibility and platform mapping; it does not establish identical feel across devices.

[2] [Android: Haptics design principles](https://developer.android.com/develop/ui/views/haptics/haptics-principles). Supports consistent, event-appropriate feedback and avoiding buzzy fallback effects. Frame's placement and strength choices above are design recommendations.

[3] [React Native 0.81: Animated](https://reactnative.dev/docs/0.81/animated), particularly `loop` and interaction handles. Supports the identified potential rendering risk; this review did not reproduce a performance failure.

[4] [Apple: Playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics). Official search excerpts support predefined feedback and native control ownership; full page text required JavaScript in the available reader. Detailed recommendations here rely on the installed SDK, accessible Expo/Android documentation, and the reviewed code rather than an unverified reading of the full Apple page.
