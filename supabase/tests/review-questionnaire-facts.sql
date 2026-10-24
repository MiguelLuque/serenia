\set ON_ERROR_STOP on
begin;
insert into clinical_sessions(id,conversation_id,user_id,status)
select ('20000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
 '10000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-0000-000000000001','closed'
from generate_series(30,33) n;
insert into assessments(id,user_id,session_id,assessment_type,summary_json)
select ('30000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000001',
 ('20000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,'closure',
 case n
 when 30 then '{"proposed_tasks":[{"descripcion":"Synthetic agreement","nota":null}],"questionnaires":[{"code":"PHQ9","score":12,"band":"moderate","flags":[{"itemOrder":9,"reason":"suicidality"}]},{"code":"PHQ9","score":1,"band":"minimal","flags":[]}]}'::jsonb
 when 31 then '{"proposed_tasks":[]}'::jsonb
 when 32 then '{"proposed_tasks":[],"questionnaires":null}'::jsonb
 else '{"proposed_tasks":[],"questionnaires":[]}'::jsonb end
from generate_series(30,33) n;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
do $$
declare sid uuid:='20000000-0000-0000-0000-000000000030';
 aid uuid:='30000000-0000-0000-0000-000000000030';
 original jsonb; changed jsonb; snapshots jsonb; revision uuid; retry uuid;
 facts jsonb; mutation jsonb; denied boolean; n integer;
begin
 select summary_json into original from assessments where id=aid;
 facts=original->'questionnaires';
 perform review_assessment_atomic(sid,aid,'confirm');
 snapshots=jsonb_build_object('assessments',(select jsonb_agg(to_jsonb(a) order by id) from assessments a),
  'tasks',(select jsonb_agg(to_jsonb(t) order by id) from patient_tasks t));
 -- Each direct authenticated RPC must fail before any revision/task effect.
 for mutation in select value from jsonb_array_elements(jsonb_build_array(
  jsonb_set(original,'{questionnaires,0,code}','"FAKE"'),
  jsonb_set(original,'{questionnaires,0,score}','99'),
  jsonb_set(original,'{questionnaires,0,band}','"invented"'),
  jsonb_set(original,'{questionnaires,0,flags}','[]'),
  original-'questionnaires',jsonb_set(original,'{questionnaires}','null'),
  jsonb_set(original,'{questionnaires}','[]'),
  jsonb_set(original,'{questionnaires}',jsonb_build_array(facts->1,facts->0)),
  jsonb_set(original,'{questionnaires}',facts || facts)))
  union all select null::jsonb loop
  denied=false;
  begin
   perform review_assessment_atomic(sid,aid,'modify',mutation);
  exception when check_violation then
   if sqlerrm<>'Questionnaire scoring facts are immutable' then raise; end if;
   denied=true;
  end;
  if not denied then raise exception 'QUESTIONNAIRE FACTS REGRESSION: clinician changed scored facts'; end if;
  if jsonb_build_object('assessments',(select jsonb_agg(to_jsonb(a) order by id) from assessments a),
   'tasks',(select jsonb_agg(to_jsonb(t) order by id) from patient_tasks t)) is distinct from snapshots then
   raise exception 'Rejected fact edit changed assessments/tasks/history';
  end if;
 end loop;
 changed=original || '{"patient_facing_summary":"Synthetic narrative edit","risk_assessment":{"suicidality":"passive"}}'::jsonb;
 revision=review_assessment_atomic(sid,aid,'modify',changed,'Synthetic notes');
 retry=review_assessment_atomic(sid,aid,'modify',changed,'Synthetic notes');
 if revision<>retry or (select summary_json from assessments where id=revision) is distinct from changed
  or (select count(*) from patient_tasks where acordada_en_session_id=sid)<>1
  or (select count(*) from assessments where session_id=sid)<>2 then
  raise exception 'Unchanged facts blocked narrative edit or broke exact retry/task identities';
 end if;
 -- Existing authorization and parent binding still deny direct callers.
 perform pg_temp.must_deny(format('select review_assessment_atomic(%L,%L,%L,%L)',
  '20000000-0000-0000-0000-000000000031',revision,'modify',changed));
 -- A later inherited-task failure must roll back the revision and status too.
 snapshots=jsonb_build_object('assessments',(select jsonb_agg(to_jsonb(a) order by id) from assessments a),
  'tasks',(select jsonb_agg(to_jsonb(t) order by id) from patient_tasks t));
 perform pg_temp.must_deny(format('select review_assessment_atomic(%L,%L,%L,%L,null,%L)',
  sid,revision,'modify',changed,'[{"id":"40000000-0000-0000-0000-000000000099","estado":"cumplida"}]'));
 if jsonb_build_object('assessments',(select jsonb_agg(to_jsonb(a) order by id) from assessments a),
  'tasks',(select jsonb_agg(to_jsonb(t) order by id) from patient_tasks t)) is distinct from snapshots then
  raise exception 'Failed review transaction changed history/tasks';
 end if;
 -- Identical missing, JSON-null and empty legacy fields remain editable;
 -- missing and JSON-null are deliberately distinct, never coalesced to [].
 for n in 31..33 loop
  sid=('20000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid;
  aid=('30000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid;
  select summary_json into original from assessments where id=aid;
  changed=original || '{"patient_facing_summary":"Legacy narrative edit"}'::jsonb;
  revision=review_assessment_atomic(sid,aid,'modify',changed);
  if review_assessment_atomic(sid,aid,'modify',changed)<>revision then raise exception 'Legacy exact retry changed ID'; end if;
  mutation=case when n=31 then jsonb_set(changed,'{questionnaires}','null')
   when n=32 then changed-'questionnaires'
   else jsonb_set(changed,'{questionnaires}',facts) end;
  denied=false;
  begin perform review_assessment_atomic(sid,revision,'modify',mutation);
  exception when check_violation then
   if sqlerrm<>'Questionnaire scoring facts are immutable' then raise; end if;
   denied=true;
  end;
  if not denied then raise exception 'Legacy questionnaire boundary conflated missing/null/empty'; end if;
 end loop;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select pg_temp.must_deny($q$select review_assessment_atomic('20000000-0000-0000-0000-000000000030','30000000-0000-0000-0000-000000000030','modify','{"proposed_tasks":[],"questionnaires":[]}')$q$);
reset role;
rollback;
