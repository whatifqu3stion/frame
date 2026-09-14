begin;

create or replace function public.read_cached_source_feed_items(p_provider_source_ids text[], p_limit_per_source integer default 20)
returns table (source_id uuid, provider text, provider_media_id text, title text, description text, thumbnail_url text, published_at timestamptz, duration_seconds integer, is_livestream boolean, is_upcoming_premiere boolean, made_for_kids boolean, metadata_fetched_at timestamptz)
language sql security definer set search_path = '' as $$
  with requested_sources as (
    select s.id from public.sources s
    where s.provider = 'youtube' and s.status = 'active' and s.provider_source_id = any(p_provider_source_ids)
      and s.metadata_fetched_at > now() - interval '30 days' and s.metadata_fetched_at <= now()
      and s.metadata_expires_at > now()
      and cardinality(p_provider_source_ids) between 1 and 25 and p_limit_per_source between 1 and 20
  )
  select m.source_id, m.provider, m.provider_media_id, m.title, m.description, m.thumbnail_url,
    m.published_at, m.duration_seconds, m.is_livestream, m.is_upcoming_premiere, m.made_for_kids, m.metadata_fetched_at
  from requested_sources s
  cross join lateral (
    select media.* from public.media_items media
    where media.source_id = s.id and media.provider = 'youtube' and media.status = 'active'
      and media.metadata_fetched_at > now() - interval '30 days' and media.metadata_fetched_at <= now()
      and media.metadata_expires_at > now()
    order by media.published_at desc nulls last, media.provider_media_id asc
    limit greatest(0, least(coalesce(p_limit_per_source, 0), 20))
  ) m
  order by m.source_id, m.published_at desc nulls last, m.provider_media_id asc;
$$;

create or replace function public.expire_stale_youtube_metadata(p_limit integer default 50)
returns table (expired_media_count bigint, expired_source_count bigint)
language plpgsql security definer set search_path = '' as $$
declare v_media_count bigint; v_source_count bigint;
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'invalid maintenance limit'; end if;
  with stale_media as (
    select m.id from public.media_items m where m.provider = 'youtube'
      and (m.metadata_fetched_at <= now() - interval '30 days' or m.metadata_expires_at <= now())
    order by m.metadata_fetched_at, m.id limit p_limit for update of m skip locked
  )
  update public.media_items m set title = 'Unavailable video', description = '', thumbnail_url = null,
    published_at = null, duration_seconds = null, is_livestream = false, is_upcoming_premiere = false,
    made_for_kids = null, status = 'unavailable', metadata_fetched_at = null, metadata_expires_at = null, updated_at = now()
  from stale_media where m.id = stale_media.id;
  get diagnostics v_media_count = row_count;
  with stale_sources as (
    select s.id from public.sources s where s.provider = 'youtube'
      and (s.metadata_fetched_at <= now() - interval '30 days' or s.metadata_expires_at <= now())
    order by s.metadata_fetched_at, s.id limit p_limit for update of s skip locked
  )
  update public.sources s set handle = null, display_name = 'YouTube source', description = '', thumbnail_url = null,
    metadata_fetched_at = null, metadata_expires_at = null, updated_at = now()
  from stale_sources where s.id = stale_sources.id;
  get diagnostics v_source_count = row_count;
  return query select v_media_count, v_source_count;
end;
$$;

revoke execute on function public.read_cached_source_feed_items(text[],integer), public.expire_stale_youtube_metadata(integer) from public, anon, authenticated;
grant execute on function public.read_cached_source_feed_items(text[],integer), public.expire_stale_youtube_metadata(integer) to service_role;

-- Independent SQL-only maintenance keeps working with every provider switch OFF.
-- Same named job is updated on retry rather than creating duplicate schedules.
select cron.schedule('frame-metadata-retention', '*/5 * * * *', 'select public.expire_stale_youtube_metadata(100);');
commit;
