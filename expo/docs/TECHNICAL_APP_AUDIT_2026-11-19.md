# Frame app-wide technical audit — November 19, 2026

Scope: user requested whole-app technical critique and explicitly prefers preserving the visual design. This supersedes the earlier Today-only design critique. No production code was changed during this audit.

Method: parent review plus independent data-integrity and native performance/accessibility assessments. Reviewed onboarding and shared motion, navigation/root startup, Today, Sources, Saved, session editor/detail/picker, player, Settings/profile switching/reset, provider/credential boundaries, and native configuration. Impeccable's adaptive/native audit criteria apply. The earlier web detector was not used as native defect evidence.

## Verdict

The implementation has a coherent native app structure and substantial safeguards, but it is not ready for an unqualified technical sign-off. Two P1 correctness failures were reproduced in isolated source-extracted handler harnesses. Five P2 issues were traced in source. There were no confirmed P0 blockers in this bounded audit.

| Dimension | Provisional score | Evidence |
| --- | ---: | --- |
| Accessibility | 3/4 | Labels, selected/busy states, scalable text, Reduce Motion, accessible sheet dismissal. Native traversal still unverified. |
| Performance | 2/4 | Large session editing repeats history reads and mounts all selected rows; timed playback publishes four React updates per second. |
| Appearance and theming | 3/4 | Shared light/dark semantic palette and intentional viewing-room treatment; no redesign warranted. |
| Platform conformance | 3/4 | Native stack, keyboard-aware sheets, safe areas, Back/escape handling. Physical gesture/player acceptance remains open. |
| Adaptivity | 3/4 | Compact tabs/expanded sidebar, wrapping controls, scalable text; actual device rotation and IME acceptance remain open. |
| Total | 14/20 — Good | Source-based technical baseline, not release certification. |

The five-dimensional score does not replace the correctness findings below. A passing unit suite or an attractive screen does not resolve them.

## Priority findings

### 1. P1 — Delayed playback authorization can start accounting after Pause

- Location: `app/watch/[id].tsx:562–598`; `providers/AppProvider.tsx:801`; `domain/ViewingAllowanceService.ts:49–88`.
- Trigger: a playing event starts asynchronous content authorization; the viewer pauses or leaves while that authorization is pending; it resolves afterward.
- Evidence: executing the actual extracted `handleStateChange` callback with deferred authorization produced `state:playing → state:paused → stop accounting → begin accounting`. No attempt/version check rejects the late completion after the await. The allowance service subsequently accounts wall-clock elapsed time until another stop/checkpoint.
- Impact: paused time can be recorded as viewing and consume an allowance. Device reproduction is still needed, but the callback ordering defect is reproduced.
- Fix: bind authorization/start to a specific player/profile/play intent, invalidate it on every stop/blur/background/error, check it after asynchronous boundaries, and ensure stopping wins over an in-flight accounting start. Test delayed authorization and delayed accounting startup separately.
- Suggested command: `impeccable harden`.

### 2. P1 — Failed draft writes poison profile switching and full reset

- Location: `providers/AppProvider.tsx:1044`, `1056`, `474`, `1390`.
- Trigger: a draft write/delete fails once; the user subsequently switches profiles or erases all Frame data.
- Evidence: the map retains the original rejected promise. Both switching and full reset await that promise again. An isolated harness using the actual `saveSessionDraft` callback produced two subsequent flush rejections after storage was marked recovered.
- Impact: an unrelated recoverable write failure disables profile switching and the full-reset recovery path until another draft write succeeds or the app restarts.
- Fix: retain a settled/rejection-handled queue tail while returning the original rejecting promise to the editor. Waiting for pending work must not replay historical failures indefinitely.
- Suggested command: `impeccable harden`.

### 3. P2 — Editing an existing session is not atomic

- Location: `app/session.tsx:154–155`; `providers/AppProvider.tsx:1111`, `1122`.
- Trigger: rename succeeds, then saving the ordered video IDs/duration fails.
- Evidence: two sequential, independently committed queue updates. The error says the session could not save, although its new name already persisted.
- Impact: the saved session can mix old and new values after a failed Save.
- Fix: validate the entire edit and commit name, order, cursor and duration in one update/transaction. Fault-inject the write and confirm the previous session remains intact.
- Suggested command: `impeccable harden`.

### 4. P2 — Resume-position persistence failures remain silent

- Location: `app/watch/[id].tsx:367–386`, `624–629`.
- Evidence: resume-read errors let playback proceed without explanation; periodic resume writes and completion updates swallow rejection.
- Impact: a viewer may return to an old position or stale session progress without knowing that the latest write failed. Viewing-limit failures have a separate fail-closed path; this finding concerns progress persistence.
- Fix: provide restrained persistent feedback with a retry, preserve the in-memory checkpoint, and only confirm saved progress after commit. Keep late callbacks scoped to the originating video/profile.
- Suggested command: `impeccable harden`.

### 5. P2 — Reordering a large session repeats full history reads

- Location: `app/session.tsx:105–107`; `db/database.ts:841`, `898`.
- Evidence: query identity depends on ordered IDs; each selected ID independently loads and scans all Today history and invokes metadata expiration. The allowed 500-video selection can cause up to 500 redundant history loads on a new ordering, including for already-saved videos.
- Impact: avoidable database work, allocation and editor latency. Latency was not benchmarked on a phone, so no numeric performance claim is made.
- Fix: batch missing metadata into one lookup/map and key it by the unordered ID set so a reorder does not refetch metadata.
- Suggested command: `impeccable optimize`.

### 6. P2 — Some session lists still mount every row

- Location: `app/session.tsx:243`; `app/(tabs)/saved.tsx:187`; `components/TodaySessionModal.tsx:71`.
- Evidence: the editor's selected rows are mapped inside the FlatList header, so only candidate rows benefit from virtualization. Expanded Saved sessions and the session picker also map the whole collection; session count has no collection cap.
- Impact: mounting and memory costs grow with the complete list. Session detail and saved-video lists are already virtualized; they are not part of this finding.
- Fix: use virtualized sections for selected/candidate editor rows and virtualize or paginate session collections and pickers.
- Suggested command: `impeccable optimize`.

### 7. P2 — Timed playback reconciles the whole watch screen four times per second

- Location: `hooks/useSessionTimer.ts:49–51`; `app/watch/[id].tsx:266`.
- Evidence: a 250ms interval publishes a new React state object from a hook called in the watch screen. Most displayed remaining-time text changes much less frequently.
- Impact: continuous avoidable JS/render work while watching. This is a verified update frequency, not proof of dropped video frames.
- Fix: retain precise timing/enforcement in the clock, publish only changed display/permission states, and isolate timer presentation from the player tree.
- Suggested command: `impeccable optimize`.

## Strengths to preserve

- Provider errors distinguish billing, quota, access, malformed responses and network failures without exposing raw credentials. There are request deadlines and no implicit paid-generation retries.
- Native keys use SecureStore. Android backup is disabled and unnecessary camera/microphone/location/media permissions are blocked in configuration. This audit did not inspect a newly merged release manifest.
- Startup restoration blocks on failure instead of silently replacing existing profile data with defaults.
- Discovery has profile/key/interest/background cancellation and durable reviewed-result checkpoints.
- Session playback updates compare the expected video/order before advancing a concurrently editable queue.
- Today is capped at 12, Sources is paged at 20, and resume history is capped at 24. Their mapped layouts were not incorrectly treated as unbounded lists.
- Shared motion checks visibility and Reduce Motion. Sheets handle keyboard avoidance, safe areas, Android Back and accessibility escape. Scalable text and adaptive navigation remain in place.

## Verification and limits

- Fresh `bun run verify`: TypeScript passes; lint has zero errors and one existing generated-types warning; **477 tests pass, zero fail**, 3391 assertions across 92 files.
- The playback race and poisoned draft queue were reproduced with controlled promises using callbacks extracted from current source. These are isolated JavaScript reproductions, not hardware or end-to-end tests.
- Earlier Today layout captures were from an isolated browser; they are not evidence of native performance or accessibility acceptance. The temporary Expo/Brave processes and detector live server were stopped.
- No real keys, provider generation requests, native database fault injection, new release build, store upload or production data changes were performed.
- Remaining native acceptance: VoiceOver/TalkBack traversal, large system text with keyboard open, fullscreen/rotation/Back, connectivity loss and recovery, process termination during a write, and low/mid-range Android performance. Live Gemini generation and recommendation quality also require separate authorized testing.

## Recommended order

1. Harden playback accounting and draft-queue recovery (findings 1–2).
2. Make session saves atomic and progress-save failures visible (3–4).
3. Optimize session metadata, list mounting and timer updates (5–7).
4. Run the targeted fault regressions and current native-build acceptance, then polish only verified technical defects. Preserve the current visual direction.

## Implementation and final review follow-up

The authorized fixes were implemented in all seven areas, with additional protection for delayed final checkpoints after player navigation. Findings 1–3 and 5–7 now have the implementation described above; finding 4 has explicit read/write/completion retry behavior but retains an exit-time recovery gap when its screen has already unmounted. Do not treat that finding as fully closed.

Fresh verification: **491 tests pass, zero fail; 3912 assertions across 95 files**, TypeScript passes, lint zero errors and one existing generated-types warning. See [the final technical review](FINAL_TECHNICAL_REVIEW_2026-11-19.md) for remaining findings, visual-review scope and release acceptance limits.
