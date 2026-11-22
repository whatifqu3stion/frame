# Gallery refinement — October 2026

The user's visual references combine classical art, fashion editorial typography,
modern gallery spacing, and occasional confident color. This pass amplifies Frame's
existing Caslon, stone, mineral accents, and umber programme rather than introducing
an unrelated visual theme. Video imagery remains the main source of visual variety.

## Implemented

- Today, Sources, and Saved use their existing editorial title copy with a 46/56
  display treatment. The final phrase uses the genuine Libre Caslon Text italic
  asset already supplied by the installed font package and the selected accent.
- First-use collection states and selected completion states use an umber panel,
  existing static programme texture, an open frame mark, and an italic title.
  Error, loading, search-empty, and ordinary settings states retain their quieter
  treatment. Profile controls remain explicit and wrap with larger text.
- Completing Today draws a check inside the frame in 340 ms. This is consumed once
  for an action performed on the current screen. It uses the existing visibility,
  interruption, and Reduce Motion gate; reduced motion shows the finished mark
  immediately. There is no animation loop, delayed action, sound, or new dependency.
- Sidebar selection explicitly uses the selected theme's soft accent instead of
  the navigator's bright-blue default.

## Verification and limits

TypeScript and scoped lint pass. All six existing motion-continuity tests pass.
The Impeccable mechanical detector reported no findings. Desktop and 390 × 844 web
previews were inspected in the existing dark/rose appearance, with no browser
errors. User appearance preferences were not changed. These screenshots are web
preview evidence, not native rendering approval.

Light appearance, larger native text settings, and the drawn completion mark need
device acceptance. The local simulator service was unavailable. The web preview
had no followed or saved content, so populated media layouts were not exercised;
their cards and playback behavior were unchanged by this pass.

## Critique follow-up

The October 21 critique's four priorities are implemented:

- Populated Today, Sources, and Saved use a compact 32/40 italic heading and less
  header spacing. Discover also uses this compact treatment. First-use headings
  retain the editorial voice. Today's selection rules and reset explanation sit
  behind a labelled disclosure; availability and refresh errors stay visible.
- Followed sources precede a single expandable Add a source flow. It provides
  finite channel search, the existing link/handle modal, and optional import.
  Managed profiles retain their approval/request paths. Collapsing channel search
  unmounts it, cancelling its outstanding request through existing cleanup.
- Discover reads only key-presence booleans for its setup state. Missing keys offer
  setup, a ready native installation offers explicit generation with visible
  sharing/cost copy, and an existing edition removes the generation/setup controls.
  Methodology and cadence move into How weekly picks work. No generation occurs
  from opening this disclosure or reading key status. Browser previews explain the
  native secure-storage requirement. The old five-interest instruction is removed.
- ChoicePressable forwards explicit selected, expanded, checked, and busy ARIA
  properties alongside native accessibilityState. Saved's help button explicitly
  supplies expanded state. The installed web adapter consumes these individual
  properties rather than the grouped native state. A shared Heading supplies page
  level 1 and section level 2 on web, preserving native heading semantics.

First-use gallery panels now use compact padding/type and omit the empty frame.
The full frame and completion check remain available for deliberate endings.

Validation: TypeScript, scoped lint, all 325 existing tests (1,596 assertions), and
the layout detector pass. At 390 × 844, browser inspection confirmed source-tab
selection, Add and Today disclosure states, heading levels, and keyboard activation
of Saved help with expanded state. Desktop preview was also inspected. No provider
requests were submitted and no keys or user preferences were changed. Native key
setup, populated libraries, large native text, and VoiceOver/TalkBack traversal
still require device acceptance; this pass does not claim those are verified.

## Selective italics

Everyday page headings and ordinary empty-state titles now use upright Caslon.
ScreenHeader no longer automatically emphasizes the final word or phrase. The
compact heading keeps its 32/40 scale; editorial headings keep their existing
line breaks and size. Italic Caslon is reserved for gallery completion messages,
where it marks an earned ending. This supersedes the broader italic styling
described earlier in this record.
