create or replace function public.get_current_weekly_picks(p_interest_ids text[])
returns table (
  pick_set_status text,
  period_start date,
  period_end date,
  interest_id text,
  pick_order smallint,
  public_reason text,
  source_provider text,
  source_provider_id text,
  source_handle text,
  source_display_name text,
  source_description text,
  source_thumbnail_url text,
  media_provider text,
  media_provider_id text,
  media_title text,
  media_description text,
  media_thumbnail_url text,
  media_published_at timestamptz,
  media_duration_seconds integer,
  media_is_livestream boolean,
  media_is_upcoming_premiere boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pick_sets.status,
    pick_sets.period_start,
    pick_sets.period_end,
    pick_sets.interest_id,
    pick_items.display_order,
    pick_items.public_reason,
    sources.provider,
    sources.provider_source_id,
    sources.handle,
    sources.display_name,
    sources.description,
    sources.thumbnail_url,
    media.provider,
    media.provider_media_id,
    media.title,
    media.description,
    media.thumbnail_url,
    media.published_at,
    media.duration_seconds,
    media.is_livestream,
    media.is_upcoming_premiere
  from public.weekly_pick_sets as pick_sets
  join public.weekly_pick_items as pick_items on pick_items.pick_set_id = pick_sets.id
  join public.sources as sources on sources.id = pick_items.source_id and sources.status = 'active'
  left join public.media_items as media
    on media.id = pick_items.featured_media_item_id
   and media.source_id = pick_items.source_id
   and media.status = 'active'
  where cardinality(p_interest_ids) between 1 and 8
    and pick_sets.interest_id = any(p_interest_ids)
    and pick_sets.status = 'published'
    and pick_sets.published_at is not null
    and pick_sets.published_at <= now()
    and (now() at time zone 'UTC')::date between pick_sets.period_start and pick_sets.period_end
    and pick_items.display_order between 1 and 3
  order by pick_sets.interest_id, pick_items.display_order;
$$;

revoke execute on function public.get_current_weekly_picks(text[]) from public, anon, authenticated;
grant execute on function public.get_current_weekly_picks(text[]) to service_role;
