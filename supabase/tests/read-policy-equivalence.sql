-- Disposable PostgreSQL behavioral old/new equivalence; auth.uid() remains a shim.
-- Compare actual readable rowsets and permission failures; no remote stack.
begin;
create role acceptance_inherited nologin inherit;
grant authenticated to acceptance_inherited;
create temporary table acceptance_rowsets(version text, actor text, table_name text, rows jsonb);
grant insert,select on acceptance_rowsets to public;
create function pg_temp.read_rows(table_name text) returns jsonb language plpgsql as $$
declare result jsonb;
begin
 execute format('select coalesce(jsonb_agg(id order by id),''[]''::jsonb) from public.%I',table_name) into result;
 return result;
exception when insufficient_privilege then return jsonb_build_object('sqlstate',sqlstate);
end $$;
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
insert into acceptance_rowsets values('new','authenticated:00000000-0000-0000-0000-000000000001','user_profiles',pg_temp.read_rows('user_profiles'));
insert into acceptance_rowsets values('new','authenticated:00000000-0000-0000-0000-000000000001','conversations',pg_temp.read_rows('conversations'));
insert into acceptance_rowsets values('new','authenticated:00000000-0000-0000-0000-000000000001','clinical_sessions',pg_temp.read_rows('clinical_sessions'));
insert into acceptance_rowsets values('new','authenticated:00000000-0000-0000-0000-000000000001','questionnaire_instances',pg_temp.read_rows('questionnaire_instances'));
insert into acceptance_rowsets values('new','authenticated:00000000-0000-0000-0000-000000000001','messages',pg_temp.read_rows('messages'));
insert into acceptance_rowsets values('new','authenticated:00000000-0000-0000-0000-000000000001','questionnaire_answers',pg_temp.read_rows('questionnaire_answers'));
insert into acceptance_rowsets values('new','authenticated:00000000-0000-0000-0000-000000000001','questionnaire_results',pg_temp.read_rows('questionnaire_results'));
insert into acceptance_rowsets values('new','authenticated:00000000-0000-0000-0000-000000000001','risk_events',pg_temp.read_rows('risk_events'));
insert into acceptance_rowsets values('new','authenticated:00000000-0000-0000-0000-000000000001','patient_tasks',pg_temp.read_rows('patient_tasks'));
reset role;
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
insert into acceptance_rowsets values('new','authenticated:00000000-0000-0000-0000-000000000002','user_profiles',pg_temp.read_rows('user_profiles'));
insert into acceptance_rowsets values('new','authenticated:00000000-0000-0000-0000-000000000002','conversations',pg_temp.read_rows('conversations'));
insert into acceptance_rowsets values('new','authenticated:00000000-0000-0000-0000-000000000002','clinical_sessions',pg_temp.read_rows('clinical_sessions'));
insert into acceptance_rowsets values('new','authenticated:00000000-0000-0000-0000-000000000002','questionnaire_instances',pg_temp.read_rows('questionnaire_instances'));
insert into acceptance_rowsets values('new','authenticated:00000000-0000-0000-0000-000000000002','messages',pg_temp.read_rows('messages'));
insert into acceptance_rowsets values('new','authenticated:00000000-0000-0000-0000-000000000002','questionnaire_answers',pg_temp.read_rows('questionnaire_answers'));
insert into acceptance_rowsets values('new','authenticated:00000000-0000-0000-0000-000000000002','questionnaire_results',pg_temp.read_rows('questionnaire_results'));
insert into acceptance_rowsets values('new','authenticated:00000000-0000-0000-0000-000000000002','risk_events',pg_temp.read_rows('risk_events'));
insert into acceptance_rowsets values('new','authenticated:00000000-0000-0000-0000-000000000002','patient_tasks',pg_temp.read_rows('patient_tasks'));
reset role;
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
insert into acceptance_rowsets values('new','authenticated:00000000-0000-0000-0000-000000000003','user_profiles',pg_temp.read_rows('user_profiles'));
insert into acceptance_rowsets values('new','authenticated:00000000-0000-0000-0000-000000000003','conversations',pg_temp.read_rows('conversations'));
insert into acceptance_rowsets values('new','authenticated:00000000-0000-0000-0000-000000000003','clinical_sessions',pg_temp.read_rows('clinical_sessions'));
insert into acceptance_rowsets values('new','authenticated:00000000-0000-0000-0000-000000000003','questionnaire_instances',pg_temp.read_rows('questionnaire_instances'));
insert into acceptance_rowsets values('new','authenticated:00000000-0000-0000-0000-000000000003','messages',pg_temp.read_rows('messages'));
insert into acceptance_rowsets values('new','authenticated:00000000-0000-0000-0000-000000000003','questionnaire_answers',pg_temp.read_rows('questionnaire_answers'));
insert into acceptance_rowsets values('new','authenticated:00000000-0000-0000-0000-000000000003','questionnaire_results',pg_temp.read_rows('questionnaire_results'));
insert into acceptance_rowsets values('new','authenticated:00000000-0000-0000-0000-000000000003','risk_events',pg_temp.read_rows('risk_events'));
insert into acceptance_rowsets values('new','authenticated:00000000-0000-0000-0000-000000000003','patient_tasks',pg_temp.read_rows('patient_tasks'));
reset role;
set role anon; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
insert into acceptance_rowsets values('new','anon:00000000-0000-0000-0000-000000000001','user_profiles',pg_temp.read_rows('user_profiles'));
insert into acceptance_rowsets values('new','anon:00000000-0000-0000-0000-000000000001','conversations',pg_temp.read_rows('conversations'));
insert into acceptance_rowsets values('new','anon:00000000-0000-0000-0000-000000000001','clinical_sessions',pg_temp.read_rows('clinical_sessions'));
insert into acceptance_rowsets values('new','anon:00000000-0000-0000-0000-000000000001','questionnaire_instances',pg_temp.read_rows('questionnaire_instances'));
insert into acceptance_rowsets values('new','anon:00000000-0000-0000-0000-000000000001','messages',pg_temp.read_rows('messages'));
insert into acceptance_rowsets values('new','anon:00000000-0000-0000-0000-000000000001','questionnaire_answers',pg_temp.read_rows('questionnaire_answers'));
insert into acceptance_rowsets values('new','anon:00000000-0000-0000-0000-000000000001','questionnaire_results',pg_temp.read_rows('questionnaire_results'));
insert into acceptance_rowsets values('new','anon:00000000-0000-0000-0000-000000000001','risk_events',pg_temp.read_rows('risk_events'));
insert into acceptance_rowsets values('new','anon:00000000-0000-0000-0000-000000000001','patient_tasks',pg_temp.read_rows('patient_tasks'));
reset role;
set role acceptance_inherited; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
insert into acceptance_rowsets values('new','acceptance_inherited:00000000-0000-0000-0000-000000000001','user_profiles',pg_temp.read_rows('user_profiles'));
insert into acceptance_rowsets values('new','acceptance_inherited:00000000-0000-0000-0000-000000000001','conversations',pg_temp.read_rows('conversations'));
insert into acceptance_rowsets values('new','acceptance_inherited:00000000-0000-0000-0000-000000000001','clinical_sessions',pg_temp.read_rows('clinical_sessions'));
insert into acceptance_rowsets values('new','acceptance_inherited:00000000-0000-0000-0000-000000000001','questionnaire_instances',pg_temp.read_rows('questionnaire_instances'));
insert into acceptance_rowsets values('new','acceptance_inherited:00000000-0000-0000-0000-000000000001','messages',pg_temp.read_rows('messages'));
insert into acceptance_rowsets values('new','acceptance_inherited:00000000-0000-0000-0000-000000000001','questionnaire_answers',pg_temp.read_rows('questionnaire_answers'));
insert into acceptance_rowsets values('new','acceptance_inherited:00000000-0000-0000-0000-000000000001','questionnaire_results',pg_temp.read_rows('questionnaire_results'));
insert into acceptance_rowsets values('new','acceptance_inherited:00000000-0000-0000-0000-000000000001','risk_events',pg_temp.read_rows('risk_events'));
insert into acceptance_rowsets values('new','acceptance_inherited:00000000-0000-0000-0000-000000000001','patient_tasks',pg_temp.read_rows('patient_tasks'));
reset role;
drop policy user_profiles_read_authorized on user_profiles;
create policy "user_profiles_select_own"
  on user_profiles for select
  using (user_id = auth.uid());
create policy "user_profiles_select_clinician"
  on user_profiles for select
  using (is_clinician());
drop policy conversations_read_authorized on conversations;
create policy conversations_read_owner on conversations for select to authenticated using(user_id=auth.uid());
create policy "conversations_select_clinician"
  on conversations for select
  using (is_clinician());
drop policy clinical_sessions_read_authorized on clinical_sessions;
create policy sessions_read_owner on clinical_sessions for select to authenticated using(user_id=auth.uid());
create policy "clinical_sessions_select_clinician"
  on clinical_sessions for select
  using (is_clinician());
drop policy questionnaire_instances_read_authorized on questionnaire_instances;
create policy instances_read_owner on questionnaire_instances for select to authenticated using(user_id=auth.uid());
create policy "questionnaire_instances_select_clinician"
  on questionnaire_instances for select
  using (is_clinician());
drop policy messages_read_authorized on messages;
create policy "messages_select_own"
  on messages for select
  using (
    visible_to_user = true
    and conversation_id in (
      select id from conversations where user_id = auth.uid()
    )
  );
create policy "messages_select_clinician"
  on messages for select
  using (is_clinician());
drop policy questionnaire_answers_read_authorized on questionnaire_answers;
create policy "qa_select_own"
  on questionnaire_answers for select
  using (
    instance_id in (
      select id from questionnaire_instances where user_id = auth.uid()
    )
  );
create policy "questionnaire_answers_select_clinician"
  on questionnaire_answers for select
  using (is_clinician());
drop policy questionnaire_results_read_authorized on questionnaire_results;
create policy "qr_select_own"
  on questionnaire_results for select
  using (
    instance_id in (
      select id from questionnaire_instances where user_id = auth.uid()
    )
  );
create policy "questionnaire_results_select_clinician"
  on questionnaire_results for select
  using (is_clinician());
drop policy risk_events_read_authorized on risk_events;
create policy "risk_events_select_own"
  on risk_events for select
  using (user_id = auth.uid());
create policy "risk_events_select_clinician"
  on risk_events for select
  using (is_clinician());
drop policy patient_tasks_read_authorized on patient_tasks;
create policy patient_tasks_select_own on patient_tasks
  for select using (user_id = auth.uid());
create policy patient_tasks_select_clinician on patient_tasks
  for select using (is_clinician());
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
insert into acceptance_rowsets values('old','authenticated:00000000-0000-0000-0000-000000000001','user_profiles',pg_temp.read_rows('user_profiles'));
insert into acceptance_rowsets values('old','authenticated:00000000-0000-0000-0000-000000000001','conversations',pg_temp.read_rows('conversations'));
insert into acceptance_rowsets values('old','authenticated:00000000-0000-0000-0000-000000000001','clinical_sessions',pg_temp.read_rows('clinical_sessions'));
insert into acceptance_rowsets values('old','authenticated:00000000-0000-0000-0000-000000000001','questionnaire_instances',pg_temp.read_rows('questionnaire_instances'));
insert into acceptance_rowsets values('old','authenticated:00000000-0000-0000-0000-000000000001','messages',pg_temp.read_rows('messages'));
insert into acceptance_rowsets values('old','authenticated:00000000-0000-0000-0000-000000000001','questionnaire_answers',pg_temp.read_rows('questionnaire_answers'));
insert into acceptance_rowsets values('old','authenticated:00000000-0000-0000-0000-000000000001','questionnaire_results',pg_temp.read_rows('questionnaire_results'));
insert into acceptance_rowsets values('old','authenticated:00000000-0000-0000-0000-000000000001','risk_events',pg_temp.read_rows('risk_events'));
insert into acceptance_rowsets values('old','authenticated:00000000-0000-0000-0000-000000000001','patient_tasks',pg_temp.read_rows('patient_tasks'));
reset role;
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
insert into acceptance_rowsets values('old','authenticated:00000000-0000-0000-0000-000000000002','user_profiles',pg_temp.read_rows('user_profiles'));
insert into acceptance_rowsets values('old','authenticated:00000000-0000-0000-0000-000000000002','conversations',pg_temp.read_rows('conversations'));
insert into acceptance_rowsets values('old','authenticated:00000000-0000-0000-0000-000000000002','clinical_sessions',pg_temp.read_rows('clinical_sessions'));
insert into acceptance_rowsets values('old','authenticated:00000000-0000-0000-0000-000000000002','questionnaire_instances',pg_temp.read_rows('questionnaire_instances'));
insert into acceptance_rowsets values('old','authenticated:00000000-0000-0000-0000-000000000002','messages',pg_temp.read_rows('messages'));
insert into acceptance_rowsets values('old','authenticated:00000000-0000-0000-0000-000000000002','questionnaire_answers',pg_temp.read_rows('questionnaire_answers'));
insert into acceptance_rowsets values('old','authenticated:00000000-0000-0000-0000-000000000002','questionnaire_results',pg_temp.read_rows('questionnaire_results'));
insert into acceptance_rowsets values('old','authenticated:00000000-0000-0000-0000-000000000002','risk_events',pg_temp.read_rows('risk_events'));
insert into acceptance_rowsets values('old','authenticated:00000000-0000-0000-0000-000000000002','patient_tasks',pg_temp.read_rows('patient_tasks'));
reset role;
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
insert into acceptance_rowsets values('old','authenticated:00000000-0000-0000-0000-000000000003','user_profiles',pg_temp.read_rows('user_profiles'));
insert into acceptance_rowsets values('old','authenticated:00000000-0000-0000-0000-000000000003','conversations',pg_temp.read_rows('conversations'));
insert into acceptance_rowsets values('old','authenticated:00000000-0000-0000-0000-000000000003','clinical_sessions',pg_temp.read_rows('clinical_sessions'));
insert into acceptance_rowsets values('old','authenticated:00000000-0000-0000-0000-000000000003','questionnaire_instances',pg_temp.read_rows('questionnaire_instances'));
insert into acceptance_rowsets values('old','authenticated:00000000-0000-0000-0000-000000000003','messages',pg_temp.read_rows('messages'));
insert into acceptance_rowsets values('old','authenticated:00000000-0000-0000-0000-000000000003','questionnaire_answers',pg_temp.read_rows('questionnaire_answers'));
insert into acceptance_rowsets values('old','authenticated:00000000-0000-0000-0000-000000000003','questionnaire_results',pg_temp.read_rows('questionnaire_results'));
insert into acceptance_rowsets values('old','authenticated:00000000-0000-0000-0000-000000000003','risk_events',pg_temp.read_rows('risk_events'));
insert into acceptance_rowsets values('old','authenticated:00000000-0000-0000-0000-000000000003','patient_tasks',pg_temp.read_rows('patient_tasks'));
reset role;
set role anon; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
insert into acceptance_rowsets values('old','anon:00000000-0000-0000-0000-000000000001','user_profiles',pg_temp.read_rows('user_profiles'));
insert into acceptance_rowsets values('old','anon:00000000-0000-0000-0000-000000000001','conversations',pg_temp.read_rows('conversations'));
insert into acceptance_rowsets values('old','anon:00000000-0000-0000-0000-000000000001','clinical_sessions',pg_temp.read_rows('clinical_sessions'));
insert into acceptance_rowsets values('old','anon:00000000-0000-0000-0000-000000000001','questionnaire_instances',pg_temp.read_rows('questionnaire_instances'));
insert into acceptance_rowsets values('old','anon:00000000-0000-0000-0000-000000000001','messages',pg_temp.read_rows('messages'));
insert into acceptance_rowsets values('old','anon:00000000-0000-0000-0000-000000000001','questionnaire_answers',pg_temp.read_rows('questionnaire_answers'));
insert into acceptance_rowsets values('old','anon:00000000-0000-0000-0000-000000000001','questionnaire_results',pg_temp.read_rows('questionnaire_results'));
insert into acceptance_rowsets values('old','anon:00000000-0000-0000-0000-000000000001','risk_events',pg_temp.read_rows('risk_events'));
insert into acceptance_rowsets values('old','anon:00000000-0000-0000-0000-000000000001','patient_tasks',pg_temp.read_rows('patient_tasks'));
reset role;
set role acceptance_inherited; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
insert into acceptance_rowsets values('old','acceptance_inherited:00000000-0000-0000-0000-000000000001','user_profiles',pg_temp.read_rows('user_profiles'));
insert into acceptance_rowsets values('old','acceptance_inherited:00000000-0000-0000-0000-000000000001','conversations',pg_temp.read_rows('conversations'));
insert into acceptance_rowsets values('old','acceptance_inherited:00000000-0000-0000-0000-000000000001','clinical_sessions',pg_temp.read_rows('clinical_sessions'));
insert into acceptance_rowsets values('old','acceptance_inherited:00000000-0000-0000-0000-000000000001','questionnaire_instances',pg_temp.read_rows('questionnaire_instances'));
insert into acceptance_rowsets values('old','acceptance_inherited:00000000-0000-0000-0000-000000000001','messages',pg_temp.read_rows('messages'));
insert into acceptance_rowsets values('old','acceptance_inherited:00000000-0000-0000-0000-000000000001','questionnaire_answers',pg_temp.read_rows('questionnaire_answers'));
insert into acceptance_rowsets values('old','acceptance_inherited:00000000-0000-0000-0000-000000000001','questionnaire_results',pg_temp.read_rows('questionnaire_results'));
insert into acceptance_rowsets values('old','acceptance_inherited:00000000-0000-0000-0000-000000000001','risk_events',pg_temp.read_rows('risk_events'));
insert into acceptance_rowsets values('old','acceptance_inherited:00000000-0000-0000-0000-000000000001','patient_tasks',pg_temp.read_rows('patient_tasks'));
reset role;
do $$ begin
 if exists(select actor,table_name,rows from acceptance_rowsets where version='old' except select actor,table_name,rows from acceptance_rowsets where version='new') or exists(select actor,table_name,rows from acceptance_rowsets where version='new' except select actor,table_name,rows from acceptance_rowsets where version='old') then raise exception 'Read policy behavioral role/rowset regression'; end if;
end $$;
rollback;
