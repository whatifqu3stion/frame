# Frame prepublication acceptance

Current contract: November 18, 2026. Use this checklist with `BYOK.md` and `PERSONAL_USE.md`. The app is full-access BYOK: no purchases, trial, sample checkout, or active Google account import. Earlier shared-service and Rork handoffs are historical; the prior checklist is preserved in `history/SMOKE_TEST_BEFORE_2026-11-18.md`.

## Evidence and build gate

Record commit, app version/build, device model/OS, fresh install or upgrade, light/dark theme, font scale, Reduce Motion, and test outcome. Capture evidence without keys, PINs, tokens, or private user data. Use test-owned provider projects and disposable local profiles. Browser previews and mocked tests do not establish native acceptance.

Run from `expo/`: `bun run verify` (typecheck, lint, tests). Build the signed Android candidate using `npm run android:apk`; see `ANDROID_SIDELOAD.md` for signing, verification, and artifact checks. Test the actual release candidate before distribution. Obtain current iOS build/signing and store-console verification separately. Never treat successful checks as App Store approval.

## 1. Clean launch and onboarding

- Fresh setup begins at connections. YouTube / Gemini entry tabs show accurate saved state, secure fields, useful validation failures, and compact illustrated guidance. Skip remains available outside an active write.
- Continue through autoplay, scrolling, recall, the phone preview, benefits, library topics, special interests, and first discoveries. Identity, safe-area placement, and footer actions stay consistent. Revisit setup does not erase the library.
- Interrupt study animations during the opening delay and mid-chart by backgrounding the app or leaving the route. Return resumes remaining time; hidden/stale completions cannot advance presentation state. Reduce Motion settles the data without displacement.
- Large text and VoiceOver/TalkBack expose each fact and action. Benefits have a static reading alternative. The phone preview is illustrative; it must not be read as the viewer's own history.
- Select topics and add/remove up to eight custom interests. Test duplicates, empty entries, long names, keyboard Done, and disabled/in-progress mutations. No AI request occurs while choosing topics.
- Complete or skip setup into Today, never an unsolicited Settings detour. Missing keys recover at the requested feature. Deferred key entry retains the intended return destination and source input.
- Confirm exactly Today, Sources, Saved, and Settings; restart without repeating onboarding or flashing another profile.

## 2. Keys and live discovery

- Verify native SecureStore save, process restart, replacement, removal and full reset. Try invalid, revoked, restricted, offline, quota, billing and unavailable-model cases. A model lookup does not prove generation succeeds.
- Explicitly generate real picks with an eligible Gemini key. Confirm submitted interests and returned channels match; featured videos exist and satisfy the four-minute minimum. Metadata review is not a safety certification.
- First three accepted picks can reveal while the same bounded run continues. No artificial progress, duplicate spending on remount, automatic retries, or replacement results on browsing.
- Cancel before and after first publication; background, change profile/interests, or remove a key. Published picks remain; unfinished results cannot leak across contexts. Error and partial-result copy stays truthful.
- Browse three at a time through a maximum of 12 reviewed sources. Reopening uses the cached weekly edition. Empty recovery is explicit, limited and cooldown-protected; it is not a billing cap.
- Follow or dismiss deliberately. Current picks remain stable when interests change; explain the next weekly search clearly.

## 3. Finite Today and Sources

- Follow test sources with recent eligible uploads. First use can populate from recent content without waiting for a new upload. Today respects the selected 1–12 maximum and at most two per source, subject to eligibility and approvals.
- Save, snooze, dismiss and Undo change only the intended item. Refresh updates metadata without refilling an existing daily selection. Failed writes preserve content and offer recovery.
- Library only sources stay followed and browsable but do not participate in Today. Favorites cannot override exclusion or refill an existing selection. Max videos in Today applies to the next 4 a.m. local selection.
- Followed / Discover and All / Included / Library only labels stay readable at large text. Bulk selection and actions clearly distinguish source removal from Today participation.
- Channel search and channel-scoped video search run only after submission. Test wrong/unknown links, empty results, offline, pagination, and source verification. Never broaden searches automatically.
- Google account import is retired: no new sign-in or import actions; an old `/google-import` link returns safely. Existing credentials retain a disconnect-only path. Revocation failures must not claim success or remove followed sources.

## 4. Saved and a time-based Session

- Videos / Sessions defaults to Videos. Save/remove/Undo, search, resume position, and completion survive restart and remain profile-scoped.
- Create, edit, duplicate, reorder and delete sessions. Empty/missing sessions remain understandable. Artwork uses real queue entries; unknown durations remain unknown.
- Test a 500-item session: list rows mount in a bounded window, scroll to the final item, and return to the editorial header. Start a middle item and confirm index/order, current position, and missing-metadata recovery. Repeat with large text and on a representative Android phone.
- Pause, buffer, background, seek and reopen a timed session: only active playback counts. At expiry, Finish this video grants only that film and never overrides stricter profile controls. Completion never autoplays another item.

## 5. Profiles, Owner PIN and playback boundaries

- Create Standard and Managed profiles; rename/reorder/restart. Switch between distinct libraries, preferences, interests and progress. Owner authorization remains required for protected mutations; cancellation and stale callbacks cannot grant access.
- Verify PIN retry cooldown and secure-storage failure recovery. Erasing must never silently bypass protected storage failures.
- Managed Selected Videos permits only approved IDs; Managed Approved Sources verifies source identity, including spoofed deep links. Test request, deny, approve, revoke and mode changes.
- Daily time and Managed playback controls: daily allowance, viewing windows, overnight quiet hours, breaks and Pause Frame count/limit playback only inside Frame. Test changing time boundaries and committed Owner limits. Settings stays accessible.

## 6. Native player and viewing room

- Open videos from Today, Saved, Sources, sessions and external deep links. Authorization and metadata eligibility precede the official player. Retry/replay create a valid fresh attempt without duplicate playback.
- Rotate both ways, enter/exit official fullscreen, use system Back, background/resume, disconnect the network, and finish a film. The same player remains correctly placed, controls stay reachable, and aspect ratio is never cropped or stretched.
- House lights dim once during viewing and rise after a standalone film or the last playable session entry. Pause/loading/next-in-session do not replay entry. Back/re-entry retargets smoothly; disabling the setting retains the lit wall. The ready player is never covered.
- Test iOS safe areas and Android gesture/three-button navigation, cutouts, landscape and system bars. Record native frame pacing; web evidence cannot substitute.

## 7. Accessibility, appearance and feedback

- Light/dark × blue/green/rose: readable text, visible focus/selected/disabled states, accent programme grounds, and organic non-tiled texture. Review keyboard open, narrow portrait, landscape, and Android expanded windows.
- VoiceOver/TalkBack: coherent reading order, labels, section selection, modal focus/return, info disclosures and actionable recovery. Android info/replay/secondary touch targets are at least 48 dp without enlarging visible artwork unnecessarily.
- Test system text size 1.0, 1.3 and 2.0 where supported. Content wraps or scrolls; no controls fall under the keyboard or system insets.
- Haptic feedback off suppresses pending and subsequent feedback; enabling permits a small confirmation. Successful choices/mutations acknowledge once; no-op, background, stale-profile and decorative events stay silent.
- Viewing time shows actual local playback only, including not-recorded and failed-read states. Dates and values remain accessible independently of chart animation.

## 8. Support, privacy, reset and store handoff

- Contact support opens the confirmed monitored destination; failure provides a usable alternative. Public support/privacy URLs and store contact information match the app. Never send keys, PINs or viewing history automatically.
- Device diagnostics is intentionally available for user-initiated sharing and contains sanitized technical details only. No private report is transmitted without the user choosing to share it.
- Full reset discloses and removes all profiles, libraries, provider keys, Owner PIN, usage, approvals and requests. Secure-store failure prevents a false success. Revoke provider keys separately when needed.
- Fresh install and upgrade preserve the current schema and local account boundaries. Test offline/startup recovery without interpreting a failed read as an empty library.
- Before submission, establish workable reviewer access to BYOK features, verify live provider availability, public privacy/support links, content/asset rights, final permissions, signing, and console disclosures. No blanket approval claim follows from this checklist.
