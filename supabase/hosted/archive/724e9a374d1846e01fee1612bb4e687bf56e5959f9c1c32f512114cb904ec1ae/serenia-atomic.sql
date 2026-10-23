-- Target-bound preconditions and preservation state; never returned to the caller.
set local lock_timeout = '10s';
set local statement_timeout = '120s';
lock table auth.users, public.user_profiles, public.questionnaire_definitions, public.questionnaire_items in share row exclusive mode;
create temporary table serenia_preservation (
  relation_name text primary key, expected_count bigint not null, aggregate_sha256 text not null, nonce text not null
) on commit drop;
revoke all on table pg_temp.serenia_preservation from public, anon, authenticated, service_role;
do $baseline$
declare rel text; total bigint; digest text; secret_nonce text := gen_random_uuid()::text || gen_random_uuid()::text;
begin
  if (select count(*) from auth.users)<>2 or (select count(*) from public.user_profiles)<>2
    or (select count(*) from public.questionnaire_definitions)<>5 or (select count(*) from public.questionnaire_items)<>65 then
    raise exception 'Hosted preservation baseline counts changed';
  end if;
  if (select jsonb_agg(jsonb_build_object('version',version,'name',name,'statements_md5',md5(array_to_string(statements,E'\n'))) order by version)
      from supabase_migrations.schema_migrations) is distinct from '[{"version":"20260419000001","name":"enums","statements_md5":"cb2bebd88815d1b2d463885187ac616a"},{"version":"20260419000002","name":"user_tables","statements_md5":"d7f8066fc618d14ae6e6769fb0471fc7"},{"version":"20260419000003","name":"conversation_tables","statements_md5":"a5a5e2c6fb76bb126fec6813cd4e4025"},{"version":"20260419000004","name":"questionnaire_tables","statements_md5":"6d55ea9c49907da3e47aedc9365bfa0b"},{"version":"20260419000005","name":"clinical_tables","statements_md5":"89c8d164afdf4a71b99af46cbebceb6a"},{"version":"20260419000006","name":"v15_stubs","statements_md5":"6503b34ed866a718118c15daef564d03"},{"version":"20260419000007","name":"updated_at_trigger","statements_md5":"f5d1db6e3e0de7581a6e0df81b13be4a"},{"version":"20260419000008","name":"rls_owner_only","statements_md5":"0e72c7f78981e5aa1a7214536a588597"},{"version":"20260419000009","name":"rls_public_and_restricted","statements_md5":"7f011544a8a2424f74f22c3bfa6b2172"},{"version":"20260419000010","name":"gdpr_erase","statements_md5":"eaedd14e1cf6d6460219704176c5d1ce"},{"version":"20260420000001","name":"user_profiles_extend","statements_md5":"d151e3e1efd9b79ac46d108c735cee8e"},{"version":"20260420000002","name":"user_profile_trigger","statements_md5":"7376e06e064b1321df55ea57134f6fd9"},{"version":"20260420000003","name":"rls_clinician_read","statements_md5":"1f83ca4931b8ba435d3ccef89e2d0695"},{"version":"20260421000001","name":"clinical_sessions_extend","statements_md5":"26f4d9226f56d43eadb69325960a20df"},{"version":"20260421000002","name":"close_stale_sessions","statements_md5":"630e87d8e8369173075458391de5b1ee"},{"version":"20260421000003","name":"messages_insert_own","statements_md5":"d152d59d113d753b61565fbeb3e83532"},{"version":"20260421000004","name":"clinical_sessions_single_open","statements_md5":"50bd572bd0083a8ac18ae6948dd79e7e"},{"version":"20260422000001","name":"seed_questionnaires","statements_md5":"7b04599461bbda09f47576c493be159a"},{"version":"20260422000002","name":"questionnaire_answers_insert","statements_md5":"2121c5a43fc69b15792702f3adb07afd"},{"version":"20260422000003","name":"questionnaire_results_risk_events_insert","statements_md5":"1c2fa8a0a0f515d7fd654d1559b7512c"},{"version":"20260422000004","name":"assessments_insert_own","statements_md5":"4cb081ddfbb35e67c3bbbf12f6c5dda1"},{"version":"20260423000001","name":"rls_clinician_write","statements_md5":"95ebe3b75d52aee128dd9721aab92c59"},{"version":"20260423000002","name":"assessments_rejection_reason","statements_md5":"5362406f7ad5fbafe0408cdc7e6dc698"},{"version":"20260423000003","name":"assessments_reviewed_by_auth_users","statements_md5":"ff0d520cdbb48cefa6353a6bee8f0338"},{"version":"20260424000001","name":"patient_tasks","statements_md5":"e08daddb87ee9cd70fb7ce405261d0d7"},{"version":"20260424000002","name":"indexes_patient_context","statements_md5":"86108a034bc5d17e828d7153aed17b5e"},{"version":"20260424000003","name":"patient_context_injections","statements_md5":"2d5400dcd953e73f3ba0702e9905d1ad"},{"version":"20260424000004","name":"assessment_requires_manual_review","statements_md5":"c24ec99b57d19021d4b13647fa8aac35"},{"version":"20260426000001","name":"assessments_clinical_notes","statements_md5":"5830622b76bfbf46c201e5aea42a469b"},{"version":"20260502000001","name":"questionnaires_clinician_rated","statements_md5":"a55d3dc87de61c12bbf418b29fcd1eca"},{"version":"20260502000002","name":"clinical_sessions_protocol_phase","statements_md5":"eb33b2fb5c756eb832b9e02d273be41f"},{"version":"20260502000003","name":"user_profiles_intake_clinico","statements_md5":"d63bf0d56fd656202e87c09df5cc2ee3"},{"version":"20260502000004","name":"wipe_legacy_test_data","statements_md5":"d3f66adf379a4279447a6627efe19d0a"},{"version":"20260502000005","name":"restore_preserved_profiles","statements_md5":"e75d54df0dd6466be8191ded3039d44e"},{"version":"20260502000006","name":"close_session_rpc","statements_md5":"3ff563f335d9387dfe72ef8d60cfd0d5"},{"version":"20260502000007","name":"hot_path_indices","statements_md5":"3ce4080bd2fd6e9bc12c8a9adcbf4bef"},{"version":"20260503204403","name":"seed_bdi2","statements_md5":"38f5f5e0382955de0fc941aa3dc722df"},{"version":"20260516175534","name":"seed_bai","statements_md5":"34143b4c825ba4775e7424179dc481d8"},{"version":"20260517151619","name":"seed_cssrs","statements_md5":"4f2fc5d05b4702b4fcc888704ca56256"},{"version":"20260517153400","name":"drop_asq","statements_md5":"f94f1328d4925f77e77be9893de1c514"}]'::jsonb then
    raise exception 'Hosted migration history drifted';
  end if;
  if (select jsonb_agg(row_to_json(x)::jsonb order by code) from (
    select d.code,encode(sha256(convert_to((to_jsonb(d)-'id'-'created_at'-'updated_at')::text,'UTF8')),'hex') as definition_sha256,
      (select count(*) from public.questionnaire_items i where i.questionnaire_id=d.id) as items,
      (select encode(sha256(convert_to(coalesce(string_agg((to_jsonb(i)-'id'-'questionnaire_id'-'created_at'-'updated_at')::text,E'\n' order by i.order_index),''),'UTF8')),'hex') from public.questionnaire_items i where i.questionnaire_id=d.id) as items_sha256
    from public.questionnaire_definitions d) x) is distinct from '[{"code":"BAI","definition_sha256":"bd76a03f6132e819a8a0fc35f769fc694ae3c1b68a1ed427ee05a3e9bd13c8ca","items":21,"items_sha256":"910666dd581db8a7b92bf4694c54c47045b039328792f5390d06381bc497a1a6"},{"code":"BDI2","definition_sha256":"ba5c841ecda95dcd3cc34b944f6989a79a05e6689e461bc8748233f6f156de02","items":21,"items_sha256":"47b02e0550f8e2f4322c9326f22a69e8df54718b1b8d4fde598e4b27cf94ebde"},{"code":"CSSRS","definition_sha256":"017eb76248c16cbb8729dd417d033efb670987a42d2608c39ef0c0897a2ea9ef","items":7,"items_sha256":"238a8604a0fdeab09913ce3c230c7723948ff95b4b39292ef775d55b47b3f238"},{"code":"GAD7","definition_sha256":"a38c258a1aa0bf85d62cbc573caa8ff48ec168e0238e3b9194309d7e652786c7","items":7,"items_sha256":"8ea077be305a2a046ec9f131344bc6585161fdf9cfa5a04d31785ff57f3d9933"},{"code":"PHQ9","definition_sha256":"a2e8acf28de4a85dea7192af3720316dc2127efdb9abd550ddc6105a36a13d21","items":9,"items_sha256":"248aca918cdc8298fab08cbb1866b1380268af87c7b1130253cb43f38c2490f9"}]'::jsonb then
    raise exception 'Hosted reviewed catalog semantic baseline changed';
  end if;
  if pg_get_userbyid((select relowner from pg_class where oid='auth.users'::regclass))<>'supabase_auth_admin'
    or to_regprocedure('public.rls_auto_enable()') is null
    or not exists(select 1 from pg_roles where rolname='supabase_admin')
    or not exists(select 1 from pg_roles where rolname='supabase_auth_admin') then
    raise exception 'Hosted platform baseline changed';
  end if;
  for rel in select unnest(array['public.assessments','public.audit_log','public.care_plans','public.clinical_sessions','public.clinician_reviews','public.clinicians','public.consents','public.conversations','public.messages','public.patient_context_injections','public.patient_tasks','public.questionnaire_answers','public.questionnaire_instances','public.questionnaire_results','public.risk_events','public.session_summaries','public.user_clinician_assignments']) loop
    execute format('lock table %s in share row exclusive mode',rel);
    execute format('select count(*) from %s',rel) into total;
    if total<>0 then raise exception 'Hosted clinical baseline changed'; end if;
  end loop;
  foreach rel in array array['auth.users','public.user_profiles','public.questionnaire_definitions','public.questionnaire_items'] loop
    execute format($q$select count(*),encode(sha256(convert_to(coalesce(string_agg(row_hash,'' order by row_hash),''),'UTF8')),'hex')
      from (select encode(sha256(convert_to($1 || to_jsonb(r)::text,'UTF8')),'hex') row_hash from %s r) x$q$,rel)
      into total,digest using secret_nonce;
    insert into pg_temp.serenia_preservation values(rel,total,digest,secret_nonce);
  end loop;
end;
$baseline$;

-- BEGIN EXACT 20261010075359_robust_authorization_review.sql SHA256 91e1840c6a8d2c1f0ea086b3ffe7742859a49b5c55860dcb6401aeeac23e0c82
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

-- END EXACT 20261010075359_robust_authorization_review.sql

-- BEGIN EXACT 20261010123627_robust_chat_questionnaires_recovery.sql SHA256 11d7b8d3b913624c4e6afd8720875bb9f1575848306af6d8f8746330a97c16ea
-- Request/outbox state is private operational data; explicit grants do not
-- depend on installation-specific default privileges (Data API / PostgREST).
create table chat_turns (
 session_id uuid not null references clinical_sessions(id) on delete cascade,
 request_id text not null check(length(request_id) between 1 and 100),
 user_id uuid not null references auth.users(id) on delete cascade,
 text text not null check(length(trim(text)) between 1 and 6000),
 user_message_id uuid not null references messages(id) on delete cascade,
 previous_request_id text,
 status text not null check(status in ('generating','completed','failed','interrupted')),
 token uuid not null default gen_random_uuid(),
 lease_until timestamptz not null,
 attempts integer not null default 1 check(attempts between 1 and 3),
 response_parts jsonb, response_chunks jsonb, error_code text,
 urgent_response boolean not null default false,
 created_at timestamptz not null default clock_timestamp(),
 primary key(session_id,request_id),
 foreign key(session_id,user_id) references clinical_sessions(id,user_id) on delete cascade
);
create table session_close_proposals (
 session_id uuid primary key references clinical_sessions(id) on delete cascade,
 request_id text not null,
 reason text not null check(reason in ('user_request','time_limit')),
 foreign key(session_id,request_id) references chat_turns(session_id,request_id) on delete cascade
);
create table assessment_jobs (
 session_id uuid primary key references clinical_sessions(id) on delete cascade,
 context_json jsonb,
 status text not null default 'pending' check(status in ('pending','enqueued','running','completed','exhausted')),
 token uuid, lease_until timestamptz, available_at timestamptz not null default now(),
 attempts integer not null default 0 check(attempts between 0 and 5),
 run_id text, last_error text, updated_at timestamptz not null default now()
);
alter table chat_turns enable row level security;
alter table session_close_proposals enable row level security;
alter table assessment_jobs enable row level security;
revoke all on chat_turns,session_close_proposals,assessment_jobs from public,anon,authenticated;
grant select,insert,update,delete on chat_turns,session_close_proposals,assessment_jobs to service_role;
alter table messages alter column created_at set default clock_timestamp();
create index assessment_jobs_available on assessment_jobs(available_at) where status in ('pending','enqueued','running');
alter table questionnaire_instances add column submission_json jsonb;
alter table questionnaire_instances add column chat_request_id text;
create unique index questionnaire_turn_code_unique on questionnaire_instances(session_id,chat_request_id,questionnaire_id) where chat_request_id is not null;

create function create_session_atomic(p_user_id uuid) returns clinical_sessions
language plpgsql security definer set search_path=public,pg_temp as $$
declare s clinical_sessions%rowtype; cid uuid; phase integer;
begin
 if auth.uid() is null or auth.uid()<>p_user_id then raise exception 'Unauthorized' using errcode='42501'; end if;
 perform 1 from user_profiles where user_id=p_user_id for update;
 if not found then raise exception 'Profile required' using errcode='23514'; end if;
 select * into s from clinical_sessions where user_id=p_user_id and status='open';
 if found then return s; end if;
 select least(count(*)+1,8) into phase from clinical_sessions where user_id=p_user_id and status='closed';
 insert into conversations(user_id) values(p_user_id) returning id into cid;
 insert into clinical_sessions(user_id,conversation_id,protocol_phase) values(p_user_id,cid,phase) returning * into s;
 return s;
end $$;
revoke all on function create_session_atomic(uuid) from public,anon,service_role;
grant execute on function create_session_atomic(uuid) to authenticated;

create function touch_session_atomic(p_session_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'Unauthorized' using errcode='42501'; end if;
 update clinical_sessions set last_activity_at=now() where id=p_session_id and user_id=auth.uid() and status='open';
 if not found then raise exception 'Open owned session required' using errcode='42501'; end if;
end $$;
revoke all on function touch_session_atomic(uuid) from public,anon,service_role;
grant execute on function touch_session_atomic(uuid) to authenticated;

create or replace function close_session_atomic(p_session_id uuid,p_user_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare s clinical_sessions%rowtype; c conversations%rowtype; stamp timestamptz:=now();
begin
 if current_setting('role',true)<>'service_role' and (auth.uid() is null or auth.uid()<>p_user_id) then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_reason is null or p_reason not in ('user_request','time_limit','crisis_detected','inactivity') then raise exception 'Invalid closure reason' using errcode='23514'; end if;
 select * into s from clinical_sessions where id=p_session_id and user_id=p_user_id for update;
 if not found then raise exception 'Session not found' using errcode='42501'; end if;
 select * into c from conversations where id=s.conversation_id and user_id=s.user_id for update;
 if not found then raise exception 'Conversation ownership mismatch' using errcode='23514'; end if;
 if s.status<>'closed' then
  if s.status<>'open' or c.status<>'active' then raise exception 'Invalid closure transition' using errcode='23514'; end if;
  if p_reason='inactivity' and s.last_activity_at>clock_timestamp()-interval '30 minutes' then raise exception 'Session activity resumed' using errcode='23514'; end if;
  stamp=clock_timestamp();
  update clinical_sessions set status='closed',closed_at=stamp,closure_reason=p_reason where id=s.id;
  update conversations set status='closed',ended_at=stamp where id=c.id;
 end if;
 -- The accepted user text/risk remains part of the sealed transcript. Any
 -- still-running response loses its token before the outbox becomes visible.
 update chat_turns set status='interrupted',token=gen_random_uuid(),lease_until=now(),error_code='session_closed' where session_id=s.id and status in ('generating','failed');
 delete from session_close_proposals where session_id=s.id;
 insert into assessment_jobs(session_id) values(s.id) on conflict do nothing;
end $$;
revoke all on function close_session_atomic(uuid,uuid,text) from public,anon;
grant execute on function close_session_atomic(uuid,uuid,text) to authenticated,service_role;

-- Protect even legacy server writers against inserting after closure.
-- The parent row lock serializes this with close_session_atomic.
create function require_open_message_session() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if new.session_id is not null then
  perform 1 from clinical_sessions where id=new.session_id and status='open' for update;
  if not found then raise exception 'Open message session required' using errcode='23514'; end if;
 end if;
 return new;
end $$;
revoke all on function require_open_message_session() from public,anon,authenticated;
create trigger messages_require_open_session before insert on messages for each row execute function require_open_message_session();

-- Server-only operations are invokers with narrowly granted EXECUTE. Their
-- explicit owner is checked against locked parents even under service_role.
create function create_questionnaire_atomic(p_session_id uuid,p_user_id uuid,p_conversation_id uuid,p_code text,p_reason text,p_request_id text default null,p_token uuid default null)
returns questionnaire_instances language plpgsql set search_path=public,pg_temp as $$
declare s clinical_sessions%rowtype; q questionnaire_definitions%rowtype; i questionnaire_instances%rowtype;
begin
 select * into s from clinical_sessions where id=p_session_id and user_id=p_user_id and conversation_id=p_conversation_id for update;
 if not found or s.status<>'open' then raise exception 'Open owned session required' using errcode='42501'; end if;
 if p_request_id is not null and not exists(select 1 from chat_turns where session_id=s.id and request_id=p_request_id and token=p_token and status='generating' and lease_until>now()) then raise exception 'Stale turn owner' using errcode='42501'; end if;
 select * into q from questionnaire_definitions where code=p_code and is_active and not is_clinician_rated;
 if not found then raise exception 'Patient questionnaire required' using errcode='23514'; end if;
 if p_request_id is not null then
  select * into i from questionnaire_instances where session_id=s.id and chat_request_id=p_request_id and questionnaire_id=q.id;
  if found then return i; end if;
 end if;
 if p_code='CSSRS' then
  select * into i from questionnaire_instances where session_id=s.id and questionnaire_id=q.id and status in ('proposed','in_progress') order by created_at desc limit 1;
  if found then return i; end if;
  update questionnaire_instances set status='cancelled' where session_id=s.id and status in ('proposed','in_progress');
 else
  select * into i from questionnaire_instances where session_id=s.id and status in ('proposed','in_progress') order by created_at desc limit 1;
  if found then return i; end if;
 end if;
 insert into questionnaire_instances(user_id,session_id,conversation_id,questionnaire_id,triggered_by,status,trigger_reason,chat_request_id)
 values(s.user_id,s.id,s.conversation_id,q.id,'ai','proposed',p_reason,p_request_id) returning * into i;
 return i;
end $$;
revoke all on function create_questionnaire_atomic(uuid,uuid,uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function create_questionnaire_atomic(uuid,uuid,uuid,text,text,text,uuid) to service_role;

create function start_questionnaire_atomic(p_instance_id uuid,p_user_id uuid) returns void language plpgsql set search_path=public,pg_temp as $$
declare i questionnaire_instances%rowtype;
begin
 select * into i from questionnaire_instances where id=p_instance_id and user_id=p_user_id for update;
 if not found or not exists(select 1 from clinical_sessions where id=i.session_id and user_id=i.user_id and conversation_id=i.conversation_id and status='open') then raise exception 'Open owned parent required' using errcode='42501'; end if;
 if i.status='proposed' then update questionnaire_instances set status='in_progress',started_at=now() where id=i.id;
 elsif i.status<>'in_progress' then raise exception 'Questionnaire closed' using errcode='23514'; end if;
end $$;
revoke all on function start_questionnaire_atomic(uuid,uuid) from public,anon,authenticated;
grant execute on function start_questionnaire_atomic(uuid,uuid) to service_role;

create function submit_questionnaire_atomic(p_instance_id uuid,p_user_id uuid,p_answers jsonb,p_result jsonb,p_risk_severity text default null)
returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare i questionnaire_instances%rowtype; s clinical_sessions%rowtype; answer_doc jsonb; item questionnaire_items%rowtype; code text; n integer;
begin
 select cs.* into s from clinical_sessions cs join questionnaire_instances qi on qi.session_id=cs.id where qi.id=p_instance_id and qi.user_id=p_user_id and cs.user_id=p_user_id and cs.conversation_id=qi.conversation_id for update of cs;
 if not found then raise exception 'Owned parent required' using errcode='42501'; end if;
 select * into i from questionnaire_instances where id=p_instance_id and user_id=p_user_id for update;
 if i.status='scored' then
  if i.submission_json is distinct from p_answers then raise exception 'Conflicting retry' using errcode='23514'; end if;
  return jsonb_build_object('replayed',true);
 end if;
 if s.status<>'open' or i.status not in ('proposed','in_progress') then raise exception 'Questionnaire closed' using errcode='23514'; end if;
 if jsonb_typeof(p_answers) is distinct from 'array' or jsonb_typeof(p_result) is distinct from 'object' then raise exception 'Invalid submission' using errcode='23514'; end if;
 select count(*) into n from questionnaire_items where questionnaire_id=i.questionnaire_id;
 if jsonb_array_length(p_answers)<>n or (select count(distinct (value->>'itemOrder')::integer) from jsonb_array_elements(p_answers))<>n then raise exception 'Incomplete or duplicate answers' using errcode='23514'; end if;
 select q.code into code from questionnaire_definitions q where q.id=i.questionnaire_id;
 for answer_doc in select value from jsonb_array_elements(p_answers) loop
  select * into item from questionnaire_items where questionnaire_id=i.questionnaire_id and order_index=(answer_doc->>'itemOrder')::integer;
  if not found or not exists(select 1 from jsonb_array_elements(item.options_json) o where o->>'value'=answer_doc->>'valueNumeric' and answer_doc->>'valueRaw' in (o->>'value',o->>'label')) then raise exception 'Invalid option/raw value' using errcode='23514'; end if;
 end loop;
 if code='CSSRS' and (
  (exists(select 1 from jsonb_array_elements(p_answers) a where a->>'itemOrder'='2' and a->>'valueNumeric'='0') and exists(select 1 from jsonb_array_elements(p_answers) a where (a->>'itemOrder')::integer in (3,4,5) and a->>'valueNumeric'<>'0')) or
  (exists(select 1 from jsonb_array_elements(p_answers) a where a->>'itemOrder'='6' and a->>'valueNumeric'='0') and exists(select 1 from jsonb_array_elements(p_answers) a where a->>'itemOrder'='7' and a->>'valueNumeric'<>'0'))
 ) then raise exception 'Invalid CSSRS branch' using errcode='23514'; end if;
 insert into questionnaire_answers(instance_id,item_id,answer_raw,answer_numeric)
 select i.id,t.id,a->>'valueRaw',(a->>'valueNumeric')::integer from jsonb_array_elements(p_answers) a join questionnaire_items t on t.questionnaire_id=i.questionnaire_id and t.order_index=(a->>'itemOrder')::integer;
 insert into questionnaire_results(instance_id,total_score,severity_band,subscores_json,flags_json,requires_review)
 values(i.id,(p_result->>'totalScore')::integer,p_result->>'severityBand',p_result->'subscores',p_result->'flags',(p_result->>'requiresReview')::boolean);
 update questionnaire_instances set status='scored',submitted_at=now(),scored_at=now(),submission_json=p_answers where id=i.id;
 if p_risk_severity is not null then
  if p_risk_severity not in ('high','critical') then raise exception 'Invalid risk severity' using errcode='23514'; end if;
  insert into risk_events(user_id,session_id,conversation_id,risk_type,severity,source_type,payload_json)
  values(i.user_id,i.session_id,i.conversation_id,'suicidal_ideation',p_risk_severity::risk_severity,'questionnaire',jsonb_build_object('questionnaire_code',code,'instance_id',i.id,'flags',p_result->'flags','total_score',p_result->'totalScore','severity_band',p_result->'severityBand'));
 end if;
 return jsonb_build_object('replayed',false);
end $$;
revoke all on function submit_questionnaire_atomic(uuid,uuid,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function submit_questionnaire_atomic(uuid,uuid,jsonb,jsonb,text) to service_role;

create function begin_chat_turn(p_session_id uuid,p_user_id uuid,p_request_id text,p_text text,p_crisis boolean default false,p_urgent boolean default false)
returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare s clinical_sessions%rowtype; t chat_turns%rowtype; mid uuid; prev text; urgent boolean:=false;
begin
 select * into s from clinical_sessions where id=p_session_id and user_id=p_user_id for update;
 if not found then raise exception 'Owned session required' using errcode='42501'; end if;
 select * into t from chat_turns where session_id=s.id and request_id=p_request_id for update;
 if found then
  if t.text<>p_text then raise exception 'Conflicting request ID' using errcode='23514'; end if;
  if t.status='completed' then return jsonb_build_object('replay',true,'chunks',t.response_chunks); end if;
  if t.status='interrupted' then raise exception 'Turn interrupted by urgent signal' using errcode='23514'; end if;
  if t.status='generating' and t.lease_until>now() then raise exception 'turn_in_progress' using errcode='55P03'; end if;
  if t.attempts>=3 then raise exception 'turn_attempts_exhausted' using errcode='23514'; end if;
 else
  if s.status<>'open' then raise exception 'Session closed' using errcode='23514'; end if;
 end if;
 if exists(select 1 from chat_turns where session_id=s.id and request_id<>p_request_id and status in ('generating','failed')) then
  if not p_crisis or not p_urgent or t.request_id is not null then raise exception 'Resolve previous turn first' using errcode='55P03'; end if;
  -- A fresh, specific safety signal may interrupt an unresolved turn. Fence
  -- its owner and answer deterministically; never start a second LLM call.
  update chat_turns set status='interrupted',token=gen_random_uuid(),lease_until=now(),error_code='urgent_signal' where session_id=s.id and status in ('generating','failed');
  urgent=true;
 end if;
 if t.request_id is null then
  if (select count(*) from chat_turns where session_id=s.id)>=80 then
   if not p_crisis or not p_urgent then raise exception 'turn_limit' using errcode='23514'; end if;
   urgent=true;
  end if;
  select request_id into prev from chat_turns where session_id=s.id order by created_at desc limit 1;
  insert into messages(conversation_id,session_id,role,parts) values(s.conversation_id,s.id,'user',jsonb_build_array(jsonb_build_object('type','text','text',p_text))) returning id into mid;
  insert into chat_turns(session_id,request_id,user_id,text,user_message_id,previous_request_id,status,lease_until,urgent_response) values(s.id,p_request_id,p_user_id,p_text,mid,prev,'generating',now()+interval '2 minutes',urgent) returning * into t;
  if p_crisis then
   insert into risk_events(user_id,session_id,conversation_id,risk_type,severity,source_type,payload_json) values(s.user_id,s.id,s.conversation_id,'suicidal_ideation','high','conversation',jsonb_build_object('request_id',p_request_id,'signal','textual_crisis'));
  end if;
 else
  update chat_turns set status='generating',token=gen_random_uuid(),lease_until=now()+interval '2 minutes',attempts=attempts+1,error_code=null where session_id=s.id and request_id=p_request_id returning * into t;
 end if;
 update clinical_sessions set last_activity_at=now() where id=s.id;
 return jsonb_build_object('replay',false,'token',t.token,'userMessageId',t.user_message_id,'urgent',t.urgent_response);
end $$;
revoke all on function begin_chat_turn(uuid,uuid,text,text,boolean,boolean) from public,anon,authenticated;
grant execute on function begin_chat_turn(uuid,uuid,text,text,boolean,boolean) to service_role;

create function finish_chat_turn(p_session_id uuid,p_request_id text,p_token uuid,p_parts jsonb,p_chunks jsonb,p_proposal text default null,p_close_reason text default null)
returns void language plpgsql set search_path=public,pg_temp as $$
declare t chat_turns%rowtype; s clinical_sessions%rowtype;
begin
 select * into s from clinical_sessions where id=p_session_id for update;
 select * into t from chat_turns where session_id=s.id and request_id=p_request_id and token=p_token for update;
 if not found then raise exception 'Stale turn owner' using errcode='42501'; end if;
 if t.status='completed' then return; end if;
 if s.status<>'open' then raise exception 'Session closed' using errcode='42501'; end if;
 if t.status<>'generating' or t.lease_until<now() then raise exception 'Expired turn' using errcode='42501'; end if;
 if p_close_reason is not null then
  if not (p_close_reason='time_limit' and s.opened_at<=now()-interval '1 hour') and not close_chat_turn(s.id,t.request_id,t.token,p_close_reason) then raise exception 'Closure not authorized' using errcode='42501'; end if;
 end if;
 if jsonb_typeof(p_parts) is distinct from 'array' or jsonb_array_length(p_parts)=0 or jsonb_typeof(p_chunks) is distinct from 'array' then raise exception 'Empty response' using errcode='23514'; end if;
 insert into messages(conversation_id,session_id,role,parts) values(s.conversation_id,s.id,'assistant',p_parts);
 update chat_turns set status='completed',response_parts=p_parts,response_chunks=p_chunks,error_code=null where session_id=s.id and request_id=t.request_id;
 -- The own-turn close commits the assistant first, then seals the transcript
 -- and creates its outbox in this same transaction. No worker sees a gap.
 if p_close_reason is not null then perform close_session_atomic(s.id,t.user_id,p_close_reason); end if;
 delete from session_close_proposals where session_id=s.id;
 if p_proposal is not null and p_close_reason is null and s.status='open' then insert into session_close_proposals values(s.id,t.request_id,p_proposal); end if;
end $$;
revoke all on function finish_chat_turn(uuid,text,uuid,jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function finish_chat_turn(uuid,text,uuid,jsonb,jsonb,text,text) to service_role;

create function fail_chat_turn(p_session_id uuid,p_request_id text,p_token uuid,p_error text) returns void language sql set search_path=public,pg_temp as $$
 update chat_turns set status='failed',error_code=p_error where session_id=p_session_id and request_id=p_request_id and token=p_token and status='generating';
$$;
revoke all on function fail_chat_turn(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function fail_chat_turn(uuid,text,uuid,text) to service_role;

-- Narrow recovery projection, never operational table SELECT for patients.
create function get_chat_turn_recovery(p_session_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare t chat_turns%rowtype;
begin
 if auth.uid() is null or not exists(select 1 from clinical_sessions where id=p_session_id and user_id=auth.uid()) then raise exception 'Owned session required' using errcode='42501'; end if;
 select * into t from chat_turns where session_id=p_session_id and user_id=auth.uid() and status in ('generating','failed') order by created_at desc limit 1;
 if not found then return null; end if;
 return jsonb_build_object('requestId',t.request_id,'text',t.text,'status',t.status,'canRetry',t.attempts<3 and (t.status='failed' or t.lease_until<=now()),'leaseUntil',t.lease_until);
end $$;
revoke all on function get_chat_turn_recovery(uuid) from public,anon,service_role;
grant execute on function get_chat_turn_recovery(uuid) to authenticated;

create function close_chat_turn(p_session_id uuid,p_request_id text,p_token uuid,p_reason text)
returns boolean language plpgsql set search_path=public,pg_temp as $$
declare s clinical_sessions%rowtype; t chat_turns%rowtype; proposal session_close_proposals%rowtype;
begin
 select * into s from clinical_sessions where id=p_session_id for update;
 select * into t from chat_turns where session_id=s.id and request_id=p_request_id and token=p_token and status='generating' and lease_until>now() for update;
 if not found then raise exception 'Stale turn owner' using errcode='42501'; end if;
 if p_reason in ('user_request','time_limit') then
  select * into proposal from session_close_proposals where session_id=s.id and request_id=t.previous_request_id and reason=p_reason;
  if not found or trim(t.text) !~* '^(s[ií](,?\s+(cerramos|quiero cerrar( la sesi[oó]n)?))?|de acuerdo|vale|acepto|cerramos|quiero cerrar( la sesi[oó]n)?)[.!\s]*$' then return false; end if;
 elsif p_reason='crisis_detected' then
  if not exists(select 1 from risk_events where session_id=s.id and ((payload_json->>'request_id'=t.request_id and payload_json->>'signal'='textual_crisis') or (source_type='questionnaire' and severity='critical'))) then return false; end if;
 else return false;
 end if;
 return true;
end $$;
revoke all on function close_chat_turn(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function close_chat_turn(uuid,text,uuid,text) to service_role;

create function recover_assessment_jobs(p_limit integer default 10) returns integer language plpgsql set search_path=public,pg_temp as $$
declare n integer;
begin
 insert into assessment_jobs(session_id)
 select s.id from clinical_sessions s where s.status='closed' and not exists(select 1 from assessments a where a.session_id=s.id and a.assessment_type='closure') and not exists(select 1 from assessment_jobs j where j.session_id=s.id) order by s.closed_at limit least(greatest(p_limit,1),20) on conflict do nothing;
 get diagnostics n=row_count; return n;
end $$;
revoke all on function recover_assessment_jobs(integer) from public,anon,authenticated;
grant execute on function recover_assessment_jobs(integer) to service_role;

create function claim_assessment_jobs(p_limit integer default 10,p_session_id uuid default null) returns setof assessment_jobs language plpgsql set search_path=public,pg_temp as $$
declare slots integer;
begin
 -- Global capacity protects cost across overlapping cron/manual dispatches,
 -- not just within a single process. Expired leases free their slots.
 perform pg_advisory_xact_lock(hashtext('serenia_assessment_job_capacity'));
 select greatest(0,2-count(*)) into slots from assessment_jobs where status in ('enqueued','running') and lease_until>now();
 if slots=0 then return; end if;
 return query with candidates as (
  select j.session_id from assessment_jobs j join clinical_sessions s on s.id=j.session_id
  where s.status='closed' and (p_session_id is null or j.session_id=p_session_id) and j.attempts<5 and j.available_at<=now()
   and (j.status='pending' or (j.status in ('enqueued','running') and j.lease_until<now()))
   and not exists(select 1 from assessments a where a.session_id=s.id and a.assessment_type='closure' and a.status not in ('superseded','rejected'))
  order by j.available_at limit least(greatest(p_limit,1),10,slots) for update of j skip locked
 ) update assessment_jobs j set status='enqueued',token=gen_random_uuid(),lease_until=now()+interval '10 minutes',attempts=j.attempts+1,updated_at=now()
 from candidates c where j.session_id=c.session_id returning j.*;
end $$;
revoke all on function claim_assessment_jobs(integer,uuid) from public,anon,authenticated;
grant execute on function claim_assessment_jobs(integer,uuid) to service_role;

create function update_assessment_job(p_session_id uuid,p_token uuid,p_action text,p_run_id text default null) returns boolean language plpgsql set search_path=public,pg_temp as $$
declare j assessment_jobs%rowtype;
begin
 select * into j from assessment_jobs where session_id=p_session_id and token=p_token for update;
 if not found then return false; end if;
 if p_action='start' then
  if j.status<>'enqueued' or j.lease_until<now() then return false; end if;
  update assessment_jobs set status='running',lease_until=now()+interval '30 minutes',updated_at=now() where session_id=j.session_id;
 elsif p_action='enqueued' then
  update assessment_jobs set run_id=p_run_id,updated_at=now() where session_id=j.session_id;
 elsif p_action='failed' then
  update assessment_jobs set status=case when attempts>=5 then 'exhausted' else 'pending' end,available_at=now()+interval '5 minutes',lease_until=null,last_error='enqueue_failed',updated_at=now() where session_id=j.session_id;
 elsif p_action='completed' then
  update assessment_jobs set status='completed',lease_until=null,updated_at=now() where session_id=j.session_id;
 elsif p_action='check' then return j.status='running' and j.lease_until>now();
 else raise exception 'Invalid job action' using errcode='23514';
 end if;
 return true;
end $$;
revoke all on function update_assessment_job(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function update_assessment_job(uuid,uuid,text,text) to service_role;

-- Fence the last write, not only generation: durable retries may resume
-- after a lease has expired or a clinician has requested regeneration.
create function finish_assessment_job(p_session_id uuid,p_token uuid,p_status text,p_summary jsonb)
returns boolean language plpgsql set search_path=public,pg_temp as $$
declare s clinical_sessions%rowtype; j assessment_jobs%rowtype;
begin
 select * into s from clinical_sessions where id=p_session_id and status='closed' for update;
 if not found or not exists(select 1 from conversations where id=s.conversation_id and user_id=s.user_id and status='closed') then raise exception 'Closed owned parent required' using errcode='42501'; end if;
 select * into j from assessment_jobs where session_id=s.id and token=p_token for update;
 if not found then return false; end if;
 if j.status='completed' then return true; end if;
 if j.status<>'running' or j.lease_until<=now() then return false; end if;
 if p_status not in ('draft_ai','requires_manual_review') or p_status is null or jsonb_typeof(p_summary) is distinct from 'object' then raise exception 'Invalid generated result' using errcode='23514'; end if;
 -- An existing result, including a clinician rejection, is authoritative.
 -- Superseded rows are the explicit regeneration context, never overwritten.
 if not exists(select 1 from assessments where session_id=s.id and assessment_type='closure' and status<>'superseded') then
  insert into assessments(user_id,session_id,assessment_type,status,generated_by,summary_json)
  values(s.user_id,s.id,'closure',p_status::assessment_status,'ai',p_summary);
 end if;
 update assessment_jobs set status='completed',lease_until=null,updated_at=now() where session_id=s.id;
 return true;
end $$;
revoke all on function finish_assessment_job(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function finish_assessment_job(uuid,uuid,text,jsonb) to service_role;

-- A regeneration claim and its clinical context commit together. Preserve
-- the Task 1 API and conditional restore; restore also cancels its pending job.
create or replace function regenerate_assessment_atomic(p_assessment_id uuid,p_expected_status text,p_restore boolean default false)
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
  if a.status<>'superseded' or a.regeneration_previous_status::text is distinct from p_expected_status or exists(select 1 from assessment_jobs where session_id=sid and status in ('enqueued','running')) then return false; end if;
  update assessments set status=regeneration_previous_status,regeneration_previous_status=null where id=a.id;
  delete from assessment_jobs where session_id=sid and status='pending';
 else
  if a.status::text<>p_expected_status then return false; end if;
  update assessments set regeneration_previous_status=status,status='superseded' where id=a.id;
  insert into assessment_jobs(session_id,context_json) values(sid,jsonb_build_object('rejectionReason',coalesce(a.rejection_reason,'Regeneración de informe que requiere revisión manual'),'clinicalNotes',a.clinical_notes))
  on conflict(session_id) do update set context_json=excluded.context_json,status='pending',token=null,attempts=0,run_id=null,last_error=null,lease_until=null,available_at=now(),updated_at=now();
 end if;
 return true;
end $$;
revoke all on function regenerate_assessment_atomic(uuid,text,boolean) from public,anon,service_role;
grant execute on function regenerate_assessment_atomic(uuid,text,boolean) to authenticated;

-- END EXACT 20261010123627_robust_chat_questionnaires_recovery.sql

-- BEGIN EXACT 20261010231957_patient_flows_acceptance_private_reports.sql SHA256 e3676f8e38a54ace7ee0f7177963849582cce6316c6b90383107ee0bae37663b
-- Technical draft acknowledgement, not approved legal consent or launch approval.
alter table consents add column server_recorded boolean not null default false;
revoke insert,update,delete,truncate,references,trigger on consents from authenticated,anon;
drop policy if exists consents_insert_own on consents;
revoke insert(consent_version,consent_given_at),update(consent_version,consent_given_at) on user_profiles from authenticated;
create index consents_server_acceptance on consents(user_id,consent_version) where server_recorded;

create function patient_onboarding_ready(p_user_id uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from user_profiles p where p.user_id=p_user_id and p.role='patient'
  and p.birth_date is not null and isfinite(p.birth_date) and p.birth_date <= ((now() at time zone 'UTC')::date - interval '18 years')::date
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
 if p_birth_date is null or not isfinite(p_birth_date) or p_birth_date>((stamp at time zone 'UTC')::date-interval '18 years')::date
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

-- END EXACT 20261010231957_patient_flows_acceptance_private_reports.sql

-- BEGIN EXACT 20261012083833_acceptance_strict_function_lint.sql SHA256 d662ac2e2e188a76350d7a0656fa20696632240d4257f36ca159ddd58ea37bba
-- Preserve function contracts and grants; satisfy strict plpgsql_check warnings.
create or replace function gdpr_erase_user(target_user_id uuid)
returns void
language plpgsql
security definer   -- runs as owner (service role), bypasses RLS
set search_path = public
as $$
declare
  tombstone_id uuid := '00000000-0000-0000-0000-000000000000'::uuid;
begin
  -- Replace actor_id in audit_log to preserve tamper-evidence without PII
  update audit_log
    set actor_id = tombstone_id
    where actor_id = target_user_id;

  -- Hard-delete the auth user; all child tables cascade
  delete from auth.users where id = target_user_id;
end;
$$;


create or replace function close_chat_turn(p_session_id uuid,p_request_id text,p_token uuid,p_reason text)
returns boolean language plpgsql set search_path=public,pg_temp as $$
declare s clinical_sessions%rowtype; t chat_turns%rowtype;
begin
 select * into s from clinical_sessions where id=p_session_id for update;
 select * into t from chat_turns where session_id=s.id and request_id=p_request_id and token=p_token and status='generating' and lease_until>now() for update;
 if not found then raise exception 'Stale turn owner' using errcode='42501'; end if;
 if p_reason in ('user_request','time_limit') then
  perform 1 from session_close_proposals where session_id=s.id and request_id=t.previous_request_id and reason=p_reason;
  if not found or trim(t.text) !~* '^(s[ií](,?\s+(cerramos|quiero cerrar( la sesi[oó]n)?))?|de acuerdo|vale|acepto|cerramos|quiero cerrar( la sesi[oó]n)?)[.!\s]*$' then return false; end if;
 elsif p_reason='crisis_detected' then
  if not exists(select 1 from risk_events where session_id=s.id and ((payload_json->>'request_id'=t.request_id and payload_json->>'signal'='textual_crisis') or (source_type='questionnaire' and severity='critical'))) then return false; end if;
 else return false;
 end if;
 return true;
end $$;

-- END EXACT 20261012083833_acceptance_strict_function_lint.sql

-- BEGIN EXACT 20261012084307_acceptance_strict_rls_advisors.sql SHA256 465eb192ef1595c046f3d392139a476ff740355de3f80680a17b5b5a9760e358
-- Preserve all existing grants, SELECT commands and effective role predicates.
-- PUBLIC owner+clinician pairs become their exact OR. For the three
-- authenticated owner policies, pg_has_role USAGE preserves PostgreSQL
-- has_privs_of_role applicability while PUBLIC clinician access is unchanged.
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='user_profiles' and policyname='user_profiles_select_own' and cmd='SELECT' and permissive='PERMISSIVE' and roles='{public}'::name[]) or not exists(select 1 from pg_policies where schemaname='public' and tablename='user_profiles' and policyname='user_profiles_select_clinician' and cmd='SELECT' and permissive='PERMISSIVE' and roles='{public}'::name[]) then raise exception 'Unexpected baseline roles/command for user_profiles'; end if;
end $$;
drop policy user_profiles_select_own on user_profiles;
drop policy user_profiles_select_clinician on user_profiles;
create policy user_profiles_read_authorized on user_profiles for select to public
 using ((user_id = (select auth.uid())) or (select is_clinician()));

do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='conversations' and policyname='conversations_read_owner' and cmd='SELECT' and permissive='PERMISSIVE' and roles='{authenticated}'::name[]) or not exists(select 1 from pg_policies where schemaname='public' and tablename='conversations' and policyname='conversations_select_clinician' and cmd='SELECT' and permissive='PERMISSIVE' and roles='{public}'::name[]) then raise exception 'Unexpected baseline roles/command for conversations'; end if;
end $$;
drop policy conversations_read_owner on conversations;
drop policy conversations_select_clinician on conversations;
create policy conversations_read_authorized on conversations for select to public
 using (((select pg_has_role(current_user, 'authenticated', 'USAGE')) and (user_id = (select auth.uid()))) or (select is_clinician()));

do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='clinical_sessions' and policyname='sessions_read_owner' and cmd='SELECT' and permissive='PERMISSIVE' and roles='{authenticated}'::name[]) or not exists(select 1 from pg_policies where schemaname='public' and tablename='clinical_sessions' and policyname='clinical_sessions_select_clinician' and cmd='SELECT' and permissive='PERMISSIVE' and roles='{public}'::name[]) then raise exception 'Unexpected baseline roles/command for clinical_sessions'; end if;
end $$;
drop policy sessions_read_owner on clinical_sessions;
drop policy clinical_sessions_select_clinician on clinical_sessions;
create policy clinical_sessions_read_authorized on clinical_sessions for select to public
 using (((select pg_has_role(current_user, 'authenticated', 'USAGE')) and (user_id = (select auth.uid()))) or (select is_clinician()));

do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='questionnaire_instances' and policyname='instances_read_owner' and cmd='SELECT' and permissive='PERMISSIVE' and roles='{authenticated}'::name[]) or not exists(select 1 from pg_policies where schemaname='public' and tablename='questionnaire_instances' and policyname='questionnaire_instances_select_clinician' and cmd='SELECT' and permissive='PERMISSIVE' and roles='{public}'::name[]) then raise exception 'Unexpected baseline roles/command for questionnaire_instances'; end if;
end $$;
drop policy instances_read_owner on questionnaire_instances;
drop policy questionnaire_instances_select_clinician on questionnaire_instances;
create policy questionnaire_instances_read_authorized on questionnaire_instances for select to public
 using (((select pg_has_role(current_user, 'authenticated', 'USAGE')) and (user_id = (select auth.uid()))) or (select is_clinician()));

do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='messages' and policyname='messages_select_own' and cmd='SELECT' and permissive='PERMISSIVE' and roles='{public}'::name[]) or not exists(select 1 from pg_policies where schemaname='public' and tablename='messages' and policyname='messages_select_clinician' and cmd='SELECT' and permissive='PERMISSIVE' and roles='{public}'::name[]) then raise exception 'Unexpected baseline roles/command for messages'; end if;
end $$;
drop policy messages_select_own on messages;
drop policy messages_select_clinician on messages;
create policy messages_read_authorized on messages for select to public
 using ((visible_to_user = true and conversation_id in (select id from conversations where user_id = (select auth.uid()))) or (select is_clinician()));

do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='questionnaire_answers' and policyname='qa_select_own' and cmd='SELECT' and permissive='PERMISSIVE' and roles='{public}'::name[]) or not exists(select 1 from pg_policies where schemaname='public' and tablename='questionnaire_answers' and policyname='questionnaire_answers_select_clinician' and cmd='SELECT' and permissive='PERMISSIVE' and roles='{public}'::name[]) then raise exception 'Unexpected baseline roles/command for questionnaire_answers'; end if;
end $$;
drop policy qa_select_own on questionnaire_answers;
drop policy questionnaire_answers_select_clinician on questionnaire_answers;
create policy questionnaire_answers_read_authorized on questionnaire_answers for select to public
 using ((instance_id in (select id from questionnaire_instances where user_id = (select auth.uid()))) or (select is_clinician()));

do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='questionnaire_results' and policyname='qr_select_own' and cmd='SELECT' and permissive='PERMISSIVE' and roles='{public}'::name[]) or not exists(select 1 from pg_policies where schemaname='public' and tablename='questionnaire_results' and policyname='questionnaire_results_select_clinician' and cmd='SELECT' and permissive='PERMISSIVE' and roles='{public}'::name[]) then raise exception 'Unexpected baseline roles/command for questionnaire_results'; end if;
end $$;
drop policy qr_select_own on questionnaire_results;
drop policy questionnaire_results_select_clinician on questionnaire_results;
create policy questionnaire_results_read_authorized on questionnaire_results for select to public
 using ((instance_id in (select id from questionnaire_instances where user_id = (select auth.uid()))) or (select is_clinician()));

do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='risk_events' and policyname='risk_events_select_own' and cmd='SELECT' and permissive='PERMISSIVE' and roles='{public}'::name[]) or not exists(select 1 from pg_policies where schemaname='public' and tablename='risk_events' and policyname='risk_events_select_clinician' and cmd='SELECT' and permissive='PERMISSIVE' and roles='{public}'::name[]) then raise exception 'Unexpected baseline roles/command for risk_events'; end if;
end $$;
drop policy risk_events_select_own on risk_events;
drop policy risk_events_select_clinician on risk_events;
create policy risk_events_read_authorized on risk_events for select to public
 using ((user_id = (select auth.uid())) or (select is_clinician()));

do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='patient_tasks' and policyname='patient_tasks_select_own' and cmd='SELECT' and permissive='PERMISSIVE' and roles='{public}'::name[]) or not exists(select 1 from pg_policies where schemaname='public' and tablename='patient_tasks' and policyname='patient_tasks_select_clinician' and cmd='SELECT' and permissive='PERMISSIVE' and roles='{public}'::name[]) then raise exception 'Unexpected baseline roles/command for patient_tasks'; end if;
end $$;
drop policy patient_tasks_select_own on patient_tasks;
drop policy patient_tasks_select_clinician on patient_tasks;
create policy patient_tasks_read_authorized on patient_tasks for select to public
 using ((user_id = (select auth.uid())) or (select is_clinician()));

alter policy user_profiles_update_own on user_profiles using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy profile_insert_owner on user_profiles with check (user_id = (select auth.uid()) and role = 'patient');
alter policy consents_select_own on consents using (user_id = (select auth.uid()));
alter policy session_summaries_select_own on session_summaries using (user_id = (select auth.uid()));
alter function set_updated_at() set search_path = public, pg_temp;

-- END EXACT 20261012084307_acceptance_strict_rls_advisors.sql

-- BEGIN EXACT 20261013073246_hosted_trigger_acl.sql SHA256 e96c4dd71b39efa1922558a3376cdd3340cec6c605f3da4f700406ae8f24abe6
-- Trigger-only routines are not Data API contracts. Preserve platform creators
-- and service_role; do not create the hosted-only event trigger on local installs.
do $acl$
declare routine record;
begin
  if (select count(*) from pg_proc f join pg_namespace n on n.oid=f.pronamespace
      where n.nspname='public' and f.proname='handle_new_auth_user') <> 1 then
    raise exception 'Unexpected Auth trigger routine signatures';
  end if;
  select * into routine from pg_proc where oid='public.handle_new_auth_user()'::regprocedure;
  if pg_get_userbyid(routine.proowner)<>'postgres' or routine.prorettype<>'trigger'::regtype
    or not routine.prosecdef or routine.proconfig is distinct from array['search_path=public']::text[]
    or md5(routine.prosrc)<>'80b4cef3633f554d4c9aedcb4c57702f'
    or (select count(*) from pg_trigger t where t.tgrelid='auth.users'::regclass
        and t.tgname='on_auth_user_created' and t.tgfoid=routine.oid
        and t.tgenabled='O' and t.tgtype=5 and not t.tgisinternal)<>1 then
    raise exception 'Unexpected Auth trigger definition/binding';
  end if;
  grant execute on function public.handle_new_auth_user() to service_role;
  -- Vanilla PG regression/fresh local bootstrap may omit platform roles.
  if exists(select 1 from pg_roles where rolname='supabase_auth_admin') then
    grant execute on function public.handle_new_auth_user() to supabase_auth_admin;
  end if;
  if exists(select 1 from pg_roles where rolname='supabase_admin') then
    grant execute on function public.handle_new_auth_user() to supabase_admin;
  end if;
  grant execute on function public.handle_new_auth_user() to postgres;
  revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;

  if to_regprocedure('public.rls_auto_enable()') is null then
    if exists(select 1 from pg_proc f join pg_namespace n on n.oid=f.pronamespace
      where n.nspname='public' and f.proname='rls_auto_enable')
      or exists(select 1 from pg_event_trigger where evtname='ensure_rls') then
      raise exception 'Unexpected hosted event trigger signature';
    end if;
    return;
  end if;
  if (select count(*) from pg_proc f join pg_namespace n on n.oid=f.pronamespace
      where n.nspname='public' and f.proname='rls_auto_enable')<>1 then
    raise exception 'Unexpected hosted event routine signatures';
  end if;
  select * into routine from pg_proc where oid='public.rls_auto_enable()'::regprocedure;
  if pg_get_userbyid(routine.proowner)<>'postgres' or routine.prorettype<>'event_trigger'::regtype
    or not routine.prosecdef or routine.proconfig is distinct from array['search_path=pg_catalog']::text[]
    or md5(routine.prosrc)<>'99be20677b456ea8d3be47bdd44fb369'
    or (select count(*) from pg_event_trigger e where e.evtname='ensure_rls'
      and e.evtevent='ddl_command_end' and e.evtenabled='O' and e.evtfoid=routine.oid
      and pg_get_userbyid(e.evtowner)='postgres' and e.evttags is null)<>1 then
    raise exception 'Unexpected hosted event trigger definition/binding';
  end if;
  grant execute on function public.rls_auto_enable() to postgres, service_role;
  if exists(select 1 from pg_roles where rolname='supabase_admin') then
    grant execute on function public.rls_auto_enable() to supabase_admin;
  end if;
  if exists(select 1 from pg_roles where rolname='supabase_auth_admin') then
    grant execute on function public.rls_auto_enable() to supabase_auth_admin;
  end if;
  revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
end;
$acl$;

-- END EXACT 20261013073246_hosted_trigger_acl.sql

-- No row transformation is authorized by this schema packet.
do $preserved$
declare original record; total bigint; digest text;
begin
  for original in select * from pg_temp.serenia_preservation loop
    execute format($q$select count(*),encode(sha256(convert_to(coalesce(string_agg(row_hash,'' order by row_hash),''),'UTF8')),'hex')
      from (select encode(sha256(convert_to($1 || to_jsonb(r)::text,'UTF8')),'hex') row_hash from %s r) x$q$,original.relation_name)
      into total,digest using original.nonce;
    if total<>original.expected_count or digest<>original.aggregate_sha256 then
      raise exception 'Hosted account/catalog preservation failed; transaction must roll back';
    end if;
  end loop;
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity) then
    raise exception 'Public table missing RLS';
  end if;
  if has_function_privilege('anon','public.handle_new_auth_user()','EXECUTE')
    or has_function_privilege('authenticated','public.handle_new_auth_user()','EXECUTE')
    or has_function_privilege('anon','public.rls_auto_enable()','EXECUTE')
    or has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE') then
    raise exception 'Trigger function client EXECUTE remains';
  end if;
end;
$preserved$;
