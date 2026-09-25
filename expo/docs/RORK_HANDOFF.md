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

## Rork owns next

- Connect the existing Expo project to Rork/EAS without rewriting product logic.
- Configure native iOS/Android projects, development clients, signing, provisioning, and cloud build profiles.
- Produce installable iOS and Android development/staging builds.
- Run the native checklist in `SMOKE_TEST.md` and attach screenshots/recordings.
- Fix native-only presentation issues: safe areas, keyboard behavior, time pickers, back gestures, orientation, and device-specific layout.
- Connect RevenueCat Test Store to native development builds and verify purchase, restore, expiry, and both device layouts with the Codex entitlement contract.
- Later, execute the graphic-design pass, broad copy-edit pass, store-facing assets/metadata, and visual purchase polish.

## Codex retains

- Domain and product-policy logic.
- SQLite migrations, profile isolation, and destructive-data boundaries.
- Supabase functions, migrations, operational workflows, and security rules.
- Automated regression tests and release-contract checks.
- Environment/configuration review, including final bundle identifiers and secret/public-variable separation.
- Day-one Premium capability logic, paid Deep Find, server-side entitlement verification and allowances, restore-state logic, and tests.

## Shared checkpoints

- Bundle identifiers and environment names are chosen once and reviewed before signed builds.
- Rork wires RevenueCat’s native/store surface for test builds; Codex verifies entitlement behavior and failure states before release.
- Any Rork-generated native change that affects playback, persistence, profiles, Managed access, networking, or reset behavior returns for code review and automated validation.

## Explicitly deferred

- Graphic design and visual polish.
- Broad text/copy editing.
- Remote approvals/notifications and cloud profile sync.
- Unreviewed or automatic Weekly Picks publication.
