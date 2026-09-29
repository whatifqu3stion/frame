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

This is a code-led record of the Expo / React Native application, principally `expo/constants/theme.ts` and its consumers. It is not a mockup or a new product brief. Runtime verification was unavailable for this pass; these documented values do not constitute final visual approval. Motion is explicitly the next phase: this pass adds no motion and defines no new motion system.

**Key Characteristics:**
- Warm tonal surfaces with restrained mineral accents.
- Serif editorial hierarchy paired with precise sans-serif controls.
- Matte-mounted media and an ordered, deep umber programme.
- Four native tabs and explicit, finite viewing.

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

Pages use the `page` horizontal gutter. Today and Weekly Picks are vertically ordered media-and-copy compositions with divider rules, rather than stacked inset boxes. Saved uses a virtualized list, a current programme, a horizontal continue-watching strip, and search/filter controls. Actions wrap where implemented; screen headers wrap profile and title. No new responsive breakpoint system is defined.

Featured images retain a 16:9 content area inside the matte mount; its padding sits outside that ratio. Sheets are full-width within side gutters, capped at 560 logical units, bottom-aligned, scrollable and keyboard-aware. Most primary actions have a 48-unit minimum height; Saved filters and several detail actions use 44, search uses 52, and Begin uses 52. Preserve the implemented target sizes rather than inferring fixed heights from typography.

## Elevation & Depth

Tonal layering and fine rules carry everyday depth. Session programme surfaces also use a fine, static neutral grain behind their content. Featured media and programmes are flat at rest. Sheets retain the existing native `softShadow` (recorded in the sidecar as React Native properties); the tab bar explicitly has zero elevation. This is not a global ban on existing native shadows. Do not introduce web box-shadow replicas.

## Shapes

Use the observed radius scale above: restrained media corners, slightly softer controls, and card-shaped mounts/programmes/sheets. Pills remain for the Saved radio filters; the tab highlight and avatars retain their existing geometry. Hairline borders are `StyleSheet.hairlineWidth`, so their physical rendering is platform-dependent. Media clips inside its own radius, independently of the padded surround.

## Components

| Native component | Character and implementation |
| --- | --- |
| `ScreenHeader` | Serif page identity and compact profile chooser above a hairline rule; optional sans-serif subtitle. Native header/button semantics, wrapping top row and named profile action. |
| `MediaMount` | Matte `mount` surface with `mountEdge` hairline, `sm` inset and `card` radius. Shared by Today and Weekly Picks; content ratio remains inside. |
| `TodayVideoCard` | Mounted thumbnail, source, serif title, metadata and explicit Watch / Save / Session / More actions; lower divider. Busy/disabled semantics and polite progress feedback remain. |
| `WeeklyPickCard` | Mounted featured media, source identity and explanatory copy. Follow changes to Followed with selected-tonal styling; separate dismiss action and polite success/error feedback. |
| `SessionProgramme` | Deep umber with static grain, `lg` padding and `card` radius. Ordered two-digit rows with rules, current position, known remaining runtime and unknown-runtime disclosure. Entire programme is a labelled Open session button. |
| Saved search and filters | Native `TextInput` with leading search icon and labelled clear action; surface fill and soft border. Pill radios expose checked state inside a named radio group; selected colors use active/activeSoft. No custom web focus or hover rules are implied. |
| Session detail | Umber heading panel and pale Start session/Continue/Watch again action; separated edit/duplicate/delete controls and numbered ruled video list. Unavailable metadata and the explicit stop note remain visible. |
| `Sheet` | Native modal, safe-area padding, keyboard avoidance and scrollable contents with modal accessibility. Uses `surfaceHigh`, `lg` padding and existing soft shadow. |
| Tab navigation | Today, Sources, Saved and Settings retain labels and native tab semantics; selected icon sits on activeSoft. SurfaceHigh bar, hairline top border and safe-area-aware bottom inset. Hidden legacy routes are not new tabs. |

The shared `ProgrammeGrain` is restricted to the current-session card and the session detail header. It repeats a bundled 128-unit tile with 1×/2×/3× density assets, clips to the card radius and is excluded from touch and accessibility. Per-pixel alpha is capped at 32/255; layer opacity is 0.22 in light mode and 0.16 in dark mode. Text and controls paint above it. The original deterministic generator and provenance ship with the assets. Main backgrounds, controls and video remain untextured.

Existing pressed opacity/scale feedback and reduced-motion-aware Sheet fade are implementation facts, not new motion prescriptions. Existing image transitions, haptics and timing exports are outside this static pass. No new durations, easing, choreography or animation examples are specified here.

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
- Don't add or design new motion in this static refinement; motion belongs to the next phase.


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

The welcome flow has four stages: welcome, optional interests, source choice, and a personal reveal. Interest choices feed the existing weekly source picks; viewers explicitly review and follow each source. The reveal reads the same finite Today snapshot as the app and supports a real first save. It keeps that saved card visible during setup, including a return from the Premium preview. It never fills missing content with invented videos. Managed profiles retain the existing approval path; their reveal routes them to the protected app experience rather than exposing an unrestricted selection.

Use the established serif titles, warm surfaces, umber introduction, matte media mount, and ruled source rows. Keep controls reachable through scrolling, a wrapping footer, keyboard avoidance, and safe-area padding. Only the active stage is mounted. No entrance choreography, simulated progress, or new texture treatment is introduced.

The optional Premium preview follows the reveal. It is controlled by `FOUNDATION_CAPABILITIES.demoPaywall` and hidden when real paid access is enabled. Sample USD prices ($39.99/year and $4.99/month) are illustrative, not approved commercial pricing. “Demo · no charge” accompanies the plans. Selection and simulated checkout remain component state; no billing request, purchase restoration, entitlement change, or subscription is created. Leaving the preview never limits app access.

Settings → Demo → Preview welcome & Premium replays this flow without resetting the library or onboarding completion. Source, interest, and save actions remain real and profile-local, which the replay explicitly states. First completion goes to Saved after a first save, Today if sources exist without a new save, and Sources otherwise; replay returns to Settings. Real-device validation and the planned motion phase remain outstanding.


### Conversion intent

Onboarding explicitly explains the value of Frame through familiar creators, a bounded daily selection, saved finds, and sessions with an ending. Personalized source suggestions precede manual link entry. The reveal makes the first real save visually prominent; only after that persisted action does the footer promote the Premium demo. The offer uses real progress counts and describes the ongoing benefit of the library. Its checkout CTA names the sample plan and billing period, with one primary action at a time and a visible continuation without purchase. No new personalization questionnaire, artificial scarcity, or fabricated proof is introduced. See `expo/docs/ONBOARDING_CONVERSION.md` for the hypothesis, research limitations, and uninstrumented validation plan.

### Frame-led brand language

Lead with “Worth watching. At your pace.” Frame-authored onboarding, offers, everyday controls, and recovery messages use Frame’s voice without YouTube names, logos, or branded URL examples. Use “@creator” as the source-input example and “Open original video” for external playback. This is a copy and identity decision, not a change to supported providers. Preserve provider identifiers and URLs in integrations, creator-supplied metadata, the official embedded player, and accurate Terms/Privacy disclosures. The external player and account authorization screens may display their own branding.
