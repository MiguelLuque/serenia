\set ON_ERROR_STOP on
-- Cross-owner parent checks also apply to elevated server writes.
set role service_role;
select pg_temp.must_deny($q$insert into session_summaries(session_id,user_id,summary_json) values('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','{}')$q$);
select pg_temp.must_deny($q$insert into questionnaire_instances(user_id,session_id,questionnaire_id) select '00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002',id from questionnaire_definitions limit 1$q$);
select pg_temp.must_deny($q$insert into questionnaire_instances(user_id,conversation_id,questionnaire_id) select '00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002',id from questionnaire_definitions limit 1$q$);
select pg_temp.must_deny($q$insert into risk_events(user_id,session_id,source_type,risk_type,severity) values('00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','message','severe_distress','low')$q$);
select pg_temp.must_deny($q$insert into patient_tasks(user_id,acordada_en_session_id,acordada_en_assessment_id,descripcion) values('00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','Synthetic foreign task')$q$);
select pg_temp.must_deny($q$insert into assessments(user_id,session_id,summary_json,supersedes_assessment_id) values('00000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','{}','30000000-0000-0000-0000-000000000001')$q$);
select pg_temp.must_deny($q$insert into assessments(user_id,summary_json,status) values('00000000-0000-0000-0000-000000000001','{}','reviewed_confirmed')$q$);
select pg_temp.must_deny($q$insert into patient_context_injections(user_id,session_id,tier,risk_state,block_char_count,pending_tasks_count,risk_triggered) values('00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','none','none',0,0,false)$q$);

-- Items from another definition must not be accepted for a valid instance.
insert into questionnaire_instances(id,user_id,questionnaire_id)
select '40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',id
from questionnaire_definitions where code='PHQ9';
select pg_temp.must_deny($q$insert into questionnaire_answers(instance_id,item_id,answer_raw)
 select '40000000-0000-0000-0000-000000000001',i.id,'0' from questionnaire_items i join questionnaire_definitions d on d.id=i.questionnaire_id where d.code='GAD7' limit 1$q$);
reset role;

-- A failed edit involving a foreign inherited task must roll back revision,
-- supersession, and task materialization together.
insert into patient_tasks(id,user_id,acordada_en_session_id,acordada_en_assessment_id,descripcion)
values('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','Synthetic inherited task');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
select pg_temp.must_deny($q$select review_assessment_atomic('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','confirm')$q$);
do $$ declare a uuid; n integer; begin
 select id into a from assessments where session_id='20000000-0000-0000-0000-000000000001' and status='reviewed_modified';
 select count(*) into n from assessments;
 perform pg_temp.must_deny(format('select review_assessment_atomic(%L,%L,%L,%L,null,%L)',
  '20000000-0000-0000-0000-000000000001',a,'modify','{"proposed_tasks":[]}',
  '[{"id":"50000000-0000-0000-0000-000000000001","estado":"cumplida"}]'));
 if (select count(*) from assessments)<>n then raise exception 'foreign edit left revision'; end if;
 if not exists(select 1 from assessments where id=a and status='reviewed_modified') then raise exception 'foreign edit superseded revision'; end if;
 if not exists(select 1 from patient_tasks where id='50000000-0000-0000-0000-000000000001' and closed_at is null) then raise exception 'foreign task changed'; end if;
end $$;
reset role;
-- Keep the subsequent concurrent task-count regression isolated.
delete from patient_tasks where id='50000000-0000-0000-0000-000000000001';

-- Preserve the original inherited-task semantics in real SQL: terminal
-- states close tasks with the new revision, partial progress remains open.
insert into clinical_sessions(id,conversation_id,user_id,status) values
 ('20000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','closed');
insert into assessments(id,user_id,session_id,assessment_type,status,summary_json,reviewed_by,reviewed_at) values
 ('30000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','closure','reviewed_confirmed','{"proposed_tasks":[]}','00000000-0000-0000-0000-000000000003',now());
insert into patient_tasks(id,user_id,acordada_en_session_id,acordada_en_assessment_id,descripcion) values
 ('50000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000004','Synthetic completed task'),
 ('50000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000004','Synthetic partial task');
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
do $$ declare a uuid; replacement uuid; retry uuid; updates jsonb; begin
 select id into a from assessments where session_id='20000000-0000-0000-0000-000000000001' and status='reviewed_modified';
 updates='[{"id":"50000000-0000-0000-0000-000000000004","estado":"cumplida","nota":"Synthetic complete"},{"id":"50000000-0000-0000-0000-000000000005","estado":"parcial","nota":""}]';
 replacement=review_assessment_atomic('20000000-0000-0000-0000-000000000001',a,'modify','{"proposed_tasks":[]}',null,updates);
 retry=review_assessment_atomic('20000000-0000-0000-0000-000000000001',a,'modify','{"proposed_tasks":[]}',null,updates);
 if replacement<>retry then raise exception 'inherited update retry duplicated revision'; end if;
 if not exists(select 1 from patient_tasks where id='50000000-0000-0000-0000-000000000004' and estado='cumplida' and closed_at is not null and closed_by_assessment_id=replacement and nota='Synthetic complete') then raise exception 'completed inherited task not closed'; end if;
 if not exists(select 1 from patient_tasks where id='50000000-0000-0000-0000-000000000005' and estado='parcial' and closed_at is null and closed_by_assessment_id is null and nota is null) then raise exception 'partial inherited task not open'; end if;
 if exists(select 1 from patient_tasks where acordada_en_session_id='20000000-0000-0000-0000-000000000001' and closed_at is null) then raise exception 'empty proposed tasks left an active task'; end if;
end $$;
reset role;
delete from clinical_sessions where id='20000000-0000-0000-0000-000000000004';
