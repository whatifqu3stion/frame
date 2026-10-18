# Longer videos in Frame

Frame excludes all videos of **three minutes or less**, based on duration rather than
the link's shape or YouTube's Shorts classification. The first eligible duration is
181 seconds. This intentionally also excludes ordinary short uploads.

The shared policy applies to new Today selections, persisted Today snapshots,
snoozed returns, source shelves, featured video previews, manual video resolution,
metadata recovery, saving, and the final player gate. Source suggestions can remain
available without an ineligible featured video. Following a creator does not exempt
their videos from the length rule, and existing per-source rules cannot lower it.

Unknown or invalid durations cannot enter the feed or mount the player. A saved link
with missing or expired metadata can request fresh details; playback stays blocked
until a duration over three minutes is confirmed. Existing library records are kept,
but their videos must pass the same player gate. Existing sessions can skip an
ineligible item explicitly. No destructive library migration is needed.

These rules apply inside Frame. They do not block YouTube or other apps.

## Verification

- Check 0/unknown, 60, 180, and 181-second videos from Today, a source, and a direct link.
- Confirm an old snapshot cannot display a short video, even with a zero minimum rule.
- Confirm short Saved/session videos do not mount an embedded player.
- Confirm a missing-length saved link offers a recoverable metadata check.
- Confirm a 181-second or longer video retains normal manual playback.
