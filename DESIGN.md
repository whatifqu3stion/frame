---
name: Frame
description: "A calm native viewing interface with warm paper, accent-toned galleries, and editorial typography."
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
  light-programme: "#304B58"
  light-on-programme: "#FAF4EA"
  light-on-programme-soft: "#D4C7B6"
  light-programme-rule: "rgba(250, 244, 234, 0.24)"
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
  dark-programme: "#233640"
  dark-on-programme: "#FAF4EA"
  dark-on-programme-soft: "#D4C7B6"
  dark-programme-rule: "rgba(250, 244, 234, 0.24)"
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
  light-blue-programme: "#304B58"
  dark-blue-programme: "#233640"
  light-green-programme: "#414C36"
  dark-green-programme: "#2B3527"
  light-rose-programme: "#603D47"
  dark-rose-programme: "#402C34"
  watch-lit-wall: "#605249"
  watch-dark-lit-wall: "#413A35"
  watch-wall: "#202021"
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
  media: "0px"
  mount: "2px"
  source: "6px"
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
    rounded: "{rounded.mount}"
    padding: "{spacing.sm}"
  session-programme-light:
    backgroundColor: "{colors.light-programme}"
    textColor: "{colors.light-on-programme}"
    rounded: "{rounded.card}"
    padding: "12px"
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

Frame pairs warm paper surfaces, editorial serif titles, precise sans-serif controls, and textured grounds tinted by the selected accent. Classical imagery and printmaking provide character; contemporary composition and native interactions keep it useful. Luxury comes from spacing, material restraint, and thoughtful feedback rather than ornament.

This is the current implementation record, refreshed November 18, 2026. Runtime tokens in `expo/constants/theme.ts` and component behavior remain the implementation source of truth. Prior browser reviews cover selected flows and six theme combinations; they do not establish complete native visual or hardware acceptance. See `expo/docs/MOTION_REVIEW.md` and `expo/docs/SMOKE_TEST.md` for verification boundaries. Earlier conflicting design notes are preserved in [the historical snapshot](docs/design-history/2026-11-18-before-context-refresh.md), not active guidance.

**Key Characteristics:**
- Warm paper, large organic texture maps, and selectable mineral accents.
- Libre Caslon Text hierarchy paired with Hanken Grotesk controls.
- Real video artwork arranged as prints on accent-toned gallery grounds.
- Four primary destinations, progressive disclosure, and deliberate viewing actions.
- Expressive storytelling balanced with quiet everyday feedback.

## Colors

### Primary

Mineral blue, Mineral green, and Muted rose each have light and dark variants. Resolve through `useFrameTheme`; the six combinations are intentional. `accent` / `active` emphasize selection, `accentDeep` supports filled viewing actions, and `activeSoft` supports quiet feedback. `onAccent` and `onDanger` adapt by brightness mode. Frontmatter component examples describe the default light-blue theme, not universal fixed colors.

### Neutral

`wall` is the page ground; the `surface` family separates sheets, fields, and settings groups. `ink`, `inkSoft`, and `inkMuted` express hierarchy. `mount` and `mountEdge` frame artwork. Semantic success and danger retain distinct roles.

`programme` is a dark, ink-rich companion to the selected accent. `createPalette` overrides the legacy brown base with the six programme values recorded above; use these resolved values in sessions and discovery galleries. Ivory `onProgramme` text and translucent `programmeRule` remain consistent. The short `light-programme` / `dark-programme` documentation names represent blue defaults.

The viewing room is intentionally separate: `watchPalette` retains warm lit walls and charcoal playback. Do not recolor it from gallery tokens. Today's Viewing time chart keeps a neutral ground and selected-accent bars; it does not need a dark gallery backing.

## Typography

Libre Caslon Text carries display and title hierarchy; Hanken Grotesk carries body, labels, captions, and controls. Use the native font identifiers and role dimensions in the frontmatter. `fonts` also provides serif bold, serif italic, and platform monospace. Frontmatter px strings encode React Native logical units, not CSS requirements.

Preserve text scaling, wrapping, and readable line lengths. Local editorial sizes are deliberate: the onboarding wordmark is 26/34, the first-discovery heading 34/40, and its hero video title 23/29. Do not promote those exceptions into the global type scale. Tabular numerals support time and data. Avoid abbreviating important meaning to force a line fit.

## Layout

The shared horizontal page gutter is 20 logical units. Reading surfaces cap at 640; collection surfaces at 720. Expanded navigation begins from 1000 with text-aware adjustments; compact layouts use labelled bottom tabs. Safe-area and keyboard insets remain part of the layout, not decorative padding.

Settings uses grouped rows and focused detail routes. Today and source content favor artwork, clear metadata, and spacing over nested containers. Saved opens Videos by default; its Videos / Sessions switch matches the Followed / Discover pattern on Sources. Session status and viewing progress must not read as competing destinations.

Most primary controls have at least a 48-unit height. Preserve component-specific hit targets and large-text wrapping. Shared sheets are bottom-aligned within side gutters, capped at 560, scrollable, and keyboard-aware. Media ratio belongs inside its mount: padding must not crop the 16:9 picture.

## Elevation & Depth

Tonal layers and fine rules carry everyday depth. Programme artwork uses ivory mounts and restrained downward shadows. Sheets retain `softShadow`; the tab bar stays flat. Primary controls use the crisp theme-resolved edge, settling flat on press rather than accumulating shadows.

`ProgrammeGrain` now uses cover-scaled `panel-ink.png` and `button-ink.png`, not repeated small grain tiles. The panel finish crops an enlarged 175% image; paper, wall, button, and sheet use their own opacities. `PaperSurface` keeps texture behind content. Keep texture static, clipped, noninteractive, and hidden from accessibility. Do not introduce conspicuous repetitions or lay texture over the ready player.

## Shapes

Use the recorded radius scale: square media, nearly square matte mounts, gently rounded controls, softer cards and sheets, and pills for compact choices where implemented. First-discovery artwork has its own 8-unit corner treatment. Rounded cards do not imply rounded video content everywhere. Native hairlines remain platform-dependent; content clips separately from its surrounding mount.

## Components

| Component / pattern | Current treatment |
| --- | --- |
| `ScreenHeader` | Serif page title, optional supporting copy, profile control, and responsive wrapping. |
| `OnboardingIdentity` | One consistent static lockup: 24-unit accent corner mark, 8-unit gap, 26/34 Caslon wordmark, minimum 48-unit row. Supplied mark: “Fullscreen” by Andrejs Kirma, Noun Project. |
| `PrimaryAction` / `PlaybackAction` | Filled or programme-toned action with crisp depth and pressed feedback. Texture is optional via the real component; not every action is textured. Retain busy, disabled, focus, and named-action semantics. |
| `TextField` | One outer surface and focus border enclosing label/value/action behavior; clear labels and visible recovery. Secure key fields stay secure. |
| `ChoiceOption` / `SectionTabs` | Tints and checks acknowledge the current choice; reserved geometry avoids text shifting. Sections stay navigable through touch and keyboard. |
| `SettingsGroup` / `SettingsRow` | Grouped index under Viewing, Profiles & connections, and Support. Compact Max videos in Today control; Weekly interests leads to focused topic/priority views. Appearance separates theme, accent, House lights, and native Haptic feedback. |
| `MediaMount` / video cards | Matte surrounds, real source/video identity, and explicit viewing/save/session actions. Unknown metadata is disclosed rather than invented. |
| `SessionProgramme` / `ProgrammeArtwork` | Up to three available queue thumbnails in a staggered editorial arrangement, using a stable cover independent of playback position. Accent-resolved programme ground, ivory mounts, title/runtime caption, Up next, and separate Start/Continue control. Cover opens details; playback remains a distinct action. |
| `FirstDiscoveries` / `PickGallery` | A real featured video with interest context, followed by compact alternatives. Editorial arrival and choice feedback use current metadata; preview content is explicitly labelled. |
| `Sheet` / guidance | Modal accessibility, safe areas, scrolling, keyboard avoidance, and recoverable actions. Optional explanatory copy belongs behind a well-placed info control, not a persistent wall of text. |

### Onboarding and storytelling

The current flow is keys → autoplay study → scrolling study → recall study → welcome demonstration → benefits → library topics → special interests → first discoveries. Detailed behavior lives in `OnboardingFlow`, `OnboardingStory`, `ViewingBenefits`, and the study components. Record claims and sources in those research components; do not replace their copy from historical design prose.

The welcome demonstration uses a phone preview: choose interests, explore populated sources, scroll to a video, enter the viewing room, and finish with viewing time. Illustrative activity must not be confused with the user's actual history. The benefits screen opens with “Great videos, minus the rabbit holes.”, then gives each quoted concern a typed entrance, strike-through, resolution, and a clockwise circle/check confirmation. It has a subtle replay control and a static accessible alternative.

Next actions remain available with a quiet initial treatment and stronger fill after a story finishes. Idle glimmer cues only run when the stage is ready and inactive long enough, resetting with activity and stopping offscreen or under Reduce Motion. Do not reintroduce chart-bar glimmer or hide functional actions until a decorative sequence completes.

Special interests use a textured heart beside the title, an editable draft with an add affordance, added-interest pills, and the counter below. Discovery loading reflects real stages and accepted results; thanks appears only after a genuine wait. The final reveal gives real content priority over ceremony.

### Motion and haptics

The app uses React Native Animated and Reanimated, with shared durations in `expo/constants/motion.ts`. Preserve interruption, route visibility, app foreground, and Reduce Motion behavior. Reading/story timelines are intentionally longer than control transitions; do not impose one global speed.

House lights dim the room over 1720 ms and rise over 1480 ms after a standalone film or the last playable session item. Back restores the library with a 320 ms retarget. Pausing/loading/advancing within a session must not replay the entrance. Settings → Appearance → House lights can disable it. The official player stays fixed, full opacity, and unobscured; no artwork flight or poster zoom returns.

Haptics use the centralized feedback service: light selection, soft committed actions, and stronger genuine milestones. Current coverage includes explicit onboarding steps, successful key saves, changed choices, save/follow/session actions, and deliberate gallery promotion. The device-wide switch controls all profiles. Web, inactive/stale contexts, no-op actions, and rapid bursts are silent. Decorative animations and automatic playback changes never trigger haptics. Do not call the native haptics API directly from new UI components; use the guarded hook and successful-action boundary.

## Do's and Don'ts

### Do:
- Do resolve colors and typography through `useFrameTheme` and preserve all six themes.
- Do use real native components, actual metadata, and explicit loading/error/unavailable states.
- Do keep organic texture subordinate to content and use large cover-scaled assets.
- Do preserve safe areas, visible focus, meaningful accessibility names, text scaling, and Reduce Motion alternatives.
- Do verify gestures, playback, and haptic strength on real devices before claiming native acceptance.

### Don't:
- Don't restore universal brown programme backgrounds, small repeating texture tiles, or the retired four-stage onboarding flow.
- Don't replace the approved fonts or add literal marble, curtains, wood grain, or gold luxury clichés.
- Don't imply AI certainty, invent personalized results, or present demonstration charts as recorded history.
- Don't obscure the official player, delay an action for an effect, or add haptics to every animation.
- Don't treat the historical design snapshot as current product or visual authority.
