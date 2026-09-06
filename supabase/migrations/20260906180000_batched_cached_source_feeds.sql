begin;

create or replace function public.read_cached_source_feed_items(
  p_provider_source_ids text[],
  p_limit_per_source integer default 20
)
returns table (
  source_id uuid,
  provider text,
  provider_media_id text,
  title text,
  description text,
  thumbnail_url text,
  published_at timestamptz,
  duration_seconds integer,
  is_livestream boolean,
  is_upcoming_premiere boolean,
  made_for_kids boolean,
  metadata_fetched_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  with requested_sources as (
    select sources.id
    from public.sources as sources
    where sources.provider = 'youtube'
      and sources.status = 'active'
      and sources.provider_source_id = any(p_provider_source_ids)
  ), ranked_media as (
    select media.source_id,
           media.provider,
           media.provider_media_id,
           media.title,
           media.description,
           media.thumbnail_url,
           media.published_at,
           media.duration_seconds,
           media.is_livestream,
           media.is_upcoming_premiere,
           media.made_for_kids,
           media.metadata_fetched_at,
           row_number() over (
             partition by media.source_id
             order by media.published_at desc nulls last, media.provider_media_id asc
           ) as source_position
    from public.media_items as media
    join requested_sources on requested_sources.id = media.source_id
    where media.provider = 'youtube'
      and media.status = 'active'
      and media.metadata_fetched_at is not null
  )
  select ranked_media.source_id,
         ranked_media.provider,
         ranked_media.provider_media_id,
         ranked_media.title,
         ranked_media.description,
         ranked_media.thumbnail_url,
         ranked_media.published_at,
         ranked_media.duration_seconds,
         ranked_media.is_livestream,
         ranked_media.is_upcoming_premiere,
         ranked_media.made_for_kids,
         ranked_media.metadata_fetched_at
  from ranked_media
  where cardinality(p_provider_source_ids) between 1 and 25
    and p_limit_per_source between 1 and 20
    and ranked_media.source_position <= p_limit_per_source
  order by ranked_media.source_id, ranked_media.source_position;
$$;

revoke execute on function public.read_cached_source_feed_items(text[], integer) from public, anon, authenticated;
grant execute on function public.read_cached_source_feed_items(text[], integer) to service_role;

commit;
