create or replace function public.publish_weekly_pick_batch(
  p_period_start date,
  p_period_end date,
  p_publications jsonb
)
returns table (interest_id text, set_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_publication jsonb;
  v_pick jsonb;
  v_interest_id text;
  v_seen_interest_ids text[] := array[]::text[];
  v_set_id uuid;
begin
  if p_period_start is null
    or p_period_end is null
    or extract(isodow from p_period_start) <> 1
    or p_period_end <> p_period_start + 6 then
    raise exception 'A Weekly Picks batch must cover Monday through Sunday.';
  end if;
  if p_publications is null or jsonb_typeof(p_publications) <> 'array' then
    raise exception 'Weekly Picks publications must be a JSON array.';
  end if;
  if jsonb_array_length(p_publications) < 1 or jsonb_array_length(p_publications) > 15 then
    raise exception 'A Weekly Picks batch must contain between one and fifteen interests.';
  end if;

  for v_publication in select value from jsonb_array_elements(p_publications)
  loop
    if jsonb_typeof(v_publication) <> 'object'
      or exists (
        select 1 from jsonb_object_keys(v_publication) as keys(key)
        where keys.key not in ('interestId', 'picks')
      )
      or not (v_publication ? 'interestId')
      or not (v_publication ? 'picks') then
      raise exception 'Every publication must contain exactly interestId and picks.';
    end if;

    v_interest_id := nullif(btrim(v_publication ->> 'interestId'), '');
    if v_interest_id is null or v_interest_id = any(v_seen_interest_ids) then
      raise exception 'Every publication must use one distinct canonical interest.';
    end if;
    v_seen_interest_ids := array_append(v_seen_interest_ids, v_interest_id);

    if jsonb_typeof(v_publication -> 'picks') <> 'array'
      or jsonb_array_length(v_publication -> 'picks') < 1
      or jsonb_array_length(v_publication -> 'picks') > 3 then
      raise exception 'Every publication must contain between one and three picks.';
    end if;
    for v_pick in select value from jsonb_array_elements(v_publication -> 'picks')
    loop
      if jsonb_typeof(v_pick) <> 'object'
        or not (v_pick ?& array['sourceId', 'featuredMediaItemId', 'reason'])
        or exists (
          select 1 from jsonb_object_keys(v_pick) as pick_keys(key)
          where pick_keys.key not in ('sourceId', 'featuredMediaItemId', 'reason')
        ) then
        raise exception 'Every reviewed pick must contain exactly sourceId, featuredMediaItemId, and reason.';
      end if;
    end loop;

    select public.publish_weekly_pick_set(
      v_interest_id,
      p_period_start,
      p_period_end,
      v_publication -> 'picks'
    ) into v_set_id;

    interest_id := v_interest_id;
    set_id := v_set_id;
    return next;
  end loop;
end;
$$;

comment on function public.publish_weekly_pick_batch(date, date, jsonb) is
  'Atomically publishes one exact reviewed Weekly Picks batch. Server-side operator use only.';

revoke all on function public.publish_weekly_pick_batch(date, date, jsonb) from public, anon, authenticated;
grant execute on function public.publish_weekly_pick_batch(date, date, jsonb) to service_role;
