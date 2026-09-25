begin;

alter table public.service_controls
  add column if not exists deep_find_enabled boolean not null default false,
  add column if not exists deep_find_daily_search_ceiling integer not null default 10
    check (deep_find_daily_search_ceiling between 1 and 75),
  add column if not exists deep_find_monthly_entitlement_ceiling integer not null default 3
    check (deep_find_monthly_entitlement_ceiling between 1 and 3);

create table if not exists public.deep_find_monthly_usage (
  installation_token_hash text not null check (installation_token_hash ~ '^[0-9a-f]{64}$'),
  period_start date not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (installation_token_hash, period_start)
);

create table if not exists public.deep_find_reservations (
  id uuid primary key default gen_random_uuid(),
  installation_token_hash text not null check (installation_token_hash ~ '^[0-9a-f]{64}$'),
  period_start date not null,
  state text not null default 'reserved' check (state in ('reserved', 'released')),
  created_at timestamptz not null default now()
);

create index if not exists deep_find_reservations_period_idx
  on public.deep_find_reservations (period_start);

alter table public.deep_find_monthly_usage enable row level security;
alter table public.deep_find_monthly_usage force row level security;
alter table public.deep_find_reservations enable row level security;
alter table public.deep_find_reservations force row level security;
revoke all on public.deep_find_monthly_usage, public.deep_find_reservations from public, anon, authenticated;

-- The caller must verify this exact high-entropy installation identity against
-- RevenueCat immediately before invoking this service-role-only function.
create or replace function public.reserve_paid_deep_find(p_installation_token text)
returns table (outcome text, remaining integer, reset_at timestamptz, reservation_id uuid)
language plpgsql security definer set search_path = ''
as $$
declare
  v_controls public.service_controls%rowtype;
  v_hash text;
  v_period date := date_trunc('month', now() at time zone 'UTC')::date;
  v_reset timestamptz := (date_trunc('month', now() at time zone 'UTC') + interval '1 month') at time zone 'UTC';
  v_day date := (now() at time zone 'UTC')::date;
  v_youtube_day date := public.youtube_quota_date();
  v_monthly_count integer;
  v_daily_count bigint;
  v_youtube_units bigint;
  v_reservation uuid;
begin
  if p_installation_token is null or p_installation_token !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid installation identity';
  end if;
  v_hash := encode(extensions.digest(p_installation_token, 'sha256'), 'hex');

  select controls.* into v_controls from public.service_controls as controls
  where controls.id = '00000000-0000-0000-0000-000000000001'::uuid for update;
  if not found or v_controls.maintenance_mode or not v_controls.deep_find_enabled
    or v_controls.youtube_ingestion_halted_until > now() then
    return query select 'disabled'::text, 0, v_reset, null::uuid; return;
  end if;

  insert into public.deep_find_monthly_usage (installation_token_hash, period_start)
  values (v_hash, v_period) on conflict do nothing;
  select usage.request_count into v_monthly_count from public.deep_find_monthly_usage as usage
  where usage.installation_token_hash = v_hash and usage.period_start = v_period for update;
  if v_monthly_count >= v_controls.deep_find_monthly_entitlement_ceiling then
    return query select 'allowance_exhausted'::text, 0, v_reset, null::uuid; return;
  end if;

  insert into public.daily_provider_usage (provider, usage_date, request_count, estimated_quota_units)
  values ('youtube_search', v_day, 0, 0)
  on conflict on constraint daily_provider_usage_provider_date_key do nothing;
  select usage.request_count into v_daily_count from public.daily_provider_usage as usage
  where usage.provider = 'youtube_search' and usage.usage_date = v_day for update;
  if v_daily_count >= v_controls.deep_find_daily_search_ceiling then
    return query select 'quota_exhausted'::text,
      v_controls.deep_find_monthly_entitlement_ceiling - v_monthly_count, v_reset, null::uuid; return;
  end if;

  -- Search Queries has its own daily bucket (bounded above). Reserve one
  -- provider-wide unit for channel verification even if search finds nothing.
  insert into public.daily_provider_usage (provider, usage_date, request_count, estimated_quota_units)
  values ('youtube', v_youtube_day, 0, 0)
  on conflict on constraint daily_provider_usage_provider_date_key do nothing;
  select usage.estimated_quota_units into v_youtube_units from public.daily_provider_usage as usage
  where usage.provider = 'youtube' and usage.usage_date = v_youtube_day for update;
  if v_youtube_units + 1 > v_controls.daily_youtube_unit_ceiling - v_controls.reserved_safety_units then
    return query select 'quota_exhausted'::text,
      v_controls.deep_find_monthly_entitlement_ceiling - v_monthly_count, v_reset, null::uuid; return;
  end if;

  update public.deep_find_monthly_usage as usage
  set request_count = usage.request_count + 1, updated_at = now()
  where usage.installation_token_hash = v_hash and usage.period_start = v_period;
  update public.daily_provider_usage as usage
  set request_count = usage.request_count + 1,
      estimated_quota_units = usage.estimated_quota_units + 1,
      updated_at = now()
  where usage.provider = 'youtube_search' and usage.usage_date = v_day;
  update public.daily_provider_usage as usage
  set request_count = usage.request_count + 1,
      estimated_quota_units = usage.estimated_quota_units + 1,
      updated_at = now()
  where usage.provider = 'youtube' and usage.usage_date = v_youtube_day;
  insert into public.deep_find_reservations (installation_token_hash, period_start)
  values (v_hash, v_period) returning id into v_reservation;
  return query select 'reserved'::text,
    v_controls.deep_find_monthly_entitlement_ceiling - v_monthly_count - 1, v_reset, v_reservation;
end;
$$;

-- Release only when Gemini fails before the provider search begins. The daily
-- global allocation stays consumed so failures cannot trigger retry storms.
create or replace function public.release_paid_deep_find(
  p_installation_token text, p_reservation_id uuid
)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_hash text;
  v_period date;
begin
  if p_installation_token is null or p_installation_token !~ '^[0-9a-f]{64}$'
    or p_reservation_id is null then return false; end if;
  v_hash := encode(extensions.digest(p_installation_token, 'sha256'), 'hex');
  update public.deep_find_reservations as reservation
  set state = 'released'
  where reservation.id = p_reservation_id
    and reservation.installation_token_hash = v_hash
    and reservation.state = 'reserved'
  returning reservation.period_start into v_period;
  if not found then return false; end if;
  update public.deep_find_monthly_usage as usage
  set request_count = usage.request_count - 1, updated_at = now()
  where usage.installation_token_hash = v_hash and usage.period_start = v_period
    and usage.request_count > 0;
  return true;
end;
$$;

create or replace function public.paid_deep_find_remaining(p_installation_token text)
returns table (remaining integer, reset_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  v_controls public.service_controls%rowtype;
  v_count integer;
  v_period date := date_trunc('month', now() at time zone 'UTC')::date;
begin
  if p_installation_token is null or p_installation_token !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid installation identity';
  end if;
  select controls.* into v_controls from public.service_controls as controls
  where controls.id = '00000000-0000-0000-0000-000000000001'::uuid;
  if not found then return; end if;
  select usage.request_count into v_count from public.deep_find_monthly_usage as usage
  where usage.installation_token_hash = encode(extensions.digest(p_installation_token, 'sha256'), 'hex')
    and usage.period_start = v_period;
  return query select greatest(0, v_controls.deep_find_monthly_entitlement_ceiling - coalesce(v_count, 0)),
    (date_trunc('month', now() at time zone 'UTC') + interval '1 month') at time zone 'UTC';
end;
$$;

revoke all on function public.reserve_paid_deep_find(text),
  public.release_paid_deep_find(text, uuid), public.paid_deep_find_remaining(text)
  from public, anon, authenticated;
grant execute on function public.reserve_paid_deep_find(text),
  public.release_paid_deep_find(text, uuid), public.paid_deep_find_remaining(text) to service_role;

commit;
