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
