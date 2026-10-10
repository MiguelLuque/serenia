\set ON_ERROR_STOP on
insert into auth.users(id) values
 ('00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000002'),
 ('00000000-0000-0000-0000-000000000003');
update user_profiles set role='clinician' where user_id='00000000-0000-0000-0000-000000000003';
insert into conversations(id,user_id) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002');
insert into clinical_sessions(id,conversation_id,user_id) values
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001'),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002');

-- Execute each exploit in a subtransaction, so even an insecure baseline
-- cannot contaminate the next actor/test. A successful exploit fails the test.
create function pg_temp.must_deny(statement text) returns void language plpgsql as $$
begin
 begin
  execute statement;
 exception when insufficient_privilege or foreign_key_violation or check_violation then return;
 end;
 raise exception 'SECURITY REGRESSION: accepted %', statement;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select pg_temp.must_deny($q$update user_profiles set role='clinician' where user_id=auth.uid()$q$);
select pg_temp.must_deny($q$select close_session_atomic('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','user_request')$q$);
select pg_temp.must_deny($q$insert into assessments(user_id,summary_json,status,generated_by) values(auth.uid(),'{}','reviewed_confirmed','clinician')$q$);
select pg_temp.must_deny($q$insert into messages(conversation_id,role,parts) values('10000000-0000-0000-0000-000000000001','assistant','[]')$q$);
do $$ begin
 if exists(select 1 from user_profiles where user_id='00000000-0000-0000-0000-000000000002') then raise exception 'patient B exposed'; end if;
end $$;
reset role;
select pg_temp.must_deny($q$insert into clinical_sessions(conversation_id,user_id,status) values('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','closed')$q$);
select pg_temp.must_deny($q$insert into messages(conversation_id,session_id,role) values('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','user')$q$);
select pg_temp.must_deny($q$insert into assessments(user_id,session_id,summary_json) values('00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','{}')$q$);
set role anon;
select pg_temp.must_deny($q$select close_session_atomic('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','user_request')$q$);
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select close_session_atomic('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','user_request');
select close_session_atomic('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','inactivity');
do $$ begin
 if not exists(select 1 from clinical_sessions s join conversations c on c.id=s.conversation_id where s.id='20000000-0000-0000-0000-000000000001' and s.status='closed' and c.status='closed' and s.closed_at=c.ended_at and s.closure_reason='user_request') then raise exception 'closure not atomic or idempotent'; end if;
end $$;
reset role;
insert into assessments(id,user_id,session_id,assessment_type,summary_json) values
 ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','closure','{"proposed_tasks":[{"descripcion":"Synthetic first task"}]}');
set role authenticated;
select pg_temp.must_deny($q$select review_assessment_atomic('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','confirm')$q$);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
select review_assessment_atomic('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','confirm');
select review_assessment_atomic('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','confirm');
do $$ begin
 if (select count(*) from patient_tasks where closed_at is null) <> 1 then raise exception 'duplicate tasks after confirmation'; end if;
end $$;
select review_assessment_atomic('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','modify','{"proposed_tasks":[{"descripcion":"Synthetic replacement task"}]}');
select review_assessment_atomic('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','modify','{"proposed_tasks":[{"descripcion":"Synthetic replacement task"}]}');
do $$ begin
 if (select count(*) from assessments where status not in ('superseded','rejected')) <> 1 then raise exception 'duplicate live closures'; end if;
 if (select count(*) from patient_tasks where closed_at is null) <> 1 then raise exception 'duplicate active tasks'; end if;
 if (select count(*) from patient_tasks) <> 2 then raise exception 'task history lost or duplicated'; end if;
end $$;
reset role;
select 'PASS authorization, ownership, closure, review and tasks' as result;

-- The whole revision rolls back when task materialization fails after insert.
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
do $$ declare a uuid; begin
 select id into a from assessments where session_id='20000000-0000-0000-0000-000000000001' and status='reviewed_modified';
 perform pg_temp.must_deny(format('select review_assessment_atomic(%L,%L,%L,%L)', '20000000-0000-0000-0000-000000000001',a,'modify','{"proposed_tasks":[{"descripcion":"x"}]}'));
 if not exists(select 1 from assessments where id=a and status='reviewed_modified') then raise exception 'failed review superseded original'; end if;
 if (select count(*) from patient_tasks where closed_at is null)<>1 then raise exception 'failed review altered tasks'; end if;
end $$;
reset role;

-- Regeneration uses clinician authorization and compare-and-set/restore.
set role service_role;
select close_session_atomic('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','inactivity');
reset role;
insert into assessments(id,user_id,session_id,assessment_type,status,summary_json) values
 ('30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','closure','requires_manual_review','{"proposed_tasks":[]}');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select pg_temp.must_deny($q$select regenerate_assessment_atomic('30000000-0000-0000-0000-000000000002','requires_manual_review')$q$);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
do $$ begin
 if not regenerate_assessment_atomic('30000000-0000-0000-0000-000000000002','requires_manual_review') then raise exception 'prepare failed'; end if;
 if regenerate_assessment_atomic('30000000-0000-0000-0000-000000000002','requires_manual_review') then raise exception 'double prepare'; end if;
 if not regenerate_assessment_atomic('30000000-0000-0000-0000-000000000002','requires_manual_review',true) then raise exception 'rollback failed'; end if;
end $$;
reset role;
