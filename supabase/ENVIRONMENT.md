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

## Reviewed Weekly Picks publication

`prepare-weekly-picks.ts` and the protected drafting endpoint remain unable to publish. After editorial review, create a JSON file containing only this public contract:

```json
{
  "periodStart": "2026-09-28",
  "periodEnd": "2026-10-04",
  "publications": [
    {
      "interestId": "tech",
      "picks": [
        {
          "sourceId": "11111111-1111-4111-8111-111111111111",
          "featuredMediaItemId": "22222222-2222-4222-8222-222222222222",
          "reason": "A calm, specific explanation of why this source is useful this week."
        }
      ]
    }
  ]
}
```

First run a dry review. It validates the file and prints a confirmation fingerprint bound to the exact normalized payload and target project:

```sh
deno run --allow-read=reviewed-weekly-picks.json supabase/publish-weekly-picks.ts \
  --file=reviewed-weekly-picks.json \
  --project-ref=your-project-ref
```

Only after checking that output, re-run with `--execute` and the exact emitted `--confirm` value:

```sh
deno run \
  --allow-read=reviewed-weekly-picks.json \
  --allow-env=SUPABASE_URL,SUPABASE_SECRET_KEY,SUPABASE_SERVICE_ROLE_KEY \
  --allow-net=your-project-ref.supabase.co \
  supabase/publish-weekly-picks.ts \
  --file=reviewed-weekly-picks.json \
  --project-ref=your-project-ref \
  --execute \
  --confirm='publish:your-project-ref:2026-09-28:fingerprint-from-dry-run'
```

Execution requires `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (or the legacy service-role key) in the operator environment. The project reference must match the URL. The database publishes the whole multi-interest batch in one transaction or rolls it all back. If the command loses its response, verify the period before retrying; never infer failure from a missing confirmation.
