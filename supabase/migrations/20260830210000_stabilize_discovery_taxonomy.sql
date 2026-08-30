begin;

-- Abort before any mutation if Round 2A safety controls changed or published
-- history uses an interest that this migration replaces.
do $$
declare
  published_legacy_sets jsonb;
  controls_enabled boolean;
begin
  select coalesce(
    jsonb_agg(jsonb_build_object('interest_id', interest_id, 'count', set_count) order by interest_id),
    '[]'::jsonb
  )
  into published_legacy_sets
  from (
    select interest_id, count(*) as set_count
    from public.weekly_pick_sets
    where status = 'published'
      and interest_id = any(array[
        'photography', 'architecture', 'art', 'nature', 'philosophy',
        'literature', 'writing', 'essays', 'interviews', 'craft'
      ]::text[])
    group by interest_id
  ) as published_legacy;

  if jsonb_array_length(published_legacy_sets) > 0 then
    raise exception 'Round 2B blocked: published Weekly Pick sets use replaced interests: %', published_legacy_sets;
  end if;

  select coalesce(weekly_picks_enabled or youtube_ingestion_enabled, true)
  into controls_enabled
  from public.service_controls
  where id = '00000000-0000-0000-0000-000000000001'::uuid;

  if controls_enabled is distinct from false then
    raise exception 'Round 2B blocked: Weekly Picks and YouTube ingestion must both be disabled';
  end if;
end;
$$;

-- Free the unique sort-order range before assigning the canonical sequence.
update public.interest_categories
set sort_order = sort_order + 100
where sort_order between 1 and 99;

insert into public.interest_categories (id, display_name, is_active, sort_order)
values
  ('tech', 'Technology', true, 1),
  ('science', 'Science & Nature', true, 2),
  ('history', 'History & Society', true, 3),
  ('learning', 'Ideas & Learning', true, 4),
  ('business', 'Business & Money', true, 5),
  ('health', 'Health & Fitness', true, 6),
  ('design', 'Arts & Design', true, 7),
  ('film', 'Film & Culture', true, 8),
  ('music', 'Music', true, 9),
  ('cooking', 'Food & Cooking', true, 10),
  ('travel', 'Travel & Adventure', true, 11),
  ('making', 'Home, DIY & Making', true, 12),
  ('gaming', 'Gaming', true, 13),
  ('sports', 'Sports', true, 14),
  ('life', 'Life & Relationships', true, 15)
on conflict (id) do update
set display_name = excluded.display_name,
    is_active = true,
    sort_order = excluded.sort_order;

update public.interest_categories
set is_active = false
where id = any(array[
  'photography', 'architecture', 'art', 'nature', 'philosophy',
  'literature', 'writing', 'essays', 'interviews', 'craft'
]::text[]);

do $$
declare
  migrated_mapping_count integer := 0;
  deactivated_mapping_count integer := 0;
begin
  with replacements(legacy_id, canonical_id) as (
    values
      ('photography', 'design'),
      ('architecture', 'design'),
      ('art', 'design'),
      ('nature', 'science'),
      ('philosophy', 'learning'),
      ('literature', 'learning'),
      ('writing', 'learning'),
      ('essays', 'learning'),
      ('interviews', 'learning'),
      ('craft', 'making')
  )
  insert into public.source_interests (source_id, interest_id, is_active, provenance)
  select legacy.source_id, replacements.canonical_id, true, legacy.provenance
  from public.source_interests as legacy
  join replacements on replacements.legacy_id = legacy.interest_id
  where legacy.is_active = true
  on conflict (source_id, interest_id) do update
  set is_active = true,
      updated_at = now();

  get diagnostics migrated_mapping_count = row_count;

  with replacements(legacy_id, canonical_id) as (
    values
      ('photography', 'design'),
      ('architecture', 'design'),
      ('art', 'design'),
      ('nature', 'science'),
      ('philosophy', 'learning'),
      ('literature', 'learning'),
      ('writing', 'learning'),
      ('essays', 'learning'),
      ('interviews', 'learning'),
      ('craft', 'making')
  )
  update public.source_interests as legacy
  set is_active = false
  from replacements
  where legacy.interest_id = replacements.legacy_id
    and legacy.is_active = true
    and exists (
      select 1
      from public.source_interests as canonical
      where canonical.source_id = legacy.source_id
        and canonical.interest_id = replacements.canonical_id
        and canonical.is_active = true
    );

  get diagnostics deactivated_mapping_count = row_count;
  raise notice 'Round 2B mappings migrated_or_reactivated=%, legacy_deactivated=%', migrated_mapping_count, deactivated_mapping_count;
end;
$$;

-- Assert the final state while still inside the transaction.
do $$
declare
  canonical_ids constant text[] := array[
    'tech', 'science', 'history', 'learning', 'business', 'health', 'design',
    'film', 'music', 'cooking', 'travel', 'making', 'gaming', 'sports', 'life'
  ]::text[];
  active_ids text[];
begin
  select array_agg(id order by sort_order)
  into active_ids
  from public.interest_categories
  where is_active = true;

  if active_ids is distinct from canonical_ids then
    raise exception 'Round 2B active taxonomy verification failed: %', active_ids;
  end if;

  if (
    select count(*)
    from public.interest_categories
    where id = any(array[
      'photography', 'architecture', 'art', 'nature', 'philosophy',
      'literature', 'writing', 'essays', 'interviews', 'craft'
    ]::text[])
      and is_active = false
  ) <> 10 then
    raise exception 'Round 2B legacy taxonomy verification failed';
  end if;

  if exists (
    select 1
    from public.source_interests as legacy
    join (values
      ('photography', 'design'), ('architecture', 'design'), ('art', 'design'),
      ('nature', 'science'), ('philosophy', 'learning'), ('literature', 'learning'),
      ('writing', 'learning'), ('essays', 'learning'), ('interviews', 'learning'),
      ('craft', 'making')
    ) as replacements(legacy_id, canonical_id)
      on replacements.legacy_id = legacy.interest_id
    where legacy.is_active = true
      and exists (
        select 1
        from public.source_interests as canonical
        where canonical.source_id = legacy.source_id
          and canonical.interest_id = replacements.canonical_id
          and canonical.is_active = true
      )
  ) then
    raise exception 'Round 2B mapping verification failed: replaced mapping remains active';
  end if;

  if exists (
    select 1
    from public.service_controls
    where id = '00000000-0000-0000-0000-000000000001'::uuid
      and (weekly_picks_enabled or youtube_ingestion_enabled)
  ) then
    raise exception 'Round 2B control verification failed';
  end if;
end;
$$;

commit;
