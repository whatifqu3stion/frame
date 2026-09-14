begin;
set local statement_timeout = '10s';
set local lock_timeout = '3s';

do $$
declare
  v_result text;
  v_before bigint;
  v_after bigint;
  v_reset timestamptz;
  v_name text;
begin
  if public.youtube_quota_date('2026-01-01T07:59:59Z') <> date '2025-12-31'
    or public.youtube_quota_date('2026-01-01T08:00:00Z') <> date '2026-01-01'
    or public.youtube_quota_date('2026-09-14T06:59:59Z') <> date '2026-09-13'
    or public.youtube_quota_date('2026-09-14T07:00:00Z') <> date '2026-09-14' then raise exception 'quota date boundary'; end if;
  if public.next_youtube_quota_reset('2026-03-08T08:00:00Z') - timestamptz '2026-03-08T08:00:00Z' <> interval '23 hours'
    or public.next_youtube_quota_reset('2026-11-01T07:00:00Z') - timestamptz '2026-11-01T07:00:00Z' <> interval '25 hours' then raise exception 'quota DST boundary'; end if;

  -- These changes are invisible to other transactions and always rolled back.
  -- No provider is invoked: this test exercises only reservation/accounting SQL.
  update public.service_controls set youtube_ingestion_enabled = false, source_resolution_enabled = false;
  select outcome into v_result from public.reserve_youtube_ingestion_quota(1, 1);
  if v_result <> 'temporarily_unavailable' then raise exception 'ingestion kill switch'; end if;
  select outcome into v_result from public.reserve_source_resolution_quota(repeat('a',64), 1);
  if v_result <> 'temporarily_unavailable' then raise exception 'resolution kill switch'; end if;

  update public.service_controls set youtube_ingestion_enabled = true, source_resolution_enabled = true,
    maintenance_mode = false, youtube_ingestion_halted_until = public.next_youtube_quota_reset();
  select outcome into v_result from public.reserve_source_resolution_quota(repeat('a',64), 1);
  if v_result <> 'temporarily_unavailable' then raise exception 'resolution must respect shared halt'; end if;
  update public.service_controls set youtube_ingestion_halted_until = null;

  select coalesce(sum(estimated_quota_units),0) into v_before from public.daily_provider_usage
    where provider = 'youtube' and usage_date = public.youtube_quota_date();
  update public.service_controls set daily_youtube_unit_ceiling = (v_before + 1002)::integer, reserved_safety_units = 1000,
    source_resolution_daily_installation_call_limit = 100;
  select outcome into v_result from public.reserve_youtube_ingestion_quota(1,1);
  if v_result <> 'reserved' then raise exception 'ingestion reservation'; end if;
  select outcome into v_result from public.reserve_source_resolution_quota(repeat('a',64),1);
  if v_result <> 'reserved' then raise exception 'resolution shared reservation'; end if;
  select outcome into v_result from public.reserve_youtube_ingestion_quota(1,1);
  if v_result <> 'quota_exhausted' then raise exception 'shared ceiling'; end if;
  select estimated_quota_units into v_after from public.daily_provider_usage where provider = 'youtube' and usage_date = public.youtube_quota_date();
  if v_after <> v_before + 2 then raise exception 'denied request consumed quota'; end if;
  select youtube_ingestion_halted_until into v_reset from public.service_controls;
  if v_reset <> public.next_youtube_quota_reset() then raise exception 'quota exhaustion reset'; end if;

  update public.service_controls set youtube_ingestion_halted_until = null;
  perform public.record_youtube_ingestion_halt('provider_quota',now()+interval '24 hours');
  select youtube_ingestion_halted_until into v_reset from public.service_controls;
  if v_reset <> public.next_youtube_quota_reset() then raise exception 'provider quota reset'; end if;

  begin
    perform public.reserve_source_resolution_quota(repeat('a',64), null);
    raise exception 'null reservation accepted';
  exception when raise_exception then
    if sqlerrm <> 'invalid provider call count' then raise; end if;
  end;
  foreach v_name in array array['public.youtube_quota_date(timestamptz)', 'public.next_youtube_quota_reset(timestamptz)', 'public.reserve_youtube_ingestion_quota(integer,integer)', 'public.reserve_source_resolution_quota(text,integer)'] loop
    if has_function_privilege('anon',v_name,'EXECUTE') or has_function_privilege('authenticated',v_name,'EXECUTE') then raise exception 'public quota access'; end if;
  end loop;
end;
$$;
do $$
declare
  v_source uuid := gen_random_uuid();
  v_channel text := 'UC' || substr(replace(v_source::text,'-',''),1,22);
  v_count bigint;
begin
  insert into public.sources(id,provider,provider_source_id,display_name,metadata_fetched_at,metadata_expires_at)
    values (v_source,'youtube',v_channel,'Rollback-only fixture',now(),now()+interval '1 day');
  insert into public.media_items(provider,provider_media_id,source_id,title,published_at,metadata_fetched_at,metadata_expires_at)
    select 'youtube','tst' || lpad(n::text,8,'0'),v_source,'Rollback-only fixture',now()-n*interval '1 minute',
      case when n=0 then now()-interval '31 days' else now() end, now()+interval '1 day'
    from generate_series(0,24) n;
  select count(*) into v_count from public.read_cached_source_feed_items(array[v_channel],20);
  if v_count <> 20 then raise exception 'bounded retention read'; end if;
  if exists(select 1 from public.read_cached_source_feed_items(array[v_channel],20) where provider_media_id='tst00000000') then raise exception 'expired media served'; end if;
  update public.sources set metadata_fetched_at=now()-interval '1 day', metadata_expires_at=now()-interval '1 second' where id=v_source;
  if exists(select 1 from public.read_cached_source_feed_items(array[v_channel],20)) then raise exception 'expired source served'; end if;
  perform public.expire_stale_youtube_metadata(100);
  if exists(select 1 from public.sources where id=v_source and (metadata_fetched_at is not null or display_name <> 'YouTube source')) then raise exception 'source cleanup'; end if;
  if exists(select 1 from public.media_items where source_id=v_source and provider_media_id='tst00000000' and (metadata_fetched_at is not null or title <> 'Unavailable video')) then raise exception 'media cleanup'; end if;
end;
$$;
rollback;
select 'Stage A quota and retention SQL assertions passed; transaction rolled back' as result;
