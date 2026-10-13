begin;
create function pg_temp.must_deny(statement text) returns void language plpgsql as $$
begin
 begin execute statement; exception when insufficient_privilege or check_violation then return; end;
 raise exception 'INBOX REGRESSION: accepted %',statement;
end $$;
-- 105 recent reviewed rows plus an old urgent/missing report outside the
-- previous newest100 window. DB candidate snapshots must remain bounded.
do $$ declare n integer; cid uuid; sid uuid; begin
 for n in 1..105 loop
  cid=md5('inbox-conversation-'||n)::uuid; sid=md5('inbox-session-'||n)::uuid;
  insert into conversations(id,user_id,status,ended_at) values(cid,'00000000-0000-0000-0000-000000000002','closed',now()-make_interval(days=>n));
  insert into clinical_sessions(id,user_id,conversation_id,status,opened_at,closed_at,closure_reason) values(sid,'00000000-0000-0000-0000-000000000002',cid,'closed',now()-make_interval(days=>n)-interval '1 hour',now()-make_interval(days=>n),'user_request');
  insert into assessments(user_id,session_id,assessment_type,status,summary_json,reviewed_by,reviewed_at) values('00000000-0000-0000-0000-000000000002',sid,'closure','reviewed_confirmed','{}','00000000-0000-0000-0000-000000000003',now());
 end loop;
 insert into conversations(id,user_id,status,ended_at) values('10000000-0000-0000-0000-000000000091','00000000-0000-0000-0000-000000000001','closed',now()-interval '200 days');
 insert into clinical_sessions(id,user_id,conversation_id,status,opened_at,closed_at,closure_reason) values('20000000-0000-0000-0000-000000000091','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000091','closed',now()-interval '201 days',now()-interval '200 days','user_request');
 insert into risk_events(user_id,session_id,conversation_id,risk_type,severity,source_type,status) values('00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000091','10000000-0000-0000-0000-000000000091','suicidal_ideation','critical','conversation','open');
end $$;
update user_profiles set display_name=null,informal_name='Synthetic informal' where user_id='00000000-0000-0000-0000-000000000001';
-- Isolated longitudinal snapshots: literal expected scores, no JS histories.
insert into auth.users(id) values('00000000-0000-0000-0000-000000000091'),('00000000-0000-0000-0000-000000000092');
update user_profiles set display_name=null,informal_name='Longitudinal A' where user_id='00000000-0000-0000-0000-000000000091';
do $$ declare n integer; cid uuid; sid uuid; aid uuid; qi uuid; dates text[]:=array['2026-03-01','2026-03-05','2026-03-15','2026-04-19']; scores integer[]:=array[24,18,15,12]; uid uuid:='00000000-0000-0000-0000-000000000091'; doc jsonb;
begin
 doc='{"chief_complaint":"","presenting_issues":[],"mood_affect":"","cognitive_patterns":[],"risk_assessment":{"suicidality":"none","self_harm":"none","notes":""},"questionnaires":[],"areas_for_exploration":[],"preliminary_impression":"","recommended_actions_for_clinician":[],"patient_facing_summary":""}';
 for n in 1..4 loop
  cid=md5('long-conversation-'||n)::uuid; sid=md5('long-session-'||n)::uuid; aid=md5('long-assessment-'||n)::uuid;
  insert into conversations(id,user_id,status,ended_at) values(cid,uid,'closed',dates[n]::timestamptz);
  insert into clinical_sessions(id,user_id,conversation_id,status,opened_at,closed_at) values(sid,uid,cid,'closed',dates[n]::timestamptz-interval '1 hour',dates[n]::timestamptz);
  insert into assessments(id,user_id,session_id,assessment_type,status,summary_json,reviewed_by,reviewed_at) values(aid,uid,sid,'closure','reviewed_confirmed',doc,'00000000-0000-0000-0000-000000000003',dates[n]::timestamptz);
  insert into questionnaire_instances(user_id,session_id,conversation_id,questionnaire_id,status,scored_at) values(uid,sid,cid,(select id from questionnaire_definitions where code='PHQ9'),'scored',dates[n]::timestamptz) returning id into qi;
  insert into questionnaire_results(instance_id,total_score,severity_band,requires_review) values(qi,scores[n],'synthetic',false);
 end loop;
 insert into patient_tasks(user_id,acordada_en_session_id,acordada_en_assessment_id,descripcion,estado) values(uid,sid,aid,'Synthetic pending','pendiente'),(uid,sid,aid,'Synthetic partial','parcial'),(uid,sid,aid,'Synthetic completed','cumplida');
 for n in 1..4 loop
  insert into questionnaire_instances(user_id,session_id,conversation_id,questionnaire_id,status,scored_at) values(uid,sid,cid,(select id from questionnaire_definitions where code=(array['GAD7','GAD7','BDI2','BAI'])[n]),'scored',(array['2026-03-10','2026-04-19','2026-04-19','2026-04-19'])[n]::timestamptz) returning id into qi;
  insert into questionnaire_results(instance_id,total_score,severity_band,requires_review) values(qi,(array[10,8,20,16])[n],'synthetic',false);
 end loop;
 uid='00000000-0000-0000-0000-000000000092'; cid=md5('long-other-conv')::uuid; sid=md5('long-other-session')::uuid;
 insert into conversations(id,user_id,status,ended_at) values(cid,uid,'closed','2026-04-21');
 insert into clinical_sessions(id,user_id,conversation_id,status,opened_at,closed_at) values(sid,uid,cid,'closed','2026-04-21','2026-04-21');
 insert into assessments(user_id,session_id,assessment_type,status,summary_json,reviewed_by,reviewed_at) values(uid,sid,'closure','reviewed_confirmed',doc,'00000000-0000-0000-0000-000000000003','2026-04-21');
 insert into questionnaire_instances(user_id,session_id,conversation_id,questionnaire_id,status,scored_at) values(uid,sid,cid,(select id from questionnaire_definitions where code='PHQ9'),'scored','2026-04-21') returning id into qi;
 insert into questionnaire_results(instance_id,total_score,severity_band,requires_review) values(qi,8,'synthetic',false);
end $$;
set local role authenticated;
-- A supported pending status must survive filtering and precede newer reviewed
-- rows at the same risk, while the urgent row still has global first priority.
reset role;
insert into conversations(id,user_id,status,ended_at) values('10000000-0000-0000-0000-000000000093','00000000-0000-0000-0000-000000000002','closed',now()-interval '300 days');
insert into clinical_sessions(id,user_id,conversation_id,status,opened_at,closed_at) values('20000000-0000-0000-0000-000000000093','00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000093','closed',now()-interval '301 days',now()-interval '300 days');
insert into assessments(user_id,session_id,assessment_type,status,summary_json) values('00000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000093','closure','pending_clinician_review','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select pg_temp.must_deny('select get_clinician_inbox_page(0,100,false)');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
do $$ declare page jsonb; second jsonb; pending jsonb; begin
 page=get_clinician_inbox_page(0,100,false); second=get_clinician_inbox_page(100,100,false); pending=get_clinician_inbox_page(0,100,true);
 if jsonb_array_length(page->'rows')<>100 or not (page->>'hasMore')::boolean then raise exception 'First page not bounded'; end if;
 if page->'rows'->0->>'sessionId'<>'20000000-0000-0000-0000-000000000091' then raise exception 'Old urgent hidden after pagination'; end if;
 if page->'rows'->0->>'riskState'<>'acute' or page->'rows'->0->>'displayName'<>'Synthetic informal' then raise exception 'Urgent/name snapshot wrong'; end if;
 if not exists(select 1 from jsonb_array_elements(pending->'rows') r where r->>'sessionId'='20000000-0000-0000-0000-000000000091') then raise exception 'Old pending hidden before filtering'; end if;
 if not exists(select 1 from jsonb_array_elements(pending->'rows') r where r->>'sessionId'='20000000-0000-0000-0000-000000000093' and r->>'assessmentStatus'='pending_clinician_review') then raise exception 'Pending clinician review missing from pending inbox'; end if;
 if not exists(select 1 from jsonb_array_elements(page->'rows') with ordinality r(value,pos),jsonb_array_elements(page->'rows') with ordinality reviewed(value,pos)
  where r.value->>'sessionId'='20000000-0000-0000-0000-000000000093' and reviewed.value->>'sessionId'=(md5('inbox-session-1')::uuid)::text and r.pos<reviewed.pos) then raise exception 'Pending clinician review not prioritized in all-status inbox'; end if;
 if not exists(select 1 from jsonb_array_elements((page->'rows')||(second->'rows')) r where r->>'sessionId'=(md5('long-session-4')::uuid)::text and r->>'sessionNumber'='4' and r->>'daysSincePrevious'='35' and r->>'openTasksCount'='2' and r->'trendsByCode'='{"PHQ9":[18,15,12],"GAD7":[10,8],"BDI2":[20],"BAI":[16]}'::jsonb) then raise exception 'Longitudinal counts/trends wrong'; end if;
 if not exists(select 1 from jsonb_array_elements((page->'rows')||(second->'rows')) r where r->>'sessionId'=(md5('long-other-session')::uuid)::text and r->'trendsByCode'='{"PHQ9":[8]}'::jsonb) then raise exception 'Cross-patient scores leaked'; end if;
 if jsonb_array_length(second->'rows')<5 or (second->>'hasMore')::boolean then raise exception 'Second page lost backlog'; end if;
 if exists(select 1 from jsonb_array_elements(page->'rows') first_row join jsonb_array_elements(second->'rows') second_row on first_row->>'sessionId'=second_row->>'sessionId') then raise exception 'Page rows overlap'; end if;
end $$;
select pg_temp.must_deny('select get_clinician_inbox_page(0,101,false)');
rollback;
