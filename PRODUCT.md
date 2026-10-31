# Frame: confirmed product context

This file records the confirmed scope of the Today viewing-time addition. It is
not a complete product strategy or a replacement for the incumbent [design
system](DESIGN.md).

Frame presents a Today video selection with profile-specific library and playback
boundaries. The user requested an elegant chart on the front page with concise,
optional explanations and confirmed that the measure is playback inside Frame.

Viewing time shows recorded active playback for the current profile on this
device across seven local calendar dates. It includes profiles with and without
a daily allowance. Browsing Frame, paused playback, external playback, and use of
other apps are outside this measure. The chart provides awareness; existing
playback permissions and allowance controls retain their separate authority.

Totals are stored locally under a profile-specific key, without cloud sync. Older
daily totals are pruned to the recent seven-date window when history is read or
written, and profile cleanup removes that profile's history. Recording starts on
first use of this feature; it cannot reconstruct earlier viewing. Earlier dates
show “Not recorded,” while dates since recording began can show zero recorded
playback. The first day may be partial. A failed read must remain an error rather
than implying zero viewing.

The Today section keeps the existing selection and profile boundaries, uses the
incumbent visual system, and puts the explanation behind “About this time.” See
[implementation and verification notes](expo/docs/VIEWING_TIME.md) for accounting
details and limits.

## Video presentation

Frame does not display creator-written video description/About prose, including
in video approval requests. Titles, sources, duration, dates, and chapter
navigation remain available. Existing metadata can still supply chapter
timestamps; this presentation choice adds no AI filtering, request, or cost.
Source/channel descriptions are separate and remain available.
