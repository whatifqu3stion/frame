# Frame shared-backend environment

Use separate Supabase projects for development, staging, and production. This repository does not contain credentials and this slice does not provision or modify a remote project.

## Client-safe

These values may be exposed to the mobile client when Weekly Picks is connected:

- `EXPO_PUBLIC_SUPABASE_URL` — environment-specific Supabase project URL.
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — current publishable key (`sb_publishable_...`).
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — legacy fallback only when required by older Supabase tooling.

The Weekly Picks function requires the client key in its `apikey` header. The key identifies an allowed app client; it is not a secret. Direct catalog access remains closed because every shared table uses RLS and anonymous/authenticated table privileges are revoked.

## Edge Function environment

Hosted Supabase projects may expose current keys as JSON maps. The function supports those current names and singular/legacy fallbacks:

- `SUPABASE_PUBLISHABLE_KEYS` — current JSON map of accepted public keys.
- `SUPABASE_SECRET_KEYS` — current JSON map of server-only secret keys.
- `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` — singular development or manually configured values.
- `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` — legacy/tooling fallbacks.
- `SUPABASE_URL` — automatically supplied project URL.
- `YOUTUBE_API_KEY` — reserved for a later ingestion slice; unused by Weekly Picks.

Because `verify_jwt = false` is required for current publishable-key clients, the function performs its own `apikey` validation before any database read. Never place secret or service-role values in Expo public variables, mobile code, logs, URLs, query strings, or committed files.

Apply migrations and deploy the function to development or staging first. Production application and deployment require a separate explicit release step.
