begin;

create or replace function public.youtube_quota_date(p_now timestamptz default now())
returns date language sql stable set search_path = '' as $$
  select (p_now at time zone 'America/Los_Angeles')::date;
$$;

create or replace function public.next_youtube_quota_reset(p_now timestamptz default now())
returns timestamptz language sql stable set search_path = '' as $$
  select ((p_now at time zone 'America/Los_Angeles')::date + 1)::timestamp
    at time zone 'America/Los_Angeles';
$$;

-- Retain historical counters unchanged. Block new provider reservations through the
-- first Pacific reset instead of granting a second budget during the UTC cutover.
update public.service_controls
set youtube_ingestion_halted_until = greatest(coalesce(youtube_ingestion_halted_until, now()), public.next_youtube_quota_reset()),
    youtube_ingestion_last_error_code = 'quota_timezone_transition'
where id = '00000000-0000-0000-0000-000000000001'::uuid;

create or replace function public.increment_daily_provider_usage(
  p_provider text, p_request_count bigint default 1, p_estimated_quota_units bigint default 0
)
returns table (provider text, usage_date date, request_count bigint, estimated_quota_units bigint, updated_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_usage_date date := case when p_provider = 'youtube' then public.youtube_quota_date() else (now() at time zone 'UTC')::date end;
begin
  if p_provider is null or p_provider !~ '^[a-z][a-z0-9_-]{1,63}$' then raise exception 'invalid provider'; end if;
  if p_request_count is null or p_estimated_quota_units is null or p_request_count < 0 or p_estimated_quota_units < 0 then
    raise exception 'usage increments must be nonnegative';
  end if;
  -- Same lock ordering as reservations prevents accounting/ceiling races.
  perform 1 from public.service_controls where id = '00000000-0000-0000-0000-000000000001'::uuid for update;
  return query
  insert into public.daily_provider_usage as usage (provider, usage_date, request_count, estimated_quota_units)
  values (p_provider, v_usage_date, p_request_count, p_estimated_quota_units)
  on conflict on constraint daily_provider_usage_provider_date_key do update
    set request_count = usage.request_count + excluded.request_count,
        estimated_quota_units = usage.estimated_quota_units + excluded.estimated_quota_units,
        updated_at = now()
  returning usage.provider, usage.usage_date, usage.request_count, usage.estimated_quota_units, usage.updated_at;
end;
$$;

create or replace function public.reserve_source_resolution_quota(p_installation_token text, p_provider_call_count integer)
returns table (outcome text, reserved_provider_calls integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_control public.service_controls%rowtype;
  v_usage_date date := public.youtube_quota_date();
  v_installation_hash text;
  v_installation_count integer;
  v_provider_count bigint;
begin
  if p_installation_token is null or p_installation_token !~ '^[0-9a-f]{64}$' then raise exception 'invalid installation token'; end if;
  if p_provider_call_count is null or p_provider_call_count not between 1 and 2 then raise exception 'invalid provider call count'; end if;
  v_installation_hash := encode(extensions.digest(p_installation_token, 'sha256'), 'hex');
  select controls.* into v_control from public.service_controls as controls
    where controls.id = '00000000-0000-0000-0000-000000000001'::uuid for update;
  if not found or v_control.maintenance_mode or not v_control.source_resolution_enabled
      or v_control.youtube_ingestion_halted_until > now() then
    return query select 'temporarily_unavailable'::text, 0; return;
  end if;
  insert into public.daily_installation_action_usage (installation_token_hash, action_type, usage_date, provider_call_count)
    values (v_installation_hash, 'source_resolution', v_usage_date, 0)
    on conflict on constraint daily_installation_action_usage_pkey do nothing;
  select u.provider_call_count into v_installation_count from public.daily_installation_action_usage as u
    where u.installation_token_hash = v_installation_hash and u.action_type = 'source_resolution' and u.usage_date = v_usage_date for update;
  if v_installation_count + p_provider_call_count > v_control.source_resolution_daily_installation_call_limit then
    return query select 'allowance_exhausted'::text, 0; return;
  end if;
  insert into public.daily_provider_usage (provider, usage_date, request_count, estimated_quota_units)
    values ('youtube', v_usage_date, 0, 0) on conflict on constraint daily_provider_usage_provider_date_key do nothing;
  select u.estimated_quota_units into v_provider_count from public.daily_provider_usage as u
    where u.provider = 'youtube' and u.usage_date = v_usage_date for update;
  if v_provider_count + p_provider_call_count > v_control.daily_youtube_unit_ceiling - v_control.reserved_safety_units then
    return query select 'quota_exhausted'::text, 0; return;
  end if;
  update public.daily_installation_action_usage as u set provider_call_count = u.provider_call_count + p_provider_call_count, updated_at = now()
    where u.installation_token_hash = v_installation_hash and u.action_type = 'source_resolution' and u.usage_date = v_usage_date;
  update public.daily_provider_usage as u set request_count = u.request_count + p_provider_call_count,
    estimated_quota_units = u.estimated_quota_units + p_provider_call_count, updated_at = now()
    where u.provider = 'youtube' and u.usage_date = v_usage_date;
  return query select 'reserved'::text, p_provider_call_count;
end;
$$;

create or replace function public.reserve_youtube_ingestion_quota(p_request_count integer, p_quota_units integer)
returns table (outcome text, reserved_request_count integer, reserved_quota_units integer)
language plpgsql security definer set search_path = '' as $$
declare
  v_controls public.service_controls%rowtype;
  v_usage_date date := public.youtube_quota_date();
  v_current_units bigint;
begin
  if p_request_count is null or p_request_count not between 1 and 50 then raise exception 'invalid request count'; end if;
  if p_quota_units is null or p_quota_units not between 1 and 1000 then raise exception 'invalid quota units'; end if;
  select controls.* into v_controls from public.service_controls as controls
    where controls.id = '00000000-0000-0000-0000-000000000001'::uuid for update;
  if not found or v_controls.maintenance_mode or not v_controls.youtube_ingestion_enabled
      or v_controls.youtube_ingestion_halted_until > now() then
    return query select 'temporarily_unavailable'::text, 0, 0; return;
  end if;
  insert into public.daily_provider_usage (provider, usage_date, request_count, estimated_quota_units)
    values ('youtube', v_usage_date, 0, 0) on conflict on constraint daily_provider_usage_provider_date_key do nothing;
  select u.estimated_quota_units into v_current_units from public.daily_provider_usage as u
    where u.provider = 'youtube' and u.usage_date = v_usage_date for update;
  if v_current_units + p_quota_units > v_controls.daily_youtube_unit_ceiling - v_controls.reserved_safety_units then
    update public.service_controls set youtube_ingestion_halted_until = public.next_youtube_quota_reset(),
      youtube_ingestion_last_error_code = 'provider_quota_reserved', updated_at = now() where id = v_controls.id;
    return query select 'quota_exhausted'::text, 0, 0; return;
  end if;
  update public.daily_provider_usage as u set request_count = u.request_count + p_request_count,
    estimated_quota_units = u.estimated_quota_units + p_quota_units, updated_at = now()
    where u.provider = 'youtube' and u.usage_date = v_usage_date;
  return query select 'reserved'::text, p_request_count, p_quota_units;
end;
$$;

create or replace function public.record_youtube_ingestion_halt(p_error_code text, p_halted_until timestamptz)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_updated_count bigint;
  v_until timestamptz;
begin
  if p_error_code is null or p_error_code not in ('provider_auth', 'provider_quota', 'provider_circuit_open') then raise exception 'invalid ingestion halt code'; end if;
  if p_halted_until is null or p_halted_until <= now() or p_halted_until > now() + interval '25 hours' then raise exception 'invalid ingestion halt duration'; end if;
  v_until := case when p_error_code = 'provider_quota' then public.next_youtube_quota_reset() else p_halted_until end;
  update public.service_controls as controls set youtube_ingestion_halted_until = greatest(coalesce(controls.youtube_ingestion_halted_until, v_until), v_until),
    youtube_ingestion_last_error_code = p_error_code, updated_at = now()
    where controls.id = '00000000-0000-0000-0000-000000000001'::uuid;
  get diagnostics v_updated_count = row_count;
  return v_updated_count = 1;
end;
$$;

revoke execute on function public.youtube_quota_date(timestamptz), public.next_youtube_quota_reset(timestamptz), public.increment_daily_provider_usage(text,bigint,bigint), public.reserve_source_resolution_quota(text,integer), public.reserve_youtube_ingestion_quota(integer,integer), public.record_youtube_ingestion_halt(text,timestamptz) from public, anon, authenticated;
grant execute on function public.youtube_quota_date(timestamptz), public.next_youtube_quota_reset(timestamptz), public.increment_daily_provider_usage(text,bigint,bigint), public.reserve_source_resolution_quota(text,integer), public.reserve_youtube_ingestion_quota(integer,integer), public.record_youtube_ingestion_halt(text,timestamptz) to service_role;

-- Pure SQL acceptance checks roll the migration back if timezone semantics regress.
do $$
begin
  if public.youtube_quota_date('2026-09-14 06:59:59+00') <> date '2026-09-13'
    or public.youtube_quota_date('2026-09-14 07:00:00+00') <> date '2026-09-14'
    or public.next_youtube_quota_reset('2026-03-08 08:00:00+00') <> timestamptz '2026-03-09 07:00:00+00'
    or public.next_youtube_quota_reset('2026-11-01 07:00:00+00') <> timestamptz '2026-11-02 08:00:00+00'
    or public.youtube_quota_date('2026-01-01 07:59:59+00') <> date '2025-12-31' then
    raise exception 'Pacific quota boundary regression';
  end if;
end;
$$;
commit;
