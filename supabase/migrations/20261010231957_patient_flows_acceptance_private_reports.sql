-- Technical draft acknowledgement, not approved legal consent or launch approval.
alter table consents add column server_recorded boolean not null default false;
revoke insert,update,delete,truncate,references,trigger on consents from authenticated,anon;
drop policy if exists consents_insert_own on consents;
revoke insert(consent_version,consent_given_at),update(consent_version,consent_given_at) on user_profiles from authenticated;
create index consents_server_acceptance on consents(user_id,consent_version) where server_recorded;

create function patient_onboarding_ready(p_user_id uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from user_profiles p where p.user_id=p_user_id and p.role='patient'
  and p.birth_date is not null and p.birth_date <= ((now() at time zone 'UTC')::date - interval '18 years')::date
  and length(btrim(p.informal_name)) between 1 and 80
  and p.pronouns in ('el','ella','elle','prefer_not_say')
  and length(btrim(p.reason_for_consulting)) between 10 and 2000
  and exists(select 1 from consents c where c.user_id=p.user_id and c.server_recorded
   and c.consent_version='technical-draft-2026-10-11'
   and c.payload_json->>'birthDate'=p.birth_date::text));
$$;
revoke all on function patient_onboarding_ready(uuid) from public,anon,authenticated;
grant execute on function patient_onboarding_ready(uuid) to service_role;

create function get_onboarding_ready() returns boolean
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 return is_clinician() or patient_onboarding_ready(auth.uid());
end $$;
revoke all on function get_onboarding_ready() from public,anon,service_role;
grant execute on function get_onboarding_ready() to authenticated;

create function complete_patient_onboarding(p_informal_name text,p_pronouns text,p_birth_date date,p_reason text,p_version text,p_accepted boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare stamp timestamptz:=now(); p user_profiles%rowtype;
begin
 if auth.uid() is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 if p_accepted is distinct from true or p_version is distinct from 'technical-draft-2026-10-11' then raise exception 'Current draft acknowledgement required' using errcode='23514'; end if;
 if p_birth_date is null or p_birth_date>((stamp at time zone 'UTC')::date-interval '18 years')::date
  or p_informal_name is null or length(btrim(p_informal_name)) not between 1 and 80
  or p_pronouns is null or p_pronouns not in ('el','ella','elle','prefer_not_say')
  or p_reason is null or length(btrim(p_reason)) not between 10 and 2000 then raise exception 'Valid adult profile required' using errcode='23514'; end if;
 select * into p from user_profiles where user_id=auth.uid() for update;
 if not found or p.role<>'patient' then raise exception 'Patient profile required' using errcode='42501'; end if;
 update user_profiles set informal_name=btrim(p_informal_name),pronouns=p_pronouns,birth_date=p_birth_date,
  reason_for_consulting=btrim(p_reason),onboarding_status='complete',consent_version=p_version,consent_given_at=stamp where user_id=auth.uid();
 insert into consents(user_id,consent_version,accepted_at,server_recorded,payload_json)
 values(auth.uid(),p_version,stamp,true,jsonb_build_object('birthDate',p_birth_date,'technicalDraft',true,'accepted',true));
end $$;
revoke all on function complete_patient_onboarding(text,text,date,text,text,boolean) from public,anon,service_role;
grant execute on function complete_patient_onboarding(text,text,date,text,text,boolean) to authenticated;

-- Preserve existing atomic session implementation, gate under its profile lock.
alter function create_session_atomic(uuid) rename to create_session_after_onboarding;
revoke all on function create_session_after_onboarding(uuid) from public,anon,authenticated,service_role;
create function create_session_atomic(p_user_id uuid) returns clinical_sessions
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or auth.uid()<>p_user_id then raise exception 'Unauthorized' using errcode='42501'; end if;
 perform 1 from user_profiles where user_id=p_user_id for update;
 if not patient_onboarding_ready(p_user_id) then raise exception 'Current adult onboarding required' using errcode='23514'; end if;
 return create_session_after_onboarding(p_user_id);
end $$;
revoke all on function create_session_atomic(uuid) from public,anon,service_role;
grant execute on function create_session_atomic(uuid) to authenticated;

-- Gate every turn, including sessions created before current acknowledgement.
alter function begin_chat_turn(uuid,uuid,text,text,boolean,boolean) rename to begin_chat_turn_after_onboarding;
revoke all on function begin_chat_turn_after_onboarding(uuid,uuid,text,text,boolean,boolean) from public,anon,authenticated,service_role;
create function begin_chat_turn(p_session_id uuid,p_user_id uuid,p_request_id text,p_text text,p_crisis boolean default false,p_urgent boolean default false)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 -- Only service_role can call this wrapper. Retain the original owned-parent,
 -- token, lease and urgent-signal semantics after validating the profile.
 perform 1 from user_profiles where user_id=p_user_id for share;
 if not patient_onboarding_ready(p_user_id) then raise exception 'Current adult onboarding required' using errcode='23514'; end if;
 return begin_chat_turn_after_onboarding(p_session_id,p_user_id,p_request_id,p_text,p_crisis,p_urgent);
end $$;
revoke all on function begin_chat_turn(uuid,uuid,text,text,boolean,boolean) from public,anon,authenticated;
grant execute on function begin_chat_turn(uuid,uuid,text,text,boolean,boolean) to service_role;

-- Full clinical records remain visible only to clinician RLS and service_role.
drop policy if exists assessments_select_own on assessments;
create function get_patient_session_reports(p_session_ids uuid[]) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if auth.uid() is null or coalesce(cardinality(p_session_ids),0)>50 then raise exception 'Unauthorized report scope' using errcode='42501'; end if;
 if exists(select 1 from unnest(p_session_ids) requested(session_id) where not exists(select 1 from clinical_sessions s where s.id=requested.session_id and s.user_id=auth.uid())) then raise exception 'Owned sessions required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('sessionId',s.id,'state',case
  when a.status in ('reviewed_confirmed','reviewed_modified') and jsonb_typeof(a.summary_json->'patient_facing_summary')='string' then 'available'
  when a.status='rejected' then 'rejected'
  when a.status in ('draft_ai','requires_manual_review') then 'pending_review'
  else 'unavailable' end,
  'summary',case when a.status in ('reviewed_confirmed','reviewed_modified') and jsonb_typeof(a.summary_json->'patient_facing_summary')='string' then a.summary_json->>'patient_facing_summary' else null end)), '[]'::jsonb) into result
 from clinical_sessions s left join lateral (
  select status,summary_json from assessments where session_id=s.id and user_id=s.user_id and assessment_type='closure' and status<>'superseded' order by created_at desc,id desc limit 1
 ) a on true where s.id=any(p_session_ids) and s.user_id=auth.uid();
 return result;
end $$;
revoke all on function get_patient_session_reports(uuid[]) from public,anon,service_role;
grant execute on function get_patient_session_reports(uuid[]) to authenticated;

-- Only the persisted message ID is added to the owned unresolved projection.
create or replace function get_chat_turn_recovery(p_session_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare t chat_turns%rowtype;
begin
 if auth.uid() is null or not exists(select 1 from clinical_sessions where id=p_session_id and user_id=auth.uid()) then raise exception 'Owned session required' using errcode='42501'; end if;
 select * into t from chat_turns where session_id=p_session_id and user_id=auth.uid() and status in ('generating','failed') order by created_at desc limit 1;
 if not found then return null; end if;
 return jsonb_build_object('requestId',t.request_id,'userMessageId',t.user_message_id,'text',t.text,'status',t.status,'canRetry',t.attempts<3 and (t.status='failed' or t.lease_until<=now()),'leaseUntil',t.lease_until);
end $$;
revoke all on function get_chat_turn_recovery(uuid) from public,anon,service_role;
grant execute on function get_chat_turn_recovery(uuid) to authenticated;

-- Pure parity counterpart of lib/server/risk-rules.ts. All timestamps are
-- passed explicitly; no new risk dimension or threshold is introduced.
create function derive_patient_risk_state_sql(p_reviewed_at timestamptz,p_suicidality text,p_critical boolean,p_latest_open timestamptz,p_latest_high timestamptz,p_previous_at timestamptz,p_previous_reason text,p_now timestamptz)
returns text language sql immutable set search_path=public,pg_temp as $$
 select case
  when p_critical or p_suicidality='acute' then 'acute'
  when p_suicidality='active' then 'active'
  when p_suicidality='none' and (p_latest_open is null or p_reviewed_at>p_latest_open)
   and (p_previous_reason is distinct from 'crisis_detected' or p_reviewed_at>p_previous_at) then 'none'
  when p_suicidality='passive' and p_reviewed_at>p_now-interval '504 hours' then 'watch'
  when p_latest_high>p_now-interval '504 hours' then 'watch'
  when p_previous_reason='crisis_detected' and p_previous_at>p_now-interval '504 hours' then 'watch'
  else 'none' end;
$$;
revoke all on function derive_patient_risk_state_sql(timestamptz,text,boolean,timestamptz,timestamptz,timestamptz,text,timestamptz) from public,anon;
grant execute on function derive_patient_risk_state_sql(timestamptz,text,boolean,timestamptz,timestamptz,timestamptz,text,timestamptz) to authenticated,service_role;

create index inbox_closed_order on clinical_sessions(closed_at desc,id desc) where status='closed';
create index inbox_user_closed_order on clinical_sessions(user_id,closed_at desc,id desc) where status='closed';
create index inbox_open_risks on risk_events(user_id,created_at desc) include(severity) where status='open';

-- Mirrors the load schema, including legacy defaults, before treating a
-- stored report as a validated risk snapshot. Parity fixtures run in TS+SQL.
create function assessment_summary_valid_for_risk(doc jsonb) returns boolean
language plpgsql immutable set search_path=public,pg_temp as $$
declare field text; item jsonb; flag jsonb; risk jsonb;
begin
 if jsonb_typeof(doc) is distinct from 'object' then return false; end if;
 foreach field in array array['chief_complaint','mood_affect','preliminary_impression','patient_facing_summary'] loop
  if jsonb_typeof(doc->field) is distinct from 'string' then return false; end if;
 end loop;
 foreach field in array array['presenting_issues','cognitive_patterns','areas_for_exploration','recommended_actions_for_clinician'] loop
  if jsonb_typeof(doc->field) is distinct from 'array' then return false; end if;
  if exists(select 1 from jsonb_array_elements(doc->field) v where jsonb_typeof(v)<>'string') then return false; end if;
 end loop;
 risk=doc->'risk_assessment';
 if jsonb_typeof(risk) is distinct from 'object' or coalesce(risk->>'suicidality','') not in ('none','passive','active','acute')
  or coalesce(risk->>'self_harm','') not in ('none','historic','current') or jsonb_typeof(risk->'notes') is distinct from 'string'
  or (risk ? 'heteroaggression' and coalesce(risk->>'heteroaggression','') not in ('none','verbal','plan'))
  or (risk ? 'substance_use_acute' and risk->'substance_use_acute'<>'null'::jsonb and coalesce(risk->>'substance_use_acute','') not in ('none','suspected','confirmed')) then return false; end if;
 if jsonb_typeof(doc->'questionnaires') is distinct from 'array' then return false; end if;
 for item in select value from jsonb_array_elements(doc->'questionnaires') loop
  if jsonb_typeof(item->'code') is distinct from 'string' or jsonb_typeof(item->'score') is distinct from 'number' or jsonb_typeof(item->'band') is distinct from 'string' or jsonb_typeof(item->'flags') is distinct from 'array' then return false; end if;
  for flag in select value from jsonb_array_elements(item->'flags') loop
   if jsonb_typeof(flag->'itemOrder') is distinct from 'number' or jsonb_typeof(flag->'reason') is distinct from 'string' then return false; end if;
  end loop;
 end loop;
 if doc ? 'proposed_tasks' then
  if jsonb_typeof(doc->'proposed_tasks') is distinct from 'array' then return false; end if;
  for item in select value from jsonb_array_elements(doc->'proposed_tasks') loop
   if jsonb_typeof(item->'descripcion') is distinct from 'string' or length(item->>'descripcion') not between 3 and 500
    or not (item ? 'nota') or (item->'nota'<>'null'::jsonb and (jsonb_typeof(item->'nota') is distinct from 'string' or length(item->>'nota')>300)) then return false; end if;
  end loop;
 end if;
 return true;
end $$;
revoke all on function assessment_summary_valid_for_risk(jsonb) from public,anon;
grant execute on function assessment_summary_valid_for_risk(jsonb) to authenticated,service_role;

create function get_clinician_inbox_page(p_offset integer default 0,p_limit integer default 100,p_pending_only boolean default true)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare output jsonb;
begin
 if auth.uid() is null or not is_clinician() then raise exception 'Clinician required' using errcode='42501'; end if;
 if p_offset is null or p_limit is null or p_pending_only is null or p_offset<0 or p_limit<1 or p_limit>100 then raise exception 'Invalid page' using errcode='23514'; end if;
 -- Candidate selection, status filtering and global priority happen in DB.
 -- Histories stay here: the API returns <=100 snapshots and one more flag.
 with candidates as (
  select s.id,s.user_id,s.closed_at,s.closure_reason,a.status as assessment_status,
   derive_patient_risk_state_sql(v.reviewed_at,v.summary_json->'risk_assessment'->>'suicidality',coalesce(r.critical,false),r.latest_open,r.latest_high,prev.closed_at,prev.closure_reason,now()) as risk_state
  from clinical_sessions s
  left join lateral(select status from assessments where session_id=s.id and assessment_type='closure' and status<>'superseded' order by created_at desc,id desc limit 1) a on true
  left join lateral(select reviewed_at,summary_json from assessments where user_id=s.user_id and assessment_type='closure' and status in ('reviewed_confirmed','reviewed_modified') and reviewed_at is not null
   and assessment_summary_valid_for_risk(summary_json)
   order by reviewed_at desc,id desc limit 1) v on true
  left join lateral(select bool_or(severity='critical') critical,max(created_at) latest_open,max(created_at) filter(where severity='high') latest_high from risk_events where user_id=s.user_id and status='open') r on true
  left join lateral(select closed_at,closure_reason from clinical_sessions where user_id=s.user_id and status='closed' and (closed_at,id)<(s.closed_at,s.id) order by closed_at desc,id desc limit 1) prev on true
  where s.status='closed' and (not p_pending_only or a.status is null or a.status in ('draft_ai','requires_manual_review'))
 ), ordered as (
  select *,row_number() over(order by case risk_state when 'acute' then 3 when 'active' then 2 when 'watch' then 1 else 0 end desc,
    (assessment_status is null or assessment_status in ('draft_ai','requires_manual_review')) desc,closed_at desc nulls last,id desc) position
  from candidates
 ), selected as (select * from ordered order by position limit p_limit+1 offset p_offset), rows as (
  select x.position,jsonb_build_object(
   'sessionId',x.id,'userId',x.user_id,'displayName',coalesce(nullif(btrim(p.display_name),''),nullif(btrim(p.informal_name),'')),
   'closedAt',x.closed_at,'closureReason',x.closure_reason,'assessmentStatus',x.assessment_status,'hasCrisis',coalesce(x.closure_reason='crisis_detected',false),
   'topRisk',(select severity from risk_events where session_id=x.id order by case severity when 'critical' then 3 when 'high' then 2 when 'moderate' then 1 else 0 end desc limit 1),
   'sessionNumber',(select count(*) from clinical_sessions where user_id=x.user_id and status='closed' and (closed_at,id)<=(x.closed_at,x.id)),
   'daysSincePrevious',(select floor(extract(epoch from (x.closed_at-closed_at))/86400)::integer from clinical_sessions where user_id=x.user_id and status='closed' and (closed_at,id)<(x.closed_at,x.id) order by closed_at desc,id desc limit 1),
   'openTasksCount',(select count(*) from patient_tasks where user_id=x.user_id and estado in ('pendiente','parcial')),
   'riskState',x.risk_state,
   'trendsByCode',coalesce((select jsonb_object_agg(code,scores) from (
    select code,jsonb_agg(total_score order by scored_at asc,id asc) scores from (
     select d.code,qi.scored_at,qi.id,qr.total_score,row_number() over(partition by d.code order by qi.scored_at desc,qi.id desc) recent
     from questionnaire_instances qi join questionnaire_definitions d on d.id=qi.questionnaire_id join questionnaire_results qr on qr.instance_id=qi.id
     where qi.user_id=x.user_id and qi.status='scored' and d.code in ('PHQ9','GAD7','BDI2','BAI')
    ) q where recent<=3 group by code
   ) t),'{}'::jsonb)
  ) row from selected x left join user_profiles p on p.user_id=x.user_id where x.position<=p_offset+p_limit
 )
 select jsonb_build_object('rows',coalesce((select jsonb_agg(row order by position) from rows),'[]'::jsonb),'hasMore',(select count(*)>p_limit from selected)) into output;
 return output;
end $$;
revoke all on function get_clinician_inbox_page(integer,integer,boolean) from public,anon,service_role;
grant execute on function get_clinician_inbox_page(integer,integer,boolean) to authenticated;
