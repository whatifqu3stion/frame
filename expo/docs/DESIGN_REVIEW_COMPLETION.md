# Design review completion — 29 September 2026

PR #18 covers the five initial priority groups and the remaining frontend implementation pass. It preserves Frame’s typography, warm surfaces, four tabs and finite viewing model. No backend schema, payment flag, playback authorization or persistence contract was changed.

## Implemented

| Reviewed area | Completed change |
| --- | --- |
| Global hierarchy and navigation | Compact daily headers; dedicated profile row; larger tab labels and stronger 22px, 2px-stroke icons with a selected background; clearer Light/Dark names. |
| Color and small text | Semantic filled-action colors and readable text across all six appearances; chapter notes and video-duration labels strengthened; contrast regression coverage. |
| Today | Visible pending and success feedback, persistent dismiss Undo, Saved shortcut, wrapping action rows and matching full-card skeletons. |
| Sources and Discover | Interest selection in context, playable featured samples through the protected watch route, accurate weekly-edition language, source-row skeletons, isolated follow progress and connection-error recovery. |
| Source detail | Pending follow feedback, confirmed unfollow, consistent Source vocabulary, image fallback and padded video rows. |
| Saved | Current session and draft first, other sessions progressively revealed, virtualized video list, compact empty sections, direct confirmed removal and a useful empty-library action. |
| Session builder and detail | Search, persistent name label, clear unselected boxes, longer selected titles, wrapping controls, keyboard-aware dock and named Save; Begin/Continue first on detail and edits in the editor. |
| Session picker | Shared component for Today and the legacy route; named new sessions, full/already-added explanations, guarded pending actions and errors. |
| Google import | Search loaded subscriptions; persistent selection count, feedback and commit; guarded import/loading failures. |
| Profile administration | List → focused detail → editor; larger named controls; inline failures; custom allowance input retains state and proper radio semantics. |
| Playback schedules | Explicit numeric bounds, continuous-playback wording, summary of viewing/quiet overlap and fully blocked windows; invalid web times remain visible and disable Save. |
| Content approvals | Expandable current request metadata, accessible review controls and confirmation before revocation. Expired metadata is not refreshed or played as part of review. |
| Shared sheets | Scroll, keyboard and safe-area handling; accessible close controls; profile, source, session, snooze, PIN and reset flows share the same shell. |
| PIN and full reset | Short recovery introduction; complete deletion disclosure in scannable rows; typed RESET and final confirmation preserved; pending authentication cannot race recovery. |
| Images and motion | Shared missing/failed-image fallback and reduced-motion preference for image transitions; onboarding and dormant paywall respect reduced motion. |
| Web adapters | Snooze has editable local date/time and previous/next day; clock entry explains its format and errors. |
| Watch and chapters | Scrollable error, approval and end states outside fixed video geometry; correct single-video completion language, Done for now, Save retained after completion and readable dark-room headings/notes. |
| Onboarding and startup | Global skip for optional setup, responsive scrolling and width, clear final-step copy, guarded source actions and a font-wait timeout. |
| Recovery routes | Friendly error boundary with Retry; large 404 escape; unsupported system links explain the failure while valid watch links and normal launches retain their routes. |
| Privacy, terms and diagnostics | Heading semantics, account/data-controls links, official YouTube and subscription-help links, and a shareable support-status summary that excludes the profile ID. |
| Dormant paywall | Current feature language, removed unsupported “best value” claim, accurate unavailable states and store retry. Paid access remains disabled. |

## Deliberate boundaries

- The Owner-selected video shelf remains a stable approved collection. It does not acquire the daily inbox’s dismiss/snooze dispositions; saving is available in the watch view and saved videos can be used in sessions. Applying the daily inbox’s removal behavior would change this product contract.
- Interest choices stay flat and optional with the existing five-choice cap. Grouping them into new categories was a review suggestion, not an established taxonomy.
- Privacy still mentions stored searches because the preference/storage model retains them. No legal commitment or support email was invented. Data/account controls and official service help now provide actionable destinations.
- YouTube-owned player controls, native date/time pickers and platform focus behavior are retained. Wrapper source cannot certify those interfaces visually.

## Validation and remaining device checks

TypeScript passes. Expo lint has no errors and one pre-existing unused-disable warning in generated `src/integrations/supabase/types.ts`. The Expo Bun suite passes 204 tests across 45 files (1,062 assertions), including six expanded appearance contrast cases, one viewing-room contrast case, and eight schedule/link recovery cases. The earlier Impeccable source detector had no findings; its markup-oriented result is not a native visual audit.

The real app still needs device verification. The available localhost browser preview was blocked, and no iOS/Android runtime was available. No mockup was substituted for this check.

Verify 320px width and enlarged text, long profile/video names, keyboard-open sheets and session/search fields, native date/time pickers, player completion/error/approval states in both orientations, VoiceOver/TalkBack focus and announcements, long Saved/import lists, broken images and reduced motion. Exercise rejected network mutations and a valid/invalid web time edit, then check that only the intended values save.

PR #18 remains a draft; these changes are not merged or deployed to Rork/main.

## Static material and composition pass

Approved after the functional refinement: contemporary, calm and curated, with material references expressed through tonal surfaces and precise construction. Literal marble veining, wood grain, curtains and decorative gold are intentionally absent. Motion is reserved for the next phase.

- Shared light surfaces now use a warm stone range; dark surfaces use warm charcoal. Existing blue, green and rose accents remain selectable, with restrained selection tints.
- `MediaMount` gives Today, full video cards and weekly features an 8px matte surround with a fine edge. Media retains its own 16:9 viewport and tighter 6px corners. Full-card skeletons use the same mount.
- The current session is an ordered programme on deep umber. Its title, truthful runtime status and locally available video titles are visible before opening. Reads stay profile-scoped and participate in existing library retention invalidation.
- Session detail shares the programme surface; the Begin/Continue action is prominent, and secondary actions remain outside it. Ordered items use clear typography and dividing rules.
- Headers, Sources rows, Settings notes and player information use calmer spacing and fewer repeated card borders. Sheets use the established soft elevation without a competing outline.
- Existing motion behavior and playback controls are unchanged.

Expanded color tests exercise six tonal backgrounds, all three accents, inverse programme actions and viewing-room text. A separate source reviewer identified retention refresh and enlarged-label risks; both were corrected and confirmed. Real-device visual verification remains outstanding.

## Restrained grain follow-up

The user approved fine static grain after the initial material pass. `ProgrammeGrain` now sits behind content on the current-session card and session detail header only. It uses local density-aware PNG tiles with capped alpha and separately tuned light/dark opacity. The reproducible generator and embedded origin metadata accompany the original assets. Text, control fills, imagery and main backgrounds stay clear. No motion, touch target or playback behavior changed. Contrast tests also check the brightest possible grain pixel behind programme text; final strength and tiling still require the real-device visual check.


## Copy refinement — September 29, 2026

Reviewed the main onboarding, Today, Sources, Saved, session-building, playback, importing, and profile-control paths in source. Replaced internal terminology and repeated product-manifesto copy with plain language and restrained brand expression. Action labels now describe their outcome; surfaced player and approval errors include clearer recovery. Retained the existing profile-role vocabulary, legal text, purchase terms, content supplied by creators, and destructive-action consequences.

Session duration text distinguishes partial totals from complete totals, and the existing tomorrow pause action now names its actual 7 am end time. No playback, authorization, persistence, pricing, layout, or motion behavior changed. Voice and terminology guidance is recorded in DESIGN.md.

Verification: TypeScript and lint checks; existing behavior test suite. Native runtime access remains unavailable, so phone/tablet wrapping, enlarged text, and screen-reader pronunciation still need real-device confirmation. This is a source copy review, not visual sign-off.


## Onboarding and demo Premium — September 29, 2026

- Rebuilt first run around welcome → interests → source choice → “This is your Frame.” Weekly picks respond to the selected interests; following remains an explicit action. The reveal uses the real Today service and lets the viewer make a first save into their library. Handled items do not refill, and metadata retention/profile scoping remain enforced.
- Added an optional, clearly labelled Premium demo after the reveal, with illustrative USD monthly/yearly plans and a local checkout confirmation. Real billing stays disabled; no entitlement or subscription is created. Existing purchase and restoration code is unchanged.
- Added a Settings replay route. It preserves onboarding completion and existing data, while clearly explaining that customization and saving affect the current profile. Fresh setup routes to Sources when no source was selected. Fixed the initial route guard so it does not race this completion destination.
- Empty, loading, offline/unavailable, failed-save, and Managed-profile states remain truthful. No seeded or synthetic content, artificial wait, or new animation was added. Native screen review remains unavailable: verify narrow phones, tablets, enlarged text, keyboard/back navigation, and screen-reader focus on-device.

Verification: 209 tests passed across 46 files (1,073 assertions), including completion destinations, same-profile retained selection, expired/handled metadata exclusion, duplicate avoidance, and local-only demo checkout transitions. TypeScript passes. Lint has no errors and the existing generated-file warning. Diff whitespace check passes. Final source follow-up retains saved reveal cards when returning from Premium and applies source mute rules to them.


## Conversion-focused onboarding refinement — September 29, 2026

Strengthened the welcome proposition and benefits; moved personalized source suggestions above the manual input; added visible stage labels and a first-save confirmation; connected the Premium offer to actual setup progress. After a persisted first save, the footer promotes the optional demo offer. The plan screen has one primary checkout action naming the selected sample price/period, with a visible route into the app. Completion now opens Saved when the viewer has saved a video during setup. Billing, metadata retention, profile boundaries, and skipping remain unchanged.

TypeScript and lint verification plus the existing 209-test suite cover this pass. The completion-destination test now includes first-save and replay destinations. A successful save followed by a failed selection refresh is reported accurately. `ONBOARDING_CONVERSION.md` records a research-informed hypothesis and a measurement plan; no conversion uplift is claimed and no analytics collection was added. Real-device and participant validation are outstanding.

## Frame-led brand copy

Replaced the welcome promise with “Worth watching. At your pace.” Removed YouTube naming from Frame-authored onboarding, source setup, import descriptions, About copy, controls, errors, and fallback metadata. Source examples now use @creator; external playback is “Open original video.” Demo paywall already contained no provider branding. No provider logos were found in authored assets or these UI components. Integrations and official player behavior remain intact; provider-controlled branding, creator metadata, and Terms/Privacy references remain. Validation: typecheck, lint, and existing test suite; native visual review remains unavailable.
