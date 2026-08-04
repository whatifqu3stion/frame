# Frame ten-minute baseline smoke test

Run this on both iOS and Android against the development configuration. Use a development YouTube quota/key, RevenueCat test project/products, and test Google OAuth client. Do not use production products, customer data, quotas, or credentials.

Record device/OS, app version, environment shown in Development diagnostics, test account, start/end time, pass/fail, and screenshot or recording filename. Never record tokens or keys.

## 0:00–1:00 — clean launch and onboarding

1. Delete app data or use Settings → Delete all on-device data.
2. Relaunch. Confirm onboarding appears once, text is readable, interests have no decorative icons, and Continue is initially governed by the intended selection rules.
3. Select interests, finish onboarding, and confirm Home appears without a crash or empty-state flash during hydration.
4. Relaunch briefly and confirm onboarding does not repeat.

## 1:00–2:00 — paste to watch

1. On Home, paste a valid public embeddable YouTube URL.
2. Confirm Watch opens for free without requiring Premium.
3. Confirm playback does not start until the user acts, official controls remain usable, and no overlay obstructs the player.
4. Return to Home without changing orientation permanently.

## 2:00–3:00 — follow a source

1. Open a creator/channel path from Explore or paste a valid creator URL where available.
2. For a non-entitled tester, confirm the Premium gate appears instead of a fake success.
3. For a test-entitled tester, follow the creator and confirm it appears in Library.
4. Unfollow and follow again; confirm no duplicate source is created.

## 3:00–4:00 — save and Watch Later

1. Open a verified video.
2. Save it and add it to Watch Later with a test entitlement.
3. Confirm both states appear in Library and survive an app restart.
4. Remove each and confirm the UI and persistence agree.

## 4:00–5:15 — resume and player completion

1. Play a video beyond 15 seconds, leave Watch, and confirm a resume item appears.
2. Reopen it and confirm the resume position is offered/applied as designed.
3. Seek close to the end and allow the player to complete.
4. Confirm completion clears stale resume progress and does not autoplay unrelated content.
5. Confirm the final state remains intentional and stable after a short wait.

## 5:15–6:15 — finite session

1. Open Session and create a session of one to three videos.
2. Start it and manually advance through each item.
3. Confirm the session never exceeds three videos and does not auto-advance without the intended action.
4. Finish the final item and confirm the app returns to the designed completion state.

## 6:15–7:15 — Google sign-in

1. Open Settings → Account.
2. If the platform client ID is intentionally absent, confirm a clear unavailable state and no crash.
3. With the development OAuth client and test entitlement, sign in with a non-production test account.
4. Confirm imported subscriptions appear, Refresh works, and disconnect revokes/removes the local credential while preserving imported creators.

## 7:15–8:30 — paywall and restore

1. Open Premium from Settings.
2. Confirm localized test-store products load; no production purchase is offered.
3. Cancel a purchase and confirm cancellation is calm and non-error-like.
4. Use Restore purchases and confirm either the test entitlement activates or a truthful no-purchases result appears.
5. Restart and confirm entitlement state is refreshed.

## 8:30–9:15 — wipe

1. Ensure the test device has saved content, resume progress, a followed creator, interests, searches, and optionally a Google connection.
2. Settings → Delete all on-device data; cancel once and confirm nothing changes.
3. Confirm deletion on the second attempt.
4. Confirm local tables, preferences, searches, and Google credential are cleared while store purchase history remains external.
5. Relaunch and confirm onboarding returns.

## 9:15–10:00 — diagnostics and final sanity

1. In a development build, open Settings → Development diagnostics.
2. Confirm app version, environment, database version, `local-device` profile, entitlement state, backend base URL, and feature flags are present.
3. Confirm no API key, OAuth token, customer secret, or full credential is shown.
4. Confirm Diagnostics is absent from Settings in a production build and direct navigation redirects.
5. Switch between Home, Explore, Library, and Settings; confirm no crash, stuck landscape, unexpected paywall, or obvious visual regression.

## Evidence checklist

- [ ] iOS portrait onboarding/Home screenshot.
- [ ] iOS watch playback and completion recording.
- [ ] iOS Settings/diagnostics screenshot with no secrets.
- [ ] Android portrait onboarding/Home screenshot.
- [ ] Android watch playback and completion recording.
- [ ] Android Settings/diagnostics screenshot with no secrets.
- [ ] Completed result sheet with failures assigned as pre-existing or new regression.
