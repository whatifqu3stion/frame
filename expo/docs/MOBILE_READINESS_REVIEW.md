# Mobile readiness review — October 21, 2026

## Verdict

**The four confirmed source-level usability findings have been fixed; native acceptance remains pending.** The fixes passed TypeScript, scoped lint, and all 329 automated tests (1,603 assertions across 64 files). No new APK was produced in the remediation pass; the existing `Frame-1.0.0-1.apk` predates these fixes. Complete the native acceptance checks before distribution.

The existing `Frame-1.0.0-1.apk` installed successfully on the Pixel 6 / Android API 34 arm64 emulator. The available native UI controller could not attach to the emulator window, so installation is the only newly verified native runtime step. The app was not driven through onboarding or playback. Prior web screenshots, source checks, and successful packaging are not substitutes for those tests.

## Remediation — October 21, 2026

- **Settings keyboard actions:** the ScrollView now persists handled taps and dismisses on drag. iOS keyboard insets are enabled; Android retains its existing `adjustResize` behavior.
- **Provider feedback:** validation, success and removal messages now belong to the originating provider and render alongside its form, with the polite accessibility announcement retained. Feedback clears when editing or changing context; secure storage and owner checks remain intact.
- **Source acquisition:** a compact 48 dp Add action now precedes the followed collection. The existing channel-search disclosure stays collapsed until requested, with managed-profile request behavior preserved.
- **Orientation:** browsing and the no-owner fallback use the platform default. Fullscreen still has priority over the watch screen and app. Four behavioral tests cover priority regardless of insertion order, a zero-valued app request, and restoring the remaining owner after fullscreen/playback exits.

A bounded browser preview checked Sources at 390 × 844 and 844 × 390, opening channel search and scrolling in landscape, plus the Interests form at phone width. No clipping was observed in these views. This does not verify the Android IME, system rotation, TalkBack, real provider credentials or native video playback. The browser cannot securely save provider keys, so no provider outcomes were simulated or claimed as runtime-tested.

## Original confirmed findings — addressed in source

The descriptions below record the pre-fix review for traceability. Their device acceptance checks remain part of the gate below.

### P2 — Settings form actions require an extra tap with the keyboard open

`components/SettingsDetails.tsx:67` renders a ScrollView without `keyboardShouldPersistTaps`. React Native's default `never` dismisses the keyboard on an outside tap without delivering that tap to the child control. This affects Add interest and Verify & save in the forms hosted by this screen. The shared Sheet and onboarding ScrollView already specify `handled`; Settings does not.

**Fix:** use `keyboardShouldPersistTaps="handled"` and intentional dismiss-on-drag behavior. Then verify that the key input, verification explanation, submit and cancel remain reachable with the Android IME open at normal and larger font sizes. Missing keyboard avoidance alone is not recorded as clipping: the generated Android activity uses `adjustResize`, and actual occlusion needs device observation.

### P2 — API-key results are detached from the form that caused them

`components/ProviderKeySettings.tsx:79–92` renders both provider sections before the single shared feedback message. A YouTube validation error therefore appears after the entire Gemini setup section. On a phone, this can be outside the visible area while the person is looking at the YouTube input. The polite live region helps TalkBack users but does not make the result visible to a sighted user.

**Fix:** associate feedback with its provider and place it beside that provider's input/action. Keep safe error text and existing cancellation, owner authorization and secure-storage rules. Test invalid formatting, provider rejection, unavailable network, successful replacement, and removal without exposing the secret.

### P2 — Add a source is buried behind a large collection

`app/(tabs)/sources.tsx:204–231` maps every followed source before the only Add a source control. With the expanded 100-source allowance, adding another creator requires scrolling past the whole collection. This is a phone usability issue independently of frame-rate performance.

**Fix:** provide a compact Add action near the collection header that opens the existing deliberate acquisition flow. Keep the followed collection prominent and do not reintroduce a large search form above it. The list is also rendered inside a ScrollView rather than virtualized; profile it with 100 sources before treating performance as proven. No measured jank is claimed.

### P2 — Browsing is forcibly portrait despite adaptive configuration

`app/_layout.tsx:34–36` explicitly requests `PORTRAIT_UP`, and `services/orientation.ts` also defaults to portrait. `app.json` says `orientation: default`, but that does not override the runtime request. Playback has its own higher-priority orientation handling.

**Fix:** allow the platform's normal browsing orientation and test landscape layouts, preserving intentional player/fullscreen behavior. If portrait-only browsing is an explicit product choice, document that limitation and test its consequences for landscape-mounted phones and larger Android windows. Current adaptive-width styles alone do not establish rotation readiness.

## Native acceptance gate — pending, not diagnosed failures

Before distribution, run this on a phone (an emulator can cover layout breadth):

1. Cold launch and first-run onboarding with Metro stopped; reach key setup and return to the same onboarding stage.
2. Add/verify a user-supplied YouTube key, restart, and confirm native SecureStore persistence; invalid/replaced/removed-key paths. No real credentials were supplied during this audit.
3. Resolve a channel, open a verified long-form video, enter/exit fullscreen, use system Back, background/resume, and finish a session without automatic advance. Verify short-form rejection remains enforced.
4. Exercise portrait/landscape, a narrow phone, 1.3× and 2× text, dark/light, keyboard-open forms, and cutout/navigation-bar insets. Add expanded-window checks before claiming tablet/foldable readiness.
5. TalkBack traversal through tabs, disclosures, source review, session ordering, undo, protected PIN flows and errors. Check focus recovery after sheets and result changes.
6. Android Remove animations, rapid repeated disclosure changes, app backgrounding during an effect, and haptics enabled/disabled. Hardware haptic quality requires a physical device.
7. Run a realistically populated profile: 100 followed sources, a substantial Saved library, long titles, ten-video sessions and many custom interests. Measure startup, scrolling and memory; do not infer performance from empty screens.

## What is already sound

- Android release build, signing verification and alignment checks succeeded in the previous turn. The existing APK now also has a successful emulator installation result.
- Native SecureStore has no plaintext or browser fallback. Key fields suppress autofill, mask entry, clear drafts on background/profile changes, and preserve the old key until verification succeeds.
- Main controls inspected use 48–52 dp minimum targets; icon-only visual sizes were not misreported as undersized press targets. Some small style declarations are unused and are not findings.
- Shared sheets are scrollable, keyboard-aware, inset-aware and handle Android Back. Session editing has an unsaved-change guard; the player handles Back and pauses/persists when backgrounded.
- Choice text wraps; interest layout responds to width/font scale; session actions wrap; navigation adapts by window width. These are good source foundations, pending runtime validation.
- Custom motion respects focus, foreground state and Reduce Motion. Haptics use Android's semantic APIs and an independent user preference.
- Camera, microphone, location, media-library and overlay permissions are absent from the packaged manifest. Release mode and disabled backups were verified previously.
- The remediation pass passed TypeScript/scoped lint and 329 automated tests. These checks do not constitute native UI acceptance.

## Audit coverage

| Dimension | Source evidence | Native evidence still needed |
| --- | --- | --- |
| Accessibility | Roles/state, wrapping, touch-size and reduced-motion foundations; provider-local feedback | TalkBack, actual focus, contrast and large-text layouts |
| Performance | Saved/session virtualization; followed sources and interests render eagerly | Populated-profile startup, frame time, image/memory behavior |
| Appearance | Semantic palettes and shared type/spacing | Native light/dark rendering and system surfaces |
| Platform conformance | RN/OS controls, Back handling, safe-area plumbing | IME, gestures, nested modals and player integration |
| Adaptivity | Width/font-scale-aware layouts; platform-default browsing orientation | Landscape, expanded windows and foldable behavior |

No numerical native health score is assigned: the available evidence does not support a runtime accessibility, performance or adaptivity score.

## Recommended order

1. Complete the native acceptance gate for the corrected source, addressing observed issues together. A locally built test APK is required for these device checks.
2. **Impeccable polish:** one bounded native finishing pass after observed issues are resolved.
3. Build the next distribution APK with an incremented Android versionCode and the existing signing identity.

## Personal policy update — 21 October 2026

Implemented up to 12 reviewed weekly discoveries in deliberate three-item pages, one empty-edition recovery, three optional interest priorities, a 500-source library with 100 Today participants, and sessions based on actual playback time with an explicit finish-current-video option. Existing Owner commitments migrate with the 24-hour delay intact; newly enabled Owner limits offer Flexible or Commitment. The current contract is in PERSONAL_USE.md and DISCOVERY_QUALITY.md.

Validation: 341 automated tests (1,703 assertions), TypeScript, scoped ESLint, and diff whitespace checks pass. Browser checks at 390×844 verified the three-priority selection boundary, unchanged selected interests afterward, custom 37-minute entry, invalid 1441-minute feedback, and returning to the 30-minute preset. At 844×390, session controls remain reachable by scrolling. No browser error logs were recorded in that check. Secure provider generation and real player expiry were exercised through mocked-provider/domain/SQLite tests, not live native UI.

Before the next APK: verify real YouTube playback events, pause/buffering/background/foreground, expiry in fullscreen, finish-only continuation, stricter Managed/daily limits, restart persistence, and schema-11 upgrade on Android. The previously built APK does not contain this policy update. Native acceptance and a replacement APK remain pending.
