---
name: Frame
description: "A calm, curated native viewing interface with warm stone surfaces and a deep umber programme."
colors:
  light-wall: "#F3F0EA"
  light-surface: "#F8F5EF"
  light-surface-deep: "#E9E4DB"
  light-surface-high: "#FFFDFA"
  light-surface-dim: "#DED7CC"
  light-surface-bright: "#FFFEFB"
  light-ink: "#2C2825"
  light-ink-soft: "#625B54"
  light-ink-muted: "#625B52"
  light-rose: "#B88E95"
  light-clay: "#A9755E"
  light-sage: "#60725E"
  light-success: "#4A544A"
  light-danger: "#943F36"
  light-mount: "#FFFDFA"
  light-mount-edge: "#D8D0C4"
  light-programme: "#342B25"
  light-on-programme: "#FAF4EA"
  light-on-programme-soft: "#D4C7B6"
  light-programme-rule: "#69584A"
  light-border: "rgba(88, 76, 64, 0.24)"
  light-border-soft: "rgba(88, 76, 64, 0.14)"
  light-overlay: "rgba(44, 40, 37, 0.48)"
  light-shadow: "rgba(54, 42, 32, 0.09)"
  light-on-dark: "#FFFDF9"
  light-on-dark-soft: "rgba(255, 253, 249, 0.76)"
  dark-wall: "#171513"
  dark-surface: "#201D1A"
  dark-surface-deep: "#27231F"
  dark-surface-high: "#2D2925"
  dark-surface-dim: "#121110"
  dark-surface-bright: "#322D28"
  dark-ink: "#F4F0ED"
  dark-ink-soft: "#C7C0BA"
  dark-ink-muted: "#B3A99F"
  dark-rose: "#B6909A"
  dark-clay: "#B87D61"
  dark-sage: "#4A544A"
  dark-success: "#809580"
  dark-danger: "#D98276"
  dark-mount: "#302B26"
  dark-mount-edge: "#51483F"
  dark-programme: "#382F28"
  dark-on-programme: "#FAF4EA"
  dark-on-programme-soft: "#D4C7B6"
  dark-programme-rule: "#69584A"
  dark-border: "rgba(244, 240, 237, 0.22)"
  dark-border-soft: "rgba(244, 240, 237, 0.13)"
  dark-overlay: "rgba(7, 7, 6, 0.74)"
  dark-shadow: "rgba(0, 0, 0, 0.30)"
  dark-on-dark: "#F4F0ED"
  dark-on-dark-soft: "rgba(244, 240, 237, 0.74)"
  light-blue-accent: "#3B6073"
  light-blue-accent-deep: "#36596B"
  light-blue-accent-soft: "#BFD2DB"
  light-blue-active: "#3B6073"
  light-blue-active-soft: "rgba(74, 113, 134, 0.10)"
  dark-blue-accent: "#8FB7CA"
  dark-blue-accent-deep: "#3F687C"
  dark-blue-accent-soft: "#C7DEE7"
  dark-blue-active: "#8FB7CA"
  dark-blue-active-soft: "rgba(143, 183, 202, 0.10)"
  light-green-accent: "#49624C"
  light-green-accent-deep: "#3F5944"
  light-green-accent-soft: "#C4D2C2"
  light-green-active: "#49624C"
  light-green-active-soft: "rgba(82, 107, 85, 0.10)"
  dark-green-accent: "#9AB497"
  dark-green-accent-deep: "#486345"
  dark-green-accent-soft: "#C6D8C4"
  dark-green-active: "#9AB497"
  dark-green-active-soft: "rgba(154, 180, 151, 0.10)"
  light-rose-accent: "#834B56"
  light-rose-accent-deep: "#7B4752"
  light-rose-accent-soft: "#E1C4C9"
  light-rose-active: "#834B56"
  light-rose-active-soft: "rgba(156, 98, 108, 0.10)"
  dark-rose-accent: "#D4A4AC"
  dark-rose-accent-deep: "#8B5963"
  dark-rose-accent-soft: "#E6C7CC"
  dark-rose-active: "#D4A4AC"
  dark-rose-active-soft: "rgba(212, 164, 172, 0.10)"
  light-on-accent: "#FFFDF9"
  light-on-danger: "#FFFDF9"
  dark-on-accent: "#171513"
  dark-on-danger: "#171513"
typography:
  display:
    fontFamily: "LibreCaslonText_400Regular"
    fontSize: "42px"
    lineHeight: "49px"
    letterSpacing: "-0.7px"
  title:
    fontFamily: "LibreCaslonText_400Regular"
    fontSize: "30px"
    lineHeight: "37px"
    letterSpacing: "-0.45px"
  heading:
    fontFamily: "LibreCaslonText_400Regular"
    fontSize: "20px"
    lineHeight: "27px"
  body:
    fontFamily: "HankenGrotesk_400Regular"
    fontSize: "15px"
    lineHeight: "22px"
  bodySoft:
    fontFamily: "HankenGrotesk_400Regular"
    fontSize: "14px"
    lineHeight: "21px"
  caption:
    fontFamily: "HankenGrotesk_600SemiBold"
    fontSize: "12px"
    lineHeight: "17px"
    letterSpacing: "0.2px"
  label:
    fontFamily: "HankenGrotesk_500Medium"
    fontSize: "13px"
    lineHeight: "18px"
rounded:
  small: "8px"
  control: "10px"
  media: "6px"
  card: "16px"
  large: "22px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  page: "20px"
  lg: "24px"
  xl: "40px"
  xxl: "64px"
  xxxl: "96px"
components:
  media-mount-light:
    backgroundColor: "{colors.light-mount}"
    rounded: "{rounded.card}"
    padding: "{spacing.sm}"
  session-programme-light:
    backgroundColor: "{colors.light-programme}"
    textColor: "{colors.light-on-programme}"
    rounded: "{rounded.card}"
    padding: "{spacing.lg}"
  watch-button-light-blue:
    backgroundColor: "{colors.light-blue-accent-deep}"
    textColor: "{colors.light-on-dark}"
    rounded: "{rounded.control}"
    typography: "{typography.label}"
  follow-button-light-blue:
    backgroundColor: "{colors.light-blue-active}"
    textColor: "{colors.light-on-accent}"
    rounded: "{rounded.control}"
    typography: "{typography.label}"
  saved-search-light:
    backgroundColor: "{colors.light-surface}"
    rounded: "{rounded.control}"
    typography: "{typography.body}"
  saved-filter-light:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-ink-soft}"
    rounded: "{rounded.pill}"
    typography: "{typography.label}"
  saved-filter-selected-light-blue:
    backgroundColor: "{colors.light-blue-active-soft}"
    textColor: "{colors.light-blue-active}"
    rounded: "{rounded.pill}"
    typography: "{typography.label}"
  sheet-light:
    backgroundColor: "{colors.light-surface-high}"
    rounded: "{rounded.card}"
    padding: "{spacing.lg}"
    width: "100%"
---
# Design System: Frame

## Overview

**Creative North Star: "A curated museum-inspired viewing space"**

The approved direction is contemporary, calm and luxurious: warm stone-toned surfaces, deep umber programmes, matte media surrounds, crisp typography and restrained edges. Material character comes from tone, spacing and hierarchy. Libre Caslon Text and Hanken Grotesk remain the identity.

This is a code-led record of the Expo / React Native application, principally `expo/constants/theme.ts` and its consumers. It is not a mockup or a new product brief. Runtime verification was unavailable for this pass; these documented values do not constitute final visual approval. The approved motion phase is now implemented in source: restrained choice feedback, measured session ordering, a first-selection reveal and a deliberate ending. Timing and haptic strength still need real-device approval.

**Key Characteristics:**
- Warm tonal surfaces with restrained mineral accents.
- Serif editorial hierarchy paired with precise sans-serif controls.
- Matte-mounted media and an ordered, deep umber programme.
- Four native destinations, presented as tabs or a sidebar, and explicit, finite viewing.

## Colors

Warm stone neutrals carry the interface; Mineral blue, Mineral green and Muted rose provide the selectable accents. `createPalette` combines each accent with light or dark bases, retaining six complete themes. The frontmatter prefixes distinguish these real variants; they are documentation names, not renamed application properties.

### Primary

Use the selected theme's `accent` / `active` for emphasis and selection, `accentDeep` for Watch actions, and `activeSoft` for quiet action backgrounds. `onAccent` and `onDanger` are resolved per brightness mode. Do not hardcode the light-blue component examples into other themes.

### Neutral

`wall` is the page ground; the `surface` family separates controls, sheets and quieter layers. `ink`, `inkSoft` and `inkMuted` carry primary, supporting and metadata text. `mount` and `mountEdge` frame media. `programme`, `onProgramme`, `onProgrammeSoft` and `programmeRule` form the intentional dark programme within either brightness mode. Borders are translucent native hairlines or explicit strokes. Success and danger remain semantic feedback colors.

The playback view has its own existing `watchPalette` in `theme.ts`; it remains a separate dark viewing environment. Do not replace that palette with the light documentation examples.

## Typography

**Display Font:** Libre Caslon Text, loaded under the native `LibreCaslonText_400Regular` and bold asset names. **Body Font:** Hanken Grotesk, with regular, medium and semibold assets. Native monospace resolves to Menlo on iOS and monospace elsewhere.

Frontmatter preserves the source role names and loaded family identifiers. Display, title and heading are serif; body, bodySoft, caption and label are sans serif. Exact sizes, line heights and tracking are above. Numeric session order uses native tabular numerals. Media/source titles reuse heading with an observed 22/29 override; the programme title uses 26/33. Avoid changing copy to fit a layout.

## Layout

Frontmatter `px` dimensions encode the existing React Native logical layout units for portability; implement them as native numeric values, not CSS pixels. Respect native text scaling and safe-area insets.

Pages use the `page` horizontal gutter. Today and Weekly Picks are vertically ordered media-and-copy compositions with divider rules, rather than stacked inset boxes. Saved leads with one compact latest-resume row when available, followed by its virtualized collection. The row includes unsaved viewing progress and stays hidden during search, edit, or session planning. Search & filter reveals the search field and viewing filters; clearing and closing resets them. Sessions & progress switches to a dedicated planning view within the Saved tab, with a clear return to saved videos. Edit Saved reveals labelled removal actions with the same reversible Undo feedback as the player. Actions wrap where implemented; screen headers wrap profile and title. Today, Saved, and Sources use a centered 720-unit maximum content width; Settings and import use 640. Expanded windows use the navigator’s sidebar from 1000 units, with a higher threshold and wider rail as text grows. Compact windows retain bottom tabs with wrapping labels and text-aware height. Window dimensions, not device names, drive this adaptation.

Featured images retain a 16:9 content area inside the matte mount; its padding sits outside that ratio. Sheets are full-width within side gutters, capped at 560 logical units, bottom-aligned, scrollable and keyboard-aware. Most primary actions have a 48-unit minimum height; Saved filters and several detail actions use 44, search uses 52, and Begin uses 52. Preserve the implemented target sizes rather than inferring fixed heights from typography.

## Elevation & Depth

Tonal layering and fine rules carry everyday depth. Session programme surfaces also use a fine, static neutral grain behind their content. Featured media and programmes are flat at rest. Sheets retain the existing native `softShadow` (recorded in the sidecar as React Native properties); the tab bar explicitly has zero elevation. This is not a global ban on existing native shadows. Do not introduce web box-shadow replicas.

## Shapes

Use the observed radius scale above: restrained media corners, slightly softer controls, and card-shaped mounts/programmes/sheets. Saved radio filters share the restrained control radius used by other choices; the tab highlight and avatars retain their existing geometry. Hairline borders are `StyleSheet.hairlineWidth`, so their physical rendering is platform-dependent. Media clips inside its own radius, independently of the padded surround.

## Components

| Native component | Character and implementation |
| --- | --- |
| `ScreenHeader` | Serif page identity and compact profile chooser above a hairline rule; optional sans-serif subtitle. Native header/button semantics, wrapping top row and named profile action. |
| `MediaMount` | Matte `mount` surface with `mountEdge` hairline, `sm` inset and `card` radius. Shared by Today and Weekly Picks; content ratio remains inside. |
| `TodayVideoCard` | Mounted thumbnail, source, serif title, metadata and explicit Watch / Save / Session / More actions; lower divider. Busy/disabled semantics and polite progress feedback remain. |
| `WeeklyPickCard` | Mounted featured media, source identity and explanatory copy. Follow changes to Followed with selected-tonal styling; separate dismiss action and polite success/error feedback. |
| `SessionProgramme` | Deep umber with static grain, `lg` padding and `card` radius. Ordered two-digit rows with rules, current position, known remaining runtime and unknown-runtime disclosure. Entire programme is a labelled Open session button. |
| Saved search and filters | Shared `TextField` wraps native `TextInput`, its leading icon and labelled clear action in one surface. A single 1px inkSoft focus border follows the outer radius; the inner web outline and Android underline are suppressed. Body sans text is 16px, with a 52-unit minimum control height and 8-unit label gap. The same field serves session names/search, subscription search and source entry. Wrapping choice radios expose checked state inside a named radio group, reserve space for a check, and use active/activeSoft for selected content. |
| Session detail | Umber heading panel and pale Start session/Continue/Watch again action; separated edit/duplicate/delete controls and numbered ruled video list. Unavailable metadata and the explicit stop note remain visible. |
| `Sheet` | Native modal, safe-area padding, keyboard avoidance and scrollable contents with modal accessibility. Uses `surfaceHigh`, `lg` padding and existing soft shadow. |
| Tab navigation | Today, Sources, Saved and Settings retain labels and native tab semantics; selected icon sits on activeSoft. SurfaceHigh bar, hairline top border and safe-area-aware bottom inset. Hidden legacy routes are not new tabs. |

The shared `ProgrammeGrain` is restricted to the current-session card, session detail header, and confirmed first-save moment in onboarding. It repeats a bundled 128-unit tile with 1×/2×/3× density assets, clips to the card radius and is excluded from touch and accessibility. Per-pixel alpha is capped at 32/255; layer opacity is 0.22 in light mode and 0.16 in dark mode. Text and controls paint above it. The original deterministic generator and provenance ship with the assets. Main backgrounds, controls and video remain untextured.

Motion uses `expo/constants/motion.ts`: 160 ms choices, 180 ms local state changes, 220 ms row continuity, 400 ms first selection, and 340 ms final ending. Cubic ease-out, no overshoot. Selected-control labels stay opaque; geometry remains stable. Native navigation and sheet presentation retain OS ownership. Reduced Motion makes custom transitions immediate. Static grain and loading placeholders never loop.

Touch feedback belongs to accepted choices and completed actions, with stronger confirmation reserved for genuine milestones. The device-wide Settings switch controls custom feedback across profiles. Web, inactive or stale contexts, no-op results, and bursts are suppressed. Navigation, automatic playback changes, erasure, typing and native picker gestures remain quiet. See `expo/docs/MOTION_AND_HAPTICS_REVIEW.md` for exact scope and hardware verification gates.

## Do's and Don'ts

### Do:
- Do resolve colors and typography through `useFrameTheme`; preserve all six theme combinations.
- Do use the actual native components and metadata, including unavailable and unknown-runtime states.
- Do preserve safe areas, scrollable sheets, meaningful accessibility labels and explicit viewing actions.
- Do review the real app on target devices before granting final visual approval.

### Don't:
- Don't add literal marble veins, wood grain, curtains or gold luxury tropes.
- Don't replace Libre Caslon Text or Hanken Grotesk, or collapse the six themes into one palette.
- Don't substitute approximate HTML mockups for native implementation or introduce infinite viewing or autoplay.
- Don't animate grain, live playback, private profile handoffs, or every page entrance; never delay an action to finish an effect.


### Voice and terminology

Frame sounds calm, clear, and interested in what the viewer enjoys. Use short, natural sentences and restrained warmth in welcome and completion moments. Everyday controls describe the action directly. Avoid internal vocabulary such as “finite inbox,” “fixed pool,” or “protected boundary,” and avoid moralizing about viewing or promising wellbeing.

| Term | Use |
| --- | --- |
| Today | The tab and its daily selection of videos. Call the contents “today’s selection,” not an inbox. |
| Source | A creator’s channel followed in Frame. Explain that following a source adds its videos to Today. |
| Saved | The destination; “saved videos” for the items within it. |
| Session | A short, ordered viewing plan. Use lowercase “session” in ordinary copy and sentence case in labels. |
| Weekly picks | Optional source suggestions; “this week’s selection” in explanatory text. |
| Owner / Standard / Managed | Existing profile roles. Preserve the role names and explain what their controls do. |
| Owner PIN | The PIN protecting Frame’s controls. Do not call it device protection or a household password. |

Use specific actions such as “Find source,” “Request approval,” “Open original video,” and “Start session.” Error messages state what failed and the available recovery. Unknown durations remain explicitly unavailable; partial duration totals say “At least.” Finish estimates exclude breaks. Keep deletion, privacy, purchase, and restriction consequences explicit. Align accessibility names with the visible action.


### First-run experience and Premium demo

The welcome flow has three stages: optional interests with the value proposition, source choice, and a personal reveal. Versioned setup drafts map the former introduction/interests screens to the first stage while retaining source/reveal progress and saved IDs. Interest choices feed a provisional preview of the shared publication without issuing or altering the regular weekly edition; viewers explicitly review and follow each source. The reveal reads the same finite Today snapshot as the app and supports a real first save. One real hero thumbnail and supporting images make both source review and the final selection recognizable. It keeps the saved card visible during setup, including a return from the Premium preview. Setup stage and saved IDs resume from a profile-local draft after restart; replay does not overwrite that draft. It never fills missing content with invented videos. Managed profiles retain the existing approval path; their reveal routes them to the protected app experience rather than exposing an unrestricted selection.

Use the established serif titles, warm surfaces, matte media mounts, and ruled source rows. Interest choices form two flexible columns of quietly ruled options, with explicit checks and a pale selected surface. Keep controls reachable through scrolling, a wrapping footer, keyboard avoidance, and safe-area padding. Only the active stage is mounted. No entrance choreography or simulated progress is introduced. The existing static programme grain appears only in the confirmed first-save acknowledgement; it never animates.

The optional Premium preview follows the reveal. It is controlled by `FOUNDATION_CAPABILITIES.demoPaywall` and hidden when real paid access is enabled. Sample USD prices ($39.99/year and $4.99/month) are illustrative, not approved commercial pricing. “Demo · no charge” accompanies the plans. Selection and simulated checkout remain component state; no billing request, purchase restoration, entitlement change, or subscription is created. Leaving the preview never limits app access.

Settings → About & help → Demo → Preview welcome & Premium replays this flow without resetting the library or onboarding completion. Source, interest, and save actions remain real and profile-local, which the replay explicitly states. First completion goes to Saved after a first save, Today if sources exist without a new save, and Sources otherwise; replay returns to Settings. The motion phase is implemented; real-device validation remains outstanding.


### Conversion intent

Onboarding explicitly explains the value of Frame through familiar creators, a bounded daily selection, saved finds, and sessions with an ending. Personalized source suggestions precede manual link entry. The reveal makes the first real save visually prominent; after that persisted action, Open Saved is the primary continuation and the Premium demo remains a secondary invitation. The offer uses real progress counts and describes the ongoing benefit of the library. Its checkout CTA names the sample plan and billing period, with one primary action at a time and a visible continuation without purchase. No new personalization questionnaire, artificial scarcity, or fabricated proof is introduced. See `expo/docs/ONBOARDING_CONVERSION.md` for the hypothesis, research limitations, and uninstrumented validation plan.

### Frame-led brand language

Lead with “Worth watching. At your pace.” Frame-authored onboarding, offers, everyday controls, and recovery messages use Frame’s voice without YouTube names, logos, or branded URL examples. Use “@creator” as the source-input example and “Open original video” for external playback. This is a copy and identity decision, not a change to supported providers. Preserve provider identifiers and URLs in integrations, creator-supplied metadata, the official embedded player, and accurate Terms/Privacy disclosures. The external player and account authorization screens may display their own branding.


### September 30 field and state polish

The shared `TextField` also covers profile names, PIN entry, daily allowance,
playback-minute limits, web clock entry, reset confirmation, and the quick session
picker. Field values use the interface sans; tracking belongs only on entered PIN
marks and the short RESET confirmation. Profile editors use a quiet top rule,
without an accent border around the whole form. Persistent labels identify the
current, new, and repeated PIN.

Loading and failed reads must never impersonate an empty collection. Local
library and policy reads run offline; cached network services own their fallback
states. Action errors need visible recovery copy as well as accessible feedback.
Do not treat these source-level checks as native visual approval: the current
release gate is in `expo/docs/SMOKE_TEST.md`.


### Settings disclosure

Settings is a short index of quiet text rows, with current-value summaries and
native detail navigation. Interests, Appearance & feedback, Google connection,
Privacy & data, and About & help each reveal only their own controls. Profiles &
boundaries remains a direct Owner-authorized action. Demo and beta support live
under About & help; erasure remains under Privacy & data with the full existing
confirmation sequence. The redundant profile card and non-interactive focus
explanation have been removed. No setting or capability was removed.

Settings row titles use the 15px body size with medium weight above 14px summaries.
Pressed rows gain a quiet surface tint without dimming text. Theme, accent color,
and touch feedback have separate headings. Selection uses checks and restrained
neutral borders; reserve check space so choices do not shift when selected.

### Motion refinement: outcomes, not spectacle

Save and follow icons stay mounted through pending work and settle only after a
new confirmed result (220 ms, 0.86–1 scale, no overshoot). Existing saved/followed
states do not animate on arrival. Failed reversal does not celebrate an unchanged
state. Profile/media changes reset the icon identity.

Setup progress resolves in place over 160 ms, including Back. The first saved
video earns a single 400 ms drawn check against the programme surface; its copy
and controls are immediately available. Today’s persistent feedback transitions
when its message or undo target changes. Existing native navigation, short sheet
fades, choice color transitions, session ordering, and playback endings remain.

New effects stop and settle on background, blur, unmount, or Reduce Motion. Icon
and progress transitions use the native driver. The one 28px SVG completion mark
uses a bounded JS-driven stroke; no loops, delays, new dependencies, or extra
haptic events. Device smoothness and subjective timing remain unverified.


### October 1 critique fixes

Source previews distinguish unavailable, empty, and exhausted publication states. An explicit next-selection action walks a finite provisional pool; changing interests does not freeze setup suggestions for the week. Missing images retain stable, honest fallbacks. Empty Today offers a direct path to the followed sources without bypassing eligibility. Session selection, ordering, and detail rows use real retained thumbnails beside numbering and runtime. Managed requests open evidence before labelled Approve/Deny actions; expired metadata is disclosed instead of showing stale imagery; existing approval authorization remains unchanged. About & help answers concrete tasks through disclosures. Source load errors expose in-place Retry. Native visual, large-text, screen-reader, and motion checks remain open in the smoke plan.


### Distilled flow and task copy

The separate introductory screen and repeated Premium benefit pitch are removed; the real source preview and first save demonstrate the value. Premium stays an optional, labelled no-charge demo. Approval decisions say Approve video or Approve source and explain their scope and unchanged viewing limits. Source requests label their imagery/description as context from a video, and Decline request explains that it removes the request without adding an approval. Help uses task headings, short instructions, and links to the relevant app destination. No playback, approval, billing, or retention rules changed.


### Onboarding: premium delight

The emotional direction is a personal collection taking shape. Real hero previews use the matte mount, with larger Caslon media titles and smaller supporting images. Selection feedback stays quiet and useful. The confirmed first-save moment uses the existing deep programme surface and static grain, the existing check draw and success haptic, and the short acknowledgement “Kept for you.” The final finite selection closes with “An ending, by design.” No additional step, artificial delay, motion loop, sound, dependency, or fabricated media is added. Reduced Motion and feedback preferences continue to govern the existing animations and haptics.


### Request review and return paths — October 2026

Managed Selected Videos now offers Request a video from empty Today and Sources. The link resolver presents Request approval directly; it does not grant access. Settings and profile summaries show pending request counts without exposing another profile’s request details. Owner review offers a canonical original preview outside Frame and an in-place details refresh using the existing bounded source-resolution service. Preview requires Owner authorization and never grants approval. After returning from an external preview, the profile and expanded request remain selected behind an unlock gate if Owner access expired. Expired evidence cannot be approved from the request editor; refresh retains the request identity, scope, and original ordering timestamp and rejects mismatched or still-expired metadata.

Today feedback keeps message, action, and target in one state. A new save or session action replaces previous dismissal feedback; session success opens the exact session. Both session creation paths offer an optional editable name and the same unused Session N default. Onboarding replay states upfront that interests, sources, and saves change the profile. First save and Saved’s collapsed How Saved works disclosure explain local links and internet playback.

Verification: 244 automated tests, TypeScript, and lint pass for this pass. Native rendering, Owner preview return/unlock presentation, and assistive focus still require device verification; no native runtime was available.


### Consistent controls and useful recovery — October 2026

Setup, Discover, and Settings share the same three interest groups and ruled two-column choices. Today offers explicit Refresh for stale details and uses an offline icon only for network failure. Discover recovery opens followed sources directly. Source details name their loading state and allow descriptions to expand; long player descriptions start collapsed, keeping View source reachable without changing the deliberate ending.

Saved and the player share reversible removal with a named target, Undo, and dismiss. Undo retains the original video link and stays scoped to its profile and screen. Empty session selection opens Today through the existing draft-exit guard. Session deletion explains that saved videos remain; deletion only removes the session, not its saved videos. Pause Frame copy explains that Save applies both pause and resume, and PIN creation explains destructive local recovery.

Google import retains search, loaded pages, and selections briefly in memory for the same profile and connection; it does not promise recovery after app restart. Already-followed selections and capacity changes are reconciled. Disconnect, profile deletion, and local erasure clear the draft. Successful import opens followed sources directly. Help summaries foreground using Frame, storage, and support. Privacy and Terms link directly to device data and Google controls; unavailable screens use plain language.

Verification: 247 automated tests pass, including import draft expiry and selection reconciliation; TypeScript passes. Scoped lint reports no errors and one pre-existing onboarding dependency warning. Impeccable's static scan returned no findings. Native layout, screen-reader focus, navigation recovery, and touch behavior remain unverified and are listed in the smoke plan.


### Adaptive refinement and shared choices — October 2026

ChoiceOption now owns the label, reserved check, quiet selection backing, wrapping, and 52-unit minimum target for interests, appearance, daily allowances, and Saved filters. Interests retain their grouped ruled treatment and switch to one column for narrow windows or larger text. Navigation segments, action buttons, switches, and rich subscription rows keep their distinct purposes. Text fields retain their established treatment.

The bounded collection and reading widths apply through loaded, loading, and empty list states. Import's action dock shares its reading width. Today and Saved feedback follows the collection width and reserves its measured height in scrolling content. Main tab pages, import, and sheets honor horizontal safe-area insets. Chapters allow full titles, size timestamps intrinsically, and stack timestamp/title above 1.3 font scale. Existing save, ordering, and ending motion remains unchanged.

Source audit: remaining issues were duplicated choice styling, unbounded primary pages, fixed tab geometry, chapter text constraints, landscape sheet gutters, and stale help instructions. Prior handoff fixes already expose resume, Managed request entry, exact-session navigation, and temporary import selection recovery. Nested-sheet focus remains a device acceptance item, not a verified defect. The iOS configuration remains phone-only; this pass does not enable iPad support.

Verification: 247 tests pass; TypeScript and lint on all changed source files pass. Native platform conformance, rendering, traversal, and performance are not scored because no simulator/emulator/device was available. See smoke section 24 for the pending acceptance matrix. A clean source check is not native accessibility sign-off.

### Recovery and continuity — October 2026

Frame intentionally allows 25 followed sources per profile. Manual follow, selective import, and the shared Today feed use the same ceiling. Older profiles above that limit retain every follow and saved link; Today explains the limit and opens Sources so the person chooses what to unfollow. No automatic trimming or hidden feed subset is introduced.

Expired video details offer a deliberate, bounded Refresh details action beside saved/resume cards and session entries. Recovery validates the exact video and current source identity, updates only existing library metadata, and preserves save dates, resume positions, session order, and Today dispositions. Details still expire after 30 days. Managed Approved Sources uses the same resolver for unfamiliar links and retries failed verification without granting approval. Existing environment and server quota controls still apply.

Resume records now retain their originating saved session. Continue watching opens that session only while its cursor and membership still match; legacy or changed-session resumes remain standalone. Today offers one compact named Continue session entry, Saved names its current session, and deliberate endings identify the next video and duration when known. Follow confirmations explain the next daily selection and offer Browse source now; Today names the next reset time.

Source lookup can be cancelled by leaving its sheet or setup step, retains the pasted input, and bounds the complete network response to 12 seconds. First-run watch links retain only their validated video ID through setup, scoped to the active profile and cleared with profile data. Owner authorization expiry keeps ordinary form drafts behind an unlock gate, while clearing PIN fields. Source detail, session builder/detail, and Settings details reuse bounded widths and horizontal safe-area gutters.

No additional motion was added. Automated validation covers provenance/migration, recovery identity/expiry, request cancellation/timeouts, source ceilings, and profile-scoped intent cleanup. Native visual, focus, keyboard, orientation, and player acceptance remain pending; see the smoke plan.
