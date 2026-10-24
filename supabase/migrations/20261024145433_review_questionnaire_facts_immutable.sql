-- Forward only: lock the reviewed routine contract before replacing its body.
-- No account/report rewrite, schema/grant change, or scoring recalculation.
do $guard$
declare routine record; routine_id oid;
begin
 routine_id=to_regprocedure('public.review_assessment_atomic(uuid,uuid,text,jsonb,text,jsonb,text)');
 if routine_id is null or (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='review_assessment_atomic')<>1 then
  raise exception 'Unexpected review facts forward baseline';
 end if;
 select * into routine from pg_proc where oid=routine_id;
 if pg_get_userbyid(routine.proowner)<>'postgres' or not routine.prosecdef
  or routine.prorettype<>'uuid'::regtype or routine.provolatile<>'v'
  or routine.prolang<>(select oid from pg_language where lanname='plpgsql')
  or routine.proconfig is distinct from array['search_path=public, pg_temp']::text[]
  or routine.proacl is distinct from array['postgres=X/postgres','authenticated=X/postgres']::aclitem[]
  or md5(routine.prosrc)<>'119e629fd31c44c55476ca45d1d88282'
  or md5(pg_get_functiondef(routine_id))<>'fa9bbdd61b38e492ca3c09151e3d92b6' then
  raise exception 'Unexpected review facts forward baseline';
 end if;
end;
$guard$;
create or replace function review_assessment_atomic(
 p_session_id uuid,p_assessment_id uuid,p_action text,p_summary jsonb default null,
 p_notes text default null,p_inherited_updates jsonb default '[]',p_reason text default null
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare s clinical_sessions%rowtype; a assessments%rowtype; replacement assessments%rowtype;
 result_id uuid; task jsonb; ordinal bigint; u jsonb; request jsonb;
 materialize_tasks boolean:=true;
begin
 if auth.uid() is null or not is_clinician() then raise exception 'Clinician required' using errcode='42501'; end if;
 if p_action is null or p_action not in ('confirm','modify','reject') then raise exception 'Invalid action' using errcode='23514'; end if;
 select * into s from clinical_sessions where id=p_session_id for update;
 if not found or s.status<>'closed' then raise exception 'Closed session required' using errcode='23514'; end if;
 select * into a from assessments where id=p_assessment_id and session_id=s.id and user_id=s.user_id and assessment_type='closure' for update;
 if not found then raise exception 'Assessment does not belong to session' using errcode='23514'; end if;
 -- Preserve factual scoring fields even for direct authenticated RPC callers.
 -- SQL missing and JSON null are deliberately distinct; identical legacy
 -- fields remain editable without introducing or discarding any facts.
 if p_action='modify' and (p_summary->'questionnaires') is distinct from (a.summary_json->'questionnaires') then
  raise exception 'Questionnaire scoring facts are immutable' using errcode='23514';
 end if;
 request=jsonb_build_object('summary',p_summary,'notes',nullif(trim(p_notes),''),'updates',p_inherited_updates);
 if p_action='modify' and a.status='superseded' then
  select * into replacement from assessments where supersedes_assessment_id=a.id and status='reviewed_modified' and review_request_json=request;
  if found then return replacement.id; end if;
 end if;
 if p_action='confirm' and a.status='reviewed_confirmed' then return a.id; end if;
 if p_action='reject' and a.status='rejected' and a.rejection_reason=trim(p_reason) then return a.id; end if;
 if a.status in ('superseded','rejected') or (p_action in ('confirm','reject') and a.status not in ('draft_ai','pending_clinician_review')) then
  raise exception 'Assessment already changed; reload' using errcode='23514';
 end if;
 if p_action='reject' then
  if p_reason is null or length(trim(p_reason))<3 then raise exception 'Reason required' using errcode='23514'; end if;
  update assessments set status='rejected',reviewed_by=auth.uid(),reviewed_at=now(),rejection_reason=trim(p_reason) where id=a.id;
  return a.id;
 end if;
 if p_action='modify' then
  if p_summary is null or jsonb_typeof(p_summary)<>'object' or jsonb_typeof(p_inherited_updates)<>'array' then raise exception 'Invalid review payload' using errcode='23514'; end if;
  if jsonb_typeof(p_summary->'proposed_tasks') is distinct from 'array' then raise exception 'Invalid proposed tasks' using errcode='23514'; end if;
  -- Reviewed agreements already have identities and lifecycle history. Editing
  -- notes or unrelated summary fields must not reissue those agreements.
  materialize_tasks:=a.status not in ('reviewed_confirmed','reviewed_modified')
   or (p_summary->'proposed_tasks') is distinct from (a.summary_json->'proposed_tasks');
  if materialize_tasks then
   -- Serialize agreement replacement with progress recorded by later sessions.
   perform 1 from patient_tasks where acordada_en_session_id=s.id order by id for update;
   if exists(select 1 from patient_tasks t where t.acordada_en_session_id=s.id
    and t.estado<>'pendiente'
    and not (t.estado='no_abordada' and exists(select 1 from assessments prior_revision
     where prior_revision.id=t.closed_by_assessment_id and prior_revision.session_id=s.id))) then
    raise exception 'Task agreements have later progress; keep the original agreements and record changes in a later session' using errcode='23514';
   end if;
  end if;
  update assessments set status='superseded' where id=a.id;
  insert into assessments(user_id,session_id,assessment_type,status,generated_by,summary_json,supersedes_assessment_id,reviewed_by,reviewed_at,clinical_notes,review_request_json)
   values(s.user_id,s.id,'closure','reviewed_modified','clinician',p_summary,a.id,auth.uid(),now(),nullif(trim(p_notes),''),request) returning id into result_id;
  -- Only changed agreements replace tasks. Internal replacements are history,
  -- and must not be mistaken for progress from a subsequent session.
  if materialize_tasks then
   update patient_tasks set estado='no_abordada',closed_at=now(),closed_by_assessment_id=result_id where acordada_en_session_id=s.id and closed_at is null;
  end if;
  for u in select value from jsonb_array_elements(p_inherited_updates) loop
   update patient_tasks set estado=(u->>'estado')::patient_task_status,nota=nullif(u->>'nota',''),
    closed_at=case when u->>'estado' in ('cumplida','no_realizada','no_abordada') then now() else null end,
    closed_by_assessment_id=case when u->>'estado' in ('cumplida','no_realizada','no_abordada') then result_id else null end
    where id=(u->>'id')::uuid and user_id=s.user_id and acordada_en_session_id<>s.id and closed_at is null;
   if not found then raise exception 'Inherited task unavailable or foreign' using errcode='23514'; end if;
  end loop;
 else
  p_summary=a.summary_json; result_id=a.id;
  update assessments set status='reviewed_confirmed',reviewed_by=auth.uid(),reviewed_at=now() where id=a.id;
 end if;
 if jsonb_typeof(p_summary->'proposed_tasks') is distinct from 'array' then raise exception 'Invalid proposed tasks' using errcode='23514'; end if;
 if materialize_tasks then
  for task,ordinal in select value,ordinality from jsonb_array_elements(p_summary->'proposed_tasks') with ordinality loop
   insert into patient_tasks(user_id,acordada_en_session_id,acordada_en_assessment_id,descripcion,nota,source_task_index)
    values(s.user_id,s.id,result_id,task->>'descripcion',task->>'nota',ordinal);
  end loop;
 end if;
 return result_id;
end $$;

do $verified$
declare routine record;
begin
 select * into routine from pg_proc where oid='public.review_assessment_atomic(uuid,uuid,text,jsonb,text,jsonb,text)'::regprocedure;
 if pg_get_userbyid(routine.proowner)<>'postgres' or not routine.prosecdef
  or routine.prorettype<>'uuid'::regtype or routine.provolatile<>'v'
  or routine.prolang<>(select oid from pg_language where lanname='plpgsql')
  or routine.proconfig is distinct from array['search_path=public, pg_temp']::text[]
  or routine.proacl is distinct from array['postgres=X/postgres','authenticated=X/postgres']::aclitem[]
  or md5(routine.prosrc)<>'7f83d3074a279a2740d1bf82a2977ebd' then
  raise exception 'Review facts forward changed an unexpected contract';
 end if;
end;
$verified$;
