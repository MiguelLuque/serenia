-- Isolated synthetic SQL fixtures; rollback never mutates runtime acceptance actors.
begin;
create function pg_temp.page_assert(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'PROFILE PAGE: %',label; end if; end $$;
create function pg_temp.page_denied(sql text) returns void language plpgsql as $$
begin
 begin execute sql; exception when insufficient_privilege or check_violation or invalid_text_representation or invalid_datetime_format or datetime_field_overflow then return; end;
 raise exception 'PROFILE PAGE: unexpectedly accepted %',sql;
end $$;
select pg_temp.page_assert(has_function_privilege('authenticated','get_profile_memory_page(timestamptz,uuid)','execute')
 and not has_function_privilege('anon','get_profile_memory_page(timestamptz,uuid)','execute')
 and not has_function_privilege('service_role','get_profile_memory_page(timestamptz,uuid)','execute'),'minimum grants');
select pg_temp.page_assert((select prosecdef and provolatile='s' and proconfig=array['search_path=public, pg_temp'] from pg_proc where oid='get_profile_memory_page(timestamptz,uuid)'::regprocedure),'stable pinned security definer');
insert into auth.users(id) values('00000000-0000-4000-8000-000000000201'),('00000000-0000-4000-8000-000000000202');
insert into conversations(id,user_id) values('10000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000201'),('10000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000202');
insert into clinical_sessions(id,conversation_id,user_id) select ('20000000-0000-4000-8000-'||right(id::text,12))::uuid,id,user_id from conversations where id::text like '10000000-0000-4000-8000-00000000020_';
insert into messages(id,session_id,conversation_id,role,parts,created_at)
 select ('40000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'20000000-0000-4000-8000-000000000201','10000000-0000-4000-8000-000000000201','user',jsonb_build_array(jsonb_build_object('type','text','text',case when i<3 then 'Synthetic quote '||i else (select string_agg('Synthetic quote '||n,' ') from generate_series(3,205) n) end)),
 case when i=1 then '2026-10-01T12:00:00.123456Z'::timestamptz when i=2 then '2026-10-02T12:00:00.123456Z'::timestamptz else '2026-10-03T12:00:00.123456Z'::timestamptz end from generate_series(1,3) i;
insert into messages(id,session_id,conversation_id,role,parts,created_at) values('40000000-0000-4000-8000-000000000204','20000000-0000-4000-8000-000000000202','10000000-0000-4000-8000-000000000202','user','[{"type":"text","text":"Foreign quote"}]','2026-10-04T12:00:00.123456Z');
insert into profile_extraction_jobs(id,user_id,source_message_id,session_id,conversation_id,source_created_at,consent_epoch,status)
 select m.id,c.user_id,m.id,m.session_id,m.conversation_id,m.created_at,1,'completed' from messages m join conversations c on c.id=m.conversation_id where m.id::text like '40000000-0000-4000-8000-%';
insert into profile_observations(id,job_id,user_id,source_message_id,source_created_at,category,quote,time_scope,status,supersedes_id)
 select ('50000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,m.id,j.user_id,m.id,m.created_at,'context','Synthetic quote '||i,'current',
 case when i=1 then 'confirmed' when i=2 or i=205 then 'pending' when i%2=0 then 'rejected' else 'superseded' end,case when i=205 then '50000000-0000-4000-8000-000000000001'::uuid else null end
 from generate_series(1,205) i join messages m on m.id=('40000000-0000-4000-8000-'||lpad(least(i,3)::text,12,'0'))::uuid join profile_extraction_jobs j on j.id=m.id;
insert into profile_observations(job_id,user_id,source_message_id,source_created_at,category,quote,time_scope) select id,user_id,source_message_id,source_created_at,'context','Foreign quote','current' from profile_extraction_jobs where user_id='00000000-0000-4000-8000-000000000202';
set local role authenticated;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.page_denied('select get_profile_memory_page()');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000202',true);
select pg_temp.page_assert((get_profile_memory_page()-'observations')='{"enabled":false,"pending_jobs":0,"failed_jobs":0,"next_cursor":null}'::jsonb,'empty owner and no read writes');
select pg_temp.page_assert(jsonb_array_length(get_profile_memory_page('2026-10-03T12:00:00.123456Z','50000000-0000-4000-8000-000000000200')->'observations')=0,'foreign cursor cannot choose owner');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true);
select pg_temp.page_denied($q$select get_profile_memory_page(null,'50000000-0000-4000-8000-000000000001')$q$);
select pg_temp.page_denied($q$select get_profile_memory_page('2026-10-03T12:00:00Z',null)$q$);
select pg_temp.page_denied($q$select get_profile_memory_page('infinity','50000000-0000-4000-8000-000000000001')$q$);
select pg_temp.page_denied($q$select get_profile_memory_page('bad','bad')$q$);
do $$ declare page jsonb; cursor jsonb; ids uuid[]='{}'; row jsonb; pages integer=0; old jsonb; stale timestamptz; begin
 page=get_profile_memory_page(null,null);
 loop
  pages=pages+1;
  perform pg_temp.page_assert(jsonb_array_length(page->'observations')=case when pages<3 then 100 else 5 end,'bounded rows / lookahead end');
  for row in select value from jsonb_array_elements(page->'observations') loop
   perform pg_temp.page_assert(not (row->>'id')::uuid=any(ids),'no duplicate tied row');
   ids=array_append(ids,(row->>'id')::uuid);
   if row->>'id'='50000000-0000-4000-8000-000000000001' then old=row; end if;
  end loop;
  cursor=page->'next_cursor';
  exit when cursor='null'::jsonb;
  perform pg_temp.page_assert(cursor->>'source_created_at'=page->'observations'->99->>'source_created_at' and cursor->>'id'=page->'observations'->99->>'id','cursor is last returned / precise source');
  page=get_profile_memory_page((cursor->>'source_created_at')::timestamptz,(cursor->>'id')::uuid);
 end loop;
 perform pg_temp.page_assert(jsonb_array_length(get_profile_memory_page('2026-10-03T12:00:00.123456Z','50000000-0000-4000-8000-000000000101')->'observations')=100 and get_profile_memory_page('2026-10-03T12:00:00.123456Z','50000000-0000-4000-8000-000000000101')->'next_cursor'='null'::jsonb,'exactly100 has no lookahead cursor');
 perform pg_temp.page_assert(get_profile_memory_page('2026-10-01T12:00:00.123456Z','50000000-0000-4000-8000-000000000001')->'observations'='[]'::jsonb,'after final row empty');
 perform pg_temp.page_assert(pages=3 and cardinality(ids)=205,'old pending and confirmed reachable across all ties');
 perform pg_temp.page_assert(old->>'status'='confirmed' and (old->>'disputed')::boolean,'dispute uses pending child off-page');
 stale=(old->>'updated_at')::timestamptz;
 perform review_profile_observation((old->>'id')::uuid,'reject',stale);
 begin perform review_profile_observation((old->>'id')::uuid,'confirm',stale); raise exception 'stale review accepted'; exception when sqlstate 'PT409' then null; end;
end $$;
reset role;
-- Identical owner/status/order/limit boundary to the worker: old confirmed is excluded after discard.
select pg_temp.page_assert(not exists(select 1 from (select id from profile_observations where user_id='00000000-0000-4000-8000-000000000201' and status='confirmed' and source_created_at<'2026-10-04' order by source_created_at desc,id desc limit 20) targets where id='50000000-0000-4000-8000-000000000001'),'discard excludes later worker known targets');
select pg_temp.page_assert(not exists(select 1 from profile_settings where user_id in ('00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000202')),'read has no settings side effects');
rollback;
