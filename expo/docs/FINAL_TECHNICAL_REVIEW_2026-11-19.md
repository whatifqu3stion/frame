# Final technical review — November 19, 2026

## Verdict

Frame is materially stronger technically, and the reviewed interface needs no new design round. The previous two P1 defects have regression coverage and fixes. This is **not an unconditional release sign-off**: the two source/documentation findings below were addressed on November 20; current native/provider acceptance evidence is still required.

This pass finishes the previously authorized technical fixes and reviews the result using Impeccable's native audit criteria. Browser captures are visual evidence only, not evidence of native playback, accessibility gestures or performance.

## Findings and resolution

### Resolved November 20 — Final progress-save recovery on exit

- Location: `app/watch/[id].tsx`, `closePlayer` (approximately line 692), `goToToday`, `goToSaved`, focus cleanup; `domain/progressWriter.ts`.
- The new writer retains failed checkpoints and completion operations, shows an explicit retry while Watch is mounted, and prevents next/replay navigation from ignoring a failed flush. However, Close/Back starts persistence and navigates immediately. If storage rejects after unmount, the writer's error cannot appear in that departed screen. Its retry closure is not exposed elsewhere.
- Impact: a failed final write can still leave an older resume position without an accessible retry after leaving the player. Earlier successful checkpoints remain; this is not evidence of wholesale library loss.
- Evidence: traced the current source and navigation sequence; the writer's error/flush behavior is fault-tested. This particular exit sequence was not fault-injected on a device.
- Recommendation: retain pending/failed progress operations above the route, scoped by profile/video, and offer a restrained global retry. Keep native Back usable; avoid trapping the viewer on a failed disk write.
- Suggested command: `impeccable harden`.

### Resolved November 20 — Release handoff points to an older candidate

- Location: `docs/ANDROID_SIDELOAD.md:3`, `docs/RELEASE_CANDIDATE.md:1`, `app.json`.
- The current sideload guide points to a release-candidate report headed October 31 / build 2. Current configuration is Android versionCode 4, and the workspace includes later changes. That older APK/hash/native verification does not certify this source.
- Impact: a tester or publisher could select an old artifact or mistake historical acceptance for current verification.
- Recommendation: when building the actual next candidate, allocate its next version code as appropriate, record its source revision, checksum/signing/native manifest verification, and replace the current handoff pointer. Retain previous reports as history.
- No new binary, signing change or publication was performed in this pass.

## Completed corrections

1. Playback intent invalidates asynchronous authorization on pause, departure and background. Both accounting ledgers are serialized; stop retains the original pause timestamp even if storage completes late.
2. Failed draft saves/deletes still reject to the editor, while settled queue tails let later profile switching and reset proceed.
3. Session name, order, cursor and duration are committed in one queue write after validation.
4. Resume-read failures block an unexplained start from zero. Checkpoint/completion failures expose a retry; retries cannot overwrite newer queued progress. The exit exception was resolved in the November 20 follow-up below.
5. Session metadata uses a batched, profile-scoped lookup, and reordering does not change the unordered missing-ID query identity. A 500-ID regression uses one query and one expiry pass.
6. The editor uses virtualized selected/candidate sections. Saved's additional sessions and the session picker render pages of at most 20 sessions.
7. The timed-session clock keeps quarter-second enforcement but publishes only changed displayed-minute/permission states. In a two-minute clock regression, 480 precise ticks cause two minute-display publications.
8. A delayed final checkpoint is now tied to the departing player's attempt. It cannot read a subsequent video's position after navigation.

## Impeccable audit score

Source-based, provisional; device acceptance remains outstanding.

| Dimension | Score | Assessment |
| --- | --- | --- |
| Accessibility | 3/4 | Named controls, state announcements, scalable text and reduced-motion alternatives; native traversal/large-text acceptance unverified. |
| Performance | 3/4 | Repeated editor history reads, unbounded session row mounting and timer publications addressed; no phone profiling claim. |
| Appearance and theming | 3/4 | Consistent established palette and typography. Live visual pass used the existing dark appearance. |
| Platform conformance | 3/4 | Native navigation, keyboard-aware sheets, safe-area handling and 48-unit controls in the reviewed changes; hardware gestures remain unverified. |
| Adaptivity | 3/4 | Compact layout and expanded sidebar verified in web preview; native keyboard/rotation still outstanding. |
| Total | 15/20 — Good | An engineering baseline, not store approval certification. |

No new P0 or P1 source defect was confirmed in this bounded follow-up. The two P2 findings above were resolved in the November 20 follow-up. The app uses native-oriented navigation and controls rather than a website navigation model; a browser rendering cannot establish native interaction conformance on its own.

## Quick visual pass

Reviewed the running app at 390 × 844, retaining the existing dark appearance:
- API connection setup, autoplay/scrolling/memory studies, phone demonstration and benefits sequence.
- Topic choices, personal interests and the missing-key final discovery state.
- Today empty and fictional populated states; Sources list and source detail.
- Saved videos, session card/detail/editor, including the boundary between ordered rows and selectable videos.
- Add-to-session sheet, Settings overview, weekly interests, profile sheet and key settings.
- Fictional viewing preview only; it explicitly does not play videos and is not a live YouTube-player acceptance test.

Also checked Settings at 1280 × 900: bounded content and sidebar hold together. No confirmed clipping, obstructed primary action or inconsistent branding in these sampled views. The session editor's section refactor retains the existing presentation. No cosmetic P3 backlog is proposed. Motion was visually sampled, not frame-time benchmarked. Other appearances and enlarged system text were not live-tested in this pass.

The sample library was explicitly enabled through its development UI, then exited; viewport override was reset. No keys were entered and no Gemini generation was initiated. Screenshot evidence: `research/technical-review/2026-11-19/settings-desktop.png` at the repository root.

## Verification

- `bun run verify`: TypeScript passes; lint zero errors, one existing generated-types unused-disable warning.
- **491 tests pass, 0 fail; 3912 assertions across 95 files.**
- New fault regressions cover delayed authorization, in-flight accounting stop/start ordering, preserving pause timestamps, draft failure recovery, atomic session edits, stale checkpoint retries, batched metadata, timer publication, and departed-player checkpoint cancellation.
- `git diff --check` passes.
- No booted iOS simulator observed. No physical-device playback was performed. No new signed APK/AAB/IPA was built.
- Test log: `research/technical-review/2026-11-19/verification.log`.

## Before publication

1. Exit-time progress recovery is implemented and fault-tested; include it in candidate device acceptance.
2. Build and identify the exact release candidate; refresh its handoff/verification records.
3. On that build, perform clean install and upgrade, key save/relaunch/remove, live Gemini discovery with a funded test key, YouTube playback, fullscreen/rotation/Back, background/resume, offline recovery, profile switching and viewing-limit enforcement.
4. Include keyboard, large text, VoiceOver/TalkBack and a representative Android device. Provider model lookup and passing mocks do not establish successful generation or recommendation quality.
5. Finish with one bounded `impeccable polish` confirmation of any resulting UI changes. Preserve the current visual direction.


## November 20 follow-up — authorized corrections

- Moved progress writers into an app-lifetime registry keyed by profile and video. Pending writes and failures survive route unmount; reopening the same video shares its ordered writer. Successful unused writers are released.
- Added a restrained, theme-aware recovery notice outside Watch. It exposes Retry, a saving state, a polite accessibility announcement and a 48-unit target. Navigation remains usable. Only the active profile’s failures appear.
- Profile deletion, local data wipe and full reset retire old handles and drain in-flight writes before database deletion. A stale retry or route cleanup cannot reinsert deleted progress.
- Removed the queued checkpoint’s dependence on the old component’s mutable end flag. Checkpoints retain their captured video/time and remain ordered before completion operations.
- Replaced the current release handoff with explicit working-source versus historical-build-4 status. Rechecked the existing build-4 APK hash; archived the build-2 report. No new artifact was built or published.

Verification: **496 tests pass, 0 fail, 3927 assertions across 96 files**; TypeScript passes; lint has zero errors and the existing generated-file warning. Five new fault tests cover departure before failure, return/retry ordering, profile isolation, reset ordering and profile deletion. Full output: `research/technical-review/2026-11-20-verification.log` at the repository root.

In an isolated Brave browser context at 390 × 844, injected a synthetic progress-save failure through the actual recovery registry after releasing its route lease. The app-level notice appeared on Today; Retry committed the operation and removed the notice. No horizontal overflow or page errors were observed. Screenshot: `research/technical-review/2026-11-20/progress-recovery-mobile.png`. This checks the rendered notice and recovery integration, not a physical-device disk failure or real YouTube playback. No production fault hook was added and no user browser state or keys were changed.

Recovery is held in memory while this app process is running. A force-quit or power loss can still discard an unsaved checkpoint. No Android device was connected and no iOS simulator was booted at this check. Current native/provider acceptance remains outstanding; the UI/source fixes do not substitute for it.
