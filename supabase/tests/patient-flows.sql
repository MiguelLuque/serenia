begin;
create function pg_temp.flow_deny(sql text) returns void language plpgsql as $$
begin
 begin execute sql; exception when insufficient_privilege or check_violation then return; end;
 raise exception 'FLOW REGRESSION: accepted %',sql;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
update user_profiles set onboarding_status='complete',informal_name='Synthetic',pronouns='elle',birth_date='1990-01-01',reason_for_consulting='Synthetic test reason' where user_id=auth.uid();
select pg_temp.flow_deny($q$select create_session_atomic('00000000-0000-0000-0000-000000000001')$q$);
do $$ begin
 if exists(select 1 from assessments) then raise exception 'FLOW REGRESSION: patient reads internal assessment'; end if;
end $$;
select pg_temp.flow_deny($q$insert into consents(user_id,consent_version,accepted_at) values(auth.uid(),'technical-draft-2026-10-11','2000-01-01')$q$);
select pg_temp.flow_deny($q$update user_profiles set consent_version='technical-draft-2026-10-11',consent_given_at=now() where user_id=auth.uid()$q$);
-- The authenticated acceptance API controls owner, version, date and stamp.
select pg_temp.flow_deny($q$select complete_patient_onboarding('Synthetic','elle','-infinity'::date,'Synthetic test reason','technical-draft-2026-10-11',true)$q$);
select pg_temp.flow_deny($q$select complete_patient_onboarding('Synthetic','elle','infinity'::date,'Synthetic test reason','technical-draft-2026-10-11',true)$q$);
select pg_temp.flow_deny($q$select complete_patient_onboarding('Synthetic','elle',(((now() at time zone 'UTC')::date-interval '18 years')::date+1),'Synthetic test reason','technical-draft-2026-10-11',true)$q$);
select pg_temp.flow_deny($q$select complete_patient_onboarding('Synthetic','elle','1990-01-01','Synthetic test reason','old',true)$q$);
select pg_temp.flow_deny($q$select complete_patient_onboarding('Synthetic','elle','1990-01-01','Synthetic test reason','technical-draft-2026-10-11',false)$q$);
select complete_patient_onboarding('Synthetic','elle',((now() at time zone 'UTC')::date-interval '18 years')::date,'Synthetic test reason','technical-draft-2026-10-11',true);
do $$ begin
 if not get_onboarding_ready() then raise exception 'Exact birthday rejected'; end if;
 if not exists(select 1 from consents where user_id=auth.uid() and server_recorded and consent_version='technical-draft-2026-10-11' and accepted_at=now() and payload_json->>'technicalDraft'='true') then raise exception 'Server stamp/version absent'; end if;
end $$;
select create_session_atomic('00000000-0000-0000-0000-000000000001');
set local role service_role;
do $$ declare sid uuid; claim jsonb; begin
 select id into sid from clinical_sessions where user_id='00000000-0000-0000-0000-000000000001' and status='open';
 claim=begin_chat_turn(sid,'00000000-0000-0000-0000-000000000001','flow-recovery','Recovery text',false,false);
 perform fail_chat_turn(sid,'flow-recovery',(claim->>'token')::uuid,'synthetic failure');
end $$;
set local role authenticated;
do $$ declare recovery jsonb; sid uuid; begin
 select id into sid from clinical_sessions where user_id=auth.uid() and status='open';
 recovery=get_chat_turn_recovery(sid);
 if recovery->>'requestId'<>'flow-recovery' or recovery->>'text'<>'Recovery text' or not (recovery->>'canRetry')::boolean or not exists(select 1 from messages where id=(recovery->>'userMessageId')::uuid and role='user') then raise exception 'Persisted recovery ID/text missing'; end if;
end $$;
-- Even a matching legacy acknowledgement must not make an infinite stored DOB ready.
reset role;
insert into consents(user_id,consent_version,server_recorded,payload_json) values
 ('00000000-0000-0000-0000-000000000001','technical-draft-2026-10-11',true,'{"birthDate":"-infinity"}'),
 ('00000000-0000-0000-0000-000000000001','technical-draft-2026-10-11',true,'{"birthDate":"infinity"}');
set local role authenticated;
update user_profiles set birth_date='-infinity'::date where user_id=auth.uid();
do $$ begin if get_onboarding_ready() then raise exception 'Non-finite stored negative DOB bypassed readiness'; end if; end $$;
select pg_temp.flow_deny($q$select create_session_atomic('00000000-0000-0000-0000-000000000001')$q$);
update user_profiles set birth_date='infinity'::date where user_id=auth.uid();
do $$ begin if get_onboarding_ready() then raise exception 'Non-finite stored positive DOB bypassed readiness'; end if; end $$;
update user_profiles set birth_date='2090-01-01'  where user_id=auth.uid();
do $$ begin if get_onboarding_ready() then raise exception 'Current invalid date bypassed readiness'; end if; end $$;
select pg_temp.flow_deny($q$select create_session_atomic('00000000-0000-0000-0000-000000000001')$q$);
set local role service_role;
select pg_temp.flow_deny($q$select begin_chat_turn('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','invalid-adult','Hello',false,false)$q$);
reset role;
-- Use an existing owned closed session for private projection assertions.
update assessments set status='superseded' where session_id='20000000-0000-0000-0000-000000000001';
insert into assessments(id,user_id,session_id,assessment_type,status,summary_json,clinical_notes,reviewed_by,reviewed_at) values
 ('30000000-0000-0000-0000-000000000090','00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','closure','reviewed_modified','{"patient_facing_summary":"Authorized summary","risk_assessment":{"notes":"Private risk"}}','Private notes','00000000-0000-0000-0000-000000000003',now());
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
do $$ declare reports jsonb; begin
 reports=get_patient_session_reports(array['20000000-0000-0000-0000-000000000001'::uuid]);
 if reports is distinct from '[{"sessionId":"20000000-0000-0000-0000-000000000001","state":"available","summary":"Authorized summary"}]'::jsonb then raise exception 'Wrong private projection: %',reports; end if;
end $$;
select pg_temp.flow_deny($q$select get_patient_session_reports(array['20000000-0000-0000-0000-000000000002'::uuid])$q$);
reset role;
update assessments set status='rejected' where id='30000000-0000-0000-0000-000000000090';
set local role authenticated;
do $$ begin if get_patient_session_reports(array['20000000-0000-0000-0000-000000000001'::uuid])->0 is distinct from '{"sessionId":"20000000-0000-0000-0000-000000000001","state":"rejected","summary":null}'::jsonb then raise exception 'Rejected summary exposed'; end if; end $$;
reset role;
update assessments set status='superseded' where id='30000000-0000-0000-0000-000000000090';
set local role authenticated;
do $$ begin if get_patient_session_reports(array['20000000-0000-0000-0000-000000000001'::uuid])->0->>'summary' is not null then raise exception 'Superseded summary exposed'; end if; end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
do $$ begin if not exists(select 1 from assessments where clinical_notes='Private notes') then raise exception 'Clinician private context removed'; end if; end $$;
set local role anon;
select pg_temp.flow_deny('select get_onboarding_ready()');
select pg_temp.flow_deny($q$select get_patient_session_reports('{}'::uuid[])$q$);
rollback;
