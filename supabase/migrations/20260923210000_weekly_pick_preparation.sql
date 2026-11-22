begin;

-- Curated discovery sources are shared catalog demand even when no local
-- profile currently follows them. Keep the existing bounded worker and quota
-- controls; only broaden which already-verified sources may be claimed.
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
      and (
        exists (
          select 1
          from public.source_demand_leases as leases
          where leases.source_id = sources.id
            and leases.expires_at > now()
        )
        or exists (
          select 1
          from public.source_interests as mappings
          where mappings.source_id = sources.id
            and mappings.is_active
        )
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
      and (
        exists (
          select 1
          from public.source_demand_leases as leases
          where leases.source_id = sync_state.source_id
            and leases.expires_at > now()
        )
        or exists (
          select 1
          from public.source_interests as mappings
          where mappings.source_id = sync_state.source_id
            and mappings.is_active
        )
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

revoke all on function public.claim_due_source_syncs(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_due_source_syncs(uuid, integer) to service_role;

create index if not exists weekly_pick_items_source_idx
  on public.weekly_pick_items (source_id);
create index if not exists weekly_pick_items_featured_source_idx
  on public.weekly_pick_items (featured_media_item_id, source_id)
  where featured_media_item_id is not null;

-- Produces a bounded, deterministic editorial shortlist from the verified
-- shared cache. It never writes, publishes, searches, or calls a provider/AI.
create or replace function public.get_weekly_pick_candidates(
  p_period_start date,
  p_interest_ids text[],
  p_limit_per_interest integer default 6
)
returns table (
  interest_id text,
  candidate_rank bigint,
  source_id uuid,
  source_provider text,
  source_provider_id text,
  source_handle text,
  source_display_name text,
  source_description text,
  source_thumbnail_url text,
  featured_media_item_id uuid,
  featured_media_provider text,
  featured_media_provider_id text,
  featured_media_title text,
  featured_media_description text,
  featured_media_thumbnail_url text,
  featured_media_published_at timestamptz,
  featured_media_duration_seconds integer,
  last_picked_period_start date
)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_interest_count integer;
begin
  if p_period_start is null or extract(isodow from p_period_start) <> 1 then
    raise exception 'period start must be a Monday';
  end if;
  if p_interest_ids is null or cardinality(p_interest_ids) not between 1 and 15 then
    raise exception 'interest list must contain between 1 and 15 values';
  end if;
  if exists (select 1 from unnest(p_interest_ids) as requested(id) where requested.id is null) then
    raise exception 'interest IDs may not be null';
  end if;
  if (select count(distinct requested.id) from unnest(p_interest_ids) as requested(id)) <> cardinality(p_interest_ids) then
    raise exception 'interest IDs must be unique';
  end if;
  if p_limit_per_interest is null or p_limit_per_interest not between 1 and 12 then
    raise exception 'candidate limit must be between 1 and 12';
  end if;

  select count(*)
  into v_interest_count
  from public.interest_categories as interests
  where interests.id = any(p_interest_ids)
    and interests.is_active;

  if v_interest_count <> cardinality(p_interest_ids) then
    raise exception 'every interest must be active';
  end if;

  return query
  with requested as (
    select requested.id as interest_id
    from unnest(p_interest_ids) with ordinality as requested(id, requested_order)
  ), eligible as (
    select mappings.interest_id,
           sources.id as source_id,
           sources.provider,
           sources.provider_source_id,
           sources.handle,
           sources.display_name,
           sources.description,
           sources.thumbnail_url,
           media.id as media_id,
           media.provider as media_provider,
           media.provider_media_id,
           media.title as media_title,
           media.description as media_description,
           media.thumbnail_url as media_thumbnail_url,
           media.published_at as media_published_at,
           media.duration_seconds as media_duration_seconds,
           history.last_period_start
    from requested
    join public.source_interests as mappings
      on mappings.interest_id = requested.interest_id
     and mappings.is_active
    join public.sources as sources
      on sources.id = mappings.source_id
     and sources.status = 'active'
    join lateral (
      select items.id,
             items.provider,
             items.provider_media_id,
             items.title,
             items.description,
             items.thumbnail_url,
             items.published_at,
             items.duration_seconds
      from public.media_items as items
      where items.source_id = sources.id
        and items.status = 'active'
        and not items.is_livestream
        and not items.is_upcoming_premiere
        and items.published_at is not null
        and items.published_at <= now()
        and items.published_at >= p_period_start::timestamptz - interval '180 days'
      order by items.published_at desc, items.id
      limit 1
    ) as media on true
    left join lateral (
      select max(sets.period_start) as last_period_start
      from public.weekly_pick_items as prior_items
      join public.weekly_pick_sets as sets on sets.id = prior_items.pick_set_id
      where prior_items.source_id = sources.id
        and sets.status in ('published', 'expired')
        and sets.period_start < p_period_start
    ) as history on true
  ), ranked as (
    select eligible.*,
           row_number() over (
             partition by eligible.interest_id
             order by eligible.last_period_start asc nulls first,
                      eligible.media_published_at desc,
                      eligible.source_id
           ) as candidate_rank
    from eligible
  )
  select ranked.interest_id,
         ranked.candidate_rank,
         ranked.source_id,
         ranked.provider,
         ranked.provider_source_id,
         ranked.handle,
         ranked.display_name,
         ranked.description,
         ranked.thumbnail_url,
         ranked.media_id,
         ranked.media_provider,
         ranked.provider_media_id,
         ranked.media_title,
         ranked.media_description,
         ranked.media_thumbnail_url,
         ranked.media_published_at,
         ranked.media_duration_seconds,
         ranked.last_period_start
  from ranked
  where ranked.candidate_rank <= p_limit_per_interest
  order by array_position(p_interest_ids, ranked.interest_id), ranked.candidate_rank;
end;
$$;

comment on function public.get_weekly_pick_candidates(date, text[], integer) is
  'Returns a read-only editorial shortlist from active cached sources/media. Never publishes or calls providers/AI.';

revoke all on function public.get_weekly_pick_candidates(date, text[], integer) from public, anon, authenticated;
grant execute on function public.get_weekly_pick_candidates(date, text[], integer) to service_role;

commit;
