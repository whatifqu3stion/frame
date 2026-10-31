# Frame

**Worth watching. At your pace.**

Frame is a mobile app for collecting videos from creators you choose and watching them in short, deliberate sessions.

The product question is simple: can a video app make it easier to find something worthwhile, keep it for later, and reach a satisfying stopping point?

## Preview

<img src="docs/previews/onboarding.jpg" alt="Frame onboarding with Technology selected and a bounded interest-selection workflow" width="320" />

Interest selection in Frame's onboarding, rendered from the Expo web app at a phone-sized viewport. This is a local interface preview; native playback and real-device acceptance are separate checks.

[Capture notes](docs/previews/README.md) record the source revision and demo conditions.

## The experience

- **Today:** a bounded daily selection from followed sources.
- **Sources:** creators you choose, with optional weekly suggestions.
- **Saved:** a personal collection of videos to return to.
- **Sessions:** an ordered viewing plan with an ending.
- **Profiles:** separate collections and viewing boundaries, including Owner approval for Managed profiles.

Today is designed to stay stable during the day rather than refill as items are handled. The selection logic uses a 4 a.m. local reset, at most 12 videos, and at most two from each source.

## Current status

**Active development project preparing for native acceptance testing.** The repository contains the mobile app, backend code, automated checks, and detailed release checklists.

A source-level implementation or passing automated test does not establish that the native experience is ready to ship. Real-device visual, accessibility, motion, and playback checks remain part of the [acceptance plan](expo/docs/SMOKE_TEST.md).

This branch is the full-access BYOK edition: no subscription tiers or paywalls. Owners configure their own YouTube and optional Gemini keys in Settings → Your API keys. See [BYOK setup and security](expo/docs/BYOK.md).

## Design decisions

Frame uses a restrained visual language, recognizable creator imagery, clear actions, and explicit endings. Its [design specification](DESIGN.md) records the component system, terminology, accessibility considerations, and rationale.

Profiles and viewing policy are separated from presentation. The daily-selection algorithm is also separate from its screen, making rules such as source limits and snoozed returns directly testable.

## Explore the repository

| Area | Start here |
| --- | --- |
| Mobile app and local development | [expo/README.md](expo/README.md) |
| Visual language and product voice | [DESIGN.md](DESIGN.md) |
| Daily-selection rules | [Today domain logic](expo/domain/today.ts) |
| Environment separation | [Environment guide](expo/docs/ENVIRONMENTS.md) |
| Native release checks | [Acceptance plan](expo/docs/SMOKE_TEST.md) |
| Backend work | [backend/](backend), [functions/](functions), [supabase/](supabase) |

**Stack:** React Native · Expo Router · TypeScript · SQLite · backend services.

Development is assisted by Rork and AI tools. The checked-in rules, tests, design decisions, and remaining acceptance work describe the project more accurately than a claim of production readiness.
