# Frame prepublication acceptance

This is the current native acceptance pass for Frame’s implemented feature contract. Run it after design and hardening changes, before distributing a native build. The welcome flow includes a clearly labeled sample checkout. Billing is intentionally disabled during the free beta.

Codex owns the automated logic, persistence, backend, and security checks. Rork owns running this checklist in real iOS and Android builds, native presentation fixes, signing, and build delivery. Never mark a device step complete from a web preview or export alone.

## Test record

For each platform, record:

- device or simulator model and OS;
- app commit, version, and development/staging environment;
- fresh install or upgraded database;
- start/end time and pass/fail;
- screenshot or recording filename for each evidence item;
- every failure as new regression, known issue, or environment/configuration issue.

Use disposable development or staging data, non-production Google accounts, and non-production quotas. Never capture tokens, keys, PINs, or customer data.

## 1. Clean launch, onboarding, and shell

1. Start from a fresh install or complete local reset.
2. Confirm onboarding appears once and can finish with the intended interest-selection rules.
3. Confirm the app opens to exactly four tabs: Today, Sources, Saved, and Settings.
4. Relaunch and confirm onboarding does not repeat.
5. Confirm there is no infinite feed, broad video search, algorithmic next-up, autoplay, comments, live chat, or Shorts surface.

Pass condition: the shell hydrates without a wrong-profile flash, obsolete Home/Explore/Library tab, or hidden fifth tab.

## 2. Profiles, Owner PIN, and isolation

1. From Settings, create one Standard and one Managed profile.
2. Add an Owner PIN. Confirm entering the Owner from another profile requires it.
3. Rename and reorder the non-Owner profiles, then restart the app.
4. In each profile, create distinct interests, sources, Saved items, progress, and a Session.
5. Switch repeatedly among profiles and confirm no content or transient state leaks across them.
6. Cancel one PIN prompt and confirm the protected mutation does not happen.
7. Enter five incorrect PIN attempts, confirm the cooldown, then confirm a later correct attempt works.

Pass condition: identity and all local state remain profile-scoped; protected callbacks cannot complete after cancellation or a profile switch.

## 3. Trusted Sources and finite Weekly Picks

1. In the Owner or Standard profile, paste and verify one supported channel, handle, or video URL.
2. Confirm verification alone follows nothing; explicitly add the source.
3. Confirm the source appears once, remains after restart, and can be unfollowed without affecting another profile.
4. At the shared beta source ceiling, confirm both manual Follow and selective Google import refuse one additional source without changing the existing follows.
5. Open Discover in Sources. With no interests, confirm it remains empty and makes no replacement recommendation.
6. With interests selected and a current publication available, confirm no more than three distinct Weekly Picks appear in total.
7. Dismiss a pick with Not for me. Confirm it stays hidden after restart and does not automatically backfill.
8. If the fixed weekly pool has another candidate, use More from this week. Confirm it fills only an empty slot, stops when exhausted, and makes no YouTube or AI request.
9. Follow a pick and confirm it disappears from the current edition without backfill; switch profiles and confirm their editions remain independent.
10. Change interests during the week and confirm the issued edition stays stable until the next weekly period. Confirm the next edition date is shown.
11. Confirm offline, maintenance, configuration, empty-publication, and backend-failure states are truthful and do not silently generate substitutes.

Pass condition: Sources are deliberate, Weekly Picks are shared and finite, and the mobile app never performs search or AI work.

## 4. Finite Today

1. Follow enough test sources to populate Today.
2. Confirm Today displays at most 12 items and at most two from any source.
3. Save one item, add one to a Session, snooze one, and dismiss one.
4. Confirm each successful action removes or hides only the intended card; cancel or force one failed action and confirm the card remains.
5. Pull to refresh and wait briefly. Confirm the same period does not refill behind the user or replace handled items.
6. Exhaust the inbox and confirm a stable caught-up end state.
7. Restart offline and confirm the persisted snapshot renders with an honest offline/cached label.

Pass condition: Today is deterministic, finite, locally actionable, and never becomes an endless feed.

## 5. Managed — Selected Videos

1. In protected profile controls, set the Managed profile to Selected Videos.
2. Enter that Managed profile. Confirm Today contains only Owner-selected videos and Sources hides Weekly Discover.
3. Open an unapproved video link. Confirm the player does not mount or fetch playback before approval.
4. Tap Request. Return to protected controls and confirm one local video request appears.
5. Deny it once and confirm it remains blocked.
6. Request again, approve it, and confirm only that exact video becomes playable.
7. Revoke the selected video during or before another playback attempt. Confirm the next checkpoint stops or blocks it.

Pass condition: exact video IDs are fail-closed, requests stay local, and approval/revocation requires an established Owner PIN.

## 6. Managed — Approved Sources

1. Change the same Managed profile to Approved Sources.
2. Confirm requests from the old mode were cleared and no approval was silently converted.
3. Add or approve one source through the Owner boundary.
4. Confirm Today and Sources show content only from the approved-and-followed source.
5. Confirm another source is blocked, can create one local source request, and becomes available only after approval.
6. Open a crafted or external `frame://` video link whose route metadata claims the approved source. Confirm Frame verifies source identity instead of trusting the link; unavailable verification must fail closed.
7. Remove the source approval and confirm its videos disappear or stop at the next access check.

Pass condition: source identity is verified from profile-local cache or the trusted resolver, never from deep-link parameters alone.

## 7. Daily time and Managed playback controls

1. Set a short Managed daily allowance and confirm active playback alone consumes it.
2. Pause, background, close, and reopen the player; confirm time persists without double counting.
3. Confirm five-minute and one-minute warnings appear at most once per local day when applicable.
4. Configure a viewing window and quiet hours, including one overnight interval. Confirm playback availability changes at the correct local boundary.
5. Configure a short session limit and break. Confirm the session stops, remains blocked through the break, and later resets.
6. Use Pause Frame for a finite time, resume it, then test indefinite pause/resume.
7. Change the device clock backward and confirm usage does not reset; advance across the local day boundary and confirm the intended reset.
8. Confirm these controls limit playback only inside Frame and leave Settings accessible.

Pass condition: every player entry, actual start, 15-second checkpoint, background, exit, and profile switch shares the same fail-closed boundary.

## 8. Saved, progress, Sessions, and intentional stopping

1. Save a video and confirm Saved persists it after restart.
2. Play beyond 15 seconds, leave, and confirm Continue Watching records the position.
3. Reopen, resume, and complete the video. Confirm completion clears stale progress.
4. Create a named Session of one to three videos and reorder it.
5. Start at each position and confirm progress follows the intended item after edits.
6. Finish an item and confirm nothing auto-advances; Continue is always explicit.
7. Finish the final item and confirm a stable quiet end state.

Pass condition: the library is one canonical Saved collection, Sessions stay finite, and no unrelated video autoplays.

## 9. Selective Google import

1. If the platform OAuth client is intentionally absent, confirm a truthful unavailable state with no crash.
2. With a development/staging client, connect a disposable Google account.
3. Select subscriptions explicitly; confirm nothing is imported automatically and the per-profile source cap is enforced before mutation.
4. Confirm imported sources remain local and profile-scoped.
5. Disconnect Google. Confirm the credential is revoked/removed while already imported sources remain.

Pass condition: Google is an optional import connection, not Frame identity, and credentials never appear in diagnostics or logs.

## 10. Reset, diagnostics, and failure honesty

1. Populate profiles, PIN, schedules, approvals, requests, Saved items, progress, Sessions, interests, searches, sources, and optionally Google credentials.
2. Start full reset, cancel at each confirmation stage, and confirm nothing is erased.
3. Complete full reset. Confirm all local profile-owned data and protected credentials are removed and one clean Owner profile is restored.
4. In a development build, open diagnostics and confirm the app environment, version, database version 9, backend configuration state, feature flags, and active profile are truthful.
5. Confirm diagnostics contains no API key, secret, OAuth token, PIN verifier, source lease token, or full credential.
6. Confirm diagnostics is absent from production Settings and direct production navigation redirects.
7. Exercise malformed links, offline source verification, unavailable cached content, player timeout/error, and expired metadata. Confirm each state preserves user choices and offers no fake success.

Pass condition: destructive operations are explicit, failure states are honest, and no secret or private viewing behavior leaves the device.

## Rork native-build handoff

Run these after Rork connects the project to its Expo/EAS build workflow:

- install a clean iOS development build and Android development build;
- confirm SQLite migration 8 → 9 preserves existing profiles and playback controls;
- confirm SecureStore PIN and Google credential behavior on both platforms;
- exercise native time pickers, safe areas, keyboard avoidance, back gestures, and accessibility labels;
- rotate the Watch screen, enter/exit fullscreen, background/foreground, and confirm orientation/keep-awake cleanup;
- open supported `frame://` links from outside the app;
- capture portrait screenshots of all four tabs and both Managed access modes;
- capture one player completion recording and one time-boundary recording per platform;
- record any presentation-only defects for the later graphic-design and copy passes.

Rork should not replace the implemented policy, database, backend, or security logic while doing this plumbing. Functional changes come back through the code/test path.

## Release blockers

Do not proceed to design/paywall work if any of these occurs:

- playback begins before content and time approval;
- a Managed profile sees an unapproved video/source or Weekly Discover;
- deep-link metadata bypasses Approved Sources;
- Today refills, autoplays, or exceeds its finite caps;
- state crosses profile boundaries;
- a protected mutation succeeds after PIN cancellation or profile switch;
- a reset leaves recoverable private state behind;
- a mobile screen calls YouTube search, Gemini, or an unreviewed publication path;
- secrets or credentials appear in logs, screenshots, diagnostics, URLs, or repository files.

## Evidence checklist

- [ ] iOS: onboarding and four-tab shell.
- [ ] iOS: Selected Videos request/approve/revoke.
- [ ] iOS: Approved Sources and deep-link verification.
- [ ] iOS: time controls, playback completion, and reset.
- [ ] Android: onboarding and four-tab shell.
- [ ] Android: Selected Videos request/approve/revoke.
- [ ] Android: Approved Sources and deep-link verification.
- [ ] Android: time controls, playback completion, and reset.
- [ ] Completed result sheet with every failure classified and assigned.



## 15. September 30 polish and interruption regressions

All items below require real iOS and Android evidence; they are not signed off by automated tests.

- [ ] Inspect every route in light and dark appearance at small phone width, default text size, and largest supported text size. Check PIN/name/allowance inputs, profile editor, snooze, Google import dock, session footer, and player error/end states. No clipped controls, overlapping labels, or square inner focus outline.
- [ ] With a hardware keyboard, confirm focus is visibly distinguishable, labels remain visible after typing, and fields retain expected capitalization, secure entry, and keyboard types.
- [ ] Restart offline with an existing library. Saved, resume records, sessions, draft, approved content, and Today snapshot must load from device storage. Playback still requires internet.
- [ ] Inject failed local-library and approval reads: show a recovery state, not “no saved videos” or “no approved sources.” Retry must restore the appropriate view.
- [ ] Force a draft write failure, then edit or reorder again. Show unsaved status and Retry; Back must warn while the latest changes are unsaved. Retry succeeds, and saving a session does not recreate its old draft.
- [ ] Double-tap session Start, Duplicate, and Delete. Each action runs once. Leave during a delayed operation: no late navigation or alerts; any committed change remains scoped to its original profile.
- [ ] Cancel final reset, close/reopen reset, edit RESET, or leave its confirmation step. An obsolete confirmation cannot erase data. Confirm a fresh reset once on disposable data; repeat the flow to ensure it remains usable.
- [ ] Delay Google sign-in, switch profiles or reset, then complete sign-in. It must not change the current profile’s account or navigate into import. Retry a fresh sign-in normally.
- [ ] Fail Request approval, Approve with PIN, Save, and Open original video. Each gives visible recovery feedback; blocked playback remains blocked.
- [ ] Discover loading, offline, and failed editions must not claim “End of weekly picks.” An edition with more choices must retain its More action.
- [ ] Complete welcome with no choices, with a followed source, and with a first saved video. Preview the sample checkout, Back, skip, and complete it; confirm there is no purchase and the destination fits the user’s saved choices.
- [ ] Enable Reduced Motion and disable haptics. Confirm selection, reorder, onboarding reveal, sheets, and ending states remain usable; re-enable each on supported hardware and assess the actual feedback.


## 16. Distilled Settings navigation

- [ ] Settings shows a compact index with current interest, appearance, and account summaries. Each row opens the named destination; native Back returns to the same Settings index.
- [ ] Change interests and appearance, go Back, and confirm the summaries update. Switch profiles and confirm both the controls and summaries belong to the new profile.
- [ ] Haptics is reachable through Appearance & feedback. Google import/disconnect is reachable through Google connection. Privacy, Terms, and the protected reset sequence are reachable through Privacy & data.
- [ ] Demo welcome replay and beta diagnostics remain reachable through About & help when enabled. Premium is absent and a direct Premium settings link redirects to Settings while billing is disabled.
- [ ] Cancel Owner authorization and leave during a delayed Google connection or reset authorization. The departed settings page must not navigate or reopen an obsolete dialog.
- [ ] Verify all six index destinations and detail screens at small phone width and large text, with VoiceOver/TalkBack and a hardware keyboard. Check native swipe/Android Back as well as a direct link to a detail screen.
- [ ] Settings refinement: verify title/summary hierarchy, pressed-row contrast, and Theme/Accent color/Touch feedback grouping in both themes. Interest and theme checks must remain visible without shifting choices; test maximum text size and reduced motion.

## 17. Motion: confirmed outcomes

- [ ] Save in Watch and first-selection setup; follow in Discover and source detail. Confirm the spinner becomes a short, non-bouncing icon settle only after success. Opening already saved/followed content must remain still.
- [ ] Force save/follow failure and failed unsave/unfollow. No success motion for an unchanged state. Try again; only a fresh successful addition should animate.
- [ ] Save the first setup video. The small check draws once; copy and controls are usable immediately. Back/re-entry must not replay the milestone.
- [ ] Step forward/back through setup rapidly; progress must settle at the correct step without delaying input or moving labels.
- [ ] Change Today feedback while its bar remains visible; the new message must resolve without retaining an obsolete Undo target.
- [ ] During motion, background the app, navigate away, change profile, or enable Reduce Motion. New effects must settle immediately and never replay an old outcome on return.
- [ ] On iPhone and Android hardware, inspect both themes and large text. Verify glyphs are unclipped, first-save stroke remains smooth, and scrolling/session reordering remain responsive.


## 18. October 1 critique fixes

Automated/source verification does not complete these native checks.

- [ ] Choose interests, inspect the real hero/supporting video previews, go Back and change topics. Previews reflect the current topics; a previously issued normal weekly edition remains unchanged.
- [ ] Follow each suggestion in a batch, request another finite selection, and exhaust the pool. No retry loop or invented videos. Test offline, maintenance, missing configuration, no publication, and missing/failed thumbnails separately.
- [ ] Follow a source with no eligible Today items. Browse my sources completes setup and opens Sources; eligibility and approval checks remain intact.
- [ ] Save a first video. Open Saved stays primary; Premium demo is secondary. Saved shows the saved item before expanded planning or maintenance controls.
- [ ] Restart during setup after interests, a source, and the first save. The stage and saved milestone resume for the correct profile. Replay must not alter the real draft. Finish and full reset remove the draft; simulate storage failure without losing the independently stored source/video.
- [ ] Open Sessions & progress, resume a video, create/reorder a session, and inspect its detail. All video choices have real thumbnail or stable fallback, order, readable title, and honest runtime. Edit Saved exposes removals; Undo restores the named item.
- [ ] Open an approval request. The complete title, current artwork/context, and labelled decisions are together. Expired metadata shows its refresh guidance instead of stale imagery. Existing authorization applies to both decisions. Verify PIN and profile boundaries.
- [ ] About & help reveals task guidance individually. Sources and Today recover from failed source reads with Try again.
- [ ] On iOS and Android, inspect light/dark, small phone, large text, VoiceOver/TalkBack, keyboard, and Reduced Motion. Confirm hero/copy height, long titles, disclosure focus, and actions stay usable.


## 19. Onboarding preview recovery

- [ ] Change interests after visiting a later preview batch. The new topics start at their first batch; slow results from the previous topics do not replace them.
- [ ] Follow every source in a middle batch, then navigate forward and back. Controls skip batches with no remaining choices, retain the fixed publication, and never call a partially visited pool exhausted.
- [ ] Disabled/unconfigured suggestions show setup guidance; unpublished interests invite changing topics; offline/service failure offers Retry; maintenance says paused with a later Retry. A cached publication is labelled. Missing video media shows the real source with an explicit unavailable-preview note.
- [ ] Fail the source read during the personal reveal. It must offer loading recovery rather than asking the user to follow their first source. Retry successfully and verify the same profile’s sources and eligible selection return.


## 20. Distilled setup, collection, and help

- [ ] First launch has three stages: interests, sources, selection. Skip, Back, managed access, and optional Premium demo remain reachable. Replay returns to Settings. Test old drafts at all four prior stages; source/reveal position and saved IDs migrate correctly.
- [ ] Saved opens with the collection, count, and quiet controls. Search & filter opens the field and radios. Clear & close search restores all saved videos. Edit Saved offers reversible removal with named Undo feedback.
- [ ] Sessions & progress switches to planning without also showing the saved collection or its empty state. Back to saved videos restores the collection. Switch profiles in both views and confirm isolated state.
- [ ] Requests distinguish Approve video from Approve source. Source imagery is labelled as video context; declining has a clear consequence. Existing PIN authorization, limits, and error recovery still apply.
- [ ] Each help topic opens independently and its action reaches the named screen. Inspect the three-stage flow, Saved controls, approval decisions, and help at large text on small iOS/Android phones; verify native screen-reader order. These device checks remain pending.


## 21. Premium onboarding finish

- [ ] Inspect two-column interest choices at small phone width, tablet width, and large text in both themes. Long labels wrap, checks stay visible, minimum touch height remains 52, and selected/unavailable states are distinguishable.
- [ ] Inspect real hero media in its matte surround, readable source/interest context, smaller supporting images, and missing-image fallback. No generated or substituted recommendations appear.
- [ ] Save a video successfully: the existing completion check and enabled haptic accompany “Kept for you” on the static textured surface. A failed save must not show it. Restart, revisit, or replay: no stale success animation and no claim this is the profile’s first-ever save.
- [ ] Enable Reduced Motion, disable haptics, and interrupt the existing reveal/confirmation by navigating or backgrounding. Content and actions remain usable immediately; grain never moves. Verify on real iOS/Android devices before native sign-off.


## 22. Critique handoff fixes (native acceptance pending)

- Empty Managed Selected Videos Today → Request a video opens a video-link form. Resolve a real video → Request approval. Confirm no playback/approval occurs and request count appears for Owner Settings and profile summary.
- Review a video and source request. Preview original requires Owner authorization and opens the canonical provider destination. Return, unlock if required, and confirm the same profile and request are expanded; no automatic approval. Cancel unlocking, retry, and close review safely.
- Expired evidence: Approve disabled, Refresh details available. Offline, unavailable, mismatched and still-expired responses preserve the pending request. Successful refresh preserves scope and request ordering. Decline still works without fresh evidence.
- Interrupt an unsaved video after more than five seconds. Saved exposes one Continue watching row above the collection even with no saved videos; search/edit/session planning remain focused.
- Dismiss A then save B: feedback is Video saved / View Saved. Add/create a session: Open session goes to that exact session, never an earlier Undo target.
- First-save confirmation explains local link/internet use. How Saved works expands in Saved; welcome replay entry and flow disclose all real changes.
- Create sessions from Today and the full builder with blank/edited names; both use the same unused Session N fallback. Test gaps in numbering after deletion.
- Verify narrow phone, large text, keyboard, VoiceOver/TalkBack and Reduced Motion for new request, return-unlock, continuation and disclosure states.


## 23. Consistent controls and recovery (native acceptance pending)

- [ ] Compare interest groups in setup, Discover, and Settings on narrow phones and large text in both themes. Labels wrap, checks remain visible, and selection limits are enforced consistently.
- [ ] Show stale Today details, refresh successfully, and fail refresh offline and with a service error. Refresh is explicit; ordinary refresh does not use the offline icon. Discover recovery opens followed sources.
- [ ] Load a source slowly and fail its load. The heading names the state. Expand and collapse long source and player descriptions; View source stays discoverable. Finish playback and verify the deliberate ending is unchanged.
- [ ] Remove a saved video in Saved and in both player presentations. Verify the named Undo restores the same link, dismiss works, repeated taps run once, failures retain recovery, and profile/route changes never restore into another profile.
- [ ] Open an empty session builder and choose Today; existing draft exit behavior remains intact. Delete a session containing saved videos and verify those videos remain in Saved.
- [ ] Edit Pause Frame and Resume: neither applies before Save; Cancel preserves prior settings. Read PIN recovery beside creation. Return from an external approval preview with expired authorization, then close the locked review safely.
- [ ] Select Google subscriptions, search, load another page, leave accidentally, and return while Frame remains open. Selections and loaded pages return for the same connection; followed items and changed capacity reconcile. Reconnect or switch profiles and confirm isolation. Import successfully, then Open followed sources reaches the followed tab.
- [ ] Follow device-data and Google links from Privacy and Terms. Verify the useful About & help summary and plain-language unavailable screen. Check keyboard, VoiceOver/TalkBack, safe areas, and Reduced Motion on iOS/Android.

Source/automated checks: 247 tests pass; TypeScript passes; scoped lint has no errors and one pre-existing onboarding dependency warning; static Impeccable detection has no findings. These checks do not substitute for the device acceptance above.


## 24. Adaptive layout and choice consistency (native acceptance pending)

Source audit and implementation are complete for this scope. All 247 existing tests, TypeScript, and lint on changed source files pass. No new animations, field-intensity changes, or iPad support were added. Native rendering and platform conformance remain unscored until the checks below run on devices.

- [ ] Inspect Today, Saved, Sources, and Google import in compact and expanded windows, light/dark, portrait/landscape, and Android multi-window. Headers, media, empty/error states, and import actions share their bounded content width. Existing virtualized Saved/import lists remain scrollable.
- [ ] Around the 1000-unit navigation threshold, resize without losing the selected tab, scroll state, search, or import choices. Wide windows show the navigator's sidebar; narrow windows show four labelled bottom tabs. Larger text increases the threshold and available label space. All destinations retain accessible names and selected state.
- [ ] At font scale 1.0, 1.3, 2.0, and the supported system maximum, inspect interests, allowance presets/custom input, Theme, Accent color, and Saved filters. Text wraps, checks stay visible, disabled limits still apply, and every choice can be reached. Large-text interests use one column.
- [ ] Open chapters with long titles and hour-long timestamps. Full titles remain readable, timestamps do not squeeze them, larger text stacks rows, and jumping still seeks to the intended time.
- [ ] Show Today action feedback and Saved Undo with long titles and large text. Feedback stays within the collection width; the final list item can scroll above it. Rotate while the notice is visible and verify its reserved space updates.
- [ ] In landscape with display cutouts, open profile, approval, PIN, and session sheets with/without the keyboard. Safe-area gutters protect controls. Native Back/escape and existing unsaved-change guards still work.
- [ ] With VoiceOver/TalkBack, exercise nested profile/PIN/approval sheets, return from external preview, close each sheet, and confirm focus reaches the active content and returns sensibly. Existing modal semantics are source-verified; actual focus order and restoration are not.
- [ ] Verify Reduce Motion and touch-feedback preferences through choices, confirmed saves, session ordering, and ending. No additional motion should appear. Assess smoothness on hardware.

Shipping context: iOS remains phone-only in app.json. Test iPhone and Android phones; use an Android tablet/expanded emulator for wide-window coverage. Any later iPad enablement needs a separate native acceptance pass.

## 25. Final recovery and continuity pass (native acceptance pending)

Run on iPhone and Android, including a narrow phone and Android expanded window, with large text, reduced motion, and a screen reader. These are acceptance cases, not completed device checks.

- Start with a saved/resume/session item whose metadata is over 30 days old. Refresh details explicitly, then check Saved search, session rows, and the player. Title/image recovery must keep save time, resume seconds, session order, and Today action state. A deleted/private video, mismatched response, offline response, or timeout must keep the link and offer honest retry; no background polling.
- Interrupt a saved session, restart, then use Continue watching in Saved. Confirm it returns to the named session and correct next item. Delete/reorder/advance that session and confirm stale provenance cannot attach to another session containing the same video. A migrated standalone resume stays standalone.
- At 25 sources, manual follow and import must refuse a 26th source. A legacy profile with 26+ sources retains all follows and saved videos, receives Manage sources in Today, and recovers after choosing what to unfollow.
- Begin an Owner settings edit, wait for authorization expiry, then unlock. Ordinary fields and the selected profile/request remain; current/new/confirmation PIN fields are blank. Close with unfinished changes and verify the discard decision. Repeat after an external approval preview and after backgrounding.
- In Managed Approved Sources, open an unfamiliar real video. Verify source identity through the bounded resolver; an approved source may proceed only after the existing access and allowance checks. Unapproved, unavailable, quota-limited, and offline responses stay blocked. Retry verification must never grant approval.
- Start a slow source lookup in the Add source sheet and setup. Close/Back/Skip must remain available during the read, cancel its result, and retain pasted input. Explicit follow writes remain guarded. Change profiles during lookup and confirm no stale result appears.
- Open a valid watch deep link before first setup. Complete or skip optional setup and return to that exact video through normal playback authorization. Query-supplied source/title/session claims are discarded. Profile deletion/full reset clear the retained intent.
- Follow from Add source or Discover: confirmation describes future selection and Browse source now opens the right source. Today shows the next selection time and refreshing does not refill the current day's membership.
- Use Today’s named Continue session entry and Saved’s named Sessions & progress entry. At each deliberate ending, verify the next title/duration when available, an honest unavailable label otherwise, and no autoplay.
- Check source detail, session creation/detail, and Settings details at large text and expanded widths. Content stays bounded with safe-area gutters; keyboard and dock do not cover fields or actions.
- Recheck the earlier final-pass fixes: blocked players do not show a false loading timeout; Retry and Play again create a fresh eligible player attempt; Saved's Not finished filter includes interrupted viewing; Today notices keep each action and target together.
