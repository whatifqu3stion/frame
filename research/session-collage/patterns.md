# Session cover refinement — October 29, 2026

## Review

The supplied card gave its three thumbnails equal, small slots while its title, three metadata paragraphs, full-width button, and timing explanation occupied most of the surface. The information was useful but its hierarchy made the collection feel administrative. The target is an editorial composition made from the session’s own images, with concise, readable captions.

## Appllama evidence

Reviewed 40 returned reference entries across collection search, an art/gallery search, and DailyArt’s complete captured Browse & Discovery flow (10 screens). Contact sheets are `board-0.jpg` through `board-3.jpg`; original downloaded captures and durable IDs are in `img/` and `references.json`. The collection/semantic search tails were weak, so research narrowed to the relevant DailyArt flow instead of continuing unrelated pages. These captures support layout observations, not claims about current releases, animation performance, or business results.

Strongest patterns:

- DailyArt Discovery Feed, `547982045/oth_4ct7u`: image scale and varied horizontal spans establish hierarchy before captions. [Reference](img/547982045-oth_4ct7u.webp).
- DailyArt Masterpieces, `547982045/oth_nmkrp`: an asymmetric arrangement preserves a collection’s visual variety without explanatory copy on every image. [Reference](img/547982045-oth_nmkrp.webp).
- DailyArt Empty Favorites, `547982045/oth_4nkzy`: offset art creates one coherent composition around a restrained serif title. Frame uses actual session artwork rather than generic decorative assets. [Reference](img/547982045-oth_4nkzy.webp).
- DailyArt Collections, `547982045/oth_lsyjs`: the artwork carries recognition, with short titles as captions. Frame keeps text outside the images to maintain reliable contrast. [Reference](img/547982045-oth_lsyjs.webp).
- IDAGIO Collection Radio Player, `1014917700/oth_dqmqe`: one artwork object and a distinct playback action make the next step legible. Frame preserves its warm palette and finite session semantics. [Reference](img/1014917700-oth_dqmqe.webp).

## Implementation

Only the session detail cover adopts the new `ProgrammeArtwork` editorial variant. It uses a generous lead print and two offset companion prints, a thin square matte, and retained 16:9 image proportions. The October 30 follow-up replaces the original overlap with 12-point horizontal and vertical gaps and a subtle downward shadow, following the user's gallery-wall direction. Single-image and two-image layouts adapt without invented covers; missing metadata continues to be filtered. Other programme surfaces retain their existing strip.

The name uses a compact Caslon title. One line distinguishes the number of videos and full queue runtime. Viewing time remains separate beside the primary action. Its disclosure explains playback accounting, stopping behavior and profile limits. Progress appears once a session has progressed; unknown durations, completion, resume and start-over labels remain supported. Existing playback and timer logic is unchanged.

The entrance reuses Frame’s presentation gate and reduced-motion handling. Editorial images settle vertically within their allocated spacing instead of rotating or sliding past the cover edge.

## Verification

- Initial inspection found an inherited 184px thumbnail cap. The correction removes it for the editorial variant and preserves the strip elsewhere.
- Confirmed browser layout at 320px and 390px, plus the bounded wide layout. Light and dark theme captures are in `qa/`.
- Timing disclosure opens/closes; Start session reaches the fictional preview player; browser Back returns to the same session. No real video was played or data erased.
- TypeScript and scoped ESLint pass. Session flow, timer, motion-continuity, and palette tests: 24 passed, 220 assertions. Whitespace checks pass.
- Native Simulator was reachable, but its real library has no saved videos/session matching the supplied sample. This cover was verified in the phone-width browser preview, not signed off as a native Dynamic Type or release-performance test. No fixture records were inserted into native storage. The simulator’s original light/blue appearance was restored from the previous QA session; browser light/rose and the normal viewport were restored after this pass.

No new dependency, imagery generation, automatic playback, timing policy, or recommendation behavior was introduced.
