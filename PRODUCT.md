# Frame: product context

<!-- impeccable:product-schema 1 -->

Updated November 18, 2026 from the approved product direction and current Expo implementation. This record covers the Frame app in `expo/`; research, video compositions, and development previews are supporting artifacts, not separate consumer products.

## Platform

adaptive

Frame is an Expo / React Native app for iOS and Android, with an adaptive compact-tab / expanded-sidebar layout. The web build is a development and demonstration surface. Shared Frame typography and colors are intentional; preserve each OS's navigation, safe areas, keyboard behavior, accessibility, and player guarantees.

## Users

People who value the excellent content available on YouTube but dislike endless scrolling, short-form detours, and pressure to keep watching. Frame helps them choose deliberately, discover substantive creators, and enjoy a viewing session with an ending. Owner, Standard, and Managed profiles support different local permissions; this is not a claim of child-safety certification.

## Product Purpose

A quieter, more refined way to watch: a finite Today selection, an intentional source library, optional interest-based discovery, saved videos, and ordered sessions. Success is finding something worthwhile and retaining control over when to watch and stop, not maximizing time spent.

## Operating Context

- Four main destinations: Today, Sources, Saved, Settings. Saved has Videos / Sessions; Sources has Followed / Discover.
- Setup begins with API keys, followed by three research screens, the welcome phone demonstration, the benefits story, library topics, optional special interests, and the first discoveries. Current step IDs live in `expo/constants/navigation.ts`; do not resurrect the older four-stage setup.
- Key setup can be deferred. Missing-key features provide contextual recovery; completing onboarding opens Today instead of forcing Settings.
- The first discoveries are real reviewed results when available. Explicitly labelled sample/loading previews exist for design review and must never masquerade as personalized production results.
- The app is also demonstrated as portfolio work. Presentation quality matters, but demos do not establish provider reliability or store readiness.

## Capabilities and Constraints

- The current edition is full-access BYOK. YouTube metadata needs a user-provided YouTube Data API key; optional AI discovery needs Gemini access. Provider quotas and charges can apply. Paid access and the demo paywall are disabled in `expo/constants/productConfig.ts`; a future paywall remains a product decision, not an implemented requirement.
- Native keys are Owner-managed, device-wide, and stored through Expo SecureStore. They are sent to the corresponding Google services to make requests, not to a Frame-operated server. Localhost development can temporarily hold keys in tab memory; hosted previews disable entry. Do not present development storage copy as native behavior.
- Google account sign-in and subscription import are retired. Add a source by channel link or handle. Legacy credentials retain a disconnect/cleanup path only.
- Weekly discovery is explicitly requested, bounded, and cached per profile. Gemini proposes and assesses sources from interests and public metadata; it does not watch full videos, guarantee safety, or certify quality. Partial results and provider errors must remain truthful. See `expo/docs/BYOK.md` and `expo/docs/DISCOVERY_QUALITY.md` for limits and data handling.
- A discovery run can reveal its first three accepted picks while finishing the same bounded search. Already published picks survive interruption. Do not add automatic retries, fabricated progress, or artificial waiting to improve the presentation.
- Library topics can all be selected. Up to eight custom interests are supported; weekly focus is bounded and can prioritize topics. Source following and inclusion in Today are separate choices: Library only remains browsable.
- Today can use recent eligible uploads from followed sources; it need not wait for a new publication after installation. It is finite, with a configured maximum, source limits, and long-form eligibility. Preserve the actual policy in `expo/domain/contentPolicy.ts` and `expo/constants/productConfig.ts`.
- Official embedded YouTube playback retains its controls and fitting behavior. Frame's app chrome and room lighting must not obscure or manipulate the ready player. New videos start through an explicit viewing choice.
- Sessions are ordered viewing plans with optional pause limits; sample sessions are demonstration content, not a new user's library.
- Libraries, preferences, and viewing history are local and profile-scoped where implemented. No cloud backup is promised. Owner PIN and Managed approvals keep their existing authority.

## Viewing Time

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
incumbent visual system, and puts the explanation behind the Viewing time info button. See
[implementation and verification notes](expo/docs/VIEWING_TIME.md) for accounting
details and limits.

## Video Presentation

Frame does not display creator-written video description/About prose, including in video approval requests. Titles, sources, duration, dates, and chapter navigation remain available. Existing metadata can still supply chapter timestamps; this presentation choice adds no AI filtering, request, or cost. Source/channel descriptions are separate and remain available.

## Brand Commitments

Frame should feel cultured, educational, contemporary, and classic without luxury clichés. Approved references combine printmaking texture, etching, fine-art imagery, modern geometry, and thoughtful color. Use Frame's established identity and palette; visual implementation belongs in `DESIGN.md`.

Copy is direct, warm, and user-facing. Explain what a control changes and why it matters. Use “Today,” “source” (a creator's channel), “saved videos,” and “session” consistently. Keep provider names where setup, attribution, or disclosure requires clarity. Research screens need readable sources and accurate study scope, not universal health claims.

## Evidence on Hand

Current behavior is evidenced by source, focused tests, and the documented browser reviews. See `expo/docs/MOTION_REVIEW.md`, `expo/docs/SMOKE_TEST.md`, and `research/` for specific checks and remaining device gates. Browser screenshots are not native acceptance, mocked tests are not live API verification, and code configuration is not App Store or Play approval. Do not invent testimonials, quality guarantees, or successful release claims.

## Product Principles

- Give the viewer control over selection, playback, and stopping.
- Show real content and honest progress; separate demonstrations from personal results.
- Explain complex setup and limits at the point of need.
- Preserve local data, profile boundaries, and recoverable actions.
- Make tactile and visual feedback meaningful rather than constant.

## Accessibility & Inclusion

Keep content and actions usable with large text, screen readers, keyboard navigation, touch, and Reduce Motion. Visible focus and selected states remain alongside animation. Haptics are optional, native-only, and never the only feedback. Respect foreground/route visibility and cancellation; no effect should delay a user's action. Final gesture, haptic-strength, and playback acceptance require physical devices.
