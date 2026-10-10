-- Trust boundary: only the server writes operational/derived clinical data.
-- These grants are explicit; permissive legacy policies are removed as well.
revoke create on schema public from public,anon,authenticated;
revoke all on all tables in schema public from anon;
revoke insert, update, delete, truncate, references, trigger on
 conversations, clinical_sessions, messages, session_summaries,
 questionnaire_instances, questionnaire_answers, questionnaire_results,
 assessments, risk_events, patient_tasks, patient_context_injections
 from authenticated;
grant select on conversations, clinical_sessions, messages, session_summaries,
 questionnaire_instances, questionnaire_answers, questionnaire_results,
 assessments, risk_events, patient_tasks, patient_context_injections,
 user_profiles, consents, questionnaire_definitions, questionnaire_items to authenticated;
grant all on all tables in schema public to service_role;

do $$ declare p record; begin
 for p in select tablename, policyname from pg_policies
  where schemaname='public' and cmd <> 'SELECT'
  and tablename in ('conversations','clinical_sessions','messages','session_summaries',
    'questionnaire_instances','questionnaire_answers','questionnaire_results',
    'assessments','risk_events','patient_tasks','patient_context_injections')
 loop execute format('drop policy %I on public.%I',p.policyname,p.tablename); end loop;
end $$;
create policy conversations_read_owner on conversations for select to authenticated using(user_id=auth.uid());
create policy sessions_read_owner on clinical_sessions for select to authenticated using(user_id=auth.uid());
create policy instances_read_owner on questionnaire_instances for select to authenticated using(user_id=auth.uid());

-- Role and derived clinical profile fields are administratively owned.
revoke insert, update, delete, truncate, references, trigger on user_profiles from authenticated;
grant update(user_id, display_name, locale, timezone, informal_name, pronouns,
 birth_date, reason_for_consulting, onboarding_status, sex, country, city,
 employment, relationship_status, living_with, prior_therapy, current_medication,
 consent_version, consent_given_at) on user_profiles to authenticated;
grant insert(user_id, display_name, locale, timezone, informal_name, pronouns,
 birth_date, reason_for_consulting, onboarding_status, sex, country, city,
 employment, relationship_status, living_with, prior_therapy, current_medication,
 consent_version, consent_given_at) on user_profiles to authenticated;
create policy profile_insert_owner on user_profiles for insert to authenticated
 with check(user_id=auth.uid() and role='patient');

create or replace function is_clinician() returns boolean language sql stable security definer
set search_path=public,pg_temp as $$
 select exists(select 1 from public.user_profiles where user_id=auth.uid() and role='clinician')
$$;
revoke all on function is_clinician() from public, anon;
grant execute on function is_clinician() to authenticated, service_role;

-- Compound foreign keys are checked even for service-role writes. Existing
-- inconsistent data deliberately fails migration and requires reviewed repair.
alter table conversations add unique(id,user_id);
alter table clinical_sessions add unique(id,user_id), add unique(id,conversation_id),
 add constraint sessions_conversation_owner foreign key(conversation_id,user_id) references conversations(id,user_id) on delete cascade;
alter table messages add constraint messages_session_conversation foreign key(session_id,conversation_id) references clinical_sessions(id,conversation_id) on delete cascade;
alter table session_summaries add unique(id,user_id),
 add constraint summaries_session_owner foreign key(session_id,user_id) references clinical_sessions(id,user_id) on delete cascade;
alter table questionnaire_instances
 add constraint instances_session_owner foreign key(session_id,user_id) references clinical_sessions(id,user_id) on delete cascade,
 add constraint instances_conversation_owner foreign key(conversation_id,user_id) references conversations(id,user_id) on delete cascade,
 add constraint instances_session_conversation foreign key(session_id,conversation_id) references clinical_sessions(id,conversation_id) on delete cascade;
alter table assessments add unique(id,user_id), add unique(id,session_id,user_id),
 add constraint assessments_session_owner foreign key(session_id,user_id) references clinical_sessions(id,user_id) on delete cascade,
 add constraint assessments_previous_owner foreign key(supersedes_assessment_id,user_id) references assessments(id,user_id),
 add constraint assessments_previous_session foreign key(supersedes_assessment_id,session_id,user_id) references assessments(id,session_id,user_id);
alter table risk_events
 add constraint risk_session_owner foreign key(session_id,user_id) references clinical_sessions(id,user_id) on delete cascade,
 add constraint risk_conversation_owner foreign key(conversation_id,user_id) references conversations(id,user_id) on delete cascade,
 add constraint risk_session_conversation foreign key(session_id,conversation_id) references clinical_sessions(id,conversation_id) on delete cascade;
alter table patient_tasks
 add constraint tasks_assessment_session_owner foreign key(acordada_en_assessment_id,acordada_en_session_id,user_id) references assessments(id,session_id,user_id) on delete cascade,
 add constraint tasks_closed_owner foreign key(closed_by_assessment_id,user_id) references assessments(id,user_id);
alter table patient_context_injections
 add constraint injections_session_owner foreign key(session_id,user_id) references clinical_sessions(id,user_id) on delete cascade,
 add constraint injections_assessment_owner foreign key(last_validated_assessment_id,user_id) references assessments(id,user_id);

-- An answer must belong to the questionnaire definition of its instance.
create function validate_answer_parent() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from questionnaire_instances i join questionnaire_items t on t.questionnaire_id=i.questionnaire_id where i.id=new.instance_id and t.id=new.item_id) then
  raise exception 'Questionnaire item does not belong to instance' using errcode='23514';
 end if;
 return new;
end $$;
create trigger answer_parent before insert or update on questionnaire_answers for each row execute function validate_answer_parent();
revoke all on function validate_answer_parent() from public, anon, authenticated;

create or replace function close_session_atomic(p_session_id uuid,p_user_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare s clinical_sessions%rowtype; c conversations%rowtype; stamp timestamptz:=now();
begin
 -- PostgREST sets the actual SQL role from its verified JWT. Do not use
 -- editable user_metadata or the caller-supplied p_user_id for authorization.
 if current_setting('role',true) <> 'service_role' and (auth.uid() is null or auth.uid()<>p_user_id) then
  raise exception 'Not authorized' using errcode='42501';
 end if;
 if p_reason is null or p_reason not in ('user_request','time_limit','crisis_detected','inactivity') then raise exception 'Invalid closure reason' using errcode='23514'; end if;
 select * into s from clinical_sessions where id=p_session_id and user_id=p_user_id for update;
 if not found then raise exception 'Session not found' using errcode='42501'; end if;
 select * into c from conversations where id=s.conversation_id and user_id=s.user_id for update;
 if not found then raise exception 'Conversation ownership mismatch' using errcode='23514'; end if;
 if s.status='closed' then return; end if;
 if s.status<>'open' or c.status<>'active' then raise exception 'Invalid closure transition' using errcode='23514'; end if;
 update clinical_sessions set status='closed',closed_at=stamp,closure_reason=p_reason where id=s.id;
 update conversations set status='closed',ended_at=stamp where id=c.id;
end $$;
revoke all on function close_session_atomic(uuid,uuid,text) from public,anon;
grant execute on function close_session_atomic(uuid,uuid,text) to authenticated,service_role;

-- Disable the obsolete bulk closure API: callers must use the authorized
-- close_session_atomic contract so session and conversation cannot diverge.
revoke all on function close_stale_sessions(integer) from public,anon,authenticated,service_role;

alter table patient_tasks add column source_task_index integer;
create unique index tasks_assessment_item_unique on patient_tasks(acordada_en_assessment_id,source_task_index) where source_task_index is not null;
alter table assessments add column review_request_json jsonb;
alter table assessments add constraint reviewed_assessment_has_reviewer
 check(status not in ('reviewed_confirmed','reviewed_modified') or (reviewed_by is not null and reviewed_at is not null));

create function review_assessment_atomic(
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
revoke all on function review_assessment_atomic(uuid,uuid,text,jsonb,text,jsonb,text) from public,anon,service_role;
grant execute on function review_assessment_atomic(uuid,uuid,text,jsonb,text,jsonb,text) to authenticated;

alter table assessments add column regeneration_previous_status assessment_status;
create function regenerate_assessment_atomic(p_assessment_id uuid,p_expected_status text,p_restore boolean default false)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare a assessments%rowtype; sid uuid;
begin
 if auth.uid() is null or not is_clinician() then raise exception 'Clinician required' using errcode='42501'; end if;
 if p_expected_status is null or p_expected_status not in ('rejected','requires_manual_review') then raise exception 'Invalid regeneration status' using errcode='23514'; end if;
 select session_id into sid from assessments where id=p_assessment_id;
 perform 1 from clinical_sessions where id=sid and status='closed' for update;
 if not found then raise exception 'Closed session required' using errcode='23514'; end if;
 select * into a from assessments where id=p_assessment_id and assessment_type='closure' for update;
 if not found then raise exception 'Closure assessment required' using errcode='23514'; end if;
 if exists(select 1 from assessments where session_id=sid and assessment_type='closure' and id<>a.id and status not in ('superseded','rejected')) then return false; end if;
 if p_restore then
  if a.status<>'superseded' or a.regeneration_previous_status::text is distinct from p_expected_status then return false; end if;
  update assessments set status=regeneration_previous_status,regeneration_previous_status=null where id=a.id;
 else
  if a.status::text<>p_expected_status then return false; end if;
  update assessments set regeneration_previous_status=status,status='superseded' where id=a.id;
 end if;
 return true;
end $$;
revoke all on function regenerate_assessment_atomic(uuid,text,boolean) from public,anon,service_role;
grant execute on function regenerate_assessment_atomic(uuid,text,boolean) to authenticated;
