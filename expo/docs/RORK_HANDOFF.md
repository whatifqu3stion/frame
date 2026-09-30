# Frame ownership handoff

This boundary is derived from the agreed Frame feature-set prompt and remains the working split for the pre-launch passes.

## Completed in code

- Four-tab product shell: Today, Sources, Saved, Settings.
- Finite Today with local actions and a real stopping point.
- Profile-scoped Owner, Standard, and Managed state.
- Owner PIN boundary and protected callbacks.
- Daily allowances, viewing windows, quiet hours, session limits/breaks, and Pause Frame.
- Managed Selected Videos, Approved Sources, and local approval requests.
- One-to-three-video Sessions with explicit continuation.
- Selective Google subscription import.
- Shared cached Sources and finite Weekly Picks.
- Guarded deterministic and Gemini-assisted Weekly Picks drafting.
- Human-reviewed, project-bound, atomic Weekly Picks publication workflow.
- Local reset, metadata retention, diagnostics, and automated safety tests.
- App-wide visual refinement, restrained programme grain, clearer copy, conversion-focused onboarding and a clearly labelled demo Premium surface.
- Purposeful motion, reduced-motion handling and optional semantic haptics.
- Mobile UX corrections: edit preservation, hierarchical Back, keyboard handling, control sizing and clear save actions.

## Rork owns next

- Connect the existing Expo project to Rork/EAS without rewriting product logic.
- Configure native iOS/Android projects, development clients, signing, provisioning, and cloud build profiles.
- Produce installable iOS and Android development/staging builds.
- Run the native checklist in `SMOKE_TEST.md` and attach screenshots/recordings.
- Fix native-only presentation issues: safe areas, keyboard behavior, time pickers, back gestures, orientation, and device-specific layout.
- Validate the completed design, copy, onboarding and motion passes on real devices; prepare store-facing assets/metadata and the eventual production purchase surface.

## Codex retains

- Domain and product-policy logic.
- SQLite migrations, profile isolation, and destructive-data boundaries.
- Supabase functions, migrations, operational workflows, and security rules.
- Automated regression tests and release-contract checks.
- Environment/configuration review, including final bundle identifiers and secret/public-variable separation.
- Later paywall entitlement correctness, restore-state logic, and tests.

## Shared checkpoints

- Bundle identifiers and environment names are chosen once and reviewed before signed builds.
- Rork may wire RevenueCat’s native/store surface later; Codex verifies entitlement behavior and failure states before release.
- Any Rork-generated native change that affects playback, persistence, profiles, Managed access, networking, or reset behavior returns for code review and automated validation.

## Explicitly deferred

- Paid-access activation and paywall launch.
- Deep Find or broad search.
- Remote approvals/notifications and cloud profile sync.
- Unreviewed or automatic Weekly Picks publication.


## Current design handoff

Integration: PR #18 brings `codex/frame-design-refinement` into `main`, including the design, copy, onboarding, motion and mobile UX implementation passes. The user authorized this integration on September 30. Rork should use the resulting `main` revision; its tracked branch and automatic sync behavior have not been verified here. Confirm the checked-out revision before reviewing the preview. Historical audit records retain their original draft-PR status.

Start with `MOBILE_UX_AUDIT.md` and `MOTION_AND_HAPTICS_REVIEW.md`, then run `SMOKE_TEST.md`. Prioritize edited-session Back/swipe dismissal and failed-save recovery; profile editor Back/Cancel/X and authorization expiry; first-run versus replay Android Back; import typing, first-tap selection and dock reachability; narrow-screen large text; accessibility escape and Reduced Motion. Capture the real app in light and dark appearances. The build must retain `paidAccess: false` and `demoPaywall: true` for this demo.
