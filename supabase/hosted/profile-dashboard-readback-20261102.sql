-- READ ONLY. One SELECT, one MVCC snapshot. Confirm project ref in the Dashboard UI; SQL cannot prove it.
-- Catalog/RLS flags and effective ACL are read back, but role membership, JWT and Data API enforcement were not baselined.
-- No pre-apply view/materialized/foreign relation baseline exists: any such public relation fails verification.
-- Save the single JSON value as a file, then verify with scripts/profile-hosted-readback.mjs.
select jsonb_build_object(
  'executionContext', (select jsonb_build_object('currentUser', current_user, 'sessionUser', session_user,
    'isSuperuser', r.rolsuper, 'bypassesRls', r.rolbypassrls)
    from pg_roles r where r.rolname=current_user),
  'clientRoleAttributes', (select coalesce(jsonb_agg(jsonb_build_object('name', r.rolname,
    'isSuperuser', r.rolsuper, 'bypassesRls', r.rolbypassrls) order by r.rolname), '[]'::jsonb)
    from pg_roles r where r.rolname in ('anon','authenticated')),
  'publicUnbaselinedRelations', (select coalesce(jsonb_agg(jsonb_build_object('name', c.relname,
    'kind', c.relkind) order by c.relname, c.relkind), '[]'::jsonb)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('v','m','f')),
  'proposalRows', (select coalesce(jsonb_agg(jsonb_build_object(
    'version', version, 'name', name, 'statementCount', cardinality(statements),
    'statementBytes', octet_length(convert_to(statements[1], 'UTF8')),
    'statementSha256', encode(sha256(convert_to(statements[1], 'UTF8')), 'hex'))), '[]'::jsonb)
    from supabase_migrations.schema_migrations where version = '20261102122007'),
  'historyCount', (select count(*) from supabase_migrations.schema_migrations),
  'oldHistory', (select coalesce(jsonb_agg(jsonb_build_object('version', version,
    'name', name, 'statements_md5', md5(array_to_string(statements, E'\n'))) order by version), '[]'::jsonb)
    from supabase_migrations.schema_migrations where version <> '20261102122007'),
  'snapshot', (with tables_snapshot as (
 select c.relname as name,pg_get_userbyid(c.relowner) as owner,c.relrowsecurity as rls,c.relforcerowsecurity as force_rls,c.relacl::text as acl,
  (select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) as columns,
  (select jsonb_agg(jsonb_build_object('name',co.conname,'definition',pg_get_constraintdef(co.oid)) order by co.conname) from pg_constraint co where co.conrelid=c.oid and co.conname<>'profile_source_identity') as constraints,
  (select jsonb_agg(jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) order by t.tgname) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal and t.tgname not in ('profile_source_immutable','enqueue_profile_source')) as triggers,
  (select jsonb_agg(to_jsonb(p) order by p.policyname) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as policies,
  (select jsonb_agg(jsonb_build_object('name',i.relname,'definition',pg_get_indexdef(i.oid)) order by i.relname) from pg_index ix join pg_class i on i.oid=ix.indexrelid where ix.indrelid=c.oid and i.relname<>'profile_source_identity') as indexes
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and c.relname in (select jsonb_array_elements_text('["assessment_jobs","assessments","audit_log","care_plans","chat_turns","clinical_sessions","clinician_reviews","clinicians","consents","conversations","messages","patient_context_injections","patient_tasks","questionnaire_answers","questionnaire_definitions","questionnaire_instances","questionnaire_items","questionnaire_results","risk_events","session_close_proposals","session_summaries","user_clinician_assignments","user_profiles"]'::jsonb))
), routines_snapshot as (
 select 'public.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' as signature,pg_get_userbyid(p.proowner) as owner,p.prosecdef as security_definer,p.provolatile as volatility,l.lanname as language,p.proconfig as config,p.proacl::text as acl,md5(pg_get_functiondef(p.oid)) as definition_md5
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang where n.nspname='public' and p.prokind='f' and 'public.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' in (select jsonb_array_elements_text('["public.assessment_summary_valid_for_risk(doc jsonb)","public.begin_chat_turn(p_session_id uuid, p_user_id uuid, p_request_id text, p_text text, p_crisis boolean, p_urgent boolean)","public.begin_chat_turn_after_onboarding(p_session_id uuid, p_user_id uuid, p_request_id text, p_text text, p_crisis boolean, p_urgent boolean)","public.claim_assessment_jobs(p_limit integer, p_session_id uuid)","public.close_chat_turn(p_session_id uuid, p_request_id text, p_token uuid, p_reason text)","public.close_session_atomic(p_session_id uuid, p_user_id uuid, p_reason text)","public.close_stale_sessions(threshold_minutes integer)","public.complete_patient_onboarding(p_informal_name text, p_pronouns text, p_birth_date date, p_reason text, p_version text, p_accepted boolean)","public.create_questionnaire_atomic(p_session_id uuid, p_user_id uuid, p_conversation_id uuid, p_code text, p_reason text, p_request_id text, p_token uuid)","public.create_session_after_onboarding(p_user_id uuid)","public.create_session_atomic(p_user_id uuid)","public.derive_patient_risk_state_sql(p_reviewed_at timestamp with time zone, p_suicidality text, p_critical boolean, p_latest_open timestamp with time zone, p_latest_high timestamp with time zone, p_previous_at timestamp with time zone, p_previous_reason text, p_now timestamp with time zone)","public.fail_chat_turn(p_session_id uuid, p_request_id text, p_token uuid, p_error text)","public.finish_assessment_job(p_session_id uuid, p_token uuid, p_status text, p_summary jsonb)","public.finish_chat_turn(p_session_id uuid, p_request_id text, p_token uuid, p_parts jsonb, p_chunks jsonb, p_proposal text, p_close_reason text)","public.gdpr_erase_user(target_user_id uuid)","public.get_chat_turn_recovery(p_session_id uuid)","public.get_clinician_inbox_page(p_offset integer, p_limit integer, p_pending_only boolean)","public.get_onboarding_ready()","public.get_patient_session_reports(p_session_ids uuid[])","public.handle_new_auth_user()","public.is_clinician()","public.patient_onboarding_ready(p_user_id uuid)","public.recover_assessment_jobs(p_limit integer)","public.regenerate_assessment_atomic(p_assessment_id uuid, p_expected_status text, p_restore boolean)","public.require_open_message_session()","public.review_assessment_atomic(p_session_id uuid, p_assessment_id uuid, p_action text, p_summary jsonb, p_notes text, p_inherited_updates jsonb, p_reason text)","public.rls_auto_enable()","public.set_updated_at()","public.start_questionnaire_atomic(p_instance_id uuid, p_user_id uuid)","public.submit_questionnaire_atomic(p_instance_id uuid, p_user_id uuid, p_answers jsonb, p_result jsonb, p_risk_severity text)","public.touch_session_atomic(p_session_id uuid)","public.update_assessment_job(p_session_id uuid, p_token uuid, p_action text, p_run_id text)","public.validate_answer_parent()"]'::jsonb))
), catalog_snapshot as (
 select d.code,encode(sha256(convert_to((to_jsonb(d)-'id'-'created_at'-'updated_at')::text,'UTF8')),'hex') as definition_sha256,
 (select count(*) from public.questionnaire_items i where i.questionnaire_id=d.id) as items,
 (select encode(sha256(convert_to(coalesce(string_agg((to_jsonb(i)-'id'-'questionnaire_id'-'created_at'-'updated_at')::text,E'\n' order by i.order_index),''),'UTF8')),'hex') from public.questionnaire_items i where i.questionnaire_id=d.id) as items_sha256
 from public.questionnaire_definitions d
)
select jsonb_build_object(
 'history',(select jsonb_agg(jsonb_build_object('version',version,'name',name,'statements_md5',md5(array_to_string(statements,E'\n'))) order by version) from supabase_migrations.schema_migrations),
 'catalog',(select jsonb_agg(to_jsonb(x) order by code) from catalog_snapshot x),
 'tableNames',(select jsonb_agg(name order by name) from tables_snapshot),
 'tableFingerprint',(select md5(jsonb_agg(to_jsonb(t) order by name)::text) from tables_snapshot t),
 'routineSignatures',(select jsonb_agg(signature order by signature) from routines_snapshot),
 'routineFingerprint',(select md5(jsonb_agg(to_jsonb(r) order by signature)::text) from routines_snapshot r),
 'platform',jsonb_build_object('authOwner',pg_get_userbyid((select relowner from pg_class where oid='auth.users'::regclass)),
  'rlsRoutine',(select to_jsonb(r) from routines_snapshot r where signature='public.rls_auto_enable()'),
  'eventTriggers',(select jsonb_agg(jsonb_build_object('name',e.evtname,'event',e.evtevent,'enabled',e.evtenabled,'tags',e.evttags,'function',(select format('%I.%I(%s)',fn.nspname,fp.proname,pg_get_function_identity_arguments(fp.oid)) from pg_proc fp join pg_namespace fn on fn.oid=fp.pronamespace where fp.oid=e.evtfoid),'owner',pg_get_userbyid(e.evtowner)) order by e.evtname) from pg_event_trigger e),
  'authTriggers',(select jsonb_agg(jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) order by t.tgname) from pg_trigger t where t.tgrelid='auth.users'::regclass and not t.tgisinternal)),
 'counts',jsonb_build_object('auth', (select count(*) from auth.users),'profiles',(select count(*) from public.user_profiles),'definitions',(select count(*) from public.questionnaire_definitions),'items',(select count(*) from public.questionnaire_items)),
 'clinicalCounts',(select jsonb_build_object('assessments',(select count(*) from public.assessments),'audit_log',(select count(*) from public.audit_log),'care_plans',(select count(*) from public.care_plans),'clinical_sessions',(select count(*) from public.clinical_sessions),'clinician_reviews',(select count(*) from public.clinician_reviews),'clinicians',(select count(*) from public.clinicians),'consents',(select count(*) from public.consents),'conversations',(select count(*) from public.conversations),'messages',(select count(*) from public.messages),'patient_context_injections',(select count(*) from public.patient_context_injections),'patient_tasks',(select count(*) from public.patient_tasks),'questionnaire_answers',(select count(*) from public.questionnaire_answers),'questionnaire_instances',(select count(*) from public.questionnaire_instances),'questionnaire_results',(select count(*) from public.questionnaire_results),'risk_events',(select count(*) from public.risk_events),'session_summaries',(select count(*) from public.session_summaries),'user_clinician_assignments',(select count(*) from public.user_clinician_assignments))),
 'profileObjectsAbsent',to_regclass('public.profile_settings') is null and to_regclass('public.profile_extraction_jobs') is null and to_regclass('public.profile_observations') is null and to_regprocedure('public.get_profile_memory()') is null and to_regprocedure('public.get_profile_memory_page(timestamptz,uuid)') is null
) as baseline),
  'newObjects', (with new_tables as (
 select c.relname as name,pg_get_userbyid(c.relowner) as owner,c.relrowsecurity as rls,c.relforcerowsecurity as force_rls,c.relacl::text as acl,
  (select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) as columns,
  (select jsonb_agg(jsonb_build_object('name',co.conname,'definition',pg_get_constraintdef(co.oid)) order by co.conname) from pg_constraint co where co.conrelid=c.oid) as constraints,
  (select jsonb_agg(jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) order by t.tgname) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal) as triggers,
  (select jsonb_agg(to_jsonb(p) order by p.policyname) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as policies,
  (select jsonb_agg(jsonb_build_object('name',i.relname,'definition',pg_get_indexdef(i.oid)) order by i.relname) from pg_index ix join pg_class i on i.oid=ix.indexrelid where ix.indrelid=c.oid) as indexes
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and c.relname in ('profile_settings','profile_extraction_jobs','profile_observations')
), new_routines as (
 select 'public.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' as signature,pg_get_userbyid(p.proowner) as owner,p.prosecdef as security_definer,p.provolatile as volatility,l.lanname as language,p.proconfig as config,p.proacl::text as acl,md5(pg_get_functiondef(p.oid)) as definition_md5
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang where n.nspname='public' and p.prokind='f' and p.proname in ('profile_message_text','profile_source_immutable','enqueue_profile_source','validate_profile_source','validate_profile_observation','set_profile_enabled','get_profile_memory','claim_profile_jobs','lock_profile_job','start_profile_job','update_profile_job','finish_profile_job','review_profile_observation','get_profile_memory_page')
)
select jsonb_build_object(
 'tables',(select jsonb_agg(to_jsonb(t) order by name) from new_tables t),
 'routines',(select jsonb_agg(to_jsonb(r) order by signature) from new_routines r),
 'messageConstraint',(select jsonb_build_object('definition',pg_get_constraintdef(co.oid),'validated',co.convalidated,'deferrable',co.condeferrable,'deferred',co.condeferred) from pg_constraint co where co.conrelid='public.messages'::regclass and co.conname='profile_source_identity'),
 'messageIndex',(select pg_get_indexdef(i.oid) from pg_class i join pg_namespace n on n.oid=i.relnamespace where n.nspname='public' and i.relname='profile_source_identity'),
 'messageTriggers',(select jsonb_agg(jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) order by t.tgname) from pg_trigger t where t.tgrelid='public.messages'::regclass and t.tgname in ('profile_source_immutable','enqueue_profile_source'))
)),
  'publicTableCount', (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p')),
  'publicFunctionCount', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f'),
  'publicTablesWithoutRls', (select coalesce(jsonb_agg(c.relname order by c.relname), '[]'::jsonb)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity),
  'newTableCounts', (select jsonb_object_agg(name, total) from (
    select 'profile_settings' name, count(*) total from public.profile_settings
    union all select 'profile_extraction_jobs', count(*) from public.profile_extraction_jobs
    union all select 'profile_observations', count(*) from public.profile_observations) x),
  'tableAcl', (select jsonb_agg(jsonb_build_object('table', c.relname, 'role', roles.role_name,
    'privilege', privileges.privilege_name,
    'allowed', has_table_privilege(roles.role_name, c.oid, privileges.privilege_name))
    order by c.relname, roles.role_name, privileges.privilege_name)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    cross join (values ('anon'), ('authenticated'), ('service_role')) roles(role_name)
    cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'),
      ('REFERENCES'), ('TRIGGER'), ('MAINTAIN')) privileges(privilege_name)
    where n.nspname='public' and c.relname in ('profile_settings','profile_extraction_jobs','profile_observations')
      and c.relkind in ('r','p')),
  'functionAcl', (select jsonb_agg(jsonb_build_object('name', p.proname, 'role', roles.role_name,
    'allowed', has_function_privilege(roles.role_name, p.oid, 'EXECUTE'))
    order by p.proname, roles.role_name)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    cross join (values ('anon'), ('authenticated'), ('service_role')) roles(role_name)
    where n.nspname='public' and p.proname in
      ('profile_message_text','profile_source_immutable','enqueue_profile_source','validate_profile_source',
       'validate_profile_observation','set_profile_enabled','get_profile_memory','claim_profile_jobs',
       'lock_profile_job','start_profile_job','update_profile_job','finish_profile_job',
       'review_profile_observation','get_profile_memory_page'))
) as profile_readback;
