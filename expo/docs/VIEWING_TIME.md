# Today viewing time

The Today chart shows seven local calendar dates of recorded playback for the
active profile on this device. It appears after the header and any current-session
entry, before the video selection. It mounts only once profile state is ready and
outside a profile switch. This is a local awareness feature with no device-wide
usage access or cloud synchronization.

## Accounting and persistence

- `services/viewingAllowanceService.ts` connects the existing shared playback
  service to `ViewingHistoryStore`. A permitted `beginPlaying` opens a recording
  interval for both limited and unlimited profiles. Checkpoints and stops record
  elapsed wall-clock milliseconds, independently of allowance consumption.
- The watch screen checkpoints every 15 seconds while playing. Non-playing player
  states, leaving the screen, backgrounding, and profile switching stop accounting
  through the existing playback lifecycle. Seeking does not add the skipped video
  duration. Browsing, pauses, and playback outside Frame do not start intervals.
- `domain/viewingHistory.ts` serializes reads and writes and divides intervals at
  local midnight using calendar dates, including daylight-saving boundaries.
  Invalid or nonpositive intervals are ignored.
- `services/viewingHistoryService.ts` persists version 1 records in AsyncStorage
  at `frame.profile.<profileId>.viewingHistory.v1`. Records contain `startedAt` and
  a map of local date keys to milliseconds; they contain no video-level history.
- Reads and writes prune daily totals to a seven-date window. The cutoff uses the
  later of the operation time and latest stored date, so moving the clock backward
  does not restore older totals. Cleanup is operation-driven, not a background
  deletion schedule. `clearProfileStorage` includes the history namespace.
- History recording failures are caught without changing playback authorization.
  The failed interval is not replayed. Existing allowance enforcement remains
  independent and retains its own failure behavior.

## Display and data meaning

The first read or recorded interval establishes `startedAt`. Dates before its
local date show an empty baseline and read “Not recorded” when selected. Dates on or
after it default to zero when no interval exists. Zero means no playback was
recorded; it is not proof that a whole day was observed. The first date may be
partial, and there is no historical backfill.

Today is selected initially. Selecting a day changes the date and value readout;
the selected weekday has a compact accent backing. Recorded zero has a short mark on the baseline. Positive values below a
minute display “<1 min”; later values use whole minutes, rounded down, or hours
and minutes. The vertical scale adapts to the largest displayed total. Seven day
targets each retain a minimum width of 44 layout units; narrower plots scroll
horizontally and initially reveal the latest date.

Each day exposes its full date, total or missing state, and selection state to
accessibility APIs. The info button beside “Viewing time” explains the scope and includes the start date
when the week contains untracked days. Loading and failed reads have distinct states; failure offers
“Try again” without silently replacing stored history. The chart reloads on focus,
app activation, and each minute while focused and active.

The explicitly enabled development web sample library substitutes seven labelled
sample totals in memory (`preview/viewingHistory.ts`). It does not write those
totals to real profile history. Production uses recorded local totals.

## Evidence and remaining checks

`domain/viewingHistory.test.ts` covers missing versus zero, fractional minutes,
midnight splitting, serialized writes, profile isolation, retention, profile
cleanup, corrupt records, unlimited playback intervals, idempotent stop, and
recording failure isolation. The implementation pass reported 365 passing tests,
passing TypeScript, and passing scoped lint.

Browser checks covered desktop and a 390px iframe with empty and populated data,
day selection, and optional explanations. Final desktop and 390px normal/selected
captures confirm the layout after enforcing 44-unit day targets. Browser fixtures
do not establish real playback accounting on a native device.

Native playback and lifecycle behavior, large text, screen-reader traversal, and
dark-mode runtime rendering remain unverified. Recording depends on player
events and the device clock. A crash before the next successful checkpoint, a
missed lifecycle event, or a storage failure can leave incomplete totals. These
records are an aid to awareness, not a complete device usage audit.

The feature reuses the incumbent Caslon heading, Hanken interface text, palette,
and hairline rules. No new design tokens or raster assets were introduced.
`DESIGN.md` and `.impeccable/design.json` remain unchanged; their reported
pre-existing drift is outside this feature's scope.
