-- Some existing environments contain this request-claim helper from an earlier
-- bootstrap. Keep fresh databases compatible while hardening installations where
-- the function is present.
do $migration$
begin
  if to_regprocedure('public.user_id()') is not null then
    alter function public.user_id() set search_path = '';
  end if;
end
$migration$;
