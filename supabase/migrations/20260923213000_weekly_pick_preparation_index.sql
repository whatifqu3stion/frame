begin;

-- The featured-media/source foreign key is composite, so its supporting index
-- must use the same leading column order.
drop index if exists public.weekly_pick_items_featured_media_idx;
create index if not exists weekly_pick_items_featured_source_idx
  on public.weekly_pick_items (featured_media_item_id, source_id)
  where featured_media_item_id is not null;

commit;
