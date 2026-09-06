alter table public.service_controls
  add column if not exists source_resolution_enabled boolean not null default false,
  add column if not exists source_resolution_daily_installation_call_limit integer not null default 10
    check (source_resolution_daily_installation_call_limit between 1 and 1000);

create table if not exists public.daily_installation_action_usage (
  installation_token_hash text not null,
  action_type text not null,
  usage_date date not null,
  provider_call_count integer not null default 0 check (provider_call_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (installation_token_hash, action_type, usage_date),
  constraint daily_installation_action_usage_token_hash_check
    check (installation_token_hash ~ '^[0-9a-f]{64}$'),
  constraint daily_installation_action_usage_action_check
    check (action_type in ('source_resolution'))
);

create index if not exists daily_installation_action_usage_date_idx
  on public.daily_installation_action_usage (usage_date);

create or replace trigger daily_installation_action_usage_set_updated_at
before update on public.daily_installation_action_usage
for each row execute function public.set_updated_at();

alter table public.daily_installation_action_usage enable row level security;
alter table public.daily_installation_action_usage force row level security;

revoke all privileges on table public.daily_installation_action_usage from public, anon, authenticated;

create or replace function public.reserve_source_resolution_quota(
  p_installation_token text,
  p_provider_call_count integer
)
returns table (
  outcome text,
  reserved_provider_calls integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_control public.service_controls%rowtype;
  v_usage_date date := (now() at time zone 'UTC')::date;
  v_installation_hash text;
  v_installation_count integer;
  v_provider_count bigint;
begin
  if p_installation_token is null or p_installation_token !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid installation token';
  end if;
  if p_provider_call_count not between 1 and 2 then
    raise exception 'invalid provider call count';
  end if;

  v_installation_hash := encode(extensions.digest(p_installation_token, 'sha256'), 'hex');

  select controls.*
  into v_control
  from public.service_controls as controls
  where controls.id = '00000000-0000-0000-0000-000000000001'::uuid
  for update;

  if not found or v_control.maintenance_mode then
    return query select 'temporarily_unavailable'::text, 0;
    return;
  end if;
  if not v_control.source_resolution_enabled then
    return query select 'temporarily_unavailable'::text, 0;
    return;
  end if;

  insert into public.daily_installation_action_usage as installation_usage (
    installation_token_hash,
    action_type,
    usage_date,
    provider_call_count
  ) values (
    v_installation_hash,
    'source_resolution',
    v_usage_date,
    0
  ) on conflict on constraint daily_installation_action_usage_pkey do nothing;

  select installation_usage.provider_call_count
  into v_installation_count
  from public.daily_installation_action_usage as installation_usage
  where installation_usage.installation_token_hash = v_installation_hash
    and installation_usage.action_type = 'source_resolution'
    and installation_usage.usage_date = v_usage_date
  for update;

  if v_installation_count + p_provider_call_count > v_control.source_resolution_daily_installation_call_limit then
    return query select 'allowance_exhausted'::text, 0;
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
  into v_provider_count
  from public.daily_provider_usage as provider_usage
  where provider_usage.provider = 'youtube'
    and provider_usage.usage_date = v_usage_date
  for update;

  if v_provider_count + p_provider_call_count
      > v_control.daily_youtube_unit_ceiling - v_control.reserved_safety_units then
    return query select 'quota_exhausted'::text, 0;
    return;
  end if;

  update public.daily_installation_action_usage as installation_usage
  set provider_call_count = installation_usage.provider_call_count + p_provider_call_count,
      updated_at = now()
  where installation_usage.installation_token_hash = v_installation_hash
    and installation_usage.action_type = 'source_resolution'
    and installation_usage.usage_date = v_usage_date;

  update public.daily_provider_usage as provider_usage
  set request_count = provider_usage.request_count + p_provider_call_count,
      estimated_quota_units = provider_usage.estimated_quota_units + p_provider_call_count,
      updated_at = now()
  where provider_usage.provider = 'youtube'
    and provider_usage.usage_date = v_usage_date;

  return query select 'reserved'::text, p_provider_call_count;
end;
$$;

revoke execute on function public.reserve_source_resolution_quota(text, integer) from public, anon, authenticated;
grant execute on function public.reserve_source_resolution_quota(text, integer) to service_role;
