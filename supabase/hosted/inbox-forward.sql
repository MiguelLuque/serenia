-- Forward-only supported-status correction. Signature/owner/ACL stay unchanged.
do $guard$
declare routine record;
begin
 select * into routine from pg_proc where oid='public.get_clinician_inbox_page(integer,integer,boolean)'::regprocedure;
 if pg_get_userbyid(routine.proowner)<>'postgres' or not routine.prosecdef
  or routine.prorettype<>'jsonb'::regtype or routine.provolatile<>'s'
  or routine.proconfig is distinct from array['search_path=public, pg_temp']::text[]
  or md5(routine.prosrc)<>'d8cd7b9badc44fe4b4ec7191d878815d' then
  raise exception 'Unexpected clinician inbox baseline for forward correction';
 end if;
end;
$guard$;
create or replace function get_clinician_inbox_page(p_offset integer default 0,p_limit integer default 100,p_pending_only boolean default true)
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
  where s.status='closed' and (not p_pending_only or a.status is null or a.status in ('draft_ai','pending_clinician_review','requires_manual_review'))
 ), ordered as (
  select *,row_number() over(order by case risk_state when 'acute' then 3 when 'active' then 2 when 'watch' then 1 else 0 end desc,
    (assessment_status is null or assessment_status in ('draft_ai','pending_clinician_review','requires_manual_review')) desc,closed_at desc nulls last,id desc) position
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
