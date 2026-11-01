begin;
-- Distinct synthetic owners: a late signature must not rewrite observation time.
insert into auth.users(id) values('00000000-0000-0000-0000-000000000094'),('00000000-0000-0000-0000-000000000095');
do $$ declare uid uuid; cid uuid; sid uuid; aid uuid; doc jsonb; n integer; begin
 doc='{"chief_complaint":"Synthetic chronology","presenting_issues":[],"mood_affect":"","cognitive_patterns":[],"risk_assessment":{"suicidality":"none","self_harm":"none","notes":""},"questionnaires":[],"areas_for_exploration":[],"preliminary_impression":"","recommended_actions_for_clinician":[],"patient_facing_summary":"","proposed_tasks":[]}';
 for n in 1..3 loop
  uid=case when n<=2 then '00000000-0000-0000-0000-000000000094'::uuid else '00000000-0000-0000-0000-000000000095'::uuid end;
  cid=md5('chronology-conversation-'||n)::uuid; sid=md5('chronology-session-'||n)::uuid; aid=md5('chronology-assessment-'||n)::uuid;
  insert into conversations(id,user_id,status,ended_at) values(cid,uid,'closed',now()-make_interval(days=>case n when 1 then 120 when 2 then 2 else 10 end));
  insert into clinical_sessions(id,user_id,conversation_id,status,opened_at,closed_at,closure_reason)
   values(sid,uid,cid,'closed',now()-make_interval(days=>case n when 1 then 120 when 2 then 2 else 10 end)-interval '1 hour',now()-make_interval(days=>case n when 1 then 120 when 2 then 2 else 10 end),'user_request');
  insert into assessments(id,user_id,session_id,assessment_type,status,summary_json,reviewed_by,reviewed_at)
   values(aid,uid,sid,'closure',case when n=2 then 'reviewed_confirmed'::assessment_status else 'draft_ai'::assessment_status end,
    case when n=2 then jsonb_set(doc,'{risk_assessment,suicidality}','"active"') else doc end,
    case when n=2 then '00000000-0000-0000-0000-000000000003'::uuid else null end,
    case when n=2 then now()-interval '1 day' else null end);
  if n=3 then
   insert into risk_events(user_id,session_id,conversation_id,risk_type,severity,source_type,status,created_at)
    values(uid,sid,cid,'suicidal_ideation','high','conversation','open',now()-interval '2 days');
  end if;
 end loop;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
select review_assessment_atomic(md5('chronology-session-1')::uuid,md5('chronology-assessment-1')::uuid,'confirm');
select review_assessment_atomic(md5('chronology-session-3')::uuid,md5('chronology-assessment-3')::uuid,'confirm');
do $$ declare page jsonb; begin
 page=get_clinician_inbox_page(0,100,false);
 if not exists(select 1 from jsonb_array_elements(page->'rows') r where r->>'userId'='00000000-0000-0000-0000-000000000094' and r->>'riskState'='active') then
  raise exception 'CHRONOLOGY REGRESSION: late confirmation displaced later observed active session';
 end if;
 if exists(select 1 from jsonb_array_elements(page->'rows') r where r->>'userId'='00000000-0000-0000-0000-000000000094' and r->>'riskState'<>'active') then
  raise exception 'CHRONOLOGY REGRESSION: inconsistent current patient risk';
 end if;
 if not exists(select 1 from jsonb_array_elements(page->'rows') r where r->>'userId'='00000000-0000-0000-0000-000000000095' and r->>'riskState'='watch') then
  raise exception 'CHRONOLOGY REGRESSION: late confirmation cleared later high event';
 end if;
end $$;
rollback;
