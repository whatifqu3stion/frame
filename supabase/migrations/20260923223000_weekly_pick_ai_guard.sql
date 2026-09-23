begin;

alter table public.service_controls
  add column if not exists weekly_pick_ai_enabled boolean not null default false,
  add column if not exists daily_weekly_pick_ai_request_ceiling integer not null default 5
    check (daily_weekly_pick_ai_request_ceiling between 1 and 50);

create or replace function public.reserve_weekly_pick_ai_request()
returns table (
  outcome text,
  reserved_requests integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_controls public.service_controls%rowtype;
  v_usage_date date := (now() at time zone 'UTC')::date;
  v_request_count bigint;
begin
  select controls.*
  into v_controls
  from public.service_controls as controls
  where controls.id = '00000000-0000-0000-0000-000000000001'::uuid
  for update;

  if not found
    or v_controls.maintenance_mode
    or not v_controls.weekly_picks_enabled
    or not v_controls.weekly_pick_ai_enabled then
    return query select 'disabled'::text, 0;
    return;
  end if;

  insert into public.daily_provider_usage (
    provider,
    usage_date,
    request_count,
    estimated_quota_units
  ) values (
    'gemini_weekly_picks',
    v_usage_date,
    0,
    0
  ) on conflict on constraint daily_provider_usage_provider_date_key do nothing;

  select usage.request_count
  into v_request_count
  from public.daily_provider_usage as usage
  where usage.provider = 'gemini_weekly_picks'
    and usage.usage_date = v_usage_date
  for update;

  if v_request_count >= v_controls.daily_weekly_pick_ai_request_ceiling then
    return query select 'quota_exhausted'::text, 0;
    return;
  end if;

  update public.daily_provider_usage as usage
  set request_count = usage.request_count + 1,
      estimated_quota_units = usage.estimated_quota_units + 1,
      updated_at = now()
  where usage.provider = 'gemini_weekly_picks'
    and usage.usage_date = v_usage_date;

  return query select 'reserved'::text, 1;
end;
$$;

comment on function public.reserve_weekly_pick_ai_request() is
  'Atomically reserves one bounded server-side Weekly Picks drafting request. No client execution.';

revoke all on function public.reserve_weekly_pick_ai_request() from public, anon, authenticated;
grant execute on function public.reserve_weekly_pick_ai_request() to service_role;

commit;
