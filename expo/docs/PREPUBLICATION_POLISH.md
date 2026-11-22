# Frame prepublication polish — 2026-09-30

## Evidence and scope

Reviewed the route inventory, shared controls, state branches, navigation, and
profile/persistence boundaries in the actual Expo source. The available user
screenshot informed the shared-field direction. This is not a screenshot review
of every native screen. No simulator, physical device, or Rork rendering was
available for this pass; no substitute mockup was used as acceptance evidence.

Retained the warm stone surfaces, mineral accents, Caslon headings, Hanken
interface text, matte imagery, quiet grain, and finite viewing flow. Changes
concentrate on legibility, consistency, truthful states, and recoverable actions.

## Coverage

| Surface | Review and outcome |
| --- | --- |
| App shell, four tabs, profile header | Retained hierarchy, opaque profile transition, and native navigation. Reviewed layout and shared transition behavior. |
| Today | Wait for managed approval data before loading its selection. Distinguish source, rule, and approval failures from empty selections. Load persisted snapshot/rules offline. |
| Sources / Discover | Explicit approval-read recovery, import availability follows known policy, cached editions can load offline, ending marker only on a completed successful edition. |
| Source detail | Follow action meets 48-unit minimum; failed upload copy no longer asserts that an unfollowed source is followed. |
| Saved / continue watching | Loading sessions no longer show an empty-session invitation. Local read failures have recovery; stacked wide media cards retain full-width metadata. |
| Session builder | Truthful Saving / Saved / failure status, retry, unsaved-draft exit protection, restrained disabled reorder controls, no draft recreation after a successful session save. |
| Saved session detail | Start, duplicate, and delete are serialized. Failed actions explain recovery. Departed screens ignore late completions; old delete confirmations expire. |
| Add-to-session route and picker | Retained existing action lock and capacity rules; shared name field, consistent 64-character limit. |
| Player: portrait, landscape, approval, allowance, error, ending | Reviewed render branches and existing playback gates. Added visible Save/external-link failures, guarded approval actions, and text wrapping in controls. Official player and fail-closed checks retained. |
| Google import | Shared field retained; counters and action text have room to wrap. Delayed account connection cannot navigate a departed screen. Profile/reset teardown waits for credential writes and rejects stale sign-in completions. |
| Welcome / replay / first save / demo checkout | Retained real selection, explicit first save, contextual completion route, optional setup and clearly disclosed fake checkout. Local rules and cached services can resolve offline. |
| Settings | Named appearance and accent groups, flexible haptics label, precise disconnect copy. Demo billing configuration retained. |
| Profile chooser / profile controls | Flexible chooser heading and row padding, less prominent editor boundary, persistent field labels, shared profile/PIN fields. Authorization expiry still closes protected controls. |
| Allowance / schedule / content access | Shared numeric and web-clock fields preserve validation; content-mode group has an accessible name. |
| Owner authorization / reset | Readable secure fields without tracked placeholders; reset has wrapping actions and a single final decision that expires when context changes. No authorization bypass added. |
| Snooze | Long date/time actions wrap with padding; Android picker buttons can wrap. |
| Diagnostics | Failed/loading reads no longer claim a database version or preview storage mode as fact. |
| Privacy / Terms | Reviewed reading layout and entry/return links; legal wording retained. |
| Missing page / unavailable link / crash fallback | Recovery content can scroll at large text sizes; crash fallback stays independent of app providers. |
| Native intent, legacy Explore/Library routes | Reviewed routing responsibilities; compatibility redirects retained. |
| Shared media, skeletons, sheets, motion, interest choices | Reviewed shared geometry, dismissal, loading states, selection, Reduced Motion, and existing feedback gates. Changes are intentionally concentrated above. |

## Verification

- TypeScript and Expo lint: passed during initial verification.
- Bun regression suite: 223 passing tests across 49 files during initial verification.
- New action-gate regressions cover repeated taps, departure/return, stale completion,
  and obsolete destructive confirmations.
- Final automated/remote CI outcome is recorded in the pull request.
- No dependencies, real billing flags, quotas, or store configuration changed.

## Native release gate

`SMOKE_TEST.md` is the acceptance checklist, including the new interruption and
field checks. All native items remain unverified here. Before distribution,
record real iOS and Android evidence for small screens, large text, keyboard
focus, dark appearance, offline restart, OAuth interruption, Owner/PIN boundaries,
reset, player lifecycle, Reduced Motion, and haptics. Passing source checks or CI
does not certify native visual quality, store readiness, or device behavior.
