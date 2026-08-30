# Frame shared-backend environment

Use separate Supabase projects for development, staging, and production. This repository does not contain credentials and this slice does not provision or modify a remote project.

## Client-safe

These values may be exposed to a future mobile client, but Round 2A does not connect the app:

- `EXPO_PUBLIC_SUPABASE_URL` — environment-specific Supabase project URL.
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — current publishable key (`sb_publishable_...`).
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — legacy fallback only when required by older Supabase tooling.

A publishable or legacy anon key does not grant direct catalog access because all shared tables use RLS and direct anonymous/authenticated privileges are revoked.

## Server-only

These values must exist only in the Edge Function or trusted server environment:

- `SUPABASE_SECRET_KEY` — current secret key (`sb_secret_...`) for bounded server reads.
- `SUPABASE_SERVICE_ROLE_KEY` — legacy/tooling fallback automatically supplied by Supabase when a secret key is unavailable.
- `YOUTUBE_API_KEY` — reserved for a later ingestion slice; unused by Weekly Picks.

Never place server-only values in Expo public variables, mobile code, logs, URLs, query strings, or committed files. Apply migrations and deploy the function to development or staging first. Production application and deployment require a separate explicit release step.
