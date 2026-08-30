create table if not exists public.daily_provider_usage (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider ~ '^[a-z][a-z0-9_-]{1,63}$'),
  usage_date date not null,
  request_count bigint not null default 0 check (request_count >= 0),
  estimated_quota_units bigint not null default 0 check (estimated_quota_units >= 0),
  updated_at timestamptz not null default now(),
  constraint daily_provider_usage_provider_date_key unique (provider, usage_date)
);

create table if not exists public.service_controls (
  id uuid primary key,
  youtube_ingestion_enabled boolean not null default false,
  weekly_picks_enabled boolean not null default false,
  maintenance_mode boolean not null default false,
  daily_youtube_unit_ceiling integer not null check (daily_youtube_unit_ceiling > 0),
  reserved_safety_units integer not null check (reserved_safety_units >= 0),
  updated_at timestamptz not null default now(),
  check (id = '00000000-0000-0000-0000-000000000001'::uuid),
  check (reserved_safety_units < daily_youtube_unit_ceiling)
);

insert into public.service_controls (
  id,
  youtube_ingestion_enabled,
  weekly_picks_enabled,
  maintenance_mode,
  daily_youtube_unit_ceiling,
  reserved_safety_units
)
values (
  '00000000-0000-0000-0000-000000000001'::uuid,
  false,
  false,
  false,
  10000,
  1000
)
on conflict (id) do nothing;

create or replace trigger daily_provider_usage_set_updated_at before update on public.daily_provider_usage
for each row execute function public.set_updated_at();
create or replace trigger service_controls_set_updated_at before update on public.service_controls
for each row execute function public.set_updated_at();

create or replace function public.increment_daily_provider_usage(
  p_provider text,
  p_request_count bigint default 1,
  p_estimated_quota_units bigint default 0
)
returns table (
  provider text,
  usage_date date,
  request_count bigint,
  estimated_quota_units bigint,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usage_date date := (now() at time zone 'UTC')::date;
begin
  if p_provider is null or p_provider !~ '^[a-z][a-z0-9_-]{1,63}$' then
    raise exception 'invalid provider';
  end if;
  if p_request_count < 0 or p_estimated_quota_units < 0 then
    raise exception 'usage increments must be nonnegative';
  end if;

  return query
  insert into public.daily_provider_usage as usage (
    provider,
    usage_date,
    request_count,
    estimated_quota_units
  )
  values (
    p_provider,
    v_usage_date,
    p_request_count,
    p_estimated_quota_units
  )
  on conflict on constraint daily_provider_usage_provider_date_key do update
  set request_count = usage.request_count + excluded.request_count,
      estimated_quota_units = usage.estimated_quota_units + excluded.estimated_quota_units,
      updated_at = now()
  returning usage.provider,
            usage.usage_date,
            usage.request_count,
            usage.estimated_quota_units,
            usage.updated_at;
end;
$$;

alter table public.daily_provider_usage enable row level security;
alter table public.daily_provider_usage force row level security;
alter table public.service_controls enable row level security;
alter table public.service_controls force row level security;

revoke all privileges on table public.daily_provider_usage from anon, authenticated;
revoke all privileges on table public.service_controls from anon, authenticated;
revoke execute on function public.increment_daily_provider_usage(text, bigint, bigint) from public, anon, authenticated;
grant execute on function public.increment_daily_provider_usage(text, bigint, bigint) to service_role;
