# Personal-use improvements

This is the current feature contract for the personal BYOK build. Use it alongside BYOK.md; older shared-service and free-beta handoff documents describe historical builds.

- The library holds up to 500 followed sources per profile, with at most 100 participating in Today. New follows beyond the Today limit are library only. Sources displays 20 rows per page with local search. Six profiles remain available.
- Each followed channel can participate in Today or stay library only. The choice uses the existing per-profile source rule (a permanent mute marker) and requires the existing protected-action authorization. Library-only sources remain followed, browsable, and saved; they are excluded from daily feed requests and Today visibility.
- Today still has at most 12 videos and two per source. Overdue snoozes have priority. Other sources are ordered by their last appearance in Today, then newest available upload and stable ID. Each source gets one turn before second contributions. Existing daily snapshots never refill on refresh or source-setting changes. Optional favorites win only ties between sources last shown in the same period; a source waiting longer always goes first. Favorites retain the same two-video cap, cannot bypass library-only settings, and never reorder an existing Today selection. The favorite toggle is on a followed channel’s page for personal profiles and uses the existing protected source-setting action.
- Sessions use actual playback time, excluding pauses/buffering/background time. Choose a preset or a whole-minute duration from 1–1440. At expiry playback pauses, offering End session or Finish this video. The finish allowance is tied to the last playing video, never advances to another, and cannot override any profile or content restriction. Ordered plans can extend beyond ten videos; a 500-item storage safety bound remains. Native SQLite saves a monotonic run and checkpoints every five seconds and on pause/exit (an abrupt process kill can lose the last few seconds). Old untimed plans require a duration before starting; edited and duplicated plans retain their selected duration. A new run requires an explicit start. Web preview data remains session-only.
- Channel pages load 50 recent uploads. Older uploads replace the current page only after an explicit action; Previous page and Back to recent uploads remain available. Check for new uploads directly fetches metadata without the feed cache and does not change Today membership.
- Sources offers explicit channel search: at most 20 verified channels per submitted query, with a review step before following. No automatic following, blank-query recommendations, trending, or general video search.
- Channel pages offer explicit video search limited to that channel, at most 20 results per page, duration filters and a past-year filter. Search results are hydrated and checked against the selected channel ID again. Search never broadens to other channels when results are empty. YouTube search is not a complete archive; use upload pagination for older browsing.
- Managed profiles retain their existing approval flow and do not receive the new provider-search controls or unrestricted archive pagination. Saved search remains local.
- Interest selection has no count cap. Profiles can select every built-in topic and add specific custom topics (up to 120 characters per label), with case/whitespace duplicate handling and local persistence. All interest controls work in both onboarding and Settings.
- Discovery prepares up to 12 reviewed sources per UTC week from up to 24 researched candidates. Reveal three at a time, with Previous to revisit. Following/dismissing never auto-refills a page. A successful edition stays fixed; an empty edition allows one explicit recovery after the normal 60-second cooldown. The recovery is reserved before provider work, including failed or cancelled attempts. Up to 12 selected interests are researched each week; up to three optional priorities stay in that focus while other interests rotate. Editing interests does not replace a successful edition. Quality and short-form gates remain.
- When an Owner first enables a daily limit, Flexible changes take effect immediately, or the Owner can opt into a 24-hour commitment before increasing/removing it. Existing commitments remain protected, including pending relaxations. Managed profile controls and Owner authorization are unchanged.

## Acceptance checks

1. Find a channel by name or subject. Nothing is requested while typing. Submit explicitly, review a result, then deliberately follow. Empty, offline, missing-key and quota states must not invent results.
2. Inside a channel, submit a topic with duration/date filters. Verify every displayed video belongs to that channel. Clear returns to recent uploads. Next and Previous replace the page, never append an infinite feed.
3. Change a followed source to library only. Confirm it stays in Sources and Saved while disappearing from Today; restoring participation must not refill an existing selection.
4. Across several days and many sources, quieter sources get turns before second videos from prolific sources. Today remains deterministic and no larger than 12.
5. Build a custom 37-minute session with more than ten videos. Pause, buffer, background, reopen and seek: only actual playback counts. At expiry verify Finish this video resumes the same position, cannot grant another video, and respects a stricter daily/Managed limit. Ending or finishing requires an explicit new run before more playback. Verify migration from an old untimed plan and schema-11 preset target.
6. Cancel search through leaving, backgrounding, removing a key, or switching profiles. A stale result must not update a different profile. Test native key and provider flows on physical iOS/Android before release.

Provider reference: [YouTube search.list](https://developers.google.com/youtube/v3/docs/search/list). Search supports channel/type constraints and pagination; the channel-scoped video search API has a provider-imposed result cap, so upload browsing is separately available.

## Short-form prohibition

Frame uses a non-optional minimum duration of **240 seconds (four minutes)** for all profiles, including the Owner. Exactly four minutes is eligible. This is a product definition of short-form, not a classifier of editing style or video quality; it also excludes brief conventional videos. The threshold exceeds YouTube’s currently documented three-minute Shorts range. Public API duration is dependable for this purpose; thumbnail orientation and titles are not treated as proof of format.

- Explicit youtube.com/shorts links (including mobile and encoded paths) are refused before lookup. The same video through watch/shortened URLs is still checked by provider duration.
- Unknown, zero, invalid, or non-finite durations are excluded from new feeds and search results. Empty pages stay empty; no automatic search broadening or pagination is introduced.
- Today and onboarding also filter older snapshots, snoozed returns, and permissive older source rules. Existing Today membership is never replenished to compensate.
- Saved links and old sessions are retained for removal/editing. Removal Undo restores only the actual removed profile-owned record, including an older blocked link; it never grants playback eligibility. Short saved videos are labelled unavailable. New saves, managed video approvals, and session creation/additions reject short or unknown-duration items. Session planning only offers eligible videos for new selection.
- Playback requires current local or provider metadata matching the video ID. Route duration, title, and fetchedAt parameters never grant eligibility. Unknown or expired duration requires verification; failed/offline verification never mounts the player. A shorter duration reported by the player also stops playback. Existing approval/PIN and viewing allowances cannot override the four-minute policy. External-player fallback is blocked for ineligible/unverified videos.

Acceptance: test 239 vs 240 seconds; ordinary watch and Shorts links; unknown duration; old saved/session/snoozed videos; expired metadata; spoofed route duration/fetchedAt; and player/provider duration disagreement. Never enter real keys into the web preview or test fixtures.

Reference: [YouTube’s three-minute Shorts definition](https://support.google.com/youtube/answer/15424877), [YouTube video duration metadata](https://developers.google.com/youtube/v3/docs/videos#contentDetails.duration).


## Session planning and favorite-source verification

Schema 12 retains schema-11 targets and source rules, accepts custom durations, adds profile/session-scoped run state, and preserves existing Owner commitments by default. Migration rollback, reopening, profile isolation, stale-checkpoint protection, pause accounting, finish-video scope, compatible weekly-edition upgrades and finite paging are covered by automated tests. Native SQLite and real YouTube playback smoke testing remains required before building the next sideload release.

### Personal Today selection size

Settings → Today’s selection and the first onboarding screen let each profile choose 1–12 videos. Existing profiles default to 12. The count is stored with that profile’s preferences. It is used when the next daily snapshot is created (4 a.m. local boundary); changing it never rebuilds or refills an existing snapshot. Eligibility, source rotation, and the two-per-source ceiling still apply, so a selection may contain fewer videos. Owner-selected individual videos remain an approval library rather than a generated source selection.

Discover’s interest editor stays open across additions and removals until Done is selected. Editing interests is separate from explicitly generating a weekly edition.
