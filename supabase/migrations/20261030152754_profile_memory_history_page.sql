-- Bounded owner history; independent of chat/worker context budgets.
create function get_profile_memory_page(p_before_created_at timestamptz default null,p_before_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb; owner_id uuid:=auth.uid();
begin
 if owner_id is null then raise exception 'Authenticated owner required' using errcode='42501'; end if;
 if (p_before_created_at is null) <> (p_before_id is null)
  or (p_before_created_at is not null and not isfinite(p_before_created_at)) then
  raise exception 'Complete finite profile cursor required' using errcode='23514';
 end if;
 -- One statement/snapshot; the indexed keyset and lookahead are bounded to101.
 with candidates as materialized (
  select obs.*,j.session_id from profile_observations obs
  join profile_extraction_jobs j on j.id=obs.job_id and j.user_id=obs.user_id
  where obs.user_id=owner_id and (p_before_created_at is null or (obs.source_created_at,obs.id)<(p_before_created_at,p_before_id))
  order by obs.source_created_at desc,obs.id desc limit 101
 ), page as materialized (
  select * from candidates order by source_created_at desc,id desc limit 100
 )
 select jsonb_build_object(
  'enabled',coalesce((select enabled from profile_settings where user_id=owner_id),false),
  'pending_jobs',(select count(*) from profile_extraction_jobs where user_id=owner_id and consent_epoch=(select consent_epoch from profile_settings where user_id=owner_id) and status in ('pending','enqueued','running')),
  'failed_jobs',(select count(*) from profile_extraction_jobs where user_id=owner_id and consent_epoch=(select consent_epoch from profile_settings where user_id=owner_id) and status='exhausted'),
  'observations',coalesce((select jsonb_agg(jsonb_build_object(
   'id',o.id,'category',o.category,'quote',o.quote,'time_scope',o.time_scope,'status',o.status,
   'supersedes_id',o.supersedes_id,'source_message_id',o.source_message_id,'session_id',o.session_id,
   'source_created_at',o.source_created_at,'updated_at',o.updated_at,
   'disputed',o.status='confirmed' and exists(select 1 from profile_observations child where child.user_id=owner_id and child.supersedes_id=o.id and child.status='pending')
  ) order by o.source_created_at desc,o.id desc) from page o),'[]'::jsonb),
  'next_cursor',case when (select count(*) from candidates)>100 then
   (select jsonb_build_object('source_created_at',source_created_at,'id',id) from page order by source_created_at,id limit 1)
   else null end
 ) into result;
 return result;
end $$;
revoke all on function get_profile_memory_page(timestamptz,uuid) from public,anon,service_role;
grant execute on function get_profile_memory_page(timestamptz,uuid) to authenticated;
