create or replace function public.publish_weekly_pick_set(
  p_interest_id text,
  p_period_start date,
  p_period_end date,
  p_picks jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pick jsonb;
  v_pick_count integer;
  v_source_id uuid;
  v_featured_media_id uuid;
  v_reason text;
  v_order smallint := 0;
  v_set_id uuid;
  v_seen_source_ids uuid[] := array[]::uuid[];
begin
  if p_period_start is null or p_period_end is null or p_period_end <> p_period_start + 6 then
    raise exception 'A Weekly Picks publication must cover exactly seven calendar days.';
  end if;

  if not exists (
    select 1
    from public.interest_categories as interests
    where interests.id = p_interest_id
      and interests.is_active
  ) then
    raise exception 'Weekly Picks requires an active canonical interest.';
  end if;

  if p_picks is null or jsonb_typeof(p_picks) <> 'array' then
    raise exception 'Weekly Picks must be a JSON array.';
  end if;
  v_pick_count := jsonb_array_length(p_picks);
  if v_pick_count < 1 or v_pick_count > 3 then
    raise exception 'Weekly Picks requires between one and three sources.';
  end if;

  for v_pick in select value from jsonb_array_elements(p_picks)
  loop
    if jsonb_typeof(v_pick) <> 'object' then
      raise exception 'Every Weekly Pick must be an object.';
    end if;
    if exists (
      select 1
      from jsonb_object_keys(v_pick) as keys(key)
      where keys.key not in ('sourceId', 'featuredMediaItemId', 'reason')
    ) then
      raise exception 'Weekly Pick contains an unsupported field.';
    end if;

    if nullif(btrim(v_pick ->> 'sourceId'), '') is null then
      raise exception 'Weekly Pick sourceId must be a UUID.';
    end if;
    begin
      v_source_id := (v_pick ->> 'sourceId')::uuid;
    exception when invalid_text_representation then
      raise exception 'Weekly Pick sourceId must be a UUID.';
    end;
    if v_source_id = any(v_seen_source_ids) then
      raise exception 'A source may appear only once in a Weekly Picks publication.';
    end if;
    v_seen_source_ids := array_append(v_seen_source_ids, v_source_id);

    if not exists (
      select 1
      from public.sources as sources
      where sources.id = v_source_id
        and sources.provider = 'youtube'
        and sources.status = 'active'
    ) then
      raise exception 'Weekly Picks requires an active supported source.';
    end if;

    v_featured_media_id := null;
    if v_pick ? 'featuredMediaItemId' and jsonb_typeof(v_pick -> 'featuredMediaItemId') <> 'null' then
      begin
        v_featured_media_id := (v_pick ->> 'featuredMediaItemId')::uuid;
      exception when invalid_text_representation then
        raise exception 'featuredMediaItemId must be a UUID or null.';
      end;
      if not exists (
        select 1
        from public.media_items as media
        where media.id = v_featured_media_id
          and media.source_id = v_source_id
          and media.provider = 'youtube'
          and media.status = 'active'
          and not media.is_livestream
          and not media.is_upcoming_premiere
      ) then
        raise exception 'Featured media must be active cached media from the selected source.';
      end if;
    end if;

    if v_pick ? 'reason' and jsonb_typeof(v_pick -> 'reason') not in ('string', 'null') then
      raise exception 'Weekly Pick reason must be text or null.';
    end if;
    v_reason := nullif(btrim(v_pick ->> 'reason'), '');
    if v_reason is not null and char_length(v_reason) > 240 then
      raise exception 'Weekly Pick reason must be 240 characters or fewer.';
    end if;
  end loop;

  insert into public.weekly_pick_sets (
    interest_id,
    period_start,
    period_end,
    status,
    published_at
  ) values (
    p_interest_id,
    p_period_start,
    p_period_end,
    'draft',
    null
  )
  on conflict (interest_id, period_start, period_end) do update
  set status = 'draft',
      published_at = null,
      updated_at = now()
  returning id into v_set_id;

  delete from public.weekly_pick_items
  where pick_set_id = v_set_id;

  v_order := 0;
  for v_pick in select value from jsonb_array_elements(p_picks)
  loop
    v_order := v_order + 1;
    v_source_id := (v_pick ->> 'sourceId')::uuid;
    v_featured_media_id := case
      when v_pick ? 'featuredMediaItemId' and jsonb_typeof(v_pick -> 'featuredMediaItemId') <> 'null'
        then (v_pick ->> 'featuredMediaItemId')::uuid
      else null
    end;
    v_reason := nullif(btrim(v_pick ->> 'reason'), '');

    insert into public.weekly_pick_items (
      pick_set_id,
      source_id,
      featured_media_item_id,
      display_order,
      public_reason
    ) values (
      v_set_id,
      v_source_id,
      v_featured_media_id,
      v_order,
      v_reason
    );

    insert into public.source_interests (source_id, interest_id, is_active, provenance)
    values (v_source_id, p_interest_id, true, 'editorial')
    on conflict (source_id, interest_id) do update
    set is_active = true,
        provenance = 'editorial',
        updated_at = now();
  end loop;

  update public.weekly_pick_sets
  set status = 'expired'
  where interest_id = p_interest_id
    and status = 'published'
    and id <> v_set_id
    and daterange(period_start, period_end, '[]') && daterange(p_period_start, p_period_end, '[]');

  update public.weekly_pick_sets
  set status = 'published',
      published_at = now()
  where id = v_set_id;

  return v_set_id;
end;
$$;

comment on function public.publish_weekly_pick_set(text, date, date, jsonb) is
  'Atomically validates and publishes one bounded editorial Weekly Picks set. Server-side operations only.';

revoke all on function public.publish_weekly_pick_set(text, date, date, jsonb) from public, anon, authenticated;
grant execute on function public.publish_weekly_pick_set(text, date, date, jsonb) to service_role;
