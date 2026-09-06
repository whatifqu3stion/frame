begin;

create extension if not exists supabase_vault with schema vault;

alter table public.service_controls
  add column if not exists source_sync_batch_limit smallint not null default 5
    check (source_sync_batch_limit between 1 and 5),
  add column if not exists source_sync_success_interval_minutes integer not null default 360
    check (source_sync_success_interval_minutes between 60 and 1440),
  add column if not exists source_sync_lock_seconds integer not null default 180
    check (source_sync_lock_seconds between 30 and 900),
  add column if not exists youtube_ingestion_halted_until timestamptz,
  add column if not exists youtube_ingestion_last_error_code text
    check (
      youtube_ingestion_last_error_code is null
      or (
        char_length(youtube_ingestion_last_error_code) between 1 and 64
        and youtube_ingestion_last_error_code ~ '^[a-z][a-z0-9_]*$'
      )
    );

alter table public.media_items
  add column if not exists made_for_kids boolean;

create table if not exists public.source_sync_state (
  source_id uuid primary key references public.sources(id) on update restrict on delete restrict,
  uploads_playlist_id text check (
    uploads_playlist_id is null
    or char_length(uploads_playlist_id) between 1 and 255
  ),
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  consecutive_failures smallint not null default 0
    check (consecutive_failures between 0 and 30),
  last_error_code text check (
    last_error_code is null
    or (
      char_length(last_error_code) between 1 and 64
      and last_error_code ~ '^[a-z][a-z0-9_]*$'
    )
  ),
  claim_token uuid,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (claim_token is null and locked_until is null)
    or (claim_token is not null and locked_until is not null)
  ),
  check (last_success_at is null or last_attempt_at is not null)
);

create index if not exists source_sync_state_due_idx
  on public.source_sync_state (next_attempt_at, locked_until);

create or replace trigger source_sync_state_set_updated_at
before update on public.source_sync_state
for each row execute function public.set_updated_at();

alter table public.source_sync_state enable row level security;
alter table public.source_sync_state force row level security;
revoke all privileges on table public.source_sync_state from public, anon, authenticated;

create table if not exists public.source_sync_worker_credentials (
  id uuid primary key,
  token_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (id = '00000000-0000-0000-0000-000000000001'::uuid),
  check (token_hash ~ '^[0-9a-f]{64}$')
);

create or replace trigger source_sync_worker_credentials_set_updated_at
before update on public.source_sync_worker_credentials
for each row execute function public.set_updated_at();

alter table public.source_sync_worker_credentials enable row level security;
alter table public.source_sync_worker_credentials force row level security;
revoke all privileges on table public.source_sync_worker_credentials from public, anon, authenticated;

do $$
declare
  v_token text;
begin
  if not exists (
    select 1
    from public.source_sync_worker_credentials
    where id = '00000000-0000-0000-0000-000000000001'::uuid
  ) then
    v_token := encode(extensions.gen_random_bytes(32), 'hex');

    insert into public.source_sync_worker_credentials (id, token_hash)
    values (
      '00000000-0000-0000-0000-000000000001'::uuid,
      encode(extensions.digest(v_token, 'sha256'), 'hex')
    );

    perform vault.create_secret(
      v_token,
      'frame_source_sync_worker_token',
      'Development-only token used by the bounded Frame source scheduler.'
    );
  end if;
end;
$$;

create or replace function public.authorize_source_sync_worker(p_token text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select p_token is not null
    and char_length(p_token) = 64
    and exists (
      select 1
      from public.source_sync_worker_credentials as credentials
      where credentials.id = '00000000-0000-0000-0000-000000000001'::uuid
        and credentials.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    );
$$;

create or replace function public.claim_due_source_syncs(
  p_claim_token uuid,
  p_requested_limit integer default 5
)
returns table (
  source_id uuid,
  provider_source_id text,
  uploads_playlist_id text,
  source_metadata_fetched_at timestamptz,
  source_metadata_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_controls public.service_controls%rowtype;
  v_limit integer;
begin
  if p_claim_token is null then
    raise exception 'invalid claim token';
  end if;
  if p_requested_limit is null or p_requested_limit not between 1 and 5 then
    raise exception 'invalid requested limit';
  end if;

  select controls.*
  into v_controls
  from public.service_controls as controls
  where controls.id = '00000000-0000-0000-0000-000000000001'::uuid;

  if not found
    or v_controls.maintenance_mode
    or not v_controls.youtube_ingestion_enabled
    or (
      v_controls.youtube_ingestion_halted_until is not null
      and v_controls.youtube_ingestion_halted_until > now()
    ) then
    return;
  end if;

  v_limit := least(p_requested_limit, v_controls.source_sync_batch_limit, 5);

  with missing_state as (
    select sources.id
    from public.sources as sources
    where sources.provider = 'youtube'
      and sources.status = 'active'
      and not exists (
        select 1
        from public.source_sync_state as sync_state
        where sync_state.source_id = sources.id
      )
      and exists (
        select 1
        from public.source_demand_leases as leases
        where leases.source_id = sources.id
          and leases.expires_at > now()
      )
    order by sources.created_at, sources.id
    limit v_limit
    for update of sources skip locked
  )
  insert into public.source_sync_state (source_id, next_attempt_at)
  select missing_state.id, now()
  from missing_state
  on conflict on constraint source_sync_state_pkey do nothing;

  return query
  with due as (
    select sync_state.source_id
    from public.source_sync_state as sync_state
    join public.sources as sources on sources.id = sync_state.source_id
    where sources.provider = 'youtube'
      and sources.status = 'active'
      and sync_state.next_attempt_at <= now()
      and (
        sync_state.claim_token is null
        or sync_state.locked_until <= now()
      )
      and exists (
        select 1
        from public.source_demand_leases as leases
        where leases.source_id = sync_state.source_id
          and leases.expires_at > now()
      )
    order by sync_state.next_attempt_at, sync_state.source_id
    limit v_limit
    for update of sync_state skip locked
  ), claimed as (
    update public.source_sync_state as sync_state
    set claim_token = p_claim_token,
        locked_until = now() + make_interval(secs => v_controls.source_sync_lock_seconds),
        last_attempt_at = now(),
        updated_at = now()
    from due
    where sync_state.source_id = due.source_id
    returning sync_state.source_id,
              sync_state.uploads_playlist_id
  )
  select claimed.source_id,
         sources.provider_source_id,
         claimed.uploads_playlist_id,
         sources.metadata_fetched_at,
         sources.metadata_expires_at
  from claimed
  join public.sources as sources on sources.id = claimed.source_id
  order by claimed.source_id;
end;
$$;

create or replace function public.complete_source_sync_claim(
  p_source_id uuid,
  p_claim_token uuid,
  p_outcome text,
  p_error_code text default null,
  p_uploads_playlist_id text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_interval_minutes integer;
  v_updated_count bigint;
begin
  if p_source_id is null or p_claim_token is null then
    raise exception 'invalid claim';
  end if;
  if p_outcome not in ('success', 'transient_failure', 'definitive_not_found') then
    raise exception 'invalid sync outcome';
  end if;
  if p_error_code is not null and (
    char_length(p_error_code) not between 1 and 64
    or p_error_code !~ '^[a-z][a-z0-9_]*$'
  ) then
    raise exception 'invalid error code';
  end if;
  if p_uploads_playlist_id is not null
    and char_length(p_uploads_playlist_id) not between 1 and 255 then
    raise exception 'invalid uploads playlist id';
  end if;

  select controls.source_sync_success_interval_minutes
  into v_interval_minutes
  from public.service_controls as controls
  where controls.id = '00000000-0000-0000-0000-000000000001'::uuid;

  if p_outcome = 'success' then
    update public.source_sync_state as sync_state
    set uploads_playlist_id = coalesce(p_uploads_playlist_id, sync_state.uploads_playlist_id),
        last_success_at = now(),
        next_attempt_at = now() + make_interval(mins => v_interval_minutes),
        consecutive_failures = 0,
        last_error_code = null,
        claim_token = null,
        locked_until = null,
        updated_at = now()
    where sync_state.source_id = p_source_id
      and sync_state.claim_token = p_claim_token;
  else
    update public.source_sync_state as sync_state
    set next_attempt_at = now() + make_interval(
          secs => least(
            21600,
            300 * power(2, least(sync_state.consecutive_failures, 6))::integer
          ) + floor(random() * 61)::integer
        ),
        consecutive_failures = least(sync_state.consecutive_failures + 1, 30),
        last_error_code = coalesce(p_error_code, 'provider_unavailable'),
        claim_token = null,
        locked_until = null,
        updated_at = now()
    where sync_state.source_id = p_source_id
      and sync_state.claim_token = p_claim_token;

    get diagnostics v_updated_count = row_count;

    if p_outcome = 'definitive_not_found' and v_updated_count = 1 then
      update public.sources as sources
      set status = 'unavailable',
          updated_at = now()
      where sources.id = p_source_id;
    end if;
  end if;

  if p_outcome = 'success' then
    get diagnostics v_updated_count = row_count;
  end if;
  return v_updated_count = 1;
end;
$$;

create or replace function public.reserve_youtube_ingestion_quota(
  p_request_count integer,
  p_quota_units integer
)
returns table (
  outcome text,
  reserved_request_count integer,
  reserved_quota_units integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_controls public.service_controls%rowtype;
  v_usage_date date := (now() at time zone 'UTC')::date;
  v_current_units bigint;
begin
  if p_request_count is null or p_request_count not between 1 and 50 then
    raise exception 'invalid request count';
  end if;
  if p_quota_units is null or p_quota_units not between 1 and 1000 then
    raise exception 'invalid quota units';
  end if;

  select controls.*
  into v_controls
  from public.service_controls as controls
  where controls.id = '00000000-0000-0000-0000-000000000001'::uuid
  for update;

  if not found
    or v_controls.maintenance_mode
    or not v_controls.youtube_ingestion_enabled
    or (
      v_controls.youtube_ingestion_halted_until is not null
      and v_controls.youtube_ingestion_halted_until > now()
    ) then
    return query select 'temporarily_unavailable'::text, 0, 0;
    return;
  end if;

  insert into public.daily_provider_usage as provider_usage (
    provider,
    usage_date,
    request_count,
    estimated_quota_units
  ) values (
    'youtube',
    v_usage_date,
    0,
    0
  ) on conflict on constraint daily_provider_usage_provider_date_key do nothing;

  select provider_usage.estimated_quota_units
  into v_current_units
  from public.daily_provider_usage as provider_usage
  where provider_usage.provider = 'youtube'
    and provider_usage.usage_date = v_usage_date
  for update;

  if v_current_units + p_quota_units
      > v_controls.daily_youtube_unit_ceiling - v_controls.reserved_safety_units then
    update public.service_controls
    set youtube_ingestion_halted_until = date_trunc('day', now() at time zone 'UTC')
          + interval '1 day',
        youtube_ingestion_last_error_code = 'provider_quota_reserved',
        updated_at = now()
    where id = v_controls.id;

    return query select 'quota_exhausted'::text, 0, 0;
    return;
  end if;

  update public.daily_provider_usage as provider_usage
  set request_count = provider_usage.request_count + p_request_count,
      estimated_quota_units = provider_usage.estimated_quota_units + p_quota_units,
      updated_at = now()
  where provider_usage.provider = 'youtube'
    and provider_usage.usage_date = v_usage_date;

  return query select 'reserved'::text, p_request_count, p_quota_units;
end;
$$;

create or replace function public.record_youtube_ingestion_halt(
  p_error_code text,
  p_halted_until timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated_count bigint;
begin
  if p_error_code not in ('provider_auth', 'provider_quota', 'provider_circuit_open') then
    raise exception 'invalid ingestion halt code';
  end if;
  if p_halted_until is null
    or p_halted_until <= now()
    or p_halted_until > now() + interval '24 hours' then
    raise exception 'invalid ingestion halt duration';
  end if;

  update public.service_controls as controls
  set youtube_ingestion_halted_until = greatest(
        coalesce(controls.youtube_ingestion_halted_until, p_halted_until),
        p_halted_until
      ),
      youtube_ingestion_last_error_code = p_error_code,
      updated_at = now()
  where controls.id = '00000000-0000-0000-0000-000000000001'::uuid;

  get diagnostics v_updated_count = row_count;
  return v_updated_count = 1;
end;
$$;

create or replace function public.expire_stale_youtube_metadata(
  p_limit integer default 50
)
returns table (
  expired_media_count bigint,
  expired_source_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_media_count bigint;
  v_source_count bigint;
begin
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception 'invalid maintenance limit';
  end if;

  with stale_media as (
    select media.id
    from public.media_items as media
    where media.provider = 'youtube'
      and media.metadata_fetched_at < now() - interval '30 days'
    order by media.metadata_fetched_at, media.id
    limit p_limit
    for update of media skip locked
  )
  update public.media_items as media
  set title = 'Unavailable video',
      description = '',
      thumbnail_url = null,
      published_at = null,
      duration_seconds = null,
      is_livestream = false,
      is_upcoming_premiere = false,
      made_for_kids = null,
      status = 'unavailable',
      metadata_fetched_at = null,
      metadata_expires_at = null,
      updated_at = now()
  from stale_media
  where media.id = stale_media.id;
  get diagnostics v_media_count = row_count;

  with stale_sources as (
    select sources.id
    from public.sources as sources
    where sources.provider = 'youtube'
      and sources.metadata_fetched_at < now() - interval '30 days'
    order by sources.metadata_fetched_at, sources.id
    limit p_limit
    for update of sources skip locked
  )
  update public.sources as sources
  set handle = null,
      display_name = 'YouTube source',
      description = '',
      thumbnail_url = null,
      metadata_fetched_at = null,
      metadata_expires_at = null,
      updated_at = now()
  from stale_sources
  where sources.id = stale_sources.id;
  get diagnostics v_source_count = row_count;

  return query select v_media_count, v_source_count;
end;
$$;

revoke execute on function public.authorize_source_sync_worker(text) from public, anon, authenticated;
revoke execute on function public.claim_due_source_syncs(uuid, integer) from public, anon, authenticated;
revoke execute on function public.complete_source_sync_claim(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.reserve_youtube_ingestion_quota(integer, integer) from public, anon, authenticated;
revoke execute on function public.record_youtube_ingestion_halt(text, timestamptz) from public, anon, authenticated;
revoke execute on function public.expire_stale_youtube_metadata(integer) from public, anon, authenticated;

grant execute on function public.authorize_source_sync_worker(text) to service_role;
grant execute on function public.claim_due_source_syncs(uuid, integer) to service_role;
grant execute on function public.complete_source_sync_claim(uuid, uuid, text, text, text) to service_role;
grant execute on function public.reserve_youtube_ingestion_quota(integer, integer) to service_role;
grant execute on function public.record_youtube_ingestion_halt(text, timestamptz) to service_role;
grant execute on function public.expire_stale_youtube_metadata(integer) to service_role;

commit;
