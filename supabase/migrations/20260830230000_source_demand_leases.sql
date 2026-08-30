begin;

-- Preserve sources as the single provider registry. A migration must stop rather
-- than create a second source identity when this invariant is absent.
do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint as constraints
    join pg_catalog.pg_class as relations on relations.oid = constraints.conrelid
    join pg_catalog.pg_namespace as namespaces on namespaces.oid = relations.relnamespace
    where namespaces.nspname = 'public'
      and relations.relname = 'sources'
      and constraints.contype = 'u'
      and pg_catalog.pg_get_constraintdef(constraints.oid) = 'UNIQUE (provider, provider_source_id)'
  ) then
    raise exception 'Round 3A blocked: shared source provider identity uniqueness is missing';
  end if;
end;
$$;

alter table public.service_controls
  add column if not exists source_leases_enabled boolean not null default false;

create table if not exists public.source_demand_leases (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id) on update restrict on delete restrict,
  lease_token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  renewed_at timestamptz not null default now(),
  constraint source_demand_leases_token_hash_format_check
    check (lease_token_hash ~ '^[0-9a-f]{64}$'),
  constraint source_demand_leases_renewal_order_check
    check (created_at <= renewed_at),
  constraint source_demand_leases_expiration_check
    check (expires_at > renewed_at and expires_at <= renewed_at + interval '90 days')
);

create index if not exists source_demand_leases_source_expiration_idx
  on public.source_demand_leases (source_id, expires_at);
create index if not exists source_demand_leases_expiration_idx
  on public.source_demand_leases (expires_at);

comment on table public.source_demand_leases is
  'Anonymous operational demand only. Local app data remains authoritative for profile follows. Multiple users may demand one shared source. Active leases may later qualify a source for shared ingestion, while curated Weekly Picks may require it independently. Expiration makes a source dormant and never deletes its metadata.';

create or replace function public.create_or_renew_source_demand_lease(
  p_source_id uuid,
  p_lease_token_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lease_id uuid;
  v_existing_source_id uuid;
begin
  if not coalesce((
    select controls.source_leases_enabled
    from public.service_controls as controls
    where controls.id = '00000000-0000-0000-0000-000000000001'::uuid
  ), false) then
    raise exception 'source leases are disabled';
  end if;

  if p_source_id is null then
    raise exception 'invalid source';
  end if;
  if p_lease_token_hash is null or p_lease_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid lease token hash';
  end if;
  if p_expires_at is null
    or p_expires_at <= now()
    or p_expires_at > now() + interval '90 days' then
    raise exception 'invalid lease expiration';
  end if;

  select leases.source_id
  into v_existing_source_id
  from public.source_demand_leases as leases
  where leases.lease_token_hash = p_lease_token_hash;

  if found and v_existing_source_id <> p_source_id then
    raise exception 'lease token hash is already assigned to another source';
  end if;

  insert into public.source_demand_leases as leases (
    source_id,
    lease_token_hash,
    expires_at
  )
  values (
    p_source_id,
    p_lease_token_hash,
    p_expires_at
  )
  on conflict (lease_token_hash) do update
  set expires_at = excluded.expires_at,
      renewed_at = now()
  where leases.source_id = excluded.source_id
  returning leases.id into v_lease_id;

  if v_lease_id is null then
    raise exception 'lease renewal failed';
  end if;

  return v_lease_id;
end;
$$;

create or replace function public.release_source_demand_lease(
  p_lease_token_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_count bigint;
begin
  if p_lease_token_hash is null or p_lease_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid lease token hash';
  end if;

  delete from public.source_demand_leases as leases
  where leases.lease_token_hash = p_lease_token_hash;

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count = 1;
end;
$$;

create or replace function public.purge_expired_source_demand_leases()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_count bigint;
begin
  delete from public.source_demand_leases as leases
  where leases.expires_at <= now();

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count;
end;
$$;

alter table public.source_demand_leases enable row level security;
alter table public.source_demand_leases force row level security;

revoke all privileges on table public.source_demand_leases from public, anon, authenticated;
revoke execute on function public.create_or_renew_source_demand_lease(uuid, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.release_source_demand_lease(text) from public, anon, authenticated;
revoke execute on function public.purge_expired_source_demand_leases() from public, anon, authenticated;
grant execute on function public.create_or_renew_source_demand_lease(uuid, text, timestamptz) to service_role;
grant execute on function public.release_source_demand_lease(text) to service_role;
grant execute on function public.purge_expired_source_demand_leases() to service_role;

do $$
begin
  if not exists (
    select 1
    from public.service_controls as controls
    where controls.id = '00000000-0000-0000-0000-000000000001'::uuid
      and controls.source_leases_enabled = false
      and controls.weekly_picks_enabled = false
      and controls.youtube_ingestion_enabled = false
  ) then
    raise exception 'Round 3A blocked: unfinished service controls must remain disabled';
  end if;
end;
$$;

commit;
