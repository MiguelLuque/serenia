-- Synthetic actors. The auth shim is not JWT / PostgREST acceptance.
begin;
create function pg_temp.profile_assert(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'PROFILE REGRESSION: %',label; end if; end $$;
create function pg_temp.profile_deny(sql text) returns void language plpgsql as $$
begin
 begin execute sql; exception when insufficient_privilege or check_violation or foreign_key_violation or unique_violation or serialization_failure then return; end;
 raise exception 'PROFILE REGRESSION: operation unexpectedly accepted';
end $$;
insert into auth.users(id) values('00000000-0000-0000-0000-000000000101'),('00000000-0000-0000-0000-000000000102'),('00000000-0000-0000-0000-000000000103');
update user_profiles set informal_name='Synthetic',pronouns='elle',birth_date='1990-01-01',reason_for_consulting='Synthetic profile regression' where user_id::text like '%00000000010_';
insert into consents(user_id,consent_version,server_recorded,payload_json) select user_id,'technical-draft-2026-10-11',true,'{"birthDate":"1990-01-01"}' from user_profiles where user_id::text like '%00000000010_' and user_id<>'00000000-0000-0000-0000-000000000103';
insert into conversations(id,user_id) values('10000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000101'),('10000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000102');
insert into clinical_sessions(id,conversation_id,user_id) values('20000000-0000-0000-0000-000000000101','10000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000101'),('20000000-0000-0000-0000-000000000102','10000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000102');
-- Fail RED on missing schema before any permission assertion can mask it.
select pg_temp.profile_assert((select count(*) from profile_settings)=0,'default disabled');
do $$ declare signature text; begin
 foreach signature in array array['claim_profile_jobs(uuid,integer)','start_profile_job(uuid,uuid)','update_profile_job(uuid,uuid,text,text)','finish_profile_job(uuid,uuid,jsonb,text)'] loop
  perform pg_temp.profile_assert(not has_function_privilege('anon',signature,'execute') and not has_function_privilege('authenticated',signature,'execute') and has_function_privilege('service_role',signature,'execute'),'service RPC grants');
 end loop;
 foreach signature in array array['set_profile_enabled(boolean)','get_profile_memory()','review_profile_observation(uuid,text,timestamp with time zone)'] loop
  perform pg_temp.profile_assert(not has_function_privilege('anon',signature,'execute') and has_function_privilege('authenticated',signature,'execute') and not has_function_privilege('service_role',signature,'execute'),'owner RPC grants');
 end loop;
end $$;
set local role anon;
select pg_temp.profile_deny('select get_profile_memory()');
select pg_temp.profile_deny('select set_profile_enabled(true)');
select pg_temp.profile_deny('select * from profile_observations');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000103',true);
select pg_temp.profile_deny('select set_profile_enabled(true)');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',true);
select pg_temp.profile_assert(get_profile_memory()='{"enabled":false,"pending_jobs":0,"failed_jobs":0,"observations":[]}'::jsonb,'empty DTO');
select pg_temp.profile_deny('select claim_profile_jobs()');
select pg_temp.profile_deny('select * from profile_extraction_jobs');
select pg_temp.profile_deny('insert into profile_settings(user_id,enabled) values(auth.uid(),true)');
select pg_temp.profile_deny('select set_profile_enabled(null)');
reset role;
insert into messages(id,session_id,conversation_id,role,parts) values('40000000-0000-0000-0000-000000000100','20000000-0000-0000-0000-000000000101','10000000-0000-0000-0000-000000000101','user','[{"type":"text","text":"Before opt in"}]');
set local role authenticated;
select set_profile_enabled(true);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000102',true);
select set_profile_enabled(true);
select pg_temp.profile_assert((select count(*) from profile_settings)=1,'settings owner RLS');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',true);
reset role;
insert into messages(id,session_id,conversation_id,role,parts,created_at) values
 ('40000000-0000-0000-0000-000000000101','20000000-0000-0000-0000-000000000101','10000000-0000-0000-0000-000000000101','user','[{"type":"text","text":"Vivo en Sevilla. Quiero dormir mejor. Me ayuda pasear."}]',now()-interval '1 minute'),
 ('40000000-0000-0000-0000-000000000102','20000000-0000-0000-0000-000000000101','10000000-0000-0000-0000-000000000101','assistant','[{"type":"text","text":"No source"}]',now()),
 ('40000000-0000-0000-0000-000000000103','20000000-0000-0000-0000-000000000101','10000000-0000-0000-0000-000000000101','user','[{"type":"text","text":"Ahora vivo en Cádiz. Ahora vivo en Málaga."}]',now()),
 ('40000000-0000-0000-0000-000000000104','20000000-0000-0000-0000-000000000102','10000000-0000-0000-0000-000000000102','user','[{"type":"text","text":"Soy otro usuario."}]',now());
select pg_temp.profile_assert((select count(*) from profile_extraction_jobs)=3,'only new user messages enqueue');
-- Immutable sources reject privileged edits but permit unrelated visibility updates.
select pg_temp.profile_deny($q$update messages set parts='[]' where id='40000000-0000-0000-0000-000000000101'$q$);
select pg_temp.profile_deny($q$update messages set role='assistant' where id='40000000-0000-0000-0000-000000000101'$q$);
select pg_temp.profile_deny($q$update messages set created_at=now() where id='40000000-0000-0000-0000-000000000101'$q$);
select pg_temp.profile_deny($q$update messages set session_id=null where id='40000000-0000-0000-0000-000000000101'$q$);
update messages set visible_to_user=false where id='40000000-0000-0000-0000-000000000101';
-- Compound FKs reject privileged foreign source/session/owner; timestamp is source-owned.
select pg_temp.profile_deny($q$update profile_extraction_jobs set user_id='00000000-0000-0000-0000-000000000102' where source_message_id='40000000-0000-0000-0000-000000000101'$q$);
select pg_temp.profile_deny($q$update profile_extraction_jobs set source_created_at=now() where source_message_id='40000000-0000-0000-0000-000000000101'$q$);
set local role service_role;
select pg_temp.profile_deny('select get_profile_memory()');
select pg_temp.profile_deny('select set_profile_enabled(true)');
select pg_temp.profile_deny('select claim_profile_jobs(null,11)');
select pg_temp.profile_deny('select claim_profile_jobs(null,0)');
do $$ declare j profile_extraction_jobs%rowtype; o jsonb; tok uuid; begin
 select * into j from claim_profile_jobs('00000000-0000-0000-0000-000000000101',1);
 perform pg_temp.profile_assert(j.source_message_id='40000000-0000-0000-0000-000000000101' and j.attempts=1 and j.status='enqueued','oldest claimed');
 perform pg_temp.profile_assert(j.lease_until>clock_timestamp()+interval '119 seconds' and j.lease_until<=clock_timestamp()+interval '2 minutes','lease exactly two minutes');
 perform pg_temp.profile_assert((select count(*) from claim_profile_jobs(j.user_id,10))=0,'one active per user');
 perform pg_temp.profile_deny(format('select finish_profile_job(%L,%L,%L,%L)',j.id,j.token,'[]','synthetic'));
 perform pg_temp.profile_assert(start_profile_job(j.id,j.token),'start owned claim');
 perform pg_temp.profile_deny(format('select start_profile_job(%L,%L)',j.id,j.token));
 perform update_profile_job(j.id,j.token,'enqueued','synthetic-run');
 perform pg_temp.profile_assert((select status='running' and lease_until=j.lease_until from profile_extraction_jobs where id=j.id),'late enqueue does not regress or extend lease');
 o='[{"category":"context","quote":"Vivo en Sevilla.","time_scope":"current","supersedes_id":null},{"category":"goal","quote":"inventado","time_scope":"current","supersedes_id":null}]';
 perform pg_temp.profile_deny(format('select finish_profile_job(%L,%L,%L,%L)',j.id,j.token,o,'synthetic'));
 perform pg_temp.profile_assert(not exists(select 1 from profile_observations where job_id=j.id),'invalid batch has no partial writes');
 for o in select value from jsonb_array_elements('[null,{},[{"category":"diagnosis","quote":"Vivo","time_scope":"current","supersedes_id":null}],[{"category":"context","quote":"Vivo","time_scope":"current","supersedes_id":null,"diagnosis":"x"}],[{"category":"context","quote":"","time_scope":"current","supersedes_id":null}],[{"category":"context","quote":"Vivo","time_scope":"unknown","supersedes_id":null}],[{"category":"context","quote":"Vivo","time_scope":"current"}],[{"category":"context","quote":"Vivo","time_scope":"current","supersedes_id":"bad"}]]') loop
  perform pg_temp.profile_deny(format('select finish_profile_job(%L,%L,%L,%L)',j.id,j.token,o,'synthetic'));
 end loop;
 o='[{"category":"context","quote":"Vivo en Sevilla.","time_scope":"current","supersedes_id":null}]';
 perform pg_temp.profile_deny(format('select finish_profile_job(%L,%L,%L,%L)',j.id,j.token,o||o,'synthetic'));
 perform pg_temp.profile_deny(format('select finish_profile_job(%L,%L,%L,%L)',j.id,j.token,o||o||o||o||o||o,'synthetic'));
 perform finish_profile_job(j.id,j.token,o,'synthetic');
 perform finish_profile_job(j.id,j.token,o,'synthetic');
 perform pg_temp.profile_assert(not start_profile_job(j.id,j.token),'completed replay false');
 perform update_profile_job(j.id,j.token,'enqueued','synthetic-run');
 perform pg_temp.profile_assert((select count(*) from profile_observations where job_id=j.id)=1,'replay without duplication');
 perform pg_temp.profile_deny(format('select update_profile_job(%L,%L,%L)',j.id,j.token,'failed'));
 perform pg_temp.profile_deny(format('select finish_profile_job(%L,%L,%L,%L)',j.id,gen_random_uuid(),o,'synthetic'));
end $$;
set local role authenticated;
do $$ declare o profile_observations%rowtype; begin
 select * into o from profile_observations;
 perform pg_temp.profile_deny(format('update profile_observations set status=%L where id=%L','confirmed',o.id));
 perform pg_temp.profile_deny(format('select review_profile_observation(%L,%L,%L)',o.id,'confirm',o.updated_at-interval '1 second'));
 perform review_profile_observation(o.id,'confirm',o.updated_at);
 perform pg_temp.profile_deny(format('select review_profile_observation(%L,%L,%L)',o.id,'confirm',o.updated_at));
 perform pg_temp.profile_assert((get_profile_memory()->'observations'->0->>'session_id')='20000000-0000-0000-0000-000000000101','DTO source session');
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000102',true);
select pg_temp.profile_assert((select count(*) from profile_observations)=0,'foreign observations invisible');
reset role;
do $$ declare oid uuid; stamp timestamptz; begin select id,updated_at into oid,stamp from profile_observations; set local role authenticated; perform pg_temp.profile_deny(format('select review_profile_observation(%L,%L,%L)',oid,'reject',stamp)); end $$;
reset role;
set local role service_role;
do $$ declare j profile_extraction_jobs%rowtype; target uuid; o jsonb; begin
 select id into target from profile_observations;
 select * into j from claim_profile_jobs('00000000-0000-0000-0000-000000000102',1);
 perform start_profile_job(j.id,j.token);
 o=jsonb_build_array(jsonb_build_object('category','context','quote','Soy otro usuario.','time_scope','current','supersedes_id',target));
 perform pg_temp.profile_deny(format('select finish_profile_job(%L,%L,%L,%L)',j.id,j.token,o,'synthetic'));
 perform finish_profile_job(j.id,j.token,'[]','synthetic');
 select * into j from claim_profile_jobs('00000000-0000-0000-0000-000000000101',1);
 perform start_profile_job(j.id,j.token);
 o=jsonb_build_array(jsonb_build_object('category','goal','quote','Ahora vivo en Cádiz.','time_scope','current','supersedes_id',target));
 perform pg_temp.profile_deny(format('select finish_profile_job(%L,%L,%L,%L)',j.id,j.token,o,'synthetic'));
 o=jsonb_build_array(jsonb_build_object('category','context','quote','Ahora vivo en Cádiz.','time_scope','current','supersedes_id',target),jsonb_build_object('category','context','quote','Ahora vivo en Málaga.','time_scope','current','supersedes_id',target));
 perform finish_profile_job(j.id,j.token,o,'synthetic');
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',true);
-- Review I1: a pending correction remains confirmable after its target was rejected.
-- Restore this fixture afterward so existing confirmed-target transitions remain covered.
-- Admin-only fixture isolates the target-state guard; clients cannot mutate status.
savepoint profile_superseded_target;
reset role;
update profile_observations set status='superseded' where quote='Vivo en Sevilla.';
set local role authenticated;
do $$ declare b profile_observations%rowtype; begin
 select * into b from profile_observations where quote='Ahora vivo en Cádiz.';
 perform pg_temp.profile_deny(format('select review_profile_observation(%L,%L,%L)',b.id,'confirm',b.updated_at));
 perform pg_temp.profile_assert((select status='pending' and updated_at=b.updated_at from profile_observations where id=b.id),'superseded target rejects confirmation without changing correction');
 perform pg_temp.profile_assert((select status='superseded' from profile_observations where id=b.supersedes_id),'superseded target is never restored');
end $$;
rollback to savepoint profile_superseded_target;
release savepoint profile_superseded_target;
savepoint profile_rejected_target;
do $$ declare a profile_observations%rowtype; b profile_observations%rowtype; sibling profile_observations%rowtype; rejected_version timestamptz; begin
 select * into a from profile_observations where quote='Vivo en Sevilla.';
 select * into b from profile_observations where quote='Ahora vivo en Cádiz.';
 select * into sibling from profile_observations where quote='Ahora vivo en Málaga.';
 perform review_profile_observation(a.id,'reject',a.updated_at);
 select updated_at into rejected_version from profile_observations where id=a.id;
 perform pg_temp.profile_assert(rejected_version>a.updated_at,'reject target advances its version');
 perform pg_temp.profile_deny(format('select review_profile_observation(%L,%L,%L)',b.id,'confirm',b.updated_at-interval '1 second'));
 perform review_profile_observation(b.id,'confirm',b.updated_at);
 perform pg_temp.profile_assert((select status='rejected' and updated_at=rejected_version from profile_observations where id=a.id),'confirm correction preserves rejected target and version');
 perform pg_temp.profile_assert((select status='confirmed' and supersedes_id=a.id and updated_at>b.updated_at from profile_observations where id=b.id),'confirm new source retains provenance and advances version');
 perform pg_temp.profile_assert((select status='superseded' and supersedes_id=a.id and updated_at>sibling.updated_at from profile_observations where id=sibling.id),'confirm resolves pending siblings and advances versions');
 perform pg_temp.profile_deny(format('select review_profile_observation(%L,%L,%L)',b.id,'reject',b.updated_at));
 perform pg_temp.profile_deny(format('select review_profile_observation(%L,%L,%L)',sibling.id,'confirm',sibling.updated_at));
 select * into b from profile_observations where id=b.id;
 perform review_profile_observation(b.id,'reject',b.updated_at);
 perform pg_temp.profile_assert((select status='rejected' and updated_at=rejected_version from profile_observations where id=a.id),'reject correction does not restore its rejected target');
 select * into sibling from profile_observations where id=sibling.id;
 perform pg_temp.profile_deny(format('select review_profile_observation(%L,%L,%L)',sibling.id,'confirm',sibling.updated_at));
end $$;
rollback to savepoint profile_rejected_target;
release savepoint profile_rejected_target;
do $$ declare o profile_observations%rowtype; begin
 perform pg_temp.profile_assert(exists(select 1 from jsonb_array_elements(get_profile_memory()->'observations') x where x->>'quote'='Vivo en Sevilla.' and (x->>'disputed')::boolean),'pending correction disputes target');
 select * into o from profile_observations where quote='Ahora vivo en Cádiz.';
 perform review_profile_observation(o.id,'reject',o.updated_at);
 perform pg_temp.profile_assert(exists(select 1 from jsonb_array_elements(get_profile_memory()->'observations') x where x->>'quote'='Vivo en Sevilla.' and (x->>'disputed')::boolean),'remaining sibling still disputes');
 select * into o from profile_observations where quote='Ahora vivo en Málaga.';
 perform review_profile_observation(o.id,'confirm',o.updated_at);
 perform pg_temp.profile_assert((select status from profile_observations where quote='Vivo en Sevilla.')='superseded','confirmation supersedes old');
 select * into o from profile_observations where quote='Vivo en Sevilla.';
 perform pg_temp.profile_deny(format('select review_profile_observation(%L,%L,%L)',o.id,'confirm',o.updated_at));
 select * into o from profile_observations where quote='Ahora vivo en Málaga.';
 perform review_profile_observation(o.id,'reject',o.updated_at);
 perform pg_temp.profile_assert((select status from profile_observations where quote='Vivo en Sevilla.')='superseded','reject does not resurrect old');
end $$;
reset role;
-- Queue backoff, expiry and consent epochs. All timestamps manipulated only by test admin.
insert into messages(id,session_id,conversation_id,role,parts,created_at) values
 ('40000000-0000-0000-0000-000000000105','20000000-0000-0000-0000-000000000101','10000000-0000-0000-0000-000000000101','user','[{"type":"text","text":"Me ayuda pasear."}]',now()+interval '1 second'),
 ('40000000-0000-0000-0000-000000000106','20000000-0000-0000-0000-000000000101','10000000-0000-0000-0000-000000000101','user','[{"type":"text","text":"Quiero dormir mejor."}]',now()+interval '2 seconds');
create temp table profile_old_claim as select id,token,consent_epoch from profile_extraction_jobs where false;
grant all on profile_old_claim to service_role;
set local role service_role;
insert into profile_old_claim select id,token,consent_epoch from claim_profile_jobs('00000000-0000-0000-0000-000000000101',1);
select update_profile_job(id,token,'failed') from profile_old_claim;
select pg_temp.profile_assert((select count(*) from claim_profile_jobs('00000000-0000-0000-0000-000000000101',1))=0,'backoff blocks newer source');
reset role;
select pg_temp.profile_assert((select available_at>clock_timestamp()+interval '29 seconds' and status='pending' from profile_extraction_jobs where id=(select id from profile_old_claim)),'failure backoff thirty seconds');
update profile_extraction_jobs set available_at=now()-interval '1 second' where id=(select id from profile_old_claim);
set local role service_role;
select pg_temp.profile_assert((select attempts=2 and id=(select id from profile_old_claim) from claim_profile_jobs('00000000-0000-0000-0000-000000000101',1)),'retry same oldest');
select pg_temp.profile_deny(format('select start_profile_job(%L,%L)',id,token)) from profile_old_claim;
reset role;
update profile_extraction_jobs set lease_until=now()-interval '1 second' where id=(select id from profile_old_claim);
set local role service_role;
select pg_temp.profile_deny(format('select start_profile_job(%L,%L)',id,token)) from profile_extraction_jobs where id=(select id from profile_old_claim);
select pg_temp.profile_deny(format('select update_profile_job(%L,%L,%L)',id,token,'failed')) from profile_extraction_jobs where id=(select id from profile_old_claim);
select pg_temp.profile_deny(format('select finish_profile_job(%L,%L,%L,%L)',id,token,'[]','synthetic')) from profile_extraction_jobs where id=(select id from profile_old_claim);
select pg_temp.profile_assert((select attempts=3 and id=(select id from profile_old_claim) from claim_profile_jobs('00000000-0000-0000-0000-000000000101',1)),'expired lease reclaims same job');
reset role;
update profile_extraction_jobs set lease_until=now()-interval '1 second' where id=(select id from profile_old_claim);
set local role service_role;
select pg_temp.profile_assert((select source_message_id='40000000-0000-0000-0000-000000000106' and attempts=1 from claim_profile_jobs('00000000-0000-0000-0000-000000000101',1)),'exhaustion allows next');
select pg_temp.profile_assert((select status from profile_extraction_jobs where id=(select id from profile_old_claim))='exhausted','max three claims');
select start_profile_job(id,token) from profile_extraction_jobs where source_message_id='40000000-0000-0000-0000-000000000106';
truncate profile_old_claim;
insert into profile_old_claim select id,token,consent_epoch from profile_extraction_jobs where source_message_id='40000000-0000-0000-0000-000000000106';
set local role authenticated;
select pg_temp.profile_assert((get_profile_memory()->>'failed_jobs')::integer=1 and (get_profile_memory()->>'pending_jobs')::integer=1,'current epoch failures and pending count');
select set_profile_enabled(false);
select pg_temp.profile_assert((get_profile_memory()->>'enabled')::boolean=false and (get_profile_memory()->>'failed_jobs')::integer=0 and (get_profile_memory()->>'pending_jobs')::integer=0,'opt out reflected and old epoch omitted');
select set_profile_enabled(true);
set local role service_role;
select pg_temp.profile_deny(format('select finish_profile_job(%L,%L,%L,%L)',id,token,'[]','synthetic')) from profile_old_claim;
select pg_temp.profile_assert((select count(*) from claim_profile_jobs('00000000-0000-0000-0000-000000000101',1))=0,'reenable no resurrection or backfill');
reset role;
select pg_temp.profile_assert((select status='cancelled' and token<>(select token from profile_old_claim) from profile_extraction_jobs where id=(select id from profile_old_claim)),'disable rotates active token');
select pg_temp.profile_assert((select consent_epoch>(select consent_epoch from profile_old_claim) from profile_settings where user_id='00000000-0000-0000-0000-000000000101'),'disable epoch');
-- Bounded canonical text, no assistant parts, no oversized source or quotes.
insert into messages(id,session_id,conversation_id,role,parts,created_at) values
 ('40000000-0000-0000-0000-000000000107','20000000-0000-0000-0000-000000000101','10000000-0000-0000-0000-000000000101','user',jsonb_build_array(jsonb_build_object('type','text','text',repeat('x',8001))),now()+interval '3 seconds');
set local role service_role;
do $$ declare j profile_extraction_jobs%rowtype; begin
 select * into j from claim_profile_jobs('00000000-0000-0000-0000-000000000101',1);
 perform start_profile_job(j.id,j.token);
 perform pg_temp.profile_deny(format('select finish_profile_job(%L,%L,%L,%L)',j.id,j.token,'[]','synthetic'));
 perform update_profile_job(j.id,j.token,'failed');
end $$;
reset role;
select pg_temp.profile_assert(profile_message_text('[{"type":"text","text":"Primera ñ"},{"type":"tool","text":"not source"},{"type":"text","text":"Segunda 😀"}]')=E'Primera ñ\nSegunda 😀','canonical Unicode source');
insert into messages(id,session_id,conversation_id,role,parts,created_at) values
 ('40000000-0000-0000-0000-000000000108','20000000-0000-0000-0000-000000000102','10000000-0000-0000-0000-000000000102','user',jsonb_build_array(jsonb_build_object('type','text','text',repeat('x',8000))),now()+interval '4 seconds');
set local role service_role;
do $$ declare j profile_extraction_jobs%rowtype; o jsonb; begin
 select * into j from claim_profile_jobs('00000000-0000-0000-0000-000000000102',1);
 perform start_profile_job(j.id,j.token);
 o=jsonb_build_array(jsonb_build_object('category','context','quote',repeat('x',401),'time_scope','current','supersedes_id',null));
 perform pg_temp.profile_deny(format('select finish_profile_job(%L,%L,%L,%L)',j.id,j.token,o,'synthetic'));
 o=jsonb_build_array(jsonb_build_object('category','context','quote',repeat('x',400),'time_scope','current','supersedes_id',null));
 perform pg_temp.profile_deny(format('select finish_profile_job(%L,%L,%L,%L)',j.id,j.token,jsonb_set(o,'{0,user_id}','"00000000-0000-0000-0000-000000000101"'),'synthetic'));
 perform finish_profile_job(j.id,j.token,o,'synthetic');
end $$;
reset role;
-- Delete source cascades its observations; deleting the actor clears settings/jobs/observations.
delete from messages where id='40000000-0000-0000-0000-000000000101';
select pg_temp.profile_assert(not exists(select 1 from profile_observations where source_message_id='40000000-0000-0000-0000-000000000101'),'source cascade');
select pg_temp.profile_assert((select count(*) from profile_observations where source_message_id='40000000-0000-0000-0000-000000000103' and supersedes_id is null)=2,'target deletion preserves independent correction sources');
delete from auth.users where id in ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000102');
select pg_temp.profile_assert(not exists(select 1 from profile_settings) and not exists(select 1 from profile_extraction_jobs) and not exists(select 1 from profile_observations),'user cascade');
rollback;
